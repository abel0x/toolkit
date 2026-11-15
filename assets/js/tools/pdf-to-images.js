/* TOOLKIT — assets/js/tools/pdf-to-images.js
   Each page of a PDF as a PNG or JPEG at the chosen resolution, drawn by the
   self-hosted pdf.js (loaded when a file is opened). Single pages download on
   their own; all of them as one ZIP. Nothing leaves the browser. */
(function initPdfToImages() {
  'use strict';

  const field = (id) => document.getElementById(id);
  const dropEl = field('p2iDrop');
  const fileEl = field('p2iFile');
  const gridEl = field('p2iPages');
  if (!dropEl || !gridEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const VENDOR = new URL('../vendor/', document.currentScript ? document.currentScript.src : window.location.href);
  // Safari on iPhone and iPad will not draw canvases above this many pixels.
  const SAFE_AREA = 16777216;
  const formatBytes = (bytes) => (bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`);

  let pdfjs = null;
  let pdf = null;
  let task = null; // the loading task of the open file; destroying it frees the worker
  let file = null;
  let generation = 0;
  let images = []; // { page, name, blob }

  async function loadPdfJs() {
    if (pdfjs) return pdfjs;
    const module = await import(new URL('pdfjs.min.mjs', VENDOR).href);
    module.GlobalWorkerOptions.workerSrc = new URL('pdfjs.worker.min.mjs', VENDOR).href;
    pdfjs = module;
    return module;
  }

  function parseRanges(text, count) {
    const source = text.trim().toLowerCase();
    if (!source || source === 'all') return Array.from({ length: count }, (_, index) => index + 1);
    const pages = [];
    for (const part of source.split(/[,;]+/).map((item) => item.trim()).filter(Boolean)) {
      const match = part.match(/^(\d*)\s*-\s*(\d*)$|^(\d+)$/);
      if (!match) throw new Error(`“${part}” is not a page or a range like 2-5.`);
      const from = match[3] ? Number(match[3]) : (match[1] ? Number(match[1]) : 1);
      const to = match[3] ? Number(match[3]) : (match[2] ? Number(match[2]) : count);
      if (from < 1 || to > count || from > to) throw new Error(`Pages ${part} are outside 1–${count}.`);
      for (let page = from; page <= to; page += 1) if (!pages.includes(page)) pages.push(page);
    }
    return pages;
  }

  async function open(input) {
    if (!input) return;
    if (!/pdf$/i.test(input.type) && !/\.pdf$/i.test(input.name)) { showToast(t('Choose a PDF file.'), 'error'); return; }
    const run = ++generation;
    field('p2iStatus').textContent = t('Opening…');
    try {
      const lib = await loadPdfJs();
      const next = lib.getDocument({ data: new Uint8Array(await input.arrayBuffer()), isEvalSupported: false, verbosity: 0 });
      const opened = await next.promise;
      if (run !== generation) { try { Promise.resolve(next.destroy()).catch(() => {}); } catch { /* gone */ } return; }
      if (task) try { Promise.resolve(task.destroy()).catch(() => {}); } catch { /* gone */ }
      task = next;
      pdf = opened;
      file = input;
      field('p2iEditor').hidden = false;
      field('p2iSource').textContent = `${input.name} · ${pdf.numPages} ${t(pdf.numPages === 1 ? 'page' : 'pages')} · ${formatBytes(input.size)}`;
      field('p2iStatus').textContent = '';
      images = [];
      gridEl.replaceChildren();
      field('p2iZip').hidden = true;
    } catch (error) {
      if (run !== generation) return;
      field('p2iStatus').textContent = '';
      showToast(error && error.name === 'PasswordException' ? t('This PDF needs a password to open; this tool cannot open it.') : t('This is not a PDF this tool can read.'), 'error');
    }
  }

  // One page as an image blob at the chosen resolution (DPI); pages too large
  // for this browser's canvas are drawn at the largest size it allows.
  async function renderPage(number, dpi, type, quality) {
    const page = await pdf.getPage(number);
    let scale = dpi / 72;
    const base = page.getViewport({ scale: 1 });
    if (base.width * base.height * scale * scale > SAFE_AREA) scale = Math.sqrt(SAFE_AREA / (base.width * base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    // JPEG has no transparency; pages are white paper.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    page.cleanup();
    return { blob, width: canvas.width, height: canvas.height };
  }

  async function convert() {
    if (!pdf) return;
    const run = generation;
    let numbers;
    try { numbers = parseRanges(field('p2iRange').value, pdf.numPages); } catch (error) { showToast(t(error.message), 'error'); return; }
    const type = field('p2iFormat').value;
    const dpi = Number(field('p2iDpi').value);
    const quality = 0.9;
    const extension = type === 'image/png' ? 'png' : 'jpg';
    const base = file.name.replace(/\.pdf$/i, '') || 'page';
    const button = field('p2iConvert');
    button.disabled = true;
    images = [];
    gridEl.replaceChildren();
    field('p2iZip').hidden = true;
    try {
      for (const [index, number] of numbers.entries()) {
        if (run !== generation) return;
        field('p2iStatus').textContent = t(`Drawing page ${index + 1} of ${numbers.length}…`);
        const { blob, width, height } = await renderPage(number, dpi, type, quality);
        if (run !== generation) return;
        const name = `${base}-${String(number).padStart(String(pdf.numPages).length, '0')}.${extension}`;
        images.push({ page: number, name, blob });
        gridEl.append(tile(name, blob, number, width, height));
      }
      field('p2iStatus').textContent = t(`${images.length} images, ${formatBytes(images.reduce((sum, item) => sum + item.blob.size, 0))} in all.`);
      field('p2iZip').hidden = images.length < 2;
    } catch (error) {
      field('p2iStatus').textContent = '';
      showToast(t(error.message || 'This page could not be drawn.'), 'error');
    } finally {
      button.disabled = false;
    }
  }

  function save(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function tile(name, blob, number, width, height) {
    const item = document.createElement('figure');
    item.className = 'p2i-tile';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    img.alt = `${t('Page')} ${number}`;
    img.className = 'p2i-thumb';
    const caption = document.createElement('figcaption');
    caption.className = 'p2i-caption';
    caption.textContent = `${number} · ${width} × ${height}`;
    caption.dataset.i18nSkip = '';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--ghost btn--sm';
    button.textContent = t('Download');
    button.setAttribute('aria-label', `${t('Download')} ${name}`);
    button.addEventListener('click', () => save(blob, name));
    item.append(img, caption, button);
    return item;
  }

  async function zipAll() {
    if (!images.length) return;
    const files = [];
    for (const image of images) files.push({ name: image.name, data: new Uint8Array(await image.blob.arrayBuffer()) });
    save(new Blob([window.ToolkitZip.zip(files)], { type: 'application/zip' }), `${(file.name.replace(/\.pdf$/i, '') || 'pages')}-images.zip`);
  }

  dropEl.addEventListener('click', () => fileEl.click());
  dropEl.addEventListener('dragover', (event) => { event.preventDefault(); dropEl.classList.add('drag-over'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-over'));
  dropEl.addEventListener('drop', (event) => { event.preventDefault(); dropEl.classList.remove('drag-over'); open(event.dataTransfer.files[0]); });
  fileEl.addEventListener('change', () => { open(fileEl.files[0]); fileEl.value = ''; });
  field('p2iConvert').addEventListener('click', convert);
  field('p2iZip').addEventListener('click', zipAll);

  // Exposed for the tests.
  window.ToolkitPdfToImages = Object.freeze({ open, convert, images: () => images.map((image) => ({ ...image })), parseRanges });
}());
