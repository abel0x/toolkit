/* TOOLKIT — assets/js/tools/qr-generator.js */
(function initQRGenerator() {
  'use strict';

  const modeSelect = document.getElementById('qrMode');
  const form = document.getElementById('qrForm');
  const sizeSlider = document.getElementById('qrSize');
  const sizeValue = document.getElementById('qrSizeVal');
  const marginSlider = document.getElementById('qrMargin');
  const marginValue = document.getElementById('qrMarginVal');
  const darkColour = document.getElementById('qrColorDark');
  const lightColour = document.getElementById('qrColorLight');
  const correctionSelect = document.getElementById('qrECC');
  const generateButton = document.getElementById('qrGenBtn');
  const clearButton = document.getElementById('qrClearBtn');
  const output = document.getElementById('qrOutput');
  const canvasWrapper = document.getElementById('qrCanvasWrap');
  const placeholder = document.getElementById('qrPlaceholder');
  const actions = document.getElementById('qrActions');
  const downloadButton = document.getElementById('qrDownloadBtn');
  const copyImageButton = document.getElementById('qrCopyImgBtn');
  if (!modeSelect) return;

  const forms = {
    text: '<div class="qr-form-group"><label for="qrText" class="control-label">Text Content</label><textarea id="qrText" class="textarea" rows="4" placeholder="Enter any text…"></textarea></div>',
    url: '<div class="qr-form-group"><label for="qrURL" class="control-label">URL</label><input id="qrURL" class="input-field" type="url" placeholder="https://example.com" /></div>',
    email: '<div class="qr-form-group"><label for="qrEmail" class="control-label">Email Address</label><input id="qrEmail" class="input-field" type="email" placeholder="hello@example.com" /></div>'
      + '<div class="qr-form-group"><label for="qrEmailSub" class="control-label">Subject (optional)</label><input id="qrEmailSub" class="input-field" placeholder="Hello from Toolkit" /></div>'
      + '<div class="qr-form-group"><label for="qrEmailBody" class="control-label">Body (optional)</label><textarea id="qrEmailBody" class="textarea" rows="3" placeholder="Message body…"></textarea></div>',
    phone: '<div class="qr-form-group"><label for="qrPhone" class="control-label">Phone Number</label><input id="qrPhone" class="input-field" type="tel" placeholder="+1234567890" /></div>',
    sms: '<div class="qr-form-group"><label for="qrSMSPhone" class="control-label">Phone Number</label><input id="qrSMSPhone" class="input-field" type="tel" placeholder="+1234567890" /></div>'
      + '<div class="qr-form-group"><label for="qrSMSMsg" class="control-label">Message</label><textarea id="qrSMSMsg" class="textarea" rows="3" placeholder="Your message…"></textarea></div>',
    wifi: '<div class="qr-form-group"><label for="qrWifiSSID" class="control-label">Network Name (SSID)</label><input id="qrWifiSSID" class="input-field" placeholder="MyNetwork" /></div>'
      + '<div class="qr-form-group"><label for="qrWifiPass" class="control-label">Password</label><input id="qrWifiPass" class="input-field" type="password" placeholder="Password" /></div>'
      + '<div class="qr-form-group"><label for="qrWifiSec" class="control-label">Security</label><select id="qrWifiSec" class="select-field"><option value="WPA">WPA/WPA2</option><option value="WEP">WEP</option><option value="nopass">Open (No Password)</option></select></div>'
      + '<div class="qr-form-group"><label class="checkbox-card ix-d87841" for="qrWifiHidden"><input type="checkbox" id="qrWifiHidden"><span class="checkbox-indicator"></span><span class="checkbox-text">Hidden network</span></label></div>'
  };

  function applyTranslations() {
    if (window.ToolkitI18n) window.ToolkitI18n.apply(form);
  }

  function renderForm(mode) {
    form.innerHTML = forms[mode] || '';
    applyTranslations();
  }

  function wifiEscape(value) {
    return value.replace(/([\\;,:"])/g, '\\$1');
  }

  function fieldValue(id, preserveWhitespace) {
    const value = document.getElementById(id)?.value || '';
    return preserveWhitespace ? value : value.trim();
  }

  function buildContent() {
    switch (modeSelect.value) {
      case 'text': {
        const value = fieldValue('qrText', true);
        return value.trim() ? value : '';
      }
      case 'url':
        return fieldValue('qrURL');
      case 'email': {
        const email = fieldValue('qrEmail');
        if (!email) return '';
        const query = new URLSearchParams();
        const subject = fieldValue('qrEmailSub', true);
        const body = fieldValue('qrEmailBody', true);
        if (subject) query.set('subject', subject);
        if (body) query.set('body', body);
        return `mailto:${email}${query.toString() ? `?${query}` : ''}`;
      }
      case 'phone': {
        const phone = fieldValue('qrPhone');
        return phone ? `tel:${phone}` : '';
      }
      case 'sms': {
        const phone = fieldValue('qrSMSPhone');
        if (!phone) return '';
        const message = fieldValue('qrSMSMsg', true);
        return `sms:${phone}${message ? `?body=${encodeURIComponent(message)}` : ''}`;
      }
      case 'wifi': {
        const ssid = fieldValue('qrWifiSSID', true);
        if (!ssid.trim()) return '';
        const password = fieldValue('qrWifiPass', true);
        const security = fieldValue('qrWifiSec') || 'WPA';
        const hidden = document.getElementById('qrWifiHidden')?.checked ? 'true' : 'false';
        return `WIFI:T:${wifiEscape(security)};S:${wifiEscape(ssid)};P:${wifiEscape(password)};H:${hidden};;`;
      }
      default:
        return '';
    }
  }

  function drawQrCode(content, size, margin, errorCorrection, foreground, background) {
    if (typeof window.qrcode !== 'function') throw new Error('QR library not loaded yet — please try again');
    const code = window.qrcode(0, errorCorrection);
    code.addData(content, 'Byte');
    code.make();

    const modules = code.getModuleCount();
    const totalModules = modules + margin * 2;
    const scale = size / totalModules;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Generated QR code');
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.fillStyle = background;
    context.fillRect(0, 0, size, size);
    context.fillStyle = foreground;

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

  modeSelect.addEventListener('change', () => renderForm(modeSelect.value));
  renderForm('text');

  sizeSlider.addEventListener('input', () => { sizeValue.textContent = `${sizeSlider.value}px`; });
  marginSlider.addEventListener('input', () => { marginValue.textContent = marginSlider.value; });

  generateButton.addEventListener('click', () => {
    const content = buildContent();
    if (!content) {
      showToast('Please fill in the required fields', 'error');
      return;
    }

    output.replaceChildren();
    canvasWrapper?.classList.remove('qr-canvas-wrap--ready');
    placeholder.style.display = 'none';

    try {
      const canvas = drawQrCode(
        content,
        Number.parseInt(sizeSlider.value, 10),
        Number.parseInt(marginSlider.value, 10),
        correctionSelect.value,
        darkColour.value,
        lightColour.value
      );
      output.appendChild(canvas);
      canvasWrapper?.classList.add('qr-canvas-wrap--ready');
      actions.hidden = false;
      showToast('QR code generated!', 'success');
    } catch (error) {
      showToast(`Failed to generate QR: ${error.message}`, 'error');
      placeholder.style.display = '';
      canvasWrapper?.classList.remove('qr-canvas-wrap--ready');
    }
  });

  clearButton.addEventListener('click', () => {
    output.replaceChildren();
    canvasWrapper?.classList.remove('qr-canvas-wrap--ready');
    placeholder.style.display = '';
    actions.hidden = true;
    modeSelect.value = 'text';
    renderForm('text');
    showToast('Cleared', 'success');
  });

  downloadButton.addEventListener('click', () => {
    const canvas = output.querySelector('canvas');
    if (!canvas) {
      showToast('No QR code to download', 'error');
      return;
    }
    const anchor = document.createElement('a');
    anchor.download = 'toolkit-qr.png';
    anchor.href = canvas.toDataURL('image/png');
    anchor.click();
    showToast('Downloaded!', 'success');
  });

  copyImageButton.addEventListener('click', () => {
    const canvas = output.querySelector('canvas');
    if (!canvas) {
      showToast('No QR code to copy', 'error');
      return;
    }
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('Image copied!', 'success');
      } catch {
        showToast('Copy not supported in this browser', 'error');
      }
    }, 'image/png');
  });
}());
