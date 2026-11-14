(function initJsonValidator() {
  const inputEl = document.getElementById('jval-input');
  const validateBtn = document.getElementById('jval-btn');
  const resultEl = document.getElementById('jval-result');
  const badgeEl = document.getElementById('jval-badge');
  const msgEl = document.getElementById('jval-msg');
  if (!inputEl) return;

  function getLineCol(str, pos) {
    const lines = str.substring(0, pos).split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
  }

  function validate() {
    const raw = inputEl.value.trim();
    if (!raw) { showToast('Please enter JSON to validate.', 'error'); return; }
    try {
      JSON.parse(raw);
      badgeEl.className = 'status-badge valid';
      badgeEl.textContent = 'Valid JSON ✓';
      msgEl.textContent = '';
      msgEl.style.color = '';
    } catch (e) {
      badgeEl.className = 'status-badge invalid';
      badgeEl.textContent = 'Invalid JSON ✗';
      const posMatch = e.message.match(/position (\d+)/i);
      let msg = e.message;
      if (posMatch) {
        const pos = parseInt(posMatch[1], 10);
        const { line, col } = getLineCol(raw, pos);
        msg += ` (Line ${line}, Column ${col})`;
      }
      msgEl.textContent = msg;
      msgEl.style.color = 'var(--clr-error, #f87171)';
    }
    resultEl.style.display = 'block';
  }

  validateBtn.addEventListener('click', validate);
  inputEl.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); validate(); } });
})();
