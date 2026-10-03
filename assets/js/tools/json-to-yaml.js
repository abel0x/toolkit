(function initJsonToYaml() {
  'use strict';

  const inputEl = document.getElementById('j2y-input');
  const outputEl = document.getElementById('j2y-output');
  const convertBtn = document.getElementById('j2y-btn');
  const copyBtn = document.getElementById('j2y-copy');
  if (!inputEl) return;

  function isBlock(value) {
    return value !== null && typeof value === 'object' && Object.keys(value).length > 0;
  }

  function toYaml(value, indent) {
    if (!isBlock(value)) return JSON.stringify(value);
    const pad = ' '.repeat(indent);
    const entries = Array.isArray(value) ? value.map((item) => ['-', item]) : Object.entries(value).map(([key, item]) => [JSON.stringify(key) + ':', item]);
    return entries.map(([key, item]) => isBlock(item)
      ? pad + key + '\n' + toYaml(item, indent + 2)
      : pad + key + ' ' + JSON.stringify(item)).join('\n');
  }

  function convert() {
    outputEl.value = '';
    const raw = inputEl.value.trim();
    if (!raw) { showToast('Please enter JSON.', 'error'); return; }
    try {
      outputEl.value = toYaml(JSON.parse(raw), 0);
      showToast('Converted to YAML!', 'success');
    } catch (error) {
      showToast('Invalid JSON: ' + error.message, 'error');
    }
  }

  convertBtn.addEventListener('click', convert);
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'YAML');
    else showToast('Nothing to copy.', 'error');
  });
}());
