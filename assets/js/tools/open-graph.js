(function initOpenGraph() {
  'use strict';

  const fields = {
    ogTitle:    document.getElementById('ogTitle'),
    ogDesc:     document.getElementById('ogDesc'),
    ogUrl:      document.getElementById('ogUrl'),
    ogImage:    document.getElementById('ogImage'),
    ogType:     document.getElementById('ogType'),
    ogSite:     document.getElementById('ogSite'),
    twCard:     document.getElementById('twCard'),
    twHandle:   document.getElementById('twHandle')
  };
  const outputEl   = document.getElementById('ogOutput');
  const previewEl  = document.getElementById('ogPreview');
  const prevTitle  = document.getElementById('prevTitle');
  const prevDesc   = document.getElementById('prevDesc');
  const prevUrl    = document.getElementById('prevUrl');
  const imageNotice = document.getElementById('prevImgNotice');
  const imageBox    = document.getElementById('prevImage');
  const imageFile   = document.getElementById('ogImageFile');
  const checksEl    = document.getElementById('ogChecks');
  // A chosen local image is shown with an object URL; nothing is uploaded.
  let localImage = null;

  if (!outputEl) return;

  function translate(key) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key) : key;
  }

  function generate() {
    const t = fields.ogTitle.value.trim();
    const d = fields.ogDesc.value.trim();
    const u = fields.ogUrl.value.trim();
    const i = fields.ogImage.value.trim();
    const type = fields.ogType.value;
    const site = fields.ogSite.value.trim();
    const card = fields.twCard.value;
    const handle = fields.twHandle.value.trim();

    let code = '';
    if (t)    code += `<meta property="og:title" content="${escapeHTML(t)}" />\n`;
    if (d)    code += `<meta property="og:description" content="${escapeHTML(d)}" />\n`;
    if (u)    code += `<meta property="og:url" content="${escapeHTML(u)}" />\n`;
    if (i)    code += `<meta property="og:image" content="${escapeHTML(i)}" />\n`;
    if (type) code += `<meta property="og:type" content="${type}" />\n`;
    if (site) code += `<meta property="og:site_name" content="${escapeHTML(site)}" />\n`;
    code += `\n`;
    if (card)   code += `<meta name="twitter:card" content="${card}" />\n`;
    if (t)      code += `<meta name="twitter:title" content="${escapeHTML(t)}" />\n`;
    if (d)      code += `<meta name="twitter:description" content="${escapeHTML(d)}" />\n`;
    if (i)      code += `<meta name="twitter:image" content="${escapeHTML(i)}" />\n`;
    if (handle) code += `<meta name="twitter:site" content="@${escapeHTML(handle.replace('@',''))}" />\n`;

    outputEl.value = code.trim();

    // Preview, laid out the way the chosen platform shows a shared link.
    const platform = document.querySelector('input[name="ogPlatform"]:checked')?.value || 'facebook';
    let host = 'example.com';
    try { if (u) host = new URL(u).hostname.replace(/^www\./, ''); } catch { host = u; }
    const small = platform === 'whatsapp' || (platform === 'x' && card === 'summary');
    previewEl.className = `og-card og-card--${platform}${small ? ' og-card--small' : ''}`;
    if (prevTitle) prevTitle.textContent = t || translate('Title');
    if (prevDesc)  prevDesc.textContent  = d || translate('Description goes here...');
    if (prevUrl)   prevUrl.textContent   = platform === 'facebook' ? host.toUpperCase() : host;
    if (imageBox) {
      imageBox.style.backgroundImage = localImage ? `url("${localImage.url}")` : '';
      imageBox.classList.toggle('og-card__image--empty', !localImage);
    }
    if (imageNotice) imageNotice.hidden = Boolean(localImage);
    renderChecks(t, d, i);
  }

  // What the big platforms are known to cut or reject.
  function renderChecks(title, description, image) {
    if (!checksEl) return;
    const checks = [];
    const length = (text) => Array.from(text).length;
    checks.push([length(title) > 0 && length(title) <= 60, `Title: ${length(title)} characters (up to 60 show in full).`]);
    checks.push([length(description) > 0 && length(description) <= 155, `Description: ${length(description)} characters (up to 155 show in full).`]);
    const secure = /^https:\/\//i.test(image);
    checks.push([secure, !image ? 'No og:image: most platforms show a plain link.' : secure ? 'Image URL uses HTTPS.' : 'Image URL should use HTTPS.']);
    if (localImage) {
      const ratio = localImage.width / localImage.height;
      checks.push([localImage.width >= 1200 && Math.abs(ratio - 1.91) < 0.1,
        `Chosen image: ${localImage.width} × ${localImage.height} px (1200 × 630, about 1.91:1, suits every platform).`]);
    }
    checksEl.replaceChildren(...checks.map(([ok, text]) => {
      const item = document.createElement('li');
      item.className = ok ? 'og-check og-check--ok' : 'og-check og-check--warn';
      item.textContent = `${ok ? '✓' : '!'} ${translate(text)}`;
      return item;
    }));
  }

  if (imageFile) {
    imageFile.addEventListener('change', () => {
      const file = imageFile.files[0];
      if (!file) return;
      if (localImage) URL.revokeObjectURL(localImage.url);
      // The size comes from the file itself; only this local copy is ever shown.
      createImageBitmap(file).then((bitmap) => {
        localImage = { url: URL.createObjectURL(file), width: bitmap.width, height: bitmap.height };
        bitmap.close();
        generate();
      }).catch(() => showToast(translate('That file is not an image this browser can show.'), 'error'));
    });
  }
  document.querySelectorAll('input[name="ogPlatform"]').forEach((radio) => radio.addEventListener('change', generate));

  Object.values(fields).forEach(el => el && el.addEventListener('input', generate));
  window.addEventListener('toolkit:languagechange', generate);

  document.getElementById('copyOgBtn').addEventListener('click', () => {
    copyToClipboard(outputEl.value, 'OG tags');
  });

  generate();
})();
