/* TOOLKIT — assets/js/tools/jwt-decoder.js */
(function initJWTDecoder() {
  const input     = document.getElementById('jwtInput');
  const decodeBtn = document.getElementById('jwtDecodeBtn');
  const results   = document.getElementById('jwtResults');
  if (!input) return;

  function b64UrlDecode(str) {
    // Normalize base64url to base64
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = str.length % 4;
    if (pad) str += '='.repeat(4 - pad);
    // The JSON inside is UTF-8: atob alone would show "Ç" as "Ã‡".
    return new TextDecoder().decode(Uint8Array.from(atob(str), (character) => character.charCodeAt(0)));
  }

  function formatJSON(obj) { return JSON.stringify(obj, null, 2); }

  function timeAgo(unixSec) {
    const now = Math.floor(Date.now() / 1000);
    const diff = unixSec - now;
    const absDiff = Math.abs(diff);
    const units = [
      [3600 * 24 * 365, 'year'], [3600 * 24 * 30, 'month'],
      [3600 * 24, 'day'],  [3600, 'hour'],  [60, 'minute'],  [1, 'second']
    ];
    for (const [sec, unit] of units) {
      if (absDiff >= sec) {
        const n = Math.floor(absDiff / sec);
        return diff > 0 ? `in ${n} ${unit}${n>1?'s':''}` : `${n} ${unit}${n>1?'s':''} ago`;
      }
    }
    return 'just now';
  }

  // copyLabel is spelled out at each call so the Turkish pack can find it.
  function makePanelHTML(partLabel, cssClass, content, copyId, copyLabel) {
    return `
      <div class="jwt-panel">
        <div class="jwt-panel-header">
          <span class="jwt-part-label jwt-part-label--${cssClass}">${partLabel}</span>
          <button class="icon-btn" id="${copyId}" aria-label="${copyLabel}" title="Copy">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        </div>
        <pre class="jwt-body">${escapeHTML(content)}</pre>
      </div>`;
  }

  decodeBtn.addEventListener('click', () => {
    const token = input.value.trim();
    if (!token) { showToast('Please enter a JWT token', 'error'); return; }

    const parts = token.split('.');
    if (parts.length !== 3) {
      results.innerHTML = `<p class="error-msg">Invalid JWT — a valid token must have exactly 3 dot-separated parts.</p>`;
      return;
    }

    let header, payload;
    try {
      header  = JSON.parse(b64UrlDecode(parts[0]));
      payload = JSON.parse(b64UrlDecode(parts[1]));
    } catch (e) {
      results.innerHTML = `<p class="error-msg">Failed to decode token — ${escapeHTML(e.message)}</p>`;
      return;
    }

    const headerStr  = formatJSON(header);
    const payloadStr = formatJSON(payload);
    const sigNote    = `Signature not verified — raw: ${parts[2].substring(0,32)}…`;

    let html = makePanelHTML('Header', 'header', headerStr, 'jwtCopyHeader', 'Copy Header');
    html    += makePanelHTML('Payload', 'payload', payloadStr, 'jwtCopyPayload', 'Copy Payload');
    html    += makePanelHTML('Signature', 'sig', sigNote, 'jwtCopySig', 'Copy Signature');

    // Info badges
    const now = Math.floor(Date.now() / 1000);
    let badges = '<div class="jwt-info-row">';
    if (payload.exp) {
      const expired = payload.exp < now;
      badges += `<span class="jwt-badge ${expired ? 'jwt-badge--expired' : 'jwt-badge--ok'}">
        ${expired ? '✕' : '✓'} EXP: ${new Date(payload.exp * 1000).toLocaleString()} (${timeAgo(payload.exp)})
      </span>`;
    }
    if (payload.iat) {
      badges += `<span class="jwt-badge jwt-badge--info">Issued: ${new Date(payload.iat * 1000).toLocaleString()}</span>`;
    }
    if (payload.sub) {
      badges += `<span class="jwt-badge jwt-badge--info">Subject: ${escapeHTML(String(payload.sub))}</span>`;
    }
    badges += '</div>';

    results.innerHTML = html + badges;

    results.querySelector('#jwtCopyHeader').addEventListener('click', () => copyToClipboard(headerStr, 'Header'));
    results.querySelector('#jwtCopyPayload').addEventListener('click', () => copyToClipboard(payloadStr, 'Payload'));
    results.querySelector('#jwtCopySig').addEventListener('click', () => copyToClipboard(parts[2], 'Signature'));
  });

  input.addEventListener('keydown', e => { if ((e.ctrlKey||e.metaKey) && e.key==='Enter') { decodeBtn.click(); e.preventDefault(); } });

  /* ── Signature verification (Web Crypto, in this browser) ─────── */
  const keyInput     = document.getElementById('jwtKey');
  const keyIsBase64  = document.getElementById('jwtKeyBase64');
  const verifyBtn    = document.getElementById('jwtVerifyBtn');
  const verifyResult = document.getElementById('jwtVerifyResult');

  function t(key, values) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key, values)
      : key.replace(/{{(\w+)}}/g, (_, name) => String(values?.[name] ?? ''));
  }

  function b64UrlBytes(text) {
    const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  // Each JWS algorithm and the Web Crypto parameters that check it.
  const ALGORITHMS = {
    HS256: { kind: 'hmac', hash: 'SHA-256' }, HS384: { kind: 'hmac', hash: 'SHA-384' }, HS512: { kind: 'hmac', hash: 'SHA-512' },
    RS256: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    RS384: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' },
    RS512: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
    PS256: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-256', saltLength: 32 },
    PS384: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-384', saltLength: 48 },
    PS512: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-512', saltLength: 64 },
    ES256: { kind: 'ec', curve: 'P-256', hash: 'SHA-256' },
    ES384: { kind: 'ec', curve: 'P-384', hash: 'SHA-384' },
    ES512: { kind: 'ec', curve: 'P-521', hash: 'SHA-512' },
    EdDSA: { kind: 'okp' }
  };

  function showVerdict(message, state) {
    verifyResult.hidden = false;
    verifyResult.className = `jwt-verify__result jwt-verify__result--${state}`;
    verifyResult.textContent = message;
  }

  // A JWKS holds several keys: the header's kid picks one; a lone key needs no kid.
  function pickJwk(json, header) {
    if (!Array.isArray(json.keys)) return json;
    const byKid = header.kid ? json.keys.find((key) => key.kid === header.kid) : null;
    if (byKid) return byKid;
    if (json.keys.length === 1) return json.keys[0];
    throw new Error(header.kid ? t('No key in this JWKS has the kid "{{kid}}".', { kid: header.kid }) : t('This JWKS has several keys and the token names no kid.'));
  }

  async function importKey(text, spec, header) {
    const params = spec.kind === 'hmac' ? { name: 'HMAC', hash: spec.hash }
      : spec.kind === 'rsa' ? { name: spec.name, hash: spec.hash }
      : spec.kind === 'ec' ? { name: 'ECDSA', namedCurve: spec.curve }
      : { name: 'Ed25519' };
    const trimmed = text.trim();
    const looksPublic = trimmed.startsWith('{') || /-----BEGIN [A-Z ]*KEY-----|-----BEGIN CERTIFICATE-----/.test(trimmed);
    if (spec.kind === 'hmac') {
      // Algorithm confusion: an attacker sets HS256 so that a server would use
      // its public key as the HMAC secret. A public key here is refused.
      if (looksPublic && !(trimmed.startsWith('{') && /"kty"\s*:\s*"oct"/.test(trimmed))) {
        throw new Error(t('The token asks for {{alg}}, an HMAC algorithm, but this looks like a public key. Refused: that mix-up is a known attack.', { alg: header.alg }));
      }
      if (trimmed.startsWith('{')) return crypto.subtle.importKey('jwk', { ...pickJwk(JSON.parse(trimmed), header), alg: undefined, key_ops: undefined, use: undefined }, params, false, ['verify']);
      const secret = keyIsBase64.checked ? b64UrlBytes(trimmed.replace(/\s+/g, '')) : new TextEncoder().encode(text);
      return crypto.subtle.importKey('raw', secret, params, false, ['verify']);
    }
    if (trimmed.startsWith('{')) {
      const jwk = pickJwk(JSON.parse(trimmed), header);
      return crypto.subtle.importKey('jwk', { ...jwk, alg: undefined, key_ops: undefined, use: undefined, d: undefined, p: undefined, q: undefined, dp: undefined, dq: undefined, qi: undefined }, params, false, ['verify']);
    }
    if (/-----BEGIN CERTIFICATE-----/.test(trimmed)) throw new Error(t('This is a certificate. Paste its public key (BEGIN PUBLIC KEY) instead.'));
    if (/-----BEGIN RSA PUBLIC KEY-----/.test(trimmed)) throw new Error(t('This is a PKCS #1 key. Convert it to BEGIN PUBLIC KEY (SPKI) or a JWK first, for example with the PEM / JWK Converter.'));
    const body = trimmed.match(/-----BEGIN PUBLIC KEY-----([\s\S]+?)-----END PUBLIC KEY-----/);
    if (!body) throw new Error(t('Paste the public key as a PEM (BEGIN PUBLIC KEY), a JWK or a JWKS.'));
    return crypto.subtle.importKey('spki', b64UrlBytes(body[1].replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_')), params, false, ['verify']);
  }

  async function verifySignature() {
    const token = input.value.trim();
    const parts = token.split('.');
    if (parts.length !== 3) { showVerdict(t('Enter a JWT with three dot-separated parts first.'), 'error'); return; }
    let header;
    try { header = JSON.parse(b64UrlDecode(parts[0])); } catch { showVerdict(t('The token header is not valid JSON.'), 'error'); return; }
    const alg = String(header.alg || '');
    if (alg.toLowerCase() === 'none') { showVerdict(t('This token is unsigned (alg: none): there is no signature to check, so treat it as untrusted.'), 'invalid'); return; }
    const spec = ALGORITHMS[alg];
    if (!spec) { showVerdict(t('{{alg}} is not an algorithm this tool can check.', { alg: alg || '?' }), 'error'); return; }
    if (!keyInput.value.trim()) { showVerdict(t('Enter the secret or public key to check the signature with.'), 'error'); return; }
    try {
      const key = await importKey(keyInput.value, spec, header);
      const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
      const signature = b64UrlBytes(parts[2]);
      const params = spec.kind === 'hmac' ? 'HMAC'
        : spec.kind === 'ec' ? { name: 'ECDSA', hash: spec.hash }
        : spec.kind === 'okp' ? 'Ed25519'
        : spec.name === 'RSA-PSS' ? { name: 'RSA-PSS', saltLength: spec.saltLength } : spec.name;
      const valid = await crypto.subtle.verify(params, key, signature, data);
      showVerdict(valid ? `✓ ${t('Signature valid ({{alg}})', { alg })}` : `✕ ${t('Signature does not match this key ({{alg}})', { alg })}`, valid ? 'valid' : 'invalid');
    } catch (error) {
      showVerdict(error.message || t('This key could not be used for {{alg}}.', { alg }), 'error');
    }
  }

  verifyBtn?.addEventListener('click', verifySignature);
})();
