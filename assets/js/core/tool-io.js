/* ═══════════════════════════════════════════════════════════
   Toolkit — open files into a tool, copy and download its output
   build.py adds this script to the tools with "io" in
   _data/tools.json and passes that entry in data-io:
     inputs:  { "#field": "accepted types" }   → "Open file" + drop
     outputs: { "#field": { copy, save, beside } }
       copy   true adds a Copy button (for outputs that had none)
       save   a file name adds a Download button
       beside an existing button to sit next to, in its own style;
              without it the buttons go to the right of the label.
   Files are read in this browser and never leave it.
   ═══════════════════════════════════════════════════════════ */

(function initToolIO() {
  'use strict';

  const script = document.currentScript;
  let config;
  try { config = JSON.parse(script?.dataset.io || '{}'); } catch { return; }
  const MAX_BYTES = 5 * 1024 * 1024;
  const TYPES = {
    json: 'application/json', yaml: 'application/yaml', yml: 'application/yaml', csv: 'text/csv',
    xml: 'application/xml', html: 'text/html', css: 'text/css', js: 'text/javascript',
    ts: 'text/plain', md: 'text/markdown', sql: 'application/sql', pem: 'application/x-pem-file', txt: 'text/plain'
  };
  const ICONS = {
    open: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6M9 14l3-3 3 3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    save: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 19h16"/>'
  };

  function t(key, values) {
    if (window.ToolkitI18n) return window.ToolkitI18n.t(key, values);
    return key.replace(/{{(\w+)}}/g, (_, name) => String(values?.[name] ?? ''));
  }

  function toast(message, type) {
    if (typeof window.showToast === 'function') window.showToast(message, type);
  }

  function icon(name, size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${ICONS[name]}</svg>`;
  }

  // The row above a field: its label on the left, our buttons on the right.
  function actionsFor(field) {
    // A page can say where a field's buttons go, e.g. into a toolbar.
    const placed = field.id ? document.querySelector(`.field-actions[data-for="${field.id}"]`) : null;
    if (placed) return placed;
    let label = field.id ? document.querySelector(`label[for="${field.id}"]`) : null;
    // Some outputs are captioned by the element just before them.
    const previous = field.previousElementSibling;
    if (!label && previous?.matches('label, .form-label, .control-label')) label = previous;
    const columnHeader = label?.parentElement?.classList.contains('tool-col-header') ? label.parentElement : null;
    if (columnHeader) {
      let group = columnHeader.querySelector('.field-actions');
      if (!group) {
        group = document.createElement('div');
        group.className = 'field-actions';
        columnHeader.append(group);
      }
      return group;
    }
    const head = document.createElement('div');
    head.className = 'field-head';
    const group = document.createElement('div');
    group.className = 'field-actions';
    if (label && label.nextElementSibling === field) {
      label.before(head);
      head.append(label, group);
    } else {
      head.classList.add('field-head--bare');
      field.before(head);
      head.append(group);
    }
    return group;
  }

  // A new button, either a small labelled one for the field row or a twin of
  // the button it sits beside (an icon button stays an icon button).
  function makeButton(kind, text, beside, selector) {
    const button = document.createElement('button');
    button.dataset.toolIoFor = selector;
    button.type = 'button';
    if (beside?.classList.contains('icon-btn')) {
      button.className = 'icon-btn';
      button.setAttribute('aria-label', text);
      button.title = text;
      button.innerHTML = icon(kind, 15);
    } else if (beside) {
      button.className = beside.className;
      button.textContent = text;
    } else {
      button.className = 'btn btn--ghost btn--sm field-action';
      button.innerHTML = icon(kind, 14);
      button.append(text);
    }
    button.dataset.toolIo = kind;
    return button;
  }

  function contents(element) {
    return 'value' in element && !(element instanceof HTMLButtonElement) ? element.value : element.innerText;
  }

  async function readInto(field, file) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast(t('{{name}} is larger than 5 MB.', { name: file.name }), 'error');
      return;
    }
    try {
      field.value = await file.text();
    } catch {
      toast(t('{{name}} could not be read.', { name: file.name }), 'error');
      return;
    }
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    toast(t('Opened {{name}}.', { name: file.name }), 'success');
  }

  function setupInput(selector, accept) {
    const field = document.querySelector(selector);
    if (!field || field.dataset.toolIoReady) return;
    field.dataset.toolIoReady = 'input';
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = accept;
    picker.hidden = true;
    picker.tabIndex = -1;
    picker.setAttribute('aria-hidden', 'true');
    const button = makeButton('open', t('Open file'), null, selector);
    button.setAttribute('aria-controls', field.id || '');
    button.addEventListener('click', () => picker.click());
    picker.addEventListener('change', () => {
      readInto(field, picker.files[0]);
      picker.value = '';
    });
    const group = actionsFor(field);
    group.prepend(button, picker);
    const hasFiles = (event) => [...(event.dataTransfer?.types || [])].includes('Files');
    field.addEventListener('dragover', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      field.classList.add('is-file-over');
    });
    field.addEventListener('dragleave', () => field.classList.remove('is-file-over'));
    field.addEventListener('drop', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      field.classList.remove('is-file-over');
      readInto(field, event.dataTransfer.files[0]);
    });
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.className = 'sr-only';
      document.body.append(area);
      area.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch {}
      area.remove();
      return copied;
    }
  }

  function download(text, name) {
    const extension = name.split('.').pop().toLowerCase();
    const url = URL.createObjectURL(new Blob([text], { type: `${TYPES[extension] || 'text/plain'};charset=utf-8` }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setupOutput(selector, options) {
    const output = document.querySelector(selector);
    if (!output || output.dataset.toolIoReady) return;
    output.dataset.toolIoReady = 'output';
    const beside = options.beside ? document.querySelector(options.beside) : null;
    const buttons = [];
    if (options.copy) {
      const button = makeButton('copy', t('Copy'), beside, selector);
      button.addEventListener('click', async () => {
        const text = contents(output).trim();
        if (!text) { toast(t('Nothing to copy'), 'error'); return; }
        const copied = await copy(text);
        toast(copied ? t('Copied to the clipboard.') : t('Copy failed. Select the text and copy it.'), copied ? 'success' : 'error');
      });
      buttons.push(button);
    }
    if (options.save) {
      const button = makeButton('save', t('Download'), beside, selector);
      button.addEventListener('click', () => {
        const text = contents(output);
        if (!text.trim()) { toast(t('Nothing to download yet.'), 'error'); return; }
        download(text, options.save);
        toast(t('Downloaded {{name}}.', { name: options.save }), 'success');
      });
      buttons.push(button);
    }
    if (!buttons.length) return;
    if (beside) beside.after(...buttons);
    else actionsFor(output).append(...buttons);
  }

  function apply() {
    Object.entries(config.inputs || {}).forEach(([selector, accept]) => setupInput(selector, accept));
    Object.entries(config.outputs || {}).forEach(([selector, options]) => setupOutput(selector, options));
  }

  // Expansion tools draw their fields from script; wait until the page is whole.
  if (document.readyState === 'complete') apply();
  else window.addEventListener('load', apply, { once: true });
}());
