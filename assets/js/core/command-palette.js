/* ═══════════════════════════════════════════════════════════
   Toolkit — Global command palette
   Open with Ctrl/Cmd + K to find any tool from any page.
   Only the home page ships the tool catalogue (tools-data.js and
   extra-tools-data.js); other pages fetch it, plus its Turkish strings on
   /tr/ pages, the first time the finder is about to open.
   ═══════════════════════════════════════════════════════════ */

(function initCommandPalette() {
  'use strict';

  const scriptBase = new URL('../', document.currentScript.src);
  // The release version build.py puts on every asset link (see sw.js).
  const assetVersion = new URL(document.currentScript.src).searchParams.get('v');
  // The document base differs from the location on the 404 page served at nested URLs.
  const pagePrefix = new URL(document.baseURI).pathname.includes('/tools/') ? '../' : '';
  const maxResults = 8;
  const maxRecentTools = 5;
  const recentStorageKey = 'toolkit-recent-tools-v1';
  let activeIndex = 0;
  let matches = [];
  let catalogue = null;

  function tools() {
    return typeof TOOLS_DATA === 'undefined' ? [] : TOOLS_DATA;
  }

  function loadScript(path) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const url = new URL(path, scriptBase);
      if (assetVersion) url.searchParams.set('v', assetVersion);
      script.src = url.href;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${path}`));
      document.head.appendChild(script);
    });
  }

  // Resolves once TOOLS_DATA holds every tool. It never rejects: when a
  // script cannot load (offline before it was cached) the next open retries.
  function loadCatalogue() {
    if (typeof TOOLS_DATA !== 'undefined' && window.EXPANSION_TOOLS) return Promise.resolve(true);
    if (!catalogue) {
      const turkish = document.documentElement.dataset.pageLanguage === 'tr'
        ? loadScript('i18n/tr/catalogue.js').catch(() => {})
        : Promise.resolve();
      // tools-data.js declares a const, so it must never run twice.
      const base = typeof TOOLS_DATA === 'undefined' ? loadScript('core/tools-data.js') : Promise.resolve();
      catalogue = Promise.all([
        base.then(() => loadScript('core/extra-tools-data.js')),
        turkish
      ]).then(() => true, () => {
        catalogue = null;
        return false;
      });
    }
    return catalogue;
  }

  function t(key, values) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key, values) : key.replace(/{{(\w+)}}/g, (_, name) => String(values?.[name] ?? ''));
  }

  const palette = document.createElement('div');
  palette.className = 'command-palette';
  palette.hidden = true;
  palette.innerHTML = `
    <div class="command-palette__backdrop" data-command-close></div>
    <section class="command-palette__dialog" role="dialog" aria-modal="true" aria-labelledby="commandPaletteTitle">
      <div class="command-palette__header">
        <span class="command-palette__icon" aria-hidden="true">⌘</span>
        <div>
          <h2 id="commandPaletteTitle">${t('Find a tool')}</h2>
          <p></p>
        </div>
        <div class="command-palette__header-actions">
          <button class="command-palette__clear" type="button" data-command-clear hidden>${t('Clear recent')}</button>
          <button class="command-palette__close" type="button" aria-label="${t('Close tool finder')}" data-command-close>Esc</button>
        </div>
      </div>
      <label class="sr-only" for="commandPaletteInput">${t('Search tools')}</label>
      <input id="commandPaletteInput" class="command-palette__input" type="search" autocomplete="off" placeholder="${t('Try “JSON”, “password”, or “QR”…')}" />
      <p class="command-palette__status" id="commandPaletteStatus" aria-live="polite"></p>
      <div class="command-palette__results" id="commandPaletteResults" role="listbox" aria-label="${t('Matching tools')}"></div>
      <div class="command-palette__footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> ${t('navigate')}</span>
        <span><kbd>↵</kbd> ${t('open')}</span>
        <span><kbd>Esc</kbd> ${t('close')}</span>
      </div>
    </section>`;
  document.body.appendChild(palette);

  const input = palette.querySelector('#commandPaletteInput');
  const resultsEl = palette.querySelector('#commandPaletteResults');
  const statusEl = palette.querySelector('#commandPaletteStatus');
  const clearButton = palette.querySelector('[data-command-clear]');
  const subtitle = palette.querySelector('.command-palette__header p');

  function updateSubtitle() {
    subtitle.textContent = tools().length ? t('Search all {{count}} utilities', { count: tools().length }) : '';
  }

  function toolUrl(slug) {
    return `${pagePrefix}tools/${slug}.html`;
  }

  function readRecentSlugs() {
    try {
      const parsed = JSON.parse(localStorage.getItem(recentStorageKey) || '[]');
      return Array.isArray(parsed) ? parsed.filter(slug => typeof slug === 'string') : [];
    } catch {
      return [];
    }
  }

  function saveRecentSlugs(slugs) {
    try {
      localStorage.setItem(recentStorageKey, JSON.stringify(slugs.slice(0, maxRecentTools)));
    } catch {
      // Private browsing or restrictive browser settings can disable storage.
    }
  }

  function getRecentTools() {
    const bySlug = new Map(tools().map(tool => [tool.slug, tool]));
    return readRecentSlugs()
      .map(slug => bySlug.get(slug))
      .filter(Boolean)
      .slice(0, maxRecentTools);
  }

  function rememberTool(slug) {
    const slugs = readRecentSlugs().filter(item => item !== slug);
    slugs.unshift(slug);
    saveRecentSlugs(slugs);
  }

  // Tool pages are the only pages under tools/; the catalogue is not loaded
  // yet, and getRecentTools() drops any slug it does not know.
  function rememberCurrentTool() {
    const match = location.pathname.match(/\/tools\/([a-z0-9-]+)\.html$/i);
    if (match) rememberTool(match[1]);
  }

  function getMatches(query) {
    const normalized = foldCase(query.trim());
    if (!normalized) {
      const recent = getRecentTools();
      return recent.length ? recent : tools().slice(0, maxResults);
    }

    return tools().filter((tool) => {
      const searchable = foldCase([tool.name, t(tool.name), tool.desc, t(tool.desc), tool.catLabel, t(tool.catLabel), ...(tool.tags || [])]
        .join(' '));
      return searchable.includes(normalized);
    }).slice(0, maxResults);
  }

  function updateSelection() {
    const options = resultsEl.querySelectorAll('[role="option"]');
    options.forEach((option, index) => {
      const selected = index === activeIndex;
      option.classList.toggle('is-active', selected);
      option.setAttribute('aria-selected', String(selected));
    });
  }

  function openTool(tool) {
    if (!tool) return;
    rememberTool(tool.slug);
    location.href = toolUrl(tool.slug);
  }

  function renderResults() {
    matches = getMatches(input.value);
    const showingRecent = !input.value.trim() && getRecentTools().length > 0;
    activeIndex = Math.min(activeIndex, Math.max(matches.length - 1, 0));
    resultsEl.textContent = '';
    clearButton.hidden = !showingRecent;

    if (!matches.length) {
      const [message, status] = tools().length
        ? ['No tools found. Try a different keyword.', 'No matching tools']
        : palette.hasAttribute('data-loading')
          ? ['Loading tools…', 'Loading tools…']
          : ['The tool list could not be loaded. Check your connection and try again.', 'Tool list unavailable'];
      const empty = document.createElement('p');
      empty.className = 'command-palette__empty';
      empty.textContent = t(message);
      resultsEl.appendChild(empty);
      statusEl.textContent = t(status);
      return;
    }

    statusEl.textContent = showingRecent
      ? t('Recently used tools — stored only in this browser')
      : input.value.trim()
        ? t(matches.length === 1 ? '{{count}} matching tool' : '{{count}} matching tools', { count: matches.length })
        : t('{{count}} suggested tools', { count: matches.length });
    matches.forEach((tool, index) => {
      const option = document.createElement('button');
      option.className = 'command-palette__result';
      option.type = 'button';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === activeIndex));

      const text = document.createElement('span');
      text.className = 'command-palette__result-text';
      const name = document.createElement('strong');
      name.textContent = t(tool.name);
      const desc = document.createElement('small');
      desc.textContent = t(tool.desc);
      text.append(name, desc);

      const category = document.createElement('span');
      category.className = 'command-palette__category';
      category.textContent = t(tool.catLabel);

      option.append(text, category);
      option.addEventListener('mouseenter', () => {
        activeIndex = index;
        updateSelection();
      });
      option.addEventListener('click', () => openTool(tool));
      resultsEl.appendChild(option);
    });

    updateSelection();
  }

  function openPalette() {
    palette.hidden = false;
    document.documentElement.classList.add('command-palette-open');
    input.value = '';
    activeIndex = 0;
    palette.toggleAttribute('data-loading', typeof TOOLS_DATA === 'undefined' || !window.EXPANSION_TOOLS);
    updateSubtitle();
    renderResults();
    requestAnimationFrame(() => input.focus());
    loadCatalogue().then(() => {
      if (!palette.hasAttribute('data-loading')) return;
      palette.removeAttribute('data-loading');
      updateSubtitle();
      if (!palette.hidden) renderResults();
    });
  }

  function closePalette() {
    if (palette.hidden) return;
    palette.hidden = true;
    document.documentElement.classList.remove('command-palette-open');
  }

  input.addEventListener('input', () => {
    activeIndex = 0;
    renderResults();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' && matches.length) {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % matches.length;
      updateSelection();
    } else if (event.key === 'ArrowUp' && matches.length) {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + matches.length) % matches.length;
      updateSelection();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openTool(matches[activeIndex]);
    } else if (event.key === 'Escape') {
      closePalette();
    }
  });

  palette.querySelectorAll('[data-command-close]').forEach((button) => {
    button.addEventListener('click', closePalette);
  });

  clearButton.addEventListener('click', () => {
    try { localStorage.removeItem(recentStorageKey); } catch {}
    activeIndex = 0;
    renderResults();
  });

  function addNavigationTrigger() {
    const container = document.querySelector('.nav-actions') || document.querySelector('.nav-container');
    const toggle = document.getElementById('navToggle');
    if (!container || document.querySelector('.nav-command-trigger')) return;

    const trigger = document.createElement('button');
    trigger.className = 'nav-command-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', t('Find a tool'));
    trigger.title = t('Find a tool (Ctrl/Cmd + K)');

    const label = document.createElement('span');
    label.textContent = t('Find tools');
    const shortcut = document.createElement('kbd');
    shortcut.textContent = '⌘K';
    trigger.append(label, shortcut);
    trigger.addEventListener('click', openPalette);
    // Start the fetch as soon as a click becomes likely.
    ['pointerenter', 'focus', 'touchstart'].forEach((type) => {
      trigger.addEventListener(type, loadCatalogue, { once: true, passive: true });
    });

    if (toggle && toggle.parentElement === container) container.insertBefore(trigger, toggle);
    else {
      const language = container.querySelector('.nav-language');
      if (language) container.insertBefore(trigger, language);
      else container.appendChild(trigger);
    }
  }

  rememberCurrentTool();
  addNavigationTrigger();

  window.addEventListener('toolkit:languagechange', () => {
    const trigger = document.querySelector('.nav-command-trigger');
    if (trigger) {
      trigger.setAttribute('aria-label', t('Find a tool'));
      trigger.title = t('Find a tool (Ctrl/Cmd + K)');
      const label = trigger.querySelector('span');
      if (label) label.textContent = t('Find tools');
    }
    updateSubtitle();
    if (!palette.hidden) renderResults();
  });

  document.addEventListener('keydown', (event) => {
    const isShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
    if (isShortcut) {
      event.preventDefault();
      palette.hidden ? openPalette() : closePalette();
    } else if (event.key === 'Escape') {
      closePalette();
    }
  });
})();

/* ═══════════════════════════════════════════════════════════
   Keyboard shortcuts — "?" lists the shortcuts this page answers to
   A native <dialog> keeps focus inside, closes on Esc and hands focus
   back. The footer gets a button for it, so the list is not only for
   those who already know the key.
   ═══════════════════════════════════════════════════════════ */
(function initShortcutHelp() {
  'use strict';

  if (typeof HTMLDialogElement === 'undefined') return;

  function t(key) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key) : key;
  }

  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform || navigator.platform || '');
  const modifier = isMac ? '⌘' : 'Ctrl';
  let dialog = null;
  let opener = null;

  function isTyping(target) {
    return target instanceof Element
      && Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
  }

  // Only what works here: "/" on the home page, Ctrl+Enter where a tool runs.
  function shortcuts() {
    const rows = [[[modifier, 'K'], t('Find a tool')]];
    if (document.getElementById('hubSearch')) rows.push([['/'], t('Search the tools on this page')]);
    if (document.querySelector('.tool-header') && document.querySelector('main button.btn-primary, main button.btn--primary')) {
      rows.push([[modifier, 'Enter'], t('Run the tool from one of its fields')]);
    }
    rows.push([['Esc'], t('Close a window or menu')]);
    rows.push([['?'], t('Show these shortcuts')]);
    return rows;
  }

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'shortcut-help';
    dialog.setAttribute('aria-labelledby', 'shortcutHelpTitle');
    const header = document.createElement('div');
    header.className = 'shortcut-help__header';
    const title = document.createElement('h2');
    title.id = 'shortcutHelpTitle';
    title.textContent = t('Keyboard shortcuts');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'shortcut-help__close';
    close.setAttribute('aria-label', t('Close keyboard shortcuts'));
    close.textContent = 'Esc';
    close.addEventListener('click', () => dialog.close());
    header.append(title, close);
    const list = document.createElement('dl');
    list.className = 'shortcut-help__list';
    dialog.append(header, list);
    // A click on the backdrop lands on the dialog itself.
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => {
      if (opener?.isConnected) opener.focus();
      opener = null;
    });
    document.body.appendChild(dialog);
  }

  function fill() {
    const list = dialog.querySelector('.shortcut-help__list');
    list.replaceChildren(...shortcuts().map(([keys, label]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      keys.forEach((key) => {
        const kbd = document.createElement('kbd');
        kbd.textContent = key;
        term.append(kbd);
      });
      const description = document.createElement('dd');
      description.textContent = label;
      row.append(term, description);
      return row;
    }));
    dialog.querySelector('h2').textContent = t('Keyboard shortcuts');
    dialog.querySelector('.shortcut-help__close').setAttribute('aria-label', t('Close keyboard shortcuts'));
  }

  function open() {
    if (!dialog) build();
    if (dialog.open) return;
    fill();
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector('.shortcut-help__close').focus();
  }

  function addFooterButton() {
    const footer = document.querySelector('.footer-bottom');
    if (!footer || footer.querySelector('.footer-shortcuts')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'footer-shortcuts';
    button.setAttribute('aria-haspopup', 'dialog');
    const label = document.createElement('span');
    label.textContent = t('Keyboard shortcuts');
    const key = document.createElement('kbd');
    key.textContent = '?';
    button.append(label, key);
    button.addEventListener('click', open);
    footer.insertBefore(button, footer.querySelector('.footer-tech'));
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if (isTyping(event.target) || document.querySelector('.command-palette:not([hidden])')) return;
    event.preventDefault();
    open();
  });

  window.addEventListener('toolkit:languagechange', () => {
    const label = document.querySelector('.footer-shortcuts span');
    if (label) label.textContent = t('Keyboard shortcuts');
    if (dialog?.open) fill();
  });

  addFooterButton();
}());
