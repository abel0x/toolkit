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
      icon.innerHTML = tool.icon || fallbackIcon;
      const category = document.createElement('span');
      category.className = 'hub-card-cat';
      category.textContent = tool.catLabel;
      header.append(icon, category);

      const title = document.createElement('h3');
      title.className = 'hub-card-title';
      title.textContent = tool.name;
      const description = document.createElement('p');
      description.className = 'hub-card-desc';
      description.textContent = tool.desc;
      const footer = document.createElement('span');
      footer.className = 'hub-card-footer';
      footer.textContent = 'Open tool →';
      card.append(header, title, description, footer);
      hubGrid.appendChild(card);
    });

    const total = TOOLS_DATA.length;
    const headingCount = document.querySelector('#hubHeading .gradient-text');
    if (headingCount) headingCount.textContent = `${total} Tools`;
    window.ToolkitI18n?.apply(hubGrid);
  }

  addMissingCards();

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
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
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

  /* ── Initial run ────────────────────────────────────────── */
  applyFilters();
})();


/* ════════════════════════════════════════════════════════════
   Tool count badge — syncs stat number with actual tool count
   ════════════════════════════════════════════════════════════ */
(function syncToolCount() {
  'use strict';
  if (typeof TOOLS_DATA === 'undefined') return;

  const statEl = document.getElementById('toolCountStat');
  if (statEl) {
    statEl.textContent = TOOLS_DATA.length;
  }
})();


/* ════════════════════════════════════════════════════════════
   Hub card hover — subtle parallax tilt on mouse move
   ════════════════════════════════════════════════════════════ */
(function initCardTilt() {
  'use strict';

  const cards = document.querySelectorAll('.hub-card');
  const MAX_TILT = 6; // degrees

  cards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width  - 0.5;
      const y = (e.clientY - rect.top)  / rect.height - 0.5;
      card.style.transform = `perspective(600px) rotateY(${x * MAX_TILT}deg) rotateX(${-y * MAX_TILT}deg) translateY(-4px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
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
