/* TOOLKIT — assets/js/tools/text-diff.js */
(function initDiffChecker() {
  'use strict';

  const textA      = document.getElementById('diffA');
  const textB      = document.getElementById('diffB');
  const compareBtn = document.getElementById('diffCompareBtn');
  const clearBtn   = document.getElementById('diffClearBtn');
  const summary    = document.getElementById('diffSummary');
  const diffOut    = document.getElementById('diffOutput');
  if (!textA) return;

  // LCS-based line diff
  function diffLines(a, b) {
    const linesA   = a.split('\n');
    const linesB   = b.split('\n');
    const m = linesA.length, n = linesB.length;
    const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
    for (let i=m-1; i>=0; i--) for (let j=n-1; j>=0; j--) {
      dp[i][j] = linesA[i] === linesB[j] ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j], dp[i][j+1]);
    }
    const result = [];
    let i=0, j=0;
    while (i<m || j<n) {
      if (i<m && j<n && linesA[i] === linesB[j]) { result.push({type:'same', text: linesA[i]}); i++; j++; }
      else if (j<n && (i>=m || dp[i+1]?.[j] <= dp[i]?.[j+1])) { result.push({type:'add', text: linesB[j]}); j++; }
      else { result.push({type:'del', text: linesA[i]}); i++; }
    }
    return result;
  }

  compareBtn.addEventListener('click', () => {
    const a = textA.value, b = textB.value;
    if (!a && !b) { showToast('Both fields are empty', 'error'); return; }

    if (a === b) {
      summary.hidden = false;
      summary.innerHTML = '<span class="diff-stat diff-stat--same">✓ Texts are identical — no differences found.</span>';
      diffOut.innerHTML = '';
      return;
    }

    const diff = diffLines(a, b);
    const added   = diff.filter(d => d.type === 'add').length;
    const deleted = diff.filter(d => d.type === 'del').length;
    const same    = diff.filter(d => d.type === 'same').length;

    summary.hidden = false;
    summary.innerHTML = `
      <span class="diff-stat diff-stat--add">+ ${added} addition${added!==1?'s':''}</span>
      <span class="diff-stat diff-stat--del">− ${deleted} deletion${deleted!==1?'s':''}</span>
      <span class="diff-stat diff-stat--same">≡ ${same} unchanged</span>`;

    diffOut.innerHTML = diff.map(({type, text}) =>
      `<div class="diff-line diff-line--${type}">
        <span class="diff-sign">${type==='add'?'+':type==='del'?'−':' '}</span>
        <span class="diff-text" data-i18n-skip>${escapeHTML(text)}</span>
      </div>`
    ).join('');
  });

  clearBtn.addEventListener('click', () => {
    textA.value = ''; textB.value = '';
    summary.hidden = true; diffOut.innerHTML = '';
  });
}());
