/* TOOLKIT — assets/js/tools/css-grid-generator.js
   A grid container with column and row templates, gaps, alignment and
   optional named areas. Templates are checked with CSS.supports(); areas
   must be rectangles with the same number of cells in every row. */
(function initGrid() {
  'use strict';

  const field = (id) => document.getElementById(id);
  const boxEl = field('grBox');
  const codeEl = field('grCode');
  const errorEl = field('grError');
  if (!boxEl || !codeEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  class AreaError extends Error {}

  // grid-template-areas text → { rows: [[name]], names: [name] }, or an AreaError.
  function parseAreas(text) {
    const source = text.trim();
    if (!source) return null;
    const quoted = [...source.matchAll(/"([^"]*)"|'([^']*)'/g)].map((match) => match[1] ?? match[2]);
    const lines = quoted.length ? quoted : source.split('\n').map((line) => line.trim()).filter(Boolean);
    const rows = lines.map((line) => line.trim().split(/\s+/));
    const width = rows[0].length;
    if (rows.some((row) => row.length !== width)) throw new AreaError('Every row of areas needs the same number of cells.');
    for (const row of rows) {
      for (const cell of row) {
        if (!/^(?:\.+|[A-Za-z_-][A-Za-z0-9_-]*)$/.test(cell)) throw new AreaError(`“${cell}” is not a valid area name.`);
      }
    }
    // Each named area must fill exactly its bounding rectangle.
    const names = [...new Set(rows.flat().filter((cell) => !/^\.+$/.test(cell)))];
    for (const name of names) {
      let top = Infinity; let bottom = -1; let left = Infinity; let right = -1; let count = 0;
      rows.forEach((row, y) => row.forEach((cell, x) => {
        if (cell !== name) return;
        count += 1;
        top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x);
      }));
      if (count !== (bottom - top + 1) * (right - left + 1)) throw new AreaError(`The area “${name}” is not a rectangle.`);
    }
    return { rows, names };
  }

  function containerLines(state) {
    const lines = ['  display: grid;', `  grid-template-columns: ${state.columns};`];
    if (state.rows && state.rows !== 'none') lines.push(`  grid-template-rows: ${state.rows};`);
    if (state.areas) lines.push(`  grid-template-areas:\n${state.areas.rows.map((row) => `    "${row.join(' ')}"`).join('\n')};`);
    if (state.columnGap === state.rowGap) { if (state.columnGap) lines.push(`  gap: ${state.columnGap}px;`); }
    else lines.push(`  gap: ${state.rowGap}px ${state.columnGap}px;`);
    if (state.justify !== 'stretch') lines.push(`  justify-items: ${state.justify};`);
    if (state.align !== 'stretch') lines.push(`  align-items: ${state.align};`);
    return lines;
  }

  function css(state) {
    const parts = [`.container {\n${containerLines(state).join('\n')}\n}`];
    if (state.areas) for (const name of state.areas.names) parts.push(`.${name} { grid-area: ${name}; }`);
    return parts.join('\n\n');
  }

  function readState() {
    const columns = field('grColumns').value.trim() || 'none';
    const rows = field('grRows').value.trim() || 'none';
    if (columns !== 'none' && !CSS.supports('grid-template-columns', columns)) throw new AreaError(`“${columns}” is not a valid column template.`);
    if (rows !== 'none' && !CSS.supports('grid-template-rows', rows)) throw new AreaError(`“${rows}” is not a valid row template.`);
    return {
      columns, rows, areas: parseAreas(field('grAreas').value),
      columnGap: Number(field('grColumnGap').value), rowGap: Number(field('grRowGap').value),
      justify: field('grJustify').value, align: field('grAlign').value, count: Number(field('grCount').value)
    };
  }

  function render() {
    field('grColumnGapVal').textContent = `${field('grColumnGap').value}px`;
    field('grRowGapVal').textContent = `${field('grRowGap').value}px`;
    field('grCountVal').textContent = field('grCount').value;
    errorEl.hidden = true;
    let state;
    try {
      state = readState();
    } catch (error) {
      if (!(error instanceof AreaError)) throw error;
      errorEl.textContent = t(error.message);
      errorEl.hidden = false;
      return;
    }
    boxEl.style.gridTemplateColumns = state.columns;
    boxEl.style.gridTemplateRows = state.rows;
    boxEl.style.gridTemplateAreas = state.areas ? state.areas.rows.map((row) => `"${row.join(' ')}"`).join(' ') : 'none';
    boxEl.style.columnGap = `${state.columnGap}px`;
    boxEl.style.rowGap = `${state.rowGap}px`;
    boxEl.style.justifyItems = state.justify;
    boxEl.style.alignItems = state.align;
    // With areas, one item per area; otherwise the chosen number of items.
    const labels = state.areas ? state.areas.names : Array.from({ length: state.count }, (_, index) => String(index + 1));
    boxEl.replaceChildren(...labels.map((label) => {
      const item = document.createElement('div');
      item.className = 'gr-item';
      item.textContent = label;
      if (state.areas) item.style.gridArea = label;
      item.dataset.i18nSkip = '';
      return item;
    }));
    field('grCountRow').hidden = Boolean(state.areas);
    codeEl.textContent = css(state);
  }

  const PRESETS = {
    three: { columns: 'repeat(3, 1fr)', rows: 'auto', areas: '' },
    sidebar: { columns: '240px 1fr', rows: 'auto', areas: '' },
    cards: { columns: 'repeat(auto-fill, minmax(140px, 1fr))', rows: 'auto', areas: '' },
    holy: { columns: '200px 1fr 200px', rows: 'auto 1fr auto', areas: '"header header header"\n"nav main aside"\n"footer footer footer"' },
    dashboard: { columns: 'repeat(4, 1fr)', rows: 'auto auto auto', areas: '"stats stats stats chart"\n"table table table chart"\n"log log feed feed"' }
  };
  document.querySelectorAll('[data-gr-preset]').forEach((button) => button.addEventListener('click', () => {
    const preset = PRESETS[button.dataset.grPreset];
    field('grColumns').value = preset.columns;
    field('grRows').value = preset.rows;
    field('grAreas').value = preset.areas;
    render();
  }));
  ['grColumns', 'grRows', 'grAreas', 'grColumnGap', 'grRowGap', 'grCount'].forEach((id) => field(id).addEventListener('input', render));
  ['grJustify', 'grAlign'].forEach((id) => field(id).addEventListener('change', render));
  field('grCopy').addEventListener('click', () => { if (errorEl.hidden) copyToClipboard(codeEl.textContent, 'CSS'); });

  // Exposed for the tests.
  window.ToolkitGrid = Object.freeze({ parseAreas, css });
  render();
}());
