(function initUrlParser() {
  'use strict';

  const urlInput  = document.getElementById('urlInput');
  const parseBtn  = document.getElementById('parseBtn');
  const resultEl  = document.getElementById('urlResult');
  const paramsEl  = document.getElementById('urlParams');

  if (!urlInput) return;

  const FIELDS = [
    { key: 'protocol', label: 'Protocol' },
    { key: 'username', label: 'Username', optional: true },
    { key: 'password', label: 'Password', optional: true },
    { key: 'hostname', label: 'Host' },
    { key: 'unicodeHost', label: 'Host (Unicode)', optional: true },
    { key: 'port',     label: 'Port' },
    { key: 'pathname', label: 'Pathname' },
    { key: 'decodedPath', label: 'Pathname (decoded)', optional: true },
    { key: 'search',   label: 'Search' },
    { key: 'hash',     label: 'Hash' },
    { key: 'origin',   label: 'Origin' }
  ];

  // RFC 3492 Punycode, to show "xn--" labels of a host in Unicode.
  function punycodeDecode(input) {
    const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
    const adapt = (delta, points, first) => {
      delta = first ? Math.floor(delta / damp) : delta >> 1;
      delta += Math.floor(delta / points);
      let k = 0;
      while (delta > ((base - tMin) * tMax) >> 1) { delta = Math.floor(delta / (base - tMin)); k += base; }
      return k + Math.floor(((base - tMin + 1) * delta) / (delta + skew));
    };
    const output = [];
    let n = 128, bias = 72, i = 0;
    const basic = Math.max(input.lastIndexOf('-'), 0);
    for (let j = 0; j < basic; j += 1) output.push(input.charCodeAt(j));
    for (let index = basic > 0 ? basic + 1 : 0; index < input.length;) {
      const oldi = i;
      let w = 1;
      for (let k = base; ; k += base) {
        if (index >= input.length) throw new Error('Bad punycode.');
        const code = input.charCodeAt(index++);
        const digit = code - 48 < 10 ? code - 22 : code - 65 < 26 ? code - 65 : code - 97 < 26 ? code - 97 : base;
        if (digit >= base) throw new Error('Bad punycode.');
        i += digit * w;
        const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
        if (digit < t) break;
        w *= base - t;
      }
      const length = output.length + 1;
      bias = adapt(i - oldi, length, oldi === 0);
      n += Math.floor(i / length);
      i %= length;
      output.splice(i++, 0, n);
    }
    return String.fromCodePoint(...output);
  }

  function details(url) {
    const values = {};
    FIELDS.forEach((field) => { values[field.key] = url[field.key] || ''; });
    try {
      const unicode = url.hostname.split('.').map((label) => (label.startsWith('xn--') ? punycodeDecode(label.slice(4)) : label)).join('.');
      if (unicode !== url.hostname) values.unicodeHost = unicode;
    } catch { /* not valid punycode: leave the host as it is */ }
    try {
      const decoded = decodeURIComponent(url.pathname);
      if (decoded !== url.pathname) values.decodedPath = decoded;
    } catch { /* malformed escapes */ }
    return values;
  }

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

    const values = details(url);
    const shown = FIELDS.filter((f) => !f.optional || values[f.key]);
    let html = '<div class="ix-5701ee">';
    shown.forEach(f => {
      const val = values[f.key] || '—';
      html += `<div class="ix-083b22">
        <div class="ix-0efce3">${f.label}</div>
        <div class="font-mono ix-259d0e" data-i18n-skip>${escapeHTML(val)}</div>
        <div class="url-copy-slot" data-url-copy="${f.key}"></div>
      </div>`;
    });
    html += '</div>';
    resultEl.innerHTML = html;
    shown.forEach(f => {
      const value = values[f.key] || '—';
      resultEl.querySelector(`[data-url-copy="${f.key}"]`)
        .appendChild(createCopyButton(value, f.label));
    });

    // Query params table
    const params = [...url.searchParams.entries()];
    if (params.length === 0) {
      paramsEl.innerHTML = '<p class="ix-45f28c">No query parameters.</p>';
      return;
    }
    let thtml = '<h2 class="ix-70f621">Query Parameters</h2>';
    thtml += '<div class="ix-42d445"><table class="ix-c2b3a0">';
    thtml += '<thead><tr><th class="ix-47aec6">Key</th><th class="ix-47aec6">Value</th><th><span class="sr-only">Copy</span></th></tr></thead><tbody>';
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
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); parse(); } });
})();
