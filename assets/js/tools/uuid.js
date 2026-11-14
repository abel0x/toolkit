/* TOOLKIT — assets/js/tools/uuid.js */
(function initUUID() {
  const uuidCount    = document.getElementById('uuidCount');
  const uuidCountVal = document.getElementById('uuidCountVal');
  const genBtn       = document.getElementById('uuidGenBtn');
  const clearBtn     = document.getElementById('uuidClearBtn');
  const uuidList     = document.getElementById('uuidList');
  const versionSelect = document.getElementById('uuidVersion');

  if (!uuidCount) return;

  function updateCountSlider() {
    const pct = ((uuidCount.value - uuidCount.min) / (uuidCount.max - uuidCount.min)) * 100;
    uuidCount.style.setProperty('--val', pct + '%');
    const n = parseInt(uuidCount.value, 10);
    uuidCountVal.textContent = n + ' UUID' + (n > 1 ? 's' : '');
  }

  uuidCount.addEventListener('input', updateCountSlider);
  updateCountSlider();

  function generateUUIDv4() {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    // Fallback: manual RFC 4122 v4 implementation
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version bits (v4)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant bits (RFC 4122)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));

    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join(''),
    ].join('-');
  }

  function format(bytes) {
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // RFC 9562 version 7: 48-bit Unix time in milliseconds, then random bits.
  // Within one millisecond the 12-bit rand_a field counts up (method 1 of
  // RFC 9562 §6.2), so a batch is always in ascending order.
  let lastMs = -1;
  let counter = 0;
  function generateUUIDv7() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let ms = Date.now();
    if (ms <= lastMs) {
      ms = lastMs;
      counter += 1;
      if (counter > 0xfff) { ms += 1; counter = bytes[7] & 0x7ff; }
    } else {
      counter = ((bytes[6] & 0x07) << 8) | bytes[7]; // start in the lower half to leave room
    }
    lastMs = ms;
    for (let index = 5; index >= 0; index -= 1) {
      bytes[index] = ms % 256;
      ms = Math.floor(ms / 256);
    }
    bytes[6] = 0x70 | (counter >> 8);
    bytes[7] = counter & 0xff;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return format(bytes);
  }

  function generateAll() {
    const count = parseInt(uuidCount.value, 10);
    const generate = versionSelect?.value === '7' ? generateUUIDv7 : generateUUIDv4;

    for (let i = 0; i < count; i++) {
      const uuid = generate();
      const totalItems = uuidList.children.length;

      const li = document.createElement('li');
      li.className = 'uuid-item';
      li.setAttribute('role', 'listitem');
      li.style.animationDelay = `${i * 0.04}s`;
      li.innerHTML = `
        <span class="uuid-index" aria-hidden="true">${(totalItems + i + 1).toString().padStart(2, '0')}</span>
        <code class="uuid-value">${uuid}</code>
        <button class="icon-btn uuid-copy-btn" aria-label="Copy UUID ${uuid}" title="Copy UUID">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      `;

      li.querySelector('.uuid-copy-btn').addEventListener('click', () => {
        copyToClipboard(uuid, 'UUID');
      });

      uuidList.appendChild(li);
    }

    // Scroll to bottom of list
    uuidList.scrollTop = uuidList.scrollHeight;
  }

  function clearAll() {
    uuidList.innerHTML = '';
    showToast('Cleared all UUIDs');
  }

  genBtn.addEventListener('click', generateAll);
  clearBtn.addEventListener('click', clearAll);
})();
