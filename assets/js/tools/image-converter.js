/* TOOLKIT — assets/js/tools/image-converter.js
   One image at a time: crop (free or to a ratio, by dragging or by
   numbers), rotate, flip, resize to exact pixels and save as PNG, JPEG,
   WebP or (where the browser can encode it) AVIF. SVG files are drawn at
   any size. Everything happens on canvases in this tab. */
(function initImageConverter() {
  'use strict';

  const field = (id) => document.getElementById(id);
  const dropEl = field('icDrop');
  const fileEl = field('icFile');
  const editorEl = field('icEditor');
  const canvasEl = field('icCanvas');
  const cropEl = field('icCrop');
  const stageEl = field('icStage');
  if (!dropEl || !canvasEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const PREVIEW_MAX = { width: 640, height: 420 };
  const MAX_PIXELS = 50e6;

  let file = null;
  let image = null; // ImageBitmap or HTMLImageElement
  let size = { width: 0, height: 0 }; // source size
  let rotation = 0;
  let flipX = false;
  let flipY = false;
  let crop = { x: 0, y: 0, w: 0, h: 0 }; // in rotated pixels
  let oriented = null; // canvas with rotation and flips applied
  let scale = 1; // preview pixels per image pixel
  let busy = 0;

  const formatBytes = (bytes) => (bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`);

  /* ── Encoders this browser has ──────────────────────────────── */

  const supported = {};
  async function detectFormats() {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 2;
    for (const type of ['image/webp', 'image/avif']) {
      const blob = await new Promise((resolve) => probe.toBlob(resolve, type, 0.8));
      supported[type] = Boolean(blob && blob.type === type);
    }
    const avif = field('icFormat').querySelector('option[value="image/avif"]');
    avif.disabled = !supported['image/avif'];
    avif.textContent = supported['image/avif'] ? 'AVIF' : t('AVIF (this browser cannot save it)');
    field('icFormat').querySelector('option[value="image/webp"]').disabled = !supported['image/webp'];
  }

  /* ── Loading ────────────────────────────────────────────────── */

  async function decode(input) {
    const isSvg = input.type === 'image/svg+xml' || /\.svg$/i.test(input.name);
    if (!isSvg && typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(input); } catch { /* fall back to an <img> */ }
    }
    const url = URL.createObjectURL(input);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      // SVGs without a size come out as 0×0 or 300×150; give them a usable one.
      if (isSvg && (!img.naturalWidth || !img.naturalHeight)) { img.width = 512; img.height = 512; }
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async function load(input) {
    if (!input) return;
    if (!/^image\//.test(input.type) && !/\.(svg|png|jpe?g|webp|avif|gif|bmp|ico)$/i.test(input.name)) {
      showToast(t('Choose an image file.'), 'error');
      return;
    }
    let decoded;
    try {
      decoded = await decode(input);
    } catch {
      showToast(t('This browser cannot open that image.'), 'error');
      return;
    }
    const width = decoded.naturalWidth || decoded.width;
    const height = decoded.naturalHeight || decoded.height;
    if (!width || !height) { showToast(t('This browser cannot open that image.'), 'error'); return; }
    file = input;
    image = decoded;
    size = { width, height };
    rotation = 0;
    flipX = false;
    flipY = false;
    const svg = input.type === 'image/svg+xml' || /\.svg$/i.test(input.name);
    field('icSvgRow').hidden = !svg;
    field('icFormat').value = svg ? 'image/png' : (['image/jpeg', 'image/png', 'image/webp'].includes(input.type) ? input.type : 'image/png');
    field('icSource').textContent = `${input.name} · ${width} × ${height} px · ${formatBytes(input.size)}`;
    editorEl.hidden = false;
    rebuild(true);
  }

  /* ── Geometry ───────────────────────────────────────────────── */

  const turned = () => rotation % 180 !== 0;
  const orientedSize = () => (turned() ? { width: size.height, height: size.width } : { ...size });

  // The source drawn once with rotation and flips; cropping and resizing read from it.
  function buildOriented() {
    const { width, height } = orientedSize();
    const svgScale = field('icSvgRow').hidden ? 1 : Number(field('icSvgScale').value);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * svgScale);
    canvas.height = Math.round(height * svgScale);
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    const drawWidth = size.width * svgScale;
    const drawHeight = size.height * svgScale;
    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    oriented = canvas;
  }

  function ratio() {
    const value = field('icRatio').value;
    if (value === 'free') return null;
    if (value === 'original') return oriented.width / oriented.height;
    const [w, h] = value.split(':').map(Number);
    return w / h;
  }

  // The largest centred rectangle of the chosen ratio.
  function fitCrop() {
    const r = ratio();
    let w = oriented.width;
    let h = oriented.height;
    if (r) {
      if (w / h > r) w = Math.round(h * r); else h = Math.round(w / r);
    }
    crop = { x: Math.round((oriented.width - w) / 2), y: Math.round((oriented.height - h) / 2), w, h };
  }

  function clampCrop() {
    crop.w = Math.max(1, Math.min(Math.round(crop.w), oriented.width));
    crop.h = Math.max(1, Math.min(Math.round(crop.h), oriented.height));
    crop.x = Math.max(0, Math.min(Math.round(crop.x), oriented.width - crop.w));
    crop.y = Math.max(0, Math.min(Math.round(crop.y), oriented.height - crop.h));
  }

  function rebuild(resetCrop) {
    buildOriented();
    if (resetCrop) fitCrop();
    clampCrop();
    drawPreview();
    setOutputFromCrop();
    renderInfo();
  }

  /* ── Preview and crop box ───────────────────────────────────── */

  function drawPreview() {
    // The preview fits the column it is in, so the crop box and the canvas share one scale.
    const room = Math.min(PREVIEW_MAX.width, (stageEl.parentElement.clientWidth || PREVIEW_MAX.width) - 2);
    scale = Math.min(room / oriented.width, PREVIEW_MAX.height / oriented.height, 1);
    const width = Math.max(1, Math.round(oriented.width * scale));
    const height = Math.max(1, Math.round(oriented.height * scale));
    canvasEl.width = width;
    canvasEl.height = height;
    canvasEl.getContext('2d').drawImage(oriented, 0, 0, width, height);
    stageEl.style.width = `${width}px`;
    stageEl.style.height = `${height}px`;
    placeCrop();
  }

  function placeCrop() {
    cropEl.style.left = `${crop.x * scale}px`;
    cropEl.style.top = `${crop.y * scale}px`;
    cropEl.style.width = `${crop.w * scale}px`;
    cropEl.style.height = `${crop.h * scale}px`;
    for (const key of ['x', 'y', 'w', 'h']) field(`icCrop${key.toUpperCase()}`).value = String(crop[key]);
  }

  // Dragging the box moves it; dragging a handle resizes it (keeping the ratio when one is set).
  let drag = null;
  cropEl.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    cropEl.setPointerCapture(event.pointerId);
    drag = { handle: event.target.dataset.handle || 'move', startX: event.clientX, startY: event.clientY, start: { ...crop } };
  });
  cropEl.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const dx = (event.clientX - drag.startX) / scale;
    const dy = (event.clientY - drag.startY) / scale;
    const s = drag.start;
    if (drag.handle === 'move') {
      crop = { ...s, x: s.x + dx, y: s.y + dy };
    } else {
      let { x, y, w, h } = s;
      if (drag.handle.includes('e')) w = s.w + dx;
      if (drag.handle.includes('s')) h = s.h + dy;
      if (drag.handle.includes('w')) { w = s.w - dx; x = s.x + dx; }
      if (drag.handle.includes('n')) { h = s.h - dy; y = s.y + dy; }
      const r = ratio();
      if (r) {
        h = w / r;
        if (drag.handle.includes('n')) y = s.y + s.h - h;
      }
      w = Math.max(8, Math.min(w, drag.handle.includes('w') ? s.x + s.w : oriented.width - x));
      h = r ? w / r : Math.max(8, Math.min(h, drag.handle.includes('n') ? s.y + s.h : oriented.height - y));
      if (drag.handle.includes('w')) x = s.x + s.w - w;
      if (drag.handle.includes('n')) y = s.y + s.h - h;
      crop = { x, y, w, h };
    }
    clampCrop();
    placeCrop();
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    setOutputFromCrop();
    renderInfo();
  };
  cropEl.addEventListener('pointerup', endDrag);
  cropEl.addEventListener('pointercancel', endDrag);

  /* ── Output size ────────────────────────────────────────────── */

  function setOutputFromCrop() {
    field('icWidth').value = String(crop.w);
    field('icHeight').value = String(crop.h);
  }

  function outputSize() {
    const width = Math.max(1, Math.min(20000, Math.round(Number(field('icWidth').value) || crop.w)));
    const height = Math.max(1, Math.min(20000, Math.round(Number(field('icHeight').value) || crop.h)));
    return { width, height };
  }

  function renderInfo() {
    const { width, height } = outputSize();
    const type = field('icFormat').value;
    field('icQualityRow').hidden = type === 'image/png';
    field('icBgRow').hidden = type !== 'image/jpeg';
    field('icQualityVal').textContent = `${field('icQuality').value}%`;
    field('icInfo').textContent = `${t('Output:')} ${width} × ${height} px`;
  }

  /* ── Export ─────────────────────────────────────────────────── */

  // Halving steps keep large reductions sharp; one big drawImage step looks rough.
  function resample(source, sx, sy, sw, sh, width, height) {
    let canvas = source;
    let x = sx; let y = sy; let w = sw; let h = sh;
    while (w / 2 >= width && h / 2 >= height) {
      const step = document.createElement('canvas');
      step.width = Math.round(w / 2);
      step.height = Math.round(h / 2);
      const ctx = step.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, x, y, w, h, 0, 0, step.width, step.height);
      canvas = step; x = 0; y = 0; w = step.width; h = step.height;
    }
    return { canvas, x, y, w, h };
  }

  async function render() {
    const { width, height } = outputSize();
    if (width * height > MAX_PIXELS) throw new Error('The output is too large; keep it under 50 megapixels.');
    const type = field('icFormat').value;
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = field('icBg').value; ctx.fillRect(0, 0, width, height); }
    ctx.imageSmoothingQuality = 'high';
    // The crop is in the pixels of the oriented canvas (an SVG is already drawn there at its chosen scale).
    const source = resample(oriented, crop.x, crop.y, crop.w, crop.h, width, height);
    ctx.drawImage(source.canvas, source.x, source.y, source.w, source.h, 0, 0, width, height);
    const quality = Number(field('icQuality').value) / 100;
    const blob = await new Promise((resolve) => out.toBlob(resolve, type, quality));
    if (!blob || blob.type !== type) throw new Error('This browser cannot save that format.');
    return blob;
  }

  const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif' };

  async function download() {
    if (!image || busy) return;
    busy += 1;
    try {
      const blob = await render();
      const { width, height } = outputSize();
      const base = file.name.replace(/\.[^.]+$/, '') || 'image';
      const name = `${base}-${width}x${height}.${EXTENSIONS[blob.type]}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const change = file.size ? Math.round((blob.size / file.size) * 100) : 0;
      field('icResult').textContent = t(`Saved ${name}: ${formatBytes(blob.size)} (${change}% of the original).`);
    } catch (error) {
      showToast(t(error.message), 'error');
    } finally {
      busy -= 1;
    }
  }

  /* ── Wiring ─────────────────────────────────────────────────── */

  dropEl.addEventListener('click', () => fileEl.click());
  dropEl.addEventListener('dragover', (event) => { event.preventDefault(); dropEl.classList.add('drag-over'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-over'));
  dropEl.addEventListener('drop', (event) => { event.preventDefault(); dropEl.classList.remove('drag-over'); load(event.dataTransfer.files[0]); });
  fileEl.addEventListener('change', () => { load(fileEl.files[0]); fileEl.value = ''; });

  field('icRotateLeft').addEventListener('click', () => { rotation = (rotation + 270) % 360; rebuild(true); });
  field('icRotateRight').addEventListener('click', () => { rotation = (rotation + 90) % 360; rebuild(true); });
  field('icFlipX').addEventListener('click', () => { flipX = !flipX; rebuild(false); });
  field('icFlipY').addEventListener('click', () => { flipY = !flipY; rebuild(false); });
  field('icRatio').addEventListener('change', () => { if (image) rebuild(true); });
  field('icSvgScale').addEventListener('change', () => { if (image) rebuild(true); });
  field('icResetCrop').addEventListener('click', () => { field('icRatio').value = 'free'; if (image) rebuild(true); });

  // Typing the crop box by numbers.
  for (const key of ['x', 'y', 'w', 'h']) {
    field(`icCrop${key.toUpperCase()}`).addEventListener('change', () => {
      crop[key] = Number(field(`icCrop${key.toUpperCase()}`).value) || 0;
      const r = ratio();
      if (r && key === 'w') crop.h = crop.w / r;
      if (r && key === 'h') crop.w = crop.h * r;
      clampCrop();
      placeCrop();
      setOutputFromCrop();
      renderInfo();
    });
  }

  // Width and height follow each other when the ratio is locked.
  field('icWidth').addEventListener('input', () => {
    if (field('icLock').checked && crop.w) field('icHeight').value = String(Math.max(1, Math.round((Number(field('icWidth').value) * crop.h) / crop.w)));
    renderInfo();
  });
  field('icHeight').addEventListener('input', () => {
    if (field('icLock').checked && crop.h) field('icWidth').value = String(Math.max(1, Math.round((Number(field('icHeight').value) * crop.w) / crop.h)));
    renderInfo();
  });
  document.querySelectorAll('[data-ic-scale]').forEach((button) => button.addEventListener('click', () => {
    const factor = Number(button.dataset.icScale);
    field('icWidth').value = String(Math.max(1, Math.round(crop.w * factor)));
    field('icHeight').value = String(Math.max(1, Math.round(crop.h * factor)));
    renderInfo();
  }));
  ['icFormat', 'icQuality', 'icBg'].forEach((id) => field(id).addEventListener('input', renderInfo));
  field('icFormat').addEventListener('change', renderInfo);
  field('icDownload').addEventListener('click', download);

  window.addEventListener('resize', () => { if (image) drawPreview(); });

  // Exposed for the tests.
  window.ToolkitImageConverter = Object.freeze({ render, state: () => ({ size, rotation, flipX, flipY, crop: { ...crop }, output: outputSize() }) });
  detectFormats();
}());
