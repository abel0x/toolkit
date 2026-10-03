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
      parseTable.innerHTML = '<p style="color:rgba(255,255,255,.4);font-size:.875rem;">No parameters found.</p>';
      return;
    }
    let html = '<table style="width:100%;border-collapse:collapse;font-size:.875rem;">';
    html += '<thead><tr><th style="text-align:left;padding:.35rem .6rem;border-bottom:1px solid rgba(255,255,255,.1);">#</th><th style="padding:.35rem .6rem;border-bottom:1px solid rgba(255,255,255,.1);text-align:left;">Key</th><th style="padding:.35rem .6rem;border-bottom:1px solid rgba(255,255,255,.1);text-align:left;">Value</th></tr></thead><tbody>';
    params.forEach(([k,v], i) => {
      html += `<tr><td style="padding:.3rem .6rem;opacity:.4;">${i+1}</td><td class="font-mono" style="padding:.3rem .6rem;color:var(--accent-cyan,#00d4ff);" data-i18n-skip>${escapeHTML(k)}</td><td class="font-mono" style="padding:.3rem .6rem;word-break:break-all;" data-i18n-skip>${escapeHTML(v)}</td></tr>`;
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
      <input type="text" class="form-control font-mono" placeholder="key" value="${escapeHTML(k)}" style="flex:1;" />
      <input type="text" class="form-control font-mono" placeholder="value" value="${escapeHTML(v)}" style="flex:2;" />
      <button class="btn btn-secondary" style="padding:.3rem .6rem;flex-shrink:0;" title="Remove">✕</button>
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
