"""
build.py — Toolkit build helper
=====================================
Every task is idempotent: running it twice leaves the tree unchanged.

Usage:
  python3 build.py --all             Regenerate every maintained file (run before committing)
  python3 build.py --check           Fail if any maintained file is out of date (used by CI)
  python3 build.py --site            Assemble the publishable site in _site/

  python3 build.py --registry        Generate the browser tool registries from _data/tools.json
  python3 build.py --sync-expansion  Create or refresh generated expansion-tool shells
  python3 build.py --nav             Inject nav HTML from _includes/_nav.html into published pages
  python3 build.py --tool-count      Synchronize published static tool-count copy
  python3 build.py --metadata        Add social preview images and JSON-LD to the English pages
  python3 build.py --turkish         Generate the tr/ pages from _data/seo-tr.json
  python3 build.py --words           Generate the word-list precache manifest
  python3 build.py --offline         Generate the tool precache manifest
  python3 build.py --sitemap         Generate sitemap.xml with content-based lastmod dates

_data/tools.json is the single source for the tool list: the two browser
registries, the expansion-tool shells and the sitemap are all generated from
it.

Any task also refreshes the service-worker CACHE_VERSION, a content hash of
every published file, so returning visitors never mix new HTML with stale
cached CSS or JavaScript.
"""

import argparse
import contextlib
import datetime
import hashlib
import html as html_lib
import io
import json
import os
import re
import shutil
import sys

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT        = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR   = os.path.join(ROOT, 'tools')
WORDS_DIR   = os.path.join(ROOT, 'words')
NAV_FILE    = os.path.join(ROOT, '_includes', '_nav.html')
SITE_BASE   = 'https://abel0x.github.io/toolkit/'

SITE_DIR    = os.path.join(ROOT, '_site')
TOOLS_JSON  = os.path.join(ROOT, '_data', 'tools.json')
LASTMOD_JSON = os.path.join(ROOT, '_data', 'lastmod.json')
SEO_TR_JSON = os.path.join(ROOT, '_data', 'seo-tr.json')
TR_DIR      = os.path.join(ROOT, 'tr')
TR_PREFIX   = 'tr/'
CORE_JS_DIR = os.path.join(ROOT, 'assets', 'js', 'core')

# Shared by every published page; tests/site-audit.mjs enforces it.
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; script-src 'self'; style-src 'self'; "
    "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; "
    "worker-src 'self'; manifest-src 'self'; object-src 'none'; "
    "base-uri 'self'; form-action 'none'"
)

# Everything GitHub Pages serves. Repository-only files (tests, build tooling,
# source data, documentation and local editor settings) are deliberately
# excluded.
PUBLISHED_FILES = (
    '.nojekyll', '404.html', 'LICENSE', 'index.html', 'manifest.json',
    'sitemap.xml', 'style.css', 'sw.js',
)
PUBLISHED_DIRS = ('assets', 'license', 'tools', 'tr', 'words')
UNPUBLISHED_SUFFIXES = ('.md',)


# ---------------------------------------------------------------------------
# Tool registry — _data/tools.json is the single source of the tool list
# ---------------------------------------------------------------------------

_TOOL_KEYS = {'slug', 'name', 'cat', 'desc', 'tags', 'icon', 'shell', 'exampleStarter'}
_REGISTRY = None


def _registry():
    """Load and validate _data/tools.json once per run.

    Returns a list of tool dicts in catalogue order, each with its catLabel
    resolved from the category table.
    """
    global _REGISTRY
    if _REGISTRY is not None:
        return _REGISTRY
    with open(TOOLS_JSON, 'r', encoding='utf-8') as fh:
        data = json.load(fh)
    categories = data['categories']
    tools, seen, errors = [], set(), []
    for index, entry in enumerate(data['tools']):
        label = entry.get('slug', f'#{index}')
        unknown = set(entry) - _TOOL_KEYS
        if unknown:
            errors.append(f'{label}: unknown keys {sorted(unknown)}')
        for key in ('slug', 'name', 'cat', 'desc', 'tags'):
            if not entry.get(key):
                errors.append(f'{label}: missing {key}')
        slug = entry.get('slug', '')
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
            errors.append(f'{label}: slug must be lowercase words joined by hyphens')
        if slug in seen:
            errors.append(f'{label}: duplicate slug')
        seen.add(slug)
        if entry.get('cat') not in categories:
            errors.append(f'{label}: unknown category {entry.get("cat")!r}')
        expansion = entry.get('shell') == 'expansion'
        if 'shell' in entry and not expansion:
            errors.append(f'{label}: shell must be "expansion" when present')
        if expansion and 'icon' in entry:
            errors.append(f'{label}: expansion tools use the shared icon; remove icon')
        if not expansion and not entry.get('icon'):
            errors.append(f'{label}: missing icon')
        if entry.get('exampleStarter') and not expansion:
            errors.append(f'{label}: exampleStarter applies only to expansion tools')
        tools.append(dict(entry, catLabel=categories.get(entry.get('cat'), '')))
    if errors:
        raise SystemExit('_data/tools.json is invalid:\n  ' + '\n  '.join(errors))
    _REGISTRY = tools
    return tools


def _expansion_tools():
    return [tool for tool in _registry() if tool.get('shell') == 'expansion']


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _tool_files():
    """Yield absolute paths for every *.html file inside tools/."""
    for name in sorted(os.listdir(TOOLS_DIR)):
        if name.endswith('.html'):
            yield os.path.join(TOOLS_DIR, name)


def _page_prefix(path):
    """Return the relative asset prefix for one published HTML page."""
    relative = os.path.relpath(path, ROOT)
    return '../' * (len(relative.split(os.sep)) - 1)


# In --check mode writes land here instead of on disk, and later reads see
# them, so the full pipeline runs exactly as it would for real.
_PENDING = None


def _read(path):
    if _PENDING is not None and path in _PENDING:
        return _PENDING[path]
    with open(path, 'r', encoding='utf-8') as fh:
        return fh.read()


def _read_bytes(path):
    if _PENDING is not None and path in _PENDING:
        return _PENDING[path].encode('utf-8')
    with open(path, 'rb') as fh:
        return fh.read()


def _registered_tool_count():
    """Return the number of tools in the catalogue."""
    return len(_registry())


def _write(path, content):
    if _PENDING is not None:
        _PENDING[path] = content
        return
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(content)


def _remove(path):
    if _PENDING is not None:
        _PENDING[path] = None
        return
    os.remove(path)


# ---------------------------------------------------------------------------
# Expansion pages — static shell, local shared implementation
# ---------------------------------------------------------------------------

def _expansion_page(tool):
    slug = tool['slug']
    category = tool['catLabel']
    safe_title = html_lib.escape(tool['name'])
    safe_desc = html_lib.escape(tool['desc'])
    url = f'{SITE_BASE}tools/{slug}.html'
    tool_count = _registered_tool_count()
    example_starter = ''
    example_script = ''
    if tool.get('exampleStarter'):
        example_starter = f'''        <div class="example-starter reveal">
          <svg class="example-starter__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m12 3-1.3 5.7L5 10l5.7 1.3L12 17l1.3-5.7L19 10l-5.7-1.3L12 3Z"/><path d="m19 15-.6 2.4L16 18l2.4.6L19 21l.6-2.4L22 18l-2.4-.6L19 15Z"/></svg>
          <p class="example-starter__copy"><strong>Need a spark?</strong><span>Load a ready-made example, then make it yours.</span></p>
          <button type="button" class="btn btn--ghost btn--sm example-starter__button" data-example-group="{slug}">Try a sample</button>
        </div>
'''
        example_script = '  <script src="../assets/js/core/example-starters.js" defer></script>\n'
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="{CONTENT_SECURITY_POLICY}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="{safe_desc}" />
  <link rel="canonical" href="{url}" />
  <meta property="og:title" content="{safe_title} — Toolkit" />
  <meta property="og:description" content="{safe_desc}" />
  <meta property="og:url" content="{url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Toolkit" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="{safe_title} — Toolkit" />
  <meta name="twitter:description" content="{safe_desc}" />
  <title>{safe_title} — Toolkit</title>
  <link rel="stylesheet" href="../assets/css/core.css" />
  <link rel="stylesheet" href="../assets/css/components.css" />
  <link rel="stylesheet" href="../assets/css/compatibility.css" />
  <link rel="stylesheet" href="../assets/css/pages/tool.css" />
  <link rel="stylesheet" href="../assets/css/features/expansion-tools.css" />
  <link rel="stylesheet" href="../assets/css/inline-styles.css" />
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/images/favicon-32.png" />
  <link rel="apple-touch-icon" href="../assets/images/favicon-256.png" />
  <meta name="theme-color" content="#0d1117" />
</head>
<body>
  <div id="toast-container" aria-live="polite" aria-atomic="true"></div>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="bg-glow bg-glow--1" aria-hidden="true"></div>
  <header>
<!-- NAV:START -->
<!-- NAV:END -->
  </header>
  <main class="tool-page-main">
    <div class="container">
      <nav class="tool-breadcrumb" aria-label="Breadcrumb"><a href="../index.html">← All Tools</a><span class="tool-breadcrumb-sep">/</span><span>{safe_title}</span></nav>
    </div>
    <section class="section" id="{slug}">
      <div class="container">
        <div class="section-header reveal">
          <span class="section-tag">{html_lib.escape(category)}</span>
          <h1 class="section-title gradient-text">{safe_title}</h1>
          <p class="section-desc">{safe_desc}</p>
        </div>
{example_starter}        <div class="card glass reveal expansion-card">
          <div id="toolApp" class="expansion-tool" data-tool="{slug}" aria-live="polite"></div>
        </div>
      </div>
    </section>
  </main>
  <footer class="footer" role="contentinfo">
    <div class="container">
      <div class="footer-inner">
        <div class="footer-brand">
          <span class="brand-name">Toolkit</span>
          <p class="footer-tagline">Privacy-first developer utilities. Everything runs in your browser.</p>
        </div>
        <div class="footer-social">
          <a href="https://github.com/abel0x" target="_blank" rel="noopener" class="social-link" aria-label="GitHub profile of abel0x">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57.0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            <span>abel0x</span>
          </a>
          <a href="https://buymeacoffee.com/abel0x" target="_blank" rel="noopener" class="social-link social-link--coffee" aria-label="Buy me a coffee">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
            <span>Buy me a coffee</span>
          </a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 Toolkit. No data leaves your device.</p>
        <p class="footer-tech">{tool_count} tools · HTML · CSS · Vanilla JS · Web Crypto API</p>
      </div>
    </div>
  </footer>
  <script src="../assets/js/core/utils.js" defer></script>
  <script src="../assets/js/core/nav.js" defer></script>
  <script src="../assets/js/core/i18n-expansion.js" defer></script>
  <script src="../assets/js/core/i18n.js" defer></script>
  <script src="../assets/js/core/tools-data.js" defer></script>
  <script src="../assets/js/core/extra-tools-data.js" defer></script>
  <script src="../assets/js/core/command-palette.js" defer></script>
  <script src="../assets/js/tools/expansion-tools.js" defer></script>
{example_script}</body>
</html>
'''


def run_sync_expansion():
    """Create missing expansion-tool shells and refresh existing ones."""
    print('\n[--sync-expansion] Synchronizing browser-only expansion tools...')
    created = updated = unchanged = 0
    for tool in _expansion_tools():
        slug = tool['slug']
        path = os.path.join(TOOLS_DIR, f'{slug}.html')
        shell = _expansion_page(tool)
        if not os.path.exists(path):
            _write(path, shell)
            print(f'  NEW   {slug}.html')
            created += 1
            continue
        # The stored page carries the injected nav; compare the shell with the
        # nav block emptied so an unchanged page is not rewritten.
        stored = re.sub(r'(<!-- NAV:START -->).*?(<!-- NAV:END -->)', r'\1\n\2', _read(path), flags=re.DOTALL)
        if stored == shell:
            unchanged += 1
            continue
        _write(path, shell)
        print(f'  SYNC  {slug}.html')
        updated += 1

    if created or updated:
        # Generated pages carry empty NAV markers; materialize the shared
        # header here so a synchronized shell is immediately publishable.
        run_nav()

    print(f'\n[--sync-expansion] Done. {created} created, {updated} synchronized, {unchanged} unchanged.')


def replace_marker(content, marker, entries):
    """Replace one generated marker block with sorted source entries."""
    pattern = rf'({re.escape(marker + ":START")}\n).*?(\s*{re.escape(marker + ":END")})'
    replacement = r'\1' + '\n'.join(entries) + r'\2'
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f'Could not update generated marker: {marker}')
    return updated


def _js_string(value):
    """Return a single-quoted JavaScript string literal."""
    return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"


def _js_tags(tags):
    return '[' + ', '.join(_js_string(tag) for tag in tags) + ']'


def run_registry():
    """Generate the two browser registries from _data/tools.json."""
    print('\n[--registry] Generating browser tool registries...')
    base, expansion = [], []
    for tool in _registry():
        if tool.get('shell') == 'expansion':
            expansion.append(
                f"  {{ name: {_js_string(tool['name'])}, slug: {_js_string(tool['slug'])}, "
                f"cat: {_js_string(tool['cat'])}, catLabel: {_js_string(tool['catLabel'])}, "
                f"desc: {_js_string(tool['desc'])}, tags: {_js_tags(tool['tags'])} }},")
        else:
            base.append('\n'.join((
                '  {',
                f"    name: {_js_string(tool['name'])},",
                f"    slug: {_js_string(tool['slug'])},",
                f"    cat: {_js_string(tool['cat'])},",
                f"    catLabel: {_js_string(tool['catLabel'])},",
                f"    desc: {_js_string(tool['desc'])},",
                f"    tags: {_js_tags(tool['tags'])},",
                f"    icon: {_js_string(tool['icon'])},",
                '  },',
            )))
    for name, marker, entries in (
        ('tools-data.js', '// TOOLS', base),
        ('extra-tools-data.js', '// EXPANSION-TOOLS', expansion),
    ):
        path = os.path.join(CORE_JS_DIR, name)
        content = _read(path)
        revised = replace_marker(content, marker, entries)
        if revised != content:
            _write(path, revised)
    print(f'  OK    {len(base)} page tools and {len(expansion)} expansion tools.')


def _sitemap_pages():
    """Yield (URL path, repository path, hreflang alternates) for every sitemap page."""
    for relative in _localized_pages():
        location = _page_location(relative)
        alternates = (('en', location), ('tr', TR_PREFIX + location), ('x-default', location))
        yield location, relative, alternates
        yield TR_PREFIX + location, TR_PREFIX + relative, alternates


def run_sitemap():
    """Generate sitemap.xml; a page's lastmod moves only when its bytes change.

    _data/lastmod.json records the content hash and date of each page, so the
    output is stable across runs and machines and needs no git history.
    """
    print('\n[--sitemap] Generating sitemap.xml...')
    try:
        stored_ledger = _read(LASTMOD_JSON)
    except FileNotFoundError:
        stored_ledger = '{}'
    ledger = json.loads(stored_ledger)
    today = datetime.date.today().isoformat()
    revised, entries, changed = {}, [], 0
    for location, relative, alternates in _sitemap_pages():
        try:
            page = _read_bytes(os.path.join(ROOT, *relative.split('/')))
        except FileNotFoundError:
            raise SystemExit(f'{relative} is listed in _data/tools.json but does not exist; '
                             'create the page (expansion shells are created automatically).')
        digest = hashlib.sha256(page).hexdigest()
        record = ledger.get(relative)
        if not record or record['sha256'] != digest:
            record = {'date': today, 'sha256': digest}
            changed += 1
        revised[relative] = record
        links = ''.join(f'<xhtml:link rel="alternate" hreflang="{language}" '
                        f'href="{html_lib.escape(SITE_BASE + target)}"/>'
                        for language, target in alternates)
        entries.append(f'  <url><loc>{html_lib.escape(SITE_BASE + location)}</loc>'
                       f'<lastmod>{record["date"]}</lastmod>{links}</url>')
    ledger_text = json.dumps(revised, indent=2, sort_keys=True) + '\n'
    if stored_ledger != ledger_text:
        _write(LASTMOD_JSON, ledger_text)
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
               'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
               + '\n'.join(entries) + '\n</urlset>\n')
    sitemap_path = os.path.join(ROOT, 'sitemap.xml')
    if _read(sitemap_path) != sitemap:
        _write(sitemap_path, sitemap)
    print(f'  OK    {len(entries)} URLs, {changed} with a new lastmod.')


def run_offline_manifest():
    """Precache every published tool shell and its local implementation."""
    print('\n[--offline] Building complete offline precache manifest...')
    sw_path = os.path.join(ROOT, 'sw.js')
    service_worker = _read(sw_path)
    pages = [f"  'tools/{os.path.basename(path)}'," for path in _tool_files()]
    scripts = [f"  'assets/js/tools/{name}'," for name in sorted(os.listdir(os.path.join(ROOT, 'assets', 'js', 'tools'))) if name.endswith('.js')]

    service_worker = replace_marker(service_worker, '// TOOL-PRECACHE:PAGES', pages)
    service_worker = replace_marker(service_worker, '// TOOL-PRECACHE:SCRIPTS', scripts)
    _write(sw_path, service_worker)
    print(f'  OK    {len(pages)} tool pages and {len(scripts)} tool modules precached.')


def run_words_manifest():
    """Precache reusable local word data and enforce its size budget."""
    print('\n[--words] Building word-list precache manifest...')
    sw_path = os.path.join(ROOT, 'sw.js')
    service_worker = _read(sw_path)
    word_paths = []
    total_bytes = 0
    for directory, _, names in os.walk(WORDS_DIR):
        for name in names:
            if not name.endswith('.json'):
                continue
            path = os.path.join(directory, name)
            total_bytes += os.path.getsize(path)
            word_paths.append(os.path.relpath(path, ROOT).replace(os.sep, '/'))
    word_paths.sort()
    entries = [f"  '{path}'," for path in word_paths]
    service_worker = replace_marker(service_worker, '// WORDS-PRECACHE', entries)
    _write(sw_path, service_worker)
    if total_bytes > 500 * 1024:
        print(f'  WARN  word payload is {total_bytes} bytes; budget is 512000 bytes.')
    else:
        print(f'  OK    {len(entries)} word data files precached ({total_bytes} bytes).')


def run_tool_count():
    """Keep the static first-paint count aligned with the tool registry."""
    print('\n[--tool-count] Synchronizing published tool counts...')
    count = _registered_tool_count()
    updated = 0
    for path in _published_pages():
        content = _read(path)
        revised = re.sub(r'\b\d+ tools · HTML · CSS · Vanilla JS · Web Crypto API',
                         f'{count} tools · HTML · CSS · Vanilla JS · Web Crypto API', content)
        revised = re.sub(r'Search \d+ tools…', f'Search {count} tools…', revised)
        revised = re.sub(r'Browse \d+ Tools', f'Browse {count} Tools', revised)
        revised = re.sub(r'\b\d+ free developer utilities', f'{count} free developer utilities', revised)
        revised = re.sub(r'(All <span class="gradient-text">)\d+( Tools</span>)', rf'\g<1>{count}\2', revised)
        revised = re.sub(r'(<span class="stat-num" id="toolCountStat">)\d+(</span>)', rf'\g<1>{count}\2', revised)
        if revised != content:
            _write(path, revised)
            updated += 1
    print(f'  OK    {updated} published pages synchronized to {count} tools.')


# ---------------------------------------------------------------------------
# Nav injection
# ---------------------------------------------------------------------------

_NAV_START = '<!-- NAV:START -->'
_NAV_END   = '<!-- NAV:END -->'


def run_nav():
    """Inject the compact shared header into every published page."""
    print('\n[--nav] Injecting nav HTML...')

    if not os.path.isfile(NAV_FILE):
        print(f'  ERROR  Nav template not found: {NAV_FILE}')
        sys.exit(1)

    nav_template = _read(NAV_FILE).rstrip('\n')
    injected = skipped_no_markers = 0

    for path in _published_pages():
        filename = os.path.relpath(path, ROOT)
        html = _read(path)
        prefix = _page_prefix(path)
        nav_html = nav_template.replace('{{ROOT}}', prefix)

        if _NAV_START in html and _NAV_END in html:
            pattern = r'(<!-- NAV:START -->).*?(<!-- NAV:END -->)'
            replacement = f'{_NAV_START}\n{nav_html}\n{_NAV_END}'
            new_html, n = re.subn(pattern, replacement, html, count=1,
                                   flags=re.DOTALL)
        else:
            # Legacy root pages pre-date nav markers. Their header only
            # contains navigation, so it is safe to normalize in place.
            pattern = r'<header>\s*<nav\b.*?</nav>\s*</header>'
            replacement = f'<header>\n{nav_html}\n</header>'
            new_html, n = re.subn(pattern, replacement, html, count=1,
                                   flags=re.DOTALL)

        if n == 0:
            print(f'  WARN  {filename}  (replacement failed, skipping)')
            skipped_no_markers += 1
            continue

        _write(path, new_html)
        print(f'  OK    {filename}')
        injected += 1

    print(f'\n[--nav] Done. {injected} updated, {skipped_no_markers} skipped.')


# ---------------------------------------------------------------------------
# Social previews and structured data
# ---------------------------------------------------------------------------
#
# Every indexable page gets the shared 1200×630 preview image of its
# language and a JSON-LD block describing the page (WebSite, WebPage, or a
# WebApplication with a breadcrumb). JSON-LD is a data block, not a script,
# so the same-origin Content-Security-Policy does not apply to it.

_SOCIAL = {
    'en': {
        'locale': 'en_US', 'alternate': 'tr_TR', 'image': 'assets/images/og-en.png',
        'alt': 'Toolkit: everyday developer tools that run entirely in your browser.',
        'browser': 'Requires a modern browser with JavaScript enabled.',
    },
    'tr': {
        'locale': 'tr_TR', 'alternate': 'en_US', 'image': 'assets/images/og-tr.png',
        'alt': 'Toolkit: tamamen tarayıcınızda çalışan günlük geliştirici araçları.',
        'browser': 'JavaScript etkin, güncel bir tarayıcı gerektirir.',
    },
}
_GENERATED_SOCIAL = re.compile(
    r'\n[ \t]*<meta (?:property="og:(?:locale|locale:alternate|image|image:width|image:height|image:alt)"'
    r'|name="twitter:image(?::alt)?") content="[^"]*" />')
_JSON_LD = re.compile(r'\n[ \t]*<script type="application/ld\+json">.*?</script>', re.DOTALL)


def _structured_data(relative, language, title, description):
    """Describe one page in schema.org terms for its language."""
    prefix = TR_PREFIX if language == 'tr' else ''
    home = SITE_BASE + prefix
    url = SITE_BASE + prefix + _page_location(relative)
    name = re.sub(r' — Toolkit$', '', title)
    website = {'@type': 'WebSite', 'name': 'Toolkit', 'url': home}
    if relative == 'index.html':
        data = {'@context': 'https://schema.org', **website,
                'inLanguage': language, 'description': description}
    elif relative.startswith('tools/'):
        data = {'@context': 'https://schema.org', '@graph': [
            {'@type': 'WebApplication', 'name': name, 'url': url, 'description': description,
             'applicationCategory': 'DeveloperApplication', 'operatingSystem': 'Any',
             'browserRequirements': _SOCIAL[language]['browser'], 'isAccessibleForFree': True,
             'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
             'inLanguage': language, 'isPartOf': website},
            {'@type': 'BreadcrumbList', 'itemListElement': [
                {'@type': 'ListItem', 'position': 1, 'name': 'Toolkit', 'item': home},
                {'@type': 'ListItem', 'position': 2, 'name': name, 'item': url}]},
        ]}
    else:
        data = {'@context': 'https://schema.org', '@type': 'WebPage', 'name': name, 'url': url,
                'description': description, 'inLanguage': language, 'isPartOf': website}
    return json.dumps(data, ensure_ascii=False).replace('</', '<\\/')


def _with_page_metadata(html, relative, language, title, description):
    """Insert the preview image tags and JSON-LD for one page, replacing any earlier copy."""
    social = _SOCIAL[language]
    image = html_lib.escape(SITE_BASE + social['image'])
    alt = html_lib.escape(social['alt'], quote=True)
    html = _JSON_LD.sub('', _GENERATED_SOCIAL.sub('', html))
    html = _replace_once(html, r'<meta property="og:site_name" content="Toolkit" />',
                         '<meta property="og:site_name" content="Toolkit" />\n'
                         f'  <meta property="og:locale" content="{social["locale"]}" />\n'
                         f'  <meta property="og:locale:alternate" content="{social["alternate"]}" />\n'
                         f'  <meta property="og:image" content="{image}" />\n'
                         '  <meta property="og:image:width" content="1200" />\n'
                         '  <meta property="og:image:height" content="630" />\n'
                         f'  <meta property="og:image:alt" content="{alt}" />', relative)
    html = re.sub(r'<meta name="twitter:card" content="[^"]*" />',
                  '<meta name="twitter:card" content="summary_large_image" />', html, count=1)
    html = re.sub(r'(<meta name="twitter:description" content="[^"]*" />)',
                  lambda match: f'{match.group(1)}\n  <meta name="twitter:image" content="{image}" />\n'
                                f'  <meta name="twitter:image:alt" content="{alt}" />', html, count=1)
    block = _structured_data(relative, language, title, description)
    return _replace_once(html, r'\n</head>',
                         f'\n  <script type="application/ld+json">{block}</script>\n</head>', relative)


def run_page_metadata():
    """Add preview images and structured data to every English page with a Turkish twin."""
    print('\n[--metadata] Adding social previews and structured data...')
    for relative in _localized_pages():
        path = os.path.join(ROOT, *relative.split('/'))
        html = _read(path)
        title = html_lib.unescape(re.search(r'<title>(.*?)</title>', html).group(1))
        description = html_lib.unescape(re.search(r'<meta name="description" content="([^"]*)"', html).group(1))
        revised = _with_page_metadata(html, relative, 'en', title, description)
        if revised != html:
            _write(path, revised)
    print(f'  OK    {len(_localized_pages())} pages.')


# ---------------------------------------------------------------------------
# Turkish pages — /tr/ copies with Turkish metadata for search engines
# ---------------------------------------------------------------------------
#
# Every English page gets a generated twin under tr/. The twin keeps the
# English body (the i18n runtime translates it in the browser, forced to
# Turkish by data-page-language) but ships Turkish <title>, description,
# Open Graph and canonical tags, plus reciprocal hreflang links. Asset
# references gain one '../' so they still point at the shared files, while
# links between pages stay inside the Turkish tree.

_ALTERNATE_LINKS = re.compile(r'\n[ \t]*<link rel="alternate" hreflang="[^"]*" href="[^"]*" />')
_HTML_REFERENCE = re.compile(r'(\b(?:href|src)=)(["\'])([^"\']*)\2')


def _localized_pages():
    """Return the repository paths that get a Turkish twin under tr/."""
    return (['index.html', 'license/index.html']
            + [f'tools/{os.path.basename(path)}' for path in _tool_files()])


def _page_location(relative):
    """Map a repository path to its public URL path ('license/index.html' → 'license/')."""
    return relative[:-len('index.html')] if relative.endswith('index.html') else relative


def _alternate_links(relative):
    english = html_lib.escape(SITE_BASE + _page_location(relative))
    turkish = html_lib.escape(SITE_BASE + TR_PREFIX + _page_location(relative))
    return (f'<link rel="alternate" hreflang="en" href="{english}" />\n'
            f'  <link rel="alternate" hreflang="tr" href="{turkish}" />\n'
            f'  <link rel="alternate" hreflang="x-default" href="{english}" />')


def _with_alternates(html, relative):
    """Place the hreflang block right after the canonical link."""
    html = _ALTERNATE_LINKS.sub('', html)
    html, count = re.subn(r'(<link rel="canonical" href="[^"]*" />)',
                          lambda match: f'{match.group(1)}\n  {_alternate_links(relative)}',
                          html, count=1)
    if count != 1:
        raise SystemExit(f'{relative} needs exactly one canonical link for its hreflang alternates.')
    return html


def _turkish_reference(reference, relative, localized):
    """Keep page links inside tr/ and point everything else one level up."""
    if not reference or re.match(r'^(?:[a-z][a-z0-9+.-]*:|//|/|#)', reference, re.IGNORECASE):
        return reference
    path = re.sub(r'[?#].*$', '', reference)
    if not path:
        return reference
    resolved = os.path.normpath(os.path.join(os.path.dirname(relative), path)).replace(os.sep, '/')
    if path.endswith('/') or os.path.isdir(os.path.join(ROOT, resolved)):
        resolved = f'{resolved}/index.html'
    return reference if resolved in localized else f'../{reference}'


def _replace_once(html, pattern, replacement, relative, required=True):
    revised, count = re.subn(pattern, lambda _: replacement, html, count=1)
    if count == 0 and required:
        raise SystemExit(f'{relative} is missing {pattern!r}, which its Turkish copy needs.')
    return revised


def _seo_entry(entries, relative, english_html, count):
    """Return the Turkish copy for one page and fail if its English source moved."""
    entry = entries.get(relative)
    if not entry:
        raise SystemExit(f'{relative} has no Turkish title and description; add them to _data/seo-tr.json.')

    def english(pattern):
        match = re.search(pattern, english_html)
        return html_lib.unescape(match.group(1)) if match else None

    current = {
        'title': english(r'<title>(.*?)</title>'),
        'description': english(r'<meta name="description" content="([^"]*)"'),
    }
    og_description = english(r'<meta property="og:description" content="([^"]*)"')
    if og_description is not None and og_description != current['description']:
        current['ogDescription'] = og_description
    source = {key: value.replace('{{count}}', str(count)) for key, value in entry['source'].items()}
    if source != current:
        raise SystemExit(f'The English metadata of {relative} changed; update its Turkish copy and '
                         f'"source" in _data/seo-tr.json.\n  recorded: {source}\n  current:  {current}')
    title = entry['title'].replace('{{count}}', str(count))
    description = entry['description'].replace('{{count}}', str(count))
    og = entry.get('ogDescription', entry['description']).replace('{{count}}', str(count))
    return title, description, og


def _turkish_page(relative, english_html, entry, localized):
    title, description, og_description = entry
    url = html_lib.escape(SITE_BASE + TR_PREFIX + _page_location(relative))
    attr = lambda value: html_lib.escape(value, quote=True)
    page = english_html
    page = _replace_once(page, r'<html lang="en">', '<html lang="tr" data-page-language="tr">', relative)
    page = _replace_once(page, r'<title>.*?</title>', f'<title>{html_lib.escape(title, quote=False)}</title>', relative)
    page = _replace_once(page, r'<meta name="description" content="[^"]*" />',
                         f'<meta name="description" content="{attr(description)}" />', relative)
    page = _replace_once(page, r'<link rel="canonical" href="[^"]*" />',
                         f'<link rel="canonical" href="{url}" />', relative)
    for pattern, value in (
        (r'<meta property="og:title" content="[^"]*" />', f'<meta property="og:title" content="{attr(title)}" />'),
        (r'<meta property="og:description" content="[^"]*" />', f'<meta property="og:description" content="{attr(og_description)}" />'),
        (r'<meta property="og:url" content="[^"]*" />', f'<meta property="og:url" content="{url}" />'),
        (r'<meta name="twitter:title" content="[^"]*" />', f'<meta name="twitter:title" content="{attr(title)}" />'),
        (r'<meta name="twitter:description" content="[^"]*" />', f'<meta name="twitter:description" content="{attr(og_description)}" />'),
    ):
        page = _replace_once(page, pattern, value, relative, required=False)
    page = _with_page_metadata(page, relative, 'tr', title, description)
    page = _HTML_REFERENCE.sub(
        lambda match: f'{match.group(1)}{match.group(2)}'
                      f'{_turkish_reference(match.group(3), relative, localized)}{match.group(2)}',
        page)
    page = _replace_once(page, r'<!DOCTYPE html>\n',
                         f'<!DOCTYPE html>\n<!-- Generated by build.py from {relative}; edit that page '
                         'and _data/seo-tr.json instead. -->\n', relative)
    return page


def run_turkish_pages():
    """Generate tr/ twins of every indexable page and link both with hreflang."""
    print('\n[--turkish] Generating Turkish pages...')
    entries = json.loads(_read(SEO_TR_JSON))
    localized = _localized_pages()
    localized_set = set(localized)
    unknown = sorted(set(entries) - localized_set)
    if unknown:
        raise SystemExit(f'_data/seo-tr.json lists pages that do not exist: {", ".join(unknown)}')
    count = _registered_tool_count()
    for relative in localized:
        english_path = os.path.join(ROOT, *relative.split('/'))
        english_html = _with_alternates(_read(english_path), relative)
        if english_html != _read(english_path):
            _write(english_path, english_html)
        entry = _seo_entry(entries, relative, english_html, count)
        turkish_path = os.path.join(TR_DIR, *relative.split('/'))
        turkish_html = _turkish_page(relative, english_html, entry, localized_set)
        if not os.path.exists(turkish_path) or _read(turkish_path) != turkish_html:
            if _PENDING is None:
                os.makedirs(os.path.dirname(turkish_path), exist_ok=True)
            _write(turkish_path, turkish_html)

    removed = 0
    for current, _, names in os.walk(TR_DIR):
        for name in names:
            path = os.path.join(current, name)
            if os.path.relpath(path, TR_DIR).replace(os.sep, '/') not in localized_set:
                _remove(path)
                removed += 1
    print(f'  OK    {len(localized)} Turkish pages, {removed} stale removed.')


# ---------------------------------------------------------------------------
# Published files and the content-hashed cache version
# ---------------------------------------------------------------------------

def _published_pages():
    """Yield root pages and every tool page that users can open directly."""
    for name in ('index.html', '404.html'):
        yield os.path.join(ROOT, name)
    yield os.path.join(ROOT, 'license', 'index.html')
    yield from _tool_files()


def _published_files():
    """Return the sorted repository-relative paths that GitHub Pages serves."""
    paths = [name for name in PUBLISHED_FILES if os.path.isfile(os.path.join(ROOT, name))]
    for directory in PUBLISHED_DIRS:
        for current, dirs, names in os.walk(os.path.join(ROOT, directory)):
            dirs[:] = [d for d in dirs if d != '__pycache__']
            for name in names:
                if name.endswith(UNPUBLISHED_SUFFIXES):
                    continue
                paths.append(os.path.relpath(os.path.join(current, name), ROOT).replace(os.sep, '/'))
    return sorted(paths)


_CACHE_VERSION_PATTERN = r"const CACHE_VERSION = '[^']*';"


def run_cache_version():
    """Derive CACHE_VERSION from the bytes of every published file.

    Static assets are served cache-first, so any change to a published file
    must produce a new cache name or returning visitors keep stale assets.
    The version line itself is excluded from the digest so the result is
    stable when the task runs again.
    """
    sw_path = os.path.join(ROOT, 'sw.js')
    service_worker = _read(sw_path)
    if len(re.findall(_CACHE_VERSION_PATTERN, service_worker)) != 1:
        raise RuntimeError('sw.js must declare exactly one CACHE_VERSION.')
    digest = hashlib.sha256()
    for relative in _published_files():
        path = os.path.join(ROOT, *relative.split('/'))
        if relative == 'sw.js':
            data = re.sub(_CACHE_VERSION_PATTERN, "const CACHE_VERSION = '';", service_worker).encode('utf-8')
        else:
            data = _read_bytes(path)
        digest.update(relative.encode('utf-8') + b'\0' + data + b'\0')
    version = digest.hexdigest()[:12]
    revised = re.sub(_CACHE_VERSION_PATTERN, f"const CACHE_VERSION = '{version}';", service_worker)
    if revised != service_worker:
        _write(sw_path, revised)
    print(f'\n[cache] CACHE_VERSION = {version}')


# ---------------------------------------------------------------------------
# Drift check and site assembly
# ---------------------------------------------------------------------------

def run_check():
    """Run every task in memory and report files that would change."""
    global _PENDING
    _PENDING = {}
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            run_all()
        stale = []
        for path, content in sorted(_PENDING.items()):
            if content is None or not os.path.exists(path):
                if content is not None or os.path.exists(path):
                    stale.append(path)
                continue
            with open(path, 'r', encoding='utf-8') as fh:
                if fh.read() != content:
                    stale.append(path)
    finally:
        _PENDING = None
    if stale:
        print('Generated files are out of date. Run `python3 build.py --all` and commit the result:')
        for path in stale:
            print(f'  {os.path.relpath(path, ROOT)}')
        sys.exit(1)
    print('Generated files are up to date.')


_LOCAL_REFERENCE = re.compile(r'\b(?:href|src)=["\']([^"\']+)["\']')
_PRECACHE_ENTRY = re.compile(r"^\s*'([^']+)',\s*$", re.MULTILINE)


def run_site():
    """Copy the published allowlist into _site/ and verify it is complete."""
    print('\n[--site] Assembling _site/...')
    if os.path.isdir(SITE_DIR):
        shutil.rmtree(SITE_DIR)
    files = _published_files()
    for relative in files:
        target = os.path.join(SITE_DIR, *relative.split('/'))
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copy2(os.path.join(ROOT, *relative.split('/')), target)

    missing = []
    published = set(files)
    service_worker = _read(os.path.join(ROOT, 'sw.js'))
    for entry in _PRECACHE_ENTRY.findall(service_worker):
        path = entry.split('?', 1)[0]
        if path.endswith('/'):
            path += 'index.html'
        if path not in published:
            missing.append(f'sw.js precaches {entry}')
    for relative in files:
        if not relative.endswith('.html'):
            continue
        html = re.sub(r'<base\b[^>]*>', '', _read(os.path.join(ROOT, *relative.split('/'))))
        for reference in _LOCAL_REFERENCE.findall(html):
            if not reference or re.match(r'^(?:[a-z]+:|//|#)', reference, re.IGNORECASE):
                continue
            path = re.sub(r'[?#].*$', '', reference)
            if not path:
                continue
            resolved = os.path.normpath(os.path.join(os.path.dirname(relative), path)).replace(os.sep, '/')
            if os.path.isdir(os.path.join(ROOT, resolved)):
                resolved += '/index.html'
            if resolved not in published:
                missing.append(f'{relative} references {reference}')
    if missing:
        print('  ERROR  _site/ is missing referenced files:')
        for item in missing:
            print(f'    {item}')
        sys.exit(1)
    print(f'  OK    {len(files)} files published.')


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def run_all():
    """Regenerate every maintained file; the cache version always comes last."""
    run_registry()
    run_sync_expansion()
    run_nav()
    run_tool_count()
    run_page_metadata()
    run_turkish_pages()
    run_words_manifest()
    run_offline_manifest()
    run_sitemap()
    run_cache_version()


def main():
    parser = argparse.ArgumentParser(
        description='Toolkit build helper',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('--all', action='store_true',
                        help='Regenerate every maintained file')
    parser.add_argument('--check', action='store_true',
                        help='Fail if any maintained file is out of date')
    parser.add_argument('--site', action='store_true',
                        help='Assemble the publishable site in _site/')
    parser.add_argument('--registry', action='store_true',
                        help='Generate the browser tool registries from _data/tools.json')
    parser.add_argument('--nav', action='store_true',
                        help='Inject nav HTML from _includes/_nav.html into published pages')
    parser.add_argument('--tool-count', action='store_true',
                        help='Synchronize published static tool-count copy')
    parser.add_argument('--sync-expansion', action='store_true',
                        help='Create or refresh generated expansion-tool shells')
    parser.add_argument('--metadata', action='store_true',
                        help='Add social preview images and JSON-LD to the English pages')
    parser.add_argument('--turkish', action='store_true',
                        help='Generate the tr/ pages from _data/seo-tr.json')
    parser.add_argument('--words', action='store_true',
                        help='Generate the word-list precache manifest')
    parser.add_argument('--offline', action='store_true',
                        help='Generate the tool precache manifest')
    parser.add_argument('--sitemap', action='store_true',
                        help='Generate sitemap.xml with content-based lastmod dates')

    args = parser.parse_args()

    if not any(vars(args).values()):
        parser.print_help()
        sys.exit(0)

    if args.check:
        run_check()
        return

    if args.all:
        run_all()
    else:
        tasks = (
            (args.registry, run_registry),
            (args.sync_expansion, run_sync_expansion),
            (args.nav, run_nav),
            (args.tool_count, run_tool_count),
            (args.metadata, run_page_metadata),
            (args.turkish, run_turkish_pages),
            (args.words, run_words_manifest),
            (args.offline, run_offline_manifest),
            (args.sitemap, run_sitemap),
        )
        ran = False
        for selected, task in tasks:
            if selected:
                task()
                ran = True
        if ran:
            run_cache_version()

    if args.site:
        run_site()

    print('\nBuild complete.')


if __name__ == '__main__':
    main()
