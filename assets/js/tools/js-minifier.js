(function initJsMinifier() {
  'use strict';
  const inputEl = document.getElementById('jsmin-input');
  const outputEl = document.getElementById('jsmin-output');
  const minifyBtn = document.getElementById('jsmin-btn');
  const copyBtn = document.getElementById('jsmin-copy');
  const savingsEl = document.getElementById('jsmin-savings');
  if (!inputEl) return;

  /* A lexer, not a parser: it knows strings, template literals (with
     nested ${...}), regular expressions versus division, comments and line
     terminators. Comments go (/*! notices stay), whitespace shrinks to
     what separates tokens, and a line break is kept wherever automatic
     semicolon insertion could depend on it. Names are not shortened. */
  const PUNCTUATOR = /^(?:>>>=|\.\.\.|===|!==|\*\*=|<<=|>>=|>>>|&&=|\|\|=|\?\?=|=>|==|!=|<=|>=|&&|\|\||\?\?|\?\.(?!\d)|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|\*\*|<<|>>|[{}()[\];,<>+\-*/%&|^!~?:=.@])/;
  const NUMBER = /^(?:0[xX][\da-fA-F_]+n?|0[oO][0-7_]+n?|0[bB][01_]+n?|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?n?)/;
  const IDENTIFIER = /^#?(?:[$_\p{ID_Start}]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]+\})(?:[$\p{ID_Continue}\u200c\u200d]|\\u[\da-fA-F]{4}|\\u\{[\da-fA-F]+\})*/u;
  const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
  const LINE_BREAK = /[\n\r\u2028\u2029]/;

  function tokenize(code) {
    const tokens = [];
    const braces = [];
    let index = 0;
    let previous = null;
    const regexAllowed = () => {
      if (!previous) return true;
      if (previous.type === 'word') return REGEX_AFTER_WORD.has(previous.text);
      if (previous.type === 'punct') return !/^[)\]}]$/.test(previous.text) && previous.text !== '++' && previous.text !== '--';
      return false;
    };
    const push = (type, text) => {
      const token = { type, text };
      tokens.push(token);
      if (type !== 'space' && type !== 'comment') previous = token;
    };
    // Read template characters from index (just after ` or }) to the closing ` or ${.
    const templatePart = (start) => {
      let end = index;
      while (end < code.length) {
        if (code[end] === '\\') { end += 2; continue; }
        if (code[end] === '`') { index = end + 1; return code.slice(start, index); }
        if (code[end] === '$' && code[end + 1] === '{') { index = end + 2; braces.push('template'); return code.slice(start, index); }
        end += 1;
      }
      throw new Error('A template literal is not closed.');
    };
    if (code.startsWith('#!')) {
      const end = code.search(LINE_BREAK);
      push('comment', code.slice(0, end === -1 ? code.length : end));
      tokens[tokens.length - 1].keep = true;
      index = end === -1 ? code.length : end;
    }
    while (index < code.length) {
      const character = code[index];
      const rest = code.slice(index, index + 200);
      if (/\s/.test(character)) {
        const start = index;
        while (index < code.length && /\s/.test(code[index])) index += 1;
        push('space', code.slice(start, index));
      } else if (code.startsWith('//', index)) {
        const end = code.slice(index).search(LINE_BREAK);
        const stop = end === -1 ? code.length : index + end;
        push('comment', code.slice(index, stop));
        index = stop;
      } else if (code.startsWith('/*', index)) {
        const end = code.indexOf('*/', index + 2);
        if (end === -1) throw new Error('A /* comment is not closed.');
        push('comment', code.slice(index, end + 2));
        index = end + 2;
      } else if (character === '"' || character === "'") {
        const start = index++;
        while (index < code.length && code[index] !== character) {
          if (code[index] === '\\') index += 1;
          else if (/[\n\r]/.test(code[index])) throw new Error('A string is not closed on its line.');
          index += 1;
        }
        if (index >= code.length) throw new Error('A string is not closed.');
        index += 1;
        push('string', code.slice(start, index));
      } else if (character === '`') {
        const start = index++;
        push('template', templatePart(start));
      } else if (character === '}' && braces[braces.length - 1] === 'template') {
        braces.pop();
        const start = index++;
        push('template', templatePart(start));
      } else if (character === '/' && regexAllowed()) {
        const start = index++;
        let inClass = false;
        while (index < code.length) {
          const next = code[index];
          if (LINE_BREAK.test(next)) throw new Error('A regular expression is not closed on its line.');
          if (next === '\\') index += 1;
          else if (next === '[') inClass = true;
          else if (next === ']') inClass = false;
          else if (next === '/' && !inClass) break;
          index += 1;
        }
        index += 1;
        while (index < code.length && /[a-z]/i.test(code[index])) index += 1;
        push('regex', code.slice(start, index));
      } else if (/\d/.test(character) || (character === '.' && /\d/.test(code[index + 1] || ''))) {
        const match = rest.match(NUMBER);
        index += match[0].length;
        push('number', match[0]);
      } else if (IDENTIFIER.test(rest)) {
        const match = rest.match(IDENTIFIER);
        index += match[0].length;
        push('word', match[0]);
      } else {
        const match = rest.match(PUNCTUATOR);
        const text = match ? match[0] : character;
        if (text === '{') braces.push('brace');
        else if (text === '}') braces.pop();
        index += text.length;
        push('punct', text);
      }
    }
    return tokens;
  }

  const wordy = (character) => /[$_\p{ID_Continue}\\#]/u.test(character || '');

  function minifyJs(code) {
    const tokens = tokenize(code);
    let out = '';
    let previous = null;
    let gap = '';
    for (const token of tokens) {
      if (token.type === 'space') { gap += LINE_BREAK.test(token.text) ? '\n' : ' '; continue; }
      if (token.type === 'comment') {
        if (token.keep || token.text.startsWith('/*!')) {
          out += (out ? '\n' : '') + token.text;
          gap = '\n';
          previous = { type: 'punct', text: ';' };
        } else gap += token.text.startsWith('//') || LINE_BREAK.test(token.text) ? '\n' : ' ';
        continue;
      }
      if (previous && gap) {
        const a = previous.text[previous.text.length - 1];
        const b = token.text[0];
        const endsStatement = wordy(a) || /[)\]}"'`]/.test(a) || previous.type === 'regex' || previous.text === '++' || previous.text === '--';
        const startsStatement = wordy(b) || /[([{"'`+\-!~/@]/.test(b) || token.type === 'regex' || token.type === 'template';
        if (gap.includes('\n') && endsStatement && startsStatement) out += '\n';
        else if ((wordy(a) && wordy(b)) || (a === '+' && b === '+') || (a === '-' && b === '-')
          || (a === '/' && (b === '/' || b === '*')) || (previous.type === 'number' && b === '.')) out += ' ';
      } else if (previous && previous.type === 'number' && token.text[0] === '.' && !previous.text.includes('.')) {
        out += ' ';
      }
      out += token.text;
      previous = token;
      gap = '';
    }
    return out;
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
      showToast('JS minified!', 'success');
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
