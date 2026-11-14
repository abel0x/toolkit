/* TOOLKIT — assets/js/tools/favicon-generator.js
   A complete favicon set from a letter, an emoji or an image: PNGs from
   16 to 512 px, a multi-size favicon.ico, site.webmanifest and the HTML
   that links them, one by one or as a ZIP. Drawn in this page. */
(function initFaviconGenerator() {
  'use strict';

  const textEl = document.getElementById('fgText');
  const bgColor = document.getElementById('fgBg');
  const fgColor = document.getElementById('fgFg');
  const fontSizeEl = document.getElementById('fgFontSize');
  const fontSizeVal = document.getElementById('fgFontSizeVal');
  const snippetEl = document.getElementById('fgSnippet');
  const manifestEl = document.getElementById('fgManifest');
  const shapeEl = document.getElementById('fgShape');
  const transparentEl = document.getElementById('fgTransparent');
  const nameEl = document.getElementById('fgName');
  const themeEl = document.getElementById('fgTheme');
  const imageInput = document.getElementById('fgImage');
  const imageName = document.getElementById('fgImageName');
  const fitEl = document.getElementById('fgFit');
  const textOptions = document.getElementById('fgTextOptions');
  const imageOptions = document.getElementById('fgImageOptions');
  if (!textEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const SIZES = [16, 32, 48, 180, 192, 512];
  const FILES = { 16: 'favicon-16x16.png', 32: 'favicon-32x32.png', 48: 'favicon-48x48.png', 180: 'apple-touch-icon.png', 192: 'android-chrome-192x192.png', 512: 'android-chrome-512x512.png' };
  let image = null;

  const source = () => document.querySelector('input[name="fgSource"]:checked')?.value || 'text';

  // Whole characters: an emoji such as 🇹🇷 or 👍🏽 is never cut in half.
  function firstCharacters(text, count) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment).slice(0, count).join('');
    }
    return Array.from(text).slice(0, count).join('');
  }

  function shapePath(ctx, size) {
    ctx.beginPath();
    const shape = shapeEl.value;
    if (shape === 'circle') ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    else if (shape === 'rounded' && ctx.roundRect) ctx.roundRect(0, 0, size, size, size * 0.22);
    else ctx.rect(0, 0, size, size);
  }

  // The Apple icon is never transparent: iOS would fill it with black.
  function drawOn(canvas, size) {
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    const opaque = size === 180 || !transparentEl.checked;
    ctx.save();
    if (size === 180) ctx.rect(0, 0, size, size); else shapePath(ctx, size);
    if (opaque) { ctx.fillStyle = bgColor.value; ctx.fill(); }
    ctx.clip();
    if (source() === 'image' && image) {
      const scale = fitEl.value === 'cover'
        ? Math.max(size / image.width, size / image.height)
        : Math.min(size / image.width, size / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
    } else {
      const text = firstCharacters(textEl.value || '?', 2);
      ctx.fillStyle = fgColor.value;
      ctx.font = `bold ${Math.round(size * (parseInt(fontSizeEl.value, 10) / 100))}px system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, size / 2, size / 2 + size * 0.03);
    }
    ctx.restore();
  }

  function manifest() {
    const name = nameEl.value.trim() || 'My Site';
    return JSON.stringify({
      name,
      short_name: name.length > 12 ? name.slice(0, 12).trim() : name,
      icons: [
        { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
      ],
      theme_color: themeEl.value,
      background_color: transparentEl.checked ? '#ffffff' : bgColor.value,
      display: 'standalone'
    }, null, 2);
  }

  function snippet() {
    return [
      '<link rel="icon" href="/favicon.ico" sizes="48x48" />',
      '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />',
      '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />',
      '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
      '<link rel="manifest" href="/site.webmanifest" />',
      `<meta name="theme-color" content="${themeEl.value}" />`
    ].join('\n');
  }

  function draw() {
    fontSizeVal.textContent = fontSizeEl.value;
    textOptions.hidden = source() !== 'text';
    imageOptions.hidden = source() !== 'image';
    SIZES.forEach((size) => {
      const canvas = document.getElementById(`fgCanvas${size}`);
      if (canvas) drawOn(canvas, size);
    });
    snippetEl.value = snippet();
    manifestEl.value = manifest();
  }

  const pngOf = (size) => new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    drawOn(canvas, size);
    canvas.toBlob(async (blob) => resolve(new Uint8Array(await blob.arrayBuffer())), 'image/png');
  });

  // ICO with PNG images inside (read by every current browser).
  function ico(images) {
    const header = 6 + images.length * 16;
    const total = header + images.reduce((sum, item) => sum + item.data.length, 0);
    const out = new Uint8Array(total);
    const view = new DataView(out.buffer);
    view.setUint16(2, 1, true);
    view.setUint16(4, images.length, true);
    let offset = header;
    images.forEach(({ size, data }, index) => {
      const entry = 6 + index * 16;
      out[entry] = size >= 256 ? 0 : size;
      out[entry + 1] = size >= 256 ? 0 : size;
      view.setUint16(entry + 4, 1, true);
      view.setUint16(entry + 6, 32, true);
      view.setUint32(entry + 8, data.length, true);
      view.setUint32(entry + 12, offset, true);
      out.set(data, offset);
      offset += data.length;
    });
    return out;
  }

  async function icoFile() {
    return ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await pngOf(size) }))));
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

  SIZES.forEach((size) => {
    const button = document.getElementById(`fgDownload${size}`);
    if (button) button.addEventListener('click', async () => save(new Blob([await pngOf(size)], { type: 'image/png' }), FILES[size]));
  });
  document.getElementById('fgIco').addEventListener('click', async () => save(new Blob([await icoFile()], { type: 'image/x-icon' }), 'favicon.ico'));
  document.getElementById('fgZip').addEventListener('click', async () => {
    const encoder = new TextEncoder();
    const files = [{ name: 'favicon.ico', data: await icoFile() }];
    for (const size of SIZES) files.push({ name: FILES[size], data: await pngOf(size) });
    files.push({ name: 'site.webmanifest', data: encoder.encode(manifest() + '\n') });
    files.push({ name: 'favicon-snippet.html', data: encoder.encode(snippet() + '\n') });
    save(window.ToolkitZip.zip(files), 'favicons.zip');
  });

  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) return;
    createImageBitmap(file).then((bitmap) => {
      image = bitmap;
      imageName.textContent = `${file.name} · ${bitmap.width} × ${bitmap.height} px`;
      if (Math.min(bitmap.width, bitmap.height) < 512) showToast(t('The image is smaller than 512 px; the large icons will look soft.'), 'error');
      draw();
    }).catch(() => showToast(t('That file is not an image this browser can show.'), 'error'));
  });

  [textEl, bgColor, fgColor, fontSizeEl, shapeEl, transparentEl, nameEl, themeEl, fitEl].forEach((el) => el.addEventListener('input', draw));
  [shapeEl, fitEl, transparentEl].forEach((el) => el.addEventListener('change', draw));
  document.querySelectorAll('input[name="fgSource"]').forEach((radio) => radio.addEventListener('change', draw));

  // Exposed for the tests.
  window.ToolkitFavicon = Object.freeze({ ico, icoFile, pngOf, manifest, snippet });
  draw();
})();
