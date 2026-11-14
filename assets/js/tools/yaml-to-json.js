(function initYamlToJson() {
  'use strict';

  const inputEl = document.getElementById('y2j-input');
  const outputEl = document.getElementById('y2j-output');
  const convertBtn = document.getElementById('y2j-btn');
  const copyBtn = document.getElementById('y2j-copy');
  const indentSel = document.getElementById('y2j-indent');
  if (!inputEl) return;

  /* A YAML 1.2 reader for the files people paste: block mappings and
     sequences, flow collections ([a, b], {k: v}) with plain scalars,
     quoted strings with escapes, literal (|) and folded (>) block scalars,
     anchors, aliases and << merges, comments and several documents. Tags
     are read and ignored except !!str. Complex keys (?) are refused. */
  function parseYaml(text) {
    const fail = (message, line) => { throw new Error(line ? `Line ${line}: ${message}` : message); };
    const MAX_DEPTH = 200;

    const indentOf = (text, no) => {
      const match = text.match(/^( *)(\t?)/);
      if (match[2] && text.trim()) fail('Tabs cannot be used for indentation.', no);
      return match[1].length;
    };
    const blank = (text) => /^\s*(#.*)?$/.test(text);

    // Index where a comment starts outside quotes, or -1.
    function commentAt(text) {
      let quote = '';
      for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quote) {
          if (quote === '"' && character === '\\') index += 1;
          else if (character === quote) {
            if (quote === "'" && text[index + 1] === "'") index += 1;
            else quote = '';
          }
        } else if ((character === '"' || character === "'") && /(^|[\s:[{,-])$/.test(text.slice(0, index).trimEnd() ? text.slice(0, index).trimEnd().slice(-1) : '')) {
          quote = character;
        } else if (character === '#' && (index === 0 || /\s/.test(text[index - 1]))) {
          return index;
        }
      }
      return -1;
    }
    const stripComment = (text) => { const at = commentAt(text); return at === -1 ? text : text.slice(0, at); };

    // Where the "key:" colon of a block mapping line is, or -1.
    function keyColon(content) {
      if (/^[[{]/.test(content)) return -1;
      let index = 0;
      if (content[0] === '"' || content[0] === "'") {
        const quote = content[0];
        index = 1;
        while (index < content.length) {
          if (quote === '"' && content[index] === '\\') index += 2;
          else if (content[index] === quote && quote === "'" && content[index + 1] === "'") index += 2;
          else if (content[index] === quote) break;
          else index += 1;
        }
        const after = content.slice(index + 1);
        const match = after.match(/^\s*:(\s|$)/);
        return match ? index + 1 + match[0].indexOf(':') : -1;
      }
      const body = stripComment(content);
      for (; index < body.length; index += 1) {
        if (body[index] === ':' && (index + 1 === body.length || /\s/.test(body[index + 1]))) return index;
      }
      return -1;
    }

    function resolvePlain(value, no) {
      if (/^(?:~|null|Null|NULL)$/.test(value)) return null;
      if (/^(?:true|True|TRUE)$/.test(value)) return true;
      if (/^(?:false|False|FALSE)$/.test(value)) return false;
      let number = null;
      if (/^[-+]?\d+$/.test(value)) number = Number(value);
      else if (/^0o[0-7]+$/.test(value)) number = parseInt(value.slice(2), 8);
      else if (/^0x[\da-fA-F]+$/.test(value)) number = parseInt(value.slice(2), 16);
      else if (/^[-+]?(?:\.\d+|\d+(?:\.\d*)?)(?:[eE][-+]?\d+)?$/.test(value)) number = Number(value);
      else if (/^[-+]?\.(?:inf|Inf|INF)$|^\.(?:nan|NaN|NAN)$/.test(value)) fail(`${value} has no JSON equivalent.`, no);
      if (number !== null) {
        if (Number.isInteger(number) && !Number.isSafeInteger(number)) fail(`${value} is too large to convert exactly.`, no);
        return number;
      }
      return value;
    }

    function doubleQuoted(body, no) {
      const escapes = { 0: '\0', a: '\x07', b: '\b', t: '\t', '\t': '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1b', ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\x85', _: '\xa0', L: '\u2028', P: '\u2029' };
      let out = '';
      for (let index = 0; index < body.length; index += 1) {
        const character = body[index];
        if (character !== '\\') { out += character; continue; }
        const next = body[++index];
        if (next === '\n') { while (body[index + 1] === ' ') index += 1; continue; }
        const size = { x: 2, u: 4, U: 8 }[next];
        if (size) {
          const hex = body.slice(index + 1, index + 1 + size);
          if (!new RegExp(`^[\\da-fA-F]{${size}}$`).test(hex)) fail('Invalid escape in a double-quoted string.', no);
          out += String.fromCodePoint(parseInt(hex, 16));
          index += size;
        } else if (Object.hasOwn(escapes, next)) out += escapes[next];
        else fail(`Unknown escape \\${next} in a double-quoted string.`, no);
      }
      return out;
    }

    // Line breaks inside a quoted or plain scalar fold to spaces; empty lines keep a newline.
    function fold(parts) {
      let out = '';
      let newlines = 0;
      parts.forEach((part, index) => {
        if (!part) { newlines += 1; return; }
        if (index) out += newlines ? '\n'.repeat(newlines) : ' ';
        out += part;
        newlines = 0;
      });
      return out;
    }

    /* Flow collections and scalars within them. */
    function parseFlow(source, no, anchors) {
      let index = 0;
      const space = () => { while (index < source.length && /\s/.test(source[index])) index += 1; };
      function quoted() {
        const quote = source[index];
        let end = index + 1;
        while (end < source.length) {
          if (quote === '"' && source[end] === '\\') end += 2;
          else if (source[end] === quote && quote === "'" && source[end + 1] === "'") end += 2;
          else if (source[end] === quote) break;
          else end += 1;
        }
        if (end >= source.length) fail('A quoted string is not closed.', no);
        const body = source.slice(index + 1, end);
        index = end + 1;
        return quote === '"' ? doubleQuoted(body, no) : body.replace(/''/g, "'");
      }
      function plain(inMap) {
        const start = index;
        while (index < source.length) {
          const character = source[index];
          if (',[]{}'.includes(character)) break;
          if (character === ':' && (index + 1 === source.length || /[\s,[\]{}]/.test(source[index + 1]))) break;
          if (character === '#' && /\s/.test(source[index - 1] || '')) break;
          index += 1;
        }
        const text = source.slice(start, index).trim();
        return inMap === 'key' ? text : resolvePlain(text, no);
      }
      function value(depth, inMap) {
        if (depth > MAX_DEPTH) fail('The document is nested too deeply.', no);
        space();
        let anchor = null;
        let tag = null;
        while (source[index] === '&' || source[index] === '!') {
          const match = source.slice(index).match(/^([&!][^\s,[\]{}]*)/);
          if (match[1][0] === '&') anchor = match[1].slice(1); else tag = match[1];
          index += match[1].length;
          space();
        }
        let result;
        const character = source[index];
        if (character === '[') result = sequence(depth);
        else if (character === '{') result = mapping(depth);
        else if (character === '"' || character === "'") result = quoted();
        else if (character === '*') {
          const match = source.slice(index).match(/^\*([^\s,[\]{}]+)/);
          index += match[0].length;
          if (!anchors.has(match[1])) fail(`Unknown alias *${match[1]}.`, no);
          result = anchors.get(match[1]);
        } else {
          const start = index;
          result = plain(inMap);
          if (tag === '!!str' && typeof result !== 'string') result = source.slice(start, index).trim();
        }
        if (anchor) anchors.set(anchor, result);
        return result;
      }
      function sequence(depth) {
        index += 1;
        const out = [];
        for (;;) {
          space();
          if (source[index] === ']') { index += 1; return out; }
          if (index >= source.length) fail('A [ list is not closed.', no);
          out.push(value(depth + 1));
          space();
          if (source[index] === ',') index += 1;
          else if (source[index] !== ']') fail('Expected , or ] in a [ list.', no);
        }
      }
      function mapping(depth) {
        index += 1;
        const out = Object.create(null);
        for (;;) {
          space();
          if (source[index] === '}') { index += 1; return out; }
          if (index >= source.length) fail('A { mapping is not closed.', no);
          const key = source[index] === '"' || source[index] === "'" ? quoted() : plain('key');
          space();
          let entry = null;
          if (source[index] === ':') { index += 1; entry = value(depth + 1); }
          if (Object.hasOwn(out, key)) fail(`Duplicate key "${key}".`, no);
          out[key] = entry;
          space();
          if (source[index] === ',') index += 1;
          else if (source[index] !== '}') fail('Expected , or } in a { mapping.', no);
        }
      }
      const result = value(0);
      space();
      if (index < source.length) fail('Unexpected text after a value.', no);
      return result;
    }

    function parseDocument(lines) {
      const anchors = new Map();
      let pos = 0;
      const peek = () => {
        while (pos < lines.length && blank(lines[pos].text)) pos += 1;
        return lines[pos];
      };

      // A value that starts on this line (after "key:" or "- ") and may continue below.
      function inline(text, parentIndent, no, tag) {
        const alias = text.match(/^\*([^\s,[\]{}]+)$/);
        if (alias) {
          if (!anchors.has(alias[1])) fail(`Unknown alias *${alias[1]}.`, no);
          return anchors.get(alias[1]);
        }
        const continuation = () => {
          const next = lines[pos];
          if (!next) return null;
          if (!next.text.trim()) return '';
          return indentOf(next.text, next.no) > parentIndent ? next.text.trim() : null;
        };
        if (text[0] === '[' || text[0] === '{') {
          let source = text;
          const balanced = () => {
            let depth = 0;
            let quote = '';
            for (let index = 0; index < source.length; index += 1) {
              const character = source[index];
              if (quote) {
                if (quote === '"' && character === '\\') index += 1;
                else if (character === quote) quote = '';
              } else if (character === '"' || character === "'") quote = character;
              else if (character === '[' || character === '{') depth += 1;
              else if (character === ']' || character === '}') depth -= 1;
            }
            return depth <= 0;
          };
          // Inside an open [ or { any following line continues it, even "]" at the margin.
          while (!balanced()) {
            const next = lines[pos];
            if (!next) fail('A [ or { collection is not closed.', no);
            source += ' ' + stripComment(next.text).trim();
            pos += 1;
          }
          return parseFlow(source, no, anchors);
        }
        if (text[0] === '"' || text[0] === "'") {
          const quote = text[0];
          const closed = (source) => {
            for (let index = 1; index < source.length; index += 1) {
              if (quote === '"' && source[index] === '\\') index += 1;
              else if (source[index] === quote) {
                if (quote === "'" && source[index + 1] === "'") index += 1;
                else return index;
              }
            }
            return -1;
          };
          const parts = [text];
          let joined = text;
          while (closed(joined) === -1) {
            const next = continuation();
            if (next === null) fail('A quoted string is not closed.', no);
            parts.push(next);
            joined = parts[0] + '\n' + parts.slice(1).join('\n');
            pos += 1;
          }
          const end = closed(joined);
          if (stripComment(joined.slice(end + 1)).trim()) fail('Unexpected text after a quoted string.', no);
          const lineParts = joined.slice(1, end).split('\n').map((part, index, all) => (
            index === 0 ? part.trimEnd() : index === all.length - 1 ? part.trimStart() : part.trim()));
          if (quote === '"') {
            // Keep escaped line breaks for doubleQuoted; fold the rest.
            const folded = lineParts.reduce((out, part, index) => {
              if (!index) return part;
              if (out.endsWith('\\') && !out.endsWith('\\\\')) return out.slice(0, -1) + part;
              return out + (part ? (out.endsWith('\n') ? '' : ' ') + part : '\n');
            }, '');
            return doubleQuoted(folded, no);
          }
          return fold(lineParts).replace(/''/g, "'");
        }
        const parts = [text];
        for (;;) {
          const next = continuation();
          if (next === null || next === '') break;
          if (keyColon(next) !== -1 || /^-(\s|$)/.test(next)) fail('A value continues on a line that looks like a key or list item.', lines[pos].no);
          parts.push(stripComment(next).trim());
          pos += 1;
        }
        const plain = fold(parts);
        if (tag === '!!str') return plain;
        return resolvePlain(plain, no);
      }

      function blockScalar(header, parentIndent, no) {
        const match = header.match(/^([|>])([+-]?)([1-9]?)([+-]?)$/);
        if (!match) fail('Unsupported block scalar header.', no);
        const literal = match[1] === '|';
        const chomp = match[2] || match[4];
        let contentIndent = match[3] ? parentIndent + Number(match[3]) : null;
        const body = [];
        while (pos < lines.length) {
          const text = lines[pos].text;
          if (!text.trim()) { body.push(''); pos += 1; continue; }
          const indent = indentOf(text, lines[pos].no);
          if (contentIndent === null) {
            if (indent <= parentIndent) break;
            contentIndent = indent;
          }
          if (indent < contentIndent) break;
          body.push(text.slice(contentIndent));
          pos += 1;
        }
        let trailing = 0;
        while (body.length && body[body.length - 1] === '') { body.pop(); trailing += 1; }
        let content;
        if (literal) content = body.join('\n');
        else {
          content = '';
          body.forEach((line, index) => {
            const previous = body[index - 1];
            const indented = /^\s/.test(line);
            if (index === 0) content = line;
            else if (line === '') content += '\n';
            else if (previous === '' || indented || /^\s/.test(previous)) content += (content.endsWith('\n') && previous === '' ? '' : '\n') + line;
            else content += ' ' + line;
          });
        }
        if (!body.length) return chomp === '+' ? '\n'.repeat(trailing) : '';
        if (chomp === '-') return content;
        if (chomp === '+') return content + '\n' + '\n'.repeat(trailing);
        return content + '\n';
      }

      // Anchor and tag before a value: "&name", "!!str".
      function properties(text) {
        let anchor = null;
        let tag = null;
        let rest = text;
        for (;;) {
          const match = rest.match(/^([&!][^\s,[\]{}]*)(?:\s+|$)/);
          if (!match) break;
          if (match[1][0] === '&') anchor = match[1].slice(1); else tag = match[1];
          rest = rest.slice(match[0].length);
        }
        return { anchor, tag, rest };
      }

      // The value after "key:" or "- ", with the block below it when the line ends there.
      function valueAfter(text, ownIndent, no, depth) {
        const { anchor, tag, rest } = properties(stripComment(text).trim());
        let result;
        if (!rest) {
          const next = peek();
          const nextIndent = next ? indentOf(next.text, next.no) : -1;
          if (next && nextIndent > ownIndent) result = node(ownIndent, depth + 1);
          else if (next && nextIndent === ownIndent && /^-(\s|$)/.test(next.text.slice(nextIndent))) result = sequence(ownIndent, depth + 1);
          else result = tag === '!!str' ? '' : null;
        } else if (rest[0] === '|' || rest[0] === '>') {
          result = blockScalar(rest, ownIndent, no);
        } else {
          result = inline(rest, ownIndent, no, tag);
        }
        if (anchor) anchors.set(anchor, result);
        return result;
      }

      function node(parentIndent, depth) {
        if (depth > MAX_DEPTH) fail('The document is nested too deeply.');
        const line = peek();
        if (!line) return null;
        const indent = indentOf(line.text, line.no);
        if (indent <= parentIndent) return null;
        const content = line.text.slice(indent);
        const { anchor, tag, rest } = properties(content);
        if (anchor || tag) {
          // "&name" alone on its line anchors the block below it.
          if (!stripComment(rest).trim()) {
            pos += 1;
            const result = node(parentIndent, depth + 1);
            if (anchor) anchors.set(anchor, result);
            return result;
          }
          if (keyColon(rest) === -1 && !/^-(\s|$)/.test(rest)) {
            pos += 1;
            return valueAfter(content, parentIndent, line.no, depth);
          }
        }
        if (/^-(\s|$)/.test(content)) return sequence(indent, depth);
        if (/^\?(\s|$)/.test(content)) fail('Complex keys (?) are not supported.', line.no);
        if (keyColon(content) !== -1) return mapping(indent, depth);
        pos += 1;
        const value = stripComment(content).trim();
        if (value[0] === '|' || value[0] === '>') return blockScalar(value, parentIndent, line.no);
        return inline(value, parentIndent, line.no, null);
      }

      function sequence(indent, depth) {
        const out = [];
        for (;;) {
          const line = peek();
          if (!line) break;
          const lineIndent = indentOf(line.text, line.no);
          if (lineIndent < indent) break;
          if (lineIndent > indent) fail('Unexpected indentation.', line.no);
          const content = line.text.slice(lineIndent);
          if (!/^-(\s|$)/.test(content)) break;
          const rest = content.slice(1);
          const value = stripComment(rest).trim();
          if (!value) {
            pos += 1;
            out.push(valueAfter('', indent, line.no, depth));
            continue;
          }
          // "- key: value" and "- - item" open a block at the column after "- ".
          const column = lineIndent + 1 + (rest.length - rest.trimStart().length);
          const inner = rest.trimStart();
          const { rest: bare } = properties(inner);
          if (/^-(\s|$)/.test(bare) || keyColon(bare) !== -1) {
            lines[pos] = { no: line.no, text: ' '.repeat(column) + inner };
            out.push(node(indent, depth + 1));
          } else {
            pos += 1;
            out.push(valueAfter(inner, indent, line.no, depth));
          }
        }
        return out;
      }

      function mapping(indent, depth) {
        const own = Object.create(null);
        const merged = [];
        for (;;) {
          const line = peek();
          if (!line) break;
          const lineIndent = indentOf(line.text, line.no);
          if (lineIndent < indent) break;
          if (lineIndent > indent) fail('Unexpected indentation.', line.no);
          const content = line.text.slice(lineIndent);
          if (/^-(\s|$)/.test(content)) break;
          if (/^\?(\s|$)/.test(content)) fail('Complex keys (?) are not supported.', line.no);
          const colon = keyColon(content);
          if (colon === -1) fail('Expected "key: value".', line.no);
          const rawKey = content.slice(0, colon).trim();
          let key;
          if (rawKey[0] === '"') key = doubleQuoted(rawKey.slice(1, -1), line.no);
          else if (rawKey[0] === "'") key = rawKey.slice(1, -1).replace(/''/g, "'");
          else if (/^[&*!]/.test(rawKey)) fail('Anchors, aliases and tags on keys are not supported.', line.no);
          else key = rawKey;
          pos += 1;
          const value = valueAfter(content.slice(colon + 1), indent, line.no, depth);
          if (key === '<<' && rawKey === '<<') {
            const sources = Array.isArray(value) ? value : [value];
            if (!sources.every((source) => source && typeof source === 'object' && !Array.isArray(source))) {
              fail('<< must merge a mapping or a list of mappings.', line.no);
            }
            merged.push(...sources);
            continue;
          }
          if (Object.hasOwn(own, key)) fail(`Duplicate key "${key}".`, line.no);
          own[key] = value;
        }
        if (!merged.length) return own;
        // Keys written in the mapping win over merged ones; earlier merges win over later.
        const out = Object.create(null);
        for (const source of merged.slice().reverse()) Object.assign(out, source);
        return Object.assign(out, own);
      }

      const first = peek();
      if (!first) return null;
      const result = node(-1, 0);
      const extra = peek();
      if (extra) fail('Unexpected content; check the indentation.', extra.no);
      return result;
    }

    // Split into documents at "---"; directives (%YAML) and "..." end markers are allowed.
    const documents = [];
    let current = [];
    let started = false;
    const sourceLines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    // The final line break ends the last line; it does not add an empty one.
    if (sourceLines.length > 1 && sourceLines[sourceLines.length - 1] === '') sourceLines.pop();
    sourceLines.forEach((text, index) => {
      const no = index + 1;
      if (/^%/.test(text) && !current.some((line) => !blank(line.text))) return;
      const marker = text.match(/^(---|\.\.\.)(\s|$)/);
      if (marker) {
        if (current.some((line) => !blank(line.text)) || (marker[1] === '---' && started)) documents.push(current);
        current = [];
        started = marker[1] === '---';
        const rest = stripComment(text.slice(3)).trim();
        if (rest) current.push({ no, text: '    ' + rest });
        return;
      }
      current.push({ no, text });
    });
    if (current.some((line) => !blank(line.text)) || !documents.length) documents.push(current);
    const results = documents.map(parseDocument);
    return results.length === 1 ? results[0] : results;
  }

  function convert() {
    outputEl.value = '';
    const raw = inputEl.value.trim();
    if (!raw) { showToast('Please enter YAML.', 'error'); return; }
    try {
      const parsed = parseYaml(inputEl.value);
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
