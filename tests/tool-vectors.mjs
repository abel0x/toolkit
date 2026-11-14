#!/usr/bin/env node
/* Known-answer checks for tools without vectors in the other suites, run against the real pages in Firefox. */
import assert from 'node:assert/strict';
import { createHash, createHmac, generateKeyPairSync, sign, constants } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { withFirefox } from './browser-session.mjs';

// JWTs signed here with Node's own crypto, so the decoder's verification is
// checked against an independent implementation.
const b64url = (data) => Buffer.from(data).toString('base64url');
function jwt(alg, signer, extraHeader = {}) {
  const head = b64url(JSON.stringify({ alg, typ: 'JWT', ...extraHeader }));
  const body = b64url(JSON.stringify({ sub: 'mira', name: 'Çağrı Öz', iat: 1767225600 }));
  return `${head}.${body}.${b64url(signer(Buffer.from(`${head}.${body}`)))}`;
}
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherRsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const ec = { 'P-256': generateKeyPairSync('ec', { namedCurve: 'P-256' }), 'P-384': generateKeyPairSync('ec', { namedCurve: 'P-384' }), 'P-521': generateKeyPairSync('ec', { namedCurve: 'P-521' }) };
const ed = generateKeyPairSync('ed25519');
const pem = (pair) => pair.publicKey.export({ type: 'spki', format: 'pem' });
const jwk = (pair) => pair.publicKey.export({ format: 'jwk' });
const secret = 'toolkit-demo-secret-with-enough-length';
const secret64 = Buffer.from('binary\u0000secret\u00ffbytes').toString('base64');
const JWT_CASES = [
  ['HS256 secret', jwt('HS256', (d) => createHmac('sha256', secret).update(d).digest()), secret, false, 'valid'],
  ['HS512 base64 secret', jwt('HS512', (d) => createHmac('sha512', Buffer.from(secret64, 'base64')).update(d).digest()), secret64, true, 'valid'],
  ['RS256 PEM', jwt('RS256', (d) => sign('sha256', d, rsa.privateKey)), pem(rsa), false, 'valid'],
  ['RS384 JWK', jwt('RS384', (d) => sign('sha384', d, rsa.privateKey)), JSON.stringify(jwk(rsa)), false, 'valid'],
  ['PS256 PEM', jwt('PS256', (d) => sign('sha256', d, { key: rsa.privateKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 })), pem(rsa), false, 'valid'],
  ['ES256 PEM', jwt('ES256', (d) => sign('sha256', d, { key: ec['P-256'].privateKey, dsaEncoding: 'ieee-p1363' })), pem(ec['P-256']), false, 'valid'],
  ['ES384 JWK', jwt('ES384', (d) => sign('sha384', d, { key: ec['P-384'].privateKey, dsaEncoding: 'ieee-p1363' })), JSON.stringify(jwk(ec['P-384'])), false, 'valid'],
  ['ES512 PEM', jwt('ES512', (d) => sign('sha512', d, { key: ec['P-521'].privateKey, dsaEncoding: 'ieee-p1363' })), pem(ec['P-521']), false, 'valid'],
  ['EdDSA PEM', jwt('EdDSA', (d) => sign(null, d, ed.privateKey)), pem(ed), false, 'valid'],
  ['JWKS by kid', jwt('RS256', (d) => sign('sha256', d, rsa.privateKey), { kid: 'b' }), JSON.stringify({ keys: [{ ...jwk(otherRsa), kid: 'a' }, { ...jwk(rsa), kid: 'b' }] }), false, 'valid'],
  ['wrong secret', jwt('HS256', (d) => createHmac('sha256', secret).update(d).digest()), 'not-the-secret', false, 'invalid'],
  ['wrong RSA key', jwt('RS256', (d) => sign('sha256', d, rsa.privateKey)), pem(otherRsa), false, 'invalid'],
  ['tampered payload', (() => { const [h, , sig] = jwt('RS256', (d) => sign('sha256', d, rsa.privateKey)).split('.'); return `${h}.${b64url(JSON.stringify({ sub: 'admin' }))}.${sig}`; })(), pem(rsa), false, 'invalid'],
  ['alg none', `${b64url(JSON.stringify({ alg: 'none' }))}.${b64url(JSON.stringify({ sub: 'x' }))}.`, secret, false, 'invalid'],
  ['algorithm confusion', jwt('HS256', (d) => createHmac('sha256', pem(rsa)).update(d).digest()), pem(rsa), false, 'error']
];

// A QR code drawn from the vendored generator, for the camera test.
const qrSandbox = {};
vm.runInNewContext(readFileSync(new URL('../assets/js/vendor/qrcode-generator.js', import.meta.url), 'utf8'), qrSandbox);
const qrCode = qrSandbox.qrcode(0, 'M');
qrCode.addData('https://example.com/from-the-camera');
qrCode.make();
const QR_MODULES = Array.from({ length: qrCode.getModuleCount() }, (_, row) => Array.from({ length: qrCode.getModuleCount() }, (_, col) => qrCode.isDark(row, col) ? 1 : 0));

const failures = [];
let checked = 0;

await withFirefox(async (page) => {
  await page.viewport(1280, 900);

  // Each body runs in the page and returns [description, actual, expected] triples.
  async function check(slug, body) {
    await page.navigate(`/tools/${slug}.html`);
    const results = await page.evaluate(async (source) => {
      const $ = (selector) => document.querySelector(selector);
      const wait = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const set = (selector, value, event = 'input') => {
        const element = $(selector);
        if (element.type === 'checkbox' || element.type === 'radio') element.checked = value;
        else element.value = value;
        // Browsers fire both input and change for selects and checkboxes.
        element.dispatchEvent(new Event('input', { bubbles: true }));
        if (event === 'change') element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const click = (selector) => $(selector).click();
      const text = (selector) => $(selector).textContent.replace(/\s+/g, ' ').trim();
      const value = (selector) => $(selector).value;
      window.showToast = () => {};
      try {
        return await (new Function('$', 'wait', 'set', 'click', 'text', 'value', `return (async () => { ${source} })();`))($, wait, set, click, text, value);
      } catch (error) {
        return [['page script', `threw ${error.message}`, 'no error']];
      }
    }, body);
    for (const [description, actual, expected] of results) {
      checked += 1;
      const pass = expected && typeof expected === 'object' && Object.hasOwn(expected, 'includes')
        ? String(actual).includes(expected.includes)
        : JSON.stringify(actual) === JSON.stringify(expected);
      if (!pass) failures.push(`${slug}: ${description}\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);
    }
  }

  await check('rot13', `
    set('#rot13Input', 'Hello, World! İ 123');
    click('#rot13ApplyBtn');
    const once = value('#rot13Output');
    set('#rot13Input', once); click('#rot13ApplyBtn');
    return [['ROT13', once, 'Uryyb, Jbeyq! İ 123'], ['round trip', value('#rot13Output'), 'Hello, World! İ 123']];`);

  await check('hash', `
    set('#hashInput', 'abc'); click('#hashGenBtn'); await wait(300);
    const all = text('#hashResults');
    return [
      ['SHA-1 abc', all, { includes: 'a9993e364706816aba3e25717850c26c9cd0d89d' }],
      ['SHA-256 abc', all, { includes: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' }],
      ['SHA-512 abc', all, { includes: 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f' }]
    ];`);

  await check('url-codec', `
    set('#urlInput', 'a b&c=ç/ü?#'); click('#urlEncodeBtn');
    const encoded = value('#urlOutput');
    set('#urlInput', '%E2%82%AC%20x'); click('#urlDecodeBtn');
    return [['encode', encoded, 'a%20b%26c%3D%C3%A7%2F%C3%BC%3F%23'], ['decode', value('#urlOutput'), '€ x']];`);

  await check('temperature', `
    set('#tempC', '100'); await wait(50);
    const boil = [value('#tempF'), value('#tempK'), value('#tempRa'), value('#tempRe')].map(Number);
    set('#tempF', '-40'); await wait(50);
    return [['100 °C → F, K, Ra, Ré', boil, [212, 373.15, 671.67, 80]], ['-40 °F → °C', Number(value('#tempC')), -40]];`);

  await check('percentage', `
    set('#m1x', '15'); set('#m1y', '200');
    set('#m2x', '50'); set('#m2y', '75');
    set('#m3x', '30'); set('#m3y', '120');
    await wait(50);
    return [['15% of 200', text('#m1res'), '30'], ['50 is ?% of 75', text('#m2res'), { includes: '66.6666' }], ['30 → 120 change', text('#m3res'), '+300%']];`);

  await check('aspect-ratio', `
    set('#arW', '1920'); set('#arH', '1080'); await wait(50);
    const ratio = text('#arRatioOut');
    set('#arOrigW', '1920'); set('#arOrigH', '1080'); set('#arKnownSide', 'W', 'change'); set('#arKnownVal', '1280'); await wait(50);
    return [['1920×1080 ratio', ratio, { includes: '16 : 9' }], ['resize width 1280', Number(value('#arOtherVal')), 720]];`);

  await check('color-converter', `
    set('#colorHex', '#ff8000'); await wait(50);
    return [['hex → rgb', value('#colorRGB').replace(/\\s/g, ''), 'rgb(255,128,0)'], ['hex → hsl', value('#colorHSL').replace(/\\s/g, ''), 'hsl(30,100%,50%)']];`);

  await check('csv-to-json', `
    set('#csv2j-input', 'name,city\\n"Doe, Jane",İzmir\\n"Say ""hi""",Ankara');
    click('#csv2j-btn');
    return [['quoted CSV', JSON.parse(value('#csv2j-output')), [{ name: 'Doe, Jane', city: 'İzmir' }, { name: 'Say "hi"', city: 'Ankara' }]]];`);

  await check('find-replace', `
    set('#fr-input', 'Cat cat CAT'); set('#fr-find', 'cat'); set('#fr-replace', 'dog');
    set('#fr-case', false, 'change'); set('#fr-regex', false, 'change'); set('#fr-global', true, 'change');
    click('#fr-replace-btn');
    const insensitive = value('#fr-output');
    set('#fr-case', true, 'change'); click('#fr-replace-btn');
    const sensitive = value('#fr-output');
    set('#fr-input', 'a.b.c'); set('#fr-find', '.'); set('#fr-replace', '-'); set('#fr-case', false, 'change');
    click('#fr-replace-btn');
    const literalDot = value('#fr-output');
    set('#fr-regex', true, 'change'); set('#fr-input', '2024-01-05'); set('#fr-find', '(\\\\d+)-(\\\\d+)-(\\\\d+)'); set('#fr-replace', '$3/$2/$1');
    click('#fr-replace-btn');
    return [['case-insensitive', insensitive, 'dog dog dog'], ['case-sensitive', sensitive, 'Cat dog CAT'], ['literal dot', literalDot, 'a-b-c'], ['regex groups', value('#fr-output'), '05/01/2024']];`);

  await check('json-formatter', `
    set('#jsonInput', '{"b":[1,2],"a":"ç"}'); click('#jsonBeautifyBtn');
    const pretty = value('#jsonOutput');
    click('#jsonMinifyBtn');
    const minified = value('#jsonOutput');
    const falsy = [];
    for (const raw of ['0', 'false', 'null', '""']) { set('#jsonInput', raw); click('#jsonBeautifyBtn'); falsy.push(value('#jsonOutput')); }
    set('#jsonInput', '{"a":[1,{"b":null}],"e":{},"s":"x"}');
    set('#jsonIndent', '4', 'change'); click('#jsonBeautifyBtn');
    const four = value('#jsonOutput').split('\\n')[1];
    set('#jsonIndent', 'tab', 'change');
    const tab = value('#jsonOutput').split('\\n')[1];
    set('input[name="jsonView"][value="tree"]', true, 'change'); await wait(20);
    const tree = { textHidden: $('#jsonOutput').hidden, open: document.querySelectorAll('#jsonTree details[open]').length, text: $('#jsonTree').innerText.replace(/\\s+/g, ' ').trim() };
    click('#jsonExpandBtn');
    const expanded = document.querySelectorAll('#jsonTree details[open]').length + '/' + document.querySelectorAll('#jsonTree details').length;
    set('#jsonInput', JSON.stringify(Array.from({ length: 450 }, (_, index) => index))); click('#jsonBeautifyBtn');
    const firstBatch = document.querySelectorAll('#jsonTree .json-children > .json-row').length;
    click('.json-more'); click('.json-more');
    const allRows = document.querySelectorAll('#jsonTree .json-children > .json-row').length;
    return [['beautify', pretty, '{\\n  "b": [\\n    1,\\n    2\\n  ],\\n  "a": "ç"\\n}'], ['minify', minified, '{"b":[1,2],"a":"ç"}'],
      ['0, false, null and "" are valid JSON', falsy, ['0', 'false', 'null', '""']],
      ['4-space indent', four, '    "a": ['], ['tab indent re-formats at once', tab, '\\t"a": ['],
      ['tree view', tree, { textHidden: true, open: 2, text: '{3 keys "a": [2 items 0: 1, 1: {…}1 key ], "e": {}, "s": "x" }' }],
      ['expand all', expanded, '3/3'],
      ['450 items drawn 200 at a time', [firstBatch, allRows, $('.json-more')], [200, 450, null]]];`);

  await check('json-minifier', `
    set('#jmin-input', '{ "a" : [ 1 , 2 ] ,\\n "s": " x  y " }'); click('#jmin-btn');
    return [['minify keeps string spaces', value('#jmin-output'), '{"a":[1,2],"s":" x  y "}']];`);

  await check('json-sorter', `
    set('#jsort-input', '{"b":1,"a":{"d":1,"c":2}}'); set('#jsort-dir', false, 'change'); click('#jsort-btn');
    return [['sorted keys (nested)', JSON.stringify(JSON.parse(value('#jsort-output'))), '{"a":{"c":2,"d":1},"b":1}']];`);

  await check('json-validator', `
    set('#jval-input', '{"a":1}'); click('#jval-btn'); await wait(50);
    const good = text('#jval-badge');
    set('#jval-input', '{"a":1,}'); click('#jval-btn'); await wait(50);
    return [['valid badge', good.toLowerCase(), { includes: 'valid' }], ['invalid badge', text('#jval-badge').toLowerCase(), { includes: 'invalid' }]];`);

  await check('text-diff', `
    const line = (node) => node.className.replace(/^diff-line diff-line--/, '') + ':' + [...node.children].map((part) => part.textContent).join(' ').replace(/\\s+/g, ' ').trim();
    const rows = (selector) => [...document.querySelectorAll(selector)].map(line);
    set('#diffA', 'Pack the map\\nBring tea\\nMeet at nine\\nsame end');
    set('#diffB', 'Pack the map\\nBring warm tea\\nMeet at ten\\nextra\\nsame end');
    click('#diffCompareBtn'); await wait(30);
    const summary = text('#diffSummary');
    const unified = rows('#diffOutput > .diff-line');
    const marks = [...document.querySelectorAll('.diff-word')].map((node) => node.textContent);
    set('input[name="diffView"][value="split"]', true, 'change'); await wait(30);
    const split = [...document.querySelectorAll('.diff-row')].map((row) => [...row.children].map(line).join(' | '));
    set('input[name="diffView"][value="unified"]', true, 'change');
    set('#diffA', 'Hello   World\\nkeep'); set('#diffB', 'hello world\\nkeep'); click('#diffCompareBtn'); await wait(30);
    const strict = text('#diffSummary');
    set('#diffIgnoreSpace', true, 'change'); await wait(30);
    const spaceOnly = text('#diffSummary');
    set('#diffIgnoreCase', true, 'change'); await wait(30);
    const both = text('#diffSummary');
    // 3000 lines with a change in the middle: the common start and end are set aside.
    const long = Array.from({ length: 3000 }, (_, index) => 'line ' + index);
    const edited = long.slice(); edited[1500] = 'changed';
    set('#diffIgnoreSpace', false, 'change'); set('#diffIgnoreCase', false, 'change');
    set('#diffA', long.join('\\n')); set('#diffB', edited.join('\\n')); click('#diffCompareBtn'); await wait(30);
    return [
      ['summary', summary, '+ 3 additions − 2 deletions ≡ 2 unchanged'],
      ['unified rows with old and new line numbers', unified, ['same:1 1 Pack the map', 'del:2 − Bring tea', 'del:3 − Meet at nine', 'add:2 + Bring warm tea', 'add:3 + Meet at ten', 'add:4 + extra', 'same:4 5 same end']],
      ['changed words marked', marks, ['nine', 'warm', 'ten']],
      ['side by side pairs', split, ['same:1 Pack the map | same:1 Pack the map', 'del:2 − Bring tea | add:2 + Bring warm tea', 'del:3 − Meet at nine | add:3 + Meet at ten', 'empty: | add:4 + extra', 'same:4 same end | same:5 same end']],
      ['case and spaces differ', strict, '+ 1 addition − 1 deletion ≡ 1 unchanged'],
      ['ignoring whitespace only', spaceOnly, '+ 1 addition − 1 deletion ≡ 1 unchanged'],
      ['ignoring whitespace and case', both, '✓ No differences with the chosen options.'],
      ['3000-line file', text('#diffSummary'), '+ 1 addition − 1 deletion ≡ 2999 unchanged']
    ];`);

  await check('regex-tester', `
    set('#regexTest', 'Date: 2024-01-05, 2025-12-31');
    set('#regexPattern', '(?<y>\\\\d{4})-(\\\\d{2})-(\\\\d{2})'); set('#regexFlags', 'g'); set('#regexReplace', '$3/$2/$<y> [$&]');
    const all = [value('#regexResult'), text('#regexReplaceCount'), text('#regexStats')];
    set('#regexFlags', '');
    const first = [value('#regexResult'), text('#regexReplaceCount')];
    set('#regexFlags', 'gi'); set('#regexReplace', '');
    const removed = value('#regexResult');
    set('#regexPattern', '(');
    const invalid = [$('#regexError').hidden, value('#regexResult')];
    return [
      ['replace every match with groups', all, ['Date: 05/01/2024 [2024-01-05], 31/12/2025 [2025-12-31]', '2 replacement(s) made', '2 matches']],
      ['without g only the first', first, ['Date: 05/01/2024 [2024-01-05], 2025-12-31', '1 replacement(s) made']],
      ['empty replacement removes', removed, 'Date: , '],
      ['invalid pattern clears the result', invalid, [false, '']]
    ];`);

  await check('markdown', `
    const files = [];
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => { files.push(blob); return 'blob:test'; };
    const anchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { files.push(this.download); };
    set('#mdInput', '# Işık & Çay <b>x</b>\\n\\nSome **bold** [site](https://example.com).');
    click('#mdHtmlBtn');
    const page = await files[0].text();
    set('#mdInput', '');
    click('#mdHtmlBtn');
    URL.createObjectURL = createObjectURL;
    HTMLAnchorElement.prototype.click = anchorClick;
    return [
      ['file name from the first heading', files[1], 'isik-cay-b-x-b.html'],
      ['HTML type', files[0].type, 'text/html;charset=utf-8'],
      ['standalone page', page.startsWith('<!DOCTYPE html>') && page.includes('<meta charset="utf-8" />') && !page.includes('<script'), true],
      ['escaped title', page.match(/<title>(.*)<\\/title>/)[1], 'Işık &amp; Çay &lt;b&gt;x&lt;/b&gt;'],
      ['body is the preview', page.includes('<p>Some <strong>bold</strong> <a href="https://example.com"'), true],
      ['nothing to download when empty', files.length, 2]
    ];`);

  await check('json-diff', `
    set('#jdiff-a', '{"a":1,"b":2,"c":{"d":1}}'); set('#jdiff-b', '{"a":1,"b":3,"c":{"d":1,"e":2}}'); click('#jdiff-btn'); await wait(50);
    const out = text('#jdiff-results');
    set('#jdiff-b', '{"a":1,"b":2,"c":{"d":1}}'); click('#jdiff-btn'); await wait(50);
    return [['2 differences', out, { includes: '2 differences' }], ['changed path', out, { includes: 'b' }], ['added path', out, { includes: 'c.e' }], ['identical', text('#jdiff-results'), { includes: 'identical' }]];`);

  await check('jwt-decoder', `
    // {"alg":"HS256","typ":"JWT"} . {"sub":"1234567890","name":"John Doe","iat":1516239022}
    set('#jwtInput', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
    click('#jwtDecodeBtn'); await wait(50);
    const out = text('#jwtResults');
    return [['header alg', out, { includes: 'HS256' }], ['payload name', out, { includes: 'John Doe' }], ['payload sub', out, { includes: '1234567890' }]];`);

  await check('line-numbers', `
    set('#ln-input', 'a\\nb\\nc'); set('#ln-start', '9'); set('#ln-sep', '. '); click('#ln-apply-btn');
    return [['numbering from 9', value('#ln-output'), '9. a\\n10. b\\n11. c']];`);

  await check('text-sorter', `
    set('#ts-input', 'banana\\nApple\\ncherry\\n10\\n9'); click('#ts-sort-btn');
    return [['default sort keeps every line', value('#ts-output').split('\\n').sort(), ['10', '9', 'Apple', 'banana', 'cherry'].sort()]];`);

  await check('text-cleaner', `
    set('#tc-trim', true, 'change'); set('#tc-blank', true, 'change'); set('#tc-spaces', true, 'change'); set('#tc-special', false, 'change');
    set('#tc-input', '  a   b  \\n\\n\\n  ç  \\n'); click('#tc-clean-btn');
    return [['trim, blank lines, spaces', value('#tc-output').trim(), 'a b\\nç']];`);

  await check('sql-formatter', `
    set('#sql-input', "select id, name from users where name = 'select from' and age > 3 order by id"); set('#sql-upper', true, 'change'); click('#sql-btn');
    const out = value('#sql-output');
    return [['keywords upper-cased', out, { includes: 'SELECT' }], ['WHERE on its own line', /\\nWHERE /.test(out), true], ['string literal untouched', out, { includes: "'select from'" }]];`);

  await check('xml-formatter', `
    set('#xml-input', '<a><b x="1">t</b><c/></a>'); click('#xml-format-btn');
    const pretty = value('#xml-output');
    click('#xml-minify-btn');
    const minified = value('#xml-output').trim();
    set('#xml-input', '<a><!-- x > y --><![CDATA[1 > 0]]><b>t</b></a>'); click('#xml-format-btn');
    return [['format', pretty.trim(), '<a>\\n  <b x="1">t</b>\\n  <c/>\\n</a>'], ['minify', minified, '<a><b x="1">t</b><c/></a>'],
      ['comment and CDATA with >', value('#xml-output').trim(), '<a>\\n  <!-- x > y -->\\n  <![CDATA[1 > 0]]>\\n  <b>t</b>\\n</a>']];`);

  await check('url-parser', `
    set('#urlInput', 'https://user:pw@example.com:8080/p/a%20b?x=1&y=%C3%A7#frag'); click('#parseBtn'); await wait(50);
    const result = text('#urlResult'); const params = text('#urlParams');
    return [['host', result, { includes: 'example.com' }], ['port', result, { includes: '8080' }], ['hash', result, { includes: '#frag' }], ['decoded param', params, { includes: 'ç' }]];`);

  await check('url-builder', `
    set('#ubBase', 'https://example.com'); click('#ubAddPath'); click('#ubAddParam'); await wait(20);
    const path = document.querySelector('#ubPathRows input'); path.value = 'a b'; path.dispatchEvent(new Event('input', { bubbles: true }));
    const [key, val] = document.querySelectorAll('#ubParamRows input'); key.value = 'q'; key.dispatchEvent(new Event('input', { bubbles: true }));
    val.value = 'ç&x'; val.dispatchEvent(new Event('input', { bubbles: true }));
    set('#ubHash', 'top'); await wait(20);
    const assembled = value('#ubOutput');
    path.value = 'docs/a%20b/c?d'; path.dispatchEvent(new Event('input', { bubbles: true }));
    return [['assembled URL', assembled, 'https://example.com/a%20b?q=%C3%A7%26x#top'], ['nested, pre-encoded and ? in path', value('#ubOutput'), 'https://example.com/docs/a%20b/c%3Fd?q=%C3%A7%26x#top']];`);

  await check('unit-converter', `
    set('#baseFontSize', '16'); set('#viewportWidth', '1000'); set('#viewportHeight', '800');
    set('#fromUnit', 'px', 'change'); set('#toUnit', 'rem', 'change'); set('#inputValue', '24'); await wait(50);
    const rem = text('#convResult');
    set('#toUnit', 'vw', 'change'); await wait(50);
    return [['24px → rem', rem, { includes: '1.5' }], ['24px → vw', text('#convResult'), { includes: '2.4' }]];`);

  await check('uuid-validator', `
    document.querySelector('#uuidInput').value = '123e4567-e89b-42d3-a456-426614174000\\nnot-a-uuid\\n00000000-0000-0000-0000-000000000000\\n018f3e5c-7b2a-7c3d-9e4f-0123456789ab\\n123e4567-e89b-42d3-c456-426614174000';
    click('#validateBtn'); await wait(50);
    const list = text('#uuidResultList');
    return [['summary', text('#uuidSummary'), '3 valid / 2 invalid'], ['v4', list, { includes: 'v4 — Random · RFC 9562 variant' }], ['v7', list, { includes: 'v7 — Unix time-ordered' }], ['nil', list, { includes: 'Nil UUID' }]];`);

  await check('mime-lookup', `
    set('#mime-mode-ext', true, 'change'); set('#mime-input', '.SVG'); click('#mime-btn');
    const ext = text('#mime-result');
    set('#mime-mode-mime', true, 'change'); set('#mime-input', 'application/json'); click('#mime-btn');
    return [['.svg', ext, { includes: 'image/svg+xml' }], ['application/json', text('#mime-result'), { includes: '.json' }]];`);

  await check('user-agent', `
    set('#uaInput', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0'); click('#uaParseBtn'); await wait(50);
    const out = text('#uaResult');
    return [['browser', out, { includes: 'Firefox 128' }], ['OS', out, { includes: 'Windows' }], ['engine', out, { includes: 'Gecko' }]];`);

  await check('timestamp', `
    set('#tsUnixInput', '1700000000'); click('#tsSecBtn'); click('#tsToDateBtn'); await wait(50);
    return [['ISO 8601', text('#tsUnixResult'), { includes: '2023-11-14T22:13:20.000Z' }]];`);

  await check('ascii', `
    document.querySelector('#asciiInput').value = 'Aç😀'; click('#asciiConvertBtn'); await wait(50);
    const table = text('#asciiTableWrap');
    return [['A = 65', table, { includes: '65' }], ['ç = 231', table, { includes: '231' }], ['emoji = 128512 (one row)', table, { includes: '128512' }], ['three rows', document.querySelectorAll('#asciiTableBody tr').length, 3]];`);

  await check('http-status', `
    set('#http-search', '404'); await wait(50);
    return [['404', text('#http-grid'), { includes: 'Not Found' }], ['only one match', document.querySelectorAll('#http-grid .http-card').length, 1]];`);

  await check('robots-generator', `
    click('#rgBlockAll'); set('#rgSitemap', 'https://example.com/sitemap.xml'); await wait(50);
    const out = value('#rgOutput');
    return [['disallow all', out, { includes: 'Disallow: /' }], ['sitemap line', out, { includes: 'Sitemap: https://example.com/sitemap.xml' }]];`);

  await check('password-strength', `
    set('#psInput', 'password'); await wait(50);
    const weak = text('#psLabel');
    set('#psInput', 'k7#Qz!v9Lr$2Wm@x'); await wait(50);
    return [['common password is weakest', weak.toLowerCase(), { includes: 'weak' }], ['long mixed password is strong', text('#psLabel').toLowerCase(), { includes: 'strong' }]];`);

  await check('svg-optimizer', `
    set('#svgRmComments', true, 'change'); set('#svgRmMeta', true, 'change');
    set('#svgInput', '<?xml version="1.0"?><!-- note --><svg xmlns="http://www.w3.org/2000/svg"><metadata>x</metadata><rect width="1" height="1"/></svg>');
    click('#svgOptimizeBtn'); await wait(50);
    const out = value('#svgOutput');
    return [['comment removed', out.includes('note'), false], ['metadata removed', out.includes('metadata'), false], ['shape kept', out, { includes: '<rect' }]];`);

  // bcryptjs 3.0.3 (vendored): OpenBSD/jBCrypt vectors under every prefix a
  // hash may carry, the $2b$ default, and the 72-byte note.
  await check('bcrypt', `
    const vectors = [
      ['abc', '$2a$06$If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i'],
      ['abcdefghijklmnopqrstuvwxyz', '$2a$06$.rCVZVOThsIa97pEDOxvGuRRgzG64bvtJ0938xuqzv18d3ZpQhstC'],
      ['~!@#$%^&*()      ~!@#$%^&*()PNBFRD', '$2a$06$fPIsBO8qRqkjj273rfaOI.HtSV9jLDpTbZn782DC6/t7qT67P6FfO']
    ];
    const verify = async (password, hash) => {
      set('#bcryptVerifyPw', password); set('#bcryptVerifyHash', hash);
      click('#bcryptVerifyBtn');
      for (let i = 0; i < 100 && $('#bcryptVerifyBtn').disabled; i += 1) await wait(20);
      await wait(20);
      return text('#bcryptVerifyResult');
    };
    const results = [];
    for (const [password, hash] of vectors) {
      for (const prefix of ['$2a$', '$2b$', '$2y$']) {
        results.push([prefix + ' ' + password.slice(0, 12) + ' matches', await verify(password, prefix + hash.slice(4)), { includes: 'Password matches' }]);
      }
      results.push(['wrong password for ' + password.slice(0, 12), await verify(password + '!', hash), { includes: 'does not match' }]);
    }
    set('#bcryptInput', 'Toolkit test'); set('#bcryptCost', '4');
    click('#bcryptGenBtn');
    for (let i = 0; i < 100 && !value('#bcryptOutput'); i += 1) await wait(20);
    const fresh = value('#bcryptOutput');
    results.push(['new hashes use $2b$', fresh.slice(0, 7), '$2b$04$']);
    results.push(['a new hash verifies', await verify('Toolkit test', fresh), { includes: 'Password matches' }]);
    set('#bcryptInput', 'ğ'.repeat(36));
    results.push(['72 bytes exactly: no note', $('#bcryptLengthNote').hidden, true]);
    set('#bcryptInput', 'ğ'.repeat(36) + 'a');
    results.push(['73 bytes: the note shows', $('#bcryptLengthNote').hidden, false]);
    set('#bcryptVerifyPw', 'x'.repeat(73));
    results.push(['the verify field warns too', $('#bcryptVerifyLengthNote').hidden, false]);
    return results;`);

  // MD5 (md5.js) in the Hash Generator: RFC 1321 vectors.
  await check('hash', `
    const md5 = async (input) => { set('#hashInput', input); click('#hashGenBtn'); await wait(150);
      const card = [...document.querySelectorAll('.hash-card')].find((node) => node.querySelector('.hash-algo-badge').textContent === 'MD5');
      return card ? card.querySelector('.hash-value').textContent : 'no MD5 card'; };
    return [
      ['md5("abc")', await md5('abc'), '900150983cd24fb0d6963f7d28e17f72'],
      ['md5("message digest")', await md5('message digest'), 'f96b697d7cb7938d525a2f31aaf161d0'],
      ['md5(UTF-8)', await md5('çay'), ${JSON.stringify(createHash('md5').update('çay').digest('hex'))}],
      ['MD5 is marked legacy', !!document.querySelector('.hash-legacy-note[title^="MD5"]'), true]];`);

  await check('file-checksum', `
    document.getElementById('algoMD5').checked = true;
    const transfer = new DataTransfer();
    transfer.items.add(new File(['The quick brown fox jumps over the lazy dog'], 'fox.txt'));
    const input = document.getElementById('checksumFileInput');
    input.files = transfer.files; input.dispatchEvent(new Event('change'));
    await wait(400);
    return [['file MD5', document.querySelector('main').innerText.includes('9e107d9d372bb6826bd81d3542a419d6'), true]];`);

  await check('uuid', `
    set('#uuidVersion', '7', 'change'); set('#uuidCount', '20');
    click('#uuidGenBtn'); await wait(150);
    const values = [...document.querySelectorAll('.uuid-value')].map((node) => node.textContent.trim());
    const times = values.map((uuid) => parseInt(uuid.replace(/-/g, '').slice(0, 12), 16));
    return [['20 v7 UUIDs', values.length, 20],
      ['all RFC 9562 v7', values.every((uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)), true],
      ['in ascending order', values.every((uuid, index) => index === 0 || uuid > values[index - 1]), true],
      ['unique', new Set(values).size, 20],
      ['timestamp is now', times.every((ms) => Math.abs(ms - Date.now()) < 60000), true]];`);

  await check('uuid-validator', `
    set('#uuidInput', '017F22E2-79B0-7CC3-98C4-DC0C0C07398F'); click('#validateBtn'); await wait(50);
    return [['RFC 9562 v7 example dated', document.querySelector('main').innerText, { includes: 'Created 2022-02-22 19:22:22 UTC' }]];`);

  await check('color-converter', `
    const convert = (hex) => { set('#colorHex', hex); return [value('#colorOKLCH'), value('#colorHWB')]; };
    const [redL, redH] = convert('#ff0000'); const [indigoL, indigoH] = convert('#6366f1'); const [greyL] = convert('#808080');
    return [['red OKLCH (CSS Color 4)', redL, 'oklch(62.8% 0.258 29.2)'], ['red HWB', redH, 'hwb(0 0% 0%)'],
      ['#6366f1 OKLCH', indigoL, 'oklch(58.5% 0.204 277.1)'], ['#6366f1 HWB', indigoH, 'hwb(239 39% 5%)'], ['grey has no chroma', greyL, 'oklch(60% 0 0)']];`);

  await check('password', `
    document.getElementById('pwdModeWords').click(); await wait(400);
    set('#pwdSeparator', '-', 'change'); set('#pwdWordLanguage', 'en', 'change'); await wait(300);
    const words = document.getElementById('pwdOutput').textContent.split('-');
    const label = text('#strengthLabel');
    document.getElementById('pwdCapitalize').click(); document.getElementById('pwdAddNumber').click(); await wait(300);
    const fancy = document.getElementById('pwdOutput').textContent.split('-');
    set('#pwdWordLanguage', 'tr', 'change'); await wait(400);
    const turkish = document.getElementById('pwdOutput').textContent;
    return [['six words by default', words.length, 6], ['3–10 lower-case letters each', words.every((word) => /^[a-z]{3,10}$/.test(word)), true],
      ['bits shown', label, { includes: 'bits' }],
      ['capitalized', fancy.every((word) => /^[A-Z]/.test(word)), true], ['one digit added', fancy.join('').replace(/[^0-9]/g, '').length, 1],
      ['Turkish word list', /^(\\p{Lu}\\p{Ll}{2,9}\\d?-){5}\\p{Lu}\\p{Ll}{2,9}\\d?$/u.test(turkish), true]];`);

  // JWT signatures, checked against tokens Node signed above.
  for (const [name, token, key, base64, verdict] of JWT_CASES) {
    await check('jwt-decoder', `
      set('#jwtInput', ${JSON.stringify(token)}); set('#jwtKey', ${JSON.stringify(key)});
      document.getElementById('jwtKeyBase64').checked = ${base64};
      click('#jwtDecodeBtn'); click('#jwtVerifyBtn');
      for (let i = 0; i < 100 && $('#jwtVerifyResult').hidden; i += 1) await wait(20);
      await wait(50);
      return [[${JSON.stringify(`JWT ${name}`)}, $('#jwtVerifyResult').className.replace('jwt-verify__result jwt-verify__result--', ''), ${JSON.stringify(verdict)}],
        [${JSON.stringify(`JWT ${name} decodes UTF-8 claims`)}, text('#jwtResults').includes('Çağrı Öz'), ${Buffer.from(token.split('.')[1], 'base64url').toString('utf8').includes('Çağrı Öz')}]];`);
  }

  // The QR reader's camera: a canvas stream showing a QR code stands in for it.
  await check('qr-reader', `
    const modules = ${JSON.stringify(QR_MODULES)};
    const size = 8, quiet = 4, canvas = document.createElement('canvas');
    canvas.width = canvas.height = (modules.length + quiet * 2) * size;
    const ctx = canvas.getContext('2d');
    const draw = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
      modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) ctx.fillRect((x + quiet) * size, (y + quiet) * size, size, size); })); };
    draw(); const keepDrawing = setInterval(draw, 100);
    const stream = canvas.captureStream(10);
    navigator.mediaDevices.getUserMedia = async () => stream;
    click('#qrCameraBtn');
    for (let i = 0; i < 100 && !document.querySelector('.qr-read-text'); i += 1) await wait(50);
    clearInterval(keepDrawing);
    return [['camera reads the code', document.querySelector('.qr-read-text')?.textContent, 'https://example.com/from-the-camera'],
      ['camera stops after reading', stream.getTracks().every((track) => track.readyState === 'ended'), true],
      ['preview hidden again', $('#qrCamera').hidden, true]];`);

  // Generators: verify invariants rather than exact values.
  await check('uuid', `
    const button = [...document.querySelectorAll('main button')].find((node) => /generate/i.test(node.textContent));
    button.click(); await wait(100);
    const values = [...document.querySelectorAll('.uuid-value')].map((node) => node.textContent.trim());
    return [['generated', values.length > 0, true], ['all RFC 4122 v4', values.every((uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)), true], ['unique', new Set(values).size, values.length]];`);
});

if (failures.length) console.log(`\n${failures.length} known-answer failure(s):\n  ${failures.join('\n  ')}`);
assert.equal(failures.length, 0, 'Tool output did not match the known answers above.');
console.log(`Tool vectors passed: ${checked} known-answer checks across 44 tools.`);
