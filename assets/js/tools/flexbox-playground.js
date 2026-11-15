/* TOOLKIT — assets/js/tools/flexbox-playground.js
   A flex container with numbered items: change the container's properties,
   pick an item to change its own, and copy the CSS that differs from the
   defaults. Styles go through the CSSOM (no style attributes under the CSP). */
(function initFlexbox() {
  'use strict';

  const field = (id) => document.getElementById(id);
  const boxEl = field('fxBox');
  const codeEl = field('fxCode');
  if (!boxEl || !codeEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  const CONTAINER = [
    ['flex-direction', 'fxDirection', 'row'],
    ['flex-wrap', 'fxWrap', 'nowrap'],
    ['justify-content', 'fxJustify', 'flex-start'],
    ['align-items', 'fxAlignItems', 'stretch'],
    ['align-content', 'fxAlignContent', 'normal']
  ];
  const ITEM_DEFAULTS = { grow: 0, shrink: 1, basis: 'auto', alignSelf: 'auto', order: 0 };
  // Different sizes make alignment visible.
  const SIZES = [[44, 40], [64, 64], [52, 32], [80, 76], [40, 52], [60, 44]];

  let items = [];
  let selected = -1;

  function setCount(count) {
    while (items.length < count) items.push({ ...ITEM_DEFAULTS });
    items.length = count;
    if (selected >= count) selected = -1;
  }

  function containerCss() {
    const lines = ['  display: flex;'];
    for (const [property, id, initial] of CONTAINER) {
      if (field(id).value !== initial) lines.push(`  ${property}: ${field(id).value};`);
    }
    const gap = Number(field('fxGap').value);
    if (gap) lines.push(`  gap: ${gap}px;`);
    return `.container {\n${lines.join('\n')}\n}`;
  }

  function itemCss(item) {
    const lines = [];
    if (item.grow !== ITEM_DEFAULTS.grow || item.shrink !== ITEM_DEFAULTS.shrink || item.basis !== ITEM_DEFAULTS.basis) {
      lines.push(`  flex: ${item.grow} ${item.shrink} ${item.basis};`);
    }
    if (item.alignSelf !== 'auto') lines.push(`  align-self: ${item.alignSelf};`);
    if (item.order) lines.push(`  order: ${item.order};`);
    return lines;
  }

  // Tailwind arbitrary values: spaces become _ and commas need no space after them.
  const arbitrary = (value) => value.replace(/,\s+/g, ',').replace(/\s+/g, '_');
  const output = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
  // Tailwind classes for the container and for each item that differs from the defaults.
  const TW_CONTAINER = {
    'flex-direction': { 'row-reverse': 'flex-row-reverse', column: 'flex-col', 'column-reverse': 'flex-col-reverse' },
    'flex-wrap': { wrap: 'flex-wrap', 'wrap-reverse': 'flex-wrap-reverse' },
    'justify-content': { center: 'justify-center', 'flex-end': 'justify-end', 'space-between': 'justify-between', 'space-around': 'justify-around', 'space-evenly': 'justify-evenly' },
    'align-items': { 'flex-start': 'items-start', center: 'items-center', 'flex-end': 'items-end', baseline: 'items-baseline' },
    'align-content': { 'flex-start': 'content-start', center: 'content-center', 'flex-end': 'content-end', 'space-between': 'content-between', 'space-around': 'content-around', 'space-evenly': 'content-evenly', stretch: 'content-stretch' }
  };
  const spacing = (pixels) => (pixels % 4 === 0 ? String(pixels / 4) : `[${pixels}px]`);
  function tailwind() {
    const container = ['flex'];
    for (const [property, id] of CONTAINER) { const name = TW_CONTAINER[property][field(id).value]; if (name) container.push(name); }
    const gap = Number(field('fxGap').value);
    if (gap) container.push(`gap-${spacing(gap)}`);
    const lines = [`<div class="${container.join(' ')}">`];
    items.forEach((item, index) => {
      const classes = [];
      if (item.grow === 1) classes.push('grow'); else if (item.grow) classes.push(`grow-[${item.grow}]`);
      if (item.shrink === 0) classes.push('shrink-0'); else if (item.shrink !== 1) classes.push(`shrink-[${item.shrink}]`);
      if (item.basis !== 'auto') classes.push(`basis-[${arbitrary(item.basis)}]`);
      if (item.alignSelf !== 'auto') classes.push(`self-${{ 'flex-start': 'start', 'flex-end': 'end' }[item.alignSelf] || item.alignSelf}`);
      if (item.order) classes.push(`order-[${item.order}]`);
      lines.push(`  <div${classes.length ? ` class="${classes.join(' ')}"` : ''}>${index + 1}</div>`);
    });
    lines.push('</div>');
    return lines.join('\n');
  }

  function render() {
    for (const [property, id] of CONTAINER) boxEl.style.setProperty(property, field(id).value);
    boxEl.style.gap = `${field('fxGap').value}px`;
    field('fxGapVal').textContent = `${field('fxGap').value}px`;
    field('fxCountVal').textContent = field('fxCount').value;
    const varied = field('fxVaried').checked;
    boxEl.replaceChildren(...items.map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `fx-item${index === selected ? ' fx-item--selected' : ''}`;
      button.textContent = String(index + 1);
      button.setAttribute('aria-pressed', String(index === selected));
      button.setAttribute('aria-label', `${t('Item')} ${index + 1}`);
      const [width, height] = varied ? SIZES[index % SIZES.length] : [52, 48];
      button.style.minWidth = `${width}px`;
      button.style.minHeight = `${height}px`;
      button.style.flex = `${item.grow} ${item.shrink} ${item.basis}`;
      button.style.alignSelf = item.alignSelf;
      button.style.order = String(item.order);
      button.addEventListener('click', () => { selected = selected === index ? -1 : index; fillItem(); render(); });
      return button;
    }));
    const parts = [containerCss()];
    items.forEach((item, index) => {
      const lines = itemCss(item);
      if (lines.length) parts.push(`.item-${index + 1} {\n${lines.join('\n')}\n}`);
    });
    codeEl.textContent = output('fxOut') === 'tailwind' ? tailwind() : parts.join('\n\n');
  }

  function fillItem() {
    const panel = field('fxItemPanel');
    panel.hidden = selected < 0;
    field('fxItemHint').hidden = selected >= 0;
    if (selected < 0) return;
    const item = items[selected];
    field('fxItemTitle').textContent = `${t('Item')} ${selected + 1}`;
    field('fxGrow').value = String(item.grow);
    field('fxShrink').value = String(item.shrink);
    field('fxBasis').value = item.basis;
    field('fxSelf').value = item.alignSelf;
    field('fxOrder').value = String(item.order);
  }

  for (const [, id] of CONTAINER) field(id).addEventListener('change', render);
  field('fxGap').addEventListener('input', render);
  field('fxVaried').addEventListener('change', render);
  field('fxCount').addEventListener('input', () => { setCount(Number(field('fxCount').value)); fillItem(); render(); });

  const itemFields = [['fxGrow', 'grow', Number], ['fxShrink', 'shrink', Number], ['fxBasis', 'basis', (value) => value.trim() || 'auto'], ['fxSelf', 'alignSelf', String], ['fxOrder', 'order', Number]];
  for (const [id, key, cast] of itemFields) {
    field(id).addEventListener(id === 'fxSelf' ? 'change' : 'input', () => {
      if (selected < 0) return;
      let value = cast(field(id).value);
      if (key === 'basis' && !CSS.supports('flex-basis', value)) value = 'auto';
      if (typeof value === 'number' && !Number.isFinite(value)) value = ITEM_DEFAULTS[key];
      items[selected][key] = value;
      render();
    });
  }
  field('fxItemReset').addEventListener('click', () => {
    if (selected < 0) return;
    items[selected] = { ...ITEM_DEFAULTS };
    fillItem();
    render();
  });
  // Common layouts: the container settings, the number of items and what some items do.
  const PRESETS = {
    center: { container: ['row', 'nowrap', 'center', 'center', 'normal'], gap: 8, count: 1, varied: false, items: {} },
    navbar: { container: ['row', 'nowrap', 'flex-start', 'center', 'normal'], gap: 16, count: 4, varied: false, items: { 0: { grow: 1 } } },
    cards: { container: ['row', 'wrap', 'flex-start', 'stretch', 'normal'], gap: 16, count: 7, varied: false, all: { grow: 1, basis: '120px' } },
    sidebar: { container: ['row', 'nowrap', 'flex-start', 'stretch', 'normal'], gap: 12, count: 2, varied: false, items: { 0: { shrink: 0, basis: '30%' }, 1: { grow: 1 } } },
    stack: { container: ['column', 'nowrap', 'flex-start', 'stretch', 'normal'], gap: 8, count: 4, varied: false, items: {} }
  };
  function applyPreset(name) {
    const preset = PRESETS[name];
    CONTAINER.forEach(([, id], index) => { field(id).value = preset.container[index]; });
    field('fxGap').value = String(preset.gap);
    field('fxCount').value = String(preset.count);
    field('fxVaried').checked = preset.varied;
    items = Array.from({ length: preset.count }, (_, index) => ({ ...ITEM_DEFAULTS, ...(preset.all || {}), ...((preset.items || {})[index] || {}) }));
    selected = -1;
    fillItem();
    render();
    // nav.js only redraws a slider's fill on input.
    ['fxGap', 'fxCount'].forEach((id) => field(id).dispatchEvent(new Event('input')));
  }
  document.querySelectorAll('[data-fx-preset]').forEach((button) => button.addEventListener('click', () => applyPreset(button.dataset.fxPreset)));

  document.querySelectorAll('input[name="fxOut"]').forEach((radio) => radio.addEventListener('change', render));
  field('fxCopy').addEventListener('click', () => copyToClipboard(codeEl.textContent, 'CSS'));
  window.addEventListener('toolkit:languagechange', () => { fillItem(); render(); });

  // Exposed for the tests.
  window.ToolkitFlexbox = Object.freeze({ css: () => codeEl.textContent });
  setCount(Number(field('fxCount').value));
  fillItem();
  render();
}());
