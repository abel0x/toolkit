(function initJsMinifier() {
  'use strict';
  const inputEl = document.getElementById('jsmin-input');
  const outputEl = document.getElementById('jsmin-output');
  const minifyBtn = document.getElementById('jsmin-btn');
  const copyBtn = document.getElementById('jsmin-copy');
  const savingsEl = document.getElementById('jsmin-savings');
  if (!inputEl) return;

  function minifyJs(code) {
    let result = '';
    let index = 0;
    // Keep token separators and every line terminator (automatic semicolon insertion).
    // Regex/division and template interpolation need a parser. Preserve that suffix
    // verbatim instead of guessing its grammar or executing any user-supplied code.
    while (index < code.length) {
      const character = code[index];
      if (character === '`' || (character === '/' && !['/', '*'].includes(code[index + 1]))) {
        return result + code.slice(index);
      }
      if (character === '"' || character === "'") {
        const start = index++;
        while (index < code.length) {
          const next = code[index++];
          if (next === '\\') index += 1;
          else if (next === character) break;
        }
        result += code.slice(start, index);
      } else if (code.startsWith('//', index)) {
        while (index < code.length && !/[\r\n\u2028\u2029]/u.test(code[index])) index += 1;
      } else if (code.startsWith('/*', index)) {
        const end = code.indexOf('*/', index + 2);
        if (end === -1) return result + code.slice(index);
        const comment = code.slice(index, end + 2);
        result += comment.startsWith('/*!') ? comment : (comment.match(/[\r\n\u2028\u2029]/gu) || [' ']).join('');
        index = end + 2;
      } else if (character === ' ' || character === '\t') {
        if (result && !/[ \t\r\n]$/.test(result)) result += ' ';
        while (code[index] === ' ' || code[index] === '\t') index += 1;
      } else {
        result += character;
        index += 1;
      }
    }
    return result.trim();
  }

  function minify() {
    const code = inputEl.value;
    if (!code.trim()) { showToast('Please enter JavaScript.', 'error'); return; }
    const origBytes = new TextEncoder().encode(code).length;
    try {
      const minified = minifyJs(code);
      outputEl.value = minified;
      const minBytes = new TextEncoder().encode(minified).length;
      const saved = origBytes - minBytes;
      const pct = origBytes > 0 ? ((saved / origBytes) * 100).toFixed(1) : 0;
      savingsEl.textContent = `${formatBytes(origBytes)} → ${formatBytes(minBytes)} · saved ${formatBytes(saved)} (${pct}%)`;
      savingsEl.style.display = 'block';
      showToast('JS minified (basic)!', 'success');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  minifyBtn.addEventListener('click', minify);
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'Minified JS');
    else showToast('Nothing to copy.', 'error');
  });
})();
