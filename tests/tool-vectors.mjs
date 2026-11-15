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
// A 64×48 JPEG with EXIF (camera, exposure, GPS, orientation 6) and a comment, made with Pillow.
const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/4QG0RXhpZgAATU0AKgAAAAgACAEPAAIAAAAGAAAAbgEQAAIAAAAHAAAAdAESAAMAAAABAAYAAAExAAIAAAANAAAAfAE7AAIAAAAFAAAAioKYAAIAAAAHAAAAkIdpAAQAAAABAAAAmIglAAQAAAABAAABJgAAAABDYW5vbgBFT1MgUjYAAFRvb2xraXQgdGVzdAAAQXk/ZQAAPyAyMDI2AAAAB4KaAAUAAAABAAAA8oKdAAUAAAABAAAA+ognAAMAAAABAZAAAJADAAIAAAAUAAABApIJAAMAAAABAAEAAJIKAAUAAAABAAABFqQ0AAIAAAAIAAABHgAAAAAAAAABAAAA+gAAAA4AAAAFMjAyNjoxMToxNCAxMDoyMDozMAAAAAAyAAAAAVJGIDUwbW0AAAYAAQACAAAAAk4AAAAAAgAFAAAAAwAAAXQAAwACAAAAAkUAAAAABAAFAAAAAwAAAYwABQABAAAAAQAAAAAABgAFAAAAAQAAAaQAAAAAAAAAJgAAAAEAAAAZAAAAAQAAAmkAAAAyAAAAGwAAAAEAAAAIAAAAAQAAAB4AAAABAAAAeAAAAAH//gAHaGVsbG//2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAwAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDOooor5s+4CiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//9k=';
let checked = 0;
const toolsChecked = new Set();

await withFirefox(async (page) => {
  await page.viewport(1280, 900);

  // Each body runs in the page and returns [description, actual, expected] triples.
  // VECTORS_ONLY=slug,slug runs just those tools while working on them.
  const only = process.env.VECTORS_ONLY ? new Set(process.env.VECTORS_ONLY.split(',')) : null;
  async function check(slug, body) {
    if (only && !only.has(slug)) return;
    toolsChecked.add(slug);
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

  // 1.8.1: the bugs found by the tool review.
  await check('sql-formatter', `
    set('#sql-input', "select a from t where b = 'it''s  two' -- note\\nand c in (select d from e)"); set('#sql-upper', true, 'change'); click('#sql-btn');
    return [['escaped quote, spaces in a string, comment and subquery kept', value('#sql-output'),
      "SELECT a\\nFROM t\\nWHERE b = 'it''s  two' -- note\\n  AND c IN (\\n    SELECT d\\n    FROM e\\n  )"]];`);

  await check('yaml-to-json', `
    set('#y2j-input', 'services:\\n  web:\\n    image: "nginx:1.25"  # pinned\\n    ports: [80, "443:443"]\\n    command: |\\n      run\\n      serve\\nbase: &b {x: 1}\\nchild:\\n  <<: *b\\n  y: 0o17'); click('#y2j-btn');
    return [['flow lists, block text, anchors, merges', JSON.parse(value('#y2j-output')),
      { services: { web: { image: 'nginx:1.25', ports: [80, '443:443'], command: 'run\\nserve\\n' } }, base: { x: 1 }, child: { x: 1, y: 15 } }]];`);

  await check('base64', `
    set('#b64Input', '8J-Ri0hp'); click('#b64DecodeBtn');
    const urlSafe = value('#b64Output');
    set('#b64Input', 'SGVs\\nbG8'); click('#b64DecodeBtn');
    const wrapped = value('#b64Output');
    set('#b64UrlSafe', true, 'change'); set('#b64Input', '👋Hi??'); click('#b64EncodeBtn');
    return [['URL-safe alphabet', urlSafe, '👋Hi'], ['line breaks and no padding', wrapped, 'Hello'], ['URL-safe output', value('#b64Output'), '8J-Ri0hpPz8']];`);

  await check('number-base', `
    set('#numDec', '255'); set('#numDec', '12.5');
    const stale = [value('#numBin'), value('#numHex'), $('#numError').hidden];
    set('#numHex', '0xFF'); const prefixed = value('#numDec');
    set('#numBin', '1111 0000'); const grouped = value('#numDec');
    return [['invalid input clears the others and explains', stale, ['', '', false]], ['0x prefix', prefixed, '255'], ['grouped binary', grouped, '240'], ['error gone', $('#numError').hidden, true]];`);

  await check('color-converter', `
    const read = (input) => { set('#colorHex', input); return [value('#colorRGB'), $('#colorError').hidden]; };
    return [['8-digit hex keeps alpha', read('#ff000080'), ['rgba(255, 0, 0, 0.502)', true]], ['short hex', read('abc'), ['rgb(170, 187, 204)', true]],
      ['colour name', read('rebeccapurple'), ['rgb(102, 51, 153)', true]], ['hsl with alpha', read('hsl(120 100% 25% / 50%)'), ['rgba(0, 128, 0, 0.5)', true]],
      ['unknown colour', read('not a colour')[1], false], ['alpha in OKLCH', (read('#ff000080'), value('#colorOKLCH')), 'oklch(62.8% 0.258 29.2 / 0.502)']];`);

  await check('hex-codec', `
    set('#hexInput', '0x48, 0x69'); click('#hexDecodeBtn');
    const prefixed = value('#hexOutput');
    set('#hexInput', 'zz'); click('#hexDecodeBtn');
    return [['0x and commas', prefixed, 'Hi'], ['an error clears the old result', value('#hexOutput'), '']];`);

  await check('timestamp', `
    set('#tsUnixInput', '1700000000000'); click('#tsSecBtn'); click('#tsToDateBtn'); await wait(30);
    const result = text('#tsUnixResult');
    return [['13 digits read as milliseconds', result, { includes: '2023-11-14T22:13:20.000Z' }], ['and says so', result, { includes: 'Read as milliseconds' }]];`);

  await check('case-converter', `
    const card = (label) => [...document.querySelectorAll('#caseGrid .case-card')].find((node) => node.querySelector('.case-type-label').textContent === label).querySelector('.case-value').textContent;
    set('#caseInput', 'İSTANBUL IŞIK'); await wait(20);
    const turkish = card('lowercase');
    set('#caseInput', 'XMLHttpRequest userID'); await wait(20);
    return [['Turkish text lowers by Turkish rules', turkish, 'istanbul ışık'], ['English text keeps I → i', card('lowercase'), 'xmlhttprequest userid'],
      ['camelCase words are split', card('snake_case'), 'xml_http_request_user_id'], ['CONSTANT_CASE', card('CONSTANT_CASE'), 'XML_HTTP_REQUEST_USER_ID']];`);

  await check('deduplicate-lines', `
    set('#dd-case-insensitive', true, 'change'); set('#dd-input', 'IŞIK\\nışık\\nİstanbul\\nistanbul\\nIstanbul'); click('#dd-dedup-btn');
    return [['Turkish and English case folding', value('#dd-output'), 'IŞIK\\nİstanbul']];`);

  await check('text-sorter', `
    set('#ts-input', 'şeker\\nsu\\nırmak\\nİnci\\nfile10\\nfile2\\nçay\\ncam'); click('#ts-sort-btn');
    return [['Turkish alphabet and natural numbers', value('#ts-output'), 'cam\\nçay\\nfile2\\nfile10\\nırmak\\nİnci\\nsu\\nşeker']];`);

  await check('csv-to-json', `
    set('#csv2j-input', 'ad;yaş;şehir\\nAli;30;"İzmir; Karşıyaka"'); click('#csv2j-btn');
    return [['semicolon CSV is detected', JSON.parse(value('#csv2j-output')), [{ ad: 'Ali', 'yaş': '30', 'şehir': 'İzmir; Karşıyaka' }]]];`);

  await check('password-strength', `
    const rate = (password) => { set('#psInput', password); return [text('#psLabel'), text('#psFeedback')]; };
    const [team, teamHints] = rate('Galatasaray1905'); const [leet, leetHints] = rate('P@ssw0rd!'); const [row] = rate('qwerty123'); const [random] = rate('Xk9#vR2!pLq7$wE4');
    return [['word + year is weak', /weak/i.test(team), true], ['says why', teamHints, { includes: 'common word' }], ['and about the year', teamHints, { includes: 'year' }],
      ['letter swaps do not hide a word', /weak/i.test(leet) && leetHints.includes('common word'), true], ['common password', row, 'Very Weak'], ['random stays strong', random, 'Very Strong']];`);

  await check('favicon-generator', `
    const api = window.ToolkitFavicon;
    const ico = await api.icoFile();
    const view = new DataView(ico.buffer);
    const entries = [0, 1, 2].map((index) => [ico[6 + index * 16], view.getUint32(6 + index * 16 + 12, true)]);
    const pngAt = entries.every(([, offset]) => ico[offset] === 0x89 && ico[offset + 1] === 0x50);
    const manifest = JSON.parse(api.manifest());
    let zip;
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => { zip = blob; return createObjectURL.call(URL, blob); };
    const anchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    click('#fgZip'); await wait(1500);
    URL.createObjectURL = createObjectURL; HTMLAnchorElement.prototype.click = anchorClick;
    const bytes = new Uint8Array(await zip.arrayBuffer()); const names = []; const zipView = new DataView(bytes.buffer);
    for (let at = 0; at + 46 < bytes.length; at += 1) if (zipView.getUint32(at, true) === 0x02014b50) { const length = zipView.getUint16(at + 28, true); names.push(new TextDecoder().decode(bytes.slice(at + 46, at + 46 + length))); }
    // An all-red image fills the icon; a transparent circle leaves the corners empty.
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 600;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 600, 600);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const files = new DataTransfer(); files.items.add(new File([blob], 'red.png', { type: 'image/png' }));
    set('input[name="fgSource"][value="image"]', true, 'change'); $('#fgImage').files = files.files; $('#fgImage').dispatchEvent(new Event('change')); await wait(300);
    set('#fgShape', 'circle', 'change'); set('#fgTransparent', true, 'change'); await wait(50);
    const pixel = (id, x, y) => [...document.getElementById(id).getContext('2d').getImageData(x, y, 1, 1).data];
    return [['ICO holds 16, 32 and 48', entries.map(([size]) => size), [16, 32, 48]], ['ICO images are PNG', pngAt, true],
      ['manifest', [manifest.icons.length, manifest.display, manifest.icons[1].sizes], [2, 'standalone', '512x512']],
      ['ZIP contents', names, ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png', 'site.webmanifest', 'favicon-snippet.html']],
      ['snippet', value('#fgSnippet'), { includes: '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />' }],
      ['image fills the centre', pixel('fgCanvas512', 256, 256), [255, 0, 0, 255]], ['transparent corner', pixel('fgCanvas512', 2, 2)[3], 0],
      ['Apple icon stays opaque', pixel('fgCanvas180', 2, 2)[3], 255]];`);

  await check('url-parser', `
    set('#urlInput', 'https://user:pw@xn--trkiye-3ya.example/a%20b'); click('#parseBtn'); await wait(30);
    const result = text('#urlResult');
    return [['username', result, { includes: 'user' }], ['password', result, { includes: 'pw' }], ['Unicode host', result, { includes: 'türkiye.example' }], ['decoded path', result, { includes: '/a b' }]];`);

  await check('js-minifier', `
    set('#jsmin-input', 'function  add ( a , b ) {\\n  // sum\\n  return a + b ;\\n}\\nconst r = /\\\\/\\\\//g; const t = \`a  \${ b }\`;'); click('#jsmin-btn');
    return [['whitespace and comments go, regex and template stay', value('#jsmin-output'), 'function add(a,b){return a+b;}\\nconst r=/\\\\/\\\\//g;const t=\`a  \${b}\`;']];`);

  await check('css-minifier', `
    set('#cssmin-input', '.a {\\n  color : red ;\\n}\\n:root { --x: 1px; }\\n.b > .c { margin : 0 auto ; }'); click('#cssmin-btn');
    return [['spaces around punctuation go, custom properties do not stop it', value('#cssmin-output'), '.a{color:red}:root{--x:1px}.b>.c{margin:0 auto}']];`);

  await check('html-minifier', `
    set('#hmin-input', '<!DOCTYPE html>\\n<html>\\n  <body>\\n    <p class = "x">a   b</p>\\n  </body>\\n</html>'); click('#hmin-btn');
    return [['doctype no longer stops it', value('#hmin-output'), '<!DOCTYPE html><html><body><p class="x">a b</p></body></html>']];`);

  // 1.8.3: overlapping tools grow their own features.
  await check('json-validator', `
    const schema = JSON.stringify({ type: 'object', required: ['name', 'age'], additionalProperties: false,
      properties: { name: { type: 'string', minLength: 2 }, age: { type: 'integer', minimum: 0 }, tags: { type: 'array', items: { type: 'string' }, uniqueItems: true }, home: { $ref: '#/$defs/home' } },
      $defs: { home: { type: 'object', required: ['city'] } } });
    set('#jval-input', '{"name":"A","age":-1.5,"tags":["x","x"],"home":{},"extra":true}'); set('#jval-schema', schema); click('#jval-btn');
    const problems = [...document.querySelectorAll('#jval-errors li')].map((item) => item.textContent);
    const badge = text('#jval-badge');
    set('#jval-input', '{"name":"Ada","age":36}'); click('#jval-btn');
    return [['schema problems with JSON paths', problems, ['/name Must be at least 2 characters long.', '/age Expected integer, found number.', '/age Must be at least 0.',
        '/tags Item 1 repeats an earlier item.', '/home Missing required property "city".', '/ Property "extra" is not allowed.']],
      ['badge', badge, 'Valid JSON, does not match the schema ✗'], ['matching data', text('#jval-badge'), 'Valid JSON, matches the schema ✓']];`);

  await check('json-minifier', `
    set('#jmin-input', '{\\n  // compiler options\\n  "compilerOptions": { "strict": true, /* on */ "lib": ["es2022",], },\\n  "url": "http://a//b",\\n}'); click('#jmin-btn');
    const jsonc = value('#jmin-output');
    set('#jmin-ascii', true, 'change'); set('#jmin-input', '{"ad":"Çağrı"}'); click('#jmin-btn');
    return [['comments and trailing commas', jsonc, '{"compilerOptions":{"strict":true,"lib":["es2022"]},"url":"http://a//b"}'], ['ASCII escapes', value('#jmin-output'), '{"ad":"\\\\u00c7a\\\\u011fr\\\\u0131"}']];`);

  await check('find-replace', `
    set('#fr-case', false, 'change'); set('#fr-regex', true, 'change'); set('#fr-global', false, 'change');
    set('#fr-input', 'ab ab'); set('#fr-find', '(a)(b)'); set('#fr-replace', '$2$1'); click('#fr-replace-btn');
    const groups = [value('#fr-output'), text('#fr-stats')];
    set('#fr-global', true, 'change'); set('#fr-regex', false, 'change');
    set('#fr-input', 'Merhaba dünya. Merhaba!'); set('#fr-find', 'Merhaba'); set('#fr-replace', 'Selam');
    click('#fr-add-rule'); const second = document.querySelector('.fr-rule--extra');
    second.querySelector('.fr-find').value = 'dünya'; second.querySelector('.fr-replace').value = 'herkes';
    click('#fr-replace-btn');
    return [['groups count once, not three times', groups, ['ba ab', '1 match(es) replaced.']],
      ['two rules in order', value('#fr-output'), 'Selam herkes. Selam!'], ['per-rule counts', text('#fr-stats'), '3 match(es) replaced. (Rule 1: 2, Rule 2: 1)']];`);

  await check('open-graph', `
    set('#ogTitle', 'Toolkit'); set('#ogDesc', 'Tools'); set('#ogUrl', 'https://www.example.com/x'); set('#ogImage', 'http://example.com/a.png');
    set('input[name="ogPlatform"][value="whatsapp"]', true, 'change'); await wait(20);
    const whatsapp = [$('#ogPreview').className, text('#prevUrl')];
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const files = new DataTransfer(); files.items.add(new File([blob], 'card.png', { type: 'image/png' }));
    $('#ogImageFile').files = files.files; $('#ogImageFile').dispatchEvent(new Event('change')); await wait(300);
    const checks = text('#ogChecks');
    return [['WhatsApp card', whatsapp, ['og-card og-card--whatsapp og-card--small', 'example.com']], ['title length', checks, { includes: 'Title: 7 characters' }],
      ['plain HTTP image flagged', checks, { includes: '! Image URL should use HTTPS.' }], ['local image size', checks, { includes: '✓ Chosen image: 1200 × 630 px' }],
      ['remote image never loaded', performance.getEntriesByType('resource').some((entry) => entry.name.includes('example.com')), false]];`);

  await check('image-metadata', `
    const bytes = Uint8Array.from(atob(JPEG_PLACEHOLDER), (c) => c.charCodeAt(0));
    const files = new DataTransfer(); files.items.add(new File([bytes], 'photo.jpg', { type: 'image/jpeg' }));
    $('#imFile').files = files.files; $('#imFile').dispatchEvent(new Event('change')); await wait(400);
    const shown = text('#imMeta');
    const saved = [];
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => { saved.push(blob); return createObjectURL.call(URL, blob); };
    const anchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { saved.push(this.download); };
    click('#imStrip'); await wait(50);
    URL.createObjectURL = createObjectURL; HTMLAnchorElement.prototype.click = anchorClick;
    const blob = saved.find((item) => item instanceof Blob);
    const clean = window.ToolkitImageMetadata.inspect(new Uint8Array(await blob.arrayBuffer()));
    return [['camera', shown, { includes: 'EOS R6' }], ['exposure', shown, { includes: '1/250 s' }], ['aperture', shown, { includes: 'f/2.8' }],
      ['GPS in decimal', shown, { includes: '38.420094' }], ['location warning', shown, { includes: 'says where it was taken' }],
      ['file name', saved.find((item) => typeof item === 'string'), 'photo-clean.jpg'],
      ['cleaned: no GPS, camera or comment, orientation kept', [clean.tags['gps:2'], clean.tags['ifd0:271'], clean.texts.length, clean.tags['ifd0:274']], [undefined, undefined, 0, 6]]];`.replace('JPEG_PLACEHOLDER', `'${JPEG}'`));

  await check('qr-batch', `
    await wait(300);
    set('#qrbNamed', true, 'change'); set('#qrbValues', 'Masa 1, https://example.com/1\\n"Bahçe, sol"; https://example.com/2\\nMasa 1, https://example.com/3'); click('#qrbGenerate'); await wait(100);
    const zipShown = !$('#qrbZip').hidden;
    let zip;
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => { zip = blob; return createObjectURL.call(URL, blob); };
    const anchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};
    click('#qrbZip'); await wait(400);
    URL.createObjectURL = createObjectURL; HTMLAnchorElement.prototype.click = anchorClick;
    const bytes = new Uint8Array(await zip.arrayBuffer());
    const names = []; const view = new DataView(bytes.buffer);
    for (let at = 0; at + 46 < bytes.length; at += 1) {
      if (view.getUint32(at, true) === 0x02014b50) { const length = view.getUint16(at + 28, true); names.push(new TextDecoder().decode(bytes.slice(at + 46, at + 46 + length))); }
    }
    return [['ZIP button', zipShown, true], ['local file header', [...bytes.slice(0, 4)], [80, 75, 3, 4]], ['names from the first column, made unique', names, ['Masa 1.png', 'Bahçe, sol.png', 'Masa 1-2.png']]];`);

  await check('image-to-base64', `
    let opened = 0; $('#i2bFile').click = () => { opened += 1; };
    const zone = $('#i2bDrop');
    for (const key of ['Enter', ' ', 'a']) zone.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    return [['drop zone opens with Enter and Space', opened, 2]];`);

  await check('credit-card-validator', `
    const api = window.ToolkitCardValidator;
    const networks = ['4111111111111111', '9792030000001230', '378282246310005', '5555555555554444', '2221000000000009', '6011111111111117', '3530111333300000', '6200000000000005', '1234567812345670'].map(api.detect);
    set('#ccNumber', '5555 5555 5555 4445');
    const typo = text('#ccChecks');
    set('#ccNumber', '3782-822463-10005'); set('#ccExpiry', '01/20'); set('#ccCvc', '123');
    const amex = [text('#ccFormatted'), text('#ccNetwork'), text('#ccChecks')];
    set('#ccNumber', '9792 0300 0000 1230'); set('#ccExpiry', ''); set('#ccCvc', '');
    const troy = text('#ccFacts') + ' ' + text('#ccNote');
    return [['networks', networks, ['Visa', 'Troy', 'American Express', 'Mastercard', 'Mastercard', 'Discover', 'JCB', 'UnionPay', null]],
      ['Luhn', [api.luhn('4111111111111111'), api.luhn('4111111111111112')], [true, false]],
      ['a mistyped digit and the right one', typo, { includes: 'Check digit is wrong (Luhn): the last digit would be 4.' }],
      ['Amex grouping', amex[0], '3782 822463 10005'], ['Amex network', amex[1], 'American Express'],
      ['expired card', amex[2], { includes: 'Expiry date has passed.' }], ['Amex code is 4 digits', amex[2], { includes: '✕ Security code: 4 digits, on the front of the card.' }],
      ['Troy is national', troy, { includes: '9 — National assignment' }], ['Troy note', troy, { includes: 'Interbank Card Center' }]];`);

  await check('country-time-zones', `
    const api = window.ToolkitCountryZones;
    const at = (iso) => new Date(iso);
    const offsets = [api.offsetMinutes('Europe/Istanbul', at('2026-07-01T00:00Z')), api.offsetMinutes('America/New_York', at('2026-01-15T00:00Z')),
      api.offsetMinutes('America/New_York', at('2026-07-15T00:00Z')), api.offsetMinutes('Asia/Kolkata', at('2026-01-15T00:00Z')),
      api.offsetMinutes('Asia/Kathmandu', at('2026-01-15T00:00Z')), api.offsetMinutes('America/St_Johns', at('2026-01-15T00:00Z'))];
    const change = api.nextChange('America/New_York', at('2026-01-01T00:00Z'));
    const noon = api.instantFor('Europe/Istanbul', 2026, 11, 15, 12, 0).toISOString();
    set('#ctzCountry', 'US', 'change'); await wait(20);
    const us = [document.querySelectorAll('#ctzZones tr').length, text('#ctzSummary')];
    set('#ctzCountry', 'TR', 'change'); await wait(20);
    const turkey = [document.querySelectorAll('#ctzZones tr').length, text('#ctzZones'), text('#ctzSame')];
    set('#ctzFrom', 'Europe/Istanbul', 'change'); set('#ctzWhen', '2026-11-15T12:00'); await wait(20);
    return [['offsets in minutes', offsets, [180, -300, -240, 330, 345, -210]], ['formatted offset', api.formatOffset(-210), 'UTC−03:30'],
      ['next US change', [change.at.toISOString(), change.offset], ['2026-03-08T07:00:00.000Z', -240]],
      ['Istanbul noon in UTC', noon, '2026-11-15T09:00:00.000Z'], ['Istanbul has no daylight saving', api.dst('Europe/Istanbul', at('2026-07-01T00:00Z')), 'none'],
      ['United States zones', us[0] > 20, true], ['summary', us[1], { includes: 'time zones.' }],
      ['Türkiye has one zone', turkey[0], 1], ['zone row', turkey[1], { includes: 'Europe/Istanbul' }], ['shares UTC+03:00', turkey[2], { includes: 'UTC+03:00' }],
      ['converted to UTC', text('#ctzConverted'), { includes: '09:00' }]];`);

  await check('image-compressor', `
    await wait(200);
    // Two noisy 800×600 photos-to-be: noise does not compress for free.
    const make = async (name, seed) => {
      const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600;
      const ctx = canvas.getContext('2d'); const data = ctx.createImageData(800, 600); let x = seed;
      for (let i = 0; i < data.data.length; i += 4) { x = (x * 1103515245 + 12345) >>> 0; data.data[i] = x & 255; data.data[i + 1] = (x >> 8) & 255; data.data[i + 2] = (x >> 16) & 255; data.data[i + 3] = 255; }
      ctx.putImageData(data, 0, 0);
      return new File([await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))], name, { type: 'image/png' });
    };
    const files = new DataTransfer(); files.items.add(await make('a.png', 1)); files.items.add(await make('b.png', 2));
    $('#imageCompressInput').files = files.files; $('#imageCompressInput').dispatchEvent(new Event('change', { bubbles: true }));
    const picked = text('#imageCompressFileName');
    set('#imageMaxWidth', '1920'); set('#imageMaxHeight', '300'); set('#imageFormat', 'image/jpeg', 'change'); set('#imageQuality', '90'); set('#imageTargetKb', '20');
    const made = new Map(); const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => { const url = createObjectURL.call(URL, blob); made.set(url, blob); return url; };
    click('#imageCompressRun');
    for (let i = 0; i < 200 && document.querySelectorAll('#imageCompressResult .ic-row a').length < 2; i += 1) await wait(50);
    URL.createObjectURL = createObjectURL;
    const rows = [...document.querySelectorAll('#imageCompressResult .ic-row')].map((row) => row.textContent);
    const sizes = [...document.querySelectorAll('#imageCompressResult .ic-row a')].map((link) => link.download);
    const blobs = [...document.querySelectorAll('#imageCompressResult .ic-row a')].map((link) => made.get(link.href));
    document.querySelector('#imageCompressResult .ic-row button').click(); await wait(50);
    set('#imageCompareSlider', '30');
    return [['two files chosen', picked, '2 files selected'], ['height limit', rows[0], { includes: '800×600 → 400×300' }],
      ['names', sizes, ['a-compressed.jpeg', 'b-compressed.jpeg']], ['target size reached', blobs.every((blob) => blob.size <= 20 * 1024 && blob.type === 'image/jpeg'), true],
      ['summary and ZIP', text('#imageCompressResult'), { includes: 'Download all (ZIP)' }],
      ['before/after view', [$('#imageCompare').hidden, $('#imageCompareBefore').style.clipPath], [false, 'inset(0px 70% 0px 0px)']]];`);

  await check('image-metadata', `
    const bytes = Uint8Array.from(atob(JPEG_PLACEHOLDER), (c) => c.charCodeAt(0));
    const files = new DataTransfer(); files.items.add(new File([bytes], 'photo.jpg', { type: 'image/jpeg' }));
    $('#imFile').files = files.files; $('#imFile').dispatchEvent(new Event('change')); await wait(400);
    const prefilled = [$('#imEdit').hidden, value('#imEditDate'), document.querySelector('input[name="imEditGps"][value="keep"]').checked];
    set('#imEditDescription', 'Galata Kulesi'); set('#imEditArtist', 'Ayşe'); set('#imEditCopyright', '© 2026 Ayşe');
    set('input[name="imEditGps"][value="set"]', true, 'change'); set('#imEditLat', '41.025658'); set('#imEditLon', '28,974155');
    const saved = []; const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => { saved.push(blob); return createObjectURL.call(URL, blob); };
    const anchorClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { saved.push(this.download); };
    click('#imWrite'); await wait(50);
    const edited = window.ToolkitImageMetadata.inspect(new Uint8Array(await saved[0].arrayBuffer()));
    // Batch: the JPEG twice and a PNG with a text chunk-free canvas image.
    const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 4;
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const batch = new DataTransfer(); batch.items.add(new File([bytes], 'a.jpg', { type: 'image/jpeg' })); batch.items.add(new File([bytes], 'b.jpg', { type: 'image/jpeg' })); batch.items.add(new File([png], 'c.png', { type: 'image/png' }));
    $('#imBatch').files = batch.files; $('#imBatch').dispatchEvent(new Event('change')); await wait(400);
    URL.createObjectURL = createObjectURL; HTMLAnchorElement.prototype.click = anchorClick;
    const zip = saved.find((item, index) => index > 1 && item instanceof Blob);
    const zipBytes = new Uint8Array(await zip.arrayBuffer()); const names = []; const view = new DataView(zipBytes.buffer);
    for (let at = 0; at + 46 < zipBytes.length; at += 1) if (view.getUint32(at, true) === 0x02014b50) { const length = view.getUint16(at + 28, true); names.push(new TextDecoder().decode(zipBytes.slice(at + 46, at + 46 + length))); }
    return [['editor prefilled', prefilled, [false, '2026-11-14T10:20:30', true]], ['edited file name', saved[1], 'photo-edited.jpg'],
      ['written fields', [edited.tags['ifd0:270'], edited.tags['ifd0:315'], edited.tags['ifd0:33432']], ['Galata Kulesi', 'Ayşe', '© 2026 Ayşe']],
      ['new GPS (comma accepted)', [edited.tags['gps:1'], edited.tags['gps:2'][0], edited.tags['gps:2'][1], edited.tags['gps:4'][0], edited.tags['gps:4'][1]], ['N', 41, 1, 28, 58]],
      ['camera kept', [edited.tags['ifd0:271'], edited.tags['exif:33434'], edited.tags['ifd0:274']], ['Canon', 0.004, 6]],
      ['batch ZIP', names, ['a-clean.jpg', 'b-clean.jpg', 'c-clean.png']], ['batch note', text('#imBatchNote'), { includes: '3 cleaned, 0 skipped' }]];`.replace('JPEG_PLACEHOLDER', `'${JPEG}'`));

  await check('image-metadata', `
    const api = window.ToolkitImageMetadata;
    const bytes = Uint8Array.from(atob(JPEG_PLACEHOLDER), (c) => c.charCodeAt(0));
    const load = async (data, name) => { const files = new DataTransfer(); files.items.add(new File([data], name, { type: 'image/jpeg' })); $('#imFile').files = files.files; $('#imFile').dispatchEvent(new Event('change')); await wait(400); };
    await load(bytes, 'photo.jpg');
    const unsignedHidden = $('#imVerify').hidden;
    const saved = []; const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => { saved.push(blob); return createObjectURL.call(URL, blob); };
    const anchorClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { saved.push(this.download); };
    click('#imKeyNew'); await wait(300);
    const keyText = await saved[0].text(); const keyName = saved[1]; const keyInfo = text('#imKeyInfo');
    set('#imSigner', 'Ayşe Yılmaz'); click('#imSign'); await wait(300);
    const signed = new Uint8Array(await saved[2].arrayBuffer()); const signedName = saved[3];
    // Editing the metadata keeps the signature: it covers the picture only.
    await load(signed, 'photo-signed.jpg');
    const shown = [$('#imVerify').hidden, text('#imVerify')];
    set('#imEditArtist', 'Başkası'); click('#imWrite'); await wait(100);
    URL.createObjectURL = createObjectURL; HTMLAnchorElement.prototype.click = anchorClick;
    const edited = new Uint8Array(await saved.filter((item) => item instanceof Blob).pop().arrayBuffer()); const editedName = saved[saved.length - 1];
    const state = async (data) => (await api.verifyFile(data, api.inspect(data))).state;
    const tampered = signed.slice(); tampered[tampered.length - 20] ^= 1;
    const cleaned = api.strip(signed, api.inspect(signed));
    // The saved key file signs again with the same fingerprint.
    const reloaded = await api.loadKey(JSON.parse(keyText));
    return [['no signature, no box', unsignedHidden, true], ['key file', [keyName, JSON.parse(keyText).type], ['toolkit-signing-key.json', 'toolkit:signing-key']],
      ['fingerprint shown', keyInfo, { includes: 'Fingerprint: ' + reloaded.fingerprint }], ['signed file name', signedName, 'photo-signed.jpg'],
      ['verified on load', shown[0], false], ['signer shown', shown[1], { includes: 'Signed and unchanged since. Signer: Ayşe Yılmaz' }],
      ['signed copy still has its camera data', api.inspect(signed).tags['ifd0:271'], 'Canon'],
      ['edited metadata keeps a valid signature', [editedName, await state(edited), api.inspect(edited).tags['ifd0:315']], ['photo-signed-edited.jpg', 'valid', 'Başkası']],
      ['changed picture detected', await state(tampered), 'changed'], ['stripped file has no signature', await state(cleaned), 'none']];`.replace('JPEG_PLACEHOLDER', `'${JPEG}'`));

  await check('port-reference', `
    const api = window.ToolkitPorts;
    const all = text('#portCount');
    set('#portQuery', '5432'); await wait(20);
    const postgres = [text('#portInfo'), text('#portRows'), text('#portCommands')];
    set('#portQuery', '22'); await wait(20);
    const ssh = text('#portInfo');
    set('#portQuery', '6667'); await wait(20);
    const irc = [text('#portInfo'), text('#portRows')];
    set('#portQuery', '50000'); await wait(20);
    const dynamic = text('#portInfo');
    set('#portQuery', '70000'); await wait(20);
    const tooBig = text('#portInfo');
    set('#portQuery', 'redis'); await wait(20);
    const byName = [text('#portRows'), $('#portInfo').hidden];
    set('#portQuery', ''); set('#portCategory', 'database', 'change'); await wait(20);
    const databases = [...document.querySelectorAll('#portRows tr')].every((row) => /Database|SQL|Redis|Mongo|Cassandra|Elastic|Influx|Couch|Memcached|Oracle/i.test(row.textContent));
    return [['whole list', all, { includes: ' ports' }], ['5432 is PostgreSQL', postgres[1], { includes: 'PostgreSQL' }],
      ['5432 is a user port', postgres[0], { includes: 'User port (1024–49151)' }], ['5432 not blocked', postgres[0], { includes: 'Browsers can open web addresses on this port.' }],
      ['commands use the port', postgres[2], { includes: 'lsof -nP -iTCP:5432 -sTCP:LISTEN' }],
      ['22 needs root and is blocked', [ssh.includes('CAP_NET_BIND_SERVICE'), ssh.includes('Browsers refuse')], [true, true]],
      ['6667 inside the IRC range', irc[1], { includes: '6665–6669' }], ['6667 blocked', irc[0], { includes: 'Browsers refuse' }],
      ['50000 outgoing on all three', dynamic, { includes: 'Linux, Windows, macOS' }], ['50000 dynamic', dynamic, { includes: 'Dynamic port (49152–65535)' }],
      ['out of range', tooBig, { includes: 'Ports go from 0 to 65535.' }], ['search by name', byName[0], { includes: '6379' }], ['no number, no port facts', byName[1], true],
      ['category filter', databases, true],
      ['bad ports from the Fetch standard', [api.blocked.size, api.blocked.has(10080), api.blocked.has(8080)], [83, true, false]],
      ['describe 1023 / 1024', [api.describe(1023).privileged, api.describe(1024).privileged, api.describe(32768).linuxEphemeral, api.describe(61000).linuxEphemeral], [true, false, true, false]]];`);

  await check('subnet-calculator', `
    const api = window.ToolkitSubnet;
    set('#snInput', '192.168.1.10/24'); await wait(20);
    const home = text('#snResult');
    const split = [value('#snSplit'), text('#snSplitNote'), text('#snSubnets')];
    set('#snCheck', '192.168.1.200'); const inside = text('#snCheckResult');
    set('#snCheck', '192.168.2.1'); const outside = text('#snCheckResult');
    set('#snInput', '10.1.2.3 255.255.240.0'); await wait(20);
    const masked = text('#snResult');
    set('#snInput', '172.16.5.4/31'); await wait(20);
    const p2p = text('#snResult');
    set('#snInput', '2001:db8:abcd:12::1/48'); await wait(20);
    const v6 = [text('#snResult'), value('#snSplit'), text('#snSplitNote')];
    set('#snInput', '10.0.0.5-10.0.0.20'); await wait(20);
    const range = [text('#snResult'), $('#snSplitBox').hidden];
    set('#snInput', '192.168.1.256/24'); await wait(20);
    const bad = [$('#snError').hidden, text('#snError'), text('#snResult')];
    const format = (input) => api.formatV6(api.parseInput(input).value);
    return [['network', home, { includes: '192.168.1.0/24' }], ['netmask', home, { includes: '255.255.255.0' }],
      ['wildcard', home, { includes: '0.0.0.255' }], ['broadcast', home, { includes: '192.168.1.255' }],
      ['usable range', home, { includes: '192.168.1.1 – 192.168.1.254' }], ['usable hosts', home, { includes: '254' }],
      ['private', home, { includes: 'Private (RFC 1918)' }], ['reverse zone', home, { includes: '1.168.192.in-addr.arpa' }],
      ['split into /26 by default', split[0], '26'], ['four /26 networks', split[1], '4 networks.'], ['third /26', split[2], { includes: '192.168.1.128/26' }],
      ['inside', inside, '✓ Inside 192.168.1.0/24'], ['outside', outside, '✕ Not inside 192.168.1.0/24'],
      ['dotted mask', masked, { includes: '10.1.0.0/20' }], ['host bits note', masked, { includes: 'host bits were cleared' }],
      ['/31 keeps both addresses', p2p, { includes: '172.16.5.4 – 172.16.5.5' }],
      ['IPv6 network', v6[0], { includes: '2001:db8:abcd::/48' }], ['IPv6 documentation', v6[0], { includes: 'Documentation' }],
      ['IPv6 full form', v6[0], { includes: '2001:0db8:abcd:0012:0000:0000:0000:0001' }], ['IPv6 split to /64', v6[1], '64'],
      ['65,536 /64 networks, first 256 listed', v6[2], 'Showing the first 256 of 65,536.'],
      ['range to CIDR', range[0], { includes: '16 addresses in 5 CIDR blocks.' }], ['range blocks', range[0], { includes: '10.0.0.8/29' }], ['no split for a range', range[1], true],
      ['bad octet', bad.slice(0, 2), [false, 'Each IPv4 number must be between 0 and 255.']], ['no result on error', bad[2], ''],
      ['RFC 5952 forms', ['2001:0db8:0000:0000:0000:ff00:0042:8329', '2001:db8:0:0:1:0:0:1', '::ffff:192.0.2.1', '0:0:0:0:0:0:0:1'].map(format),
        ['2001:db8::ff00:42:8329', '2001:db8::1:0:0:1', '::ffff:192.0.2.1', '::1']],
      ['CGNAT', api.addressType(4, api.parseInput('100.64.1.1').value, 32), 'Shared address space for carrier-grade NAT (RFC 6598)']];`);

  await check('jsonpath-tester', `
    const api = window.ToolkitJsonPath;
    const prefilled = [JSON.parse(value('#jpOutput')), text('#jpCount')];
    click('[data-jp-query="$..price"]'); await wait(20);
    const prices = JSON.parse(value('#jpOutput'));
    set('input[name="jpShow"][value="paths"]', true, 'change'); await wait(20);
    const paths = value('#jpOutput').split('\\n');
    set('input[name="jpShow"][value="values"]', true, 'change');
    set('#jpQuery', "$.store.book[?@.price < 10 && @.category == 'fiction'].title"); await wait(20);
    const filtered = JSON.parse(value('#jpOutput'));
    set('#jpQuery', '$.store.book[?@.price <'); await wait(20);
    const badQuery = [$('#jpError').hidden, text('#jpError'), value('#jpOutput')];
    set('#jpJson', '{"a": 1,}'); set('#jpQuery', '$.a'); await wait(20);
    const badJson = text('#jpError');
    const doc = { a: [3, 5, 1, 2, 4, 6, { b: 'j' }, { b: 'k' }, { b: {} }, { b: 'kilo' }], o: { p: 1, q: 2, r: 3, s: 5, t: { u: 6 } }, e: 'f' };
    const values = (query, data = doc) => api.evaluate(data, query).map((node) => node.value);
    const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    return [['prefilled bookstore authors', prefilled, [['Nigel Rees', 'Evelyn Waugh', 'Herman Melville', 'J. R. R. Tolkien'], '4 matches']],
      ['descendant prices', prices, [8.95, 12.99, 8.99, 22.99, 399]], ['normalized paths', [paths[0], paths[4]], ["$['store']['book'][0]['price']", "$['store']['bicycle']['price']"]],
      ['filter with && and ==', filtered, ['Moby Dick']],
      ['bad query', badQuery, [false, 'The query is not valid: Expected a value, a query or a function. (at character 24)', '']],
      ['bad JSON', badJson, { includes: 'The JSON is not valid:' }],
      ['RFC 9535 slices', [values('$[1:3]', letters), values('$[5:1:-2]', letters), values('$[::-1]', letters).join('')], [['b', 'c'], ['f', 'd'], 'gfedcba']],
      ['RFC 9535 filters', [values('$.a[?@>3.5]'), values('$.a[?@<2 || @.b == "k"]'), values('$.o[?@>1 && @<4]'), values('$.a[?@.b == $.x]')],
        [[5, 4, 6], [1, { b: 'k' }], [2, 3], [3, 5, 1, 2, 4, 6]]],
      ['RFC 9535 functions', [values('$.a[?match(@.b, "[jk]")]'), values('$.a[?search(@.b, "[jk]")]').length, values('$[?count(@.*) == 1]', { a: { x: 1 }, b: { x: 1, y: 2 } })],
        [[{ b: 'j' }, { b: 'k' }], 3, [{ x: 1 }]]],
      ['descendant union', values('$.o..[?@<3, ?@<3]'), [1, 2, 1, 2]],
      ['escaped path', api.evaluate({ "it's": 1 }, '$["it\\'s"]')[0].path, "$['it\\\\'s']"]];`);

  await check('json-schema-generator', `
    const api = window.ToolkitJsonSchemaGenerator;
    set('#jsgInput', '{"id":42,"name":"Ada","email":"ada@example.com","joined":"2026-11-15T09:30:00Z","roles":["admin"],"manager":null,"score":9.5}'); await wait(20);
    const one = JSON.parse(value('#jsgOutput'));
    set('#jsgSamples', true, 'change');
    set('#jsgInput', '[{"order":1001,"total":19,"items":[{"sku":"A1","qty":2}]},{"order":1002,"total":5.5,"coupon":"X","items":[{"sku":"B7","qty":1,"gift":true}],"note":null}]'); await wait(20);
    const many = JSON.parse(value('#jsgOutput'));
    set('#jsgDraft', '07', 'change'); set('#jsgRequired', 'none', 'change'); set('#jsgStrict', true, 'change'); await wait(20);
    const options = JSON.parse(value('#jsgOutput'));
    const nullable = api.generate([{ v: { a: 1 } }, { v: null }], { draft: '2020-12', required: 'seen', formats: true, strict: false });
    return [['draft 2020-12', one.$schema, 'https://json-schema.org/draft/2020-12/schema'],
      ['types', [one.properties.id.type, one.properties.score.type, one.properties.manager.type, one.properties.roles.items.type], ['integer', 'number', 'null', 'string']],
      ['formats', [one.properties.email.format, one.properties.joined.format], ['email', 'date-time']], ['required in order', one.required, ['id', 'name', 'email', 'joined', 'roles', 'manager', 'score']],
      ['samples merged: integer and number', [many.type, many.properties.total.type], ['object', 'number']], ['only shared keys required', many.required, ['order', 'total', 'items']],
      ['array items merged', many.properties.items.items.required, ['sku', 'qty']], ['optional key kept', many.properties.items.items.properties.gift.type, 'boolean'],
      ['draft-07, no required, closed', [options.$schema, 'required' in options, options.additionalProperties], ['http://json-schema.org/draft-07/schema#', false, false]],
      ['nullable object', nullable.properties.v.type, ['object', 'null']]];`);

  await check('jwt-signer', `
    const api = window.ToolkitJwtSigner;
    const jwtio = await api.sign('HS256', { alg: 'HS256', typ: 'JWT' }, { sub: '1234567890', name: 'John Doe', iat: 1516239022 }, { secret: 'your-256-bit-secret', encoding: 'text' });
    click('#jwsSign'); await wait(100);
    const noSecret = [$('#jwsError').hidden, text('#jwsError')];
    set('#jwsSecret', 'a-string-secret-at-least-256-bits-long'); click('#jwsSign'); await wait(100);
    const hs = value('#jwsToken');
    const b64 = (part) => JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('a-string-secret-at-least-256-bits-long'), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const [h1, p1, s1] = hs.split('.');
    const sig1 = Uint8Array.from(atob(s1.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s1.length % 4) % 4)), (c) => c.charCodeAt(0));
    const hsValid = await crypto.subtle.verify('HMAC', key, sig1, new TextEncoder().encode(h1 + '.' + p1));
    set('#jwsSecret', 'short'); click('#jwsSign'); await wait(100);
    const shortNote = text('#jwsNote');
    set('#jwsAlg', 'ES256', 'change');
    const header = JSON.parse(value('#jwsHeader')).alg;
    const boxes = [$('#jwsSecretBox').hidden, $('#jwsKeyBox').hidden];
    click('#jwsGenerate'); await wait(300);
    click('#jwsSign'); await wait(200);
    const es = value('#jwsToken').split('.');
    const spki = value('#jwsPublic').replace(/-----[^-]+-----|\\s/g, '');
    const publicKey = await crypto.subtle.importKey('spki', Uint8Array.from(atob(spki), (c) => c.charCodeAt(0)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const sig2 = Uint8Array.from(atob(es[2].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - es[2].length % 4) % 4)), (c) => c.charCodeAt(0));
    const esValid = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, sig2, new TextEncoder().encode(es[0] + '.' + es[1]));
    set('#jwsKey', value('#jwsPublic')); click('#jwsSign'); await wait(100);
    const publicError = text('#jwsError');
    const eddsa = await api.generateKeyPair('EdDSA');
    const ed = await api.sign('EdDSA', { typ: 'JWT' }, { a: 1 }, { text: eddsa.privatePem });
    return [['jwt.io HS256 example', jwtio.token.split('.')[2], 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'], ['short-secret warning', jwtio.warnings.length, 1],
      ['no secret', noSecret, [false, 'Enter a secret.']], ['HS256 header', b64(h1), { alg: 'HS256', typ: 'JWT' }], ['HS256 payload', b64(p1).name, 'Ada Lovelace'], ['HS256 verifies', hsValid, true],
      ['short secret note', shortNote, 'HS256 needs a secret of at least 32 bytes (RFC 7518); this one has 5.'],
      ['alg follows the menu', header, 'ES256'], ['key box for ES256', boxes, [true, false]], ['ES256 header', b64(es[0]).alg, 'ES256'], ['ES256 verifies with the generated public key', esValid, true],
      ['public key refused', publicError, 'This is a public key. Signing needs the private key.'], ['EdDSA signs', b64(ed.token.split('.')[0]).alg, 'EdDSA']];`);

  await check('html-to-markdown', `
    const md = (html, bullet = '-', em = '*') => window.ToolkitHtmlToMarkdown.convert(html, { bullet, em, strong: em + em });
    set('#h2mInput', '<h2>Hi <em>there</em></h2><p>A <a href="https://example.com/a b" title="Ex">link</a> and <code>x</code>.</p>'); await wait(20);
    const page = value('#h2mOutput');
    set('#h2mBullet', '*', 'change'); set('#h2mInput', '<ul><li>one</li><li>two</li></ul>'); await wait(20);
    const star = value('#h2mOutput');
    return [['heading and inline', page, '## Hi *there*\\n\\nA [link](<https://example.com/a b> "Ex") and \`x\`.'], ['bullet option', star, '* one\\n* two'],
      ['nested and ordered lists', md('<ol start="3"><li>three<ul><li>sub</li></ul></li><li>four</li></ol>'), '3. three\\n   - sub\\n4. four'],
      ['task list', md('<ul><li><input type="checkbox" checked> done</li><li><input type="checkbox"> todo</li></ul>'), '- [x] done\\n- [ ] todo'],
      ['code block with language', md('<pre><code class="language-js">const a = 1;\\nconsole.log(\`a\`);</code></pre>'), '\`\`\`js\\nconst a = 1;\\nconsole.log(\`a\`);\\n\`\`\`'],
      ['fence longer than backticks inside', md('<pre>a \`\`\` b</pre>'), '\`\`\`\`\\na \`\`\` b\\n\`\`\`\`'],
      ['table with alignment', md('<table><tr><th>A</th><th align="right">B|C</th></tr><tr><td>1</td><td>2</td></tr></table>'), '| A | B\\\\|C |\\n| --- | ---: |\\n| 1 | 2 |'],
      ['quote', md('<blockquote><p>One</p><p>Two</p></blockquote>'), '> One\\n>\\n> Two'],
      ['escapes', md('<p>2 * 3 = 6 and _x_ [y]</p><p># not a heading</p><p>1. not a list</p>'), '2 \\\\* 3 = 6 and \\\\_x\\\\_ \\\\[y\\\\]\\n\\n\\\\# not a heading\\n\\n1\\\\. not a list'],
      ['emphasis spaces moved out', md('<p>a<strong> bold </strong>b</p>', '-', '_'), 'a __bold__ b'],
      ['line break, image, strike, hr', md('<p>a<br>b</p><p><img src="i.png" alt="pic"> <del>old</del></p><hr>'), 'a\\\\\\nb\\n\\n![pic](i.png) ~~old~~\\n\\n---'],
      ['scripts and javascript links dropped', md('<p>x<script>alert(1)</script><a href="javascript:alert(1)">y</a></p><style>p{}</style>'), 'xy']];`);

  await check('csv-to-sql', `
    const api = window.ToolkitCsvToSql;
    set('#c2sTable', 'products'); set('#c2sInput', 'id,name,price,in_stock\\n1,"Tea, green",4.5,true\\n2,O\\'Brien,7,false\\n3,,3,'); await wait(20);
    const pg = value('#c2sOutput');
    const stats = text('#c2sStats');
    set('#c2sDialect', 'sqlserver', 'change'); set('#c2sBatch', '1', 'change'); await wait(20);
    const ms = value('#c2sOutput');
    set('#c2sInput', 'a,b\\n"open'); await wait(20);
    const bad = [$('#c2sError').hidden, text('#c2sError'), value('#c2sOutput')];
    const json = api.generate(api.readInput('[{"id":1,"tags":["x"],"ok":true,"note":"C:\\\\\\\\tmp"},{"id":2,"extra":"é"}]', 'auto', true), { table: 'db.t', dialect: 'mysql', batch: 100, create: true, emptyIsNull: true, transaction: true }).sql;
    const sqlite = api.generate(api.readInput('zip;n\\n007;1\\n34000;2', 'auto', true), { table: 't', dialect: 'sqlite', batch: Infinity, create: true, emptyIsNull: true }).sql;
    return [['PostgreSQL CREATE TABLE', pg, { includes: 'CREATE TABLE "products" (\\n  "id" INTEGER,\\n  "name" TEXT,\\n  "price" NUMERIC,\\n  "in_stock" BOOLEAN\\n);' }],
      ['PostgreSQL rows', pg, { includes: "(1, 'Tea, green', 4.5, TRUE),\\n  (2, 'O''Brien', 7, FALSE),\\n  (3, NULL, 3, NULL);" }], ['stats', stats, '3 rows, 4 columns'],
      ['SQL Server one row per INSERT', ms.split('\\n').filter((line) => line.startsWith('INSERT')).length, 3], ['SQL Server names and BIT', ms, { includes: "INSERT INTO [products] ([id], [name], [price], [in_stock]) VALUES (1, 'Tea, green', 4.5, 1);" }],
      ['unclosed quote', bad, [false, 'A quoted CSV field is not closed.', '']],
      ['MySQL JSON, backslashes, transaction', [json.startsWith('START TRANSACTION;'), json.includes('\`db\`.\`t\`'), json.includes("'[\\"x\\"]'"), json.includes("'C:\\\\\\\\tmp'"), json.trim().endsWith('COMMIT;')], [true, true, true, true, true]],
      ['leading zeros stay text, semicolon CSV', sqlite, { includes: '"zip" TEXT,\\n  "n" INTEGER' }], ['zip value quoted', sqlite, { includes: "('007', 1)" }]];`);

  await check('toml-json-converter', `
    const api = window.ToolkitToml;
    set('#tjToml', 'title = "Toolkit"\\nbig = 9223372036854775807\\nwhen = 1979-05-27T07:32:00-08:00\\nday = 1979-05-27\\nratio = 0.5\\nflags = [true, false]\\n\\n[server]\\nport = 8_080\\n\\n[[fruit]]\\nname = "apple"\\n[fruit.physical]\\ncolor = "red"\\n\\n[[fruit]]\\nname = "banana"'); await wait(20);
    const json = value('#tjJson');
    const data = JSON.parse(json);
    set('#tjToml', 'a = 1\\nb = 2\\na = 3'); await wait(20);
    const duplicate = [$('#tjError').hidden, text('#tjError')];
    set('#tjToml', '[x]\\ny = 1\\n[x]\\nz = 2'); await wait(20);
    const tableTwice = text('#tjError');
    set('#tjToml', 'n = 0123'); await wait(20);
    const leading = text('#tjError');
    set('#tjToml', 'title = "x"\\n[owner]\\nname = "Ada"');
    set('input[name="tjDirection"][value="json"]', true, 'change'); await wait(20);
    const carried = [value('#tjToml').startsWith('{'), $('#tjNullsOption').hidden, text('#tjLeftLabel'), text('#tjRightLabel')];
    set('#tjToml', '{"name":"kettle","version":"0.3.1","deps":{"serde":{"version":"1","features":["derive"]}},"bin":[{"name":"a"},{"name":"b"}],"empty":null}'); await wait(20);
    const nullError = text('#tjError');
    set('#tjSkipNulls', true, 'change'); await wait(20);
    const toml = value('#tjJson');
    const roundTrip = JSON.parse(api.toJson(api.parse(toml)));
    const q3 = '"'.repeat(3);
    return [['strings and 64-bit integers', json, { includes: '"big": 9223372036854775807' }], ['offset date-time', data.when, '1979-05-27T07:32:00-08:00'],
      ['local date', data.day, '1979-05-27'], ['underscores in integers', data.server.port, 8080], ['arrays of tables', data.fruit.map((item) => item.name), ['apple', 'banana']],
      ['sub-table of the last array item', data.fruit[0].physical.color, 'red'], ['float stays a float', json, { includes: '"ratio": 0.5' }],
      ['duplicate key', duplicate, [false, 'The key “a” is defined twice. (line 3, column 1)']], ['table defined twice', tableTwice, { includes: 'The table “x” is defined twice.' }],
      ['leading zeros', leading, { includes: 'Leading zeros are not allowed in numbers.' }],
      ['direction switch carries the result over', carried, [true, false, 'JSON', 'TOML']], ['null needs the option', nullError, 'TOML has no null (at empty).'],
      ['JSON to TOML', toml, 'name = "kettle"\\nversion = "0.3.1"\\n\\n[deps.serde]\\nversion = "1"\\nfeatures = ["derive"]\\n\\n[[bin]]\\nname = "a"\\n\\n[[bin]]\\nname = "b"\\n'],
      ['round trip', roundTrip, { name: 'kettle', version: '0.3.1', deps: { serde: { version: '1', features: ['derive'] } }, bin: [{ name: 'a' }, { name: 'b' }] }],
      ['inline tables are closed', (() => { try { api.parse('a = { b = 1 }\\na.c = 2'); return 'accepted'; } catch (error) { return error.message; } })(), 'Cannot add keys to “a” here: it is already defined.'],
      ['multi-line strings', api.parse('s = ' + q3 + '\\nline one \\\\\\n   still one\\nline two' + q3).s, 'line one still one\\nline two']];`);

  await check('dotenv-checker', `
    const api = window.ToolkitEnvChecker;
    set('#envInput', 'DATABASE_URL=postgres://localhost/app\\nPORT = 3000\\nGREETING=Hello world\\nTHEME=#000\\nURL=http://\${HOST}:\${PORT}\\nPORT=4000\\nKEY="multi\\nline"\\nBROKEN'); await wait(20);
    const summary = text('#envSummary');
    const issues = [...document.querySelectorAll('#envIssues tr')].map((row) => row.textContent);
    const hidden = text('#envVars');
    set('#envShow', true, 'change'); await wait(20);
    const shown = text('#envVars');
    const json = JSON.parse(value('#envJson'));
    set('#envExample', 'DATABASE_URL=\\nREDIS_URL=\\nPORT='); await wait(20);
    const compared = [...document.querySelectorAll('#envIssues tr')].map((row) => row.textContent).filter((row) => row.startsWith('—'));
    set('#envInput', 'A=1\\nB="two"'); set('#envExample', ''); await wait(20);
    const clean = [text('#envSummary'), $('#envIssuesWrap').hidden];
    return [['summary', summary, '7 variables: 1 error, 5 warnings.'],
      ['spaces around =', issues.some((row) => row.startsWith('2') && row.includes('Spaces around “=”')), true],
      ['unquoted spaces', issues.some((row) => row.startsWith('3') && row.includes('a shell would cut it')), true],
      ['value read as a comment', issues.some((row) => row.startsWith('4') && row.includes('THEME="#000"')), true],
      ['unset reference', issues.some((row) => row.includes('URL refers to HOST')), true], ['repeated key', issues.some((row) => row.startsWith('6') && row.includes('already set on line 2')), true],
      ['not KEY=value', issues.some((row) => row.startsWith('9') && row.includes('not KEY=value')), true],
      ['values hidden by default', hidden.includes('postgres'), false], ['values shown', shown.includes('postgres://localhost/app'), true],
      ['multi-line double quotes', json.KEY, 'multi\\nline'], ['later value wins', json.PORT, '4000'],
      ['compared with the example', compared, ['—✕ ErrorREDIS_URL is in the example file but not set here.', '—i NoteGREETING is set here but not in the example file.', '—i NoteTHEME is set here but not in the example file.', '—i NoteURL is set here but not in the example file.', '—i NoteKEY is set here but not in the example file.']],
      ['clean file', clean, ['✓ 2 variables, no problems found.', true]],
      ['export and single quotes', api.parse("export A='keep $HOME'").vars[0], { key: 'A', value: 'keep $HOME', line: 1, quote: "'" }]];`);

  await check('box-shadow-generator', `
    const start = text('#bsCode');
    const applied = getComputedStyle($('#bsPreview')).boxShadow;
    click('[data-bs-preset="layered"]'); await wait(20);
    const layered = [(text('#bsCode').match(/rgba\\(/g) || []).length, document.querySelectorAll('#bsLayers button').length];
    click('[data-bs-preset="hard"]'); set('#bsInset', true, 'change'); set('#bsColor', '#ff0000'); set('#bsAlpha', '50'); await wait(20);
    const edited = text('#bsCode');
    click('#bsAdd'); await wait(20);
    const added = [document.querySelectorAll('#bsLayers button').length, $('#bsRemove').disabled];
    click('#bsRemove'); await wait(20);
    return [['default', start, 'box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.25);'], ['applied to the preview', applied.includes('30px'), true],
      ['five smooth layers', layered, [5, 5]], ['inset, colour and opacity', edited, 'box-shadow: inset 6px 6px 0 0 rgba(255, 0, 0, 0.5);'],
      ['add and remove a layer', [...added, document.querySelectorAll('#bsLayers button').length], [2, false, 1]]];`);

  await check('border-radius-generator', `
    const api = window.ToolkitBorderRadius;
    const start = text('#brCode');
    set('#brLink', false, 'change'); set('#br-tr-h', '40'); await wait(20);
    const one = text('#brCode');
    click('[data-br-preset="leaf"]'); await wait(20);
    const leaf = [text('#brCode'), $('#brUnit').value];
    click('[data-br-preset="blob"]'); await wait(20);
    const blob = text('#brCode');
    const applied = getComputedStyle($('#brPreview')).borderTopLeftRadius;
    set('#brEllipse', false, 'change'); click('[data-br-preset="rounded"]'); set('#brUnit', '%', 'change'); await wait(20);
    const percent = text('#brCode');
    return [['default', start, 'border-radius: 24px;'], ['one corner', one, 'border-radius: 24px 40px 24px 24px;'],
      ['three-value form', api.shorthand(['1px', '2px', '3px', '2px']), ['1px', '2px', '3px']], ['two-value form', api.shorthand(['1px', '2px', '1px', '2px']), ['1px', '2px']],
      ['leaf', leaf, ['border-radius: 0 50%;', '%']], ['blob is elliptical in %', /^border-radius: (\\d+% ){3}\\d+% \\/ (\\d+% ){3}\\d+%;$/.test(blob), true],
      ['blob applied', applied.includes('%'), true], ['px to % against the preview width', percent, 'border-radius: 7%;']];`);

  await check('flexbox-playground', `
    const start = $('#fxCode').textContent;
    const items = document.querySelectorAll('#fxBox .fx-item').length;
    set('#fxJustify', 'space-between', 'change'); set('#fxAlignItems', 'center', 'change'); set('#fxGap', '16'); await wait(20);
    const container = $('#fxCode').textContent;
    const applied = getComputedStyle($('#fxBox')).justifyContent;
    click('#fxBox .fx-item:nth-child(2)'); await wait(20);
    const panel = [$('#fxItemPanel').hidden, text('#fxItemTitle')];
    set('#fxGrow', '2'); set('#fxSelf', 'flex-end', 'change'); set('#fxOrder', '-1'); await wait(20);
    const item = $('#fxCode').textContent;
    set('#fxCount', '3'); await wait(20);
    const fewer = document.querySelectorAll('#fxBox .fx-item').length;
    click('#fxItemReset'); await wait(20);
    return [['default', start, '.container {\\n  display: flex;\\n  gap: 8px;\\n}'], ['five items', items, 5],
      ['container properties', container, '.container {\\n  display: flex;\\n  justify-content: space-between;\\n  align-items: center;\\n  gap: 16px;\\n}'],
      ['applied', applied, 'space-between'], ['item picked', panel, [false, 'Item 2']],
      ['item properties', item, { includes: '.item-2 {\\n  flex: 2 1 auto;\\n  align-self: flex-end;\\n  order: -1;\\n}' }],
      ['item count', fewer, 3], ['reset item', $('#fxCode').textContent.includes('.item-2'), false]];`);

  await check('css-grid-generator', `
    const api = window.ToolkitGrid;
    const start = $('#grCode').textContent;
    const columns = getComputedStyle($('#grBox')).gridTemplateColumns.split(' ').length;
    click('[data-gr-preset="holy"]'); await wait(20);
    const holy = [$('#grCode').textContent, [...document.querySelectorAll('#grBox .gr-item')].map((item) => item.textContent), $('#grCountRow').hidden];
    const header = $('#grBox .gr-item').getBoundingClientRect().width > $('#grBox').getBoundingClientRect().width * 0.8;
    set('#grAreas', '"a a"\\n"a b"'); await wait(20);
    const notRect = [$('#grError').hidden, text('#grError')];
    set('#grAreas', '"a b"\\n"c"'); await wait(20);
    const ragged = text('#grError');
    set('#grAreas', ''); set('#grColumns', 'repeat(3, potato)'); await wait(20);
    const badTemplate = text('#grError');
    set('#grColumns', 'repeat(auto-fill, minmax(120px, 1fr))'); set('#grColumnGap', '20'); set('#grRowGap', '8'); await wait(20);
    return [['default', start, '.container {\\n  display: grid;\\n  grid-template-columns: repeat(3, 1fr);\\n  grid-template-rows: auto;\\n  gap: 12px;\\n}'], ['three columns applied', columns, 3],
      ['areas in the CSS', holy[0], { includes: 'grid-template-areas:\\n    "header header header"\\n    "nav main aside"\\n    "footer footer footer";' }],
      ['one item per area', holy[1], ['header', 'nav', 'main', 'aside', 'footer']], ['no item count with areas', holy[2], true], ['header spans the width', header, true],
      ['area classes', holy[0], { includes: '.footer { grid-area: footer; }' }],
      ['not a rectangle', notRect, [false, 'The area “a” is not a rectangle.']], ['ragged rows', ragged, 'Every row of areas needs the same number of cells.'],
      ['invalid template', badTemplate, '“repeat(3, potato)” is not a valid column template.'],
      ['different gaps', $('#grCode').textContent, { includes: 'gap: 8px 20px;' }], ['parse unquoted lines', api.parseAreas('a b\\nc c').names, ['a', 'b', 'c']]];`);

  await check('image-converter', `
    const api = window.ToolkitImageConverter;
    // 200×100: left half red, right half blue.
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 100, 100); ctx.fillStyle = '#0000ff'; ctx.fillRect(100, 0, 100, 100);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const load = async (blob, name) => { const files = new DataTransfer(); files.items.add(new File([blob], name, { type: blob.type })); $('#icFile').files = files.files; $('#icFile').dispatchEvent(new Event('change')); await wait(300); };
    const pixel = async (blob, x, y) => { const bitmap = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height; const g = c.getContext('2d'); g.drawImage(bitmap, 0, 0); const d = g.getImageData(x, y, 1, 1).data; return [bitmap.width, bitmap.height, d[0] > 200 ? 'red' : d[2] > 200 ? 'blue' : 'other']; };
    await load(png, 'test.png');
    const opened = [$('#icEditor').hidden, text('#icSource'), value('#icWidth'), value('#icHeight')];
    set('#icRatio', '1:1', 'change'); await wait(20);
    const square = api.state().crop;
    set('#icWidth', '50'); await wait(20);
    const locked = value('#icHeight');
    const squareBlob = await api.render();
    const squarePixels = [await pixel(squareBlob, 10, 25), await pixel(squareBlob, 40, 25)];
    set('#icRatio', 'free', 'change'); click('#icFlipX'); await wait(50);
    const flipped = await pixel(await api.render(), 10, 50);
    click('#icRotateRight'); await wait(50);
    const turned = [api.state().rotation, value('#icWidth'), value('#icHeight')];
    const rotatedBlob = await api.render();
    const rotatedPixel = await pixel(rotatedBlob, 50, 10);
    set('#icFormat', 'image/jpeg', 'change'); await wait(20);
    const jpegUi = [$('#icQualityRow').hidden, $('#icBgRow').hidden];
    const jpeg = await api.render();
    const saved = []; const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => { saved.push(blob); return createObjectURL.call(URL, blob); };
    const anchorClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { saved.push(this.download); };
    click('#icDownload'); await wait(300);
    URL.createObjectURL = createObjectURL; HTMLAnchorElement.prototype.click = anchorClick;
    const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#00ff00"/></svg>'], { type: 'image/svg+xml' });
    await load(svg, 'logo.svg');
    const svgUi = [$('#icSvgRow').hidden, value('#icFormat')];
    set('#icSvgScale', '4', 'change'); await wait(50);
    const svgOut = await createImageBitmap(await api.render());
    return [['editor opens', opened, [false, 'test.png · 200 × 100 px · ' + (png.size < 1024 ? png.size + ' B' : (png.size / 1024).toFixed(1) + ' KB'), '200', '100']],
      ['1:1 crop centred', square, { x: 50, y: 0, w: 100, h: 100 }], ['height follows width', locked, '50'],
      ['square output: red then blue', squarePixels, [[50, 50, 'red'], [50, 50, 'blue']]],
      ['flip swaps the halves', flipped, [200, 100, 'blue']], ['rotate right', turned, [90, '100', '200']], ['rotated pixel', rotatedPixel, [100, 200, 'blue']],
      ['JPEG shows quality and background', jpegUi, [false, false]], ['JPEG output', jpeg.type, 'image/jpeg'],
      ['download name and type', [saved.find((item) => typeof item === 'string'), saved.find((item) => item instanceof Blob)?.type], ['test-100x200.jpg', 'image/jpeg']],
      ['result line', text('#icResult'), { includes: 'Saved test-100x200.jpg' }],
      ['SVG opens as PNG with a scale option', svgUi, [false, 'image/png']], ['SVG drawn at 4×', [svgOut.width, svgOut.height], [160, 80]]];`);

  await check('pdf-merger', `
    const api = window.ToolkitPdfMerger;
    // Each page is as wide as its label, so the order can be read back.
    const make = async (widths) => { const doc = await PDFLib.PDFDocument.create(); widths.forEach((width) => doc.addPage([width, 400])); return new Blob([await doc.save()], { type: 'application/pdf' }); };
    const widths = async (bytes) => (await PDFLib.PDFDocument.load(bytes)).getPages().map((page) => Math.round(page.getWidth()));
    const files = new DataTransfer();
    files.items.add(new File([await make([101, 102, 103])], 'a.pdf', { type: 'application/pdf' }));
    files.items.add(new File([await make([201, 202])], 'b.pdf', { type: 'application/pdf' }));
    files.items.add(new File([new Blob(['not a pdf'])], 'notes.pdf', { type: 'application/pdf' }));
    $('#pmFiles').files = files.files; $('#pmFiles').dispatchEvent(new Event('change')); await wait(600);
    const rows = [...document.querySelectorAll('#pmList tr')].map((row) => [...row.cells].slice(0, 3).map((cell) => cell.textContent));
    const all = await widths(await api.merge());
    const summary = text('#pmSummary');
    set('#pmList tr:nth-child(1) .pm-pages', '3, 1'); await wait(20);
    document.querySelector('#pmList tr:nth-child(2) .pm-actions button').click(); await wait(20);
    const reordered = await widths(await api.merge());
    set('#pmList tr:nth-child(2) .pm-pages', '2-9'); await wait(20);
    const badRange = text('#pmSummary');
    const ranges = [api.parseRanges('', 4), api.parseRanges('2-3, 1', 4), api.parseRanges('3-', 5), api.parseRanges('-2', 5)];
    return [['bad file left out', rows, [['1', 'a.pdf', '3'], ['2', 'b.pdf', '2']]], ['all pages in order', all, [101, 102, 103, 201, 202]],
      ['summary', summary, '5 pages from 2 files.'], ['moved up and a range used', reordered, [201, 202, 103, 101]],
      ['range outside the file', badRange, 'Pages 2-9 are outside 1–3.'], ['range forms', ranges, [[0, 1, 2, 3], [1, 2, 0], [2, 3, 4], [0, 1]]]];`);

  await check('pdf-page-editor', `
    const api = window.ToolkitPdfPageEditor;
    const doc = await PDFLib.PDFDocument.create();
    [101, 102, 103, 104, 105].forEach((width) => doc.addPage([width, 400]));
    doc.getPage(4).setRotation(PDFLib.degrees(90));
    const files = new DataTransfer(); files.items.add(new File([await doc.save()], 'report.pdf', { type: 'application/pdf' }));
    $('#peFile').files = files.files; $('#peFile').dispatchEvent(new Event('change')); await wait(500);
    const read = async (bytes) => (await PDFLib.PDFDocument.load(bytes)).getPages().map((page) => [Math.round(page.getWidth()), page.getRotation().angle]);
    const opened = [$('#peEditor').hidden, text('#peSource').startsWith('report.pdf · 5 pages'), document.querySelectorAll('#pePages .pe-tile').length];
    set('#peRange', '2, 4'); click('#peSelectRange'); await wait(20);
    const picked = text('#peStatus');
    click('#peRotateRight'); await wait(20);
    const extracted = await read(await api.actions.extract());
    click('#peSelectNone'); set('#peRange', '1'); click('#peSelectRange'); click('#peDelete'); await wait(20);
    document.querySelectorAll('#pePages .pe-tile')[4].querySelector('.pe-move').click(); await wait(20);
    const edited = await read(await api.actions.edited());
    const status = text('#peStatus');
    set('#peSplitMode', 'every', 'change'); set('#peSplitEvery', '2'); await wait(20);
    const every = await api.actions.split();
    set('#peSplitMode', 'ranges', 'change'); set('#peSplitRanges', '1-2, 4-'); await wait(20);
    const ranges = await api.actions.split();
    const saved = []; const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob) => { saved.push(blob); return createObjectURL.call(URL, blob); };
    const anchorClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { saved.push(this.download); };
    click('#peSplit'); await wait(400);
    URL.createObjectURL = createObjectURL; HTMLAnchorElement.prototype.click = anchorClick;
    return [['opens', opened, [false, true, 5]], ['pick by range', picked, '2 selected · 5 of 5 pages kept'],
      ['extract picked pages, rotated', extracted, [[102, 90], [104, 90]]],
      ['delete page 1, move 5 before 4, rotations kept', edited, [[102, 90], [103, 0], [105, 90], [104, 90]]], ['status after delete', status, '0 selected · 4 of 5 pages kept'],
      ['every 2 pages', every.map((part) => part.name), ['report-2-3.pdf', 'report-5-4.pdf']],
      ['by original page ranges, deleted pages left out', ranges.map((part) => part.name), ['report-2.pdf', 'report-4-5.pdf']],
      ['ZIP download', [saved.find((item) => typeof item === 'string'), saved.find((item) => item instanceof Blob)?.type], ['report-split.zip', 'application/zip']],
      ['paper names', [api.paperName(595.28, 841.89), api.paperName(792, 612), api.paperName(300, 300)], ['A4', 'Letter', '106 × 106 mm']]];`);

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
console.log(`Tool vectors passed: ${checked} known-answer checks across ${toolsChecked.size} tools.`);
