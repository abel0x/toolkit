/* TOOLKIT — assets/js/tools/jwt-signer.js
   Builds and signs a JSON Web Token with Web Crypto: HS256/384/512 with a
   secret, RS*, PS* and ES* with an RSA or EC private key, and EdDSA with
   Ed25519. Keys are PKCS #8 PEM or JWK; a test key pair can be made here.
   Nothing leaves the browser. */
(function initJwtSigner() {
  'use strict';

  const algEl = document.getElementById('jwsAlg');
  const headerEl = document.getElementById('jwsHeader');
  const payloadEl = document.getElementById('jwsPayload');
  const secretBoxEl = document.getElementById('jwsSecretBox');
  const secretEl = document.getElementById('jwsSecret');
  const secretEncEl = document.getElementById('jwsSecretEnc');
  const keyBoxEl = document.getElementById('jwsKeyBox');
  const keyEl = document.getElementById('jwsKey');
  const publicBoxEl = document.getElementById('jwsPublicBox');
  const publicEl = document.getElementById('jwsPublic');
  const generateBtn = document.getElementById('jwsGenerate');
  const signBtn = document.getElementById('jwsSign');
  const tokenEl = document.getElementById('jwsToken');
  const copyBtn = document.getElementById('jwsCopy');
  const errorEl = document.getElementById('jwsError');
  const noteEl = document.getElementById('jwsNote');
  if (!algEl || !signBtn) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const utf8 = (text) => new TextEncoder().encode(text);

  const ALGS = {
    HS256: { kind: 'hmac', hash: 'SHA-256', bytes: 32 }, HS384: { kind: 'hmac', hash: 'SHA-384', bytes: 48 }, HS512: { kind: 'hmac', hash: 'SHA-512', bytes: 64 },
    RS256: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, RS384: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' }, RS512: { kind: 'rsa', name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
    PS256: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-256', salt: 32 }, PS384: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-384', salt: 48 }, PS512: { kind: 'rsa', name: 'RSA-PSS', hash: 'SHA-512', salt: 64 },
    ES256: { kind: 'ec', curve: 'P-256', hash: 'SHA-256' }, ES384: { kind: 'ec', curve: 'P-384', hash: 'SHA-384' }, ES512: { kind: 'ec', curve: 'P-521', hash: 'SHA-512' },
    EdDSA: { kind: 'okp' }
  };

  class SignError extends Error {}

  const b64 = (bytes) => {
    let binary = '';
    for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
    return btoa(binary);
  };
  const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64url = (text) => {
    const clean = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) throw new SignError('The secret is not valid base64url.');
    return Uint8Array.from(atob(clean + '='.repeat((4 - (clean.length % 4)) % 4)), (char) => char.charCodeAt(0));
  };
  const pem = (label, bytes) => `-----BEGIN ${label}-----\n${b64(bytes).match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`;

  function importParams(spec) {
    if (spec.kind === 'rsa') return { name: spec.name, hash: spec.hash };
    if (spec.kind === 'ec') return { name: 'ECDSA', namedCurve: spec.curve };
    return { name: 'Ed25519' };
  }

  function signParams(spec) {
    if (spec.kind === 'hmac') return { name: 'HMAC' };
    if (spec.kind === 'rsa') return spec.salt ? { name: 'RSA-PSS', saltLength: spec.salt } : { name: 'RSASSA-PKCS1-v1_5' };
    if (spec.kind === 'ec') return { name: 'ECDSA', hash: spec.hash };
    return { name: 'Ed25519' };
  }

  // A private key from PKCS #8 PEM or a private JWK.
  async function privateKey(text, spec, alg) {
    const trimmed = text.trim();
    if (!trimmed) throw new SignError('Paste a private key, or generate a test key pair.');
    if (/-----BEGIN (RSA|EC) PRIVATE KEY-----/.test(trimmed)) {
      throw new SignError('This is a PKCS #1 or SEC 1 key. Convert it to BEGIN PRIVATE KEY (PKCS #8) or a JWK first, for example with the PEM / JWK Converter.');
    }
    if (/-----BEGIN ENCRYPTED PRIVATE KEY-----/.test(trimmed)) throw new SignError('Encrypted keys are not supported; use an unencrypted PKCS #8 key.');
    if (/-----BEGIN (PUBLIC KEY|CERTIFICATE)-----/.test(trimmed)) throw new SignError('This is a public key. Signing needs the private key.');
    try {
      if (trimmed.startsWith('{')) {
        let jwk;
        try { jwk = JSON.parse(trimmed); } catch { throw new SignError('The JWK is not valid JSON.'); }
        if (!jwk.d) throw new SignError('This JWK has no private part ("d").');
        const { alg, key_ops: ops, use, ...rest } = jwk;
        return await crypto.subtle.importKey('jwk', rest, importParams(spec), false, ['sign']);
      }
      const body = trimmed.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/);
      if (!body) throw new SignError('Paste the private key as a PEM (BEGIN PRIVATE KEY) or a JWK.');
      return await crypto.subtle.importKey('pkcs8', fromB64url(body[1]), importParams(spec), false, ['sign']);
    } catch (error) {
      if (error instanceof SignError) throw error;
      throw new SignError(`The key does not fit ${alg}: ${error.message}`);
    }
  }

  function parseJson(text, what) {
    let value;
    try { value = JSON.parse(text); } catch (error) { throw new SignError(`${what}: ${error.message}`); }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new SignError(`${what} must be a JSON object.`);
    return value;
  }

  // header, payload: objects; key: { secret, encoding } or { text }.
  async function sign(alg, header, payload, key) {
    const spec = ALGS[alg];
    if (!spec) throw new SignError(`Unknown algorithm: ${alg}`);
    const input = `${b64url(utf8(JSON.stringify({ ...header, alg })))}.${b64url(utf8(JSON.stringify(payload)))}`;
    const warnings = [];
    let cryptoKey;
    if (spec.kind === 'hmac') {
      const bytes = key.encoding === 'base64url' ? fromB64url(key.secret) : utf8(key.secret);
      if (!bytes.length) throw new SignError('Enter a secret.');
      if (bytes.length < spec.bytes) warnings.push(`${alg} needs a secret of at least ${spec.bytes} bytes (RFC 7518); this one has ${bytes.length}.`);
      cryptoKey = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: spec.hash }, false, ['sign']);
    } else {
      cryptoKey = await privateKey(key.text, spec, alg);
      if (spec.kind === 'rsa' && cryptoKey.algorithm.modulusLength < 2048) warnings.push(`The RSA key has ${cryptoKey.algorithm.modulusLength} bits; use at least 2048.`);
    }
    const signature = await crypto.subtle.sign(signParams(spec), cryptoKey, utf8(input));
    return { token: `${input}.${b64url(signature)}`, warnings };
  }

  async function generateKeyPair(alg) {
    const spec = ALGS[alg];
    let pair;
    if (spec.kind === 'rsa') pair = await crypto.subtle.generateKey({ ...importParams(spec), modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['sign', 'verify']);
    else pair = await crypto.subtle.generateKey(importParams(spec), true, ['sign', 'verify']);
    return {
      privatePem: pem('PRIVATE KEY', await crypto.subtle.exportKey('pkcs8', pair.privateKey)),
      publicPem: pem('PUBLIC KEY', await crypto.subtle.exportKey('spki', pair.publicKey))
    };
  }

  /* ── Page ───────────────────────────────────────────────────── */

  function syncAlg() {
    const spec = ALGS[algEl.value];
    secretBoxEl.hidden = spec.kind !== 'hmac';
    keyBoxEl.hidden = spec.kind === 'hmac';
    // Keep the header's "alg" in step when the header is valid JSON.
    try {
      const header = JSON.parse(headerEl.value);
      if (header && typeof header === 'object' && !Array.isArray(header)) {
        headerEl.value = JSON.stringify({ ...header, alg: algEl.value }, null, 2);
      }
    } catch { /* leave a header being edited alone */ }
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  async function doSign() {
    errorEl.hidden = true;
    noteEl.textContent = '';
    tokenEl.value = '';
    try {
      const header = parseJson(headerEl.value, t('Header'));
      const payload = parseJson(payloadEl.value, t('Payload'));
      const key = ALGS[algEl.value].kind === 'hmac' ? { secret: secretEl.value, encoding: secretEncEl.value } : { text: keyEl.value };
      const result = await sign(algEl.value, header, payload, key);
      tokenEl.value = result.token;
      noteEl.textContent = result.warnings.map(t).join(' ');
      showToast(t('Token signed.'), 'success');
    } catch (error) {
      showError(t(error.message));
    }
  }

  function addClaim(name, seconds) {
    try {
      const payload = parseJson(payloadEl.value || '{}', t('Payload'));
      payload[name] = Math.floor(Date.now() / 1000) + seconds;
      payloadEl.value = JSON.stringify(payload, null, 2);
      errorEl.hidden = true;
    } catch (error) {
      showError(t(error.message));
    }
  }

  algEl.addEventListener('change', syncAlg);
  signBtn.addEventListener('click', doSign);
  document.getElementById('jwsIat').addEventListener('click', () => addClaim('iat', 0));
  document.getElementById('jwsExp').addEventListener('click', () => addClaim('exp', 3600));
  generateBtn.addEventListener('click', async () => {
    errorEl.hidden = true;
    try {
      const pair = await generateKeyPair(algEl.value);
      keyEl.value = pair.privatePem;
      publicEl.value = pair.publicPem;
      publicBoxEl.hidden = false;
    } catch (error) {
      showError(`${t('This browser cannot make that key:')} ${error.message}`);
    }
  });
  copyBtn.addEventListener('click', () => {
    if (tokenEl.value) copyToClipboard(tokenEl.value, 'Token');
    else showToast(t('Nothing to copy.'), 'error');
  });

  // Exposed for the tests.
  window.ToolkitJwtSigner = Object.freeze({ sign, generateKeyPair });
  syncAlg();
}());
