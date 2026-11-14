(function initJsonValidator() {
  'use strict';

  const inputEl = document.getElementById('jval-input');
  const schemaEl = document.getElementById('jval-schema');
  const validateBtn = document.getElementById('jval-btn');
  const resultEl = document.getElementById('jval-result');
  const badgeEl = document.getElementById('jval-badge');
  const msgEl = document.getElementById('jval-msg');
  const errorsEl = document.getElementById('jval-errors');
  if (!inputEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const MAX_ERRORS = 100;

  function getLineCol(str, pos) {
    const lines = str.substring(0, pos).split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
  }

  // Firefox names the line and column; Chrome and Safari give a position.
  function parseError(raw, error) {
    const posMatch = error.message.match(/position (\d+)/i);
    let message = error.message;
    if (posMatch && !/line \d+ column \d+/i.test(message)) {
      const { line, col } = getLineCol(raw, parseInt(posMatch[1], 10));
      message += ` (Line ${line}, Column ${col})`;
    }
    return message;
  }

  /* JSON Schema: the draft 2020-12 vocabulary most schemas use (and the
     draft-07 spellings definitions, items as an array, additionalItems,
     dependencies). Keywords it does not know are ignored, as the spec
     asks; $ref resolves within the same schema (#, #/$defs/..., $anchor). */
  function validateSchema(rootSchema, data) {
    const errors = [];
    const pointer = (path) => (path.length ? '/' + path.map((part) => String(part).replace(/~/g, '~0').replace(/\//g, '~1')).join('/') : '/');
    const report = (path, message) => { if (errors.length < MAX_ERRORS) errors.push({ path: pointer(path), message }); };
    const typeOf = (value) => (value === null ? 'null' : Array.isArray(value) ? 'array'
      : Number.isInteger(value) ? 'integer' : typeof value);
    const equal = (a, b) => {
      if (a === b) return true;
      if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      const keys = Object.keys(a);
      return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]));
    };
    const length = (text) => Array.from(text).length;
    const FORMATS = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      uri: /^[a-z][a-z\d+.-]*:[^\s]*$/i,
      'uri-reference': /^[^\s]*$/,
      uuid: /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i,
      date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
      time: /^([01]\d|2[0-3]):[0-5]\d:([0-5]\d|60)(\.\d+)?(z|[+-]([01]\d|2[0-3]):[0-5]\d)$/i,
      'date-time': /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])t([01]\d|2[0-3]):[0-5]\d:([0-5]\d|60)(\.\d+)?(z|[+-]([01]\d|2[0-3]):[0-5]\d)$/i,
      ipv4: /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
      hostname: /^(?=.{1,253}$)([a-z\d]([a-z\d-]{0,61}[a-z\d])?)(\.[a-z\d]([a-z\d-]{0,61}[a-z\d])?)*$/i
    };
    const anchors = new Map();
    (function collect(node) {
      if (!node || typeof node !== 'object') return;
      if (typeof node.$anchor === 'string') anchors.set(node.$anchor, node);
      Object.values(node).forEach(collect);
    }(rootSchema));
    function resolve(ref) {
      if (ref.startsWith('#') && !ref.startsWith('#/') && ref.length > 1) {
        if (anchors.has(ref.slice(1))) return anchors.get(ref.slice(1));
      } else if (ref === '#' || ref.startsWith('#/')) {
        let node = rootSchema;
        for (const part of ref.slice(2).split('/').filter(Boolean)) {
          const key = decodeURIComponent(part).replace(/~1/g, '/').replace(/~0/g, '~');
          if (!node || typeof node !== 'object' || !Object.hasOwn(node, key)) { node = undefined; break; }
          node = node[key];
        }
        if (node !== undefined) return node;
      }
      throw new Error(`The schema refers to ${ref}, which it does not contain.`);
    }

    // Returns true when valid; collects messages unless quiet.
    function check(schema, value, path, quiet, depth) {
      if (depth > 200) throw new Error('The schema refers to itself too deeply.');
      if (schema === true || schema === undefined) return true;
      if (schema === false) { if (!quiet) report(path, 'No value is allowed here.'); return false; }
      if (typeof schema !== 'object' || schema === null) return true;
      let valid = true;
      const fail = (message) => { valid = false; if (!quiet) report(path, message); };
      const sub = (subschema, subvalue, subpath) => check(subschema, subvalue, subpath, quiet, depth + 1);

      if (typeof schema.$ref === 'string' && !sub(resolve(schema.$ref), value, path)) valid = false;
      const type = typeOf(value);
      if (schema.type !== undefined) {
        const types = [].concat(schema.type);
        const ok = types.some((wanted) => wanted === type || (wanted === 'number' && type === 'integer'));
        if (!ok) fail(`Expected ${types.join(' or ')}, found ${type}.`);
      }
      if (schema.enum && !schema.enum.some((option) => equal(option, value))) fail(`Must be one of ${JSON.stringify(schema.enum)}.`);
      if (Object.hasOwn(schema, 'const') && !equal(schema.const, value)) fail(`Must be ${JSON.stringify(schema.const)}.`);

      if (typeof value === 'number') {
        if (typeof schema.minimum === 'number' && value < schema.minimum) fail(`Must be at least ${schema.minimum}.`);
        if (typeof schema.maximum === 'number' && value > schema.maximum) fail(`Must be at most ${schema.maximum}.`);
        if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) fail(`Must be more than ${schema.exclusiveMinimum}.`);
        if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) fail(`Must be less than ${schema.exclusiveMaximum}.`);
        if (typeof schema.multipleOf === 'number' && schema.multipleOf > 0) {
          const ratio = value / schema.multipleOf;
          if (Math.abs(ratio - Math.round(ratio)) > 1e-9) fail(`Must be a multiple of ${schema.multipleOf}.`);
        }
      }
      if (typeof value === 'string') {
        if (typeof schema.minLength === 'number' && length(value) < schema.minLength) fail(`Must be at least ${schema.minLength} characters long.`);
        if (typeof schema.maxLength === 'number' && length(value) > schema.maxLength) fail(`Must be at most ${schema.maxLength} characters long.`);
        if (typeof schema.pattern === 'string') {
          let pattern;
          try { pattern = new RegExp(schema.pattern, 'u'); } catch { throw new Error(`The schema pattern ${schema.pattern} is not a valid regular expression.`); }
          if (!pattern.test(value)) fail(`Must match the pattern ${schema.pattern}.`);
        }
        if (typeof schema.format === 'string' && FORMATS[schema.format] && !FORMATS[schema.format].test(value)) fail(`Is not a valid ${schema.format}.`);
      }
      if (Array.isArray(value)) {
        if (typeof schema.minItems === 'number' && value.length < schema.minItems) fail(`Must have at least ${schema.minItems} items.`);
        if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) fail(`Must have at most ${schema.maxItems} items.`);
        if (schema.uniqueItems === true) {
          for (let i = 0; i < value.length; i += 1) {
            if (value.slice(0, i).some((earlier) => equal(earlier, value[i]))) { fail(`Item ${i} repeats an earlier item.`); break; }
          }
        }
        const prefix = Array.isArray(schema.prefixItems) ? schema.prefixItems : Array.isArray(schema.items) ? schema.items : [];
        const rest = Array.isArray(schema.items) ? schema.additionalItems : schema.items;
        value.forEach((item, index) => {
          const itemSchema = index < prefix.length ? prefix[index] : rest;
          if (itemSchema !== undefined && !sub(itemSchema, item, path.concat(index))) valid = false;
        });
        if (schema.contains !== undefined) {
          const found = value.filter((item) => check(schema.contains, item, path, true, depth + 1)).length;
          const min = typeof schema.minContains === 'number' ? schema.minContains : 1;
          if (found < min) fail(`Must contain at least ${min} matching item${min === 1 ? '' : 's'}.`);
          if (typeof schema.maxContains === 'number' && found > schema.maxContains) fail(`Must contain at most ${schema.maxContains} matching items.`);
        }
      }
      if (type === 'object') {
        const keys = Object.keys(value);
        if (typeof schema.minProperties === 'number' && keys.length < schema.minProperties) fail(`Must have at least ${schema.minProperties} properties.`);
        if (typeof schema.maxProperties === 'number' && keys.length > schema.maxProperties) fail(`Must have at most ${schema.maxProperties} properties.`);
        (schema.required || []).forEach((key) => { if (!Object.hasOwn(value, key)) fail(`Missing required property "${key}".`); });
        const dependent = schema.dependentRequired || (schema.dependencies && Object.fromEntries(Object.entries(schema.dependencies).filter(([, v]) => Array.isArray(v))));
        Object.entries(dependent || {}).forEach(([key, needed]) => {
          if (Object.hasOwn(value, key)) needed.forEach((other) => { if (!Object.hasOwn(value, other)) fail(`"${key}" needs "${other}" too.`); });
        });
        const properties = schema.properties || {};
        const patterns = Object.entries(schema.patternProperties || {}).map(([source, subschema]) => [new RegExp(source, 'u'), subschema]);
        keys.forEach((key) => {
          let known = false;
          if (Object.hasOwn(properties, key)) { known = true; if (!sub(properties[key], value[key], path.concat(key))) valid = false; }
          patterns.forEach(([pattern, subschema]) => {
            if (pattern.test(key)) { known = true; if (!sub(subschema, value[key], path.concat(key))) valid = false; }
          });
          if (!known && schema.additionalProperties !== undefined) {
            if (schema.additionalProperties === false) fail(`Property "${key}" is not allowed.`);
            else if (!sub(schema.additionalProperties, value[key], path.concat(key))) valid = false;
          }
          if (schema.propertyNames !== undefined && !check(schema.propertyNames, key, path.concat(key), true, depth + 1)) fail(`Property name "${key}" is not allowed.`);
        });
      }
      if (Array.isArray(schema.allOf)) schema.allOf.forEach((part) => { if (!sub(part, value, path)) valid = false; });
      if (Array.isArray(schema.anyOf) && !schema.anyOf.some((part) => check(part, value, path, true, depth + 1))) fail('Matches none of the allowed schemas (anyOf).');
      if (Array.isArray(schema.oneOf)) {
        const matches = schema.oneOf.filter((part) => check(part, value, path, true, depth + 1)).length;
        if (matches !== 1) fail(matches ? `Matches ${matches} schemas; exactly one is allowed (oneOf).` : 'Matches none of the allowed schemas (oneOf).');
      }
      if (schema.not !== undefined && check(schema.not, value, path, true, depth + 1)) fail('Matches a schema it must not match (not).');
      if (schema.if !== undefined) {
        const branch = check(schema.if, value, path, true, depth + 1) ? schema.then : schema.else;
        if (branch !== undefined && !sub(branch, value, path)) valid = false;
      }
      return valid;
    }

    check(rootSchema, data, [], false, 0);
    return errors;
  }

  function showErrors(errors) {
    errorsEl.replaceChildren(...errors.map(({ path, message }) => {
      const item = document.createElement('li');
      const where = document.createElement('code');
      where.textContent = path;
      where.dataset.i18nSkip = '';
      item.append(where, ' ', t(message));
      return item;
    }));
    errorsEl.hidden = !errors.length;
  }

  function setBadge(valid, text) {
    badgeEl.className = valid ? 'status-badge valid' : 'status-badge invalid';
    badgeEl.textContent = t(text);
  }

  function validate() {
    const raw = inputEl.value.trim();
    if (!raw) { showToast(t('Please enter JSON to validate.'), 'error'); return; }
    resultEl.style.display = 'block';
    showErrors([]);
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      setBadge(false, 'Invalid JSON ✗');
      msgEl.textContent = parseError(raw, e);
      msgEl.style.color = 'var(--clr-error, #f87171)';
      return;
    }
    const schemaText = schemaEl ? schemaEl.value.trim() : '';
    if (!schemaText) {
      setBadge(true, 'Valid JSON ✓');
      msgEl.textContent = '';
      msgEl.style.color = '';
      return;
    }
    let schema;
    try {
      schema = JSON.parse(schemaText);
    } catch (e) {
      setBadge(false, 'The schema is not valid JSON ✗');
      msgEl.textContent = parseError(schemaText, e);
      msgEl.style.color = 'var(--clr-error, #f87171)';
      return;
    }
    let errors;
    try {
      errors = validateSchema(schema, data);
    } catch (e) {
      setBadge(false, 'The schema cannot be used ✗');
      msgEl.textContent = t(e.message);
      msgEl.style.color = 'var(--clr-error, #f87171)';
      return;
    }
    if (!errors.length) {
      setBadge(true, 'Valid JSON, matches the schema ✓');
      msgEl.textContent = '';
      msgEl.style.color = '';
      return;
    }
    setBadge(false, 'Valid JSON, does not match the schema ✗');
    msgEl.textContent = t(errors.length >= MAX_ERRORS ? `The first ${MAX_ERRORS} problems:` : `${errors.length} problem(s):`);
    msgEl.style.color = '';
    showErrors(errors);
  }

  validateBtn.addEventListener('click', validate);
  [inputEl, schemaEl].forEach((field) => field && field.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); validate(); }
  }));
})();
