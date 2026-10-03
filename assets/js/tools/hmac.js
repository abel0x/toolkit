(function initHmac() {
  'use strict';

  const keyInput    = document.getElementById('hmacKey');
  const msgInput    = document.getElementById('hmacMessage');
  const algoSelect  = document.getElementById('hmacAlgo');
  const genBtn      = document.getElementById('hmacBtn');
  const outputField = document.getElementById('hmacOutput');
  const copyBtn     = document.getElementById('hmacCopyBtn');

  if (!keyInput || !genBtn) return;

  async function generate() {
    const keyStr  = keyInput.value;
    const msgStr  = msgInput.value;
    const algo    = algoSelect ? algoSelect.value : 'SHA-256';

    if (!keyStr) { showToast('Please enter a secret key.', 'error'); return; }
    if (!msgStr) { showToast('Please enter a message.', 'error'); return; }

    try {
      const enc       = new TextEncoder();
      const keyData   = enc.encode(keyStr);
      const msgData   = enc.encode(msgStr);

      const cryptoKey = await crypto.subtle.importKey(
        'raw', keyData,
        { name: 'HMAC', hash: { name: algo } },
        false, ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
      const hex       = bufferToHex(signature);

      if (outputField) outputField.value = hex;
      showToast('HMAC generated!', 'success');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  }

  genBtn.addEventListener('click', generate);

  if (copyBtn && outputField) {
    copyBtn.addEventListener('click', () => {
      if (!outputField.value) { showToast('Nothing to copy.', 'error'); return; }
      copyToClipboard(outputField.value, 'HMAC');
    });
  }
})();
