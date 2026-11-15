/* TOOLKIT — assets/js/tools/toml-json.js
   TOML 1.0 to JSON and back. The parser follows the TOML 1.0 specification,
   including its rules for redefining tables, dotted keys, inline tables and
   arrays of tables; integers keep 64-bit precision (BigInt) and dates and
   times keep the text they were written with. */
(function initTomlJson() {
  'use strict';

  const leftEl = document.getElementById('tjToml');
  const rightEl = document.getElementById('tjJson');
  const errorEl = document.getElementById('tjError');
  const noteEl = document.getElementById('tjNote');
  const nullsEl = document.getElementById('tjSkipNulls');
  if (!leftEl || !rightEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  class TomlError extends Error {
    constructor(message, line, column) { super(message); this.line = line; this.column = column; }
  }

  // Dates and times keep their kind and text: offset-datetime, local-datetime, local-date, local-time.
  class TomlDate {
    constructor(kind, text) { this.kind = kind; this.text = text; }
  }

  /* ── TOML → value ───────────────────────────────────────────── */

  function parse(source) {
    const text = source.replace(/^\uFEFF/, '');
    let at = 0;

    const position = (index) => {
      const before = text.slice(0, index).split('\n');
      return [before.length, before[before.length - 1].length + 1];
    };
    const fail = (message, index = at) => { const [line, column] = position(index); throw new TomlError(message, line, column); };
    const peek = (offset = 0) => text[at + offset];
    const startsWith = (value) => text.startsWith(value, at);

    // Table bookkeeping: how each table and array came to exist.
    const kind = new WeakMap(); // table → 'implicit' | 'header' | 'dotted' | 'inline'
    const tablesArrays = new WeakSet(); // arrays made by [[...]]
    const isTable = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof TomlDate);

    function newTable(how) {
      const table = Object.create(null);
      kind.set(table, how);
      return table;
    }

    const root = newTable('header');

    function skipSpace() { while (peek() === ' ' || peek() === '\t') at += 1; }
    function skipComment() {
      if (peek() !== '#') return;
      while (at < text.length && peek() !== '\n') {
        const code = text.charCodeAt(at);
        if ((code < 0x20 && code !== 0x09 && code !== 0x0d) || code === 0x7f) fail('Control characters are not allowed in comments.');
        if (code === 0x0d && text[at + 1] !== '\n') fail('A carriage return must be followed by a line feed.');
        at += 1;
      }
    }
    function newline() {
      if (startsWith('\r\n')) { at += 2; return true; }
      if (peek() === '\n') { at += 1; return true; }
      return false;
    }
    function endOfLine() {
      skipSpace();
      skipComment();
      if (at < text.length && !newline()) fail('Expected the end of the line.');
    }
    // Whitespace, comments and newlines, as allowed inside arrays.
    function skipArraySpace() {
      for (;;) {
        skipSpace();
        skipComment();
        if (!newline()) return;
      }
    }

    /* Strings */

    function checkChar(code, multiline) {
      if (code === 0x09) return;
      if (multiline && (code === 0x0a)) return;
      if (code < 0x20 || code === 0x7f) fail('Control characters must be escaped in strings.');
    }

    function escape() {
      const char = peek(1);
      const simple = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' };
      if (char in simple) { at += 2; return simple[char]; }
      if (char === 'u' || char === 'U') {
        const length = char === 'u' ? 4 : 8;
        const hex = text.slice(at + 2, at + 2 + length);
        if (!new RegExp(`^[0-9A-Fa-f]{${length}}$`).test(hex)) fail('Bad unicode escape.');
        const code = parseInt(hex, 16);
        if (code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) fail('The escape is not a Unicode scalar value.');
        at += 2 + length;
        return String.fromCodePoint(code);
      }
      return fail('Unknown escape in a string.');
    }

    function basicString() {
      at += 1;
      let out = '';
      for (;;) {
        if (at >= text.length || peek() === '\n' || (peek() === '\r')) fail('A string is not closed on its line.');
        const char = peek();
        if (char === '"') { at += 1; return out; }
        if (char === '\\') { out += escape(); continue; }
        checkChar(text.charCodeAt(at), false);
        out += char;
        at += 1;
      }
    }

    function literalString() {
      at += 1;
      const start = at;
      for (;;) {
        if (at >= text.length || peek() === '\n' || peek() === '\r') fail('A string is not closed on its line.');
        if (peek() === "'") { const out = text.slice(start, at); at += 1; return out; }
        checkChar(text.charCodeAt(at), false);
        at += 1;
      }
    }

    function multilineString(quote) {
      at += 3;
      newline(); // a newline right after the opening quotes is trimmed
      let out = '';
      for (;;) {
        if (at >= text.length) fail('A multi-line string is not closed.');
        if (startsWith(quote.repeat(3))) {
          // Up to two more quotes right before the closing ones belong to the string.
          let extra = 0;
          while (extra < 2 && text[at + 3 + extra] === quote) extra += 1;
          out += quote.repeat(extra);
          at += 3 + extra;
          return out;
        }
        const char = peek();
        if (quote === '"' && char === '\\') {
          // A backslash at the end of a line trims the newline and the whitespace after it.
          const rest = text.slice(at + 1).match(/^[ \t]*\r?\n/);
          if (rest) {
            at += 1 + rest[0].length;
            while (/[ \t\r\n]/.test(peek() || '')) {
              if (peek() === '\r' && text[at + 1] !== '\n') fail('A carriage return must be followed by a line feed.');
              at += 1;
            }
            continue;
          }
          out += escape();
          continue;
        }
        if (startsWith('\r\n')) { out += '\n'; at += 2; continue; }
        checkChar(text.charCodeAt(at), true);
        out += char;
        at += 1;
      }
    }

    /* Keys */

    function simpleKey() {
      const char = peek();
      if (char === '"') { if (startsWith('"""')) fail('A key cannot be a multi-line string.'); return basicString(); }
      if (char === "'") { if (startsWith("'''")) fail('A key cannot be a multi-line string.'); return literalString(); }
      const start = at;
      while (/[A-Za-z0-9_-]/.test(peek() || '')) at += 1;
      if (at === start) fail('Expected a key.');
      return text.slice(start, at);
    }

    function dottedKey() {
      const keys = [simpleKey()];
      for (;;) {
        skipSpace();
        if (peek() !== '.') return keys;
        at += 1;
        skipSpace();
        keys.push(simpleKey());
      }
    }

    /* Values */

    const DIGITS = { '0x': /^[0-9A-Fa-f](?:_?[0-9A-Fa-f])*/, '0o': /^[0-7](?:_?[0-7])*/, '0b': /^[01](?:_?[01])*/ };
    const INT_MAX = 9223372036854775807n;
    const INT_MIN = -9223372036854775808n;

    function daysIn(year, month) {
      return [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    }

    function dateTime() {
      const rest = text.slice(at);
      const date = rest.match(/^(\d{4})-(\d{2})-(\d{2})/);
      const time = (from) => from.match(/^(\d{2}):(\d{2}):(\d{2})(\.\d+)?/);
      const checkTime = (match, index) => {
        if (Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3]) > 60) fail('The time is out of range.', index);
      };
      if (date) {
        const [whole, year, month, day] = date;
        if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > daysIn(Number(year), Number(month))) fail('The date does not exist.');
        const after = rest.slice(whole.length);
        const separator = after.match(/^[Tt ]/);
        const clock = separator ? time(after.slice(1)) : null;
        if (separator && after[0] === ' ' && !clock) {
          at += whole.length;
          return new TomlDate('local-date', whole);
        }
        if (separator && !clock) fail('Expected a time after the date.');
        if (!clock) { at += whole.length; return new TomlDate('local-date', whole); }
        checkTime(clock, at + whole.length + 1);
        let used = whole.length + 1 + clock[0].length;
        const zone = rest.slice(used).match(/^(?:[Zz]|([+-])(\d{2}):(\d{2}))/);
        if (zone) {
          if (zone[2] && (Number(zone[2]) > 23 || Number(zone[3]) > 59)) fail('The time offset is out of range.');
          used += zone[0].length;
          at += used;
          return new TomlDate('offset-datetime', rest.slice(0, used).replace(/^(.{10})[t ]/, '$1T').replace(/z$/, 'Z'));
        }
        at += used;
        return new TomlDate('local-datetime', rest.slice(0, used).replace(/^(.{10})[t ]/, '$1T'));
      }
      const clock = time(rest);
      if (clock) {
        checkTime(clock, at);
        at += clock[0].length;
        return new TomlDate('local-time', clock[0]);
      }
      return null;
    }

    function number() {
      const rest = text.slice(at);
      const special = rest.match(/^([+-])?(inf|nan)/);
      if (special) {
        at += special[0].length;
        return special[2] === 'nan' ? NaN : (special[1] === '-' ? -Infinity : Infinity);
      }
      const prefix = rest.slice(0, 2);
      if (DIGITS[prefix]) {
        const digits = rest.slice(2).match(DIGITS[prefix]);
        if (!digits) fail('Expected digits after the prefix.');
        at += 2 + digits[0].length;
        const value = BigInt(prefix + digits[0].replace(/_/g, ''));
        if (value > INT_MAX) fail('The integer does not fit in 64 bits.');
        return value;
      }
      const match = rest.match(/^[+-]?(?:0|[1-9](?:_?\d)*)(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?/);
      if (!match) return null;
      const raw = match[0];
      if (/^[+-]?0\d/.test(rest)) fail('Leading zeros are not allowed in numbers.');
      at += raw.length;
      const clean = raw.replace(/_/g, '');
      if (/[.eE]/.test(raw)) return Number(clean);
      const value = BigInt(clean);
      if (value > INT_MAX || value < INT_MIN) fail('The integer does not fit in 64 bits.');
      return value;
    }

    function array() {
      at += 1;
      const items = [];
      for (;;) {
        skipArraySpace();
        if (peek() === ']') { at += 1; return items; }
        items.push(value());
        skipArraySpace();
        if (peek() === ',') { at += 1; continue; }
        if (peek() === ']') { at += 1; return items; }
        fail('Expected “,” or “]” in the array.');
      }
    }

    function inlineTable() {
      at += 1;
      const table = newTable('inline');
      skipSpace();
      if (peek() === '}') { at += 1; return table; }
      for (;;) {
        skipSpace();
        if (peek() === '\n' || peek() === '\r') fail('Inline tables must stay on one line.');
        const keys = dottedKey();
        skipSpace();
        if (peek() !== '=') fail('Expected “=” after the key.');
        at += 1;
        skipSpace();
        assign(table, keys, value(), true);
        skipSpace();
        if (peek() === ',') {
          at += 1;
          skipSpace();
          if (peek() === '}') fail('Inline tables cannot end with a comma.');
          continue;
        }
        if (peek() === '}') { at += 1; break; }
        fail('Expected “,” or “}” in the inline table.');
      }
      freeze(table);
      return table;
    }

    // Everything inside an inline table is closed for later changes.
    function freeze(table) {
      kind.set(table, 'inline');
      for (const item of Object.values(table)) {
        if (isTable(item)) freeze(item);
        if (Array.isArray(item)) item.forEach((entry) => { if (isTable(entry)) freeze(entry); });
      }
    }

    function value() {
      const char = peek();
      if (char === undefined) fail('Expected a value.');
      if (startsWith('"""')) return multilineString('"');
      if (startsWith("'''")) return multilineString("'");
      if (char === '"') return basicString();
      if (char === "'") return literalString();
      if (startsWith('true') && !/[A-Za-z0-9_-]/.test(text[at + 4] || '')) { at += 4; return true; }
      if (startsWith('false') && !/[A-Za-z0-9_-]/.test(text[at + 5] || '')) { at += 5; return false; }
      if (char === '[') return array();
      if (char === '{') return inlineTable();
      const date = dateTime();
      if (date) return date;
      const num = number();
      if (num !== null) return num;
      return fail('Expected a value.');
    }

    /* Tables */

    function assign(table, keys, item, insideInline) {
      let node = table;
      for (const key of keys.slice(0, -1)) {
        if (!(key in node)) {
          const child = newTable(insideInline ? 'inline-building' : 'dotted');
          node[key] = child;
          node = child;
          continue;
        }
        const existing = node[key];
        const how = isTable(existing) ? kind.get(existing) : null;
        if (!isTable(existing) || how === 'inline' || how === 'header' || (how === 'implicit' && !insideInline)) fail(`Cannot add keys to “${key}” here: it is already defined.`);
        node = existing;
      }
      const last = keys[keys.length - 1];
      if (last in node) fail(`The key “${last}” is defined twice.`);
      node[last] = item;
    }

    function header(arrayOfTables) {
      at += arrayOfTables ? 2 : 1;
      skipSpace();
      const keys = dottedKey();
      skipSpace();
      if (!startsWith(arrayOfTables ? ']]' : ']')) fail(arrayOfTables ? 'Expected “]]”.' : 'Expected “]”.');
      at += arrayOfTables ? 2 : 1;
      let node = root;
      for (const key of keys.slice(0, -1)) {
        if (!(key in node)) { node[key] = newTable('implicit'); node = node[key]; continue; }
        let existing = node[key];
        if (Array.isArray(existing)) {
          if (!tablesArrays.has(existing)) fail(`“${key}” is an array, not a table.`);
          existing = existing[existing.length - 1];
        }
        if (!isTable(existing) || kind.get(existing) === 'inline') fail(`“${key}” cannot be extended.`);
        node = existing;
      }
      const last = keys[keys.length - 1];
      if (arrayOfTables) {
        const table = newTable('header');
        if (!(last in node)) {
          const list = [table];
          tablesArrays.add(list);
          node[last] = list;
        } else if (Array.isArray(node[last]) && tablesArrays.has(node[last])) {
          node[last].push(table);
        } else {
          fail(`“${last}” is already defined and is not an array of tables.`);
        }
        return table;
      }
      if (!(last in node)) { node[last] = newTable('header'); return node[last]; }
      const existing = node[last];
      if (isTable(existing) && kind.get(existing) === 'implicit') { kind.set(existing, 'header'); return existing; }
      return fail(`The table “${keys.join('.')}” is defined twice.`);
    }

    let current = root;
    while (at < text.length) {
      skipSpace();
      skipComment();
      if (newline()) continue;
      if (at >= text.length) break;
      if (startsWith('[[')) current = header(true);
      else if (peek() === '[') current = header(false);
      else {
        const start = at;
        const keys = dottedKey();
        skipSpace();
        if (peek() !== '=') fail('Expected “=” after the key.', at);
        at += 1;
        skipSpace();
        const item = value();
        try {
          assign(current, keys, item, false);
        } catch (error) {
          if (error instanceof TomlError) { const [line, column] = position(start); error.line = line; error.column = column; }
          throw error;
        }
      }
      endOfLine();
    }
    return root;
  }

  /* ── Value → JSON ───────────────────────────────────────────── */

  // JSON text with 64-bit integers written in full and dates as strings.
  function toJson(value, indent = '') {
    const next = `${indent}  `;
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'number') {
      if (Number.isNaN(value)) return '"nan"';
      if (!Number.isFinite(value)) return value > 0 ? '"inf"' : '"-inf"';
      return Number.isInteger(value) ? `${value}.0`.replace(/e\+?(\d+)\.0$/, 'e$1') : JSON.stringify(value);
    }
    if (value instanceof TomlDate) return JSON.stringify(value.text);
    if (Array.isArray(value)) {
      if (!value.length) return '[]';
      return `[\n${value.map((item) => next + toJson(item, next)).join(',\n')}\n${indent}]`;
    }
    if (value !== null && typeof value === 'object') {
      const keys = Object.keys(value);
      if (!keys.length) return '{}';
      return `{\n${keys.map((key) => `${next}${JSON.stringify(key)}: ${toJson(value[key], next)}`).join(',\n')}\n${indent}}`;
    }
    return JSON.stringify(value);
  }

  /* ── JSON → TOML ────────────────────────────────────────────── */

  const bareKey = (key) => (/^[A-Za-z0-9_-]+$/.test(key) ? key : tomlString(key));
  function tomlString(value) {
    return `"${value.replace(/[\\"]/g, '\\$&').replace(/[\u0000-\u001f\u007f]/g, (char) => {
      const named = { '\b': '\\b', '\t': '\\t', '\n': '\\n', '\f': '\\f', '\r': '\\r' }[char];
      return named || `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
    })}"`;
  }

  const plainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isTableArray = (value) => Array.isArray(value) && value.length > 0 && value.every(plainObject);

  function inlineValue(value, path, options) {
    if (value === null) throw new TomlError(`TOML has no null (at ${path || 'the top'}).`);
    if (typeof value === 'string') return tomlString(value);
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') {
      if (Number.isInteger(value) && Math.abs(value) < 2 ** 63) return String(value);
      const text = String(value);
      return /[.eE]/.test(text) ? text : `${text}.0`;
    }
    if (Array.isArray(value)) {
      const items = value.filter((item) => !(options.skipNulls && item === null));
      return `[${items.map((item, index) => inlineValue(item, `${path}[${index}]`, options)).join(', ')}]`;
    }
    const entries = Object.entries(value).filter(([, item]) => !(options.skipNulls && item === null));
    return entries.length ? `{ ${entries.map(([key, item]) => `${bareKey(key)} = ${inlineValue(item, `${path}.${key}`, options)}`).join(', ')} }` : '{}';
  }

  function stringify(value, options = {}) {
    if (!plainObject(value)) throw new TomlError('A TOML document must be a JSON object at the top.');
    const out = [];
    function section(table, path) {
      const entries = Object.entries(table).filter(([, item]) => !(options.skipNulls && item === null));
      const simple = entries.filter(([, item]) => !plainObject(item) && !isTableArray(item));
      const tables = entries.filter(([, item]) => plainObject(item));
      const arrays = entries.filter(([, item]) => isTableArray(item));
      for (const [key, item] of simple) out.push(`${bareKey(key)} = ${inlineValue(item, [...path, key].join('.'), options)}`);
      for (const [key, item] of tables) {
        const childPath = [...path, bareKey(key)];
        const childSimple = Object.values(item).some((entry) => !plainObject(entry) && !isTableArray(entry));
        // A table with only sub-tables needs no header of its own.
        if (childSimple || !Object.keys(item).length) {
          if (out.length) out.push('');
          out.push(`[${childPath.join('.')}]`);
        }
        section(item, childPath);
      }
      for (const [key, list] of arrays) {
        const childPath = [...path, bareKey(key)];
        for (const item of list) {
          if (out.length) out.push('');
          out.push(`[[${childPath.join('.')}]]`);
          section(item, childPath);
        }
      }
    }
    section(value, []);
    return `${out.join('\n')}\n`;
  }

  /* ── Page ───────────────────────────────────────────────────── */

  const direction = () => document.querySelector('input[name="tjDirection"]:checked').value;

  function render() {
    errorEl.hidden = true;
    noteEl.textContent = '';
    const toJsonMode = direction() === 'toml';
    const source = leftEl.value;
    if (!source.trim()) { rightEl.value = ''; return; }
    try {
      if (toJsonMode) {
        const data = parse(source);
        rightEl.value = toJson(data);
        if (/"(-?inf|nan)"/.test(rightEl.value)) noteEl.textContent = t('JSON has no inf or nan; they are written as strings.');
      } else {
        let data;
        try { data = JSON.parse(source); } catch (error) { throw new TomlError(`${t('The JSON is not valid:')} ${error.message}`); }
        rightEl.value = stringify(data, { skipNulls: nullsEl.checked });
      }
    } catch (error) {
      if (!(error instanceof TomlError)) throw error;
      rightEl.value = '';
      errorEl.textContent = error.line ? `${t(error.message)} (${t('line')} ${error.line}, ${t('column')} ${error.column})` : t(error.message);
      errorEl.hidden = false;
    }
  }

  function setLabels() {
    const toJsonMode = direction() === 'toml';
    document.getElementById('tjLeftLabel').textContent = toJsonMode ? 'TOML' : 'JSON';
    document.getElementById('tjRightLabel').textContent = toJsonMode ? 'JSON' : 'TOML';
    document.getElementById('tjNullsOption').hidden = toJsonMode;
  }

  leftEl.addEventListener('input', render);
  nullsEl.addEventListener('change', render);
  document.querySelectorAll('input[name="tjDirection"]').forEach((radio) => radio.addEventListener('change', () => {
    // Switching direction carries the current result over as the new input.
    if (rightEl.value) leftEl.value = rightEl.value;
    setLabels();
    render();
  }));
  document.getElementById('tjCopy').addEventListener('click', () => {
    if (rightEl.value) copyToClipboard(rightEl.value, 'Result');
    else showToast(t('Nothing to copy.'), 'error');
  });

  // Exposed for the tests.
  window.ToolkitToml = Object.freeze({ parse, toJson, stringify, TomlDate });
  setLabels();
  render();
}());
