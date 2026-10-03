(function initCssMinifier() {
  'use strict';
  const inputEl = document.getElementById('cssmin-input');
  const outputEl = document.getElementById('cssmin-output');
  const minifyBtn = document.getElementById('cssmin-btn');
  const copyBtn = document.getElementById('cssmin-copy');
  const savingsEl = document.getElementById('cssmin-savings');
  if (!inputEl) return;

  function compactCss(source) {
    let result = '';
    let index = 0;
    while (index < source.length) {
      const character = source[index];
      // Custom properties and URLs can contain arbitrary token sequences. Keep
      // that suffix intact; reducing it safely would require a full CSS parser.
      if (source.startsWith('--', index) || /^url\(/i.test(source.slice(index, index + 4))) {
        return result + source.slice(index);
      }
      if (character === '"' || character === "'") {
        const start = index++;
        while (index < source.length) {
          const next = source[index++];
          if (next === '\\') index += 1;
          else if (next === character) break;
        }
        result += source.slice(start, index);
      } else if (character === '\\') {
        // A CSS hexadecimal escape consumes an optional whitespace terminator.
        const escape = source.slice(index).match(/^\\(?:[\da-f]{1,6}(?:\r\n|[ \t\r\n\f])?|[\s\S])/i);
        const token = escape ? escape[0] : character;
        result += token;
        index += token.length;
      } else if (source.startsWith('/*', index)) {
        const end = source.indexOf('*/', index + 2);
        if (end === -1) return result + source.slice(index);
        const comment = source.slice(index, end + 2);
        // Keep comments between adjacent tokens: removing them can merge tokens.
        const separated = /[\s{};:,]/.test(source[index - 1] || ' ') || /[\s{};:,]/.test(source[end + 2] || ' ');
        if (comment.startsWith('/*!') || !separated) result += comment;
        index = end + 2;
      } else if (/[ \t\r\n\f]/.test(character)) {
        if (result && !/[ \t\r\n\f]$/.test(result)) result += ' ';
        index += 1;
      } else {
        result += character;
        index += 1;
      }
    }
    return result;
  }

  function minify() {
    let css = inputEl.value;
    if (!css.trim()) { showToast('Please enter CSS.', 'error'); return; }
    const origBytes = new TextEncoder().encode(css).length;

    css = compactCss(css);

    outputEl.value = css;
    const minBytes = new TextEncoder().encode(css).length;
    const saved = origBytes - minBytes;
    const pct = origBytes > 0 ? ((saved / origBytes) * 100).toFixed(1) : 0;
    savingsEl.textContent = `${formatBytes(origBytes)} → ${formatBytes(minBytes)} · saved ${formatBytes(saved)} (${pct}%)`;
    savingsEl.style.display = 'block';
    showToast('CSS minified!', 'success');
  }

  minifyBtn.addEventListener('click', minify);
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'Minified CSS');
    else showToast('Nothing to copy.', 'error');
  });
})();
