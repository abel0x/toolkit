"""
build.py — Toolkit build helper
=====================================
Usage:
  python build.py --meta      Add canonical + OG/Twitter meta tags to tools/*.html
  python build.py --nav       Inject nav HTML from _includes/_nav.html into tools/*.html
  python build.py --scripts   Migrate old script.js references to modular script tags
  python build.py --enhance   Add global tool-finder scripts to published pages
  python build.py --styles    Replace the retired monolithic stylesheet with page modules
  python build.py --offline   Generate the complete offline precache manifest
  python build.py --words     Generate the word-list precache manifest
  python build.py --tool-count Synchronize published static tool-count copy
  python build.py --all       Run every task
"""

import argparse
import html as html_lib
import os
import re
import sys

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT        = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR   = os.path.join(ROOT, 'tools')
WORDS_DIR   = os.path.join(ROOT, 'words')
NAV_FILE    = os.path.join(ROOT, '_includes', '_nav.html')
SITE_BASE   = 'https://abel0x.github.io/toolkit/'

COMMON_STYLE_MODULES = (
    'assets/css/core.css',
    'assets/css/components.css',
    'assets/css/compatibility.css',
)

# Old-style tools that need script-tag migration
SCRIPT_MIGRATION_FILES = [
    'password.html', 'hash.html', 'base64.html', 'uuid.html',
    'json-formatter.html', 'url-codec.html', 'jwt-decoder.html',
    'regex-tester.html', 'timestamp.html', 'case-converter.html',
    'markdown.html', 'qr-generator.html', 'qr-reader.html',
    'color-converter.html', 'gradient.html', 'lorem-ipsum.html',
    'text-diff.html',
]


# Browser-only additions used to take Toolkit from 78 to 100 utilities.
# Keep this list in sync with assets/js/core/extra-tools-data.js.
EXPANSION_PAGES = [
    ('aes-gcm', 'AES-GCM Encryptor', 'Encrypt or decrypt text locally with AES-GCM and a passphrase.', 'Security'),
    ('rsa-keypair', 'RSA Key Pair Generator', 'Generate browser-only RSA-OAEP key pairs and export PEM or JWK.', 'Security'),
    ('pem-jwk', 'PEM / JWK Converter', 'Convert supported RSA public and private keys between PEM and JWK.', 'Security'),
    ('certificate-inspector', 'Certificate Inspector', 'Inspect an X.509 PEM certificate locally as a readable ASN.1 tree.', 'Security'),
    ('totp', 'TOTP Generator', 'Generate time-based one-time passwords from a Base32 secret, entirely offline.', 'Security'),
    ('csp-generator', 'CSP Generator', 'Build a Content-Security-Policy header from directive values.', 'Web Utils'),
    ('curl-builder', 'cURL Builder', 'Create a shell-safe cURL command from a method, URL, headers and body.', 'Web Utils'),
    ('http-header-analyzer', 'HTTP Header Analyzer', 'Parse pasted HTTP headers and flag common browser security headers.', 'Web Utils'),
    ('cron-assistant', 'Cron Expression Assistant', 'Explain a five-field cron expression and calculate upcoming runs locally.', 'Dev Tools'),
    ('unix-permissions', 'Unix Permissions Calculator', 'Translate Unix rwx permissions between checkboxes, symbolic mode and octal.', 'Dev Tools'),
    ('css-specificity', 'CSS Specificity Calculator', 'Calculate CSS selector specificity with an inspectable A-B-C score.', 'Dev Tools'),
    ('css-clamp', 'CSS Clamp Calculator', 'Generate a responsive CSS clamp() expression from size and viewport ranges.', 'Dev Tools'),
    ('json-to-typescript', 'JSON to TypeScript', 'Infer TypeScript interfaces from JSON without uploading data.', 'Dev Tools'),
    ('json-to-markdown', 'JSON to Markdown Table', 'Convert a JSON array of objects into a Markdown table.', 'Dev Tools'),
    ('xml-to-json', 'XML to JSON Converter', 'Convert XML documents to a clear JSON representation in the browser.', 'Dev Tools'),
    ('csv-viewer', 'CSV Viewer', 'Preview CSV data as a searchable local table.', 'Dev Tools'),
    ('unicode-inspector', 'Unicode Inspector', 'Inspect Unicode code points and normalize text with standard Unicode forms.', 'Text Tools'),
    ('time-zone-converter', 'Time Zone Converter', 'View one date and time across IANA time zones using browser locale data.', 'Converters'),
    ('date-duration', 'Date Duration Calculator', 'Calculate the exact day and week distance between two calendar dates.', 'Converters'),
    ('image-compressor', 'Image Compressor', 'Resize and recompress images locally with Canvas; nothing is uploaded.', 'Media'),
    ('sitemap-generator', 'Sitemap Generator', 'Generate a standards-friendly sitemap.xml from a list of URLs.', 'Web Utils'),
    ('color-contrast', 'Color Contrast Checker', 'Check WCAG contrast ratios for foreground and background colors.', 'Dev Tools'),
]

EXAMPLE_STARTER_EXPANSION_TOOLS = {
    'csp-generator', 'curl-builder', 'http-header-analyzer',
    'cron-assistant', 'unix-permissions', 'css-specificity',
    'json-to-typescript', 'json-to-markdown', 'xml-to-json', 'csv-viewer',
}


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


def _read(path):
    with open(path, 'r', encoding='utf-8') as fh:
        return fh.read()


def _registered_tool_count():
    """Return the number of tool entries across both browser registries."""
    registry = _read(os.path.join(ROOT, 'assets', 'js', 'core', 'tools-data.js'))
    expansion = _read(os.path.join(ROOT, 'assets', 'js', 'core', 'extra-tools-data.js'))
    return len(re.findall(r"slug:\s*'", registry + expansion))


def _write(path, content):
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(content)


# ---------------------------------------------------------------------------
# Expansion pages — static shell, local shared implementation
# ---------------------------------------------------------------------------

def _expansion_page(slug, title, description, category):
    safe_title = html_lib.escape(title)
    safe_desc = html_lib.escape(description)
    url = f'{SITE_BASE}tools/{slug}.html'
    tool_count = _registered_tool_count()
    example_starter = ''
    example_script = ''
    if slug in EXAMPLE_STARTER_EXPANSION_TOOLS:
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


def run_new_tools(sync_existing=False):
    """Create expansion tools, optionally refreshing their generated shells."""
    print('\n[--new-tools] Creating browser-only expansion tools...')
    created = updated = skipped = 0
    for slug, title, description, category in EXPANSION_PAGES:
        path = os.path.join(TOOLS_DIR, f'{slug}.html')
        shell = _expansion_page(slug, title, description, category)
        if os.path.exists(path):
            if sync_existing:
                _write(path, shell)
                print(f'  SYNC  {slug}.html')
                updated += 1
                continue
            print(f'  SKIP  {slug}.html  (already exists)')
            skipped += 1
            continue
        _write(path, shell)
        print(f'  OK    {slug}.html')
        created += 1

    sitemap_path = os.path.join(ROOT, 'sitemap.xml')
    sitemap = _read(sitemap_path)
    additions = []
    for slug, _, _, _ in EXPANSION_PAGES:
        location = f'{SITE_BASE}tools/{slug}.html'
        if location not in sitemap:
            additions.append(f'  <url>\n    <loc>{location}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>')
    if additions:
        sitemap = sitemap.replace('</urlset>', '\n' + '\n'.join(additions) + '\n</urlset>')
        _write(sitemap_path, sitemap)

    if created or updated:
        # Generated pages carry empty NAV markers; materialize the shared
        # header here so a synchronized shell is immediately publishable.
        run_nav()

    print(f'\n[--new-tools] Done. {created} created, {updated} synchronized, {skipped} skipped.')


def replace_marker(content, marker, entries):
    """Replace one generated marker block with sorted source entries."""
    pattern = rf'({re.escape(marker + ":START")}\n).*?(\s*{re.escape(marker + ":END")})'
    replacement = r'\1' + '\n'.join(entries) + r'\2'
    updated, count = re.subn(pattern, replacement, content, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError(f'Could not update generated marker: {marker}')
    return updated


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
        revised = re.sub(r'(Toolkit — )\d+( Free Developer Utilities)', rf'\g<1>{count}\2', revised)
        revised = re.sub(r'\b\d+ free developer utilities', f'{count} free developer utilities', revised)
        revised = re.sub(r'(All <span class="gradient-text">)\d+( Tools</span>)', rf'\g<1>{count}\2', revised)
        revised = re.sub(r'(<span class="stat-num" id="toolCountStat">)\d+(</span>)', rf'\g<1>{count}\2', revised)
        if revised != content:
            _write(path, revised)
            updated += 1
    print(f'  OK    {updated} published pages synchronized to {count} tools.')


# ---------------------------------------------------------------------------
# Task A — Canonical + OG meta tags
# ---------------------------------------------------------------------------

def _extract_title(html):
    """Return the text content of the first <title> element, or ''."""
    m = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
    return m.group(1).strip() if m else ''


def _extract_description(html):
    """Return the content= attribute value of <meta name="description">, or ''."""
    m = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']',
        html, re.IGNORECASE | re.DOTALL
    )
    if m:
        return m.group(1).strip()
    # Also handle content= before name=
    m2 = re.search(
        r'<meta\s+content=["\'](.*?)["\']\s+name=["\']description["\']',
        html, re.IGNORECASE | re.DOTALL
    )
    return m2.group(1).strip() if m2 else ''


def _build_meta_block(filename, title, description):
    url = f'{SITE_BASE}tools/{filename}'
    lines = [
        f'  <link rel="canonical" href="{url}" />',
        f'  <meta property="og:title" content="{title}" />',
        f'  <meta property="og:description" content="{description}" />',
        f'  <meta property="og:url" content="{url}" />',
        f'  <meta property="og:type" content="website" />',
        f'  <meta property="og:site_name" content="Toolkit" />',
        f'  <meta name="twitter:card" content="summary" />',
        f'  <meta name="twitter:title" content="{title}" />',
        f'  <meta name="twitter:description" content="{description}" />',
    ]
    return '\n'.join(lines)


def run_meta():
    """Add canonical + OG/Twitter tags to all tools/*.html files."""
    print('\n[--meta] Adding canonical + OG/Twitter meta tags...')
    added = skipped = 0

    for path in _tool_files():
        filename = os.path.basename(path)
        html = _read(path)

        # Skip if already has og:title
        if 'og:title' in html:
            print(f'  SKIP  {filename}  (og:title already present)')
            skipped += 1
            continue

        title       = _extract_title(html)
        description = _extract_description(html)

        if not title and not description:
            print(f'  WARN  {filename}  (no title/description found, skipping)')
            skipped += 1
            continue

        meta_block = _build_meta_block(filename, title, description)

        # Find the <meta name="description" ...> line and insert after it
        # We match the full self-closing or non-self-closing tag line
        pattern = r'([ \t]*<meta\s+name=["\']description["\'][^>]*/?>)'
        replacement = r'\1' + '\n' + meta_block

        new_html, n = re.subn(pattern, replacement, html, count=1, flags=re.IGNORECASE)

        if n == 0:
            # Fallback: insert after </title>
            pattern2 = r'([ \t]*</title>)'
            replacement2 = r'\1' + '\n' + meta_block
            new_html, n2 = re.subn(pattern2, replacement2, html, count=1, flags=re.IGNORECASE)
            if n2 == 0:
                print(f'  WARN  {filename}  (could not find insertion point, skipping)')
                skipped += 1
                continue

        _write(path, new_html)
        print(f'  OK    {filename}')
        added += 1

    print(f'\n[--meta] Done. {added} updated, {skipped} skipped.')


# ---------------------------------------------------------------------------
# Task B — Nav injection
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
# Task B.1 — Modular stylesheets
# ---------------------------------------------------------------------------

def _style_tags(path):
    """Return the smallest stylesheet set needed by a published page."""
    prefix = _page_prefix(path)
    modules = list(COMMON_STYLE_MODULES)
    if os.path.abspath(path) == os.path.join(ROOT, 'index.html'):
        modules.append('assets/css/pages/home.css')
    elif path.startswith(TOOLS_DIR + os.sep):
        modules.append('assets/css/pages/tool.css')
        slug = os.path.splitext(os.path.basename(path))[0]
        if slug in {entry[0] for entry in EXPANSION_PAGES}:
            modules.append('assets/css/features/expansion-tools.css')
    else:
        modules.append('assets/css/pages/tool.css')
    return '\n'.join(f'  <link rel="stylesheet" href="{prefix}{module}" />' for module in modules)


def run_styles():
    """Move pages from style.css to clear, page-scoped stylesheet modules."""
    print('\n[--styles] Linking modular stylesheets...')
    updated = skipped = 0
    style_pattern = (
        r'\s*<link rel="stylesheet" href="(?:\.\./)?(?:'
        r'style\.css|assets/css/(?:core|components|compatibility)\.css|'
        r'assets/css/pages/(?:home|tool)\.css|'
        r'assets/css/features/expansion-tools\.css)"\s*/>'
    )

    for path in _published_pages():
        html = _read(path)
        without_styles = re.sub(style_pattern, '', html)
        style_tags = _style_tags(path)
        anchor = '  <link rel="manifest"'
        if anchor not in without_styles:
            # Some legacy tool pages keep their favicon directly beside the
            # title, so locate the tag rather than relying on indentation.
            new_html, inserted = re.subn(
                r'\s*(?=<link rel="icon")', f'\n{style_tags}\n  ', without_styles, count=1
            )
            if inserted != 1:
                raise RuntimeError(f'Could not find a stylesheet insertion point in {path}')
        else:
            new_html = without_styles.replace(anchor, f'{style_tags}\n{anchor}', 1)
        if new_html != html:
            _write(path, new_html)
            print(f'  OK    {os.path.relpath(path, ROOT)}')
            updated += 1
        else:
            print(f'  SKIP  {os.path.relpath(path, ROOT)}  (already modular)')
            skipped += 1

    legacy_path = os.path.join(ROOT, 'style.css')
    _write(legacy_path, '''/*
 * Retired compatibility entry point.
 * Published pages load the focused modules in assets/css/ directly.
 * Keep this file only so stale external links fail gracefully during rollout.
 */
''')
    print(f'\n[--styles] Done. {updated} linked, {skipped} already modular.')


# ---------------------------------------------------------------------------
# Task C — Script tag migration
# ---------------------------------------------------------------------------

_OLD_SCRIPT = '  <script src="../script.js" defer></script>'


def _new_scripts(toolname):
    return (
        f'  <script src="../assets/js/core/utils.js" defer></script>\n'
        f'  <script src="../assets/js/core/nav.js" defer></script>\n'
        f'  <script src="../assets/js/tools/{toolname}.js" defer></script>'
    )


def run_scripts():
    """Migrate old ../script.js references to modular script tags."""
    print('\n[--scripts] Migrating script tags...')
    updated = skipped = 0

    for filename in SCRIPT_MIGRATION_FILES:
        path = os.path.join(TOOLS_DIR, filename)

        if not os.path.isfile(path):
            print(f'  MISS  {filename}  (file not found)')
            skipped += 1
            continue

        html = _read(path)

        # Skip if already migrated
        if '../assets/js/core/utils.js' in html:
            print(f'  SKIP  {filename}  (already has utils.js)')
            skipped += 1
            continue

        if _OLD_SCRIPT not in html:
            print(f'  WARN  {filename}  (old script tag not found)')
            skipped += 1
            continue

        toolname = os.path.splitext(filename)[0]   # e.g. "password"
        new_html = html.replace(_OLD_SCRIPT, _new_scripts(toolname), 1)

        _write(path, new_html)
        print(f'  OK    {filename}')
        updated += 1

    print(f'\n[--scripts] Done. {updated} updated, {skipped} skipped.')


# ---------------------------------------------------------------------------
# Task D — Shared interface enhancements
# ---------------------------------------------------------------------------

def _published_pages():
    """Yield root pages and every tool page that users can open directly."""
    for name in ('index.html', '404.html'):
        yield os.path.join(ROOT, name)
    yield os.path.join(ROOT, 'license', 'index.html')
    yield from _tool_files()


def run_enhancements():
    """Add shared i18n, tool data and command-palette scripts to every page."""
    print('\n[--enhance] Adding shared interface scripts...')
    updated = skipped = 0

    for path in _published_pages():
        filename = os.path.relpath(path, ROOT)
        html = _read(path)
        prefix = _page_prefix(path)
        i18n_extra_tag = f'  <script src="{prefix}assets/js/core/i18n-expansion.js" defer></script>'
        i18n_tag = f'  <script src="{prefix}assets/js/core/i18n.js" defer></script>'
        data_tag = f'  <script src="{prefix}assets/js/core/tools-data.js" defer></script>'
        extra_data_tag = f'  <script src="{prefix}assets/js/core/extra-tools-data.js" defer></script>'
        palette_tag = f'  <script src="{prefix}assets/js/core/command-palette.js" defer></script>'
        i18n_extra_src = f'{prefix}assets/js/core/i18n-expansion.js'
        i18n_src = f'{prefix}assets/js/core/i18n.js'
        data_src = f'{prefix}assets/js/core/tools-data.js'
        extra_data_src = f'{prefix}assets/js/core/extra-tools-data.js'
        palette_src = f'{prefix}assets/js/core/command-palette.js'

        missing_i18n_extra = i18n_extra_src not in html
        missing_i18n = i18n_src not in html
        missing_data = data_src not in html
        missing_extra_data = extra_data_src not in html
        missing_palette = palette_src not in html
        if not (missing_i18n_extra or missing_i18n or missing_data or missing_extra_data or missing_palette):
            print(f'  SKIP  {filename}  (already has shared scripts)')
            skipped += 1
            continue

        nav_src = f'{prefix}assets/js/core/nav.js'
        nav_pattern = rf'(<script\b[^>]*\bsrc=["\']{re.escape(nav_src)}["\'][^>]*></script>)'
        data_pattern = rf'(<script\b[^>]*\bsrc=["\']{re.escape(data_src)}["\'][^>]*></script>)'
        extra_data_pattern = rf'(<script\b[^>]*\bsrc=["\']{re.escape(extra_data_src)}["\'][^>]*></script>)'
        new_html = html
        changes = 0

        # Keep the execution order deterministic: nav → locale copy → i18n → tool data →
        # expansion data → command palette → page script.
        first_tags = []
        if missing_i18n_extra:
            first_tags.append(i18n_extra_tag)
        if missing_i18n:
            first_tags.append(i18n_tag)
        if missing_data:
            first_tags.append(data_tag)
        if first_tags:
            new_html, count = re.subn(nav_pattern, r'\1\n' + '\n'.join(first_tags), new_html, count=1)
            changes += count

        if missing_extra_data:
            new_html, count = re.subn(data_pattern, r'\1\n' + extra_data_tag, new_html, count=1)
            changes += count

        if missing_palette:
            anchor_pattern = extra_data_pattern if extra_data_src in new_html else data_pattern
            new_html, count = re.subn(anchor_pattern, r'\1\n' + palette_tag, new_html, count=1)
            changes += count

        if changes == 0:
            print(f'  WARN  {filename}  (nav/data script not found, skipping)')
            skipped += 1
            continue

        _write(path, new_html)
        print(f'  OK    {filename}')
        updated += 1

    print(f'\n[--enhance] Done. {updated} updated, {skipped} skipped.')


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description='Toolkit build helper',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('--meta',    action='store_true',
                        help='Add canonical + OG/Twitter meta tags to tools/*.html')
    parser.add_argument('--nav',     action='store_true',
                        help='Inject nav HTML from _includes/_nav.html into tools/*.html')
    parser.add_argument('--scripts', action='store_true',
                        help='Migrate old script.js tags to modular script tags')
    parser.add_argument('--enhance', action='store_true',
                        help='Add shared i18n and tool-finder scripts to published pages')
    parser.add_argument('--styles',  action='store_true',
                        help='Replace style.css links with page-scoped stylesheet modules')
    parser.add_argument('--new-tools', action='store_true',
                        help='Create the 22 browser-only expansion tool pages and sitemap entries')
    parser.add_argument('--sync-expansion', action='store_true',
                        help='Refresh generated expansion-tool shells from the current template')
    parser.add_argument('--offline', action='store_true',
                        help='Generate the complete offline precache manifest')
    parser.add_argument('--words', action='store_true',
                        help='Generate the word-list precache manifest')
    parser.add_argument('--tool-count', action='store_true',
                        help='Synchronize published static tool-count copy')
    parser.add_argument('--all',     action='store_true',
                        help='Run every task')

    args = parser.parse_args()

    if not any(vars(args).values()):
        parser.print_help()
        sys.exit(0)

    if args.all or args.new_tools or args.sync_expansion:
        run_new_tools(sync_existing=args.all or args.sync_expansion)

    if args.all or args.offline:
        run_offline_manifest()

    if args.all or args.words:
        run_words_manifest()

    if args.all or args.tool_count:
        run_tool_count()

    if args.all or args.meta:
        run_meta()

    if args.all or args.nav:
        run_nav()

    if args.all or args.styles:
        run_styles()

    if args.all or args.scripts:
        run_scripts()

    if args.all or args.enhance:
        run_enhancements()

    print('\nBuild complete.')


if __name__ == '__main__':
    main()
