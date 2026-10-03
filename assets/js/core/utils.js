/* ═══════════════════════════════════════════════════════════
   TOOLKIT — assets/js/core/utils.js
   Shared utility functions available globally on all pages
   ═══════════════════════════════════════════════════════════ */

/**
 * Show an animated toast notification
 * @param {string} message - The message to display
 * @param {'success'|'error'} [type='success'] - Toast type
 */
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const icons = { success: '✓', error: '✕' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = icons[type] || icons.success;
  const text = document.createElement('span');
  text.className = 'toast-msg';
  text.textContent = message;
  toast.append(icon, text);

  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('toast--exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  toast.addEventListener('click', dismiss);
  setTimeout(dismiss, 3000);
}

/**
 * Copy text to clipboard with toast feedback
 * @param {string} text - The text to copy
 * @param {string} [label='Text'] - Display name for toast
 */
async function copyToClipboard(text, label = 'Text') {
  if (!text) { showToast('Nothing to copy', 'error'); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied!`, 'success');
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px;';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(`${label} copied!`, 'success');
    } catch {
      showToast('Copy failed — please copy manually', 'error');
    }
    document.body.removeChild(ta);
  }
}

/**
 * Bias-free cryptographically secure random integer in [0, max)
 * Uses rejection sampling to eliminate modulo bias
 * @param {number} max - Upper bound (exclusive)
 * @returns {number}
 */
function secureRandInt(max) {
  const min = (2 ** 32) % max;
  let rand;
  do {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    rand = arr[0];
  } while (rand < min);
  return rand % max;
}

/**
 * Convert an ArrayBuffer to a lowercase hex string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Format bytes into a human-readable string
 * @param {number} bytes
 * @param {number} [decimals=2]
 * @returns {string}
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const units = ['Bytes','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + units[i];
}

/**
 * Escape HTML special characters
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Lower-case text for case-insensitive matching. toLowerCase() maps the Turkish
 * capital İ to "i" plus a combining dot, which never matches a typed "i".
 * @param {string} str
 * @returns {string}
 */
function foldCase(str) {
  return str.toLowerCase().replace(/i\u0307/g, 'i');
}

/**
 * Generate a random hex color
 * @returns {string} - e.g. "#a3f2c1"
 */
function randomHexColor() {
  return '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
}
