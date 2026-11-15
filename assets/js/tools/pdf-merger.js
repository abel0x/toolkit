/* TOOLKIT — assets/js/tools/pdf-merger.js
   Joins PDFs in the order given, each with all its pages or a chosen
   range ("1-3, 5, 8-"). Uses the self-hosted pdf-lib; files never leave
   the browser. */
(function initPdfMerger() {
  'use strict';

  const field = (id) => document.getElementById(id);
  const dropEl = field('pmDrop');
  const fileEl = field('pmFiles');
  const listEl = field('pmList');
  const tableEl = field('pmTableWrap');
  const summaryEl = field('pmSummary');
  const mergeBtn = field('pmMerge');
  if (!dropEl || !listEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const formatBytes = (bytes) => (bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`);

  class PageRangeError extends Error {}

  // "1-3, 5, 8-" → zero-based page indexes, in the order written.
  function parseRanges(text, count) {
    const source = text.trim().toLowerCase();
    if (!source || source === 'all') return Array.from({ length: count }, (_, index) => index);
    const pages = [];
    for (const part of source.split(/[,;]+/).map((item) => item.trim()).filter(Boolean)) {
      const match = part.match(/^(\d*)\s*-\s*(\d*)$|^(\d+)$/);
      if (!match) throw new PageRangeError(`“${part}” is not a page or a range like 2-5.`);
      let from;
      let to;
      if (match[3]) { from = Number(match[3]); to = from; } else {
        from = match[1] ? Number(match[1]) : 1;
        to = match[2] ? Number(match[2]) : count;
      }
      if (from < 1 || to > count || from > to) throw new PageRangeError(`Pages ${part} are outside 1–${count}.`);
      for (let page = from; page <= to; page += 1) pages.push(page - 1);
    }
    return pages;
  }

  let entries = []; // { file, bytes, doc, pages }

  async function readPdf(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      return { bytes, doc: await PDFLib.PDFDocument.load(bytes) };
    } catch (error) {
      if (/encrypt/i.test(error.message)) throw new Error(`${file.name}: ${t('the PDF is encrypted (even when it opens without a password, an owner password can lock it), so its pages cannot be copied. Print it to a new PDF (Save as PDF) and add that copy.')}`);
      throw new Error(`${file.name}: ${t('this is not a PDF this tool can read.')}`);
    }
  }

  async function addFiles(files) {
    for (const file of files) {
      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { showToast(`${file.name}: ${t('not a PDF file.')}`, 'error'); continue; }
      try {
        const { bytes, doc } = await readPdf(file);
        entries.push({ file, bytes, doc, pages: '' });
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
    render();
  }

  function button(label, title, onClick, disabled) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'btn btn--ghost btn--sm';
    element.textContent = label;
    element.setAttribute('aria-label', title);
    element.title = title;
    element.disabled = disabled;
    element.addEventListener('click', onClick);
    return element;
  }

  function render() {
    tableEl.hidden = !entries.length;
    mergeBtn.disabled = entries.length < 1;
    listEl.replaceChildren(...entries.map((entry, index) => {
      const row = document.createElement('tr');
      const number = document.createElement('td');
      number.className = 'font-mono';
      number.textContent = String(index + 1);
      const name = document.createElement('td');
      name.className = 'pm-name';
      name.textContent = entry.file.name;
      const count = document.createElement('td');
      count.className = 'font-mono';
      count.textContent = `${entry.doc.getPageCount()}`;
      const pages = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control font-mono pm-pages';
      input.placeholder = t('all');
      input.value = entry.pages;
      input.setAttribute('aria-label', `${t('Pages to use from')} ${entry.file.name}`);
      input.addEventListener('input', () => { entry.pages = input.value; summarise(); });
      pages.append(input);
      const actions = document.createElement('td');
      actions.className = 'pm-actions';
      actions.append(
        button('↑', t('Move up'), () => { [entries[index - 1], entries[index]] = [entries[index], entries[index - 1]]; render(); }, index === 0),
        button('↓', t('Move down'), () => { [entries[index + 1], entries[index]] = [entries[index], entries[index + 1]]; render(); }, index === entries.length - 1),
        button('✕', t('Remove'), () => { entries.splice(index, 1); render(); }, false)
      );
      row.append(number, name, count, pages, actions);
      [number, name, count].forEach((cell) => { cell.dataset.i18nSkip = ''; });
      return row;
    }));
    summarise();
  }

  function plan() {
    return entries.map((entry) => ({ entry, indexes: parseRanges(entry.pages, entry.doc.getPageCount()) }));
  }

  function summarise() {
    if (!entries.length) { summaryEl.textContent = ''; return; }
    try {
      const total = plan().reduce((sum, item) => sum + item.indexes.length, 0);
      summaryEl.className = 'pm-summary';
      summaryEl.textContent = t(`${total} pages from ${entries.length} files.`);
    } catch (error) {
      summaryEl.className = 'pm-summary pm-summary--error';
      summaryEl.textContent = t(error.message);
    }
  }

  async function merge(list) {
    const out = await PDFLib.PDFDocument.create();
    for (const { entry, indexes } of list) {
      const copied = await out.copyPages(entry.doc, indexes);
      copied.forEach((page) => out.addPage(page));
    }
    const first = list[0] && list[0].entry.doc.getTitle();
    if (first) out.setTitle(first);
    out.setProducer('Toolkit PDF Merger (pdf-lib)');
    return out.save();
  }

  async function doMerge() {
    if (!entries.length) return;
    let list;
    try { list = plan(); } catch (error) { showToast(t(error.message), 'error'); return; }
    if (!list.some((item) => item.indexes.length)) { showToast(t('No pages to merge.'), 'error'); return; }
    mergeBtn.disabled = true;
    try {
      const bytes = await merge(list);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'merged.pdf';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      field('pmResult').textContent = t(`Saved merged.pdf: ${formatBytes(bytes.length)}.`);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      mergeBtn.disabled = false;
    }
  }

  dropEl.addEventListener('click', () => fileEl.click());
  dropEl.addEventListener('dragover', (event) => { event.preventDefault(); dropEl.classList.add('drag-over'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-over'));
  dropEl.addEventListener('drop', (event) => { event.preventDefault(); dropEl.classList.remove('drag-over'); addFiles([...event.dataTransfer.files]); });
  fileEl.addEventListener('change', () => { addFiles([...fileEl.files]); fileEl.value = ''; });
  mergeBtn.addEventListener('click', doMerge);
  field('pmClear').addEventListener('click', () => { entries = []; field('pmResult').textContent = ''; render(); });
  window.addEventListener('toolkit:languagechange', render);

  // Exposed for the tests.
  window.ToolkitPdfMerger = Object.freeze({ parseRanges, addFiles, merge: () => merge(plan()) });
  render();
}());
