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

  /* A ZIP archive with stored (uncompressed) files: PNG is compressed
     already. Local headers, a central directory and its end record, with
     UTF-8 names (flag bit 11) and CRC-32. */
  const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    const encoder = new TextEncoder();
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const file of files) {
      const name = encoder.encode(file.name);
      const crc = crc32(file.data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true); local.setUint16(10, time, true); local.setUint16(12, date, true);
      local.setUint32(14, crc, true); local.setUint32(18, file.data.length, true); local.setUint32(22, file.data.length, true);
      local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true); central.setUint16(4, 20, true); central.setUint16(6, 20, true);
      central.setUint16(8, 0x0800, true); central.setUint16(10, 0, true); central.setUint16(12, time, true);
      central.setUint16(14, date, true); central.setUint32(16, crc, true); central.setUint32(20, file.data.length, true);
      central.setUint32(24, file.data.length, true); central.setUint16(28, name.length, true);
      central.setUint32(42, offset, true);
      locals.push(new Uint8Array(local.buffer), name, file.data);
      centrals.push(new Uint8Array(central.buffer), name);
      offset += 30 + name.length + file.data.length;
    }
    const size = centrals.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob([...locals, ...centrals, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

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
