(function initRobotsGenerator() {
  'use strict';

  const agentEl     = document.getElementById('rgAgent');
  const customAgent = document.getElementById('rgCustomAgent');
  const allowRows   = document.getElementById('rgAllowRows');
  const disallowRows= document.getElementById('rgDisallowRows');
  const addAllow    = document.getElementById('rgAddAllow');
  const addDisallow = document.getElementById('rgAddDisallow');
  const crawlDelay  = document.getElementById('rgCrawlDelay');
  const sitemapEl   = document.getElementById('rgSitemap');
  const outputEl    = document.getElementById('rgOutput');
  const allowAllBtn = document.getElementById('rgAllowAll');
  const blockAllBtn = document.getElementById('rgBlockAll');

  if (!agentEl) return;

  function addRow(container, val = '') {
    const row = document.createElement('div');
    const ruleName = container === allowRows ? 'Allow rule' : 'Disallow rule';
    row.style.cssText = 'display:flex;gap:.5rem;align-items:center;margin-bottom:.5rem;';
    row.innerHTML = `<input type="text" class="form-control font-mono ix-ee3d55" placeholder="/path/" value="${escapeHTML(val)}" aria-label="${ruleName}" /><button class="btn btn-secondary ix-7f36cc" aria-label="Remove rule">✕</button>`;
    row.querySelector('button').addEventListener('click', () => { row.remove(); build(); });
    row.querySelector('input').addEventListener('input', build);
    container.appendChild(row);
    build();
  }

  function build() {
    const agent = agentEl.value === 'custom' ? (customAgent.value.trim() || '*') : agentEl.value;
    let txt = `User-agent: ${agent}\n`;

    disallowRows.querySelectorAll('input').forEach(i => {
      const v = i.value.trim();
      if (v) txt += `Disallow: ${v}\n`;
    });
    allowRows.querySelectorAll('input').forEach(i => {
      const v = i.value.trim();
      if (v) txt += `Allow: ${v}\n`;
    });
    const delay = crawlDelay.value.trim();
    if (delay) txt += `Crawl-delay: ${delay}\n`;

    const sitemap = sitemapEl.value.trim();
    if (sitemap) txt += `\nSitemap: ${sitemap}\n`;

    outputEl.value = txt.trim();
  }

  agentEl.addEventListener('change', () => {
    customAgent.style.display = agentEl.value === 'custom' ? 'block' : 'none';
    build();
  });
  customAgent.addEventListener('input', build);
  crawlDelay.addEventListener('input', build);
  sitemapEl.addEventListener('input', build);
  addAllow.addEventListener('click', () => addRow(allowRows));
  addDisallow.addEventListener('click', () => addRow(disallowRows));

  allowAllBtn.addEventListener('click', () => {
    disallowRows.querySelectorAll('input').forEach(i => i.value = '');
    const rows = disallowRows.querySelectorAll('div');
    if (!rows.length) addRow(disallowRows, '');
    else disallowRows.querySelectorAll('input')[0].value = '';
    build();
  });

  blockAllBtn.addEventListener('click', () => {
    disallowRows.innerHTML = '';
    addRow(disallowRows, '/');
  });

  document.getElementById('copyRgBtn').addEventListener('click', () => copyToClipboard(outputEl.value, 'robots.txt'));
  document.getElementById('downloadRgBtn').addEventListener('click', () => {
    const blob = new Blob([outputEl.value], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'robots.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // Init
  addRow(disallowRows, '/admin/');
  agentEl.value = '*';
  build();
})();
