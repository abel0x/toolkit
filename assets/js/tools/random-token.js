(function initRandomToken() {
  'use strict';

  const lengthSlider  = document.getElementById('rtLength');
  const lengthDisplay = document.getElementById('rtLengthVal');
  const formatSelect  = document.getElementById('rtFormat');
  const genBtn        = document.getElementById('rtGenBtn');
  const outputArea    = document.getElementById('rtOutput');
  const copyBtn       = document.getElementById('rtCopyBtn');

  if (!genBtn || !outputArea) return;

  function hexToken(byteLen) {
    const arr = new Uint8Array(byteLen);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function base64urlToken(byteLen) {
    const arr = new Uint8Array(byteLen);
    crypto.getRandomValues(arr);
    let bin = '';
    arr.forEach(b => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64Token(byteLen) {
    const arr = new Uint8Array(byteLen);
    crypto.getRandomValues(arr);
    let binary = '';
    arr.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function alphanumToken(charLen) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < charLen; i++) result += chars[secureRandInt(chars.length)];
    return result;
  }

  function generate() {
    const len    = parseInt(lengthSlider ? lengthSlider.value : 32, 10);
    const fmt    = formatSelect ? formatSelect.value : 'hex';
    const count  = 1;
    const tokens = [];

    for (let i = 0; i < count; i++) {
      if (fmt === 'hex')              tokens.push(hexToken(len));
      else if (fmt === 'base64')     tokens.push(base64Token(len));
      else if (fmt === 'base64url')  tokens.push(base64urlToken(len));
      else                           tokens.push(alphanumToken(len));
    }

    outputArea.value = tokens.join('\n');
    showToast(`${count} token${count > 1 ? 's' : ''} generated!`, 'success');
  }

  if (lengthSlider && lengthDisplay) {
    lengthSlider.addEventListener('input', () => {
      lengthDisplay.textContent = lengthSlider.value;
    });
  }

  genBtn.addEventListener('click', generate);

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!outputArea.value) { showToast('Nothing to copy.', 'error'); return; }
      copyToClipboard(outputArea.value, 'Tokens');
    });
  }

  // Generate one token on load
  generate();
})();
