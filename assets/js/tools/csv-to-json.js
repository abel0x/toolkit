(function initCsvToJson() {
  const inputEl = document.getElementById('csv2j-input');
  const outputEl = document.getElementById('csv2j-output');
  const convertBtn = document.getElementById('csv2j-btn');
  const copyBtn = document.getElementById('csv2j-copy');
  const indentSel = document.getElementById('csv2j-indent');
  const delimiterSel = document.getElementById('csv2j-delimiter');
  if (!inputEl) return;

  // The delimiter that appears most often in the first line, outside quotes.
  // Excel in Turkish (and many European locales) writes ";".
  function detectDelimiter(text) {
    const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
    let inQuotes = false;
    for (const c of text) {
      if (c === '"') inQuotes = !inQuotes;
      else if (!inQuotes && (c === '\n' || c === '\r')) break;
      else if (!inQuotes && c in counts) counts[c] += 1;
    }
    return Object.keys(counts).reduce((best, key) => (counts[key] > counts[best] ? key : best), ',');
  }

  function parseCsv(text, delimiter) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') { field += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { field += c; }
      } else {
        if (c === '"') { inQuotes = true; }
        else if (c === delimiter) { row.push(field); field = ''; }
        else if (c === '\r' && next === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
        else if (c === '\n' || c === '\r') { row.push(field); rows.push(row); row = []; field = ''; }
        else { field += c; }
      }
    }
    row.push(field);
    if (row.some(f => f !== '')) rows.push(row);
    return rows;
  }

  function convert() {
    const raw = inputEl.value.replace(/^\uFEFF/, '').trim();
    if (!raw) { showToast('Please enter CSV.', 'error'); return; }
    try {
      const chosen = delimiterSel ? delimiterSel.value : 'auto';
      const delimiter = chosen === 'auto' ? detectDelimiter(raw) : chosen === 'tab' ? '\t' : chosen;
      const rows = parseCsv(raw, delimiter);
      if (rows.length < 2) { showToast('CSV needs at least a header and one data row.', 'error'); return; }
      const headers = rows[0];
      const result = rows.slice(1).map(row => {
        const obj = Object.create(null);
        headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
        return obj;
      });
      const indent = parseInt(indentSel ? indentSel.value : '2', 10);
      outputEl.value = JSON.stringify(result, null, indent);
      showToast('Converted to JSON!', 'success');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  convertBtn.addEventListener('click', convert);
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'JSON');
    else showToast('Nothing to copy.', 'error');
  });
})();
