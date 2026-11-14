/* TOOLKIT — assets/js/tools/qr-batch.js */
(function initQrBatch() {
  'use strict';

  const values = document.getElementById('qrbValues');
  const sizeInput = document.getElementById('qrbSize');
  const generateButton = document.getElementById('qrbGenerate');
  const grid = document.getElementById('qrbGrid');
  const count = document.getElementById('qrbCount');
  const namedInput = document.getElementById('qrbNamed');
  const zipButton = document.getElementById('qrbZip');
  if (!values) return;
  // The codes on screen, for "Download all": [{ name, canvas }].
  let made = [];

  const { zip, crc32 } = window.ToolkitZip;

  // File names: the given name (or qr-N), made safe and unique.
  function fileNames(names) {
    const used = new Map();
    return names.map((name, index) => {
      let base = (name || `qr-${index + 1}`).normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
        .replace(/^[\s.-]+|[\s.-]+$/g, '').slice(0, 80) || `qr-${index + 1}`;
      const seen = used.get(base.toLowerCase()) || 0;
      used.set(base.toLowerCase(), seen + 1);
      if (seen) base += `-${seen + 1}`;
      return `${base}.png`;
    });
  }

  // A "name, value" line; either part may be in CSV quotes (doubled "" inside).
  function splitNamed(line) {
    const match = line.match(/^\s*(?:"((?:[^"]|"")*)"|([^,;\t]*))\s*[,;\t]\s*(.*)$/);
    if (!match) return { name: '', value: line };
    let value = match[3];
    const quoted = value.match(/^"((?:[^"]|"")*)"\s*$/);
    if (quoted) value = quoted[1].replace(/""/g, '"');
    return { name: (match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2]).trim(), value };
  }

  function t(key, replacements) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key, replacements) : key.replace(/{{(\w+)}}/g, (_, name) => replacements?.[name] ?? '');
  }

  function drawQrCode(content, size) {
    const code = window.qrcode(0, 'M');
    code.addData(content, 'Byte');
    code.make();

    const modules = code.getModuleCount();
    const margin = 2;
    const scale = size / (modules + margin * 2);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Generated QR code');
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#000000';

    for (let row = 0; row < modules; row++) {
      for (let column = 0; column < modules; column++) {
        if (!code.isDark(row, column)) continue;
        const left = Math.floor((column + margin) * scale);
        const top = Math.floor((row + margin) * scale);
        const right = Math.ceil((column + margin + 1) * scale);
        const bottom = Math.ceil((row + margin + 1) * scale);
        context.fillRect(left, top, right - left, bottom - top);
      }
    }
    return canvas;
  }

  function createDownloadButton(canvas, fileName) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary';
    button.style.cssText = 'font-size:.75rem;padding:.25rem .65rem;';
    button.textContent = 'Download';
    button.addEventListener('click', () => {
      canvas.toBlob((blob) => {
        const anchor = document.createElement('a');
        const objectUrl = URL.createObjectURL(blob);
        anchor.href = objectUrl;
        anchor.download = fileName;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      }, 'image/png');
    });
    return button;
  }

  function generate() {
    if (typeof window.qrcode !== 'function') {
      showToast('QR library not loaded yet — please try again', 'error');
      return;
    }

    const named = namedInput && namedInput.checked;
    const entries = values.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 50)
      .map((line) => (named ? splitNamed(line) : { name: '', value: line })).filter((entry) => entry.value);
    const names = fileNames(entries.map((entry) => entry.name));
    const size = Number.parseInt(sizeInput.value, 10) || 150;
    if (!entries.length) {
      showToast('Enter at least one value', 'error');
      return;
    }

    grid.replaceChildren();
    made = [];
    if (zipButton) zipButton.hidden = true;
    count.textContent = entries.length === 1
      ? t('Generating one QR code…')
      : t('Generating {{count}} QR codes…', { count: entries.length });

    let generated = 0;
    entries.forEach((entry, index) => {
      try {
        const wrapper = document.createElement('div');
        const label = document.createElement('div');
        const canvas = drawQrCode(entry.value, size);
        wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:.5rem;background:rgba(255,255,255,.04);border-radius:.75rem;padding:.75rem;';
        label.style.cssText = `font-size:.75rem;color:rgba(255,255,255,.55);text-align:center;word-break:break-all;max-width:${size + 20}px;`;
        label.dataset.i18nSkip = '';
        const shown = entry.name || entry.value;
        label.textContent = shown.length > 40 ? `${shown.slice(0, 37)}…` : shown;
        wrapper.append(label, canvas, createDownloadButton(canvas, names[index]));
        made.push({ name: names[index], canvas });
        grid.appendChild(wrapper);
        generated += 1;
      } catch {
        showToast(`Failed to generate QR for: ${entry.value}`, 'error');
      }
    });

    if (zipButton) zipButton.hidden = made.length < 2;
    count.textContent = generated === 1
      ? t('One QR code generated')
      : t('{{count}} QR codes generated', { count: generated });
  }

  generateButton.addEventListener('click', generate);
  if (zipButton) {
    zipButton.addEventListener('click', async () => {
      if (!made.length) return;
      const files = await Promise.all(made.map(({ name, canvas }) => new Promise((resolve) => canvas.toBlob(async (blob) => {
        resolve({ name, data: new Uint8Array(await blob.arrayBuffer()) });
      }, 'image/png'))));
      const url = URL.createObjectURL(zip(files));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'qr-codes.zip';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  // Exposed for the tests.
  window.ToolkitQrBatch = Object.freeze({ zip, crc32, splitNamed, fileNames });
}());
