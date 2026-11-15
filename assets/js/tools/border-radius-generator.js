/* TOOLKIT — assets/js/tools/border-radius-generator.js
   border-radius for each corner, in px or %, with optional elliptical
   corners (separate horizontal and vertical radii), presets and a random
   organic "blob". Writes the shortest shorthand. */
(function initBorderRadius() {
  'use strict';

  const field = (id) => document.getElementById(id);
  const previewEl = field('brPreview');
  const codeEl = field('brCode');
  if (!previewEl || !codeEl) return;

  const CORNERS = ['tl', 'tr', 'br', 'bl'];
  // corner → { h, v }
  let radii = { tl: { h: 24, v: 24 }, tr: { h: 24, v: 24 }, br: { h: 24, v: 24 }, bl: { h: 24, v: 24 } };

  const unit = () => field('brUnit').value;
  const linked = () => field('brLink').checked;
  const elliptical = () => field('brEllipse').checked;

  // The shortest of the 1–4 value forms, as CSS shorthand writes it.
  function shorthand(values) {
    const [a, b, c, d] = values;
    if (a === b && b === c && c === d) return [a];
    if (a === c && b === d) return [a, b];
    if (b === d) return [a, b, c];
    return values;
  }

  function cssValue(state, units, ellipse) {
    const format = (value) => (value === 0 ? '0' : `${value}${units}`);
    const horizontal = shorthand(CORNERS.map((corner) => format(state[corner].h)));
    if (!ellipse) return horizontal.join(' ');
    const vertical = shorthand(CORNERS.map((corner) => format(state[corner].v)));
    if (horizontal.join(' ') === vertical.join(' ')) return horizontal.join(' ');
    return `${horizontal.join(' ')} / ${vertical.join(' ')}`;
  }

  function setLimits() {
    const max = unit() === '%' ? 100 : 200;
    document.querySelectorAll('.br-slider').forEach((slider) => {
      slider.max = String(max);
      if (Number(slider.value) > max) slider.value = String(max);
    });
  }

  function fillControls() {
    for (const corner of CORNERS) {
      field(`br-${corner}-h`).value = String(radii[corner].h);
      field(`br-${corner}-v`).value = String(radii[corner].v);
    }
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
    const ellipse = elliptical();
    document.querySelectorAll('.br-vertical').forEach((row) => { row.hidden = !ellipse; });
    document.querySelectorAll('.br-label-h').forEach((label) => { label.hidden = !ellipse; });
    for (const corner of CORNERS) {
      if (!ellipse) radii[corner].v = radii[corner].h;
      field(`br-${corner}-hVal`).textContent = `${radii[corner].h}${unit()}`;
      field(`br-${corner}-vVal`).textContent = `${radii[corner].v}${unit()}`;
    }
    const value = cssValue(radii, unit(), ellipse);
    previewEl.style.borderRadius = value;
    previewEl.style.width = `${field('brWidth').value}px`;
    previewEl.style.height = `${field('brHeight').value}px`;
    field('brWidthVal').textContent = `${field('brWidth').value}px`;
    field('brHeightVal').textContent = `${field('brHeight').value}px`;
    codeEl.textContent = `border-radius: ${value};`;
    fillSliders();
  }

  for (const corner of CORNERS) {
    for (const axis of ['h', 'v']) {
      const slider = field(`br-${corner}-${axis}`);
      slider.addEventListener('input', () => {
        const value = Number(slider.value);
        const targets = linked() ? CORNERS : [corner];
        for (const target of targets) {
          radii[target][axis] = value;
          if (!elliptical()) radii[target].v = value;
        }
        fillControls();
        render();
      });
    }
  }
  field('brUnit').addEventListener('change', () => {
    // Keep the shape roughly the same when switching units (against the preview's width).
    const toPercent = unit() === '%';
    const size = Number(field('brWidth').value);
    for (const corner of CORNERS) {
      for (const axis of ['h', 'v']) {
        const value = radii[corner][axis];
        radii[corner][axis] = toPercent ? Math.min(100, Math.round((value / size) * 100)) : Math.round((value / 100) * size);
      }
    }
    setLimits();
    fillControls();
    render();
  });
  ['brLink', 'brEllipse'].forEach((id) => field(id).addEventListener('change', render));
  ['brWidth', 'brHeight'].forEach((id) => field(id).addEventListener('input', render));

  const PRESETS = {
    rounded: { unit: 'px', ellipse: false, values: [[16, 16], [16, 16], [16, 16], [16, 16]] },
    pill: { unit: 'px', ellipse: false, values: [[200, 200], [200, 200], [200, 200], [200, 200]] },
    circle: { unit: '%', ellipse: false, values: [[50, 50], [50, 50], [50, 50], [50, 50]] },
    leaf: { unit: '%', ellipse: false, values: [[0, 0], [50, 50], [0, 0], [50, 50]] },
    drop: { unit: '%', ellipse: false, values: [[50, 50], [50, 50], [0, 0], [50, 50]] },
    tab: { unit: 'px', ellipse: false, values: [[16, 16], [16, 16], [0, 0], [0, 0]] }
  };

  function apply(preset) {
    field('brUnit').value = preset.unit;
    field('brEllipse').checked = preset.ellipse;
    field('brLink').checked = false;
    CORNERS.forEach((corner, index) => { radii[corner] = { h: preset.values[index][0], v: preset.values[index][1] }; });
    setLimits();
    fillControls();
    render();
  }

  // A blob: opposite corners share each edge, so neighbouring radii add up to 100%.
  function blob() {
    const pick = () => 25 + Math.floor((window.secureRandInt ? window.secureRandInt(51) : Math.random() * 51));
    const top = pick();
    const bottom = pick();
    const left = pick();
    const right = pick();
    return { unit: '%', ellipse: true, values: [[top, left], [100 - top, right], [100 - bottom, 100 - right], [bottom, 100 - left]] };
  }

  document.querySelectorAll('[data-br-preset]').forEach((button) => button.addEventListener('click', () => {
    apply(button.dataset.brPreset === 'blob' ? blob() : PRESETS[button.dataset.brPreset]);
  }));
  field('brCopy').addEventListener('click', () => copyToClipboard(codeEl.textContent, 'CSS'));

  // Exposed for the tests.
  window.ToolkitBorderRadius = Object.freeze({ cssValue, shorthand, blob });
  setLimits();
  fillControls();
  render();
}());
