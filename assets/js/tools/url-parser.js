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

    let html = '<div class="ix-5701ee">';
    FIELDS.forEach(f => {
      const val = url[f.key] || '—';
      html += `<div class="ix-083b22">
        <div class="ix-0efce3">${f.label}</div>
        <div class="font-mono ix-259d0e" data-i18n-skip>${escapeHTML(val)}</div>
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
      paramsEl.innerHTML = '<p class="ix-45f28c">No query parameters.</p>';
      return;
    }
    let thtml = '<h3 class="ix-70f621">Query Parameters</h3>';
    thtml += '<div class="ix-42d445"><table class="ix-c2b3a0">';
    thtml += '<thead><tr><th class="ix-47aec6">Key</th><th class="ix-47aec6">Value</th><th></th></tr></thead><tbody>';
    params.forEach(([k, v], index) => {
      thtml += `<tr>
        <td class="font-mono ix-45e499" data-i18n-skip>${escapeHTML(k)}</td>
        <td class="font-mono ix-14931a" data-i18n-skip>${escapeHTML(v)}</td>
        <td class="url-param-copy ix-78e2f5" data-param-copy="${index}"></td>
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
