"""
build.py — Toolkit build helper
=====================================
Every task is idempotent: running it twice leaves the tree unchanged.

Usage:
  python3 build.py --all             Regenerate every maintained file (run before committing)
  python3 build.py --check           Fail if any maintained file is out of date (used by CI)
  python3 build.py --site            Assemble the publishable site in _site/

  python3 build.py --nav             Inject nav HTML from _includes/_nav.html into published pages
  python3 build.py --tool-count      Synchronize published static tool-count copy
  python3 build.py --sync-expansion  Create or refresh generated expansion-tool shells
  python3 build.py --words           Generate the word-list precache manifest
  python3 build.py --offline         Generate the tool precache manifest

Any task also refreshes the service-worker CACHE_VERSION, a content hash of
every published file, so returning visitors never mix new HTML with stale
cached CSS or JavaScript.
"""

import argparse
import contextlib
import hashlib
import html as html_lib
import io
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

# Shared by every published page; tests/site-audit.mjs enforces it.
CONTENT_SECURITY_POLICY = (
    "default-src 'self'; script-src 'self'; style-src 'self'; "
    "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; "
    "worker-src 'self'; manifest-src 'self'; object-src 'none'; "
    "base-uri 'self'; form-action 'none'"
)

# Everything GitHub Pages serves. Repository-only files (tests, build tooling,
# documentation, editor and assistant settings) are deliberately excluded.
PUBLISHED_FILES = (
    '.nojekyll', '404.html', 'LICENSE', 'index.html', 'manifest.json',
    'robots.txt', 'sitemap.xml', 'style.css', 'sw.js',
)
PUBLISHED_DIRS = ('assets', 'license', 'tools', 'words')
UNPUBLISHED_SUFFIXES = ('.md',)


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
    """Return the number of tool entries across both browser registries."""
    registry = _read(os.path.join(ROOT, 'assets', 'js', 'core', 'tools-data.js'))
    expansion = _read(os.path.join(ROOT, 'assets', 'js', 'core', 'extra-tools-data.js'))
    return len(re.findall(r"slug:\s*'", registry + expansion))


def _write(path, content):
    if _PENDING is not None:
        _PENDING[path] = content
        return
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
    for slug, title, description, category in EXPANSION_PAGES:
        path = os.path.join(TOOLS_DIR, f'{slug}.html')
        shell = _expansion_page(slug, title, description, category)
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

    print(f'\n[--sync-expansion] Done. {created} created, {updated} synchronized, {unchanged} unchanged.')


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
            if not os.path.exists(path):
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
    run_sync_expansion()
    run_nav()
    run_tool_count()
    run_words_manifest()
    run_offline_manifest()
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
    parser.add_argument('--nav', action='store_true',
                        help='Inject nav HTML from _includes/_nav.html into published pages')
    parser.add_argument('--tool-count', action='store_true',
                        help='Synchronize published static tool-count copy')
    parser.add_argument('--sync-expansion', action='store_true',
                        help='Create or refresh generated expansion-tool shells')
    parser.add_argument('--words', action='store_true',
                        help='Generate the word-list precache manifest')
    parser.add_argument('--offline', action='store_true',
                        help='Generate the tool precache manifest')

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
            (args.sync_expansion, run_sync_expansion),
            (args.nav, run_nav),
            (args.tool_count, run_tool_count),
            (args.words, run_words_manifest),
            (args.offline, run_offline_manifest),
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
