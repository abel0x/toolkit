/* TOOLKIT — assets/js/tools/qr-reader.js */
(function initQRReader() {
  'use strict';

  const dropzone  = document.getElementById('qrDropZone');
  const fileInput = document.getElementById('qrFileInput');
  const canvas    = document.getElementById('qrReaderCanvas');
  const resultEl  = document.getElementById('qrReaderResult');
  if (!dropzone) return;

  function processFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please upload a valid image file', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Image is too large (max 10MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (typeof jsQR === 'undefined') {
          showToast('QR reader library not loaded yet', 'error'); return;
        }
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (!code) {
          resultEl.innerHTML = `<div class="qr-read-result"><p class="error-msg">No QR code detected in this image. Ensure the QR code is clear, well-lit, and not distorted.</p></div>`;
          return;
        }

        const raw = code.data;
        const isURL = /^https?:\/\//i.test(raw);
        const isWifi = raw.startsWith('WIFI:');

        let resultHTML = `<div class="qr-read-result">
          <div class="qr-read-value">
            <code class="qr-read-text" data-i18n-skip>${escapeHTML(raw)}</code>
            <button class="icon-btn" id="qrReadCopyBtn" aria-label="Copy decoded content" title="Copy">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>`;

        if (isURL) {
          resultHTML += `<div class="qr-read-actions">
            <a href="${escapeHTML(raw)}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn--sm">Open Link Safely ↗</a>
          </div>`;
        }

        if (isWifi) {
          const parts = {};
          raw.replace(/WIFI:/, '').split(';').forEach(p => {
            const [k, ...rest] = p.split(':');
            if (k) parts[k] = rest.join(':');
          });
          resultHTML += `<div class="qr-wifi-details ix-a54304">
            <div class="ix-0a5dcd">Wi-Fi Details</div>
            <div class="wifi-row"><span class="wifi-label">SSID</span><span class="wifi-val" data-i18n-skip>${escapeHTML(parts['S'] || '—')}</span></div>
            <div class="wifi-row"><span class="wifi-label">Password</span><span class="wifi-val" data-i18n-skip>${escapeHTML(parts['P'] || '(none)')}</span></div>
            <div class="wifi-row"><span class="wifi-label">Security</span><span class="wifi-val" data-i18n-skip>${escapeHTML(parts['T'] || '—')}</span></div>
            <div class="wifi-row"><span class="wifi-label">Hidden</span><span class="wifi-val">${parts['H'] === 'true' ? 'Yes' : 'No'}</span></div>
          </div>`;
        }

        resultHTML += '</div>';
        resultEl.innerHTML = resultHTML;

        const copyBtn = document.getElementById('qrReadCopyBtn');
        if (copyBtn) copyBtn.addEventListener('click', () => copyToClipboard(raw, 'QR content'));
        dropzone.querySelector('.dropzone-sub').textContent = file.name;
        showToast('QR code decoded!', 'success');
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener('change', (e) => { if (e.target.files[0]) processFile(e.target.files[0]); });

  // Drag and drop
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    processFile(e.dataTransfer.files[0]);
  });
}());
