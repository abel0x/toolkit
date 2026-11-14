/* TOOLKIT — assets/js/tools/text-diff.js */
(function initDiffChecker() {
  'use strict';

  const textA       = document.getElementById('diffA');
  const textB       = document.getElementById('diffB');
  const compareBtn  = document.getElementById('diffCompareBtn');
  const clearBtn    = document.getElementById('diffClearBtn');
  const summary     = document.getElementById('diffSummary');
  const diffOut     = document.getElementById('diffOutput');
  const ignoreSpace = document.getElementById('diffIgnoreSpace');
  const ignoreCase  = document.getElementById('diffIgnoreCase');
  if (!textA) return;

  // Lines left to compare after the common start and end are set aside.
  // 25 million cells keep the table near 50 MB.
  const MAX_CELLS = 25_000_000;
  // Word highlighting is for ordinary lines, not minified files.
  const MAX_WORDS = 400;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  function view() {
    return document.querySelector('input[name="diffView"]:checked')?.value === 'split' ? 'split' : 'unified';
  }

  function keyOf(line) {
    let key = line;
    if (ignoreSpace.checked) key = key.replace(/\s+/g, ' ').trim();
    if (ignoreCase.checked) key = key.toLocaleLowerCase();
    return key;
  }

  /* Line diff: the longest common subsequence of the line keys, after the
     common first and last lines are taken out. Returns operations with
     the line numbers on each side (1-based). */
  function diffLines(linesA, linesB) {
    const keysA = linesA.map(keyOf);
    const keysB = linesB.map(keyOf);
    let start = 0;
    while (start < keysA.length && start < keysB.length && keysA[start] === keysB[start]) start += 1;
    let endA = keysA.length;
    let endB = keysB.length;
    while (endA > start && endB > start && keysA[endA - 1] === keysB[endB - 1]) { endA -= 1; endB -= 1; }

    const m = endA - start;
    const n = endB - start;
    if ((m + 1) * (n + 1) > MAX_CELLS) return null;

    // dp[i][j]: LCS length of A[start+i..endA) and B[start+j..endB).
    const width = n + 1;
    const dp = Math.min(m, n) < 0xffff ? new Uint16Array((m + 1) * width) : new Uint32Array((m + 1) * width);
    for (let i = m - 1; i >= 0; i -= 1) {
      for (let j = n - 1; j >= 0; j -= 1) {
        dp[i * width + j] = keysA[start + i] === keysB[start + j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
      }
    }

    const ops = [];
    for (let k = 0; k < start; k += 1) ops.push({ type: 'same', a: k, b: k });
    let i = 0;
    let j = 0;
    while (i < m || j < n) {
      if (i < m && j < n && keysA[start + i] === keysB[start + j]) {
        ops.push({ type: 'same', a: start + i, b: start + j });
        i += 1; j += 1;
      } else if (i < m && (j >= n || dp[(i + 1) * width + j] >= dp[i * width + j + 1])) {
        ops.push({ type: 'del', a: start + i });
        i += 1;
      } else {
        ops.push({ type: 'add', b: start + j });
        j += 1;
      }
    }
    for (let k = 0; endA + k < keysA.length; k += 1) ops.push({ type: 'same', a: endA + k, b: endB + k });
    return ops;
  }

  /* Group the operations into rows: unchanged lines, and blocks of removed
     lines followed by added lines, paired one to one where both exist. */
  function rows(ops) {
    const result = [];
    let index = 0;
    while (index < ops.length) {
      if (ops[index].type === 'same') { result.push({ left: ops[index].a, right: ops[index].b, type: 'same' }); index += 1; continue; }
      const removed = [];
      const added = [];
      while (index < ops.length && ops[index].type !== 'same') {
        if (ops[index].type === 'del') removed.push(ops[index].a); else added.push(ops[index].b);
        index += 1;
      }
      for (let k = 0; k < Math.max(removed.length, added.length); k += 1) {
        result.push({ left: removed[k], right: added[k], type: 'change' });
      }
    }
    return result;
  }

  // Words, runs of spaces and single symbols.
  function tokens(line) {
    return line.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];
  }

  /* Mark the words that differ between a removed line and the added line
     it is paired with. Returns HTML for both, or null to show them plain. */
  function wordMarks(before, after) {
    const a = tokens(before);
    const b = tokens(after);
    if (!a.length || !b.length || a.length > MAX_WORDS || b.length > MAX_WORDS) return null;
    const key = (token) => keyOf(token) || (ignoreSpace.checked && /^\s+$/.test(token) ? ' ' : token);
    const width = b.length + 1;
    const dp = new Uint16Array((a.length + 1) * width);
    for (let i = a.length - 1; i >= 0; i -= 1) {
      for (let j = b.length - 1; j >= 0; j -= 1) {
        dp[i * width + j] = key(a[i]) === key(b[j]) ? dp[(i + 1) * width + j + 1] + 1 : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
      }
    }
    const left = [];
    const right = [];
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
      if (i < a.length && j < b.length && key(a[i]) === key(b[j])) {
        left.push([a[i], false]); right.push([b[j], false]); i += 1; j += 1;
      } else if (i < a.length && (j >= b.length || dp[(i + 1) * width + j] >= dp[i * width + j + 1])) {
        left.push([a[i], true]); i += 1;
      } else {
        right.push([b[j], true]); j += 1;
      }
    }
    const html = (parts) => parts.map(([text, changed]) =>
      changed && text.trim() ? `<mark class="diff-word">${escapeHTML(text)}</mark>` : escapeHTML(text)).join('');
    return { left: html(left), right: html(right) };
  }

  function cell(number, sign, type, html) {
    const blank = number === undefined;
    return `<span class="diff-num" aria-hidden="true">${blank ? '' : number + 1}</span>`
      + `<span class="diff-sign" aria-hidden="true">${blank ? '' : sign}</span>`
      + `<span class="diff-text" data-i18n-skip>${blank ? '' : html}</span>`;
  }

  function render(linesA, linesB, grouped) {
    const sign = { same: ' ', del: '−', add: '+' };
    if (view() === 'split') {
      diffOut.className = 'diff-output diff-output--split';
      return grouped.map((row) => {
        const marks = row.type === 'change' && row.left !== undefined && row.right !== undefined
          ? wordMarks(linesA[row.left], linesB[row.right]) : null;
        const leftType = row.type === 'same' ? 'same' : row.left === undefined ? 'empty' : 'del';
        const rightType = row.type === 'same' ? 'same' : row.right === undefined ? 'empty' : 'add';
        const leftHtml = row.left === undefined ? '' : marks ? marks.left : escapeHTML(linesA[row.left]);
        const rightHtml = row.right === undefined ? '' : marks ? marks.right : escapeHTML(linesB[row.right]);
        return `<div class="diff-row">`
          + `<div class="diff-line diff-line--${leftType}">${cell(row.left, sign[leftType] || '', leftType, leftHtml)}</div>`
          + `<div class="diff-line diff-line--${rightType}">${cell(row.right, sign[rightType] || '', rightType, rightHtml)}</div>`
          + `</div>`;
      }).join('');
    }

    diffOut.className = 'diff-output diff-output--unified';
    const lines = [];
    let index = 0;
    while (index < grouped.length) {
      const row = grouped[index];
      if (row.type === 'same') {
        lines.push({ type: 'same', a: row.left, b: row.right, html: escapeHTML(linesA[row.left]) });
        index += 1;
        continue;
      }
      // A change block: all removed lines, then all added lines.
      const block = [];
      while (index < grouped.length && grouped[index].type === 'change') { block.push(grouped[index]); index += 1; }
      const marks = block.map((pair) => (pair.left !== undefined && pair.right !== undefined
        ? wordMarks(linesA[pair.left], linesB[pair.right]) : null));
      block.forEach((pair, k) => {
        if (pair.left !== undefined) lines.push({ type: 'del', a: pair.left, html: marks[k] ? marks[k].left : escapeHTML(linesA[pair.left]) });
      });
      block.forEach((pair, k) => {
        if (pair.right !== undefined) lines.push({ type: 'add', b: pair.right, html: marks[k] ? marks[k].right : escapeHTML(linesB[pair.right]) });
      });
    }
    return lines.map((line) =>
      `<div class="diff-line diff-line--${line.type}">`
      + `<span class="diff-num" aria-hidden="true">${line.a === undefined ? '' : line.a + 1}</span>`
      + `<span class="diff-num" aria-hidden="true">${line.b === undefined ? '' : line.b + 1}</span>`
      + `<span class="diff-sign" aria-hidden="true">${sign[line.type]}</span>`
      + `<span class="diff-text" data-i18n-skip>${line.html}</span>`
      + `</div>`).join('');
  }

  function stat(kind, text) {
    return `<span class="diff-stat diff-stat--${kind}">${escapeHTML(t(text))}</span>`;
  }

  function compare(fromButton) {
    const a = textA.value;
    const b = textB.value;
    if (!a && !b) {
      if (fromButton) showToast(t('Both fields are empty'), 'error');
      return;
    }
    const linesA = a.split('\n');
    const linesB = b.split('\n');
    const ops = diffLines(linesA, linesB);
    summary.hidden = false;
    if (!ops) {
      summary.innerHTML = stat('del', 'Too many different lines to compare at once. Compare smaller parts.');
      diffOut.innerHTML = '';
      return;
    }
    const added = ops.filter((op) => op.type === 'add').length;
    const deleted = ops.filter((op) => op.type === 'del').length;
    const same = ops.length - added - deleted;

    if (!added && !deleted) {
      summary.innerHTML = a === b
        ? stat('same', '✓ Texts are identical — no differences found.')
        : stat('same', '✓ No differences with the chosen options.');
      diffOut.innerHTML = '';
      return;
    }

    summary.innerHTML = [
      stat('add', `+ ${added} addition${added !== 1 ? 's' : ''}`),
      stat('del', `− ${deleted} deletion${deleted !== 1 ? 's' : ''}`),
      stat('same', `≡ ${same} unchanged`)
    ].join(' ');
    diffOut.innerHTML = render(linesA, linesB, rows(ops));
  }

  compareBtn.addEventListener('click', () => compare(true));

  // Options apply at once to a result already on screen.
  [ignoreSpace, ignoreCase, ...document.querySelectorAll('input[name="diffView"]')].forEach((control) => {
    control.addEventListener('change', () => { if (!summary.hidden) compare(false); });
  });

  clearBtn.addEventListener('click', () => {
    textA.value = '';
    textB.value = '';
    summary.hidden = true;
    diffOut.innerHTML = '';
  });
}());
