(function initHtmlMinifier() {
  'use strict';
  const inputEl = document.getElementById('hmin-input');
  const outputEl = document.getElementById('hmin-output');
  const minifyBtn = document.getElementById('hmin-btn');
  const copyBtn = document.getElementById('hmin-copy');
  const rmCommentsEl = document.getElementById('hmin-comments');
  const collapseEl = document.getElementById('hmin-collapse');
  const savingsEl = document.getElementById('hmin-savings');
  if (!inputEl) return;

  function compactHtml(source, removeComments, collapse) {
    let result = '';
    let index = 0;
    while (index < source.length) {
      if (source.startsWith('<!--', index)) {
        const end = source.indexOf('-->', index + 4);
        if (end === -1) return result + source.slice(index);
        const comment = source.slice(index, end + 3);
        if (!removeComments || /^<!--\s*\[if/i.test(comment)) result += comment;
        index = end + 3;
        continue;
      }
      // Preserve declarations, CDATA and processing instructions conservatively.
      if (/^<[!?]/.test(source.slice(index, index + 2))) return result + source.slice(index);
      const tag = source.slice(index).match(/^<\/?[a-z][^<>"']*(?:(?:"[^"]*"|'[^']*')[^<>"']*)*>/i);
      if (tag) {
        result += collapse ? tag[0].replace(/"[^"]*"|'[^']*'|[\t\r\n ]+/g, (token) => /^[\t\r\n ]/.test(token) ? ' ' : token) : tag[0];
        index += tag[0].length;
        const raw = tag[0].match(/^<(pre|textarea|script|style|xmp|iframe|noembed|noframes|plaintext)\b/i);
        if (raw) {
          const closing = new RegExp(`</${raw[1]}\\s*>`, 'i').exec(source.slice(index));
          if (!closing) return result + source.slice(index);
          result += source.slice(index, index + closing.index + closing[0].length);
          index += closing.index + closing[0].length;
        }
      } else {
        // Text whitespace can be significant through inline layout or CSS white-space.
        result += source[index++];
      }
    }
    return result;
  }

  function minify() {
    let html = inputEl.value;
    if (!html.trim()) { showToast('Please enter HTML.', 'error'); return; }
    const origBytes = new TextEncoder().encode(html).length;

    html = compactHtml(html, rmCommentsEl?.checked, collapseEl?.checked);

    outputEl.value = html;
    const minBytes = new TextEncoder().encode(html).length;
    const saved = origBytes - minBytes;
    const pct = origBytes > 0 ? ((saved / origBytes) * 100).toFixed(1) : 0;
    savingsEl.textContent = `${formatBytes(origBytes)} → ${formatBytes(minBytes)} · saved ${formatBytes(saved)} (${pct}%)`;
    savingsEl.style.display = 'block';
    showToast('HTML minified!', 'success');
  }

  minifyBtn.addEventListener('click', minify);
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'Minified HTML');
    else showToast('Nothing to copy.', 'error');
  });
})();
