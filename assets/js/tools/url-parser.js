(function initUrlParser() {
  'use strict';

  const urlInput  = document.getElementById('urlInput');
  const parseBtn  = document.getElementById('parseBtn');
  const resultEl  = document.getElementById('urlResult');
  const paramsEl  = document.getElementById('urlParams');

  if (!urlInput) return;

  const FIELDS = [
    { key: 'protocol', label: 'Protocol' },
    { key: 'hostname', label: 'Host' },
    { key: 'port',     label: 'Port' },
    { key: 'pathname', label: 'Pathname' },
    { key: 'search',   label: 'Search' },
    { key: 'hash',     label: 'Hash' },
    { key: 'origin',   label: 'Origin' }
  ];

  function createCopyButton(value, label) {
    const button = document.createElement('button');
    button.className = 'btn btn-secondary';
    button.type = 'button';
    button.style.cssText = 'margin-top:.5rem;padding:.15rem .45rem;font-size:.7rem;';
    button.textContent = 'Copy';
    button.addEventListener('click', () => copyToClipboard(value, label));
    return button;
  }

  function parse() {
    const raw = urlInput.value.trim();
    if (!raw) return;
    let url;
    try {
      url = new URL(raw);
    } catch {
      showToast('Invalid URL', 'error');
      resultEl.innerHTML = '';
      paramsEl.innerHTML = '';
      return;
    }

    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.75rem;margin-bottom:1.5rem;">';
    FIELDS.forEach(f => {
      const val = url[f.key] || '—';
      html += `<div style="background:rgba(0,0,0,.25);border-radius:.5rem;padding:.75rem 1rem;">
        <div style="font-size:.75rem;font-weight:600;color:rgba(255,255,255,.45);margin-bottom:.25rem;">${f.label}</div>
        <div class="font-mono" style="font-size:.875rem;word-break:break-all;" data-i18n-skip>${escapeHTML(val)}</div>
        <div class="url-copy-slot" data-url-copy="${f.key}"></div>
      </div>`;
    });
    html += '</div>';
    resultEl.innerHTML = html;
    FIELDS.forEach(f => {
      const value = url[f.key] || '—';
      resultEl.querySelector(`[data-url-copy="${f.key}"]`)
        .appendChild(createCopyButton(value, f.label));
    });

    // Query params table
    const params = [...url.searchParams.entries()];
    if (params.length === 0) {
      paramsEl.innerHTML = '<p style="color:rgba(255,255,255,.4);font-size:.875rem;">No query parameters.</p>';
      return;
    }
    let thtml = '<h3 style="margin-bottom:.75rem;font-size:.9rem;font-weight:600;">Query Parameters</h3>';
    thtml += '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.875rem;">';
    thtml += '<thead><tr><th style="text-align:left;padding:.4rem .6rem;border-bottom:1px solid rgba(255,255,255,.1);">Key</th><th style="text-align:left;padding:.4rem .6rem;border-bottom:1px solid rgba(255,255,255,.1);">Value</th><th></th></tr></thead><tbody>';
    params.forEach(([k, v], index) => {
      thtml += `<tr>
        <td class="font-mono" style="padding:.35rem .6rem;color:var(--accent-cyan,#00d4ff);" data-i18n-skip>${escapeHTML(k)}</td>
        <td class="font-mono" style="padding:.35rem .6rem;word-break:break-all;" data-i18n-skip>${escapeHTML(v)}</td>
        <td class="url-param-copy" style="padding:.35rem .6rem;" data-param-copy="${index}"></td>
      </tr>`;
    });
    thtml += '</tbody></table></div>';
    paramsEl.innerHTML = thtml;
    params.forEach(([, value], index) => {
      const button = createCopyButton(value, 'Value');
      button.style.marginTop = '0';
      paramsEl.querySelector(`[data-param-copy="${index}"]`).appendChild(button);
    });
  }

  parseBtn.addEventListener('click', parse);
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') parse(); });
})();
