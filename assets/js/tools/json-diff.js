(function initJsonDiff() {
  'use strict';

  const aEl = document.getElementById('jdiff-a');
  const bEl = document.getElementById('jdiff-b');
  const compareBtn = document.getElementById('jdiff-btn');
  const resultsEl = document.getElementById('jdiff-results');
  if (!aEl) return;

  function deepDiff(a, b, path, diffs) {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) ||
        a === null || b === null || typeof a !== 'object') {
      diffs.push({ path, old: a, new: b, type: 'changed' });
      return;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const allKeys = new Set([...keysA, ...keysB]);
    allKeys.forEach(k => {
      const fullPath = path ? path + '.' + k : k;
      if (!(k in a)) { diffs.push({ path: fullPath, old: undefined, new: b[k], type: 'added' }); }
      else if (!(k in b)) { diffs.push({ path: fullPath, old: a[k], new: undefined, type: 'removed' }); }
      else { deepDiff(a[k], b[k], fullPath, diffs); }
    });
  }

  function fmt(val) {
    if (val === undefined) return '<em>undefined</em>';
    return escapeHTML(JSON.stringify(val));
  }

  function compare() {
    const rawA = aEl.value.trim(), rawB = bEl.value.trim();
    if (!rawA || !rawB) { showToast('Please fill both JSON inputs.', 'error'); return; }
    let parsedA, parsedB;
    try { parsedA = JSON.parse(rawA); } catch (e) { showToast('JSON A is invalid: ' + e.message, 'error'); return; }
    try { parsedB = JSON.parse(rawB); } catch (e) { showToast('JSON B is invalid: ' + e.message, 'error'); return; }

    const diffs = [];
    deepDiff(parsedA, parsedB, '', diffs);

    if (diffs.length === 0) {
      resultsEl.innerHTML = '<p class="jdiff-equal">✓ Objects are identical.</p>';
    } else {
      const items = diffs.map(d => {
        let cls = 'jdiff-changed', label = '~';
        if (d.type === 'added') { cls = 'jdiff-added'; label = '+'; }
        if (d.type === 'removed') { cls = 'jdiff-removed'; label = '−'; }
        let detail = '';
        if (d.type === 'changed') detail = `<span class="jdiff-old">${fmt(d.old)}</span> → <span class="jdiff-new">${fmt(d.new)}</span>`;
        else if (d.type === 'added') detail = `<span class="jdiff-new">${fmt(d.new)}</span>`;
        else detail = `<span class="jdiff-old">${fmt(d.old)}</span>`;
        return `<div class="jdiff-item ${cls}">
          <span class="jdiff-label">${label}</span>
          <code class="jdiff-path" data-i18n-skip>${escapeHTML(d.path || '(root)')}</code>
          <span class="jdiff-detail" data-i18n-skip>${detail}</span>
        </div>`;
      }).join('');
      resultsEl.innerHTML = `<p class="jdiff-summary">${diffs.length} difference${diffs.length !== 1 ? 's' : ''} found</p>${items}`;
    }
    resultsEl.style.display = 'block';
  }

  compareBtn.addEventListener('click', compare);
}());
