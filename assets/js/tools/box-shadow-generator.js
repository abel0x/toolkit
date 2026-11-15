/* TOOLKIT — assets/js/tools/box-shadow-generator.js
   Layered box-shadow editor with a live preview, presets and the CSS to
   copy. Styles are applied through the CSSOM (the page's CSP forbids style
   attributes). */
(function initBoxShadow() {
  'use strict';

  const field = (id) => document.getElementById(id);
  const previewEl = field('bsPreview');
  const stageEl = field('bsStage');
  const layersEl = field('bsLayers');
  const codeEl = field('bsCode');
  if (!previewEl || !layersEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const SLIDERS = [['x', 'bsX', 'px'], ['y', 'bsY', 'px'], ['blur', 'bsBlur', 'px'], ['spread', 'bsSpread', 'px'], ['alpha', 'bsAlpha', '%']];

  const layer = (x, y, blur, spread, color, alpha, inset = false) => ({ x, y, blur, spread, color, alpha, inset });
  const PRESETS = {
    soft: [layer(0, 10, 30, -5, '#000000', 25)],
    subtle: [layer(0, 1, 2, 0, '#000000', 8), layer(0, 1, 3, 1, '#000000', 10)],
    layered: [layer(0, 1, 1, 0, '#000000', 8), layer(0, 2, 2, 0, '#000000', 8), layer(0, 4, 4, 0, '#000000', 8), layer(0, 8, 8, 0, '#000000', 8), layer(0, 16, 16, 0, '#000000', 8)],
    hard: [layer(6, 6, 0, 0, '#000000', 100)],
    inset: [layer(0, 2, 6, 0, '#000000', 35, true)],
    glow: [layer(0, 0, 24, 4, '#3b82f6', 60)]
  };

  let layers = PRESETS.soft.map((item) => ({ ...item }));
  let active = 0;

  function rgba(hex, alpha) {
    const value = parseInt(hex.slice(1), 16);
    const [r, g, b] = [value >> 16, (value >> 8) & 255, value & 255];
    if (alpha >= 100) return hex.toLowerCase();
    return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha) / 100})`;
  }

  const px = (value) => (value === 0 ? '0' : `${value}px`);
  // Tailwind arbitrary values: spaces become _ and commas need no space after them.
  const arbitrary = (value) => value.replace(/,\s+/g, ',').replace(/\s+/g, '_');
  const output = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
  const textMode = () => output('bsMode') === 'text';
  // text-shadow has no spread and no inset.
  const textShadow = (item) => `${px(item.x)} ${px(item.y)} ${px(item.blur)} ${rgba(item.color, item.alpha)}`;
  const shadow = (item) => `${item.inset ? 'inset ' : ''}${px(item.x)} ${px(item.y)} ${px(item.blur)} ${px(item.spread)} ${rgba(item.color, item.alpha)}`;
  const css = (list) => list.map(shadow).join(',\n            ');

  function renderLayers() {
    layersEl.replaceChildren(...layers.map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `btn btn--ghost btn--sm bs-layer${index === active ? ' bs-layer--active' : ''}`;
      button.setAttribute('aria-pressed', String(index === active));
      button.textContent = `${t('Layer')} ${index + 1}`;
      button.addEventListener('click', () => { active = index; fillControls(); render(); });
      return button;
    }));
    field('bsRemove').disabled = layers.length < 2;
  }

  function fillControls() {
    const item = layers[active];
    for (const [key, id] of SLIDERS) field(id).value = String(item[key]);
    field('bsColor').value = item.color;
    field('bsInset').checked = item.inset;
  }

  // Sliders moved by code (presets, layers, units) need their fill redrawn; nav.js only follows input events.
  function fillSliders() {
    document.querySelectorAll('.cssgen-layout input[type="range"]').forEach((slider) => {
      const min = Number(slider.min || 0);
      const max = Number(slider.max || 100);
      slider.style.setProperty('--val', `${max === min ? 0 : ((Number(slider.value) - min) / (max - min)) * 100}%`);
    });
  }

  function render() {
    const item = layers[active];
    for (const [key, id, unit] of SLIDERS) field(`${id}Val`).textContent = `${item[key]}${unit}`;
    const text = textMode();
    field('bsSpreadRow').hidden = text;
    field('bsInsetRow').hidden = text;
    field('bsRadiusRow').hidden = text;
    previewEl.hidden = text;
    field('bsText').hidden = !text;
    field('bsBoxLabel').textContent = t(text ? 'Text' : 'Box');
    field('bsText').style.color = field('bsBox').value;
    field('bsText').style.textShadow = layers.map(textShadow).join(', ');
    previewEl.style.boxShadow = layers.map(shadow).join(', ');
    previewEl.style.borderRadius = `${field('bsRadius').value}px`;
    previewEl.style.backgroundColor = field('bsBox').value;
    stageEl.style.backgroundColor = field('bsBg').value;
    field('bsRadiusVal').textContent = `${field('bsRadius').value}px`;
    const value = text ? layers.map(textShadow).join(',\n             ') : css(layers);
    const property = text ? 'text-shadow' : 'box-shadow';
    codeEl.textContent = output('bsOut') === 'tailwind'
      ? `${text ? 'text-shadow' : 'shadow'}-[${arbitrary(value.replace(/rgba\((\d+), (\d+), (\d+), /g, 'rgba($1,$2,$3,'))}]${text ? '\n\n/* text-shadow utilities need Tailwind CSS 4.1 or later */' : ''}`
      : `${property}: ${value};`;
    renderLayers();
    fillSliders();
  }

  for (const [key, id] of SLIDERS) {
    field(id).addEventListener('input', () => { layers[active][key] = Number(field(id).value); render(); });
  }
  field('bsColor').addEventListener('input', () => { layers[active].color = field('bsColor').value; render(); });
  field('bsInset').addEventListener('change', () => { layers[active].inset = field('bsInset').checked; render(); });
  ['bsRadius', 'bsBox', 'bsBg'].forEach((id) => field(id).addEventListener('input', render));
  field('bsAdd').addEventListener('click', () => {
    layers.push({ ...layers[active], y: layers[active].y * 2 || 4, blur: layers[active].blur * 2 || 8 });
    active = layers.length - 1;
    fillControls();
    render();
  });
  field('bsRemove').addEventListener('click', () => {
    if (layers.length < 2) return;
    layers.splice(active, 1);
    active = Math.max(0, active - 1);
    fillControls();
    render();
  });
  document.querySelectorAll('[data-bs-preset]').forEach((button) => button.addEventListener('click', () => {
    layers = PRESETS[button.dataset.bsPreset].map((item) => ({ ...item }));
    active = 0;
    fillControls();
    render();
  }));
  document.querySelectorAll('input[name="bsOut"], input[name="bsMode"]').forEach((radio) => radio.addEventListener('change', render));
  field('bsCopy').addEventListener('click', () => copyToClipboard(codeEl.textContent.replace(/\n\n\/\*.*\*\/$/, ''), 'CSS'));
  window.addEventListener('toolkit:languagechange', renderLayers);

  // Exposed for the tests.
  window.ToolkitBoxShadow = Object.freeze({ css: (list) => `box-shadow: ${css(list)};`, presets: PRESETS });
  fillControls();
  render();
}());
