(function initUrlBuilder() {
  'use strict';

  const baseUrlEl    = document.getElementById('ubBase');
  const pathRows     = document.getElementById('ubPathRows');
  const addPathBtn   = document.getElementById('ubAddPath');
  const paramRows    = document.getElementById('ubParamRows');
  const addParamBtn  = document.getElementById('ubAddParam');
  const hashEl       = document.getElementById('ubHash');
  const outputEl     = document.getElementById('ubOutput');

  if (!baseUrlEl) return;

  function addPathRow(val = '') {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;';
    row.innerHTML = `<input type="text" class="form-control font-mono ix-ee3d55" placeholder="segment" value="${escapeHTML(val)}" aria-label="Path segment" /><button class="btn btn-secondary ix-7f36cc" title="Remove" aria-label="Remove">✕</button>`;
    row.querySelector('button').addEventListener('click', () => { row.remove(); assemble(); });
    row.querySelector('input').addEventListener('input', assemble);
    pathRows.appendChild(row);
    assemble();
  }

  function addParamRow(k = '', v = '') {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;';
    row.innerHTML = `<input type="text" class="form-control font-mono ix-ee3d55" placeholder="key" value="${escapeHTML(k)}" aria-label="URL parameter name" /><input type="text" class="form-control font-mono ix-c2d2e2" placeholder="value" value="${escapeHTML(v)}" aria-label="URL parameter value" /><button class="btn btn-secondary ix-7f36cc" title="Remove" aria-label="Remove">✕</button>`;
    row.querySelector('button').addEventListener('click', () => { row.remove(); assemble(); });
    row.querySelectorAll('input').forEach(el => el.addEventListener('input', assemble));
    paramRows.appendChild(row);
    assemble();
  }

  // Percent-encode each path part (spaces, ?, # …) without double-encoding existing %XX escapes.
  function encodeSegment(segment) {
    return segment.split('/').map((part) => {
      let decoded = part;
      try { decoded = decodeURIComponent(part); } catch {}
      return encodeURIComponent(decoded);
    }).join('/');
  }

  function assemble() {
    let base = baseUrlEl.value.trim().replace(/\/+$/, '');
    const segments = [...pathRows.querySelectorAll('input')]
      .map(i => i.value.trim().replace(/^\/+|\/+$/g, ''))
      .filter(Boolean)
      .map(encodeSegment);
    const params = new URLSearchParams();
    paramRows.querySelectorAll('div').forEach(row => {
      const inputs = row.querySelectorAll('input');
      const k = inputs[0]?.value.trim(), v = inputs[1]?.value || '';
      if (k) params.append(k, v);
    });
    const hash = hashEl.value.trim();
    let url = base;
    if (segments.length) url += '/' + segments.join('/');
    if (params.toString()) url += '?' + params.toString();
    if (hash) url += '#' + hash;
    outputEl.value = url;
  }

  addPathBtn.addEventListener('click', () => addPathRow());
  addParamBtn.addEventListener('click', () => addParamRow());
  baseUrlEl.addEventListener('input', assemble);
  hashEl.addEventListener('input', assemble);
  document.getElementById('copyUbBtn').addEventListener('click', () => copyToClipboard(outputEl.value, 'URL'));

  addParamRow('utm_source', 'google');
  assemble();
})();
