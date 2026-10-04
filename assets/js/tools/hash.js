/* TOOLKIT — assets/js/tools/hash.js */
(function initHashGenerator() {
  const hashInput  = document.getElementById('hashInput');
  const hashGenBtn = document.getElementById('hashGenBtn');
  const hashResults = document.getElementById('hashResults');

  if (!hashGenBtn) return;

  const ALGORITHMS = [
    { label: 'SHA-1',   algo: 'SHA-1',   legacy: true },
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
      ALGORITHMS.map(async ({ label, algo, legacy }) => {
        try {
          const hashBuffer = await crypto.subtle.digest(algo, data);
          return { label, hash: bufferToHex(hashBuffer), legacy, error: null };
        } catch (err) {
          return { label, hash: null, legacy, error: err.message };
        }
      })
    );

    hashResults.innerHTML = '';
    results.forEach(({ label, hash, legacy, error }) => {
      const card = document.createElement('div');
      card.className = 'hash-card';
      card.innerHTML = `
        <div class="hash-card-header">
          <span class="hash-algo">
            <span class="hash-algo-badge">${label}</span>
            ${legacy ? '<span class="hash-legacy-note" title="SHA-1 is cryptographically broken. Use for legacy compatibility only.">⚠ Legacy</span>' : ''}
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
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generateHashes();
  });
})();
