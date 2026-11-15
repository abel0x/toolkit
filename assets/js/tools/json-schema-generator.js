/* TOOLKIT — assets/js/tools/json-schema-generator.js
   Infers a JSON Schema (draft 2020-12 or draft-07) from one or more sample
   documents: types, object properties and required keys, array items
   merged across elements, nullable values and common string formats. */
(function initJsonSchemaGenerator() {
  'use strict';

  const inputEl = document.getElementById('jsgInput');
  const outputEl = document.getElementById('jsgOutput');
  const errorEl = document.getElementById('jsgError');
  const draftEl = document.getElementById('jsgDraft');
  const requiredEl = document.getElementById('jsgRequired');
  const formatsEl = document.getElementById('jsgFormats');
  const strictEl = document.getElementById('jsgStrict');
  const samplesEl = document.getElementById('jsgSamples');
  const copyBtn = document.getElementById('jsgCopy');
  if (!inputEl || !outputEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  const DRAFTS = {
    '2020-12': 'https://json-schema.org/draft/2020-12/schema',
    '07': 'http://json-schema.org/draft-07/schema#'
  };

  // Checked in this order; the first match wins.
  const FORMATS = [
    ['date-time', /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/],
    ['date', /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/],
    ['time', /^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/],
    ['email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/],
    ['uuid', /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/],
    ['uri', /^[a-zA-Z][a-zA-Z\d+.-]*:\/\/[^\s]+$/],
    ['ipv4', /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/],
    ['ipv6', /^(?=.*:)[0-9a-fA-F:]+$/]
  ];

  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

  /* ── Inference ──────────────────────────────────────────────── */

  // A schema per sample value. Objects keep the order of their keys.
  function infer(value, options) {
    if (value === null) return { type: 'null' };
    if (Array.isArray(value)) {
      const schema = { type: 'array' };
      if (value.length) schema.items = value.map((item) => infer(item, options)).reduce((a, b) => merge(a, b, options));
      return schema;
    }
    if (isObject(value)) {
      const schema = { type: 'object', properties: {} };
      for (const key of Object.keys(value)) schema.properties[key] = infer(value[key], options);
      schema.required = Object.keys(value);
      return schema;
    }
    if (typeof value === 'boolean') return { type: 'boolean' };
    if (typeof value === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number' };
    const schema = { type: 'string' };
    if (options.formats) {
      const found = FORMATS.find(([, pattern]) => pattern.test(value));
      if (found) schema.format = found[0];
    }
    return schema;
  }

  const variants = (schema) => (schema.anyOf ? schema.anyOf : [schema]);
  const typeOf = (schema) => schema.type;

  // Two schemas for values seen at the same place → one schema for both.
  function merge(a, b, options) {
    const all = [...variants(a), ...variants(b)];
    const out = [];
    for (const schema of all) {
      const index = out.findIndex((existing) => sameKind(existing, schema));
      if (index === -1) out.push(schema);
      else out[index] = combine(out[index], schema, options);
    }
    return finish(out);
  }

  // integer and number are one kind (number wins).
  const kind = (schema) => (schema.type === 'integer' ? 'number' : schema.type);
  const sameKind = (a, b) => kind(a) === kind(b);

  function combine(a, b, options) {
    if (a.type === 'object') {
      const properties = { ...a.properties };
      for (const [key, schema] of Object.entries(b.properties)) {
        properties[key] = key in properties ? merge(properties[key], schema, options) : schema;
      }
      // Required: only keys that every sample had.
      const required = a.required.filter((key) => b.required.includes(key));
      return { type: 'object', properties, required };
    }
    if (a.type === 'array') {
      if (!a.items) return b;
      if (!b.items) return a;
      return { type: 'array', items: merge(a.items, b.items, options) };
    }
    if (kind(a) === 'number') return { type: a.type === 'number' || b.type === 'number' ? 'number' : 'integer' };
    if (a.type === 'string') return a.format && a.format === b.format ? { type: 'string', format: a.format } : { type: 'string' };
    return a;
  }

  // While merging, several kinds stay as a plain anyOf list.
  const finish = (list) => (list.length === 1 ? list[0] : { anyOf: list });

  // The final form: options applied, simple unions written as a "type" list,
  // a nullable object or array as type [kind, "null"], anything else anyOf.
  function polish(schema, options) {
    if (schema.anyOf) {
      const list = schema.anyOf;
      if (list.every((item) => Object.keys(item).length === 1)) return { type: list.map(typeOf) };
      const others = list.filter((item) => item.type !== 'null');
      if (others.length === 1) {
        const only = polish(others[0], options);
        return { ...only, type: [only.type, 'null'] };
      }
      return { anyOf: list.map((item) => polish(item, options)) };
    }
    const out = { ...schema };
    if (schema.type === 'object') {
      out.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, polish(value, options)]));
      if (options.required === 'all') out.required = Object.keys(out.properties);
      if (options.required === 'none' || !out.required.length) delete out.required;
      if (options.strict) out.additionalProperties = false;
    }
    if (schema.type === 'array' && schema.items) out.items = polish(schema.items, options);
    return out;
  }

  function generate(samples, options) {
    const schema = samples.map((sample) => infer(sample, options)).reduce((a, b) => merge(a, b, options));
    return { $schema: DRAFTS[options.draft], ...polish(schema, options) };
  }

  /* ── Page ───────────────────────────────────────────────────── */

  function options() {
    return { draft: draftEl.value, required: requiredEl.value, formats: formatsEl.checked, strict: strictEl.checked };
  }

  // Large inputs wait for a pause in typing; small ones update at once.
  const LARGE = 200000;
  let pending = 0;
  const later = (source, fn) => () => {
    clearTimeout(pending);
    if (source.value.length > LARGE) pending = setTimeout(fn, 200); else fn();
  };

  let parsed = { text: null, data: undefined, error: null };

  function render() {
    errorEl.hidden = true;
    const text = inputEl.value.trim();
    if (!text) { outputEl.value = ''; return; }
    let data;
    try {
      if (parsed.text !== text) {
        try { parsed = { text, data: JSON.parse(text), error: null }; } catch (error) { parsed = { text, data: undefined, error }; }
      }
      if (parsed.error) throw parsed.error;
      data = parsed.data;
    } catch (error) {
      errorEl.textContent = `${t('The JSON is not valid:')} ${error.message}`;
      errorEl.hidden = false;
      outputEl.value = '';
      return;
    }
    // A top-level array can be a list of samples of one document type.
    const samples = samplesEl.checked && Array.isArray(data) && data.length ? data : [data];
    outputEl.value = JSON.stringify(generate(samples, options()), null, 2);
  }

  inputEl.addEventListener('input', later(inputEl, render));
  [draftEl, requiredEl, formatsEl, strictEl, samplesEl].forEach((field) => field.addEventListener('change', render));
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'Schema');
    else showToast(t('Nothing to copy.'), 'error');
  });

  // Exposed for the tests.
  window.ToolkitJsonSchemaGenerator = Object.freeze({ generate });
  render();
}());
