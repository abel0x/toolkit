/* TOOLKIT — assets/js/tools/html-to-markdown.js
   HTML (typed, opened or pasted as formatted text) to CommonMark with GitHub
   tables, strikethrough and task lists. The HTML is parsed with DOMParser,
   which runs no scripts and loads nothing. */
(function initHtmlToMarkdown() {
  'use strict';

  const inputEl = document.getElementById('h2mInput');
  const outputEl = document.getElementById('h2mOutput');
  const bulletEl = document.getElementById('h2mBullet');
  const emphasisEl = document.getElementById('h2mEmphasis');
  const pasteEl = document.getElementById('h2mPasteHtml');
  const copyBtn = document.getElementById('h2mCopy');
  const statsEl = document.getElementById('h2mStats');
  if (!inputEl || !outputEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  const DROP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'CANVAS', 'BUTTON', 'SELECT', 'TEXTAREA']);
  const BLOCKS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'FIGURE', 'FIGCAPTION', 'ADDRESS', 'DETAILS', 'SUMMARY',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'HR', 'TABLE', 'DL', 'DT', 'DD', 'FORM', 'FIELDSET', 'CENTER']);

  /* ── Conversion ─────────────────────────────────────────────── */

  // Characters that would start Markdown syntax inside running text.
  const escapeInline = (text) => text.replace(/[\\`*_[\]]/g, '\\$&').replace(/<(?=[A-Za-z/!?])/g, '\\<');

  // Line starts that would turn a paragraph into a heading, quote or list.
  const escapeLineStart = (line) => line
    .replace(/^(\s*)([#>+])/, '$1\\$2')
    .replace(/^(\s*)-(\s|$)/, '$1\\-$2')
    .replace(/^(\s*)(\d+)([.)])(\s|$)/, '$1$2\\$3$4')
    .replace(/^(\s*)(={3,}|-{3,})\s*$/, '$1\\$2');

  // The shortest run of backticks that does not occur in the text.
  function fence(text, minimum) {
    let length = minimum;
    for (const run of text.match(/`+/g) || []) length = Math.max(length, run.length + 1);
    return '`'.repeat(length);
  }

  // Emphasis markers go inside the spaces, never around them.
  function wrap(content, marker) {
    const match = content.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match[2]) return content;
    return `${match[1]}${marker}${match[2]}${marker}${match[3]}`;
  }

  function linkDestination(url) {
    const clean = url.trim();
    return /[\s()<>]/.test(clean) ? `<${clean.replace(/[<>]/g, encodeURIComponent)}>` : clean;
  }
  const linkTitle = (title) => (title ? ` "${title.replace(/["\\]/g, '\\$&')}"` : '');

  function inline(node, options) {
    let out = '';
    for (const child of node.childNodes) out += inlineNode(child, options);
    return out;
  }

  function inlineNode(node, options) {
    if (node.nodeType === Node.TEXT_NODE) return escapeInline(node.nodeValue.replace(/\s+/g, ' '));
    if (node.nodeType !== Node.ELEMENT_NODE || DROP.has(node.tagName)) return '';
    const tag = node.tagName;
    switch (tag) {
      case 'BR': return '\\\n';
      case 'STRONG': case 'B': return wrap(inline(node, options), options.strong);
      case 'EM': case 'I': case 'CITE': case 'DFN': return wrap(inline(node, options), options.em);
      case 'DEL': case 'S': case 'STRIKE': return wrap(inline(node, options), '~~');
      case 'CODE': case 'KBD': case 'SAMP': case 'TT': {
        const text = node.textContent.replace(/\s+/g, ' ');
        if (!text) return '';
        const ticks = fence(text, 1);
        const pad = text.startsWith('`') || text.endsWith('`') || (/^ .* $/.test(text) && text.trim()) ? ' ' : '';
        return `${ticks}${pad}${text}${pad}${ticks}`;
      }
      case 'A': {
        const text = inline(node, options).trim();
        const href = node.getAttribute('href') || '';
        if (!href || /^\s*(javascript|vbscript|data):/i.test(href)) return text;
        if (!text) return `<${href.trim()}>`;
        if (text === escapeInline(href.trim()) && /^[a-z][a-z0-9+.-]*:\S+$/i.test(href.trim())) return `<${href.trim()}>`;
        return `[${text}](${linkDestination(href)}${linkTitle(node.getAttribute('title'))})`;
      }
      case 'IMG': {
        const src = node.getAttribute('src') || '';
        if (!src) return '';
        return `![${escapeInline(node.getAttribute('alt') || '')}](${linkDestination(src)}${linkTitle(node.getAttribute('title'))})`;
      }
      case 'INPUT': return '';
      // No Markdown for these; CommonMark keeps inline HTML as it is.
      case 'SUP': case 'SUB': case 'U': case 'MARK': case 'INS': {
        const inner = inline(node, options);
        return inner.trim() ? `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>` : inner;
      }
      default:
        if (BLOCKS.has(tag)) return ` ${blocks(node, options).join(' ')} `;
        return inline(node, options);
    }
  }

  // Inline content cleaned into lines: single spaces, no spaces around breaks.
  function tidy(text) {
    return text.replace(/[ \t]+/g, ' ').replace(/ ?\\\n ?/g, '\\\n').trim().replace(/\\$/, '').trim();
  }

  function paragraph(text) {
    const clean = tidy(text);
    if (!clean) return null;
    return clean.split('\n').map(escapeLineStart).join('\n');
  }

  // A list of Markdown blocks for the children of a node.
  function blocks(node, options) {
    const out = [];
    let run = '';
    const flush = () => { const block = paragraph(run); if (block) out.push(block); run = ''; };
    for (const child of node.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE && DROP.has(child.tagName)) continue;
      if (child.nodeType === Node.ELEMENT_NODE && BLOCKS.has(child.tagName)) {
        flush();
        const block = blockNode(child, options);
        if (Array.isArray(block)) out.push(...block); else if (block) out.push(block);
      } else {
        run += inlineNode(child, options);
      }
    }
    flush();
    return out;
  }

  function blockNode(node, options) {
    const tag = node.tagName;
    if (/^H[1-6]$/.test(tag)) {
      const text = tidy(inline(node, options)).replace(/\\\n/g, ' ');
      return text ? `${'#'.repeat(Number(tag[1]))} ${text}` : null;
    }
    switch (tag) {
      case 'HR': return '---';
      case 'PRE': {
        const code = node.querySelector('code');
        const source = (code || node).textContent.replace(/\n$/, '');
        const language = ((code && code.className) || node.className || '').match(/(?:language|lang)-([\w#+-]+)/);
        const ticks = fence(source, 3);
        return `${ticks}${language ? language[1] : ''}\n${source}\n${ticks}`;
      }
      case 'BLOCKQUOTE': {
        const inner = blocks(node, options).join('\n\n');
        return inner ? inner.split('\n').map((line) => (line ? `> ${line}` : '>')).join('\n') : null;
      }
      case 'UL': case 'OL': return list(node, options);
      case 'TABLE': return table(node, options);
      case 'DT': { const text = tidy(inline(node, options)); return text ? wrap(text, options.strong) : null; }
      case 'LI': return list({ tagName: 'UL', children: [node], getAttribute: () => null }, options);
      default: return blocks(node, options);
    }
  }

  const isList = (block) => /^(?:[-*+]|\d+[.)]) /.test(block);

  function list(node, options) {
    const ordered = node.tagName === 'OL';
    let number = ordered ? Number(node.getAttribute('start')) || 1 : 0;
    const items = [...node.children].filter((child) => child.tagName === 'LI');
    // Items with several paragraphs make the whole list loose (blank lines between items).
    const rendered = items.map((item) => {
      let task = '';
      const box = item.querySelector(':scope > input[type="checkbox"], :scope > p > input[type="checkbox"]');
      if (box) task = box.hasAttribute('checked') ? '[x] ' : '[ ] ';
      const parts = blocks(item, options);
      const marker = ordered ? `${number++}.` : options.bullet;
      const indent = ' '.repeat(marker.length + 1);
      // A nested list follows its text directly; other blocks need a blank line.
      const body = parts.reduce((joined, part, index) => (index === 0 ? part : `${joined}${isList(part) ? '\n' : '\n\n'}${part}`), '');
      const lines = `${task}${body}`.split('\n');
      return { text: `${marker} ${lines[0]}${lines.slice(1).map((line) => (line ? `\n${indent}${line}` : '\n')).join('')}`, loose: parts.filter((part) => !isList(part)).length > 1 };
    });
    if (!rendered.length) return null;
    const loose = rendered.some((item) => item.loose);
    return rendered.map((item) => item.text).join(loose ? '\n\n' : '\n');
  }

  function table(node, options) {
    const rows = [...node.querySelectorAll('tr')].filter((row) => row.closest('table') === node);
    if (!rows.length) return null;
    // A table cell is one line: its line breaks stay as <br>.
    const cell = (td) => tidy(inline(td, options)).replace(/\\\n/g, '<br>').replace(/\|/g, '\\|');
    const matrix = rows.map((row) => [...row.children].filter((child) => child.tagName === 'TD' || child.tagName === 'TH'));
    const width = Math.max(...matrix.map((row) => row.length));
    if (!width) return null;
    const text = matrix.map((row) => Array.from({ length: width }, (_, index) => (row[index] ? cell(row[index]) : '')));
    const first = matrix[0];
    const align = Array.from({ length: width }, (_, index) => {
      const value = first[index] ? (first[index].getAttribute('align') || first[index].style.textAlign || '').toLowerCase() : '';
      return value === 'center' ? ':---:' : value === 'right' ? '---:' : value === 'left' ? ':---' : '---';
    });
    const line = (cells) => `| ${cells.join(' | ')} |`;
    return [line(text[0]), line(align), ...text.slice(1).map(line)].join('\n');
  }

  function convert(html, options) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const markdown = blocks(doc.body, options).join('\n\n');
    return markdown.replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ── Page ───────────────────────────────────────────────────── */

  const options = () => ({ bullet: bulletEl.value, em: emphasisEl.value, strong: emphasisEl.value.repeat(2) });

  // Large inputs wait for a pause in typing; small ones update at once.
  const LARGE = 200000;
  let pending = 0;
  const later = (source, fn) => () => {
    clearTimeout(pending);
    if (source.value.length > LARGE) pending = setTimeout(fn, 200); else fn();
  };

  function render() {
    const html = inputEl.value;
    outputEl.value = html.trim() ? convert(html, options()) : '';
    statsEl.textContent = outputEl.value ? t(`${outputEl.value.split('\n').length} lines`) : '';
  }

  // Formatted text pasted from a page or a document arrives as HTML.
  inputEl.addEventListener('paste', (event) => {
    if (!pasteEl.checked || !event.clipboardData) return;
    const html = event.clipboardData.getData('text/html');
    if (!html) return;
    event.preventDefault();
    const clean = html.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<body[^>]*>|<\/body>[\s\S]*$/gi, '').trim();
    inputEl.setRangeText(clean, inputEl.selectionStart, inputEl.selectionEnd, 'end');
    render();
  });
  inputEl.addEventListener('input', later(inputEl, render));
  [bulletEl, emphasisEl].forEach((field) => field.addEventListener('change', render));
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'Markdown');
    else showToast(t('Nothing to copy.'), 'error');
  });

  // Exposed for the tests.
  window.ToolkitHtmlToMarkdown = Object.freeze({ convert });
  render();
}());
