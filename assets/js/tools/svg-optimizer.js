(function initSvgOptimizer() {
  'use strict';

  const fileInput  = document.getElementById('svgFile');
  const fileNameEl = document.getElementById('svgFileName');
  const inputEl    = document.getElementById('svgInput');
  const outputEl   = document.getElementById('svgOutput');
  const optimizeBtn = document.getElementById('svgOptimizeBtn');
  const statsEl    = document.getElementById('svgStats');
  const rmComments = document.getElementById('svgRmComments');
  const rmMeta     = document.getElementById('svgRmMeta');
  const rmDoctype  = document.getElementById('svgRmDoctype');
  const rmNs       = document.getElementById('svgRmNs');

  if (!inputEl) return;

  function t(key) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key) : key;
  }

  function updateFileName(name) {
    if (!fileNameEl) return;
    fileNameEl.textContent = name || t('No file selected');
    fileNameEl.title = name || '';
  }

  updateFileName('');

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    updateFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => { inputEl.value = e.target.result; };
    reader.readAsText(file);
  });

  window.addEventListener('toolkit:languagechange', () => {
    if (!fileInput.files[0]) updateFileName('');
  });

  optimizeBtn.addEventListener('click', () => {
    const raw = inputEl.value.trim();
    if (!raw) { showToast('Paste or upload an SVG first', 'error'); return; }

    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'image/svg+xml');

    const errors = doc.querySelector('parsererror');
    if (errors) { showToast('Invalid SVG', 'error'); return; }

    // Remove comments
    if (rmComments.checked) {
      const walker = document.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(n => n.remove());
    }

    // Remove metadata elements
    if (rmMeta.checked) {
      doc.querySelectorAll('metadata, title, desc').forEach(el => el.remove());
    }

    // Remove unnecessary namespace attrs
    if (rmNs.checked) {
      const svg = doc.querySelector('svg');
      if (svg) {
        const toRemove = [];
        for (const attr of svg.attributes) {
          if (attr.name.startsWith('xmlns:') && !raw.includes(attr.name.split(':')[1] + ':')) {
            toRemove.push(attr.name);
          }
        }
        toRemove.forEach(n => svg.removeAttribute(n));
      }
    }

    const serializer = new XMLSerializer();
    let result = serializer.serializeToString(doc);

    // Remove XML declaration
    result = result.replace(/<\?xml[^>]*\?>\s*/g, '');

    // Remove DOCTYPE if checked
    if (rmDoctype.checked) {
      result = result.replace(/<!DOCTYPE[^>]*>\s*/gi, '');
    }

    outputEl.value = result;

    const before = new Blob([raw]).size;
    const after  = new Blob([result]).size;
    const pct    = ((1 - after / before) * 100).toFixed(1);
    statsEl.textContent = `Before: ${formatBytes(before)} → After: ${formatBytes(after)} · Saved: ${pct}%`;
    statsEl.style.color = parseFloat(pct) > 0 ? '#4ade80' : 'rgba(255,255,255,.5)';
  });

  document.getElementById('copysvgBtn').addEventListener('click', () => copyToClipboard(outputEl.value, 'SVG'));
  document.getElementById('downloadSvgBtn').addEventListener('click', () => {
    const blob = new Blob([outputEl.value], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'optimized.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  });
})();
