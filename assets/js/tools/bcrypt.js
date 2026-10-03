/* Bcrypt hash generation and verification using the self-hosted bcrypt.js library. */

(function initBcrypt() {
  'use strict';

  const inputEl = document.getElementById('bcryptInput');
  const costEl = document.getElementById('bcryptCost');
  const costVal = document.getElementById('bcryptCostVal');
  const outputEl = document.getElementById('bcryptOutput');
  const timeEl = document.getElementById('bcryptTime');
  const genBtn = document.getElementById('bcryptGenBtn');
  const copyBtn = document.getElementById('bcryptCopyBtn');
  const verifyPasswordEl = document.getElementById('bcryptVerifyPw');
  const verifyHashEl = document.getElementById('bcryptVerifyHash');
  const verifyBtn = document.getElementById('bcryptVerifyBtn');
  const verifyResult = document.getElementById('bcryptVerifyResult');

  if (!inputEl || !genBtn) return;

  const bcrypt = window.dcodeIO && window.dcodeIO.bcrypt;

  function setBusy(button, busy, busyLabel, readyLabel) {
    button.disabled = busy;
    button.textContent = busy ? busyLabel : readyLabel;
  }

  function hashPassword(password, rounds) {
    return new Promise((resolve, reject) => {
      bcrypt.hash(password, rounds, (error, hash) => {
        if (error) reject(error);
        else resolve(hash);
      });
    });
  }

  function comparePassword(password, hash) {
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, hash, (error, matches) => {
        if (error) reject(error);
        else resolve(matches);
      });
    });
  }

  async function generate() {
    const password = inputEl.value;
    if (!password) {
      showToast('Enter a password first', 'error');
      return;
    }
    if (!bcrypt) {
      showToast('Bcrypt library failed to load.', 'error');
      return;
    }

    setBusy(genBtn, true, 'Hashing…', 'Generate Hash');
    outputEl.value = '';
    timeEl.textContent = '';
    try {
      const startedAt = performance.now();
      const hash = await hashPassword(password, Number.parseInt(costEl.value, 10));
      outputEl.value = hash;
      timeEl.textContent = ToolkitI18n.t('Hashed in {{time}} ms (cost={{cost}})', {
        time: Math.round(performance.now() - startedAt),
        cost: costEl.value
      });
    } catch (error) {
      showToast(ToolkitI18n.t('Hashing failed: {{message}}', { message: error.message }), 'error');
    } finally {
      setBusy(genBtn, false, 'Hashing…', 'Generate Hash');
      ToolkitI18n.apply(genBtn);
    }
  }

  async function verify() {
    const password = verifyPasswordEl.value;
    const hash = verifyHashEl.value.trim();
    if (!password || !hash) {
      showToast('Enter both password and hash', 'error');
      return;
    }
    if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) {
      showToast('Invalid bcrypt hash format', 'error');
      return;
    }
    if (!bcrypt) {
      showToast('Bcrypt library failed to load.', 'error');
      return;
    }

    setBusy(verifyBtn, true, 'Verifying…', 'Verify');
    verifyResult.textContent = '';
    try {
      const matches = await comparePassword(password, hash);
      const message = matches ? 'Password matches' : 'Password does not match';
      verifyResult.className = matches ? 'verify-result verify-result--success' : 'verify-result verify-result--error';
      verifyResult.textContent = `${matches ? '✓' : '✗'} ${ToolkitI18n.t(message)}`;
    } catch (error) {
      verifyResult.className = 'verify-result verify-result--error';
      verifyResult.textContent = ToolkitI18n.t('Verification failed: {{message}}', { message: error.message });
    } finally {
      setBusy(verifyBtn, false, 'Verifying…', 'Verify');
      ToolkitI18n.apply(verifyBtn);
    }
  }

  costEl.addEventListener('input', () => {
    costVal.textContent = costEl.value;
  });
  genBtn.addEventListener('click', generate);
  verifyBtn.addEventListener('click', verify);
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'Bcrypt hash');
    else showToast('Nothing to copy', 'error');
  });
  [inputEl, verifyPasswordEl, verifyHashEl].forEach((element) => {
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      if (element === inputEl) generate();
      else verify();
    });
  });
}());
