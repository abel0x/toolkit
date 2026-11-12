# Contributing to Toolkit

Thanks for helping improve Toolkit. The project is deliberately small at runtime: static HTML, CSS, and browser-native JavaScript. Contributions should keep tool input on the device, stay accessible, and keep working offline after the first successful load.

## Ground rules

- Write code, comments, commit messages, and documentation in **English**.
- Keep every tool **client-side**. Do not add APIs, telemetry, trackers, remote processors, or runtime CDN dependencies.
- Keep every tool usable after the offline cache has been installed. Use browser APIs, self-hosted assets, and progressive enhancement.
- Do not store tool input or results. The permitted persistent UI state is the selected language, optional recent-tool slugs, and tool preferences. An explicit exception applies only to opt-in, off-by-default aggregate personal-best scores: they must never contain input text, generated sequences, or error text, must be stored only on the current device, and must have a visible user-clearable control.
- Avoid duplicate tools. Extend an existing tool when the use case and output meaning overlap.
- Treat English as the source locale and provide polished Turkish text for every new visible label, placeholder, description, status, error, and generated message.

## Before you start

1. Search the [live catalogue](https://abel0x.github.io/toolkit/#tools) and `_data/tools.json` for an existing equivalent.
2. Open an [issue](https://github.com/abel0x/toolkit/issues) for a feature, a new tool, or a non-trivial design change.
3. Keep a pull request focused: one tool, one bug fix, or one cohesive maintenance change.

For a bug report, include the browser/version, reproducible steps, expected result, and actual result. Security-sensitive findings belong in the private process described in [SECURITY.md](SECURITY.md), not a public issue.

## Local setup

No install step is required. Use a local HTTP server rather than opening files directly:

```bash
git clone https://github.com/abel0x/toolkit.git
cd toolkit
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). The runtime has no npm dependency. Node.js is only used for the repository checks below.

Enable the repository's pre-commit hook once per clone. It runs `python3 build.py --check` (well under a second) and refuses a commit whose generated files are out of date, the same check CI runs:

```bash
git config core.hooksPath .githooks
```

## Adding or extending a tool

### 1. Decide the implementation shape

Use an existing, independently structured page as a starting point for a conventional tool. The 22 expansion tools share a generated shell and `assets/js/tools/expansion-tools.js`; use that route when the existing component system is a close fit.

Never copy a page without updating its title, description, canonical URL, Open Graph/Twitter values, breadcrumb, module path, Turkish text, and its entry in `_data/seo-tr.json`.

Every published page carries the same `Content-Security-Policy` meta tag directly after `<meta charset>`. It allows only same-origin scripts and stylesheets, so do not add inline `<script>` or `<style>` blocks, `on*=` or `style=` attributes (including inside markup built with `innerHTML`), `eval`, or remote resources. Attach handlers with `addEventListener`; put static styles in a stylesheet (`assets/css/inline-styles.css` holds the former inline styles, `assets/css/tools/<slug>.css` holds page-specific rules) and set computed values through the CSSOM, for example `element.style.setProperty()`, which the policy allows. `404.html` is the one exception: its tiny inline script is allowed by a `sha256-` hash, which must be recomputed whenever that script changes. `node tests/site-audit.mjs` enforces both rules.

### 2. Register the tool

`_data/tools.json` is the single source of the catalogue. Add one entry there; `build.py` generates the browser registries (`assets/js/core/tools-data.js` and `extra-tools-data.js`), the expansion-tool shells, the Turkish copy under `tr/`, and `sitemap.xml` from it. Do not edit those generated files by hand.

```json
{
  "slug": "your-tool",
  "name": "Your Tool Name",
  "cat": "devtools",
  "desc": "A concise, browser-only description.",
  "tags": ["searchable", "keywords"],
  "icon": "<svg ...>...</svg>"
}
```

- `cat` must be a key of the `categories` table at the top of the file; its display label comes from there.
- For an expansion tool, replace `icon` with `"shell": "expansion"` (the shell uses the shared icon) and add `"exampleStarter": true` if it has a “Try a sample” starter. `python3 build.py --all` then creates `tools/your-tool.html`.
- The `slug` must be unique and lowercase-hyphenated, and match `tools/your-tool.html`. `build.py` rejects an invalid entry, and the site audit checks that pages, registries and the sitemap agree with the file.

### 3. Create the page and module

Tool pages use the shared stylesheet modules and load shared scripts in this order at the end of `<body>`:

```html
<script src="../assets/js/core/utils.js" defer></script>
<script src="../assets/js/core/nav.js" defer></script>
<script src="../assets/js/core/i18n-expansion.js" defer></script>
<script src="../assets/js/core/i18n.js" defer></script>
<script src="../assets/js/core/tools-data.js" defer></script>
<script src="../assets/js/core/extra-tools-data.js" defer></script>
<script src="../assets/js/core/command-palette.js" defer></script>
<script src="../assets/js/tools/your-tool.js" defer></script>
```

Keep a conventional tool module isolated and strict:

```javascript
(function initYourTool() {
  'use strict';

  // Use the shared helpers such as showToast() and copyToClipboard().
  // Do not send or persist user-provided data.
}());
```

### 4. Add localisation as part of the feature

Visible English copy is the i18n source key. Add the matching Turkish value to `assets/js/core/i18n.js` for shared UI text or `assets/js/core/i18n-expansion.js` for tool-page and expansion copy. Use `ToolkitI18n.t(key, values)` for dynamic strings; do not concatenate language-dependent fragments.

Verify all of the following in both English and Turkish:

- headings, descriptions, labels, placeholders, help text, and buttons;
- empty, loading, success, and error states;
- generated results, including values interpolated into a sentence;
- titles, navigation labels, and accessible names.

Every page also needs an entry in `_data/seo-tr.json`: the Turkish `title`, `description` (and `ogDescription` where the page's Open Graph description differs), plus a `source` block that repeats the English values. `build.py` stops when a page has no entry or when its English title or description no longer matches `source`, so update both together. Use `{{count}}` for the tool count. Run `node tests/turkish-seo-audit.mjs` afterwards.

Run `node tests/i18n-audit.mjs` after changing either dictionary or the i18n runtime. It checks dictionary shadowing and duplicate source keys, translated document titles, dynamic translation patterns, and the guarantee that functional form values are never translated.

### 5. Regenerate maintained output

Edit `_includes/_nav.html` for shared navigation, then run the narrow maintenance commands that match the change:

```bash
# Regenerate everything build.py maintains: tool registries, expansion-tool
# shells, shared nav, visible tool counts, the Turkish tr/ pages, precache
# lists, sitemap, and the content-hashed cache version.
python3 build.py --all

# Confirm nothing is out of date (CI runs this and fails on drift).
python3 build.py --check

# Localisation dictionaries, runtime safeguards, and Turkish title coverage.
node tests/i18n-audit.mjs
```

Run `python3 build.py --all` after **any** change to a published file, including a one-line CSS fix. The service worker serves assets cache-first, so `CACHE_VERSION` is a hash of every published file; a stale hash would leave returning visitors on old CSS and JavaScript, and CI rejects it. Every task is idempotent, so running it twice changes nothing. Do not edit `CACHE_VERSION`, textual tool counts, or `sitemap.xml` by hand. A page's sitemap `<lastmod>` moves only when its bytes change; `_data/lastmod.json` records the hash and date, so commit it with the pages.

### 6. Validate before opening a PR

```bash
node tests/site-audit.mjs
node tests/tool-dom-audit.mjs
node tests/words-audit.mjs
node tests/i18n-audit.mjs
node tests/turkish-seo-audit.mjs
node tests/accessibility-audit.mjs
node tests/conversion-regressions.mjs
node tests/typing-regressions.mjs
node tests/audit-regressions.mjs
node tests/tool-vectors.mjs
node tests/tool-pages-e2e.mjs
node tests/expansion-e2e.mjs
node tests/turkish-pages-e2e.mjs
node tests/offline-e2e.mjs
```

The static checks verify publication structure, word data, localisation, the generated Turkish pages and their hreflang links, semantic landmarks, label references, focus-order hazards, live regions, and token contrast. The browser suites start Firefox and isolated local servers themselves: one smoke-tests every tool page on desktop and mobile with Turkish switching, accessible control names, and example starters; another exercises functional flows and exact standard vectors; one opens the `/tr/` pages and switches languages by URL; and the offline suite installs the production service worker under `/toolkit/`, stops its server, and verifies cached navigation plus cache isolation. For a conventional new tool, manually check it in current Firefox and a Chromium browser too.

## Style guide

- **JavaScript:** modern browser JavaScript, strict IIFE modules, no transpilation.
- **CSS:** use existing custom properties and the relevant modular stylesheet; do not add global one-off rules when a component or page module is appropriate.
- **HTML:** semantic landmarks, associated labels, usable keyboard controls, meaningful `aria-*` values, and `alt` text for informative images.
- **Copy:** short, direct English source text and natural Turkish, not word-for-word machine translation.
- **Formatting:** two spaces for HTML, CSS, and JavaScript; keep files UTF-8 with a final newline. Byte-for-byte pinned third-party distributions may retain their upstream EOF style when their checksum and the exception are documented in `assets/js/vendor/README.md`.

## Word lists

The root-level `words/` directory is shared data, not private state for one tool. Read `words/README.md` before adding or changing a list. In short:

- Register each list in `words/manifest.json` with a stable kebab-case id, a path relative to `words/`, an English source label, group, type, count, and sort order.
- Keep list files as two-space, UTF-8 JSON with LF endings and a final newline. Entries must be NFC-normalised, neutral, deduplicated with the content locale, and appropriately licensed.
- Use a primary official publisher or another source with an explicit static-redistribution basis. Do not source word-list entries from GitHub, GitLab, Bitbucket, or another code-hosting repository; record the source, licence, structured provenance method, review date, and HTTPS source URLs.
- Quote lists must contain public-domain literary passages only. Name the author and work in every quote attribution; do not add anonymous motivational sentences or copied modern translations. Keep short, medium, and long quote choices materially populated.
- Retain a specific edition identifier (`bookId`) on every base quotation. Combined excerpts must name their works, disclose that they are selections, and reference base passages with `parts`; English and Turkish entries must keep identical attribution and passage references. Preserve NLM `descriptorIds` alongside the English medical words.
- Run `tests/word-sources-audit.py` against downloaded primary editions when changing MeSH terms or literary passages. The command is documented in `words/README.md`; it is read-only and has no runtime/network dependency. Do not describe a schema pass or a dictionary link as proof that every spelling, translation or attribution is correct.
- Never fill a category by mechanically joining roots and suffixes or unrelated nouns and verbs. Prefer removing an unverified entry to preserving a numerical target; document any change in count and the associated quality floor.
- Add the Turkish translation for every manifest label and group to `assets/js/core/i18n-expansion.js`.
- Run `python3 build.py --words` and `node tests/words-audit.mjs`. The whole data tree must stay below 500 KB and each file below 80 KB.

Typing-test preferences may persist under one settings key because they are UI state. Personal records are session-only unless the visitor opts in. The opt-in record store contains at most one aggregate score per test tuple, never typed input, generated words, or error text, and exposes a clear action at all times. Do not extend this exception to run history or any other tool without first updating this policy deliberately.

## Build helper reference

`build.py` uses only the Python standard library and maintains generated/static consistency.

| Flag | Purpose |
| --- | --- |
| `--all` | Run every task below, then refresh the cache version. Run this before committing. |
| `--check` | Run every task in memory and fail, listing the files, if anything is out of date. |
| `--site` | Copy only the published files into `_site/` and verify every page reference and precache entry resolves. CI deploys this directory. |
| `--registry` | Generate `tools-data.js` and `extra-tools-data.js` from `_data/tools.json`. |
| `--nav` | Inject `_includes/_nav.html` into the published pages. |
| `--tool-count` | Synchronise published static tool-count copy. |
| `--sync-expansion` | Create missing expansion-tool shells and refresh existing ones from the template. |
| `--words` | Rebuild the service-worker precache entries for `words/*.json` and report the payload budget. |
| `--turkish` | Generate the `tr/` pages and the hreflang links from `_data/seo-tr.json`. |
| `--offline` | Rebuild the service-worker precache entries for tool pages and modules. |
| `--sitemap` | Generate `sitemap.xml`, with `lastmod` dates from `_data/lastmod.json` and hreflang alternates. |

Any task also recomputes `CACHE_VERSION` in `sw.js`. Repository-only files (tests, documentation, `build.py`, `_includes/`, editor settings) are never published; add a new top-level published file or directory to `PUBLISHED_FILES` / `PUBLISHED_DIRS` in `build.py`.

## Commit messages

Use a short imperative subject with a conventional prefix:

```text
feat: add json schema helper
fix: preserve HMAC key encoding
docs: clarify offline contribution checks
style: align tool footer spacing
```
