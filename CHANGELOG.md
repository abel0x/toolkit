# Changelog

All notable changes to Toolkit are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and releases follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- The `/tr/` pages now ship their body already in Turkish instead of English that the browser translated after loading. Search engines that do not run JavaScript, link previews and the first paint now see Turkish, and the brief flash of English on `/tr/` is gone. `build.py --turkish` translates the visible text and the `aria-label`, `title` and `placeholder` attributes with the browser's own `i18n.js` dictionaries and rules, run by the new `_scripts/translate.mjs`, so the two can never disagree. The build fails if a translated string would be translated again in the browser, or if an `<option>` has no `value`.
- `tests/turkish-pages-e2e.mjs` checks that every Turkish page equals the runtime translation of its English page and leaves the runtime nothing to translate, and runs the example starters and primary actions of all 101 Turkish tool pages.
- English pages no longer download the Turkish dictionaries. The shared Turkish strings and the rules for strings with numbers moved from `i18n.js` to the new `assets/js/core/i18n-tr.js`, and only the `/tr/` pages and `404.html` (which has no Turkish twin) load it together with `i18n-expansion.js`. Each English page saves about 142 KB of JavaScript (about 45 KB compressed): it now loads a 12 KB runtime instead of 155 KB.
- A visitor who chose Turkish and opens an English address is sent to its `/tr/` page by the new `assets/js/core/language-redirect.js`, which runs in `<head>` before anything is drawn and keeps the query string and fragment. Offline, when the service worker can only offer the English twin of an unvisited `/tr/` page, a per-tab guard in `sessionStorage` stops the two from redirecting to each other, and that page shows in English. `build.py --turkish` adds the redirect script to English pages and the dictionaries to the `/tr/` pages.
- Choosing Turkish on an English page always opens its `/tr/` twin; only `404.html` still translates in place. The browser tests that switched an English page to Turkish in place now open the `/tr/` page instead, and check that English pages load no Turkish dictionary, that the redirect works online and stops offline, and that the typing test keeps practice text untranslated and formats results in Turkish on its Turkish page.

## [1.3.1] — 2026-11-13

### Added

- Social preview images: `assets/images/og-en.png` and `og-tr.png` (1200×630), rendered from `_includes/og-card.html`. Every English and Turkish page now declares its language's image with `og:image` (plus size and alt text), `twitter:image`, and `twitter:card` set to `summary_large_image`, so shared links show a large card instead of a text-only one. `og:locale` and `og:locale:alternate` mark the page language.
- JSON-LD structured data on every indexable page, in its own language: `WebSite` for the home page, `WebApplication` with a two-step `BreadcrumbList` for each tool, and `WebPage` for the license page. It is a non-executable data block, so the Content-Security-Policy is unchanged.
- `build.py --metadata` (part of `--all`) generates both. The site and Turkish SEO audits check the tags, parse the JSON-LD, and check the images' format, size, and dimensions.

## [1.3.0] — 2026-11-12

Makes the Turkish interface visible to search engines: every page now has a Turkish address with Turkish metadata, linked to its English twin. No tool is added or changed.

### Added

- Every page has a Turkish address under `/tr/` (`/toolkit/tr/`, `/toolkit/tr/tools/<slug>.html`, `/toolkit/tr/license/`), so search engines can index and show the Turkish interface. Previously Turkish existed only as a client-side setting, and every URL was indexed in English. `build.py --turkish` (part of `--all`) generates these 103 pages from the English ones. Each copy declares `lang="tr"`, renders in Turkish regardless of the saved setting, and has its own Turkish title, description, Open Graph and Twitter tags and canonical URL, taken from the new `_data/seo-tr.json`. The build stops when a page has no Turkish entry or its English metadata changed since the Turkish copy was written.
- Reciprocal `hreflang` links (`en`, `tr`, `x-default` → English) on both language versions of every page, and the matching `xhtml:link` alternates in `sitemap.xml`, which now lists 206 URLs.
- Google Search Console ownership is verified with a `google-site-verification` meta tag on the home page, which must stay in `index.html` while the property exists. It replaces the `googlea232df08b3b74961.html` verification file, which is no longer published, and the site audit fails if the tag is removed.
- `tests/turkish-seo-audit.mjs` checks the generated pages, their metadata, references and the sitemap. `tests/turkish-pages-e2e.mjs` opens them in Firefox. Both run in CI.

### Changed

- On pages that have a Turkish twin, the language menu now opens the other URL instead of translating in place. Opening a `/tr/` page saves Turkish as the preference.
- The service worker is registered, and the typing test loads its word lists, relative to the site root rather than the page, so both also work from `/tr/`. Offline, an unvisited `/tr/` page redirects to its precached English twin, which renders in the saved language.
- The offline end-to-end test waits for the service worker to finish activating before it checks the cache; it was intermittently failing in CI.
- CONTRIBUTING, SECURITY and the vendor README describe the current build and tests: the Turkish page step and checks, every `build.py` flag, the Content-Security-Policy, and the automatic `CACHE_VERSION`.

### Fixed

- `.githooks/pre-commit` is tracked as executable. It was stored as a plain file, so git ignored the hook in fresh clones even after `core.hooksPath` was set.

## [1.2.2] — 2026-11-07

Completes the maintenance pass begun in 1.2.1: 1.2.1 fixed what the build and deployment produced; 1.2.2 removes the hand-synchronised lists and manual steps that let those faults happen.

### Changed

- `_data/tools.json` is now the single source of the tool catalogue. `build.py` generates the browser registries (`tools-data.js`, `extra-tools-data.js`), the expansion-tool shells, and `sitemap.xml` from it, and rejects duplicate slugs, unknown categories, and malformed entries. Previously the list was kept in sync by hand in three files plus the sitemap. The generated registries are identical to the former hand-written ones.
- `sitemap.xml` is generated in catalogue order with a `<lastmod>` per page that changes only when that page's bytes change (hashes and dates live in `_data/lastmod.json`). The `changefreq` and `priority` hints, which major search engines ignore, were dropped.
- The site audit derives the expected tool count from `_data/tools.json` instead of a hard-coded 101, and checks that each page's shell and the registries match it.
- Tool modules use the shared `escapeHTML` from `utils.js`; three private copies were removed (one was unused). The shared helper now accepts non-string values.

### Added

- An optional pre-commit hook in `.githooks/` runs `python3 build.py --check` and refuses a commit whose generated files are stale. Enable it with `git config core.hooksPath .githooks`.

### Removed

- `robots.txt`. Crawlers read it only at the host root, so the copy under `/toolkit/` was never used; submit the sitemap through the search engines' webmaster tools instead.

## [1.2.1] — 2026-11-07

### Fixed

- Returning visitors could receive new HTML alongside stale cached CSS and JavaScript, because the service worker serves assets cache-first and its `CACHE_VERSION` was bumped by hand (it was not bumped for the last CSS and home-page title changes). `CACHE_VERSION` is now a content hash of every published file, written by `build.py`.
- `build.py --sync-expansion` removed the Content-Security-Policy and `inline-styles.css` from the 22 generated expansion pages, and `--styles` / `--all` reordered stylesheets on all 101 tool pages. The expansion template now matches the published pages and every task is idempotent.

### Changed

- Removed the completed one-off migration tasks `--meta`, `--scripts`, `--styles`, `--enhance` and `--new-tools` from `build.py`; `--sync-expansion` now also creates missing pages.
- Added `build.py --check`, which fails when any generated file is out of date; CI runs it instead of silently regenerating files before deployment.
- Added `build.py --site`, which assembles only the published files in `_site/` and verifies that every page reference and precache entry resolves. GitHub Pages now deploys `_site/`, so tests, build tooling and documentation are no longer served.
- The build-and-test workflow now also runs on pull requests (deployment remains `main`-only), and the offline test runs against the assembled `_site/`.

## [1.2.0] — 2026-10-04

### Added

- Added the 101st tool, **Typing Speed Test**, with local English and Turkish themed word lists, accessibility-aware controls, Turkish diacritic handling, canvas speed chart, and keyboard error heat map.
- Added reusable `words/` data with 20 bilingual categories and 9,246 local entries after source-quality review, a word-list audit, offline word-list precaching, and opt-in aggregate-only typing personal bests.
- Added a published, readable [license page](https://abel0x.github.io/toolkit/license/) with the canonical Apache License 2.0 text, a download link, Turkish interface copy, a navigation shortcut, sitemap entry, and offline availability.
- Added full Firefox smoke coverage for all 101 tool pages, plus a static accessibility audit for landmarks, label references, focus order, live regions, and colour contrast; both now run before deployment.
- Added random, local, editable example starters to 40 frequently used tools, with Turkish interface copy, browser coverage, and offline precaching.
- Added a real service-worker browser test that installs the production worker at the GitHub Pages `/toolkit/` path, disconnects the server, and verifies cached tools, word lists, vendor assets, the published licence, and the 404 fallback.
- Added pinned upstream licence files and integrity checks for the self-hosted bcrypt, QR generation, and QR reading libraries.
- Added a `Content-Security-Policy` to every published page (same-origin scripts only; the 404 page's inline script is allowed by hash), enforced by the site audit.
- Added `tests/audit-regressions.mjs` and a nested-URL 404 check in the offline suite; both run in CI.
- Added `tests/tool-vectors.mjs`, which checks 33 tools against independently computed known answers in CI.
- Added a WebKit (Safari engine) smoke test of every page in a separate CI workflow.

### Changed

- Made published tool-count maintenance data-driven so static first-paint copy follows the registry automatically.
- Replaced repository-derived vocabulary and expanded English finance and legal plus Turkish finance, legal, and programming practice terms with traceable primary-source or independently curated lists reviewed against official references. Every category now records a structured production method, review date, and HTTPS source URLs, and the audit rejects ambiguous provenance and code-hosting repositories.
- Replaced anonymous typing-practice sentences with 146 source-checked literary excerpts per language: 66 base passages from 25 public-domain editions plus 80 explicitly labelled combinations, paired original Turkish translations, balanced length choices, and visible author/work attribution. The separate idiom lists contain 339 English and 331 Turkish expressions after removing synthetic combinations.
- Replaced the former hexagon mark with the new Toolkit artwork across the navigation, browser favicon, PWA icons, and README. The retained PNG icon set is sized for 32, 64, 128, 256, and 512 pixel uses.
- Updated the shared navigation generator so nested static pages, including `/license/`, resolve their assets and service worker correctly.
- Standardised radio controls and colour-input triggers with shared focus-visible states, and moved repeated legacy form layouts into reusable component classes.
- Replaced the GPL QR batch dependency and legacy QR encoder with one pinned MIT-licensed generator plus its UTF-8 adapter, shared by single and batch QR generation.
- Self-hosted fonts are now WOFF2 (516 KB → 199 KB); the offline cache is now `v78`.
- The style policy no longer allows inline styles (`style-src 'self'`): former inline styles live in `assets/css/inline-styles.css` and page stylesheets under `assets/css/tools/`.
- Typing Speed Test: net WPM counts only words typed without an error (raw WPM and CPM are unchanged). Opt-in personal bests saved under the earlier scoring are labelled as such and replaced by the next result.
- README screenshots are WebP (712 KB → 119 KB).
- The home page title is now simply “Toolkit” in English and Turkish, including its Open Graph and Twitter titles.
- Copy buttons in the bytes, unit and checksum tools use delegated listeners instead of inline handlers.

### Fixed

- Fixed translation of implicit select-option values, including sitemap change-frequency values; Turkish labels no longer leak into generated XML.
- Made JavaScript, CSS and HTML shrinking conservative around operators, literals, selectors, raw-text elements and inline whitespace. JavaScript template/ambiguous-slash suffixes and CSS custom-property/URL suffixes remain unchanged rather than being damaged by regex rewrites.
- Rebuilt the simple YAML converter to preserve nested mappings and sequences, reject duplicate keys and unsupported syntax, and round-trip quoted keys and nested JSON data. Invalid JSON-to-CSV rows now produce a translated error and clear stale output.
- Fixed typing ledger replacement edits, IME de-duplication, timer start on rejected attempts, final unfinished-error review, first-render charts, per-key heat-map rates, locale-formatted results, stored/session best selection and empty-custom-practice quick start. Added live CPM and an in-run keyboard-reachable restart.
- Preserved the internal order of multi-word terms, idioms and code snippets; finite word targets may round up to finish an entry. Extra typed glyphs now render through attributes without inserting text nodes during typing.
- Kept the selected word-count preference separate from the actual length of idiom, custom-text and error-repeat runs, so completing a phrase no longer changes or clears the selected control on the next visit.
- Fixed the typing caret staying at the expected word ending when extra characters are entered; it now follows the last visible extra glyph and moves back correctly on deletion.
- Replaced unverified medical imports and generated vocabulary: all 1,300 English medical entries now match NLM MeSH 2026 descriptor names and IDs; the Turkish list is a 546-entry editorial clinical pool. Restored spaces in English place names, completed country labels, corrected district examples, and removed synthetic programming terms.
- Removed unsupported literary attributions, corrected cited works and several Turkish translations, and added edition-linked provenance plus a read-only primary-source audit. Structural checks are explicitly distinguished from linguistic certification.
- Added conversion and typing regression suites to CI, including three repetitions of key edge cases, all-category loading and a check for zero word-stream child mutations per keystroke.
- Rebuilt the Turkish common-word pool from reviewed vocabulary, removing generated compound forms and unrelated specialist padding; cross-checked replacements against official Ministry of National Education material and current TDK spelling.
- Fixed hidden feedback panels being exposed by component display rules, aligned the Base64 input/output columns, and corrected the legacy split layout so its decorative divider no longer pushes result panels onto a new row.
- Restored the HMAC Generator action by synchronising its button identifier with the module, and added browser and DOM-contract checks for primary actions, paired text areas, hidden states, and static module-to-page element references.
- Audited the full English/Turkish interface; corrected typing-test duration labels, metadata/Open Graph copy, encoding and conversion terminology, HTTP status text, and other inaccurate Turkish labels; and added a localisation audit for dictionary conflicts, title coverage, dynamic patterns, and form-control safety.
- Prevented the translation runtime from changing functional `<option>` and non-button `<input>` values, so Turkish UI text can no longer alter a tool's selected mode or stored input.
- Improved the typing-test quick-start flow, compact word stream, selected-option feedback, Turkish copy, mobile header spacing, and hidden-action behaviour.
- Limited the typing stream to exactly three visible lines on mobile, batched caret geometry in an animation frame, and cleared pending caret/refill frame state on restart so rapid typing and repeated runs stay responsive.
- Randomised custom-text, code-snippet, Turkish keyboard-lesson, weak-key, and error-repeat practice pools; daily challenges and exact restarts remain reproducible, while **New test** now prepares a fresh sequence.
- Kept the homepage category filters on one horizontally scrollable row, so longer Turkish labels no longer leave a single category stranded on a second line.
- Restored centered homepage category filters when they fit, while preserving left-aligned horizontal scrolling on narrow screens.
- Normalised word-list practice to locale-aware lowercase unless capitalisation is enabled, while retaining natural casing for quotes, code practice, and custom text.
- Added accessible names to remaining image, colour, URL, robots, timestamp, and generated-output controls; provided a shared keyboard-focus indicator; and made every tool page expose a semantic primary heading.
- Replaced the remaining exposed browser file picker with an accessible, translated SVG file-selection control.
- Corrected the typing-test reduced-motion override, completed the shared radius token set, aligned the security policy with opt-in aggregate typing records, and hid empty image-compression output until a result exists.
- Completed Turkish coverage for the Password Strength Checker’s live feedback, legacy form placeholders and accessible controls, and dynamic count/result readouts.
- Replaced the former PBKDF2-formatted placeholder in the Bcrypt Generator with standards-compatible bcrypt hashing and verification, checked against an independent known vector and generated-hash round trips.
- Made Base64, Base32, binary, and hexadecimal conversion UTF-8-safe; preserved grapheme clusters in character reversal and counting; corrected Turkish slug and case conversion; and made base conversion exact beyond JavaScript’s safe-integer limit.
- Guaranteed every selected password character class without replacement collisions and simplified cryptographically secure Base64 token generation.
- Prevented executable markup and unsafe URL schemes in Markdown previews, escaped decoded QR text and Wi-Fi fields, and verified Turkish plus supplementary Unicode QR round trips.
- Isolated generated user content from DOM translation and stopped Open Graph previews from automatically requesting user-supplied remote image URLs.
- Limited service-worker cleanup to stale `toolkit-*` caches so activation cannot delete unrelated GitHub Pages project caches on the same origin.
- The 404 page loaded no styles or scripts and linked to missing pages when GitHub Pages served it below a subdirectory.
- Tool search on the home page and in the command palette now matches the Turkish dotted capital İ; case-insensitive line de-duplication folds İ and i together.
- The command palette showed English descriptions for 38 tools in Turkish.
- Markdown preview: multi-column tables and numbered lists render, and code, link URLs and image alt text are no longer rewritten by emphasis rules.
- Base64 to Image enables Download after a successful preview.
- File Checksum always shows the most recently selected file, and its description no longer mentions MD5.
- Image Compressor releases the previous result's memory on each run.
- Password Strength no longer claims to check breach databases.
- Text Reverser's status message names the mode in the interface language.
- Typing Speed Test: with strict Turkish diacritics turned off, only the accent is forgiven (ç↔c, İ↔I, ı↔i, …); a wrong letter case now counts as a mistake, as it does in strict mode and English.
- Typing Speed Test: characters skipped by pressing Space early now lower accuracy instead of leaving it at 100%.
- UUID Validator accepts RFC 9562 versions 6–8 and the nil and max UUIDs, and no longer labels one RFC variant as two.
- URL Builder percent-encodes path segments without double-encoding existing escapes.
- XML Formatter keeps text-only elements on one line (their text is no longer changed) and no longer splits comments or CDATA that contain `>`.
- Removed an invalid `outline-radius` declaration that browsers reported as a CSS error on every page.

## [1.1.0] — 2026-08-13

### Added

- Expanded the catalogue from 78 to **100 browser-only tools**, including AES-GCM, RSA key pairs, TOTP, certificate inspection, CSP and cURL builders, a header analyzer, cron and Unix permission helpers, CSS calculators, JSON conversion tools, a CSV viewer, Unicode inspection, time-zone and date-duration utilities, image compression, a sitemap generator, and WCAG contrast checking.
- Added a global keyboard-accessible tool finder, opened with <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd>, plus an optional local-only recent-tools list.
- Added an English/Turkish client-side interface. English is the source and default language; an explicit language choice is persisted only in the visitor's browser.
- Added static site auditing and Firefox browser E2E coverage for the expansion-tool flows, desktop/mobile presentation, and language switching.

### Changed

- Renamed the public product to **Toolkit** and moved public repository and Pages references to `abel0x/toolkit`.
- Split the stylesheet into focused core, component, compatibility, page, and feature modules for easier maintenance.
- Centralised and regenerated tool navigation, static count copy, offline precache entries, and generated expansion-page shells through `build.py`.
- Completed Turkish coverage for shared interface text, tool descriptions, controls, placeholders, and dynamic result strings while leaving technical values such as algorithms and headers intact.

### Fixed

- Normalised shared footer behaviour and layout across existing and generated tool pages.
- Isolated browser E2E checks from service-worker precache timing so functional tests are deterministic.

## [1.0.0] — 2026-03-15

### Added

- **78 browser-based developer tools** across nine categories: Security & Crypto, Encoding & Decoding, JSON & Data, Text Tools, Web & URL, Image & QR, Code Tools, Converters, and Generators.
- A modular JavaScript architecture, with each original tool implemented in `assets/js/tools/*.js` as an IIFE module.
- A Service Worker for offline support, self-hosted fonts, locally vendored QR libraries, canonical and social metadata, responsive layouts, live search, category filters, a mega menu, and a PWA manifest.
- The stdlib-only `build.py` helper, a shared navigation partial, and browser smoke-test coverage.

[1.3.1]: https://github.com/abel0x/toolkit/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/abel0x/toolkit/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/abel0x/toolkit/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/abel0x/toolkit/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/abel0x/toolkit/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/abel0x/toolkit/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/abel0x/toolkit/releases/tag/v1.0.0
