/* ═══════════════════════════════════════════════════════════
   Toolkit — share a tool's input as a link
   A tool whose header has a "Copy link" button lists its fields in
   data-share-fields (and the button that runs it in data-share-action).
   The button copies a link whose fragment, #share=1.<base64url JSON>,
   holds those fields' values. Browsers never send the fragment to a
   server, so the input stays between the people who pass the link on.
   Opening such a link fills the fields and runs the tool. A broken or
   foreign fragment changes nothing; values only ever reach .value.
   ═══════════════════════════════════════════════════════════ */

(function initShareLink() {
  'use strict';

  const PREFIX = '#share=1.';
  // Long enough for real snippets, short enough for chat apps and address bars.
  const MAX_FRAGMENT = 8000;
  const button = document.querySelector('[data-share-fields]');
  if (!button) return;
  const selectors = button.dataset.shareFields.split(',').map((selector) => selector.trim()).filter(Boolean);
  const actionSelector = button.dataset.shareAction || '';

  function t(key) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key) : key;
  }

  function toast(message, type) {
    if (typeof window.showToast === 'function') window.showToast(message, type);
  }

  function encode(values) {
    let binary = '';
    new TextEncoder().encode(JSON.stringify(values)).forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decode(text) {
    if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('not base64url');
    const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }

  function fields() {
    return selectors.map((selector) => document.querySelector(selector));
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.className = 'sr-only';
      document.body.appendChild(area);
      area.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch {}
      area.remove();
      return copied;
    }
  }

  button.addEventListener('click', async () => {
    const targets = fields();
    if (targets.some((field) => !field)) return;
    const values = targets.map((field) => field.value);
    if (values.every((value) => !value.trim())) {
      toast(t('Fill in the tool before sharing it.'), 'error');
      return;
    }
    const fragment = PREFIX + encode(values);
    if (fragment.length > MAX_FRAGMENT) {
      toast(t('This input is too long to share as a link.'), 'error');
      return;
    }
    const url = location.href.split('#')[0] + fragment;
    // The address bar shows the link too, so it can be copied from there.
    try { history.replaceState(history.state, '', url); } catch {}
    if (await copy(url)) toast(t('Link copied. Anyone who opens it sees this input.'), 'success');
    else toast(t('Copy failed. Copy the link from the address bar.'), 'error');
  });

  function applyShared() {
    const hash = location.hash;
    if (!hash.startsWith('#share=')) return;
    const broken = () => toast(t('This shared link is broken or incomplete.'), 'error');
    if (!hash.startsWith(PREFIX) || hash.length > MAX_FRAGMENT) { broken(); return; }
    let values;
    try { values = decode(hash.slice(PREFIX.length)); } catch { broken(); return; }
    const targets = fields();
    if (!Array.isArray(values) || values.length !== targets.length
        || !values.every((value) => typeof value === 'string') || targets.some((field) => !field)) {
      broken();
      return;
    }
    // A choice the list does not offer means the link does not belong here.
    const unknownChoice = targets.some((field, index) => field instanceof HTMLSelectElement
      && ![...field.options].some((option) => option.value === values[index]));
    if (unknownChoice) { broken(); return; }
    targets.forEach((field, index) => {
      field.value = values[index];
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    });
    if (actionSelector) document.querySelector(actionSelector)?.click();
    toast(t('Loaded the input from the shared link.'), 'success');
  }

  // Expansion tools draw their fields from script; wait until the page is whole.
  if (document.readyState === 'complete') applyShared();
  else window.addEventListener('load', applyShared, { once: true });
  window.addEventListener('hashchange', applyShared);
}());
