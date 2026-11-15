/* TOOLKIT — assets/js/tools/images-to-pdf.js
   Several images into one PDF, one image per page, in the order chosen.
   Each image is drawn on a canvas first, so photos come out the right way
   up (EXIF orientation) and every format the browser can open works. Uses
   the self-hosted pdf-lib; nothing leaves the browser. */
(function initImagesToPdf() {
  'use strict';

  const field = (id) => document.getElementById(id);
  const dropEl = field('ipDrop');
  const fileEl = field('ipFiles');
  const listEl = field('ipList');
  const makeBtn = field('ipMake');
  if (!dropEl || !listEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const formatBytes = (bytes) => (bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`);

  const PAPER = { a4: [595.28, 841.89], letter: [612, 792] };
  const MARGINS = { none: 0, small: 18, normal: 36 };
  // Safari on iPhone and iPad will not draw canvases above this many pixels.
  const SAFE_AREA = 16777216;

  let entries = []; // { file, url, width, height }
  let dragging = -1;

  async function addFiles(files) {
    for (const file of files) {
      if (!/^image\//.test(file.type) && !/\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(file.name)) {
        showToast(`${file.name}: ${t('not an image file.')}`, 'error');
        continue;
      }
      try {
        const bitmap = await createImageBitmap(file);
        entries.push({ file, url: URL.createObjectURL(file), width: bitmap.width, height: bitmap.height });
        bitmap.close();
      } catch {
        showToast(`${file.name}: ${t('this browser cannot open that image.')}`, 'error');
      }
    }
    render();
  }

  function button(label, title, onClick, disabled) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'btn btn--ghost btn--sm';
    element.textContent = label;
    element.title = title;
    element.setAttribute('aria-label', title);
    element.disabled = disabled;
    element.addEventListener('click', onClick);
    return element;
  }

  function render() {
    field('ipTableWrap').hidden = !entries.length;
    makeBtn.disabled = !entries.length;
    listEl.replaceChildren(...entries.map((entry, index) => {
      const row = document.createElement('tr');
      const order = document.createElement('td');
      order.className = 'font-mono pm-number';
      const handle = document.createElement('span');
      handle.className = 'pm-handle';
      handle.draggable = true;
      handle.textContent = '⠿';
      handle.title = t('Drag to reorder');
      handle.setAttribute('aria-hidden', 'true');
      handle.addEventListener('dragstart', (event) => { dragging = index; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); row.classList.add('pm-row--dragging'); });
      handle.addEventListener('dragend', () => { dragging = -1; render(); });
      order.append(handle, document.createTextNode(String(index + 1)));
      row.addEventListener('dragover', (event) => { if (dragging < 0) return; event.preventDefault(); row.classList.add('pm-row--target'); });
      row.addEventListener('dragleave', () => row.classList.remove('pm-row--target'));
      row.addEventListener('drop', (event) => {
        if (dragging < 0) return;
        event.preventDefault();
        const [moved] = entries.splice(dragging, 1);
        entries.splice(index, 0, moved);
        dragging = -1;
        render();
      });
      const preview = document.createElement('td');
      const img = document.createElement('img');
      img.className = 'ip-thumb';
      img.src = entry.url;
      img.alt = '';
      preview.append(img);
      const name = document.createElement('td');
      name.className = 'pm-name';
      const size = document.createElement('span');
      size.className = 'ip-size';
      size.textContent = `${entry.width} × ${entry.height} · ${formatBytes(entry.file.size)}`;
      name.append(document.createTextNode(entry.file.name), size);
      const actions = document.createElement('td');
      actions.className = 'pm-actions';
      actions.append(
        button('↑', t('Move up'), () => { [entries[index - 1], entries[index]] = [entries[index], entries[index - 1]]; render(); }, index === 0),
        button('↓', t('Move down'), () => { [entries[index + 1], entries[index]] = [entries[index], entries[index + 1]]; render(); }, index === entries.length - 1),
        button('✕', t('Remove'), () => { URL.revokeObjectURL(entry.url); entries.splice(index, 1); render(); }, false)
      );
      row.append(order, preview, name, actions);
      [order, name].forEach((cell) => { cell.dataset.i18nSkip = ''; });
      return row;
    }));
    field('ipSummary').textContent = entries.length ? t(entries.length === 1 ? '1 image, one page.' : `${entries.length} images, one page each.`) : '';
  }

  // An image as PDF-ready bytes: drawn upright on a canvas, JPEG for photos and PNG
  // where transparency may matter, shrunk where the browser cannot draw it whole.
  async function encode(entry, quality) {
    const bitmap = await createImageBitmap(entry.file);
    let { width, height } = bitmap;
    if (width * height > SAFE_AREA) {
      const factor = Math.sqrt(SAFE_AREA / (width * height));
      width = Math.floor(width * factor);
      height = Math.floor(height * factor);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const png = /png|webp|gif|svg|avif/i.test(entry.file.type);
    if (!png) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, png ? 'image/png' : 'image/jpeg', quality));
    return { bytes: new Uint8Array(await blob.arrayBuffer()), png, width: entry.width, height: entry.height };
  }

  // options: { paper: 'fit' | 'a4' | 'letter', orientation: 'auto' | 'portrait' | 'landscape', margin, quality }
  async function make(options) {
    const out = await PDFLib.PDFDocument.create();
    for (const entry of entries) {
      const image = await encode(entry, options.quality);
      const embedded = image.png ? await out.embedPng(image.bytes) : await out.embedJpg(image.bytes);
      const margin = MARGINS[options.margin] || 0;
      // A pixel is 0.75 point (96 to the inch), the size an image has on screen.
      const naturalWidth = image.width * 0.75;
      const naturalHeight = image.height * 0.75;
      let pageWidth;
      let pageHeight;
      if (options.paper === 'fit') {
        pageWidth = naturalWidth + margin * 2;
        pageHeight = naturalHeight + margin * 2;
      } else {
        [pageWidth, pageHeight] = PAPER[options.paper];
        const landscape = options.orientation === 'landscape' || (options.orientation === 'auto' && image.width > image.height);
        if (landscape) [pageWidth, pageHeight] = [pageHeight, pageWidth];
      }
      const page = out.addPage([pageWidth, pageHeight]);
      const scale = Math.min((pageWidth - margin * 2) / naturalWidth, (pageHeight - margin * 2) / naturalHeight, options.paper === 'fit' ? 1 : Infinity);
      const width = naturalWidth * scale;
      const height = naturalHeight * scale;
      page.drawImage(embedded, { x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height });
    }
    out.setProducer('Toolkit Images to PDF (pdf-lib)');
    return out.save();
  }

  function options() {
    return { paper: field('ipPaper').value, orientation: field('ipOrientation').value, margin: field('ipMargin').value, quality: Number(field('ipQuality').value) / 100 };
  }

  async function download() {
    if (!entries.length) return;
    makeBtn.disabled = true;
    try {
      const bytes = await make(options());
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'images.pdf';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      field('ipResult').textContent = t(`Saved images.pdf: ${formatBytes(bytes.length)}.`);
    } catch (error) {
      showToast(t(error.message), 'error');
    } finally {
      makeBtn.disabled = false;
    }
  }

  dropEl.addEventListener('click', () => fileEl.click());
  dropEl.addEventListener('dragover', (event) => { event.preventDefault(); dropEl.classList.add('drag-over'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-over'));
  dropEl.addEventListener('drop', (event) => { event.preventDefault(); dropEl.classList.remove('drag-over'); addFiles([...event.dataTransfer.files]); });
  fileEl.addEventListener('change', () => { addFiles([...fileEl.files]); fileEl.value = ''; });
  makeBtn.addEventListener('click', download);
  field('ipClear').addEventListener('click', () => { entries.forEach((entry) => URL.revokeObjectURL(entry.url)); entries = []; field('ipResult').textContent = ''; render(); });
  field('ipPaper').addEventListener('change', () => { field('ipOrientationRow').hidden = field('ipPaper').value === 'fit'; });
  field('ipQuality').addEventListener('input', () => { field('ipQualityVal').textContent = `${field('ipQuality').value}%`; });
  window.addEventListener('toolkit:languagechange', render);

  // Exposed for the tests.
  window.ToolkitImagesToPdf = Object.freeze({ addFiles, make: () => make(options()) });
  field('ipQualityVal').textContent = `${field('ipQuality').value}%`;
  field('ipOrientationRow').hidden = field('ipPaper').value === 'fit';
  render();
}());
