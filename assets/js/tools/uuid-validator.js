/* uuid-validator.js — Toolkit */
(function initUuidValidator() {
  'use strict';

  var input     = document.getElementById('uuidInput');
  var results   = document.getElementById('uuidResults');
  var list      = document.getElementById('uuidResultList');
  var summary   = document.getElementById('uuidSummary');
  var validateB = document.getElementById('validateBtn');
  var clearB    = document.getElementById('clearBtn');
  var sampleB   = document.getElementById('sampleBtn');

  if (!input) return;

  // RFC 9562: versions 1–8 with the RFC variant (10xx), plus the special nil and max UUIDs.
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var NIL_UUID = '00000000-0000-0000-0000-000000000000';
  var MAX_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  function isSpecial(uuid) {
    var lower = uuid.toLowerCase();
    return lower === NIL_UUID || lower === MAX_UUID;
  }

  var SAMPLES = [
    '550e8400-e29b-41d4-a716-446655440000',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    'invalid-uuid-here',
    'not-a-uuid-at-all',
    '123e4567-e89b-12d3-a456-426614174000'
  ];

  function getVersion(uuid) {
    return parseInt(uuid.charAt(14), 16);
  }

  function getVariant(uuid) {
    // 8, 9, a and b all encode the same RFC 9562 (formerly RFC 4122) variant bits.
    return /[89ab]/i.test(uuid.charAt(19)) ? 'RFC 9562 variant' : 'Unknown variant';
  }

  function getVersionDesc(v) {
    var map = {
      1: 'v1 — Time-based',
      2: 'v2 — DCE Security',
      3: 'v3 — Name-based (MD5)',
      4: 'v4 — Random',
      5: 'v5 — Name-based (SHA-1)',
      6: 'v6 — Reordered time',
      7: 'v7 — Unix time-ordered',
      8: 'v8 — Custom'
    };
    return map[v] || 'Unknown version';
  }

  function validate() {
    var lines = input.value.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) {
      showToast('Enter at least one UUID.', 'error');
      return;
    }

    list.innerHTML = '';
    var validCount = 0;

    lines.forEach(function(line) {
      var special = isSpecial(line);
      var isValid = special || UUID_RE.test(line);
      if (isValid) validCount++;

      var ver = isValid && !special ? getVersion(line) : null;
      var variant = isValid && !special ? getVariant(line) : null;
      var verDesc = special
        ? (line.toLowerCase() === NIL_UUID ? 'Nil UUID' : 'Max UUID')
        : isValid ? getVersionDesc(ver) : null;

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;padding:.6rem .75rem;border-radius:.5rem;background:var(--surface-2, rgba(255,255,255,.03));';

      var badge = document.createElement('span');
      badge.className = 'status-badge ' + (isValid ? 'valid' : 'invalid');
      badge.textContent = isValid ? 'VALID' : 'INVALID';

      var code = document.createElement('code');
      code.className = 'font-mono';
      code.style.cssText = 'flex:1;font-size:.82rem;word-break:break-all;';
      code.textContent = line;

      row.appendChild(badge);
      row.appendChild(code);

      if (isValid) {
        var meta = document.createElement('span');
        meta.style.cssText = 'font-size:.8rem;opacity:.7;white-space:nowrap;';
        meta.textContent = variant ? verDesc + ' · ' + variant : verDesc;
        row.appendChild(meta);
      }

      list.appendChild(row);
    });

    summary.textContent = validCount + ' valid / ' + (lines.length - validCount) + ' invalid';
    results.style.display = 'block';
  }

  validateB.addEventListener('click', validate);

  clearB.addEventListener('click', function() {
    input.value = '';
    results.style.display = 'none';
    list.innerHTML = '';
  });

  sampleB.addEventListener('click', function() {
    input.value = SAMPLES.join('\n');
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) validate();
  });
})();
