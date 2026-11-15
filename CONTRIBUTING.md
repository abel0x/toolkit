# Contributing to Toolkit

Thanks for helping improve Toolkit. The project is deliberately small at runtime: static HTML, CSS, and browser-native JavaScript. Contributions should keep tool input on the device, stay accessible, and keep working offline after the first successful load.

## Ground rules

- Write code, comments, commit messages, and documentation in **English**.
- Keep every tool **client-side**. Do not add APIs, telemetry, trackers, remote processors, or runtime CDN dependencies.
- Keep every tool usable after the offline cache has been installed. Use browser APIs, self-hosted assets, and progressive enhancement.
- Do not store tool input or results. The permitted persistent UI state is the selected language, optional recent-tool slugs, and tool preferences (plus the per-tab redirect loop guard in `sessionStorage`, which holds one page path). Every storage key must be listed by name on the privacy page (`privacy/index.html`); `tests/site-audit.mjs` fails when a script uses a `toolkit-*` key the page does not name, so never give a message or event a `toolkit-` name. An explicit exception applies only to opt-in, off-by-default aggregate personal-best scores: they must never contain input text, generated sequences, or error text, must be stored only on the current device, and must have a visible user-clearable control.
- Avoid duplicate tools. Extend an existing tool when the use case and output meaning overlap.
- Treat English as the source locale and provide polished Turkish text for every new visible label, placeholder, description, status, error, and generated message.

## Before you start

1. Search the [live catalogue](https://abel0x.github.io/toolkit/#tools-hub) and `_data/tools.json` for an existing equivalent.
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

Open [http://localhost:8080](http://localhost:8080). The runtime has no npm dependency. Node.js is used for the repository checks below and by `build.py`, which translates the Turkish pages with it.

To check a change the way GitHub Pages will serve it (under `/toolkit/`, with the 404 page for missing addresses), run `python3 build.py --site` and then `python3 _scripts/serve.py _site`, and open <http://127.0.0.1:8000/toolkit/>.

Enable the repository's pre-commit hook once per clone. It runs `python3 build.py --check` (well under a second) and refuses a commit whose generated files are out of date, the same check CI runs:

```bash
git config core.hooksPath .githooks
```

## Adding or extending a tool

### 1. Decide the implementation shape

Use an existing, independently structured page as a starting point for a conventional tool. The 22 expansion tools share a generated shell and `assets/js/tools/expansion-tools.js`; use that route when the existing component system is a close fit.

Never copy a page without updating its title, description, canonical URL, Open Graph/Twitter values, breadcrumb, module path, Turkish text, and its entry in `_data/seo-tr.json`.

Every published page carries the same `Content-Security-Policy` meta tag directly after `<meta charset>`. It allows only same-origin scripts and stylesheets, so do not add inline `<script>` or `<style>` blocks, `on*=` or `style=` attributes (including inside markup built with `innerHTML`), `eval`, or remote resources. Attach handlers with `addEventListener`; put static styles in a stylesheet (`assets/css/inline-styles.css` holds the former inline styles, `assets/css/tools/<slug>.css` holds page-specific rules) and set computed values through the CSSOM, for example `element.style.setProperty()`, which the policy allows. `404.html` is the one exception: its tiny inline script is allowed by a `sha256-` hash, which must be recomputed whenever that script changes. `node tests/site-audit.mjs` enforces both rules. The `<script type="application/ld+json">` block that `build.py` adds to each page is structured data, not code; browsers never execute it, so the policy does not apply to it. Do not edit it by hand.

### 2. Register the tool

`_data/tools.json` is the single source of the catalogue. Add one entry there; `build.py` generates the browser registries (`assets/js/core/tools-data.js` and `extra-tools-data.js`), the expansion-tool shells, the Turkish copy under `tr/`, and `sitemap.xml` from it. Do not edit those generated files by hand.

```json
{
  "slug": "your-tool",
  "name": "Your Tool Name",
  "cat": "devtools",
  "desc": "A concise, browser-only description.",
  "meta": "A longer description for search results (optional).",
  "tags": ["searchable", "keywords"],
  "related": ["json-formatter", "json-validator", "json-diff", "json-sorter"],
  "icon": "<svg ...>...</svg>"
}
```

- `cat` must be a key of the `categories` table at the top of the file; its display label comes from there. `build.py --registry` makes the home page's category tabs from that table (in its order) and sets every card's category, so a new category needs only a table entry, its Turkish name, and an "All … tools" link text in `_CATEGORY_LINK_TEXT` in `build.py`.
- `name`, `desc` and `meta` are the only place a tool is named and described. `build.py --tool-headers` writes `name` into the page `<title>`, `og:title`, `twitter:title`, the `<h1>` and the breadcrumb, `desc` into the line under the `<h1>`, and `meta` (or `desc` when there is no `meta`) into the meta, Open Graph and Twitter descriptions, from which the JSON-LD is made; `build.py --registry` writes `name` and `desc` into the home page card and the tool finder. Describe only what the tool does today. Changing `name` or `meta` changes the English page metadata, so update the page's entry in `_data/seo-tr.json` too; `desc` and `name` need a Turkish entry in `i18n-expansion.js`. `tests/site-audit.mjs` checks that every page and card agrees with the catalogue.
- `related` names four other tools, by slug, that someone using this one is likely to want next. `build.py --related` shows them in a row at the end of the page, with a link to the tool's category; the `tr/` twin gets the same row in Turkish. Without the list the build picks the tools sharing the most tags, then the same category, so add it by hand once those picks look wrong.
- `io` (optional) lets fields open files and outputs be copied or downloaded, through `assets/js/core/tool-io.js`: `{"inputs": {"#input": ".json,text/plain"}, "outputs": {"#output": {"copy": true, "save": "result.json", "beside": "#copyButton"}}}`. An input gets "Open file" and accepts a dropped file (up to 5 MB, read as text in the browser); an output gets Copy (`copy`) and/or Download (`save`, the file name). With `beside` the new buttons sit next to that existing button in its style; otherwise they go to the right of the field's label. When the field has no label above it, or sits in a side-by-side layout, put an empty `<div class="field-actions" data-for="<field id>"></div>` where the buttons belong (the Markdown toolbar does); a button row inside a side-by-side layout fails the tool-page suite. `build.py --tool-headers` loads the script with the entry, and `tests/tool-io-e2e.mjs` exercises every one.
- `share` (optional) gives a tool a “Copy link” button: `{"fields": ["#input"], "action": "#run"}` lists the `#id`s of the fields whose values go into the link's `#share=` fragment and, if the tool does not update live, the button that runs it. `build.py --tool-headers` adds the button and `share-link.js`. Leave it out for tools whose input is usually a secret (keys, tokens, passwords).
- `added` is the release that first shipped the tool, as `x.y.z`. `build.py --registry` lists the eight most recently added tools in the home page's "New in Toolkit" row, between `<!-- NEW-TOOLS:START -->` and `<!-- NEW-TOOLS:END -->`; every new tool needs it (`_scripts/new_tool.py` refuses a spec without it).
- Every tool needs its own `icon`: a 24×24 outline SVG drawn like the others (`fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, 20 px), used by no other tool. The build copies it to the header, the related-tool rows and the home page card; the site audit rejects a shared icon. For an expansion tool, add `"shell": "expansion"`, plus `"exampleStarter": true` if it has a “Try a sample” button. `python3 build.py --all` then creates `tools/your-tool.html`.
- The `slug` must be unique and lowercase-hyphenated, and match `tools/your-tool.html`. `build.py` rejects an invalid entry, and the site audit checks that pages, registries and the sitemap agree with the file.

### 3. Create the page and module

Tool pages use the shared stylesheet modules and load shared scripts in this order at the end of `<body>`. Do not add Turkish dictionaries, packs or `language-redirect.js` yourself: `build.py --turkish` generates the packs in `assets/js/i18n/tr/` (never edit them), adds them to the `tr/` copy, and adds the redirect script to the English page's `<head>`.

```html
<script src="../assets/js/core/utils.js" defer></script>
<script src="../assets/js/core/nav.js" defer></script>
<script src="../assets/js/core/i18n.js" defer></script>
<script src="../assets/js/core/command-palette.js" defer></script>
<script src="../assets/js/tools/your-tool.js" defer></script>
```

Do not load `tools-data.js` or `extra-tools-data.js` on a tool page: only the home page needs the catalogue up front. `command-palette.js` fetches it, and its Turkish pack on `/tr/` pages, when the tool finder is about to open.

Start the page body with the breadcrumb and header that every tool page shares; `build.py --tool-headers` fills them in. Write just the page name in the breadcrumb, and the `<h1>` and description in a plain header, and the build turns them into the generated block between `<!-- TOOL-HEADER:START -->` and `<!-- TOOL-HEADER:END -->`:

```html
<nav class="tool-breadcrumb" aria-label="Breadcrumb"><a href="../index.html">← All Tools</a><span class="tool-breadcrumb-sep">/</span><span>Your Tool Name</span></nav>
…
<div class="section-header reveal">
  <h1 class="section-title" id="yourToolHeading">Your Tool Name</h1>
  <p class="section-desc">One sentence on what the tool does.</p>
  <button type="button" data-example-group="your-tool">Try a sample</button>
</div>
```

The breadcrumb gains the tool's category (linked to that tab on the home page, `index.html#category-<cat>`) and the title gains the tool's `icon` from `_data/tools.json` (expansion tools get the shared one). The button is optional: add it only when `assets/js/core/example-starters.js` has examples under that group name (an example fills fields by selector, then clicks its `action`, or each of several in order), give every example name a Turkish entry in `i18n-expansion.js`, and load that script; the build restyles it and places it beside the header. A sample must produce a visible result: the tool-page suite fails when one only fills its fields. Afterwards change the title and description in `_data/tools.json`, not in the page: the build rewrites them from the catalogue and keeps the sample group name.

Keep a conventional tool module isolated and strict:

```javascript
(function initYourTool() {
  'use strict';

  // Use the shared helpers such as showToast() and copyToClipboard().
  // Do not send or persist user-provided data.
}());
```

### 4. Add localisation as part of the feature

Visible English copy is the i18n source key. Add the matching Turkish value to `assets/js/core/i18n-tr.js` for shared UI text (strings with numbers or variable parts get a rule in its `translatePattern`) or `assets/js/core/i18n-expansion.js` for tool-page and expansion copy. Use `ToolkitI18n.t(key, values)` for dynamic strings; do not concatenate language-dependent fragments. Write every key as a complete string literal in the script that uses it: the Turkish pages only receive the keys the build finds in their scripts (`tests/turkish-pages-e2e.mjs` fails when a Turkish page shows English it could have translated). The runtime translates inserted elements and text automatically, but not text or attributes changed on an existing element: wrap those in `ToolkitI18n.t()`.

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

`_scripts/test_all.sh` runs every suite below in order, installs the pinned axe-core when it is missing, keeps each log under `${TMPDIR:-/tmp}/toolkit-tests`, and ends with `ALL PASSED` or the list of failed suites. Do not edit files while it runs. The suites one by one:

```bash
node tests/site-audit.mjs
node tests/tool-dom-audit.mjs
node tests/words-audit.mjs
node tests/i18n-audit.mjs
node tests/turkish-seo-audit.mjs
node tests/accessibility-audit.mjs
node tests/axe-audit.mjs   # needs: npm install --no-save --no-package-lock axe-core@4.14.0
node tests/conversion-regressions.mjs
node tests/typing-regressions.mjs
node tests/audit-regressions.mjs
node tests/tool-vectors.mjs
node tests/tool-pages-e2e.mjs
node tests/shortcuts-share-e2e.mjs
node tests/tool-io-e2e.mjs
node tests/expansion-e2e.mjs
node tests/turkish-pages-e2e.mjs
node tests/qr-generator-e2e.mjs
node tests/offline-e2e.mjs
```

The static checks verify publication structure, word data, localisation, the generated Turkish pages and their hreflang links, semantic landmarks, label references, focus-order hazards, live regions, and token contrast. The browser suites start Firefox and isolated local servers themselves: one runs axe-core on every English and Turkish page and fails on any WCAG 2.2 A/AA or best-practice violation (`AXE_PAGES=tools/a.html,tr/tools/a.html` narrows a local run, `AXE_DETAIL=1` prints the offending HTML); one smoke-tests every tool page, the header and line layout of the licence page and the privacy page, on desktop and mobile — and every Turkish tool page too, measuring that the header, breadcrumb and related-tools row share one column, that no link sticks out, overlaps or breaks inside itself, and that nothing scrolls sideways — with the language menu, accessible control names, example starters that must each produce a result, and Ctrl+Enter running each tool exactly once; one opens and drops files into every field that takes them and checks every Copy and Download button; one presses "?" with real keys on every kind of page and shares twelve tools as links, reopening each and refusing broken or hostile links; another exercises functional flows and exact standard vectors; one opens the `/tr/` pages, switches languages by URL, follows the Turkish-preference redirect, and fails when a Turkish page shows English its pack should cover; the QR suite decodes the generator's PNG and SVG exports with jsQR, ZBar (`zbarimg`, via `rsvg-convert` for SVG) and, when installed, ZXing-C++ (`ZXingReader`), checks its capacity table and alignment patterns against the QR library, and checks that on phones the preview stays in the first screen, above the form, without breaking the tab order; and the offline suite installs the production service worker under `/toolkit/`, serves it a pretend next release to check the "new version is ready" notice, stops its server, and verifies cached navigation, cache isolation and the 404 page, which is Turkish with Turkish links at a missing `/tr/` address. For a conventional new tool, manually check it in current Firefox and a Chromium browser too.

## Maintainer scripts

`_scripts/` holds repository-only helpers; nothing in it is published.

| Script | Purpose |
| --- | --- |
| `serve.py DIR` | Serve `_site/` under `/toolkit/` with the 404 page, as GitHub Pages does. |
| `translate.mjs` | Used by `build.py --turkish` to translate the `tr/` pages. |
| `test_all.sh` | Run every CI test suite and print one verdict. |
| `new_tool.py spec.json` | Add a conventional tool from one spec: its `_data/tools.json` entry (inserted before a named conventional tool), its page built from the UUID Validator template, its Turkish name and description, and its `_data/seo-tr.json` entry. The script's docstring describes the spec. Then write the module and CSS, add its strings and run `python3 build.py --all`. |
| `add_translations.py strings.json` | Add English → Turkish strings to the dictionaries, skipping existing keys; `--patterns file` adds `translatePattern` rules, `--samples` example names. |
| `set_description.py SLUG …` | Change a tool's `desc` and `meta` in English and Turkish together. |
| `screenshot.mjs URL out.png W H [script]` | Capture a page in Firefox, full height (`SCREENSHOT_VIEWPORT=1` for the viewport only); used for the README screenshots. |
| `release_notes.py VERSION PREVIOUS changelog.md readme.md` | Add a dated CHANGELOG section and its compare link, and the README summary, keeping the latest three releases there. |
| `release.sh VERSION commit.txt tag.txt` | Maintainers only: signed commits, push, wait for CI, check the commits are verified, then a signed tag and the GitHub release from the CHANGELOG section. |

`.github/workflows/vendor-audit.yml` checks the versions pinned in `_data/vendor.json` once a month with `npm audit` and reports newer upstream releases. When a library in `assets/js/vendor/` is updated, update its entry there and in `assets/js/vendor/README.md` together; the site audit checks they agree.

## Style guide

- **JavaScript:** modern browser JavaScript, strict IIFE modules, no transpilation.
- **CSS:** use the custom properties in `assets/css/core.css` by role (`--bg-*`, `--text-*`, `--border*`, `--accent*`, and `--green`, `--yellow`, `--red` for status) and the relevant modular stylesheet; do not add global one-off rules when a component or page module is appropriate. The design is monochrome and flat: no gradients, glows, blur or new brand colours, and colour only where it carries meaning. Interface text uses the system font; `--font-mono` (JetBrains Mono, subset to Latin, Turkish and common symbols) is for code and data.
- **HTML:** semantic landmarks, associated labels, usable keyboard controls, meaningful `aria-*` values, and `alt` text for informative images. An accessible name must contain the visible text, outside parentheses (axe ignores parenthesised text): write `aria-label="Close tool finder, Esc"`, not `"Close tool finder (Esc)"`. For a choice between views use the shared `.view-switch` (native radio buttons), and `<details>` for collapsible content.
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
| `--registry` | Generate `tools-data.js` and `extra-tools-data.js` from `_data/tools.json`, and the home page cards: every hand-written card gets its catalogue icon, and each tool without one gets a generated card between `<!-- HUB-CARDS:START -->` and `<!-- HUB-CARDS:END -->`, so the home page needs no script to list the tools. |
| `--nav` | Inject `_includes/_nav.html` into the published pages. |
| `--tool-headers` | Generate each tool page's breadcrumb (with its category), header (catalogue icon, name, description, "Try a sample" button) and its `<title>` and description tags from `_data/tools.json`. |
| `--related` | End every tool page with its four related tools (from `related` in `_data/tools.json`) and a link to its home page category, between `<!-- RELATED:START -->` and `<!-- RELATED:END -->`. |
| `--tool-count` | Synchronise published static tool-count copy. |
| `--sync-expansion` | Create missing expansion-tool shells and refresh existing ones from the template. |
| `--words` | Rebuild the service-worker precache entries for `words/*.json` and report the payload budget. |
| `--metadata` | Add the social preview image tags (`og:image`, `twitter:image`, locale) and the JSON-LD block to every English page. |
| `--license` | Publish `LICENSE` on the licence page, one `<span>` per line with a hanging indent as wide as the line's leading spaces, so wrapped lines stay under their own text on phones. A new indent width needs a `.license-line--<n>` rule in `assets/css/pages/tool.css`; the build says so. |
| `--turkish` | Generate the `tr/` pages and the hreflang links from `_data/seo-tr.json`. |
| `--offline` | Rebuild the service-worker precache entries for tool pages and modules. |
| `--sitemap` | Generate `sitemap.xml`, with `lastmod` dates from `_data/lastmod.json` and hreflang alternates. |

Any task also recomputes `CACHE_VERSION` in `sw.js` and writes it into every page's stylesheet and script links as `?v=<CACHE_VERSION>`. A new release therefore changes every asset URL: the previous service worker, which still controls the first page load after a deploy, has never cached those URLs and fetches them from the network, so new HTML never meets old CSS or JavaScript. The current worker answers its own version from the precache. Write plain asset links (`../assets/css/pages/tool.css`); never add `?v=` by hand. Repository-only files (tests, documentation, `build.py`, `_scripts/`, `_includes/`, editor settings) are never published; add a new top-level published file or directory to `PUBLISHED_FILES` / `PUBLISHED_DIRS` in `build.py`.

## Images

`assets/images/og-en.png` and `og-tr.png` are the 1200×630 link-preview images for the English and Turkish pages. Their source is `_includes/og-card.html`, which is not published. After changing it, render both images with the Chromium command in that file's header comment and run `python3 build.py --all`. The site audit checks the size and dimensions of both images.

`.github/social-preview.png` (1280×640, not published) is the English card centred on the page background, for the repository's social preview. GitHub has no API for it: upload it under **Settings → General → Social preview** after it changes.

`assets/images/logo.png` is the navigation logo; `favicon-*.png` are the same mark on a dark tile for browser tabs, the PWA and Apple touch icons. The README screenshots (`Main`, `Category`, `Finder`, `Password`, `Turkish`, `Mobile` `.webp`) are 1280×720 captures of the live design; retake them when the design changes.

## Commit messages

Use a short imperative subject with a conventional prefix:

```text
feat: add json schema helper
fix: preserve HMAC key encoding
docs: clarify offline contribution checks
style: align tool footer spacing
```
