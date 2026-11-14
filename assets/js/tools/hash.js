/* TOOLKIT — assets/js/tools/hash.js */
(function initHashGenerator() {
  const hashInput  = document.getElementById('hashInput');
  const hashGenBtn = document.getElementById('hashGenBtn');
  const hashResults = document.getElementById('hashResults');

  if (!hashGenBtn) return;

  // MD5 is not in Web Crypto; md5.js computes it. MD5 and SHA-1 are broken
  // for security and are offered only to match existing checksums.
  const ALGORITHMS = [
    { label: 'MD5',     algo: 'MD5',     legacy: true, warning: 'MD5 is broken for security. Use it only to compare checksums.' },
    { label: 'SHA-1',   algo: 'SHA-1',   legacy: true, warning: 'SHA-1 is cryptographically broken. Use for legacy compatibility only.' },
    { label: 'SHA-256', algo: 'SHA-256',  legacy: false },
    { label: 'SHA-384', algo: 'SHA-384',  legacy: false },
    { label: 'SHA-512', algo: 'SHA-512',  legacy: false },
  ];

  async function generateHashes() {
    const text = hashInput.value;
    if (!text) {
      showToast('Please enter some text to hash', 'error');
      hashInput.focus();
      return;
    }

    hashResults.innerHTML = '<p class="ix-8acbdb">Generating…</p>';

    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    const results = await Promise.all(
      ALGORITHMS.map(async ({ label, algo, legacy, warning }) => {
        try {
          const hash = algo === 'MD5' ? window.ToolkitMD5.hex(data) : bufferToHex(await crypto.subtle.digest(algo, data));
          return { label, hash, legacy, warning, error: null };
        } catch (err) {
          return { label, hash: null, legacy, warning, error: err.message };
        }
      })
    );

    hashResults.innerHTML = '';
    results.forEach(({ label, hash, legacy, warning, error }) => {
      const card = document.createElement('div');
      card.className = 'hash-card';
      card.innerHTML = `
        <div class="hash-card-header">
          <span class="hash-algo">
            <span class="hash-algo-badge">${label}</span>
            ${legacy ? `<span class="hash-legacy-note" title="${warning}">⚠ Legacy</span>` : ''}
          </span>
          <button class="icon-btn hash-copy-btn" aria-label="Copy ${label} hash" title="Copy hash">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
        ${error
          ? `<span class="error-msg">${error}</span>`
          : `<code class="hash-value">${hash}</code>`
        }
      `;

      if (!error) {
        card.querySelector('.hash-copy-btn').addEventListener('click', () => {
          copyToClipboard(hash, label + ' hash');
        });
      }

      hashResults.appendChild(card);
    });
  }

  hashGenBtn.addEventListener('click', generateHashes);

  // Also trigger on Ctrl+Enter inside textarea
  hashInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); generateHashes(); }
  });
})();
