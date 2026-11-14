(function initCssMinifier() {
  'use strict';
  const inputEl = document.getElementById('cssmin-input');
  const outputEl = document.getElementById('cssmin-output');
  const minifyBtn = document.getElementById('cssmin-btn');
  const copyBtn = document.getElementById('cssmin-copy');
  const savingsEl = document.getElementById('cssmin-savings');
  if (!inputEl) return;

  /* Tokens keep strings, url(...) and escapes intact; whitespace and
     comments are dropped where CSS does not need them. Each statement is
     handled by kind: a selector or at-rule prelude (before "{"), or a
     declaration (before ";" or "}"). No value is rewritten. */
  function tokenize(source) {
    const tokens = [];
    let index = 0;
    while (index < source.length) {
      const character = source[index];
      if (character === '"' || character === "'") {
        const start = index++;
        while (index < source.length) {
          const next = source[index++];
          if (next === '\\') index += 1;
          else if (next === character || next === '\n') break;
        }
        tokens.push({ type: 'string', text: source.slice(start, index) });
      } else if (source.startsWith('/*', index)) {
        const end = source.indexOf('*/', index + 2);
        const stop = end === -1 ? source.length : end + 2;
        tokens.push({ type: 'comment', text: source.slice(index, stop) });
        index = stop;
      } else if (/^url\(\s*[^\s"')]/i.test(source.slice(index, index + 64))) {
        // An unquoted url(...) is one token: spaces and comments inside it are part of it.
        const start = index;
        index = source.indexOf('(', index) + 1;
        while (index < source.length && source[index] !== ')') index += source[index] === '\\' ? 2 : 1;
        index += 1;
        tokens.push({ type: 'url', text: source.slice(start, index).replace(/\(\s+/, '(').replace(/\s+\)$/, ')') });
      } else if (/\s/.test(character)) {
        while (index < source.length && /\s/.test(source[index])) index += 1;
        tokens.push({ type: 'space', text: ' ' });
      } else if (character === '\\') {
        const escape = source.slice(index).match(/^\\(?:[\da-f]{1,6}(?:\r\n|[ \t\r\n\f])?|[\s\S])/i);
        tokens.push({ type: 'char', text: escape[0] });
        index += escape[0].length;
      } else {
        tokens.push({ type: 'char', text: character });
        index += 1;
      }
    }
    return tokens;
  }

  const last = (text) => text[text.length - 1] || '';

  function render(tokens, kind) {
    // Trim, and turn comments into spaces unless they glue two tokens together.
    const parts = [];
    tokens.forEach((token, index) => {
      if (token.type === 'comment') {
        if (token.text.startsWith('/*!')) { parts.push(token); return; }
        const before = tokens[index - 1];
        const after = tokens[index + 1];
        const glued = before && after && before.type !== 'space' && after.type !== 'space';
        parts.push(glued ? { type: 'char', text: '/**/' } : { type: 'space', text: ' ' });
        return;
      }
      parts.push(token);
    });
    while (parts.length && parts[0].type === 'space') parts.shift();
    while (parts.length && parts[parts.length - 1].type === 'space') parts.pop();

    let out = '';
    let colonSeen = false;
    const custom = kind === 'declaration' && /^--/.test(parts.map((part) => part.text).join(''));
    parts.forEach((part, index) => {
      if (part.type !== 'space') {
        if (part.text === ':' && kind === 'declaration') colonSeen = true;
        out += part.text;
        return;
      }
      if (parts[index - 1]?.type === 'space') return;
      const before = last(out);
      const after = parts[index + 1]?.text[0] || '';
      let drop = false;
      if (kind === 'selector') drop = /[>+~,(]/.test(before) || /[>+~,)]/.test(after);
      else if (kind === 'atrule') drop = /[,(:]/.test(before) || /[,)]/.test(after);
      else if (custom) drop = colonSeen && before === ':';
      else if (!colonSeen) drop = after === ':';
      else drop = /[,(:]/.test(before) || /[,)!]/.test(after);
      if (!drop) out += ' ';
    });
    return out;
  }

  function compactCss(source) {
    const tokens = tokenize(source);
    let out = '';
    let statement = [];
    let depth = 0;
    const kindOf = (ending) => {
      const text = statement.map((token) => token.text).join('').trim();
      if (text.startsWith('@')) return 'atrule';
      if (ending === '{') return 'selector';
      return depth > 0 ? 'declaration' : 'atrule';
    };
    const flush = (ending) => {
      out += render(statement, kindOf(ending));
      statement = [];
    };
    for (const token of tokens) {
      if (token.type === 'char' && token.text === '{') {
        flush('{');
        out += '{';
        depth += 1;
      } else if (token.type === 'char' && token.text === ';') {
        flush(';');
        if (!out.endsWith('{') && !out.endsWith(';')) out += ';';
      } else if (token.type === 'char' && token.text === '}') {
        flush('}');
        if (out.endsWith(';')) out = out.slice(0, -1);
        out += '}';
        depth = Math.max(0, depth - 1);
      } else {
        statement.push(token);
      }
    }
    flush('');
    return out;
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
