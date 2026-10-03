(function initUnitConverter() {
  'use strict';

  const baseFontSizeEl = document.getElementById('baseFontSize');
  const viewportWidthEl = document.getElementById('viewportWidth');
  const viewportHeightEl = document.getElementById('viewportHeight');
  const inputValueEl = document.getElementById('inputValue');
  const fromUnitEl = document.getElementById('fromUnit');
  const toUnitEl = document.getElementById('toUnit');
  const convResultEl = document.getElementById('convResult');
  const convTableEl = document.getElementById('convTable');

  if (!baseFontSizeEl) return;

  const UNITS = ['px', 'rem', 'em', 'pt', 'pc', 'cm', 'mm', 'in', 'vw', 'vh'];

  function getFactors() {
    const base = parseFloat(baseFontSizeEl.value) || 16;
    const vw = parseFloat(viewportWidthEl.value) || 1440;
    const vh = parseFloat(viewportHeightEl.value) || 900;
    return {
      px: 1,
      rem: base,
      em: base,
      pt: 1 / 0.75,
      pc: 16,
      cm: 37.795275591,
      mm: 3.7795275591,
      in: 96,
      vw: vw / 100,
      vh: vh / 100
    };
  }

  function toPx(value, unit) {
    return value * getFactors()[unit];
  }

  function fromPx(px, unit) {
    return px / getFactors()[unit];
  }

  function convert(value, from, to) {
    const px = toPx(value, from);
    return fromPx(px, to);
  }

  function fmt(n) {
    if (isNaN(n)) return '—';
    if (Math.abs(n) >= 0.001) return +n.toPrecision(7) + '';
    return n.toExponential(4);
  }

  function update() {
    const value = parseFloat(inputValueEl.value);
    const from = fromUnitEl.value;
    const to = toUnitEl.value;
    if (isNaN(value)) { convResultEl.textContent = '—'; return; }
    const result = convert(value, from, to);
    convResultEl.textContent = `${fmt(result)} ${to}`;
    renderTable(value, from);
  }

  function renderTable(value, fromUnit) {
    if (isNaN(value)) { convTableEl.innerHTML = ''; return; }
    const px = toPx(value, fromUnit);
    let html = '<table style="width:100%;border-collapse:collapse;font-size:.9rem;">';
    html += '<thead><tr><th style="text-align:left;padding:.4rem .6rem;border-bottom:1px solid rgba(255,255,255,.1);">Unit</th><th style="text-align:right;padding:.4rem .6rem;border-bottom:1px solid rgba(255,255,255,.1);">Value</th><th style="padding:.4rem .6rem;border-bottom:1px solid rgba(255,255,255,.1);"></th></tr></thead><tbody>';
    UNITS.forEach(u => {
      const v = fromPx(px, u);
      html += `<tr>
        <td style="padding:.35rem .6rem;font-weight:600;color:var(--accent-cyan,#00d4ff)">${u}</td>
        <td class="font-mono" style="text-align:right;padding:.35rem .6rem;">${fmt(v)}</td>
        <td style="padding:.35rem .6rem;">
          <button class="btn btn-secondary" style="padding:.15rem .5rem;font-size:.75rem;" data-copy-value="${fmt(v)}" data-copy-label="${u}">Copy</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    convTableEl.innerHTML = html;
  }

  // Copy buttons are rendered with the table; one delegated listener keeps them free of inline handlers.
  convTableEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy-value]');
    if (button) copyToClipboard(button.dataset.copyValue, button.dataset.copyLabel);
  });

  [baseFontSizeEl, viewportWidthEl, viewportHeightEl, inputValueEl, fromUnitEl, toUnitEl]
    .forEach(el => el.addEventListener('input', update));

  update();
})();
