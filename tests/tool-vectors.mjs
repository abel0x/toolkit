#!/usr/bin/env node
/* Known-answer checks for tools without vectors in the other suites, run against the real pages in Firefox. */
import assert from 'node:assert/strict';
import { withFirefox } from './browser-session.mjs';

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
    return [['beautify', pretty, '{\\n  "b": [\\n    1,\\n    2\\n  ],\\n  "a": "ç"\\n}'], ['minify', value('#jsonOutput'), '{"b":[1,2],"a":"ç"}']];`);

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

  // Generators: verify invariants rather than exact values.
  await check('uuid', `
    const button = [...document.querySelectorAll('main button')].find((node) => /generate/i.test(node.textContent));
    button.click(); await wait(100);
    const values = [...document.querySelectorAll('.uuid-value')].map((node) => node.textContent.trim());
    return [['generated', values.length > 0, true], ['all RFC 4122 v4', values.every((uuid) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuid)), true], ['unique', new Set(values).size, values.length]];`);
});

if (failures.length) console.log(`\n${failures.length} known-answer failure(s):\n  ${failures.join('\n  ')}`);
assert.equal(failures.length, 0, 'Tool output did not match the known answers above.');
console.log(`Tool vectors passed: ${checked} known-answer checks across 33 tools.`);
