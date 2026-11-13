/* ═══════════════════════════════════════════════════════════
   Toolkit — client-side internationalisation
   English is the source locale and needs no dictionary. Pages under
   /tr/ ship Turkish HTML, declare data-page-language="tr" and load
   i18n-tr.js and i18n-expansion.js, so text that scripts add later is
   translated too. English pages load neither: choosing Turkish opens
   the /tr/ twin, and language-redirect.js sends a visitor who chose
   Turkish there. Only 404.html, which has no twin, translates in place.
   ═══════════════════════════════════════════════════════════ */

(function initI18n() {
  'use strict';

  const DEFAULT_LANGUAGE = 'en';
  const STORAGE_KEY = 'toolkit-language';
  const SUPPORTED_LANGUAGES = new Set(['en', 'tr']);
  const originalText = new WeakMap();
  const originalAttributes = new WeakMap();
  const pageLanguage = SUPPORTED_LANGUAGES.has(document.documentElement.dataset.pageLanguage)
    ? document.documentElement.dataset.pageLanguage
    : null;
  // Turkish is only possible where its dictionary was loaded.
  const turkish = window.TOOLKIT_I18N_TR || null;
  let language = pageLanguage || (turkish ? readLanguage() : DEFAULT_LANGUAGE);
  if (pageLanguage) storeLanguage(pageLanguage);
  // A Turkish page arrived; language-redirect.js no longer needs its loop guard.
  if (pageLanguage === 'tr') {
    try { sessionStorage.removeItem('toolkit-language-redirect'); } catch {}
  }
  const originalDocumentTitle = document.title;
  // assets/js/core/i18n.js → the site root.
  const SITE_ROOT = document.currentScript?.src ? new URL('../../../', document.currentScript.src) : null;

  function readLanguage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED_LANGUAGES.has(stored) ? stored : DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  }

  function storeLanguage(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch {}
  }

  /*
   * The same page in another language, resolved against the site root this
   * script was served from so local previews stay on their own origin.
   * Only pages that publish hreflang alternates have a twin.
   */
  function alternateURL(locale) {
    if (!SITE_ROOT || !document.querySelector(`link[rel="alternate"][hreflang="${locale}"]`)) return null;
    if (!location.pathname.startsWith(SITE_ROOT.pathname)) return null;
    const relative = location.pathname.slice(SITE_ROOT.pathname.length);
    const english = relative.startsWith('tr/') ? relative.slice(3) : relative;
    const target = new URL(locale === 'tr' ? `tr/${english}` : english, SITE_ROOT);
    return target.pathname === location.pathname ? null : target.href;
  }

  function interpolate(text, values) {
    if (!values) return text;
    return text.replace(/{{(\w+)}}/g, (_, key) => String(values[key] ?? ''));
  }

  function t(key, values) {
    if (language !== 'tr' || !turkish) return interpolate(key, values);
    const extension = window.TOOLKIT_I18N_EXTRA?.tr || {};
    const translated = turkish.strings[key] || extension[key] || turkish.translatePattern(key, t);
    return interpolate(translated, values);
  }

  function canTranslateText(node) {
    if (!node.nodeValue || !node.nodeValue.trim()) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    return !parent.closest('script, style, noscript, pre, code, textarea, input, [contenteditable="true"], [data-i18n-skip]');
  }

  function translateTextNode(node) {
    if (!canTranslateText(node)) return;
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const source = originalText.get(node);
    const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const key = match ? match[2].replace(/\s+/g, ' ').trim() : source;
    const translated = t(key);
    node.nodeValue = match ? `${match[1]}${translated}${match[3]}` : translated;
  }

  function translateAttribute(element, attribute) {
    if (!element.hasAttribute(attribute)) return;
    let attributes = originalAttributes.get(element);
    if (!attributes) {
      attributes = new Map();
      originalAttributes.set(element, attributes);
    }
    if (!attributes.has(attribute)) attributes.set(attribute, element.getAttribute(attribute));
    element.setAttribute(attribute, t(attributes.get(attribute)));
  }

  function canTranslateAttribute(element, attribute) {
    if (attribute !== 'value') return true;
    if (element.tagName !== 'INPUT') return false;
    return ['button', 'reset', 'submit'].includes((element.getAttribute('type') || '').toLowerCase());
  }

  function apply(root) {
    const target = root || document.body;
    if (!target) return;

    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    translateDocumentTitle();

    // An option without a value inherits its translated text as its functional value.
    // Pin the source value before walking text nodes, including dynamically added options.
    const options = target.querySelectorAll ? [...target.querySelectorAll('option:not([value])')] : [];
    if (target.nodeType === Node.ELEMENT_NODE && target.matches('option:not([value])')) options.unshift(target);
    options.forEach((option) => { option.value = option.textContent.trim().replace(/\s+/g, ' '); });

    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(translateTextNode);

    const elements = [];
    if (target.nodeType === Node.ELEMENT_NODE) elements.push(target);
    if (target.querySelectorAll) elements.push(...target.querySelectorAll('*'));
    elements.forEach((element) => {
      if (element.matches('[data-i18n]')) {
        element.textContent = t(element.dataset.i18n);
      }
      ['aria-label', 'title', 'placeholder', 'value'].forEach((attribute) => {
        if (canTranslateAttribute(element, attribute)) translateAttribute(element, attribute);
      });
    });
  }

  function translateDocumentTitle() {
    const toolTitle = originalDocumentTitle.match(/^(.+?) — Toolkit$/);
    document.title = toolTitle ? `${t(toolTitle[1])} — Toolkit` : t(originalDocumentTitle);
  }

  function createLanguageControl() {
    const container = document.querySelector('.nav-actions') || document.querySelector('.nav-container');
    const toggle = document.getElementById('navToggle');
    if (!container || document.querySelector('.nav-language')) return;

    const control = document.createElement('div');
    control.className = 'nav-language';

    const trigger = document.createElement('button');
    trigger.className = 'nav-language__trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', t('Language'));
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.title = t('Language');

    const current = document.createElement('span');
    current.className = 'nav-language__current';
    current.textContent = language === 'tr' ? 'Türkçe' : 'English';
    trigger.appendChild(current);

    const menu = document.createElement('div');
    menu.className = 'nav-language__menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', t('Language'));
    menu.hidden = true;

    const options = ['en', 'tr'].map((locale) => {
      const option = document.createElement('button');
      option.className = 'nav-language__option';
      option.type = 'button';
      option.dataset.language = locale;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(locale === language));
      option.textContent = locale === 'tr' ? 'Türkçe' : 'English';
      option.addEventListener('click', () => {
        const target = alternateURL(locale);
        if (target) {
          storeLanguage(locale);
          location.assign(target + location.search + location.hash);
          return;
        }
        setLanguage(locale);
        setMenuOpen(false);
        trigger.focus();
      });
      menu.appendChild(option);
      return option;
    });

    function setMenuOpen(open) {
      menu.hidden = !open;
      trigger.setAttribute('aria-expanded', String(open));
    }

    function focusOption(direction) {
      setMenuOpen(true);
      const currentIndex = options.indexOf(document.activeElement);
      const nextIndex = currentIndex === -1
        ? options.findIndex((option) => option.dataset.language === language)
        : (currentIndex + direction + options.length) % options.length;
      options[Math.max(0, nextIndex)].focus();
    }

    trigger.addEventListener('click', () => setMenuOpen(menu.hidden));
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); focusOption(-1); }
      if (event.key === 'Escape') setMenuOpen(false);
    });
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); focusOption(-1); }
      if (event.key === 'Escape') { setMenuOpen(false); trigger.focus(); }
    });
    control.addEventListener('focusout', () => requestAnimationFrame(() => {
      if (!control.contains(document.activeElement)) setMenuOpen(false);
    }));
    document.addEventListener('click', (event) => {
      if (!control.contains(event.target)) setMenuOpen(false);
    });

    control.append(trigger, menu);
    container.insertBefore(control, toggle || null);
  }

  function setLanguage(nextLanguage) {
    const next = SUPPORTED_LANGUAGES.has(nextLanguage) ? nextLanguage : DEFAULT_LANGUAGE;
    // Without the Turkish dictionary the page can only switch by opening its twin.
    if (next === 'tr' && !turkish) {
      const target = alternateURL('tr');
      storeLanguage(next);
      if (target) location.assign(target + location.search + location.hash);
      return;
    }
    language = next;
    storeLanguage(next);
    apply();
    document.querySelectorAll('.nav-language').forEach((control) => {
      const trigger = control.querySelector('.nav-language__trigger');
      const current = control.querySelector('.nav-language__current');
      const menu = control.querySelector('.nav-language__menu');
      if (trigger) {
        trigger.setAttribute('aria-label', t('Language'));
        trigger.title = t('Language');
      }
      if (current) current.textContent = next === 'tr' ? 'Türkçe' : 'English';
      if (menu) {
        menu.setAttribute('aria-label', t('Language'));
        menu.hidden = true;
      }
      control.querySelectorAll('.nav-language__option').forEach((option) => {
        option.setAttribute('aria-selected', String(option.dataset.language === next));
      });
    });
    window.dispatchEvent(new CustomEvent('toolkit:languagechange', { detail: { language: next } }));
  }

  window.ToolkitI18n = Object.freeze({
    t,
    apply,
    getLanguage: () => language,
    setLanguage,
    defaultLanguage: DEFAULT_LANGUAGE,
    storageKey: STORAGE_KEY
  });

  createLanguageControl();
  apply();

  // Translate later-inserted shared controls without touching tool input data.
  const observer = new MutationObserver((records) => {
    const added = new Set();
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) added.add(node);
    }));
    added.forEach((node) => apply(node.nodeType === Node.TEXT_NODE ? node.parentElement : node));
  });
  observer.observe(document.body, { childList: true, subtree: true });
}());
