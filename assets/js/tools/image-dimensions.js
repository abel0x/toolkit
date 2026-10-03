(function initImageDimensions() {
  'use strict';

  const dropZone  = document.getElementById('idDrop');
  const fileInput = document.getElementById('idFile');
  const tableBody = document.getElementById('idTableBody');
  const clearBtn  = document.getElementById('idClearBtn');
  const countEl   = document.getElementById('idCount');

  if (!dropZone) return;

  let results = [];

  function gcd(a, b) { while (b) { const t = b; b = a % b; a = t; } return a; }

  function processFiles(files) {
    [...files].forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth, h = img.naturalHeight;
          const d = gcd(w, h);
          results.push({
            name: file.name,
            w, h,
            ratio: `${w/d}:${h/d}`,
            size: file.size,
            mp: ((w * h) / 1_000_000).toFixed(2)
          });
          renderTable();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderTable() {
    countEl.textContent = `${results.length} image${results.length !== 1 ? 's' : ''}`;
    let html = '';
    results.forEach((r, i) => {
      html += `<tr>
        <td style="padding:.4rem .6rem;" data-i18n-skip>${escapeHTML(r.name)}</td>
        <td class="font-mono" style="padding:.4rem .6rem;white-space:nowrap;">${r.w} × ${r.h}</td>
        <td class="font-mono" style="padding:.4rem .6rem;">${r.ratio}</td>
        <td class="font-mono" style="padding:.4rem .6rem;">${formatBytes(r.size)}</td>
        <td class="font-mono" style="padding:.4rem .6rem;">${r.mp} MP</td>
      </tr>`;
    });
    tableBody.innerHTML = html;
  }

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); processFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', () => processFiles(fileInput.files));
  clearBtn.addEventListener('click', () => { results = []; renderTable(); });
})();
