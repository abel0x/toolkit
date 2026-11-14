(function initJsonMinifier() {
  const inputEl = document.getElementById('jmin-input');
  const outputEl = document.getElementById('jmin-output');
  const minifyBtn = document.getElementById('jmin-btn');
  const copyBtn = document.getElementById('jmin-copy');
  const savingsEl = document.getElementById('jmin-savings');
  const commentsEl = document.getElementById('jmin-comments');
  const asciiEl = document.getElementById('jmin-ascii');
  if (!inputEl) return;

  /* JSONC, as tsconfig.json and VS Code settings are written: // and
     /* *\/ comments and a comma before ] or } are removed outside strings,
     leaving JSON that JSON.parse checks as usual. */
  function stripJsonc(text) {
    let out = '';
    let index = 0;
    while (index < text.length) {
      const character = text[index];
      if (character === '"') {
        const start = index++;
        while (index < text.length && text[index] !== '"') index += text[index] === '\\' ? 2 : 1;
        index += 1;
        out += text.slice(start, index);
      } else if (text.startsWith('//', index)) {
        while (index < text.length && text[index] !== '\n') index += 1;
      } else if (text.startsWith('/*', index)) {
        const end = text.indexOf('*/', index + 2);
        index = end === -1 ? text.length : end + 2;
        out += ' ';
      } else {
        out += character;
        index += 1;
      }
    }
    return out.replace(/,(\s*[\]}])/g, '$1');
  }

  const escapeNonAscii = (json) => json.replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

  function minify() {
    const raw = inputEl.value.trim();
    if (!raw) { showToast('Please enter JSON to minify.', 'error'); return; }
    try {
      const parsed = JSON.parse(commentsEl && commentsEl.checked ? stripJsonc(raw) : raw);
      let minified = JSON.stringify(parsed);
      if (asciiEl && asciiEl.checked) minified = escapeNonAscii(minified);
      outputEl.value = minified;
      const origBytes = new TextEncoder().encode(raw).length;
      const minBytes = new TextEncoder().encode(minified).length;
      const saved = origBytes - minBytes;
      const pct = origBytes > 0 ? ((saved / origBytes) * 100).toFixed(1) : 0;
      savingsEl.textContent = `${formatBytes(origBytes)} → ${formatBytes(minBytes)} · saved ${formatBytes(saved)} (${pct}%)`;
      savingsEl.style.display = 'block';
      showToast('JSON minified!', 'success');
    } catch (e) {
      outputEl.value = '';
      savingsEl.style.display = 'none';
      showToast('Invalid JSON: ' + e.message, 'error');
    }
  }

  minifyBtn.addEventListener('click', minify);
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'Minified JSON');
    else showToast('Nothing to copy.', 'error');
  });
  inputEl.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); minify(); } });
})();
