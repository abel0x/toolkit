/* ═══════════════════════════════════════════════════════════
   TOOLKIT — assets/js/pages/home.js
   Homepage search + filter orchestration
   Depends on: tools-data.js (TOOLS_DATA global)
   ═══════════════════════════════════════════════════════════ */

(function initHubSearch() {
  'use strict';

  /* ── Element refs ──────────────────────────────────────── */
  const searchInput  = document.getElementById('hubSearch');
  const filterBtns   = document.querySelectorAll('.hub-filter-btn');
  const hubGrid      = document.getElementById('hubGrid');
  const noResults    = document.getElementById('hubNoResults');

  if (!hubGrid) return; // not on the homepage

  /* ── Data-driven cards for every registered tool ───────── */
  function addMissingCards() {
    if (typeof TOOLS_DATA === 'undefined') return;
    const known = new Set([...hubGrid.querySelectorAll('.hub-card')]
      .map((card) => card.getAttribute('href')?.split('/').pop()?.replace(/\.html$/, ''))
      .filter(Boolean));
    const fallbackIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>';

    TOOLS_DATA.forEach((tool) => {
      if (known.has(tool.slug)) return;
      const card = document.createElement('a');
      card.href = `tools/${tool.slug}.html`;
      card.className = 'hub-card';
      card.dataset.cat = tool.cat;
      card.dataset.tags = (tool.tags || []).join(' ');

      const header = document.createElement('div');
      header.className = 'hub-card-header';
      const icon = document.createElement('div');
      icon.className = 'hub-card-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = tool.icon || fallbackIcon;
      const title = document.createElement('h3');
      title.className = 'hub-card-title';
      title.textContent = tool.name;
      header.append(icon, title);

      const description = document.createElement('p');
      description.className = 'hub-card-desc';
      description.textContent = tool.desc;
      card.append(header, description);
      hubGrid.appendChild(card);
    });

    const total = TOOLS_DATA.length;
    const headingCount = document.querySelector('#hubHeading .gradient-text');
    if (headingCount) headingCount.textContent = `${total} Tools`;
    window.ToolkitI18n?.apply(hubGrid);
  }

  addMissingCards();

  /* ── Tool count on every category tab ──────────────────── */
  filterBtns.forEach((btn) => {
    const filter = btn.dataset.filter || 'all';
    const count = filter === 'all'
      ? hubGrid.querySelectorAll('.hub-card[data-cat]').length
      : hubGrid.querySelectorAll(`.hub-card[data-cat="${filter}"]`).length;
    const badge = document.createElement('span');
    badge.className = 'hub-filter-count';
    badge.textContent = String(count);
    btn.append(' ', badge);
  });

  /* ── State ─────────────────────────────────────────────── */
  let activeFilter = 'all';
  let searchQuery  = '';

  /* ── Helpers ────────────────────────────────────────────── */
  function getCards() {
    return hubGrid.querySelectorAll('.hub-card[data-cat]');
  }

  function matchesFilter(card) {
    if (activeFilter === 'all') return true;
    return card.dataset.cat === activeFilter;
  }

  function matchesSearch(card) {
    if (!searchQuery) return true;
    const q = foldCase(searchQuery);
    const title = foldCase(card.querySelector('.hub-card-title')?.textContent || '');
    const desc  = foldCase(card.querySelector('.hub-card-desc')?.textContent  || '');
    const tags  = foldCase(card.dataset.tags || '');
    return title.includes(q) || desc.includes(q) || tags.includes(q);
  }

  function applyFilters() {
    const cards = getCards();
    let visible = 0;

    cards.forEach(card => {
      const show = matchesFilter(card) && matchesSearch(card);
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    if (noResults) {
      noResults.style.display = visible === 0 ? 'block' : 'none';
    }
  }

  /* ── Filter buttons ─────────────────────────────────────── */
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      activeFilter = btn.dataset.filter || 'all';
      applyFilters();
    });
  });

  /* ── Search input ───────────────────────────────────────── */
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchQuery = searchInput.value.trim();
        applyFilters();
      }, 150);
    });

    // Clear on Escape
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchQuery = '';
        applyFilters();
        searchInput.blur();
      }
    });
  }

  /* ── Category links (#category-security from tool breadcrumbs) ── */
  function selectCategoryFromHash() {
    const match = location.hash.match(/^#category-([a-z]+)$/);
    const button = match && [...filterBtns].find((btn) => btn.dataset.filter === match[1]);
    if (button) button.click();
  }

  window.addEventListener('hashchange', selectCategoryFromHash);

  /* ── Initial run ────────────────────────────────────────── */
  applyFilters();
  selectCategoryFromHash();
})();


/* ════════════════════════════════════════════════════════════
   Keyboard shortcut — press "/" to focus search
   ════════════════════════════════════════════════════════════ */
(function initSearchShortcut() {
  'use strict';

  const searchInput = document.getElementById('hubSearch');
  if (!searchInput) return;

  document.addEventListener('keydown', e => {
    // Ignore if user is typing in another input / textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

    if (e.key === '/') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });
})();
