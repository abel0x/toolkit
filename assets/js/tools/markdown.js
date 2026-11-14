/* TOOLKIT — assets/js/tools/markdown.js */
(function initMarkdown() {
  'use strict';

  const editor   = document.getElementById('mdInput');
  const preview  = document.getElementById('mdPreview');
  const copyBtn  = document.getElementById('mdCopyBtn');
  const clearBtn = document.getElementById('mdClearBtn');
  const htmlBtn  = document.getElementById('mdHtmlBtn');
  if (!editor) return;

  function escapeAttribute(value) {
    return value.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeLinkUrl(value) {
    const source = value.replace(/&amp;/g, '&').trim();
    if (/^(?:https?:|mailto:)/i.test(source)) return escapeHTML(source);
    if (/^(?:#|\/|\.\/|\.\.\/)/.test(source) && !/^\/\//.test(source)) return escapeHTML(source);
    return '';
  }

  function safeImageUrl(value) {
    const source = value.replace(/&amp;/g, '&').trim();
    if (/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(source)) {
      return escapeHTML(source);
    }
    return '';
  }

  // Lightweight safe Markdown → HTML parser
  function parseMarkdown(md) {
    // Finished fragments (code, link and image tags) are parked behind private-use
    // placeholders so later inline rules cannot rewrite their contents or URLs.
    const stash = [];
    const park = (fragment) => `\uE000${stash.push(fragment) - 1}\uE001`;

    let html = md
      // Escape HTML in raw text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Fenced code blocks (kept as a block-level tag for the paragraph rules)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre data-md="${stash.push(`<pre><code class="lang-${lang}">${code.trim()}</code></pre>`) - 1}"></pre>`);

    // Inline code
    html = html.replace(/`([^`]+)`/g, (_, code) => park(`<code>${code}</code>`));

    // Tables (basic)
    html = html.replace(/^(\|.+\|)\n(\|(?:[\s:-]+\|)+)\n((?:\|.+\|\n?)+)/gm, (_, head, sep, body) => {
      const th = head.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
      const rows = body.trim().split('\n').map(r =>
        '<tr>' + r.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('') + '</tr>'
      ).join('');
      return `<table><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>`;
    });

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      const safe = safeImageUrl(url);
      if (!safe) return `<span class="text-muted">🖼 ${alt}</span>`;
      return park(`<img class="ix-0f72cc" src="${safe}" alt="${escapeAttribute(alt)}">`);
    });

    // Links (the visible text still receives inline formatting)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      const safe = safeLinkUrl(url);
      if (!safe) return text;
      return `${park(`<a href="${safe}" target="_blank" rel="noopener noreferrer">`)}${text}</a>`;
    });

    // Headings
    html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // HR
    html = html.replace(/^([-*_]){3,}\s*$/gm, '<hr>');

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // Bold & italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Unordered and ordered lists (simple single-level)
    html = html.replace(/^[\*\-\+] (.+)$/gm, '<li data-ul>$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li data-ol>$1</li>');
    html = html.replace(/(<li data-ul>.*<\/li>\n?)+/g, match => `<ul>${match.replace(/<li data-ul>/g, '<li>')}</ul>`);
    html = html.replace(/(<li data-ol>.*<\/li>\n?)+/g, match => `<ol>${match.replace(/<li data-ol>/g, '<li>')}</ol>`);

    // Paragraphs
    html = html.replace(/\n\n(?!<[a-z])/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs and wrapping artifacts
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>(<[ht][1-6r]|<ul|<ol|<block|<hr|<table|<pre)/g, '$1');
    html = html.replace(/(<\/[ht][1-6r]>|<\/ul>|<\/ol>|<\/blockquote>|<hr>|<\/table>|<\/pre>)<\/p>/g, '$1');

    // Restore parked fragments
    html = html.replace(/<pre data-md="(\d+)"><\/pre>/g, (_, index) => stash[index]);
    return html.replace(/\uE000(\d+)\uE001/g, (_, index) => stash[index]);
  }

  function render() {
    preview.innerHTML = parseMarkdown(editor.value);
  }

  // Default content
  editor.value = `# Welcome to Toolkit

Write **Markdown** here and see the live preview in real time.

## Features
- Live rendering
- **Bold**, *italic*, ~~strikethrough~~
- \`inline code\` and code blocks
- Blockquotes, tables, links and more

> Rendering is fully client-side. Nothing leaves your browser.

\`\`\`js
// Example code block
const msg = "Hello, Toolkit!";
console.log(msg);
\`\`\`

| Tool | Category |
| ---- | -------- |
| JSON Formatter | Dev Tools |
| UUID Generator | Generators |
`;

  render();
  editor.addEventListener('input', render);
  copyBtn.addEventListener('click', () => copyToClipboard(editor.value, 'Markdown'));
  clearBtn.addEventListener('click', () => { editor.value = ''; render(); });

  // A standalone page: the preview's (already sanitised) HTML, titled after
  // the first heading, with a small readable stylesheet and no scripts.
  const PAGE_STYLE = [
    'body{max-width:46rem;margin:2.5rem auto;padding:0 1.25rem;font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f2328;background:#fff}',
    'h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.6em 0 .6em}h1{font-size:2em}h2{font-size:1.5em}',
    'a{color:#0969da}img{max-width:100%}hr{border:0;border-top:1px solid #d0d7de;margin:2em 0}',
    'code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}',
    'code{padding:.15em .35em;border-radius:4px;background:#f3f4f6}pre{padding:1rem;overflow:auto;border-radius:6px;background:#f6f8fa}pre code{padding:0;background:none}',
    'blockquote{margin:1em 0;padding:0 1em;color:#59636e;border-left:4px solid #d0d7de}',
    'table{border-collapse:collapse;margin:1em 0}th,td{padding:.4em .8em;border:1px solid #d0d7de}th{background:#f6f8fa}',
    '@media (prefers-color-scheme:dark){body{color:#e6edf3;background:#0d1117}a{color:#4493f8}code{background:#262c36}pre,th{background:#161b22}hr,th,td{border-color:#3d444d}blockquote{color:#9198a1;border-color:#3d444d}}'
  ].join('');

  function htmlDocument() {
    const body = parseMarkdown(editor.value);
    const heading = preview.querySelector('h1, h2, h3, h4, h5, h6');
    const title = (heading ? heading.textContent.trim() : '') || 'Document';
    return `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n`
      + `<title>${escapeHTML(title)}</title>\n<style>${PAGE_STYLE}</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
  }

  function fileName() {
    const heading = preview.querySelector('h1, h2, h3, h4, h5, h6');
    const slug = (heading ? heading.textContent : '').replace(/ı/g, 'i').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return `${slug || 'document'}.html`;
  }

  htmlBtn.addEventListener('click', () => {
    if (!editor.value.trim()) { showToast(window.ToolkitI18n ? window.ToolkitI18n.t('Nothing to download yet.') : 'Nothing to download yet.', 'error'); return; }
    const url = URL.createObjectURL(new Blob([htmlDocument()], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName();
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
