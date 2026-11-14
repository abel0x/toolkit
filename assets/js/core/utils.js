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
 * Escape HTML special characters. The one shared implementation: every page
 * loads utils.js before its tool module.
 * @param {*} str  Converted to a string first
 * @returns {string}
 */
function escapeHTML(str) {
  return String(str)
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

/*
 * Ctrl+Enter (⌘+Enter on a Mac) in a tool's field runs the tool: it clicks the
 * nearest primary button around that field (read-only result fields excepted). A tool that handles the keys
 * itself (Base64's Shift to decode, the typing test) calls preventDefault()
 * first, and this listener then leaves the event alone. The buttons it can
 * reach carry the shortcut in aria-keyshortcuts and a tooltip.
 */
(function initRunShortcut() {
  'use strict';

  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform || navigator.platform || '');
  const hint = isMac ? '⌘+Enter' : 'Ctrl+Enter';
  // Read-only result fields are left out: Ctrl+Enter there should not run the tool again.
  const fieldSelector = 'input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([readonly]), textarea:not([readonly]), select';

  function isUsable(button) {
    if (button.disabled || button.matches('[data-example-group]')) return false;
    const style = getComputedStyle(button);
    return style.display !== 'none' && style.visibility !== 'hidden' && button.getClientRects().length > 0;
  }

  // The first usable primary button in the smallest block around the field.
  function runButtonFor(field) {
    const main = field.closest('main');
    if (!main || !document.querySelector('.tool-header')) return null;
    for (let scope = field.parentElement; scope && main.contains(scope); scope = scope.parentElement) {
      const button = [...scope.querySelectorAll('button.btn-primary, button.btn--primary')].find(isUsable);
      if (button) return button;
    }
    return null;
  }

  function annotate(button) {
    if (!button || button.hasAttribute('aria-keyshortcuts')) return;
    button.setAttribute('aria-keyshortcuts', 'Control+Enter Meta+Enter');
    if (!button.title) button.title = hint;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return;
    if (event.defaultPrevented || !(event.target instanceof Element) || !event.target.matches(fieldSelector)) return;
    const button = runButtonFor(event.target);
    if (!button) return;
    event.preventDefault();
    annotate(button);
    button.click();
  });

  // Tools that render their fields from script do so on DOMContentLoaded;
  // label the buttons once everything has loaded, and again on focus.
  window.addEventListener('load', () => {
    document.querySelectorAll(fieldSelector.split(', ').map((selector) => `main ${selector}`).join(', ')).forEach((field) => annotate(runButtonFor(field)));
  });
  document.addEventListener('focusin', (event) => {
    if (event.target instanceof Element && event.target.matches(fieldSelector)) annotate(runButtonFor(event.target));
  });
}());

/* Elements given role="button" (drop zones, mostly) answer Enter and Space
   the way a real button does. A tool's own handler that calls
   preventDefault() keeps the key to itself. */
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || (event.key !== 'Enter' && event.key !== ' ')) return;
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.getAttribute('role') !== 'button') return;
  if (target.matches('button, a, input, select, textarea, summary')) return;
  event.preventDefault();
  target.click();
});
