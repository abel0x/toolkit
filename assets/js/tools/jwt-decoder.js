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
    return atob(str);
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
})();
