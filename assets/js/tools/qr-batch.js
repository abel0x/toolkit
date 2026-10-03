/* TOOLKIT — assets/js/tools/qr-batch.js */
(function initQrBatch() {
  'use strict';

  const values = document.getElementById('qrbValues');
  const sizeInput = document.getElementById('qrbSize');
  const generateButton = document.getElementById('qrbGenerate');
  const grid = document.getElementById('qrbGrid');
  const count = document.getElementById('qrbCount');
  if (!values) return;

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

  function createDownloadButton(canvas, index) {
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
        anchor.download = `qr-${index + 1}.png`;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
      }, 'image/png');
    });
    return button;
  }

  function generate() {
    if (typeof window.qrcode !== 'function') {
      showToast('QR library not loaded yet — please try again', 'error');
      return;
    }

    const entries = values.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 50);
    const size = Number.parseInt(sizeInput.value, 10) || 150;
    if (!entries.length) {
      showToast('Enter at least one value', 'error');
      return;
    }

    grid.replaceChildren();
    count.textContent = entries.length === 1
      ? t('Generating one QR code…')
      : t('Generating {{count}} QR codes…', { count: entries.length });

    let generated = 0;
    entries.forEach((entry, index) => {
      try {
        const wrapper = document.createElement('div');
        const label = document.createElement('div');
        const canvas = drawQrCode(entry, size);
        wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:.5rem;background:rgba(255,255,255,.04);border-radius:.75rem;padding:.75rem;';
        label.style.cssText = `font-size:.75rem;color:rgba(255,255,255,.55);text-align:center;word-break:break-all;max-width:${size + 20}px;`;
        label.dataset.i18nSkip = '';
        label.textContent = entry.length > 40 ? `${entry.slice(0, 37)}…` : entry;
        wrapper.append(label, canvas, createDownloadButton(canvas, index));
        grid.appendChild(wrapper);
        generated += 1;
      } catch {
        showToast(`Failed to generate QR for: ${entry}`, 'error');
      }
    });

    count.textContent = generated === 1
      ? t('One QR code generated')
      : t('{{count}} QR codes generated', { count: generated });
  }

  generateButton.addEventListener('click', generate);
}());
