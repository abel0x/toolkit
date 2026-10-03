/* base32.js — Toolkit */
(function initBase32() {
  'use strict';

  var inputEl   = document.getElementById('base32Input');
  var outputEl  = document.getElementById('base32Output');
  var encodeBtn = document.getElementById('base32EncodeBtn');
  var decodeBtn = document.getElementById('base32DecodeBtn');
  var clearBtn  = document.getElementById('base32ClearBtn');
  var copyBtn   = document.getElementById('base32CopyBtn');

  if (!inputEl) return;

  var ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  var PADDING  = '=';
  var encoder  = new TextEncoder();
  var decoder  = new TextDecoder('utf-8', { fatal: true });

  function decodeUtf8(bytes) {
    try {
      return decoder.decode(new Uint8Array(bytes));
    } catch {
      throw new Error('Decoded bytes are not valid UTF-8.');
    }
  }

  // ─── Encode ────────────────────────────────────────────────────────────────
  function base32Encode(str) {
    var bytes = encoder.encode(str);

    var bits   = 0;
    var value  = 0;
    var output = '';

    for (var b = 0; b < bytes.length; b++) {
      value = (value << 8) | bytes[b];
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        output += ALPHABET[(value >>> bits) & 0x1f];
      }
    }

    if (bits > 0) {
      output += ALPHABET[(value << (5 - bits)) & 0x1f];
    }

    var padLen = (8 - (output.length % 8)) % 8;
    for (var p = 0; p < padLen; p++) output += PADDING;

    return output;
  }

  // ─── Decode ────────────────────────────────────────────────────────────────
  function base32Decode(str) {
    str = str.toLocaleUpperCase('en-US').replace(/\s+/g, '').replace(/=+$/, '');

    if (![0, 2, 4, 5, 7].includes(str.length % 8)) {
      throw new Error('Invalid Base32 length.');
    }

    var bits   = 0;
    var value  = 0;
    var bytes  = [];

    for (var i = 0; i < str.length; i++) {
      var idx = ALPHABET.indexOf(str.charAt(i));
      if (idx === -1) throw new Error('Invalid Base32 character.');
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((value >>> bits) & 0xff);
      }
    }

    return decodeUtf8(bytes);
  }

  // ─── Event handlers ────────────────────────────────────────────────────────
  encodeBtn.addEventListener('click', function() {
    var val = inputEl.value;
    if (!val) { showToast('Input is empty.', 'error'); return; }
    try {
      outputEl.value = base32Encode(val);
      showToast('Encoded to Base32!', 'success');
    } catch (e) {
      showToast('Encode error: ' + e.message, 'error');
    }
  });

  decodeBtn.addEventListener('click', function() {
    var val = inputEl.value.trim();
    if (!val) { showToast('Input is empty.', 'error'); return; }
    try {
      outputEl.value = base32Decode(val);
      showToast('Decoded from Base32!', 'success');
    } catch (e) {
      showToast('Decode error: ' + e.message, 'error');
    }
  });

  clearBtn.addEventListener('click', function() {
    inputEl.value  = '';
    outputEl.value = '';
  });

  copyBtn.addEventListener('click', function() {
    if (!outputEl.value) { showToast('Nothing to copy.', 'error'); return; }
    copyToClipboard(outputEl.value, 'Base32 output');
  });
})();
