/* TOOLKIT — assets/js/tools/regex-tester.js */
(function initRegexTester() {
  'use strict';

  const patternInput = document.getElementById('regexPattern');
  const flagsInput   = document.getElementById('regexFlags');
  const testArea     = document.getElementById('regexTest');
  const highlight    = document.getElementById('regexHighlight');
  const stats        = document.getElementById('regexStats');
  const groups       = document.getElementById('regexGroups');
  const errorEl      = document.getElementById('regexError');
  const clearBtn     = document.getElementById('regexClearBtn');
  const replaceInput = document.getElementById('regexReplace');
  const resultArea   = document.getElementById('regexResult');
  const replaceCount = document.getElementById('regexReplaceCount');
  const resultCopy   = document.getElementById('regexResultCopyBtn');
  if (!patternInput) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  // Replace as String.prototype.replace does: every match with g, else the first.
  function runReplace(pattern, flags, text, count) {
    if (!pattern) { resultArea.value = ''; replaceCount.textContent = ''; return; }
    resultArea.value = text.replace(new RegExp(pattern, flags), replaceInput.value);
    const replaced = flags.includes('g') ? count : Math.min(count, 1);
    replaceCount.textContent = t(`${replaced} replacement(s) made`);
  }

  function runRegex() {
    errorEl.hidden = true;
    highlight.textContent = '';
    stats.innerHTML = '';
    groups.innerHTML = '';

    const pattern = patternInput.value;
    const flags   = [...new Set(flagsInput.value.replace(/[^dgimsuvy]/g, ''))].join('');
    const text    = testArea.value;

    if (!pattern) {
      highlight.textContent = '';
      runReplace('', '', text, 0);
      return;
    }

    let rx;
    try {
      rx = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
    } catch (e) {
      errorEl.textContent = 'Invalid regex: ' + e.message;
      errorEl.hidden = false;
      resultArea.value = '';
      replaceCount.textContent = '';
      return;
    }

    const matches = [...text.matchAll(rx)];
    const count   = matches.length;

    // Build highlighted HTML
    let result = '';
    let last   = 0;
    matches.forEach(m => {
      result += escapeHTML(text.slice(last, m.index));
      result += `<mark class="regex-match">${escapeHTML(m[0])}</mark>`;
      last = m.index + m[0].length;
    });
    result += escapeHTML(text.slice(last));
    highlight.innerHTML = result;

    runReplace(pattern, flags, text, count);

    // Stats
    stats.innerHTML = `<span class="match-count-badge">${count} match${count !== 1 ? 'es' : ''}</span>`;
    if (count === 0) stats.innerHTML += `<span class="ix-fa8d43"> — no matches found</span>`;

    // Groups
    if (count > 0 && matches[0].length > 1) {
      let gHTML = '<div class="ix-b697f9">Capture groups (first match):</div>';
      matches[0].slice(1).forEach((g, i) => {
        gHTML += `<span class="group-card"><span class="group-label">Group ${i+1}</span><span class="group-value" data-i18n-skip>${g === undefined ? '<em>undefined</em>' : escapeHTML(String(g))}</span></span>`;
      });
      groups.innerHTML = gHTML;
    }
  }

  patternInput.addEventListener('input', runRegex);
  flagsInput.addEventListener('input', runRegex);
  testArea.addEventListener('input', runRegex);
  replaceInput.addEventListener('input', runRegex);
  resultCopy.addEventListener('click', () => copyToClipboard(resultArea.value, 'Result'));

  // Sync scroll of highlight with textarea
  testArea.addEventListener('scroll', () => {
    highlight.scrollTop = testArea.scrollTop;
    highlight.scrollLeft = testArea.scrollLeft;
  });

  clearBtn.addEventListener('click', () => {
    patternInput.value = '';
    flagsInput.value = '';
    testArea.value = '';
    replaceInput.value = '';
    runRegex();
  });
}());
