/* ═══════════════════════════════════════════════════════════
   Toolkit — 22 browser-only expansion tools
   No network calls, analytics, storage of tool input, or CDN dependency.
   ═══════════════════════════════════════════════════════════ */

(function initExpansionTools() {
  'use strict';

  const app = document.getElementById('toolApp');
  if (!app) return;

  const tool = app.dataset.tool;
  const $ = (selector, root = app) => root.querySelector(selector);
  const $$ = (selector, root = app) => [...root.querySelectorAll(selector)];
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const t = (key, values) => window.ToolkitI18n?.t(key, values) || key;
  const locale = () => window.ToolkitI18n?.getLanguage() || 'en';

  function toast(message, type = 'success') {
    if (typeof showToast === 'function') showToast(t(message), type);
  }

  function applyI18n() {
    window.ToolkitI18n?.apply(app);
  }

  function render(markup, setup) {
    app.innerHTML = markup;
    applyI18n();
    setup?.();
  }

  function base64(bytes) {
    let binary = '';
    new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function fromBase64(value) {
    const binary = atob(value.replace(/\s/g, ''));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  function toPem(buffer, label) {
    const body = base64(buffer).match(/.{1,64}/g)?.join('\n') || '';
    return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
  }

  function pemBytes(value) {
    return fromBase64(value.replace(/-----[^-]+-----/g, ''));
  }

  function download(name, content, type = 'text/plain;charset=utf-8') {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  function outputArea(id = 'toolOutput', rows = 12) {
    return `<div class="form-group"><label class="form-label" for="${id}">${t('Output')}</label><textarea id="${id}" class="form-control font-mono" rows="${rows}" readonly spellcheck="false"></textarea></div>`;
  }

  async function deriveAesKey(passphrase, salt) {
    const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  function initAesGcm() {
    render(`
      <div class="tool-split"><div class="tool-col">
        <label class="form-label" for="aesText">Text or encrypted payload</label><textarea id="aesText" class="form-control font-mono" rows="9" placeholder="Type text to encrypt, or paste a Toolkit AES payload to decrypt."></textarea>
        <label class="form-label ix-dab43f" for="aesPass">Passphrase</label><input id="aesPass" type="password" class="form-control" autocomplete="new-password" placeholder="A strong passphrase" />
        <div class="btn-row ix-dab43f"><button class="btn btn-primary" id="aesEncrypt">Encrypt</button><button class="btn btn-secondary" id="aesDecrypt">Decrypt</button></div>
      </div><div class="tool-col">${outputArea('aesOutput', 14)}<p class="form-hint">Uses PBKDF2-SHA-256 (150,000 iterations) and AES-256-GCM. Nothing leaves this browser.</p></div></div>`, () => {
      async function run(mode) {
        const value = $('#aesText').value;
        const passphrase = $('#aesPass').value;
        const output = $('#aesOutput');
        if (!value || !passphrase) return toast('Enter text and a passphrase.', 'error');
        if (!crypto?.subtle) return toast('Web Crypto is unavailable in this browser.', 'error');
        try {
          if (mode === 'encrypt') {
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const key = await deriveAesKey(passphrase, salt);
            const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value));
            output.value = JSON.stringify({ v: 1, alg: 'AES-256-GCM', salt: base64(salt), iv: base64(iv), data: base64(encrypted) }, null, 2);
          } else {
            const payload = JSON.parse(value);
            if (!payload?.salt || !payload?.iv || !payload?.data) throw new Error('This is not a valid Toolkit AES payload.');
            const key = await deriveAesKey(passphrase, fromBase64(payload.salt));
            const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(payload.iv) }, key, fromBase64(payload.data));
            output.value = decoder.decode(decrypted);
          }
        } catch (error) { toast(error.message || 'Encryption operation failed.', 'error'); }
      }
      $('#aesEncrypt').addEventListener('click', () => run('encrypt'));
      $('#aesDecrypt').addEventListener('click', () => run('decrypt'));
    });
  }

  function initRsaKeypair() {
    render(`
      <div class="form-group"><label class="form-label" for="rsaSize">Key size</label><select id="rsaSize" class="form-control form-select"><option value="2048">2048 bits (recommended)</option><option value="3072">3072 bits</option></select></div>
      <button class="btn btn-primary" id="rsaGenerate">Generate RSA key pair</button>
      <div class="tool-split ix-dab43f"><div class="tool-col">${outputArea('rsaPublic', 12)}</div><div class="tool-col">${outputArea('rsaPrivate', 12)}</div></div>
      <div class="btn-row"><button class="btn btn-secondary" id="rsaPublicJwk">Copy public JWK</button><button class="btn btn-secondary" id="rsaPrivateJwk">Copy private JWK</button></div>`, () => {
      let pair;
      let publicJwk;
      let privateJwk;
      $('#rsaGenerate').addEventListener('click', async () => {
        if (!crypto?.subtle) return toast('Web Crypto is unavailable in this browser.', 'error');
        const button = $('#rsaGenerate');
        button.disabled = true; button.textContent = 'Generating…';
        try {
          pair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: Number($('#rsaSize').value), publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
          const publicPem = toPem(await crypto.subtle.exportKey('spki', pair.publicKey), 'PUBLIC KEY');
          const privatePem = toPem(await crypto.subtle.exportKey('pkcs8', pair.privateKey), 'PRIVATE KEY');
          publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
          privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
          $('#rsaPublic').value = publicPem;
          $('#rsaPrivate').value = privatePem;
          toast('RSA key pair generated locally.');
        } catch (error) { toast(error.message || 'Key generation failed.', 'error'); }
        finally { button.disabled = false; button.textContent = 'Generate RSA key pair'; }
      });
      $('#rsaPublicJwk').addEventListener('click', () => publicJwk ? copyToClipboard(JSON.stringify(publicJwk, null, 2), 'Public JWK') : toast('Generate a key pair first.', 'error'));
      $('#rsaPrivateJwk').addEventListener('click', () => privateJwk ? copyToClipboard(JSON.stringify(privateJwk, null, 2), 'Private JWK') : toast('Generate a key pair first.', 'error'));
    });
  }

  function initPemJwk() {
    render(`
      <label class="form-label" for="pemInput">PEM or JWK</label><textarea id="pemInput" class="form-control font-mono" rows="13" placeholder="Paste an RSA SPKI/PKCS#8 PEM key or a JWK object."></textarea>
      <div class="btn-row ix-dab43f"><button class="btn btn-primary" id="pemConvert">Convert</button><button class="btn btn-secondary" id="pemCopy">Copy output</button></div>
      ${outputArea('pemOutput', 13)}<p class="form-hint">Supports RSA-OAEP public SPKI and private PKCS#8 key material. Legacy PKCS#1 PEM is intentionally not guessed.</p>`, () => {
      $('#pemConvert').addEventListener('click', async () => {
        const input = $('#pemInput').value.trim();
        if (!input) return toast('Paste a PEM or JWK key first.', 'error');
        try {
          let output;
          if (input.startsWith('{')) {
            const jwk = JSON.parse(input);
            const isPrivate = Boolean(jwk.d);
            const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, isPrivate ? ['decrypt'] : ['encrypt']);
            output = toPem(await crypto.subtle.exportKey(isPrivate ? 'pkcs8' : 'spki', key), isPrivate ? 'PRIVATE KEY' : 'PUBLIC KEY');
          } else {
            const isPrivate = /BEGIN (?:RSA )?PRIVATE KEY/.test(input);
            const format = isPrivate ? 'pkcs8' : 'spki';
            const key = await crypto.subtle.importKey(format, pemBytes(input), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, isPrivate ? ['decrypt'] : ['encrypt']);
            output = JSON.stringify(await crypto.subtle.exportKey('jwk', key), null, 2);
          }
          $('#pemOutput').value = output;
        } catch (error) { toast(error.message || 'Key conversion failed.', 'error'); }
      });
      $('#pemCopy').addEventListener('click', () => $('#pemOutput').value ? copyToClipboard($('#pemOutput').value, 'Converted key') : toast('Nothing to copy.', 'error'));
    });
  }

  function decodeBase32(value) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = value.toUpperCase().replace(/[\s=-]/g, '');
    if (!clean || /[^A-Z2-7]/.test(clean)) throw new Error('Use a valid Base32 secret.');
    let bits = 0; let count = 0; const bytes = [];
    for (const character of clean) {
      bits = (bits << 5) | alphabet.indexOf(character); count += 5;
      if (count >= 8) { bytes.push((bits >>> (count - 8)) & 255); count -= 8; }
    }
    return new Uint8Array(bytes);
  }

  async function totp(secret, digits, period) {
    const counter = Math.floor(Date.now() / 1000 / period);
    const data = new Uint8Array(8);
    new DataView(data.buffer).setUint32(4, counter);
    const key = await crypto.subtle.importKey('raw', decodeBase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
    const offset = hash[hash.length - 1] & 15;
    const code = ((hash[offset] & 127) << 24 | hash[offset + 1] << 16 | hash[offset + 2] << 8 | hash[offset + 3]) % (10 ** digits);
    return String(code).padStart(digits, '0');
  }

  function initTotp() {
    render(`
      <div class="tool-split"><div class="tool-col"><label class="form-label" for="totpSecret">Base32 secret</label><input id="totpSecret" class="form-control font-mono" autocomplete="off" placeholder="JBSWY3DPEHPK3PXP" />
      <div class="tool-split ix-dab43f"><div><label class="form-label" for="totpDigits">Digits</label><select id="totpDigits" class="form-control form-select"><option>6</option><option>8</option></select></div><div><label class="form-label" for="totpPeriod">Period</label><select id="totpPeriod" class="form-control form-select"><option value="30">30 seconds</option><option value="60">60 seconds</option></select></div></div><button class="btn btn-primary ix-dab43f" id="totpGenerate">Generate code</button></div>
      <div class="tool-col"><p class="form-label">Current code</p><output id="totpCode" class="pwd-output ix-3ce6f5">------</output><p id="totpCountdown" class="form-hint ix-72a68a"></p><p class="form-hint">The secret stays only in this page’s memory.</p></div></div>`, () => {
      let timer;
      async function update() {
        const secret = $('#totpSecret').value.trim();
        const period = Number($('#totpPeriod').value);
        if (!secret) return;
        try {
          $('#totpCode').textContent = await totp(secret, Number($('#totpDigits').value), period);
          $('#totpCountdown').textContent = `Refreshes in ${period - (Math.floor(Date.now() / 1000) % period)}s`;
        } catch (error) { $('#totpCode').textContent = '------'; $('#totpCountdown').textContent = error.message; }
      }
      $('#totpGenerate').addEventListener('click', () => { clearInterval(timer); update(); timer = setInterval(update, 1000); });
      ['totpSecret', 'totpDigits', 'totpPeriod'].forEach((id) => $("#" + id).addEventListener('input', update));
    });
  }

  function readDerLength(bytes, offset) {
    const first = bytes[offset++];
    if (first < 128) return [first, offset];
    const count = first & 127;
    if (!count || count > 4) throw new Error('Unsupported DER length.');
    let length = 0;
    for (let i = 0; i < count; i++) length = (length << 8) | bytes[offset++];
    return [length, offset];
  }

  function oid(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    if (!bytes.length) return '';
    const parts = [Math.floor(bytes[0] / 40), bytes[0] % 40];
    let number = 0;
    for (let i = 1; i < bytes.length; i++) { number = (number << 7) | (bytes[i] & 127); if (!(bytes[i] & 128)) { parts.push(number); number = 0; } }
    return parts.join('.');
  }

  function derTree(bytes, start = 0, end = bytes.length, depth = 0) {
    const lines = [];
    const names = { 2: 'INTEGER', 3: 'BIT STRING', 4: 'OCTET STRING', 5: 'NULL', 6: 'OBJECT IDENTIFIER', 12: 'UTF8 STRING', 16: 'SEQUENCE', 17: 'SET', 19: 'PRINTABLE STRING', 22: 'IA5 STRING', 23: 'UTC TIME', 24: 'GENERALIZED TIME' };
    let offset = start;
    while (offset < end && lines.length < 600) {
      const tag = bytes[offset++];
      const [length, valueOffset] = readDerLength(bytes, offset);
      const valueEnd = valueOffset + length;
      if (valueEnd > end) throw new Error('Malformed DER data.');
      const type = tag & 31;
      const label = names[type] || `TAG 0x${tag.toString(16).padStart(2, '0')}`;
      let suffix = '';
      const value = bytes.slice(valueOffset, valueEnd);
      if (type === 6) suffix = ` (${oid(value)})`;
      if ([12, 19, 22, 23, 24].includes(type)) suffix = ` (${decoder.decode(value)})`;
      lines.push(`${'  '.repeat(depth)}${label}${suffix} [${length} bytes]`);
      if (tag & 32) lines.push(...derTree(bytes, valueOffset, valueEnd, depth + 1));
      offset = valueEnd;
    }
    return lines;
  }

  function initCertificateInspector() {
    render(`<label class="form-label" for="certInput">X.509 PEM certificate</label><textarea id="certInput" class="form-control font-mono" rows="12" placeholder="-----BEGIN CERTIFICATE-----"></textarea><div class="btn-row ix-dab43f"><button class="btn btn-primary" id="certInspect">Inspect certificate</button><button class="btn btn-secondary" id="certDownload">Download report</button></div>${outputArea('certOutput', 18)}<p class="form-hint">Reads the certificate locally as DER/ASN.1. It does not validate trust or revocation.</p>`, () => {
      $('#certInspect').addEventListener('click', () => {
        try {
          const input = $('#certInput').value;
          if (!/BEGIN CERTIFICATE/.test(input)) throw new Error('Paste a PEM certificate.');
          const bytes = pemBytes(input);
          const report = [`Certificate size: ${bytes.length} bytes`, '', ...derTree(bytes)].join('\n');
          $('#certOutput').value = report;
        } catch (error) { toast(error.message || 'Certificate inspection failed.', 'error'); }
      });
      $('#certDownload').addEventListener('click', () => $('#certOutput').value ? download('certificate-report.txt', $('#certOutput').value) : toast('Inspect a certificate first.', 'error'));
    });
  }

  function initCspGenerator() {
    render(`<label class="form-label" for="cspDirectives">One directive per line</label><textarea id="cspDirectives" class="form-control font-mono" rows="10">default-src 'self'\nbase-uri 'self'\nobject-src 'none'\nframe-ancestors 'none'\nimg-src 'self' data:\nstyle-src 'self' 'unsafe-inline'\nscript-src 'self'</textarea><div class="btn-row ix-dab43f"><button class="btn btn-primary" id="cspBuild">Build CSP header</button><button class="btn btn-secondary" id="cspCopy">Copy header</button></div>${outputArea('cspOutput', 6)}<p class="form-hint">Review each source before deploying. This tool does not make security policy decisions for you.</p>`, () => {
      $('#cspBuild').addEventListener('click', () => {
        const directives = $('#cspDirectives').value.split('\n').map((line) => line.trim().replace(/\s+/g, ' ')).filter(Boolean);
        const invalid = directives.find((line) => !/^[a-z-]+(?:\s+.+)?$/i.test(line));
        if (invalid) return toast(`Invalid directive: ${invalid}`, 'error');
        $('#cspOutput').value = `Content-Security-Policy: ${directives.join('; ')}`;
      });
      $('#cspCopy').addEventListener('click', () => $('#cspOutput').value ? copyToClipboard($('#cspOutput').value, 'CSP header') : toast('Build a header first.', 'error'));
      $('#cspBuild').click();
    });
  }

  function shellQuote(value) { return `'${String(value).replace(/'/g, "'\\\"'\\\"'")}'`; }

  function initCurlBuilder() {
    render(`<div class="tool-split"><div class="tool-col"><label class="form-label" for="curlMethod">Method</label><select id="curlMethod" class="form-control form-select"><option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option></select><label class="form-label ix-dab43f" for="curlUrl">URL</label><input id="curlUrl" type="url" class="form-control font-mono" placeholder="https://api.example.com/v1/items" /><label class="form-label ix-dab43f" for="curlHeaders">Headers (one per line)</label><textarea id="curlHeaders" class="form-control font-mono" rows="5" placeholder="Authorization: Bearer token\nContent-Type: application/json"></textarea><label class="form-label ix-dab43f" for="curlBody">Request body</label><textarea id="curlBody" class="form-control font-mono" rows="5" placeholder='{"name":"Toolkit"}'></textarea><button class="btn btn-primary ix-dab43f" id="curlBuild">Build cURL command</button></div><div class="tool-col">${outputArea('curlOutput', 18)}<button class="btn btn-secondary" id="curlCopy">Copy command</button></div></div>`, () => {
      $('#curlBuild').addEventListener('click', () => {
        const url = $('#curlUrl').value.trim();
        if (!url) return toast('Enter a URL.', 'error');
        try { new URL(url); } catch { return toast('Enter a valid URL.', 'error'); }
        const method = $('#curlMethod').value;
        const headers = $('#curlHeaders').value.split('\n').map((line) => line.trim()).filter(Boolean);
        const body = $('#curlBody').value;
        const parts = [
          `curl --request ${method}`,
          shellQuote(url),
          ...headers.map((header) => `--header ${shellQuote(header)}`)
        ];
        if (body && !['GET', 'DELETE'].includes(method)) parts.push(`--data ${shellQuote(body)}`);
        $('#curlOutput').value = parts.map((part, index) => `${index ? '  ' : ''}${part}${index < parts.length - 1 ? ' \\' : ''}`).join('\n');
      });
      $('#curlCopy').addEventListener('click', () => $('#curlOutput').value ? copyToClipboard($('#curlOutput').value, 'cURL command') : toast('Build a command first.', 'error'));
    });
  }

  function initHeaderAnalyzer() {
    render(`<label class="form-label" for="headerInput">HTTP response headers</label><textarea id="headerInput" class="form-control font-mono" rows="12" placeholder="HTTP/2 200 OK\nContent-Security-Policy: default-src 'self'\nStrict-Transport-Security: max-age=31536000\nX-Content-Type-Options: nosniff"></textarea><button class="btn btn-primary ix-dab43f" id="headerAnalyze">Analyze headers</button><div id="headerResults" class="expansion-results ix-dab43f"></div>`, () => {
      $('#headerAnalyze').addEventListener('click', () => {
        const headers = new Map();
        $('#headerInput').value.split(/\r?\n/).forEach((line) => {
          const index = line.indexOf(':');
          if (index > 0) headers.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
        });
        const checks = [
          ['content-security-policy', 'Content-Security-Policy', 'Limits which sources a page may load.'],
          ['strict-transport-security', 'Strict-Transport-Security', 'Tells browsers to prefer HTTPS.'],
          ['x-content-type-options', 'X-Content-Type-Options', 'Prevents MIME type sniffing.'],
          ['referrer-policy', 'Referrer-Policy', 'Controls referrer information.'],
          ['permissions-policy', 'Permissions-Policy', 'Restricts powerful browser features.'],
          ['cross-origin-opener-policy', 'Cross-Origin-Opener-Policy', 'Helps isolate browsing contexts.']
        ];
        const result = $('#headerResults'); result.textContent = '';
        const list = document.createElement('div'); list.className = 'expansion-checklist';
        checks.forEach(([key, label, note]) => {
          const item = document.createElement('p');
          item.textContent = `${headers.has(key) ? '✓' : '○'} ${label} — ${headers.has(key) ? headers.get(key) : `Not present. ${note}`}`;
          item.className = headers.has(key) ? 'is-good' : 'is-note'; list.appendChild(item);
        });
        const parsed = document.createElement('pre'); parsed.className = 'expansion-pre'; parsed.textContent = [...headers].map(([key, value]) => `${key}: ${value}`).join('\n') || 'No parsable header lines found.';
        result.append(list, parsed);
      });
    });
  }

  function parseCronField(expression, min, max) {
    return expression.split(',').map((part) => {
      const segments = part.split('/');
      if (segments.length > 2 || !segments[0]) throw new Error('Use valid cron field values.');
      const [rangePart, stepPart] = segments;
      const step = stepPart === undefined ? 1 : Number(stepPart);
      if (!Number.isInteger(step) || step < 1) throw new Error('Cron step values must be positive integers.');

      let from = min; let to = max;
      if (rangePart !== '*') {
        const range = rangePart.split('-').map(Number);
        if (range.length > 2 || range.some((number) => !Number.isInteger(number))) throw new Error('Use valid cron field values.');
        [from, to] = range.length === 2 ? range : [range[0], range[0]];
      }
      if (from < min || to > max || from > to) throw new Error('Cron field value is outside its allowed range.');
      return { from, to, step };
    });
  }

  function cronFieldMatches(value, ranges) {
    return ranges.some(({ from, to, step }) => value >= from && value <= to && (value - from) % step === 0);
  }

  function cronMatches(date, fields) {
    const values = [date.getMinutes(), date.getHours(), date.getDate(), date.getMonth() + 1, date.getDay()];
    const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
    const baseMatch = cronFieldMatches(values[0], minute)
      && cronFieldMatches(values[1], hour)
      && cronFieldMatches(values[3], month);
    const dayOfMonthMatch = cronFieldMatches(values[2], dayOfMonth);
    // In five-field cron, both 0 and 7 conventionally mean Sunday.
    const dayOfWeekMatch = cronFieldMatches(values[4], dayOfWeek)
      || (values[4] === 0 && cronFieldMatches(7, dayOfWeek));
    const dayOfMonthRestricted = !(dayOfMonth.length === 1 && dayOfMonth[0].from === 1 && dayOfMonth[0].to === 31 && dayOfMonth[0].step === 1);
    const dayOfWeekRestricted = !(dayOfWeek.length === 1 && dayOfWeek[0].from === 0 && dayOfWeek[0].to === 7 && dayOfWeek[0].step === 1);
    const dayMatches = dayOfMonthRestricted && dayOfWeekRestricted
      ? dayOfMonthMatch || dayOfWeekMatch
      : dayOfMonthMatch && dayOfWeekMatch;
    return baseMatch && dayMatches;
  }

  function initCronAssistant() {
    render(`<label class="form-label" for="cronInput">Five-field cron expression</label><input id="cronInput" class="form-control font-mono" value="*/15 9-17 * * 1-5" placeholder="minute hour day-of-month month day-of-week" /><p class="form-hint">Supports numbers, *, lists, ranges and steps. Uses your browser’s local time zone.</p><button class="btn btn-primary" id="cronRun">Explain and find next runs</button><div id="cronResult" class="expansion-results ix-dab43f"></div>`, () => {
      $('#cronRun').addEventListener('click', () => {
        const expressions = $('#cronInput').value.trim().split(/\s+/);
        if (expressions.length !== 5 || expressions.some((field) => !/^[\d,*/-]+$/.test(field))) return toast('Use a valid five-field numeric cron expression.', 'error');
        try {
          const fields = [
            parseCronField(expressions[0], 0, 59), parseCronField(expressions[1], 0, 23),
            parseCronField(expressions[2], 1, 31), parseCronField(expressions[3], 1, 12), parseCronField(expressions[4], 0, 7)
          ];
          const start = new Date(); start.setSeconds(0, 0); start.setMinutes(start.getMinutes() + 1);
          const runs = [];
          for (let i = 0, date = new Date(start); i < 527040 && runs.length < 5; i++, date.setMinutes(date.getMinutes() + 1)) if (cronMatches(date, fields)) runs.push(new Date(date));
          const result = $('#cronResult'); result.textContent = '';
          const summary = document.createElement('p');
          summary.textContent = t('Fields: minute={{minute}}, hour={{hour}}, day={{day}}, month={{month}}, weekday={{weekday}}.', {
            minute: expressions[0], hour: expressions[1], day: expressions[2], month: expressions[3], weekday: expressions[4]
          });
          const list = document.createElement('ol'); runs.forEach((date) => { const item = document.createElement('li'); item.textContent = date.toLocaleString(locale()); list.appendChild(item); });
          result.append(summary, runs.length ? list : document.createTextNode('No matching time was found in the next year.'));
        } catch (error) { toast(error.message || 'Use a valid five-field numeric cron expression.', 'error'); }
      });
      $('#cronRun').click();
    });
  }

  function initUnixPermissions() {
    render(`<div class="tool-split"><div class="tool-col"><label class="form-label" for="permOctal">Octal permissions</label><input id="permOctal" class="form-control font-mono" inputmode="numeric" maxlength="3" value="644" /><div id="permChecks" class="expansion-permissions ix-dab43f"></div></div><div class="tool-col"><p class="form-label">Symbolic mode</p><output id="permSymbolic" class="pwd-output ix-5fbb09">rw-r--r--</output><p class="form-hint">Toggle a permission or enter a three-digit octal mode.</p></div></div>`, () => {
      const labels = ['Owner read', 'Owner write', 'Owner execute', 'Group read', 'Group write', 'Group execute', 'Other read', 'Other write', 'Other execute'];
      const checks = labels.map((label, index) => `<label class="checkbox-card"><input type="checkbox" data-bit="${8 - index}" /><span>${label}</span></label>`).join('');
      $('#permChecks').innerHTML = checks;
      const boxes = $$('#permChecks input');
      function sync(source) {
        let octal;
        if (source === 'octal') {
          const value = $('#permOctal').value.replace(/[^0-7]/g, '').slice(-3).padStart(3, '0'); $('#permOctal').value = value; octal = value;
          boxes.forEach((box) => { const group = Math.floor((8 - Number(box.dataset.bit)) / 3); const bit = 2 - ((8 - Number(box.dataset.bit)) % 3); box.checked = Boolean((Number(octal[group]) >> bit) & 1); });
        } else {
          octal = [0, 1, 2].map((group) => boxes.slice(group * 3, group * 3 + 3).reduce((sum, box, index) => sum + (box.checked ? 2 ** (2 - index) : 0), 0)).join(''); $('#permOctal').value = octal;
        }
        $('#permSymbolic').textContent = octal.split('').map((digit) => ['r', 'w', 'x'].map((letter, index) => (Number(digit) & (2 ** (2 - index))) ? letter : '-').join('')).join('');
      }
      $('#permOctal').addEventListener('input', () => sync('octal')); boxes.forEach((box) => box.addEventListener('change', () => sync('boxes'))); sync('octal');
    });
  }

  function initCssSpecificity() {
    render(`<label class="form-label" for="specificityInput">CSS selector</label><textarea id="specificityInput" class="form-control font-mono" rows="5" placeholder="#app .card:hover > h2::before"></textarea><button class="btn btn-primary ix-dab43f" id="specificityRun">Calculate specificity</button><div id="specificityResult" class="expansion-results ix-dab43f"></div>`, () => {
      $('#specificityRun').addEventListener('click', () => {
        const selector = $('#specificityInput').value.trim(); if (!selector) return toast('Enter a selector.', 'error');
        const stripped = selector.replace(/:where\([^)]*\)/g, '');
        const ids = (stripped.match(/#[\w-]+/g) || []).length;
        const classes = (stripped.match(/\.[\w-]+|\[[^\]]+\]|(?<!:):(?!:)[\w-]+(?:\([^)]*\))?/g) || []).length;
        const cleaned = stripped.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?/g, ' ');
        const elements = (cleaned.match(/\b[a-z][\w-]*\b/gi) || []).filter((part) => part !== '*').length + (stripped.match(/::[\w-]+/g) || []).length;
        $('#specificityResult').textContent = `Specificity: ${ids}-${classes}-${elements} (IDs – classes/attributes/pseudo-classes – elements/pseudo-elements)`;
      });
    });
  }

  function initCssClamp() {
    render(`<div class="tool-split"><div class="tool-col"><label class="form-label" for="clampMin">Minimum size (px)</label><input id="clampMin" type="number" class="form-control" value="16" /><label class="form-label ix-dab43f" for="clampMax">Maximum size (px)</label><input id="clampMax" type="number" class="form-control" value="24" /></div><div class="tool-col"><label class="form-label" for="clampVmin">Minimum viewport (px)</label><input id="clampVmin" type="number" class="form-control" value="320" /><label class="form-label ix-dab43f" for="clampVmax">Maximum viewport (px)</label><input id="clampVmax" type="number" class="form-control" value="1280" /></div></div><button class="btn btn-primary ix-dab43f" id="clampRun">Generate clamp()</button>${outputArea('clampOutput', 4)}`, () => {
      $('#clampRun').addEventListener('click', () => {
        const min = Number($('#clampMin').value), max = Number($('#clampMax').value), vmin = Number($('#clampVmin').value), vmax = Number($('#clampVmax').value);
        if (![min, max, vmin, vmax].every(Number.isFinite) || min > max || vmin >= vmax) return toast('Use valid ascending size and viewport ranges.', 'error');
        const slope = ((max - min) / (vmax - vmin)) * 100; const intercept = min - (slope / 100) * vmin;
        $('#clampOutput').value = `font-size: clamp(${min}px, calc(${slope.toFixed(4)}vw + ${intercept.toFixed(4)}px), ${max}px);`;
      });
      $('#clampRun').click();
    });
  }

  function inferType(value, name = 'Root', seen = new WeakSet()) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return `${value.length ? inferType(value[0], `${name}Item`, seen) : 'unknown'}[]`;
    if (typeof value !== 'object') return typeof value;
    if (seen.has(value)) return 'unknown'; seen.add(value);
    const interfaceName = name.replace(/[^a-zA-Z0-9]/g, '') || 'Root';
    const members = Object.entries(value).map(([key, nested]) => `  ${JSON.stringify(key)}: ${inferType(nested, key.replace(/(^|[_-])(\w)/g, (_, __, char) => char.toUpperCase()), seen)};`);
    return `{\n${members.join('\n')}\n}`.replace(/^\{/, `/* ${interfaceName} */ {`);
  }

  function initJsonTypeScript() {
    render(`<label class="form-label" for="tsInput">JSON input</label><textarea id="tsInput" class="form-control font-mono" rows="12" placeholder='{"user":{"id":1,"name":"Ada"}}'></textarea><button class="btn btn-primary ix-dab43f" id="tsRun">Generate TypeScript</button>${outputArea('tsOutput', 14)}`, () => {
      $('#tsRun').addEventListener('click', () => {
        try { $('#tsOutput').value = `type Root = ${inferType(JSON.parse($('#tsInput').value))};`; }
        catch (error) { toast(`Invalid JSON: ${error.message}`, 'error'); }
      });
    });
  }

  function initJsonMarkdown() {
    render(`<label class="form-label" for="markdownJsonInput">JSON array of objects</label><textarea id="markdownJsonInput" class="form-control font-mono" rows="12" placeholder='[{"name":"Ada","role":"Engineer"}]'></textarea><button class="btn btn-primary ix-dab43f" id="markdownJsonRun">Convert to Markdown table</button>${outputArea('markdownJsonOutput', 14)}`, () => {
      $('#markdownJsonRun').addEventListener('click', () => {
        try {
          const rows = JSON.parse($('#markdownJsonInput').value); if (!Array.isArray(rows) || !rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) throw new Error('Use an array of objects.');
          const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
          const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
          $('#markdownJsonOutput').value = [`| ${keys.join(' | ')} |`, `| ${keys.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${keys.map((key) => cell(typeof row[key] === 'object' ? JSON.stringify(row[key]) : row[key])).join(' | ')} |`)].join('\n');
        } catch (error) { toast(error.message || 'Conversion failed.', 'error'); }
      });
    });
  }

  function xmlNodeToObject(node) {
    const object = {};
    if (node.attributes?.length) for (const attribute of node.attributes) object[`@${attribute.name}`] = attribute.value;
    const children = [...node.children];
    const text = [...node.childNodes].filter((child) => child.nodeType === Node.TEXT_NODE).map((child) => child.nodeValue.trim()).filter(Boolean).join(' ');
    children.forEach((child) => { const value = xmlNodeToObject(child); if (object[child.nodeName] === undefined) object[child.nodeName] = value; else object[child.nodeName] = Array.isArray(object[child.nodeName]) ? [...object[child.nodeName], value] : [object[child.nodeName], value]; });
    if (text) object['#text'] = text;
    return Object.keys(object).length ? object : '';
  }

  function initXmlJson() {
    render(`<label class="form-label" for="xmlJsonInput">XML input</label><textarea id="xmlJsonInput" class="form-control font-mono" rows="12" placeholder="<person id=\"1\"><name>Ada</name></person>"></textarea><button class="btn btn-primary ix-dab43f" id="xmlJsonRun">Convert XML to JSON</button>${outputArea('xmlJsonOutput', 14)}`, () => {
      $('#xmlJsonRun').addEventListener('click', () => {
        const parsed = new DOMParser().parseFromString($('#xmlJsonInput').value, 'application/xml');
        const error = parsed.querySelector('parsererror'); if (error) return toast('Invalid XML input.', 'error');
        $('#xmlJsonOutput').value = JSON.stringify({ [parsed.documentElement.nodeName]: xmlNodeToObject(parsed.documentElement) }, null, 2);
      });
    });
  }

  function parseCsv(input) {
    const rows = []; let row = []; let value = ''; let quoted = false;
    for (let index = 0; index < input.length; index++) {
      const character = input[index]; const next = input[index + 1];
      if (character === '"' && quoted && next === '"') { value += '"'; index++; }
      else if (character === '"') quoted = !quoted;
      else if (character === ',' && !quoted) { row.push(value); value = ''; }
      else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && next === '\n') index++; row.push(value); if (row.some((cell) => cell !== '')) rows.push(row); row = []; value = ''; }
      else value += character;
    }
    row.push(value); if (row.some((cell) => cell !== '')) rows.push(row); return rows;
  }

  function initCsvViewer() {
    render(`<label class="form-label" for="csvViewerInput">CSV input</label><textarea id="csvViewerInput" class="form-control font-mono" rows="9" placeholder="name,role\nAda,Engineer"></textarea><button class="btn btn-primary ix-dab43f" id="csvViewerRun">Preview CSV</button><div id="csvViewerResult" class="expansion-table-wrap ix-dab43f"></div>`, () => {
      $('#csvViewerRun').addEventListener('click', () => {
        const rows = parseCsv($('#csvViewerInput').value); if (!rows.length) return toast('Enter CSV data.', 'error');
        const table = document.createElement('table'); table.className = 'expansion-table';
        rows.forEach((row, index) => { const tr = document.createElement('tr'); row.forEach((cell) => { const cellEl = document.createElement(index ? 'td' : 'th'); cellEl.textContent = cell; tr.appendChild(cellEl); }); table.appendChild(tr); });
        $('#csvViewerResult').replaceChildren(table);
      });
    });
  }

  function initUnicodeInspector() {
    render(`<label class="form-label" for="unicodeInput">Text</label><textarea id="unicodeInput" class="form-control" rows="6" placeholder="Hello 👋"></textarea><label class="form-label ix-dab43f" for="unicodeForm">Normalization form</label><select id="unicodeForm" class="form-control form-select"><option>NFC</option><option>NFD</option><option>NFKC</option><option>NFKD</option></select><button class="btn btn-primary ix-dab43f" id="unicodeRun">Inspect and normalize</button>${outputArea('unicodeOutput', 14)}`, () => {
      $('#unicodeRun').addEventListener('click', () => {
        const text = $('#unicodeInput').value; const form = $('#unicodeForm').value; const normalized = text.normalize(form);
        const points = [...text].map((character, index) => `${String(index + 1).padStart(3, ' ')}  U+${character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}  ${character}`).join('\n');
        $('#unicodeOutput').value = `Normalized (${form}): ${normalized}\n\nCode points:\n${points || '(empty input)'}`;
      });
    });
  }

  function initTimeZone() {
    render(`<label class="form-label" for="zoneDate">Date and time</label><input id="zoneDate" type="datetime-local" class="form-control" /><label class="form-label ix-dab43f" for="zoneList">Time zones (one per line)</label><textarea id="zoneList" class="form-control font-mono" rows="7">UTC\nEurope/Istanbul\nEurope/London\nAmerica/New_York\nAmerica/Los_Angeles\nAsia/Tokyo\nAustralia/Sydney</textarea><button class="btn btn-primary ix-dab43f" id="zoneRun">Convert time zones</button><div id="zoneResult" class="expansion-results ix-dab43f" data-i18n-skip></div>`, () => {
      const local = new Date(); local.setMinutes(local.getMinutes() - local.getTimezoneOffset()); $('#zoneDate').value = local.toISOString().slice(0, 16);
      $('#zoneRun').addEventListener('click', () => {
        const date = new Date($('#zoneDate').value); if (Number.isNaN(date.getTime())) return toast('Choose a date and time.', 'error');
        const zones = $('#zoneList').value.split('\n').map((zone) => zone.trim()).filter(Boolean); const result = $('#zoneResult'); result.textContent = '';
        zones.forEach((zone) => { const row = document.createElement('p'); try { row.textContent = `${zone}: ${new Intl.DateTimeFormat(locale(), { dateStyle: 'full', timeStyle: 'long', timeZone: zone }).format(date)}`; } catch { row.textContent = `${zone}: ${t('unsupported time zone')}`; } result.appendChild(row); });
      });
      $('#zoneRun').click();
    });
  }

  function initDateDuration() {
    render(`<div class="tool-split"><div><label class="form-label" for="durationStart">Start date</label><input id="durationStart" type="date" class="form-control" /></div><div><label class="form-label" for="durationEnd">End date</label><input id="durationEnd" type="date" class="form-control" /></div></div><button class="btn btn-primary ix-dab43f" id="durationRun">Calculate duration</button><div id="durationResult" class="expansion-results ix-dab43f"></div>`, () => {
      const today = new Date().toISOString().slice(0, 10); $('#durationStart').value = today; $('#durationEnd').value = today;
      $('#durationRun').addEventListener('click', () => {
        const start = new Date(`${$('#durationStart').value}T00:00:00Z`), end = new Date(`${$('#durationEnd').value}T00:00:00Z`); if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return toast('Choose both dates.', 'error');
        const days = Math.abs(Math.round((end - start) / 86400000));
        $('#durationResult').textContent = t('{{days}} day{{daySuffix}} • {{weeks}} weeks • {{months}} whole average months', {
          days, daySuffix: days === 1 ? '' : 's', weeks: (days / 7).toFixed(2), months: Math.floor(days / 30.4375)
        });
      });
      $('#durationRun').click();
    });
  }

  function initImageCompressor() {
    render(`<label class="form-label" for="imageCompressInput">Image file</label><div class="file-picker-row"><div class="file-picker"><input id="imageCompressInput" type="file" class="sr-only file-picker__input" accept="image/*" aria-describedby="imageCompressFileName" /><label class="btn btn-secondary file-picker__trigger" for="imageCompressInput"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 16V3m0 0L7 8m5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg><span>Choose image file</span></label><span class="file-picker__name" id="imageCompressFileName" data-i18n-skip aria-live="polite">No file selected</span></div></div><div class="tool-split"><div><label class="form-label" for="imageMaxWidth">Maximum width</label><input id="imageMaxWidth" type="number" class="form-control" value="1920" min="1" /></div><div><label class="form-label" for="imageQuality">Quality (1–100)</label><input id="imageQuality" type="number" class="form-control" value="82" min="1" max="100" /></div><div><label class="form-label" for="imageFormat">Output format</label><select id="imageFormat" class="form-control form-select"><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option><option value="image/png">PNG</option></select></div></div><button class="btn btn-primary ix-dab43f" id="imageCompressRun">Compress image</button><div id="imageCompressResult" class="expansion-results ix-dab43f" hidden></div>`, () => {
      const input = $('#imageCompressInput');
      const fileName = $('#imageCompressFileName');
      function updateFileName() {
        const file = input.files[0];
        fileName.textContent = file ? file.name : t('No file selected');
        fileName.title = file ? file.name : '';
      }
      updateFileName();
      input.addEventListener('change', updateFileName);
      window.addEventListener('toolkit:languagechange', () => {
        if (!input.files[0]) updateFileName();
      });
      $('#imageCompressRun').addEventListener('click', () => {
        const file = input.files[0]; if (!file) return toast('Choose an image file.', 'error');
        const image = new Image(); const url = URL.createObjectURL(file);
        image.onload = () => {
          const maxWidth = Math.max(1, Number($('#imageMaxWidth').value) || image.width); const ratio = Math.min(1, maxWidth / image.width);
          const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * ratio); canvas.height = Math.round(image.height * ratio); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          const type = $('#imageFormat').value; canvas.toBlob((blob) => {
            URL.revokeObjectURL(url); if (!blob) return toast('This format is not supported by your browser.', 'error');
            const href = URL.createObjectURL(blob); const result = $('#imageCompressResult'); const previous = result.querySelector('a[href^="blob:"]'); if (previous) URL.revokeObjectURL(previous.href); result.textContent = ''; result.hidden = false;
            const info = document.createElement('p'); info.textContent = `${image.width}×${image.height} → ${canvas.width}×${canvas.height}; ${Math.round(file.size / 1024)} KB → ${Math.round(blob.size / 1024)} KB.`;
            const link = document.createElement('a'); link.className = 'btn btn-secondary'; link.href = href; link.download = `compressed.${type.split('/')[1]}`; link.textContent = 'Download compressed image'; result.append(info, link);
          }, type, Math.min(1, Math.max(0.01, Number($('#imageQuality').value) / 100)));
        };
        image.onerror = () => { URL.revokeObjectURL(url); toast('The selected file could not be read as an image.', 'error'); }; image.src = url;
      });
    });
  }

  function initSitemapGenerator() {
    render(`<label class="form-label" for="sitemapUrls">URLs (one per line)</label><textarea id="sitemapUrls" class="form-control font-mono" rows="11" placeholder="https://example.com/\nhttps://example.com/about"></textarea><div class="tool-split ix-dab43f"><div><label class="form-label" for="sitemapFreq">Change frequency</label><select id="sitemapFreq" class="form-control form-select"><option value="weekly">weekly</option><option value="monthly">monthly</option><option value="daily">daily</option></select></div><div><label class="form-label" for="sitemapPriority">Priority</label><select id="sitemapPriority" class="form-control form-select"><option>0.8</option><option>1.0</option><option>0.5</option></select></div></div><div class="btn-row ix-dab43f"><button class="btn btn-primary" id="sitemapRun">Generate sitemap.xml</button><button class="btn btn-secondary" id="sitemapDownload">Download</button></div>${outputArea('sitemapOutput', 14)}`, () => {
      $('#sitemapRun').addEventListener('click', () => {
        try {
          const urls = [...new Set($('#sitemapUrls').value.split('\n').map((line) => line.trim()).filter(Boolean).map((value) => new URL(value).href))];
          if (!urls.length) throw new Error('Enter at least one absolute URL.');
          const escapeXml = (value) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[character]));
          $('#sitemapOutput').value = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>\n    <changefreq>${$('#sitemapFreq').value}</changefreq>\n    <priority>${$('#sitemapPriority').value}</priority>\n  </url>`).join('\n')}\n</urlset>`;
        } catch (error) { toast(error.message || 'Sitemap generation failed.', 'error'); }
      });
      $('#sitemapDownload').addEventListener('click', () => $('#sitemapOutput').value ? download('sitemap.xml', $('#sitemapOutput').value, 'application/xml;charset=utf-8') : toast('Generate a sitemap first.', 'error'));
    });
  }

  function hexToRgb(hex) {
    const value = hex.replace('#', ''); if (!/^[\da-f]{6}$/i.test(value)) throw new Error('Use a six-digit hex color.');
    return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  }

  function luminance(hex) {
    return hexToRgb(hex).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  }

  function initColorContrast() {
    render(`<div class="tool-split"><div><label class="form-label" for="contrastForeground">Foreground</label><input id="contrastForeground" type="color" class="form-control" value="#ffffff" /></div><div><label class="form-label" for="contrastBackground">Background</label><input id="contrastBackground" type="color" class="form-control" value="#111827" /></div></div><button class="btn btn-primary ix-dab43f" id="contrastRun">Check contrast</button><div id="contrastResult" class="expansion-results ix-dab43f"></div>`, () => {
      $('#contrastRun').addEventListener('click', () => {
        try {
          const ratio = (Math.max(luminance($('#contrastForeground').value), luminance($('#contrastBackground').value)) + 0.05) / (Math.min(luminance($('#contrastForeground').value), luminance($('#contrastBackground').value)) + 0.05);
          $('#contrastResult').textContent = t('Contrast ratio: {{ratio}}:1\nNormal text AA: {{normalAa}} • AAA: {{normalAaa}}\nLarge text AA: {{largeAa}} • AAA: {{largeAaa}}', {
            ratio: ratio.toFixed(2), normalAa: t(ratio >= 4.5 ? 'Pass' : 'Fail'), normalAaa: t(ratio >= 7 ? 'Pass' : 'Fail'),
            largeAa: t(ratio >= 3 ? 'Pass' : 'Fail'), largeAaa: t(ratio >= 4.5 ? 'Pass' : 'Fail')
          });
        } catch (error) { toast(error.message, 'error'); }
      });
      $('#contrastRun').click();
    });
  }

  const initializers = {
    'aes-gcm': initAesGcm, 'rsa-keypair': initRsaKeypair, 'pem-jwk': initPemJwk, 'certificate-inspector': initCertificateInspector, 'totp': initTotp,
    'csp-generator': initCspGenerator, 'curl-builder': initCurlBuilder, 'http-header-analyzer': initHeaderAnalyzer, 'cron-assistant': initCronAssistant,
    'unix-permissions': initUnixPermissions, 'css-specificity': initCssSpecificity, 'css-clamp': initCssClamp, 'json-to-typescript': initJsonTypeScript,
    'json-to-markdown': initJsonMarkdown, 'xml-to-json': initXmlJson, 'csv-viewer': initCsvViewer, 'unicode-inspector': initUnicodeInspector,
    'time-zone-converter': initTimeZone, 'date-duration': initDateDuration, 'image-compressor': initImageCompressor, 'sitemap-generator': initSitemapGenerator,
    'color-contrast': initColorContrast
  };

  initializers[tool]?.();
  window.addEventListener('toolkit:languagechange', () => {
    app.querySelector('#cronRun, #zoneRun, #durationRun, #contrastRun')?.click();
  });
}());
