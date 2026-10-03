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

    // Preview
    if (prevTitle) prevTitle.textContent = t || translate('Title');
    if (prevDesc)  prevDesc.textContent  = d || translate('Description goes here...');
    if (prevUrl)   prevUrl.textContent   = u || 'https://example.com';
    if (imageNotice) imageNotice.hidden = !i;
  }

  Object.values(fields).forEach(el => el && el.addEventListener('input', generate));
  window.addEventListener('toolkit:languagechange', generate);

  document.getElementById('copyOgBtn').addEventListener('click', () => {
    copyToClipboard(outputEl.value, 'OG tags');
  });

  generate();
})();
