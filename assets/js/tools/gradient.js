/* TOOLKIT — assets/js/tools/gradient.js */
(function initGradientGenerator() {
  const angleSlider = document.getElementById('gradAngle');
  const angleVal    = document.getElementById('gradAngleVal');
  const stopsEl     = document.getElementById('gradStops');
  const addStopBtn  = document.getElementById('gradAddStop');
  const randomBtn   = document.getElementById('gradRandomBtn');
  const copyBtn     = document.getElementById('gradCopyBtn');
  const preview     = document.getElementById('gradPreview');
  const cssOutput   = document.getElementById('gradCSS');
  if (!angleSlider) return;

  function buildGradient() {
    const angle = angleSlider.value;
    const rows = stopsEl.querySelectorAll('.grad-stop-row');
    const stops = Array.from(rows).map(row => {
      const color = row.querySelector('.grad-color').value;
      const pos   = row.querySelector('.grad-pos').value;
      return `${color} ${pos}%`;
    });
    return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
  }

  function updatePreview() {
    const css = buildGradient();
    preview.style.background = css;
    cssOutput.textContent = `background: ${css};`;
    angleVal.textContent = angleSlider.value + '°';
    // Update remove buttons
    const rows = stopsEl.querySelectorAll('.grad-stop-row');
    rows.forEach(r => {
      const btn = r.querySelector('.grad-remove');
      btn.disabled = rows.length <= 2;
      // i18n.js only sees inserted nodes, so translate attribute updates here.
      const title = rows.length <= 2 ? 'Need at least 2 stops' : 'Remove color stop';
      btn.title = window.ToolkitI18n ? window.ToolkitI18n.t(title) : title;
    });
  }

  function addStopRow(color = '#' + Math.floor(Math.random()*0xFFFFFF).toString(16).padStart(6,'0'), pos = 50) {
    const div = document.createElement('div');
    div.className = 'grad-stop-row';
    div.innerHTML = `
      <input type="color" class="color-input grad-color" value="${color}" aria-label="Color stop" />
      <input type="range" class="slider grad-pos" min="0" max="100" value="${pos}" aria-label="Color stop position" />
      <span class="grad-pos-val">${pos}%</span>
      <button class="icon-btn grad-remove" aria-label="Remove color stop" title="Remove stop">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;
    div.querySelector('.grad-color').addEventListener('input', updatePreview);
    div.querySelector('.grad-pos').addEventListener('input', function() {
      div.querySelector('.grad-pos-val').textContent = this.value + '%';
      updatePreview();
    });
    div.querySelector('.grad-remove').addEventListener('click', () => {
      if (stopsEl.querySelectorAll('.grad-stop-row').length > 2) { div.remove(); updatePreview(); }
    });
    stopsEl.appendChild(div);
    updatePreview();
  }

  // wire up initial rows
  stopsEl.querySelectorAll('.grad-stop-row').forEach(row => {
    row.querySelector('.grad-color').addEventListener('input', updatePreview);
    row.querySelector('.grad-pos').addEventListener('input', function() {
      row.querySelector('.grad-pos-val').textContent = this.value + '%';
      updatePreview();
    });
    row.querySelector('.grad-remove').addEventListener('click', () => {
      if (stopsEl.querySelectorAll('.grad-stop-row').length > 2) { row.remove(); updatePreview(); }
    });
  });

  angleSlider.addEventListener('input', updatePreview);
  addStopBtn.addEventListener('click', () => addStopRow());

  randomBtn.addEventListener('click', () => {
    const rand = () => '#' + Math.floor(Math.random()*0xFFFFFF).toString(16).padStart(6,'0');
    const rows = stopsEl.querySelectorAll('.grad-stop-row');
    rows.forEach(row => { row.querySelector('.grad-color').value = rand(); });
    angleSlider.value = Math.floor(Math.random()*360);
    updatePreview();
  });

  copyBtn.addEventListener('click', () => copyToClipboard(cssOutput.textContent, 'CSS gradient'));

  updatePreview();
})();
