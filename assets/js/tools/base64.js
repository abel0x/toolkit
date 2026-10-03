/* TOOLKIT — assets/js/tools/base64.js */
(function initBase64() {
  'use strict';

  const b64Input    = document.getElementById('b64Input');
  const b64Output   = document.getElementById('b64Output');
  const encodeBtn   = document.getElementById('b64EncodeBtn');
  const decodeBtn   = document.getElementById('b64DecodeBtn');
  const copyBtn     = document.getElementById('b64CopyBtn');
  const errorEl     = document.getElementById('b64Error');

  if (!b64Input) return;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });

  function bytesToBinary(bytes) {
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return binary;
  }

  function decodeUtf8(bytes) {
    try {
      return decoder.decode(bytes);
    } catch {
      throw new Error('Decoded bytes are not valid UTF-8.');
    }
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.hidden = true;
    b64Output.classList.remove('textarea--error');
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function encode() {
    clearError();
    const text = b64Input.value;
    if (!text) { showError('Input is empty.'); return; }

    try {
      b64Output.value = btoa(bytesToBinary(encoder.encode(text)));
    } catch (err) {
      showError('Encoding failed: ' + err.message);
    }
  }

  function decode() {
    clearError();
    const text = b64Input.value.trim();
    if (!text) { showError('Input is empty.'); return; }

    try {
      // Validate Base64 format
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) {
        throw new Error('Invalid Base64 string — found unexpected characters.');
      }
      const binary = atob(text);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      b64Output.value = decodeUtf8(bytes);
    } catch (err) {
      b64Output.value = '';
      showError(err.message || 'Invalid Base64 input.');
    }
  }

  encodeBtn.addEventListener('click', encode);
  decodeBtn.addEventListener('click', decode);
  copyBtn.addEventListener('click', () => copyToClipboard(b64Output.value, 'Output'));

  // Keyboard shortcuts
  b64Input.addEventListener('keydown', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.key === 'Enter')     { e.shiftKey ? decode() : encode(); e.preventDefault(); }
  });
})();
