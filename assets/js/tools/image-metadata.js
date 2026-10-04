(function initImageMetadata() {
  'use strict';

  const dropZone  = document.getElementById('imDrop');
  const fileInput = document.getElementById('imFile');
  const preview   = document.getElementById('imPreview');
  const tableEl   = document.getElementById('imTable');

  if (!dropZone) return;

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const url = e.target.result;
      preview.src = url;
      preview.style.display = 'block';
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        function gcd(a, b) { while (b) { const t = b; b = a % b; a = t; } return a; }
        const d = gcd(w, h);
        const ratio = `${w/d}:${h/d}`;
        const rows = [
          ['Filename', file.name],
          ['File Type', file.type || 'unknown'],
          ['File Size', formatBytes(file.size)],
          ['Width', `${w} px`],
          ['Height', `${h} px`],
          ['Aspect Ratio', ratio],
          ['Last Modified', new Date(file.lastModified).toLocaleString()],
          ['Base64 Size (est.)', formatBytes(Math.ceil(file.size * 4 / 3))]
        ];
        let html = '<table class="ix-c2b3a0">';
        rows.forEach(([k,v]) => {
          html += `<tr><td class="ix-f3ad31">${k}</td><td class="font-mono ix-470b04" data-i18n-skip>${escapeHTML(v)}</td></tr>`;
        });
        html += '</table>';
        tableEl.innerHTML = html;
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  }

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
})();
