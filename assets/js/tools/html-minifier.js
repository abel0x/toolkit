(function initHtmlMinifier() {
  'use strict';
  const inputEl = document.getElementById('hmin-input');
  const outputEl = document.getElementById('hmin-output');
  const minifyBtn = document.getElementById('hmin-btn');
  const copyBtn = document.getElementById('hmin-copy');
  const rmCommentsEl = document.getElementById('hmin-comments');
  const collapseEl = document.getElementById('hmin-collapse');
  const whitespaceEl = document.getElementById('hmin-whitespace');
  const savingsEl = document.getElementById('hmin-savings');
  if (!inputEl) return;

  // Whitespace next to these tags never shows on the page, so it can go.
  const BLOCK = new Set(('html head body title meta link base style script noscript template div p ul ol li dl dt dd ' +
    'table thead tbody tfoot tr td th caption colgroup col section article aside nav header footer main h1 h2 h3 h4 h5 h6 ' +
    'blockquote form fieldset legend figure figcaption hr option optgroup select details summary dialog address ' +
    'pre textarea iframe video audio source track picture canvas map area menu').split(' '));
  const RAW = /^(pre|textarea|script|style|xmp|iframe|noembed|noframes|plaintext)$/i;

  function compactHtml(source, removeComments, collapse, collapseText) {
    // Pieces: { type: 'tag' | 'text' | 'raw', text, name, closing }
    const pieces = [];
    let index = 0;
    let text = '';
    const pushText = () => { if (text) pieces.push({ type: 'text', text }); text = ''; };
    while (index < source.length) {
      if (source.startsWith('<!--', index)) {
        const end = source.indexOf('-->', index + 4);
        const stop = end === -1 ? source.length : end + 3;
        const comment = source.slice(index, stop);
        pushText();
        if (!removeComments || /^<!--\s*\[if|^<!--\s*<!\[endif/i.test(comment)) pieces.push({ type: 'raw', text: comment });
        index = stop;
        continue;
      }
      if (/^<(!|\?)/.test(source.slice(index, index + 2))) {
        // <!DOCTYPE>, <![CDATA[...]]> and <?...?> are kept as written.
        const cdata = source.startsWith('<![CDATA[', index);
        const end = cdata ? source.indexOf(']]>', index) + 3 : source.indexOf('>', index) + 1;
        const stop = end <= index ? source.length : end;
        pushText();
        pieces.push({ type: 'tag', name: '!', text: source.slice(index, stop) });
        index = stop;
        continue;
      }
      const tag = source.slice(index).match(/^<(\/?)([a-z][\w:-]*)(?:[^<>"']*(?:"[^"]*"|'[^']*'))*[^<>"']*>/i);
      if (tag) {
        pushText();
        const name = tag[2].toLowerCase();
        const markup = collapse ? tag[0].replace(/"[^"]*"|'[^']*'|\s*=\s*|\s+/g, (token) => (/^["']/.test(token) ? token : token.includes('=') ? '=' : ' '))
          .replace(/\s+(\/?>)$/, '$1').replace(/^(<\/?[\w:-]+)\s+/, '$1 ') : tag[0];
        pieces.push({ type: 'tag', name, closing: tag[1] === '/', text: markup });
        index += tag[0].length;
        if (!tag[1] && RAW.test(name)) {
          const closing = new RegExp(`</${name}\\s*>`, 'i').exec(source.slice(index));
          const stop = closing ? index + closing.index : source.length;
          pieces.push({ type: 'raw', text: source.slice(index, stop) });
          index = stop;
        }
        continue;
      }
      text += source[index];
      index += 1;
    }
    pushText();
    if (!collapseText) return pieces.map((piece) => piece.text).join('');

    // Text: runs of whitespace become one space; next to a block tag, nothing.
    const isBlock = (piece) => piece && piece.type === 'tag' && (piece.name === '!' || BLOCK.has(piece.name));
    return pieces.map((piece, position) => {
      if (piece.type !== 'text') return piece.text;
      let value = piece.text.replace(/[ \t\n\r\f]+/g, ' ');
      const before = pieces[position - 1];
      const after = pieces[position + 1];
      if (!before || isBlock(before)) value = value.replace(/^ /, '');
      if (!after || isBlock(after)) value = value.replace(/ $/, '');
      return value;
    }).join('');
  }

  function minify() {
    let html = inputEl.value;
    if (!html.trim()) { showToast('Please enter HTML.', 'error'); return; }
    const origBytes = new TextEncoder().encode(html).length;

    html = compactHtml(html, rmCommentsEl?.checked, collapseEl?.checked, whitespaceEl?.checked);

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
