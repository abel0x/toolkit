<div align="center">

<img src="assets/images/favicon-128.png" width="72" height="72" alt="Toolkit logo" />

# Toolkit

### 101 privacy-first developer utilities that run entirely in your browser.

[![Live site](https://img.shields.io/badge/Live%20site-abel0x.github.io%2Ftoolkit-00d4ff?style=flat-square&logo=github)](https://abel0x.github.io/toolkit/)
[![Tools](https://img.shields.io/badge/Tools-101-7c3aed?style=flat-square)](https://abel0x.github.io/toolkit/#tools)
[![License](https://img.shields.io/badge/License-Apache--2.0-10d97e?style=flat-square)](LICENSE)
[![Runtime](https://img.shields.io/badge/Runtime-Static%20%2B%20offline-10d97e?style=flat-square)](#privacy-and-offline)

**[Open Toolkit](https://abel0x.github.io/toolkit/)** · [Browse tools](https://abel0x.github.io/toolkit/#tools) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

</div>

---

## What it is

Toolkit is a static collection of developer utilities for the everyday work that should not require uploading data to a third party: encoding, cryptography, data conversion, text work, web inspection, image handling, and more.

- **Private by design.** Tool input is processed on-device with browser APIs such as Web Crypto, FileReader, Canvas, and `Intl`.
- **Offline after the first successful load.** The service worker precaches the published application so its tools remain usable without a network connection.
- **Fast to navigate.** Press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd> to search the full catalogue from any page.
- **Bilingual interface.** English is the default. Turkish is available from the language menu, and an explicit choice is remembered locally in that browser.
- **No accounts or telemetry.** There is no backend, analytics service, or tool-input persistence.

> A small amount of interface state can be stored locally: the selected language, optional recent-tool slugs, and typing-test preferences. Typing-test personal bests are opt-in, aggregate-only, and user-clearable; tool input, typed text, generated results, and uploaded files are not persisted by Toolkit.

## Tool catalogue

The live site is the complete, searchable catalogue of all 101 tools. The current distribution is:

| Area | Tools | Examples |
| --- | ---: | --- |
| Security | 14 | Passwords, SHA/HMAC, AES-GCM, RSA, TOTP, certificates |
| Encoding | 9 | Base64, Base32, URL, HTML, Hex, Binary |
| Dev Tools | 28 | JSON, CSV, XML, regex, cron, CSS, HTTP, WCAG contrast |
| Text Tools | 11 | Word count, typing speed, diff, Unicode, slug, find and replace |
| Generators | 9 | UUID, QR, gradients, colours, fake data |
| Converters | 10 | Timestamp, time zone, date duration, units, bytes |
| Web Utilities | 11 | URL, meta tags, CSP, cURL, HTTP headers, sitemap |
| Media | 9 | Image metadata, compression, SVG, QR reader, favicon |

### Latest release — 1.2.0

- **Typing Speed Test:** bilingual English/Turkish typing practice with time, word, quote, and zen modes; themed lists; Turkish diacritic support; accessibility controls; charts; and a keyboard error heat map.
- **Reusable word data:** `words/` provides 20 categories and 9,246 local entries for typing practice and future tools, with structural audits and reproducible primary-source checks for medical descriptors and literary excerpts.
- **Published license:** the Apache License 2.0 is available at [/license/](https://abel0x.github.io/toolkit/license/), from the navigation and for offline reading.
- **Brand refresh:** the new Toolkit artwork is used in the navigation, browser favicon, PWA icon set, and this README.
- **Example starters:** 40 frequently used tools provide a random, local “Try a sample” starter that immediately demonstrates the tool and remains fully editable.
- **Release hardening:** standards-based bcrypt, UTF-8-safe encoders, exact large-integer conversion, safe Markdown/QR rendering, pinned vendor licences, and a real service-worker offline test strengthen the full catalogue.

### Previous catalogue expansion — 1.1.0

The expansion from the original 78 tools added fully browser-based utilities for:

- **Security:** AES-GCM Encryptor, RSA Key Pair Generator, PEM / JWK Converter, Certificate Inspector, and TOTP Generator.
- **Web:** CSP Generator, cURL Builder, HTTP Header Analyzer, and Sitemap Generator.
- **Development:** Cron Expression Assistant, Unix Permissions, CSS Specificity and Clamp calculators, JSON to TypeScript, JSON to Markdown, XML to JSON, CSV Viewer, and Color Contrast Checker.
- **Everyday work:** Unicode Inspector, Time Zone Converter, Date Duration Calculator, and Image Compressor.

## Screenshots

<div align="center">

<img src="assets/images/Main.png" alt="Toolkit main landing page" width="100%" />

<p><strong>Main</strong> — a privacy-first landing page with direct access to the full toolkit.</p>

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="assets/images/Category.png" alt="Toolkit category browser" />
      <p align="center"><strong>Category</strong><br />Browse the catalogue by area.</p>
    </td>
    <td width="50%" valign="top">
      <img src="assets/images/Finder.png" alt="Toolkit keyboard tool finder" />
      <p align="center"><strong>Finder</strong><br />Find any utility with <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>K</kbd>.</p>
    </td>
  </tr>
  <tr>
    <td colspan="2" valign="top">
      <img src="assets/images/Password.png" alt="Toolkit password generator" width="100%" />
      <p align="center"><strong>Password</strong><br />A focused tool page with local-only password generation.</p>
    </td>
  </tr>
</table>

</div>

## Privacy and offline

Toolkit is hosted as static files on GitHub Pages. It has no application server, database, authentication, or API used to process tool input. The app uses local browser capabilities where possible:

| Need | Browser capability |
| --- | --- |
| Hashes, HMAC, AES-GCM, RSA | Web Crypto API |
| Files and image metadata | FileReader and browser file APIs |
| Image resize/compression | Canvas API |
| Time-zone rendering | `Intl` and browser locale data |
| Offline availability | Service Worker and Cache Storage |

Some tools use pinned, self-hosted vendor scripts for QR-code and bcrypt support; they are part of the published offline cache and do not call a third-party service. Their upstream licence texts are retained beside the distributions in `assets/js/vendor/`. QR generation uses the MIT-licensed QR Code Generator with its UTF-8 adapter, QR reading uses Apache-2.0-licensed jsQR, and bcrypt support retains its bundled upstream notices.

## Word lists

`words/` is a reusable bilingual data layer for local, themed typing practice. Consumers read `words/manifest.json` first and lazily load the selected list. To contribute a list, add its JSON file, register it in the manifest with an English source label, add the Turkish label to `assets/js/core/i18n-expansion.js`, and run `node tests/words-audit.mjs`. Lists must be neutral, appropriately licensed, NFC-normalised, and remain within the documented size budget.

The September 26 quality review removed synthetic expressions and unsupported quote attributions instead of retaining them to inflate list sizes. There are now 4,203 Turkish and 5,043 English entries. English medical terms retain exact NLM MeSH descriptor IDs; the 146 excerpts per language derive from 66 edition-matched base passages and explicitly labelled combinations. Turkish translations are editorial, not certified. See [word sources and verification](words/README.md) for the counts, licences, commands and limits of these checks.

## Run locally

There is no runtime build, package manager, bundler, or framework. A local HTTP server is enough:

```bash
git clone https://github.com/abel0x/toolkit.git
cd toolkit
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080). Serving over HTTP (instead of opening files directly) gives the browser access to the service worker and avoids file-origin restrictions.

## Deployment

The repository includes a GitHub Actions deployment workflow at `.github/workflows/deploy-pages.yml`. Every push to `main` and every manual workflow dispatch will:

1. refresh generated navigation, static tool counts, and the offline precache manifest;
2. run the static, localisation, accessibility, browser-function, and installed-offline audits; and
3. upload and deploy the verified static artifact to GitHub Pages.

To enable it once in GitHub, open **Settings → Pages**, choose **GitHub Actions** as the publishing source, then push or run **Deploy Toolkit to GitHub Pages** from the Actions tab. The deployment environment reports the resulting site URL; for this repository it is `https://abel0x.github.io/toolkit/`.

## Quality checks

The repository includes a small, dependency-free maintenance helper and static/browser checks. From the project root:

```bash
# Regenerate static navigation, visible tool-count text, offline entries, and word-list entries.
python3 build.py --nav --tool-count --offline --words

# Check published pages, references, assets, and tool metadata.
node tests/site-audit.mjs

# Check word-list schemas, references, normalisation, and payload budgets.
node tests/words-audit.mjs

# Repeat literal-preservation, nested conversion and invalid-input regressions.
node tests/conversion-regressions.mjs

# Test typing edits, composition, charts, records, every category and i18n in Firefox.
node tests/typing-regressions.mjs
# Optional: also run three real 60-second tests at a steady 60 WPM.
TYPING_TIMING=1 node tests/typing-regressions.mjs
# Optional: use a locally installed Chromium/headless-shell binary instead.
CHROMIUM_BINARY=/absolute/path/to/chrome node tests/typing-regressions.mjs

# Guard audit fixes: Turkish İ search and folding, palette copy, Markdown parsing, Base64 image, checksum ordering, blob cleanup, and CSP-safe copy buttons.
node tests/audit-regressions.mjs

# Check Turkish dictionary integrity, dynamic patterns, title coverage, and form-control safety.
node tests/i18n-audit.mjs

# Check semantic landmarks, label references, focus-order hazards, live regions, and token contrast.
node tests/accessibility-audit.mjs

# Smoke-test all 101 tool pages in Firefox across desktop and mobile layouts, including Turkish switching, accessible control names, and example starters.
node tests/tool-pages-e2e.mjs

# Exercise expansion tools, cryptographic vectors, UTF-8 conversions, QR round trips, safe rendering, homepage layout, and typing-test practice flows in Firefox.
node tests/expansion-e2e.mjs

# Install the real service worker under the GitHub Pages path, stop the server, and verify the cached site in Firefox.
node tests/offline-e2e.mjs
```

The browser checks start and stop their own local server and require a current Firefox installation. The offline suite installs the real service worker under `/toolkit/`, takes its server down, then verifies cached tools, word lists, vendor assets, the licence page, cache isolation, and the 404 fallback. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor workflow.

## Project layout

```text
toolkit/
├── index.html                    # Hub, filters, and tool catalogue
├── tools/                        # 101 individual static tool pages
├── words/                        # Reusable bilingual word-list data
├── _includes/_nav.html           # Shared navigation source
├── assets/
│   ├── css/
│   │   ├── core.css              # Tokens, reset, base rules
│   │   ├── components.css        # Shared controls and components
│   │   ├── compatibility.css     # Legacy tool compatibility rules
│   │   ├── pages/                # Home and tool page layouts
│   │   └── features/             # Feature-specific styles
│   ├── js/
│   │   ├── core/                 # Navigation, i18n, metadata, finder
│   │   ├── pages/                # Page-specific controllers
│   │   ├── tools/                # Tool implementations
│   │   └── vendor/               # Self-hosted browser libraries
│   ├── fonts/                    # Self-hosted fonts
│   └── images/                   # Project icons and screenshots
├── tests/                        # Static audit and browser E2E checks
├── build.py                      # Repeatable maintenance tasks
├── sw.js                         # Offline cache worker
└── sitemap.xml                   # Published URL index
```

### Localisation model

English source text lives in the HTML and JavaScript source. `assets/js/core/i18n.js` supplies the runtime and shared translations; `assets/js/core/i18n-expansion.js` contains the larger Turkish catalogue for tool pages and expansion controls. New visible copy must have a Turkish translation before it is merged. The selected language is read from and written to `localStorage` only after a user changes it.

## Contributing

Toolkit accepts focused improvements that keep the following promise intact: local processing, offline usability, clear accessibility, and no external application dependency. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and [SECURITY.md](SECURITY.md) for responsible disclosure guidance.

## License

Copyright © 2024–2026 abel0x. Toolkit is licensed under the [Apache License 2.0](LICENSE). The published copy is available at [/license/](https://abel0x.github.io/toolkit/license/).

<div align="center">

Built with HTML · CSS · Vanilla JavaScript · Web Crypto API

[GitHub](https://github.com/abel0x/toolkit) · [Buy me a coffee](https://buymeacoffee.com/abel0x)

</div>
