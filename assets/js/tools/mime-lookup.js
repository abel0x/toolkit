(function initMimeLookup() {
  const modeExt = document.getElementById('mime-mode-ext');
  const modeMime = document.getElementById('mime-mode-mime');
  const inputEl = document.getElementById('mime-input');
  const lookupBtn = document.getElementById('mime-btn');
  const resultEl = document.getElementById('mime-result');
  const tableBodyEl = document.getElementById('mime-table-body');
  const tableSearchEl = document.getElementById('mime-table-search');
  if (!inputEl) return;

  const MIME_MAP = {
    html: 'text/html', htm: 'text/html', xhtml: 'application/xhtml+xml',
    css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',
    json: 'application/json', jsonld: 'application/ld+json',
    xml: 'application/xml', xsl: 'application/xslt+xml', xsd: 'application/xml',
    csv: 'text/csv', tsv: 'text/tab-separated-values',
    txt: 'text/plain', md: 'text/markdown', rtf: 'text/rtf',
    pdf: 'application/pdf',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    svg: 'image/svg+xml', svgz: 'image/svg+xml', ico: 'image/x-icon',
    webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff',
    heic: 'image/heic', heif: 'image/heif',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg',
    flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4', opus: 'audio/opus', weba: 'audio/webm',
    mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mkv: 'video/x-matroska',
    avi: 'video/x-msvideo', mov: 'video/quicktime', wmv: 'video/ms-asf', flv: 'video/x-flv', '3gp': 'video/3gpp',
    zip: 'application/zip', tar: 'application/x-tar', gz: 'application/gzip',
    bz2: 'application/x-bzip2', xz: 'application/x-xz', '7z': 'application/x-7z-compressed',
    rar: 'application/x-rar-compressed', br: 'application/x-brotli',
    wasm: 'application/wasm', bin: 'application/octet-stream', exe: 'application/octet-stream',
    dmg: 'application/x-apple-diskimage', deb: 'application/x-debian-package',
    ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', eot: 'application/vnd.ms-fontobject',
    ics: 'text/calendar', vcf: 'text/vcard',
    sh: 'application/x-sh', bash: 'application/x-sh', py: 'text/x-python', rb: 'text/x-ruby',
    php: 'application/x-httpd-php', java: 'text/x-java-source', kt: 'text/x-kotlin',
    ts: 'application/typescript', jsx: 'text/jsx', tsx: 'text/tsx',
    yaml: 'application/yaml', yml: 'application/yaml', toml: 'application/toml',
    ini: 'text/plain', cfg: 'text/plain', conf: 'text/plain', env: 'text/plain',
    map: 'application/json', wsdl: 'application/wsdl+xml',
    epub: 'application/epub+zip', apk: 'application/vnd.android.package-archive',
  };

  // Build reverse map
  const REVERSE_MAP = {};
  Object.entries(MIME_MAP).forEach(([ext, mime]) => {
    if (!REVERSE_MAP[mime]) REVERSE_MAP[mime] = [];
    if (!REVERSE_MAP[mime].includes(ext)) REVERSE_MAP[mime].push(ext);
  });

  function lookup() {
    const val = inputEl.value.trim().toLowerCase();
    if (!val) { showToast('Please enter a value to look up.', 'error'); return; }
    const isExtMode = modeExt && modeExt.checked;
    let html = '';
    if (isExtMode) {
      const ext = val.replace(/^\./, '');
      const mime = MIME_MAP[ext];
      if (mime) {
        html = `<div class="mime-result-item"><span class="mime-ext">.${escapeHTML(ext)}</span><span class="mime-arrow">→</span><code class="mime-type">${escapeHTML(mime)}</code></div>`;
      } else {
        html = `<p class="ix-e9225e">No MIME type found for extension ".${escapeHTML(ext)}".</p>`;
      }
    } else {
      const mime = val;
      const exts = REVERSE_MAP[mime];
      if (exts && exts.length > 0) {
        html = `<div class="mime-result-item"><code class="mime-type">${escapeHTML(mime)}</code><span class="mime-arrow">→</span><span class="mime-exts">${exts.map(e => `<em>.${escapeHTML(e)}</em>`).join(', ')}</span></div>`;
      } else {
        html = `<p class="ix-e9225e">No extensions found for MIME type "${escapeHTML(mime)}".</p>`;
      }
    }
    resultEl.innerHTML = html;
    resultEl.style.display = 'block';
  }

  function renderTable(query) {
    const q = (query || '').toLowerCase().trim();
    const entries = Object.entries(MIME_MAP).filter(([ext, mime]) =>
      !q || ext.includes(q) || mime.includes(q)
    );
    if (!tableBodyEl) return;
    tableBodyEl.innerHTML = entries.map(([ext, mime]) =>
      `<tr><td>.${escapeHTML(ext)}</td><td><code>${escapeHTML(mime)}</code></td></tr>`
    ).join('');
  }

  lookupBtn.addEventListener('click', lookup);
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') lookup(); });
  if (tableSearchEl) {
    tableSearchEl.addEventListener('input', () => renderTable(tableSearchEl.value));
  }

  renderTable('');
})();
