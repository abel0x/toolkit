(function () {
  'use strict';

  function initSlug() {
    var inputEl  = document.getElementById('slug-input');
    var outputEl = document.getElementById('slug-output');
    var copyBtn  = document.getElementById('slug-copy-btn');
    if (!inputEl) return;

    function getRadio(name) {
      var el = document.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : null;
    }

    function generateSlug(text) {
      var sep             = getRadio('slug-sep') || '-';
      var preserveNumbers = document.getElementById('slug-numbers').checked;
      var slug = text.normalize('NFC').toLocaleLowerCase('en-US').replace(/ı/g, 'i');
      slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (preserveNumbers) {
        slug = slug.replace(/[^a-z0-9]+/g, sep);
      } else {
        slug = slug.replace(/[^a-z]+/g, sep);
      }
      slug = slug.replace(new RegExp('\\' + sep + '{2,}', 'g'), sep);
      slug = slug.replace(new RegExp('^\\' + sep + '|\\' + sep + '$', 'g'), '');
      return slug;
    }

    function update() {
      outputEl.value = generateSlug(inputEl.value);
    }

    inputEl.addEventListener('input', update);

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyToClipboard(outputEl.value, 'Slug');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSlug);
  } else {
    initSlug();
  }
})();
