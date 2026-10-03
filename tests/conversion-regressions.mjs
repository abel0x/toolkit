#!/usr/bin/env node
/* Dependency-free regression tests against the actual tool event handlers. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function tool(slug, prefix) {
  const elements = new Map();
  const notices = [];
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { value: '', checked: true, style: {}, addEventListener(event, callback) { this[event] = callback; } });
    return elements.get(id);
  } };
  runInNewContext(readFileSync(new URL('../assets/js/tools/' + slug + '.js', import.meta.url), 'utf8'), {
    document, TextEncoder, showToast: (...args) => notices.push(args), copyToClipboard() {}, formatBytes: String
  });
  return (input) => {
    notices.length = 0;
    document.getElementById(prefix + '-input').value = input;
    document.getElementById(prefix + '-indent').value = '2';
    document.getElementById(prefix + '-btn').click();
    return { output: document.getElementById(prefix + '-output').value, notices };
  };
}

for (let repetition = 0; repetition < 3; repetition += 1) {
  const js = tool('js-minifier', 'jsmin');
  for (const input of [
    'const answer = 1 + +2; answer;',
    'let n = 4; n - --n;',
    'function f() { return\n  { answer: 42 }; } f();',
    'const text = "a : b  c // note"; text;',
    'const regex = /https?:\\/\\/[^/]+/; regex.test("https://example.com");',
    'const text = `raw  text\n${`nested ${1 + +2}`}`; text;',
    'let number = 8; number / 2 / 2;',
    'function f() { return /*\n comment */ 2; } f();',
    'const text = "\\\" // literal"; // comment\ntext;'
  ]) {
    assert.deepEqual(runInNewContext(js(input).output), runInNewContext(input), input);
  }
  const css = tool('css-minifier', 'cssmin');
  const literal = '"a : b  c /* note */"';
  assert(css('p::before { content: ' + literal + '; }').output.includes(literal));
  assert(css('a  :hover { width: calc(100% - 2px); }').output.includes('a :hover'));
  assert(css('.a { --message: " a  b "; content: var(--message); }').output.includes('--message: " a  b ";'));
  assert(css('.a { background: url("data:image/svg+xml;a  b"); }').output.includes('url("data:image/svg+xml;a  b")'));
  assert(css('.\\31 0 { color: red; }').output.includes('\\31 0'));
  assert(css('a/**/b { color: red; }').output.includes('a/**/b'));
  const html = tool('html-minifier', 'hmin');
  const pre = '<pre>one  two\n\nthree</pre><span>Hello</span> <span>world</span>';
  assert.equal(html(pre).output, pre);
  const raw = '<script>const s = "<!-- keep -->";</script><textarea>a  b\n c</textarea>';
  assert.equal(html(raw).output, raw);
  const cdata = '<svg><![CDATA[<!-- literal -->  text]]></svg>';
  assert.equal(html(cdata).output, cdata);
  assert.equal(html('<div   title=" a  b "> x </div><!-- remove -->').output, '<div title=" a  b "> x </div>');
  const yaml = tool('yaml-to-json', 'y2j');
  assert.deepEqual(JSON.parse(yaml('name: it\'s simple # comment').output), { name: "it's simple" });
  assert.deepEqual(JSON.parse(yaml('{"a": 1}').output), { a: 1 });
  assert.deepEqual(JSON.parse(yaml('- {"a": 1}').output), [{ a: 1 }]);
  assert.deepEqual(JSON.parse(yaml('people:\n  - name: Ada\n    age: 30\n  - name: Grace\n    age: 40').output), { people: [{ name: 'Ada', age: 30 }, { name: 'Grace', age: 40 }] });
  assert.deepEqual(JSON.parse(yaml('items:\n- one\n- two\nactive: true').output), { items: ['one', 'two'], active: true });
  assert.deepEqual(JSON.parse(yaml("text: 'it''s # safe' # comment\nurl: https://example.com/#part").output), { text: "it's # safe", url: 'https://example.com/#part' });
  for (const input of ['a: 1\na: 2', 'a: &value 2', 'a: |\n  prose', 'a: 1\n---\nb: 2', 'a: 9007199254740993', 'a: [one, two]', 'a: 1\n  b: 2']) {
    const result = yaml(input);
    assert.equal(result.output, '', input);
    assert.equal(result.notices.at(-1)[1], 'error', input);
  }
  const toYaml = tool('json-to-yaml', 'j2y');
  for (const value of [null, [], {}, [1, [2, 3]], { 'a: b': [{ child: { empty: [], text: 'two\nlines\t\"' } }] }, { '__proto__': null, '#key': '001', special: '~' }]) {
    const encoded = toYaml(JSON.stringify(value)).output;
    assert.deepEqual(JSON.parse(yaml(encoded).output), JSON.parse(JSON.stringify(value)), encoded);
  }
  const csv = tool('json-to-csv', 'j2csv');
  assert.equal(csv('[{"a":1,"b":"x,y"}]').output, 'a,b\n1,"x,y"');
  for (const input of ['[null]', '[{"a":1},null]', '[1]', '[[]]', '{}', 'not JSON']) {
    const result = csv(input);
    assert.equal(result.output, '', input);
    assert.equal(result.notices.at(-1)[1], 'error', input);
  }
}
console.log('Conversion regressions passed: three repetitions of literal, operator, nested YAML and invalid-row cases.');
