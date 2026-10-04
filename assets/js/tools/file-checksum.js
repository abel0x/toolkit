/* file-checksum.js — Toolkit */
(function initFileChecksum() {
  'use strict';

  var drop        = document.getElementById('checksumDrop');
  var fileInput   = document.getElementById('checksumFileInput');
  var results     = document.getElementById('checksumResults');
  var resultInner = document.getElementById('checksumResultInner');
  var progress    = document.getElementById('checksumProgress');
  var progressBar = document.getElementById('checksumProgressBar');
  var progressLbl = document.getElementById('checksumProgressLabel');

  if (!drop) return;

  // Each selection gets a sequence number so a slower, older file cannot
  // overwrite the results of the file the user picked last.
  var latestRun = 0;

  // ─── Drag & drop ──────────────────────────────────────────────────────────
  drop.addEventListener('click', function() { fileInput.click(); });
  drop.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });
  drop.addEventListener('dragover', function(e) {
    e.preventDefault();
    drop.style.borderColor = '#00d4ff';
    drop.style.background  = 'rgba(0,212,255,.05)';
  });
  drop.addEventListener('dragleave', function() {
    drop.style.borderColor = '';
    drop.style.background  = '';
  });
  drop.addEventListener('drop', function(e) {
    e.preventDefault();
    drop.style.borderColor = '';
    drop.style.background  = '';
    var file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });
  fileInput.addEventListener('change', function() {
    if (fileInput.files[0]) processFile(fileInput.files[0]);
  });

  // Copy buttons are rendered with the results; one delegated listener keeps them free of inline handlers.
  resultInner.addEventListener('click', function(e) {
    var button = e.target.closest('[data-copy-value]');
    if (button) copyToClipboard(button.dataset.copyValue, button.dataset.copyLabel);
  });

  // ─── Core ──────────────────────────────────────────────────────────────────
  function getSelectedAlgos() {
    var algos = [];
    ['SHA-1', 'SHA-256', 'SHA-512'].forEach(function(algo) {
      var id = 'algo' + algo.replace('-', '');
      var cb = document.getElementById(id);
      if (cb && cb.checked) algos.push(algo);
    });
    return algos;
  }

  function processFile(file) {
    var algos = getSelectedAlgos();
    if (!algos.length) {
      showToast('Select at least one algorithm.', 'error');
      return;
    }

    var run = ++latestRun;
    progress.style.display = 'block';
    results.style.display  = 'none';
    progressBar.style.width = '0%';
    progressLbl.textContent = 'Reading file…';

    var reader = new FileReader();
    reader.onprogress = function(e) {
      if (run !== latestRun) return;
      if (e.lengthComputable) {
        progressBar.style.width = Math.round((e.loaded / e.total) * 40) + '%';
      }
    };
    reader.onload = function(e) {
      if (run !== latestRun) return;
      progressLbl.textContent = 'Computing hashes…';
      var buffer = e.target.result;
      var total  = algos.length;
      var done   = 0;
      var hashes = {};

      algos.forEach(function(algo) {
        crypto.subtle.digest(algo, buffer).then(function(hashBuf) {
          if (run !== latestRun) return;
          hashes[algo] = bufferToHex(hashBuf);
          done++;
          progressBar.style.width = (40 + Math.round((done / total) * 60)) + '%';
          if (done === total) renderResults(file, hashes, algos);
        }).catch(function(err) {
          showToast('Error computing ' + algo + ': ' + err.message, 'error');
        });
      });
    };
    reader.onerror = function() {
      if (run !== latestRun) return;
      showToast('Failed to read file.', 'error');
      progress.style.display = 'none';
    };
    reader.readAsArrayBuffer(file);
  }

  function renderResults(file, hashes, algos) {
    progress.style.display = 'none';
    progressBar.style.width = '0%';

    var html = '<div class="ix-f267e3">'
      + '<p class="ix-668afc" data-i18n-skip>' + escapeHTML(file.name) + '</p>'
      + '<p class="ix-75a20e" data-i18n-skip>' + formatBytes(file.size) + ' · ' + escapeHTML(file.type || 'unknown type') + '</p>'
      + '</div>'
      + '<div class="ix-8f3ba3">';

    algos.forEach(function(algo) {
      var hash = hashes[algo] || '';
      html += '<div>'
        + '<p class="ix-12bf27">' + algo + '</p>'
        + '<div class="ix-a31385">'
        + '<code class="font-mono ix-9ecc74" data-i18n-skip>' + escapeHTML(hash) + '</code>'
        + '<button class="btn btn-ghost ix-ee468f" data-copy-value="' + escapeHTML(hash) + '" data-copy-label="' + algo + ' hash">Copy</button>'
        + '</div>'
        + '</div>';
    });

    html += '</div>';
    resultInner.innerHTML = html;
    results.style.display = 'block';
    showToast('Checksums computed!', 'success');
  }
})();
