(function initYamlToJson() {
  'use strict';

  const inputEl = document.getElementById('y2j-input');
  const outputEl = document.getElementById('y2j-output');
  const convertBtn = document.getElementById('y2j-btn');
  const copyBtn = document.getElementById('y2j-copy');
  const indentSel = document.getElementById('y2j-indent');
  if (!inputEl) return;

  function parseYaml(text) {
    const unsupported = () => { throw new Error('Unsupported or invalid YAML. Use nested mappings, lists, quoted strings, booleans, numbers or null; flow collections must use JSON syntax.'); };
    function punctuation(value, target) {
      let quote = '';
      for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (quote) {
          if (quote === '"' && character === '\\') index += 1;
          else if (quote === "'" && character === "'" && value[index + 1] === "'") index += 1;
          else if (character === quote) quote = '';
        } else if ((character === '"' || character === "'") && /^(?:\s*|.*[:\[,\-]\s*)$/.test(value.slice(0, index))) {
          quote = character;
        } else if (character === target && (target === ':' ? !value[index + 1] || /\s/.test(value[index + 1]) : index === 0 || /\s/.test(value[index - 1]))) {
          return index;
        }
      }
      return -1;
    }
    function scalar(value) {
      if (value.startsWith('"') || value.startsWith('[') || value.startsWith('{')) {
        try { return JSON.parse(value); } catch { return unsupported(); }
      }
      if (value.startsWith("'")) {
        if (!/^'(?:[^']|'')*'$/.test(value)) return unsupported();
        return value.slice(1, -1).replace(/''/g, "'");
      }
      if (/^(?:null|~)$/i.test(value) || value === '') return null;
      if (/^(?:true|false)$/i.test(value)) return /^true$/i.test(value);
      if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
        const number = Number(value);
        if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) return unsupported();
        return number;
      }
      if (/^[!&*|>%@\x60\]}]|^[-?:](?:\s|$)|^(?:\.nan|[-+]?\.inf|[-+]?0[box][\da-f]+)/i.test(value) || punctuation(value, ':') !== -1) return unsupported();
      return value;
    }
    const lines = [];
    let documentStarted = false;
    let documentEnded = false;
    for (const original of text.replace(/\r\n?/g, '\n').split('\n')) {
      if (/^ *\t/.test(original)) return unsupported();
      const comment = punctuation(original, '#');
      const line = (comment === -1 ? original : original.slice(0, comment)).trimEnd();
      const content = line.trimStart();
      if (!content) continue;
      if (content === '---') {
        if (documentStarted || lines.length || documentEnded) return unsupported();
        documentStarted = true;
        continue;
      }
      if (content === '...') { documentEnded = true; continue; }
      if (documentEnded) return unsupported();
      const indent = line.length - content.length;
      // Expand compact sequence mappings into the same recursive block grammar.
      if (content.startsWith('- ') && !/^[\[{]/.test(content.slice(2).trimStart()) && punctuation(content.slice(2), ':') !== -1) {
        lines.push({ indent, content: '-' }, { indent: indent + 2, content: content.slice(2) });
      } else {
        lines.push({ indent, content });
      }
    }
    if (!lines.length) return null;
    let cursor = 0;
    const isList = (line) => /^-(?: |$)/.test(line.content);
    function block(indent, depth = 0) {
      if (depth > 100) return unsupported();
      const array = isList(lines[cursor]);
      if (!array && (/^[\[{]/.test(lines[cursor].content) || punctuation(lines[cursor].content, ':') === -1)) return scalar(lines[cursor++].content);
      const result = array ? [] : Object.create(null);
      while (cursor < lines.length && lines[cursor].indent === indent) {
        const line = lines[cursor];
        if (isList(line) !== array) break;
        cursor += 1;
        let key;
        let value;
        if (array) {
          value = line.content.slice(1).trimStart();
        } else {
          const colon = punctuation(line.content, ':');
          if (colon < 1) return unsupported();
          const rawKey = line.content.slice(0, colon).trim();
          key = /^['"]/.test(rawKey) ? scalar(rawKey) : rawKey;
          if (typeof key !== 'string' || /^[!&*?{\[]/.test(rawKey) || Object.hasOwn(result, key)) return unsupported();
          value = line.content.slice(colon + 1).trimStart();
        }
        const child = lines[cursor];
        const nested = child && (child.indent > indent || (!array && child.indent === indent && isList(child)));
        if (value && nested) return unsupported();
        const parsed = !value && nested ? block(child.indent, depth + 1) : scalar(value);
        if (array) result.push(parsed); else result[key] = parsed;
        if (lines[cursor]?.indent > indent) return unsupported();
      }
      return result;
    }
    const result = block(lines[0].indent);
    if (cursor !== lines.length) return unsupported();
    return result;
  }

  function convert() {
    outputEl.value = '';
    const raw = inputEl.value.trim();
    if (!raw) { showToast('Please enter YAML.', 'error'); return; }
    try {
      const parsed = parseYaml(raw);
      const indent = parseInt(indentSel ? indentSel.value : '2', 10);
      outputEl.value = JSON.stringify(parsed, null, indent);
      showToast('Converted to JSON!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  convertBtn.addEventListener('click', convert);
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'JSON');
    else showToast('Nothing to copy.', 'error');
  });
}());
