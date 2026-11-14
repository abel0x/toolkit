(function initJsonMinifier() {
  const inputEl = document.getElementById('jmin-input');
  const outputEl = document.getElementById('jmin-output');
  const minifyBtn = document.getElementById('jmin-btn');
  const copyBtn = document.getElementById('jmin-copy');
  const savingsEl = document.getElementById('jmin-savings');
  if (!inputEl) return;

  function minify() {
    const raw = inputEl.value.trim();
    if (!raw) { showToast('Please enter JSON to minify.', 'error'); return; }
    try {
      const parsed = JSON.parse(raw);
      const minified = JSON.stringify(parsed);
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
