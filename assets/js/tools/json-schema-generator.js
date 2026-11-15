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
    // Seen numbers and strings are remembered (as _min/_max and _values) for the range and enum options.
    if (typeof value === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number', _min: value, _max: value };
    const schema = { type: 'string', _values: [value], _count: 1 };
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
    if (kind(a) === 'number') {
      return { type: a.type === 'number' || b.type === 'number' ? 'number' : 'integer', _min: Math.min(a._min, b._min), _max: Math.max(a._max, b._max) };
    }
    if (a.type === 'string') {
      // Up to 50 different values are remembered; more cannot be an enum anyway.
      const values = a._values && b._values ? [...new Set([...a._values, ...b._values])] : null;
      const out = { type: 'string', _values: values && values.length <= 50 ? values : null, _count: a._count + b._count };
      if (a.format && a.format === b.format) out.format = a.format;
      return out;
    }
    return a;
  }

  // While merging, several kinds stay as a plain anyOf list.
  const finish = (list) => (list.length === 1 ? list[0] : { anyOf: list });

  // The final form: options applied, simple unions written as a "type" list,
  // a nullable object or array as type [kind, "null"], anything else anyOf.
  function polish(schema, options) {
    if (schema.anyOf) {
      const list = schema.anyOf.map((item) => polish(item, options));
      if (list.every((item) => Object.keys(item).length === 1)) return { type: list.map(typeOf) };
      const others = list.filter((item) => item.type !== 'null');
      if (others.length === 1 && list.length === 2) {
        // enum applies whatever the type, so a nullable enum must list null too.
        const only = others[0];
        return { ...only, type: [only.type, 'null'], ...(only.enum ? { enum: [...only.enum, null] } : {}) };
      }
      return { anyOf: list };
    }
    const { _values: values, _count: count, _min: min, _max: max, ...out } = schema;
    // An enum: a few different values that repeat, without a format such as email.
    if (options.enums && schema.type === 'string' && values && !out.format && count >= 3 && values.length <= 10 && values.length < count) {
      out.enum = values;
    }
    if (options.ranges && (schema.type === 'integer' || schema.type === 'number')) {
      out.minimum = min;
      out.maximum = max;
    }
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
    return { draft: draftEl.value, required: requiredEl.value, formats: formatsEl.checked, strict: strictEl.checked,
      enums: document.getElementById('jsgEnums').checked, ranges: document.getElementById('jsgRanges').checked };
  }

  // Large inputs wait for a pause in typing; small ones update at once.
  const LARGE = 200000;
  let pending = 0;
  const later = (source, fn) => () => {
    clearTimeout(pending);
    if (source.value.length > LARGE) pending = setTimeout(fn, 200); else fn();
  };

  let parsed = { text: null, data: undefined, error: null };

  // The JSON Validator opens with the first sample and the schema in the link's
  // fragment (never sent to a server); without the sample when the link would be too long.
  const encode = (values) => {
    let binary = '';
    new TextEncoder().encode(JSON.stringify(values)).forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  function linkToValidator(sample, schema) {
    const link = document.getElementById('jsgValidate');
    const note = document.getElementById('jsgValidateNote');
    let fragment = `#share=1.${encode([sample, schema])}`;
    if (fragment.length > 8000) fragment = `#share=1.${encode(['', schema])}`;
    const fits = fragment.length <= 8000;
    link.hidden = !fits;
    note.textContent = fits ? '' : t('The schema is too large to open by link; copy it into the JSON Validator.');
    if (fits) link.href = `json-validator.html${fragment}`;
  }

  function render() {
    errorEl.hidden = true;
    const text = inputEl.value.trim();
    if (!text) { outputEl.value = ''; document.getElementById('jsgValidate').hidden = true; return; }
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
    linkToValidator(JSON.stringify(samples[0], null, 2), outputEl.value);
  }

  inputEl.addEventListener('input', later(inputEl, render));
  [draftEl, requiredEl, formatsEl, strictEl, samplesEl, document.getElementById('jsgEnums'), document.getElementById('jsgRanges')].forEach((field) => field.addEventListener('change', render));
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'Schema');
    else showToast(t('Nothing to copy.'), 'error');
  });

  // Exposed for the tests.
  window.ToolkitJsonSchemaGenerator = Object.freeze({ generate });
  render();
}());
