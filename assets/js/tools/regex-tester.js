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
  if (!patternInput) return;

  function runRegex() {
    errorEl.hidden = true;
    highlight.textContent = '';
    stats.innerHTML = '';
    groups.innerHTML = '';

    const pattern = patternInput.value;
    const flags   = flagsInput.value.replace(/[^gimsuy]/g, '');
    const text    = testArea.value;

    if (!pattern) {
      highlight.textContent = '';
      return;
    }

    let rx;
    try {
      rx = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
    } catch (e) {
      errorEl.textContent = 'Invalid regex: ' + e.message;
      errorEl.hidden = false;
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

  // Sync scroll of highlight with textarea
  testArea.addEventListener('scroll', () => {
    highlight.scrollTop = testArea.scrollTop;
    highlight.scrollLeft = testArea.scrollLeft;
  });

  clearBtn.addEventListener('click', () => {
    patternInput.value = '';
    flagsInput.value = '';
    testArea.value = '';
    runRegex();
  });
}());
