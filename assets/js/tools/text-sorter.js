(function () {
  'use strict';

  function initTextSorter() {
    var sortBtn = document.getElementById('ts-sort-btn');
    var copyBtn = document.getElementById('ts-copy-btn');
    var inputEl = document.getElementById('ts-input');
    var outputEl = document.getElementById('ts-output');
    if (!sortBtn) return;

    function getRadio(name) {
      var el = document.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : null;
    }

    sortBtn.addEventListener('click', function () {
      var text = inputEl.value;
      if (!text.trim()) {
        showToast('Input is empty', 'error');
        return;
      }
      var lines = text.split('\n');
      var type  = getRadio('ts-type')  || 'alpha';
      var order = getRadio('ts-order') || 'asc';

      // Turkish order (ç after c, ı before i, ş after s) when chosen, or
      // automatically when the text has a Turkish letter.
      var langSel = document.getElementById('ts-lang');
      var naturalEl = document.getElementById('ts-natural');
      var lang = langSel ? langSel.value : 'auto';
      if (lang === 'auto') lang = /[çğıİöşüÇĞÖŞÜ]/.test(text) ? 'tr' : 'en';
      var collator = new Intl.Collator(lang, { numeric: naturalEl ? naturalEl.checked : true });
      var number = function (line) { var value = parseFloat(line.trim().replace(/^[^\d+\-.]+/, '')); return isNaN(value) ? null : value; };

      lines.sort(function (a, b) {
        if (type === 'alpha')   return collator.compare(a, b);
        if (type === 'numeric') {
          // Lines without a number go last, in alphabetical order.
          var x = number(a), y = number(b);
          if (x === null && y === null) return collator.compare(a, b);
          if (x === null) return 1;
          if (y === null) return -1;
          return x - y || collator.compare(a, b);
        }
        if (type === 'length')  return Array.from(a).length - Array.from(b).length || collator.compare(a, b);
        return 0;
      });

      if (order === 'desc') lines.reverse();
      outputEl.value = lines.join('\n');
      showToast('Sorted ' + lines.length + ' lines');
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyToClipboard(outputEl.value, 'Sorted text');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTextSorter);
  } else {
    initTextSorter();
  }
})();
