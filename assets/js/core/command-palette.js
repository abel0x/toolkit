/* ═══════════════════════════════════════════════════════════
   Toolkit — Global command palette
   Open with Ctrl/Cmd + K to find any tool from any page.
   ═══════════════════════════════════════════════════════════ */

(function initCommandPalette() {
  'use strict';

  if (typeof TOOLS_DATA === 'undefined') return;

  // The document base differs from the location on the 404 page served at nested URLs.
  const pagePrefix = new URL(document.baseURI).pathname.includes('/tools/') ? '../' : '';
  const maxResults = 8;
  const maxRecentTools = 5;
  const recentStorageKey = 'toolkit-recent-tools-v1';
  let activeIndex = 0;
  let matches = [];

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
          <p>${t('Search all {{count}} utilities', { count: TOOLS_DATA.length })}</p>
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
    const bySlug = new Map(TOOLS_DATA.map(tool => [tool.slug, tool]));
    return readRecentSlugs()
      .map(slug => bySlug.get(slug))
      .filter(Boolean)
      .slice(0, maxRecentTools);
  }

  function rememberTool(slug) {
    if (!TOOLS_DATA.some(tool => tool.slug === slug)) return;
    const slugs = readRecentSlugs().filter(item => item !== slug);
    slugs.unshift(slug);
    saveRecentSlugs(slugs);
  }

  function rememberCurrentTool() {
    const filename = location.pathname.split('/').pop() || '';
    const slug = filename.replace(/\.html$/i, '');
    if (slug && slug !== 'index' && slug !== '404') rememberTool(slug);
  }

  function getMatches(query) {
    const normalized = foldCase(query.trim());
    if (!normalized) {
      const recent = getRecentTools();
      return recent.length ? recent : TOOLS_DATA.slice(0, maxResults);
    }

    return TOOLS_DATA.filter((tool) => {
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
      const empty = document.createElement('p');
      empty.className = 'command-palette__empty';
      empty.textContent = t('No tools found. Try a different keyword.');
      resultsEl.appendChild(empty);
      statusEl.textContent = t('No matching tools');
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
    renderResults();
    requestAnimationFrame(() => input.focus());
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
    const subtitle = palette.querySelector('.command-palette__header p');
    if (subtitle) subtitle.textContent = t('Search all {{count}} utilities', { count: TOOLS_DATA.length });
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
