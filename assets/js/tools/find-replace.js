(function () {
  'use strict';

  function initFindReplace() {
    var replaceBtn = document.getElementById('fr-replace-btn');
    var copyBtn    = document.getElementById('fr-copy-btn');
    var findEl     = document.getElementById('fr-find');
    var replaceEl  = document.getElementById('fr-replace');
    var inputEl    = document.getElementById('fr-input');
    var outputEl   = document.getElementById('fr-output');
    var statsEl    = document.getElementById('fr-stats');
    if (!replaceBtn) return;

    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    var rulesEl  = document.getElementById('fr-rules');
    var addBtn   = document.getElementById('fr-add-rule');
    var t = function (key) { return window.ToolkitI18n ? window.ToolkitI18n.t(key) : key; };
    var extra = 0;

    // Each added rule is a Find / Replace pair with a Remove button.
    function addRule(find, replace) {
      extra += 1;
      var id = 'fr-rule-' + extra;
      var row = document.createElement('div');
      row.className = 'ix-e1bb00 fr-rule fr-rule--extra';
      row.innerHTML =
        '<div class="form-group ix-ff227d"><label class="form-label" for="' + id + '-find"></label>' +
        '<input type="text" id="' + id + '-find" class="form-control font-mono fr-find" /></div>' +
        '<div class="form-group ix-ff227d"><label class="form-label" for="' + id + '-replace"></label>' +
        '<div class="fr-rule-row"><input type="text" id="' + id + '-replace" class="form-control font-mono fr-replace" />' +
        '<button type="button" class="btn btn--ghost btn--sm fr-remove"></button></div></div>';
      var labels = row.querySelectorAll('label');
      labels[0].textContent = t('Find');
      labels[1].textContent = t('Replace with');
      row.querySelector('.fr-find').value = find || '';
      row.querySelector('.fr-replace').value = replace || '';
      var remove = row.querySelector('.fr-remove');
      remove.textContent = t('Remove');
      remove.addEventListener('click', function () { row.remove(); renumber(); });
      rulesEl.appendChild(row);
      renumber();
      row.querySelector('.fr-find').focus();
    }

    function renumber() {
      rulesEl.querySelectorAll('.fr-rule--extra').forEach(function (row, index) {
        row.querySelector('.fr-remove').setAttribute('aria-label', t('Remove rule') + ' ' + (index + 2));
      });
    }

    function rules() {
      var list = [{ find: findEl.value, replace: replaceEl.value }];
      rulesEl.querySelectorAll('.fr-rule--extra').forEach(function (row) {
        list.push({ find: row.querySelector('.fr-find').value, replace: row.querySelector('.fr-replace').value });
      });
      return list.filter(function (rule, index) { return index === 0 || rule.find; });
    }

    if (addBtn) addBtn.addEventListener('click', function () { addRule('', ''); });

    replaceBtn.addEventListener('click', function () {
      var list = rules();
      var text = inputEl.value;
      if (!list[0].find && list.length === 1) {
        showToast('Enter a search term', 'error');
        return;
      }

      var global = document.getElementById('fr-global').checked;
      var flags = 'g';
      if (!document.getElementById('fr-case').checked) flags += 'i';
      var useRegex = document.getElementById('fr-regex').checked;
      if (useRegex) flags += 'm';

      var counts = [];
      for (var index = 0; index < list.length; index += 1) {
        var rule = list[index];
        if (!rule.find) { counts.push(0); continue; }
        var pattern;
        try {
          pattern = new RegExp(useRegex ? rule.find : escapeRegex(rule.find), flags);
        } catch (e) {
          showToast((list.length > 1 ? t('Rule') + ' ' + (index + 1) + ': ' : '') + 'Invalid regex: ' + e.message, 'error');
          return;
        }
        // Count whole matches, not capture groups; without "global" only the first is replaced.
        var found = 0;
        text.replace(pattern, function () { found += 1; return ''; });
        var count = global ? found : Math.min(found, 1);
        counts.push(count);
        if (global) {
          text = text.replace(pattern, rule.replace);
        } else {
          text = text.replace(new RegExp(pattern.source, flags.replace('g', '')), rule.replace);
        }
      }

      outputEl.value = text;
      var total = counts.reduce(function (sum, value) { return sum + value; }, 0);
      if (statsEl) {
        statsEl.textContent = total + ' match(es) replaced.' + (counts.length > 1
          ? ' (' + counts.map(function (value, index) { return t('Rule') + ' ' + (index + 1) + ': ' + value; }).join(', ') + ')' : '');
      }
      showToast(total + ' replacement(s) made');
    });

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyToClipboard(outputEl.value, 'Result');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFindReplace);
  } else {
    initFindReplace();
  }
})();
