/* ═══════════════════════════════════════════════════════════
   TOOLKIT — assets/js/pages/home.js
   Homepage search + filter orchestration
   Every tool already has a card in index.html (build.py writes the
   ones that are not hand-written), so this script only filters them.
   ═══════════════════════════════════════════════════════════ */

(function initHubSearch() {
  'use strict';

  /* ── Element refs ──────────────────────────────────────── */
  const searchInput  = document.getElementById('hubSearch');
  const filterBtns   = document.querySelectorAll('.hub-filter-btn');
  const hubGrid      = document.getElementById('hubGrid');
  const noResults    = document.getElementById('hubNoResults');

  if (!hubGrid) return; // not on the homepage

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
    if (!button) return;
    button.click();
    // On phones the tabs scroll sideways: bring the chosen one into view.
    const row = button.closest('.hub-filter');
    if (row && row.scrollWidth > row.clientWidth) {
      row.scrollLeft += button.getBoundingClientRect().left - row.getBoundingClientRect().left - 16;
    }
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
