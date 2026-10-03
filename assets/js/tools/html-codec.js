/* html-codec.js — Toolkit */
(function initHtmlCodec() {
  'use strict';

  var inputEl    = document.getElementById('htmlInput');
  var outputEl   = document.getElementById('htmlOutput');
  var extChk     = document.getElementById('htmlExtended');
  var encodeBtn  = document.getElementById('htmlEncodeBtn');
  var decodeBtn  = document.getElementById('htmlDecodeBtn');
  var clearBtn   = document.getElementById('htmlClearBtn');
  var copyBtn    = document.getElementById('htmlCopyBtn');

  if (!inputEl) return;

  // ─── Encode ────────────────────────────────────────────────────────────────
  function htmlEncode(str) {
    var extended = extChk && extChk.checked;
    var out = '';
    Array.from(str).forEach(function(ch) {
      var code = ch.codePointAt(0);
      if (ch === '&') { out += '&amp;'; }
      else if (ch === '<') { out += '&lt;'; }
      else if (ch === '>') { out += '&gt;'; }
      else if (ch === '"') { out += '&quot;'; }
      else if (ch === "'") { out += '&apos;'; }
      else if (extended && code > 127) { out += '&#' + code + ';'; }
      else { out += ch; }
    });
    return out;
  }

  // ─── Decode ────────────────────────────────────────────────────────────────
  function htmlDecode(str) {
    var ta = document.createElement('textarea');
    ta.innerHTML = str;
    return ta.value;
  }

  // ─── Events ────────────────────────────────────────────────────────────────
  encodeBtn.addEventListener('click', function() {
    var val = inputEl.value;
    if (!val) { showToast('Input is empty.', 'error'); return; }
    outputEl.value = htmlEncode(val);
    showToast('HTML encoded!', 'success');
  });

  decodeBtn.addEventListener('click', function() {
    var val = inputEl.value;
    if (!val) { showToast('Input is empty.', 'error'); return; }
    outputEl.value = htmlDecode(val);
    showToast('HTML decoded!', 'success');
  });

  clearBtn.addEventListener('click', function() {
    inputEl.value  = '';
    outputEl.value = '';
  });

  copyBtn.addEventListener('click', function() {
    if (!outputEl.value) { showToast('Nothing to copy.', 'error'); return; }
    copyToClipboard(outputEl.value, 'HTML output');
  });
})();
