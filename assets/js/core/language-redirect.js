/* ═══════════════════════════════════════════════════════════
   Toolkit — send a visitor who chose Turkish to the /tr/ page
   Loaded synchronously in the <head> of English pages that have a
   Turkish twin, so the English page never paints first. English
   pages carry no Turkish dictionary; the /tr/ twin is the Turkish
   version.

   Loop guard: offline, the service worker answers an unvisited /tr/
   page with its cached English twin. The tab remembers the redirect
   it made, and when it comes back to the same English page it stays
   there instead of bouncing again. i18n.js clears the guard once a
   Turkish page has loaded.
   ═══════════════════════════════════════════════════════════ */

(function redirectToTurkish() {
  'use strict';

  const GUARD_KEY = 'toolkit-language-redirect';
  try {
    if (localStorage.getItem('toolkit-language') !== 'tr') return;
    const script = document.currentScript;
    if (!script?.src) return;
    // assets/js/core/language-redirect.js → the site root.
    const root = new URL('../../../', script.src);
    if (!location.pathname.startsWith(root.pathname)) return;
    const target = new URL(`tr/${location.pathname.slice(root.pathname.length)}`, root);
    if (sessionStorage.getItem(GUARD_KEY) === target.pathname) {
      sessionStorage.removeItem(GUARD_KEY);
      return;
    }
    sessionStorage.setItem(GUARD_KEY, target.pathname);
    location.replace(target.href + location.search + location.hash);
  } catch {
    // Storage is unavailable (private mode, blocked cookies): stay in English.
  }
}());
