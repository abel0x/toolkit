/* TOOLKIT — assets/js/tools/jsonpath-tester.js
   JSONPath as standardised in RFC 9535: names, wildcards, indexes, slices,
   unions, descendants and filters with comparisons, logic and the
   length(), count(), match(), search() and value() functions. Results are
   shown as values or as normalized paths. */
(function initJsonPathTester() {
  'use strict';

  const jsonEl = document.getElementById('jpJson');
  const queryEl = document.getElementById('jpQuery');
  const outputEl = document.getElementById('jpOutput');
  const countEl = document.getElementById('jpCount');
  const errorEl = document.getElementById('jpError');
  const copyBtn = document.getElementById('jpCopy');
  if (!jsonEl || !queryEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  class QueryError extends Error {
    constructor(message, at) { super(message); this.at = at; }
  }

  /* ── Parser ─────────────────────────────────────────────────── */

  // Returns an AST: { root: '$' | '@', segments: [{ descendant, selectors: [...] }] }.
  function parse(source) {
    let at = 0;
    const fail = (message) => { throw new QueryError(message, at); };
    const peek = (text) => source.startsWith(text, at);
    const eat = (text) => { if (peek(text)) { at += text.length; return true; } return false; };
    const expect = (text) => { if (!eat(text)) fail(`Expected “${text}”.`); };
    const blank = () => { while (at < source.length && ' \t\n\r'.includes(source[at])) at += 1; };

    const NAME_FIRST = /[A-Za-z_\u0080-￿]/;
    const NAME_CHAR = /[A-Za-z0-9_\u0080-￿]/;

    function memberName() {
      const start = at;
      if (!NAME_FIRST.test(source[at] || '')) fail('Expected a member name.');
      while (at < source.length && NAME_CHAR.test(source[at])) at += 1;
      return source.slice(start, at);
    }

    function stringLiteral() {
      const quote = source[at];
      at += 1;
      let out = '';
      while (at < source.length && source[at] !== quote) {
        const char = source[at];
        if (char === '\\') {
          const next = source[at + 1];
          const simple = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', '/': '/', '\\': '\\', "'": "'", '"': '"' };
          if (next === 'u') {
            const hex = source.slice(at + 2, at + 6);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('Bad \\u escape.');
            out += String.fromCharCode(parseInt(hex, 16));
            at += 6;
            continue;
          }
          if (!(next in simple) || (next === "'" && quote === '"') || (next === '"' && quote === "'")) fail('Bad escape in a string.');
          out += simple[next];
          at += 2;
          continue;
        }
        if (char.charCodeAt(0) < 0x20) fail('Control characters must be escaped in a string.');
        out += char;
        at += 1;
      }
      if (at >= source.length) fail('A string is not closed.');
      at += 1;
      return out;
    }

    function integer() {
      const match = source.slice(at).match(/^-?(0|[1-9]\d*)/);
      if (!match || match[0] === '-0') fail('Expected an integer.');
      at += match[0].length;
      const value = Number(match[0]);
      if (!Number.isSafeInteger(value)) fail('The integer is too large.');
      return value;
    }

    function selector() {
      blank();
      const char = source[at];
      if (char === "'" || char === '"') return { type: 'name', name: stringLiteral() };
      if (char === '*') { at += 1; return { type: 'wildcard' }; }
      if (char === '?') { at += 1; blank(); return { type: 'filter', expr: logical() }; }
      // index or slice
      let start = null;
      if (char !== ':') start = integer();
      blank();
      if (!peek(':')) {
        if (start === null) fail('Expected a selector.');
        return { type: 'index', index: start };
      }
      at += 1;
      blank();
      let end = null;
      let step = null;
      if (/[-\d]/.test(source[at] || '')) end = integer();
      blank();
      if (eat(':')) { blank(); if (/[-\d]/.test(source[at] || '')) step = integer(); }
      return { type: 'slice', start, end, step };
    }

    function bracketed() {
      const selectors = [selector()];
      blank();
      while (eat(',')) selectors.push(selector()), blank();
      expect(']');
      return selectors;
    }

    function segments() {
      const list = [];
      for (;;) {
        const before = at;
        blank();
        if (eat('..')) {
          if (eat('[')) list.push({ descendant: true, selectors: bracketed() });
          else if (eat('*')) list.push({ descendant: true, selectors: [{ type: 'wildcard' }] });
          else list.push({ descendant: true, selectors: [{ type: 'name', name: memberName() }] });
        } else if (eat('.')) {
          if (eat('*')) list.push({ descendant: false, selectors: [{ type: 'wildcard' }] });
          else list.push({ descendant: false, selectors: [{ type: 'name', name: memberName() }] });
        } else if (eat('[')) {
          list.push({ descendant: false, selectors: bracketed() });
        } else {
          at = before;
          return list;
        }
      }
    }

    function query() {
      const root = source[at];
      at += 1;
      return { kind: 'query', root, segments: segments() };
    }

    // Filter expressions.
    function logical() {
      let left = and();
      blank();
      while (eat('||')) { left = { kind: 'or', left, right: and() }; blank(); }
      return left;
    }
    function and() {
      let left = basic();
      blank();
      while (eat('&&')) { left = { kind: 'and', left, right: basic() }; blank(); }
      return left;
    }
    function basic() {
      blank();
      if (eat('!')) {
        blank();
        if (eat('(')) { const inner = logical(); blank(); expect(')'); return { kind: 'not', expr: inner }; }
        const test = testable();
        return { kind: 'not', expr: { kind: 'test', expr: test } };
      }
      if (eat('(')) { const inner = logical(); blank(); expect(')'); return inner; }
      const left = comparable();
      blank();
      const op = ['==', '!=', '<=', '>=', '<', '>'].find((candidate) => peek(candidate));
      if (op) {
        at += op.length;
        const right = comparable();
        for (const side of [left, right]) {
          if (side.kind === 'query' && !singular(side)) fail('A comparison needs a single-value query, such as @.price.');
          if (side.kind === 'function' && FUNCTIONS[side.name].result !== 'value') fail(`${side.name}() cannot be compared.`);
        }
        return { kind: 'compare', op, left, right };
      }
      if (left.kind === 'literal') fail('A literal on its own is not a test; compare it with something.');
      if (left.kind === 'function' && FUNCTIONS[left.name].result === 'value') fail(`${left.name}() must be compared with something.`);
      return { kind: 'test', expr: left };
    }
    function testable() {
      blank();
      if (peek('@') || peek('$')) return query();
      const fn = functionCall();
      if (!fn) fail('Expected a query or a function after “!”.');
      return fn;
    }
    function functionCall() {
      const match = source.slice(at).match(/^([a-z][a-z0-9_]*)\(/);
      if (!match) return null;
      const name = match[1];
      if (!FUNCTIONS[name]) fail(`Unknown function: ${name}()`);
      at += match[0].length;
      const args = [];
      blank();
      if (!peek(')')) {
        for (;;) {
          blank();
          args.push(argument());
          blank();
          if (!eat(',')) break;
        }
      }
      expect(')');
      const spec = FUNCTIONS[name];
      if (args.length !== spec.args.length) fail(`${name}() takes ${spec.args.length} argument(s).`);
      spec.args.forEach((kind, index) => {
        const arg = args[index];
        if (kind === 'nodes' && arg.kind !== 'query') fail(`${name}() needs a query as argument ${index + 1}.`);
        if (kind === 'value' && arg.kind === 'query' && !singular(arg)) fail(`${name}() needs a single-value query as argument ${index + 1}.`);
      });
      return { kind: 'function', name, args };
    }
    function argument() {
      if (peek('@') || peek('$')) return query();
      const fn = functionCall();
      if (fn) return fn;
      return literal() || fail('Expected an argument.');
    }
    function literal() {
      const char = source[at];
      if (char === "'" || char === '"') return { kind: 'literal', value: stringLiteral() };
      for (const [word, value] of [['true', true], ['false', false], ['null', null]]) {
        if (peek(word)) { at += word.length; return { kind: 'literal', value }; }
      }
      const number = source.slice(at).match(/^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?/);
      if (number) { at += number[0].length; return { kind: 'literal', value: Number(number[0]) }; }
      return null;
    }
    function comparable() {
      blank();
      if (peek('@') || peek('$')) return query();
      return functionCall() || literal() || fail('Expected a value, a query or a function.');
    }

    blank();
    if (!peek('$')) fail('A JSONPath query starts with $.');
    const ast = query();
    blank();
    if (at < source.length) fail('Unexpected text.');
    return ast;
  }

  // A query is singular when it only uses names and indexes, without descendants.
  const singular = (query) => query.segments.every((segment) => !segment.descendant && segment.selectors.length === 1
    && (segment.selectors[0].type === 'name' || segment.selectors[0].type === 'index'));

  /* ── Evaluation ─────────────────────────────────────────────── */

  const NOTHING = Symbol('nothing');
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

  // I-Regexp (RFC 9485) in JavaScript: "." never matches a line break.
  function iregexp(pattern, whole) {
    try {
      const source = pattern.replace(/\\.|\[(?:\\.|[^\]])*\]|\./g, (part) => (part === '.' ? '[^\\n\\r]' : part));
      return new RegExp(whole ? `^(?:${source})$` : source, 'u');
    } catch {
      return null;
    }
  }

  const FUNCTIONS = {
    length: { args: ['value'], result: 'value', run: ([value]) => {
      if (typeof value === 'string') return [...value].length;
      if (Array.isArray(value)) return value.length;
      if (isObject(value)) return Object.keys(value).length;
      return NOTHING;
    } },
    count: { args: ['nodes'], result: 'value', run: ([nodes]) => nodes.length },
    match: { args: ['value', 'value'], result: 'logical', run: ([text, pattern]) => {
      if (typeof text !== 'string' || typeof pattern !== 'string') return false;
      const re = iregexp(pattern, true);
      return re ? re.test(text) : false;
    } },
    search: { args: ['value', 'value'], result: 'logical', run: ([text, pattern]) => {
      if (typeof text !== 'string' || typeof pattern !== 'string') return false;
      const re = iregexp(pattern, false);
      return re ? re.test(text) : false;
    } },
    value: { args: ['nodes'], result: 'value', run: ([nodes]) => (nodes.length === 1 ? nodes[0].value : NOTHING) }
  };

  function children(node) {
    if (Array.isArray(node.value)) return node.value.map((value, index) => ({ value, path: [...node.path, index] }));
    if (isObject(node.value)) return Object.keys(node.value).map((key) => ({ value: node.value[key], path: [...node.path, key] }));
    return [];
  }

  function descendants(node) {
    const out = [node];
    for (const child of children(node)) out.push(...descendants(child));
    return out;
  }

  function sliceIndexes(length, { start, end, step }) {
    const by = step === null ? 1 : step;
    if (by === 0) return [];
    const normal = (value) => (value >= 0 ? value : length + value);
    const out = [];
    if (by > 0) {
      const lower = Math.min(Math.max(normal(start === null ? 0 : start), 0), length);
      const upper = Math.min(Math.max(normal(end === null ? length : end), 0), length);
      for (let index = lower; index < upper; index += by) out.push(index);
    } else {
      const upper = Math.min(Math.max(normal(start === null ? length - 1 : start), -1), length - 1);
      const lower = Math.min(Math.max(end === null ? -1 : normal(end), -1), length - 1);
      for (let index = upper; lower < index; index += by) out.push(index);
    }
    return out;
  }

  function select(selectorNode, node, root) {
    const value = node.value;
    switch (selectorNode.type) {
      case 'name':
        return isObject(value) && Object.prototype.hasOwnProperty.call(value, selectorNode.name)
          ? [{ value: value[selectorNode.name], path: [...node.path, selectorNode.name] }] : [];
      case 'wildcard':
        return children(node);
      case 'index': {
        if (!Array.isArray(value)) return [];
        const index = selectorNode.index < 0 ? value.length + selectorNode.index : selectorNode.index;
        return index >= 0 && index < value.length ? [{ value: value[index], path: [...node.path, index] }] : [];
      }
      case 'slice':
        return Array.isArray(value) ? sliceIndexes(value.length, selectorNode).map((index) => ({ value: value[index], path: [...node.path, index] })) : [];
      case 'filter':
        return children(node).filter((child) => truthy(selectorNode.expr, child, root));
      default:
        return [];
    }
  }

  function run(query, current, root) {
    let nodes = [query.root === '$' ? root : current];
    for (const segment of query.segments) {
      const next = [];
      for (const node of nodes) {
        for (const target of segment.descendant ? descendants(node) : [node]) {
          for (const selectorNode of segment.selectors) next.push(...select(selectorNode, target, root));
        }
      }
      nodes = next;
    }
    return nodes;
  }

  function valueOf(expr, current, root) {
    if (expr.kind === 'literal') return expr.value;
    if (expr.kind === 'query') {
      const nodes = run(expr, current, root);
      return nodes.length ? nodes[0].value : NOTHING;
    }
    if (expr.kind === 'function') return callFunction(expr, current, root);
    return NOTHING;
  }

  function callFunction(expr, current, root) {
    const spec = FUNCTIONS[expr.name];
    const args = expr.args.map((arg, index) => {
      if (spec.args[index] === 'nodes') return run(arg, current, root);
      return valueOf(arg, current, root);
    });
    return spec.run(args);
  }

  function equal(a, b) {
    if (a === NOTHING || b === NOTHING) return a === b;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => equal(item, b[index]));
    if (isObject(a) && isObject(b)) {
      const keys = Object.keys(a);
      return keys.length === Object.keys(b).length && keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && equal(a[key], b[key]));
    }
    return a === b;
  }

  function less(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a < b;
    if (typeof a === 'string' && typeof b === 'string') {
      // Compare by Unicode code points, as the RFC asks.
      const left = [...a];
      const right = [...b];
      for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
        const difference = left[index].codePointAt(0) - right[index].codePointAt(0);
        if (difference) return difference < 0;
      }
      return left.length < right.length;
    }
    return false;
  }

  function truthy(expr, current, root) {
    switch (expr.kind) {
      case 'or': return truthy(expr.left, current, root) || truthy(expr.right, current, root);
      case 'and': return truthy(expr.left, current, root) && truthy(expr.right, current, root);
      case 'not': return !truthy(expr.expr, current, root);
      case 'test':
        if (expr.expr.kind === 'query') return run(expr.expr, current, root).length > 0;
        return callFunction(expr.expr, current, root) === true;
      case 'compare': {
        const a = valueOf(expr.left, current, root);
        const b = valueOf(expr.right, current, root);
        switch (expr.op) {
          case '==': return equal(a, b);
          case '!=': return !equal(a, b);
          case '<': return less(a, b);
          case '>': return less(b, a);
          case '<=': return less(a, b) || equal(a, b);
          case '>=': return less(b, a) || equal(a, b);
          default: return false;
        }
      }
      default: return false;
    }
  }

  // Normalized path, as in RFC 9535 section 2.7.
  function normalizedPath(path) {
    return '$' + path.map((part) => (typeof part === 'number' ? `[${part}]`
      : `['${part.replace(/[\\']/g, (char) => `\\${char}`).replace(/[\u0000-\u001f]/g, (char) => {
        const named = { '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' }[char];
        return named || `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
      })}']`)).join('');
  }

  function evaluate(json, query) {
    const ast = parse(query);
    return run(ast, null, { value: json, path: [] }).map((node) => ({ value: node.value, path: normalizedPath(node.path) }));
  }

  /* ── Page ───────────────────────────────────────────────────── */

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
    outputEl.value = '';
    countEl.textContent = '';
  }

  // Large inputs wait for a pause in typing; small ones update at once.
  const LARGE = 200000;
  let pending = 0;
  const later = (source, fn) => () => {
    clearTimeout(pending);
    if (source.value.length > LARGE) pending = setTimeout(fn, 200); else fn();
  };

  // The parsed document is kept until the JSON text changes.
  let parsed = { text: null, json: undefined, error: null };
  function parseJson(text) {
    if (parsed.text !== text) {
      try { parsed = { text, json: JSON.parse(text), error: null }; } catch (error) { parsed = { text, json: undefined, error }; }
    }
    if (parsed.error) throw parsed.error;
    return parsed.json;
  }

  function render() {
    errorEl.hidden = true;
    const text = jsonEl.value.trim();
    const query = queryEl.value.trim();
    if (!text || !query) { outputEl.value = ''; countEl.textContent = ''; return; }
    let json;
    try {
      json = parseJson(text);
    } catch (error) {
      showError(`${t('The JSON is not valid:')} ${error.message}`);
      return;
    }
    let results;
    try {
      results = evaluate(json, query);
    } catch (error) {
      if (!(error instanceof QueryError)) throw error;
      showError(`${t('The query is not valid:')} ${t(error.message)} (${t('at character')} ${error.at + 1})`);
      return;
    }
    const mode = document.querySelector('input[name="jpShow"]:checked').value;
    outputEl.value = mode === 'paths'
      ? results.map((result) => result.path).join('\n')
      : mode === 'both'
        ? JSON.stringify(results.map((result) => ({ path: result.path, value: result.value })), null, 2)
        : JSON.stringify(results.map((result) => result.value), null, 2);
    countEl.textContent = results.length === 1 ? t('1 match') : t(`${results.length} matches`);
  }

  jsonEl.addEventListener('input', later(jsonEl, render));
  queryEl.addEventListener('input', later(jsonEl, render));
  document.querySelectorAll('input[name="jpShow"]').forEach((radio) => radio.addEventListener('change', render));
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'Result');
    else showToast(t('Nothing to copy.'), 'error');
  });
  // Clickable examples fill in the query.
  document.querySelectorAll('[data-jp-query]').forEach((button) => button.addEventListener('click', () => {
    queryEl.value = button.dataset.jpQuery;
    render();
    queryEl.focus();
  }));

  // The bookstore example from RFC 9535, so the example queries work at once.
  const SAMPLE = {
    store: {
      book: [
        { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
        { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
        { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
        { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 }
      ],
      bicycle: { color: 'red', price: 399 }
    }
  };
  if (!jsonEl.value.trim() && !queryEl.value.trim()) {
    jsonEl.value = JSON.stringify(SAMPLE, null, 2);
    queryEl.value = '$.store.book[*].author';
  }

  // Exposed for the tests.
  window.ToolkitJsonPath = Object.freeze({ evaluate, parse });
  render();
}());
