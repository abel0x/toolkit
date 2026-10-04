(function initQueryString() {
  'use strict';

  const tabs = document.querySelectorAll('[data-qs-tab]');
  const panels = document.querySelectorAll('[data-qs-panel]');
  const parseInput  = document.getElementById('qsParseInput');
  const parseTable  = document.getElementById('qsParseTable');
  const parseJsonBtn = document.getElementById('qsParseJson');
  const buildRows   = document.getElementById('qsBuildRows');
  const buildOutput = document.getElementById('qsBuildOutput');
  const addRowBtn   = document.getElementById('qsAddRow');

  if (!parseInput) return;

  function switchTab(name) {
    tabs.forEach(t => t.classList.toggle('btn-primary', t.dataset.qsTab === name));
    panels.forEach(p => { p.hidden = p.dataset.qsPanel !== name; });
  }

  tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.qsTab)));
  switchTab('parse');

  // Parse mode
  function parseQs() {
    let raw = parseInput.value.trim();
    if (!raw) { parseTable.innerHTML = ''; return; }
    if (!raw.startsWith('?')) raw = '?' + raw;
    const params = [...new URLSearchParams(raw).entries()];
    if (!params.length) {
      parseTable.innerHTML = '<p class="ix-45f28c">No parameters found.</p>';
      return;
    }
    let html = '<table class="ix-c2b3a0">';
    html += '<thead><tr><th class="ix-adfc2e">#</th><th class="ix-45805d">Key</th><th class="ix-45805d">Value</th></tr></thead><tbody>';
    params.forEach(([k,v], i) => {
      html += `<tr><td class="ix-7a19e8">${i+1}</td><td class="font-mono ix-983f3e" data-i18n-skip>${escapeHTML(k)}</td><td class="font-mono ix-8102c2" data-i18n-skip>${escapeHTML(v)}</td></tr>`;
    });
    html += '</tbody></table>';
    parseTable.innerHTML = html;
    if (parseJsonBtn) {
      parseJsonBtn.onclick = () => copyToClipboard(JSON.stringify(Object.fromEntries(params), null, 2), 'JSON');
    }
  }

  parseInput.addEventListener('input', parseQs);

  // Build mode
  function addRow(k='', v='') {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;';
    row.innerHTML = `
      <input type="text" class="form-control font-mono ix-ee3d55" placeholder="key" value="${escapeHTML(k)}" />
      <input type="text" class="form-control font-mono ix-c2d2e2" placeholder="value" value="${escapeHTML(v)}" />
      <button class="btn btn-secondary ix-7f36cc" title="Remove">✕</button>
    `;
    row.querySelector('button').addEventListener('click', () => { row.remove(); buildQs(); });
    row.querySelectorAll('input').forEach(el => el.addEventListener('input', buildQs));
    buildRows.appendChild(row);
    buildQs();
  }

  function buildQs() {
    const rows = buildRows.querySelectorAll('div');
    const params = new URLSearchParams();
    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const k = inputs[0].value.trim(), v = inputs[1].value;
      if (k) params.append(k, v);
    });
    buildOutput.value = params.toString() ? '?' + params.toString() : '';
  }

  addRowBtn.addEventListener('click', () => addRow());
  document.getElementById('copyBuildBtn').addEventListener('click', () => copyToClipboard(buildOutput.value, 'Query string'));

  // Init
  addRow('key', 'value');
})();
