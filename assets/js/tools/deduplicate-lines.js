(function () {
  'use strict';

  function initDeduplicateLines() {
    var dedupBtn = document.getElementById('dd-dedup-btn');
    var copyBtn  = document.getElementById('dd-copy-btn');
    var inputEl  = document.getElementById('dd-input');
    var outputEl = document.getElementById('dd-output');
    var statsEl  = document.getElementById('dd-stats');
    if (!dedupBtn) return;

    dedupBtn.addEventListener('click', function () {
      var text = inputEl.value;
      var lines = text.split('\n');
      var caseInsensitive = document.getElementById('dd-case-insensitive').checked;
      var trimLines       = document.getElementById('dd-trim').checked;

      var seen = new Set();
      var result = [];
      var removedCount = 0;

      lines.forEach(function (line) {
        var key = trimLines ? line.trim() : line;
        if (caseInsensitive) key = foldCase(key);
        if (seen.has(key)) {
          removedCount++;
        } else {
          seen.add(key);
          result.push(line);
        }
      });

      outputEl.value = result.join('\n');
      if (statsEl) statsEl.textContent = removedCount + ' duplicate(s) removed. ' + result.length + ' unique line(s) kept.';
      showToast(removedCount + ' duplicate(s) removed');
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyToClipboard(outputEl.value, 'Deduplicated text');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDeduplicateLines);
  } else {
    initDeduplicateLines();
  }
})();
