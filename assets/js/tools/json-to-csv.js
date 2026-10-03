(function initJsonToCsv() {
  'use strict';
  const inputEl = document.getElementById('j2csv-input');
  const outputEl = document.getElementById('j2csv-output');
  const convertBtn = document.getElementById('j2csv-btn');
  const copyBtn = document.getElementById('j2csv-copy');
  const downloadBtn = document.getElementById('j2csv-download');
  if (!inputEl) return;

  function escCsv(val) {
    const s = (val === null || val === undefined) ? '' :
      (typeof val === 'object' ? JSON.stringify(val) : String(val));
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function convert() {
    outputEl.value = '';
    const raw = inputEl.value.trim();
    if (!raw) { showToast('Please enter JSON.', 'error'); return; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { showToast('Invalid JSON: ' + e.message, 'error'); return; }
    if (!Array.isArray(parsed) || parsed.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
      showToast('JSON must be an array of objects.', 'error');
      return;
    }
    if (parsed.length === 0) { showToast('Array is empty.', 'error'); return; }

    const headersSet = new Set();
    parsed.forEach(row => { if (typeof row === 'object' && row !== null) Object.keys(row).forEach(k => headersSet.add(k)); });
    const headers = Array.from(headersSet);

    const rows = [headers.map(escCsv).join(',')];
    parsed.forEach(row => {
      rows.push(headers.map(h => escCsv(row[h])).join(','));
    });

    outputEl.value = rows.join('\n');
    showToast('Converted to CSV!', 'success');
  }

  convertBtn.addEventListener('click', convert);
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'CSV');
    else showToast('Nothing to copy.', 'error');
  });
  downloadBtn.addEventListener('click', () => {
    if (!outputEl.value) { showToast('Nothing to download.', 'error'); return; }
    const blob = new Blob([outputEl.value], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'data.csv'; a.click();
    URL.revokeObjectURL(url);
  });
})();
