/* TOOLKIT — assets/js/tools/json-formatter.js */
(function initJSONFormatter() {
  'use strict';

  const input       = document.getElementById('jsonInput');
  const output      = document.getElementById('jsonOutput');
  const errorEl     = document.getElementById('jsonError');
  const statusEl    = document.getElementById('jsonStatus');
  const beatifyBtn  = document.getElementById('jsonBeautifyBtn');
  const minifyBtn   = document.getElementById('jsonMinifyBtn');
  const validateBtn = document.getElementById('jsonValidateBtn');
  const copyBtn     = document.getElementById('jsonCopyBtn');
  const clearBtn    = document.getElementById('jsonClearBtn');
  const indentEl    = document.getElementById('jsonIndent');
  const treeWrap    = document.getElementById('jsonTreeWrap');
  const tree        = document.getElementById('jsonTree');
  const expandBtn   = document.getElementById('jsonExpandBtn');
  const collapseBtn = document.getElementById('jsonCollapseBtn');
  if (!input) return;

  // Levels open when the tree is drawn; deeper ones are drawn when opened.
  const OPEN_DEPTH = 2;
  // Children drawn at a time; "Show more" adds the next batch.
  const BATCH = 200;
  // "Expand all" stops after this many objects and arrays.
  const EXPAND_LIMIT = 2000;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  let parsed;
  let hasParsed = false;
  let lastMode = null;

  function clearState() {
    errorEl.hidden = true; errorEl.textContent = '';
    statusEl.hidden = true; statusEl.textContent = '';
    statusEl.className = 'status-badge';
  }

  // Returns { value } or null: 0, false, null and "" are valid JSON too.
  function parseJSON() {
    const raw = input.value.trim();
    if (!raw) { showToast(t('Please enter JSON to process'), 'error'); return null; }
    try {
      return { value: JSON.parse(raw) };
    } catch (e) {
      clearState();
      const msg = e.message.replace(/^JSON\.parse: /, '').replace(/^Unexpected token /, 'Unexpected token: ');
      errorEl.textContent = msg;
      errorEl.hidden = false;
      statusEl.textContent = '✕ Invalid JSON';
      statusEl.className = 'status-badge status-badge--invalid';
      statusEl.hidden = false;
      output.value = '';
      hasParsed = false;
      tree.replaceChildren();
      return null;
    }
  }

  function indent() {
    return indentEl.value === 'tab' ? '\t' : Number(indentEl.value) || 2;
  }

  function treeView() {
    return document.querySelector('input[name="jsonView"]:checked')?.value === 'tree';
  }

  function showValid(text, value) {
    clearState();
    output.value = text;
    parsed = value;
    hasParsed = true;
    statusEl.textContent = '✓ Valid JSON';
    statusEl.className = 'status-badge status-badge--valid';
    statusEl.hidden = false;
    if (treeView()) renderTree();
  }

  /* ── Tree ─────────────────────────────────────────────────── */

  function span(className, text) {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = text;
    return element;
  }

  function keyLabel(key) {
    if (key === null) return [];
    return typeof key === 'number'
      ? [span('json-index', String(key)), span('json-punct', ': ')]
      : [span('json-key', JSON.stringify(key)), span('json-punct', ': ')];
  }

  function primitive(value) {
    if (typeof value === 'string') return span('json-string', JSON.stringify(value));
    if (typeof value === 'number') return span('json-number', String(value));
    return span('json-literal', String(value));
  }

  function count(isArray, size) {
    return isArray ? `${size} item${size === 1 ? '' : 's'}` : `${size} key${size === 1 ? '' : 's'}`;
  }

  function entriesOf(value) {
    return Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);
  }

  function leaf(key, value, last) {
    const row = document.createElement('div');
    row.className = 'json-row';
    row.append(...keyLabel(key), primitive(value));
    if (!last) row.append(span('json-punct', ','));
    return row;
  }

  // Draw the next batch of a node's children, with "Show more" if any remain.
  function drawChildren(details) {
    const { value, depth } = details.jsonNode;
    const entries = details.jsonNode.entries || (details.jsonNode.entries = entriesOf(value));
    const body = details.querySelector(':scope > .json-children');
    body.querySelector(':scope > .json-more')?.remove();
    const from = details.jsonNode.drawn || 0;
    const to = Math.min(entries.length, from + BATCH);
    const fragment = document.createDocumentFragment();
    for (let index = from; index < to; index += 1) {
      const [key, child] = entries[index];
      fragment.append(node(key, child, depth + 1, index === entries.length - 1));
    }
    details.jsonNode.drawn = to;
    if (to < entries.length) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'btn btn--ghost btn--sm json-more';
      more.textContent = t(`Show ${Math.min(BATCH, entries.length - to)} more of ${entries.length - to}`);
      more.addEventListener('click', () => drawChildren(details));
      fragment.append(more);
    }
    body.append(fragment);
  }

  function node(key, value, depth, last) {
    if (value === null || typeof value !== 'object') return leaf(key, value, last);
    const isArray = Array.isArray(value);
    const size = isArray ? value.length : Object.keys(value).length;
    const [open, close] = isArray ? ['[', ']'] : ['{', '}'];
    if (!size) {
      const row = document.createElement('div');
      row.className = 'json-row';
      row.append(...keyLabel(key), span('json-punct', open + close + (last ? '' : ',')));
      return row;
    }

    const details = document.createElement('details');
    details.className = 'json-node';
    details.jsonNode = { value, depth };
    const summary = document.createElement('summary');
    summary.append(...keyLabel(key), span('json-punct', open),
      span('json-collapsed', `…${close}${last ? '' : ','}`),
      span('json-count', t(count(isArray, size))));
    const body = document.createElement('div');
    body.className = 'json-children';
    const end = document.createElement('div');
    end.className = 'json-row json-close';
    end.append(span('json-punct', close + (last ? '' : ',')));
    details.append(summary, body, end);
    details.addEventListener('toggle', () => {
      if (details.open && !details.jsonNode.drawn) drawChildren(details);
    });
    if (depth < OPEN_DEPTH) {
      details.open = true;
      drawChildren(details);
    }
    return details;
  }

  function renderTree() {
    if (!hasParsed) { tree.replaceChildren(); return; }
    tree.replaceChildren(node(null, parsed, 0, true));
  }

  function expandAll() {
    let opened = 0;
    const visit = (details) => {
      if (opened >= EXPAND_LIMIT) return;
      opened += 1;
      if (!details.jsonNode.drawn) drawChildren(details);
      details.open = true;
      details.querySelectorAll(':scope > .json-children > details.json-node').forEach(visit);
    };
    tree.querySelectorAll(':scope > details.json-node').forEach(visit);
    if (opened >= EXPAND_LIMIT) showToast(t(`Opened the first ${EXPAND_LIMIT} levels.`), 'success');
  }

  function collapseAll() {
    tree.querySelectorAll('details.json-node').forEach((details) => { details.open = false; });
    const root = tree.querySelector(':scope > details.json-node');
    if (root) root.open = true;
  }

  function applyView() {
    const showTree = treeView();
    output.hidden = showTree;
    treeWrap.hidden = !showTree;
    if (showTree) renderTree();
  }

  /* ── Actions ──────────────────────────────────────────────── */

  beatifyBtn.addEventListener('click', () => {
    const result = parseJSON(); if (!result) return;
    lastMode = 'beautify';
    showValid(JSON.stringify(result.value, null, indent()), result.value);
  });

  minifyBtn.addEventListener('click', () => {
    const result = parseJSON(); if (!result) return;
    lastMode = 'minify';
    showValid(JSON.stringify(result.value), result.value);
  });

  validateBtn.addEventListener('click', () => {
    const result = parseJSON(); if (!result) return;
    showValid(output.value || JSON.stringify(result.value, null, indent()), result.value);
    showToast(t('JSON is valid ✓'), 'success');
  });

  // A new indent re-formats beautified output at once.
  indentEl.addEventListener('change', () => {
    if (lastMode === 'beautify' && hasParsed) output.value = JSON.stringify(parsed, null, indent());
  });

  document.querySelectorAll('input[name="jsonView"]').forEach((radio) => radio.addEventListener('change', applyView));
  expandBtn.addEventListener('click', expandAll);
  collapseBtn.addEventListener('click', collapseAll);

  copyBtn.addEventListener('click', () => copyToClipboard(output.value, 'JSON'));
  clearBtn.addEventListener('click', () => {
    input.value = '';
    output.value = '';
    hasParsed = false;
    lastMode = null;
    tree.replaceChildren();
    clearState();
  });

  input.addEventListener('keydown', e => { if ((e.ctrlKey||e.metaKey) && e.key==='Enter') { beatifyBtn.click(); e.preventDefault(); } });

  // Browsers may restore the chosen view on reload or back navigation.
  applyView();
  window.addEventListener('pageshow', applyView);
})();
