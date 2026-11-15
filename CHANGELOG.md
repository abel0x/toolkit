# Changelog

All notable changes to Toolkit are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and releases follow [Semantic Versioning](https://semver.org/).

## [1.9.2] — 2026-11-15

Fixes and speed-ups for the new tools, after measuring them with large inputs.

### Fixed

- **PDF Page Editor:** opening another PDF while page previews were being drawn left the old file's previews in memory and never previewed the new one. A preview run now stops as soon as another file is opened. A file that fails to open no longer replaces the bytes of the one on screen.
- **Image Converter:** Safari on iPhone and iPad cannot draw canvases above about 16.7 megapixels and returns blank ones. Larger images are now tried at full size and, where the browser cannot draw them, worked on at the largest size it can, with a note saying so; an output that is too large is refused with the largest size that would work.
- **PDF Merger and PDF Page Editor:** encrypted PDFs that open without a password but carry an owner password (common for statements and official documents) now get an explanation and a way out: print them to a new PDF first.

### Changed

- **PDF Page Editor:** page previews update one sheet at a time instead of redrawing the whole grid; 500 pages now take about half as long.
- **JSONPath Tester, JSON Schema Generator, CSV / JSON to SQL and HTML to Markdown:** the parsed input is kept while queries, table names and options change, and inputs over 200 KB are processed after a pause in typing. With a 3.8 MB document a keystroke in the JSONPath query now blocks the page for about 1 ms instead of 73 ms; typing a table name over 50,000 CSV rows no longer re-reads them.

### Tests

- Known answers for opening a second PDF during previews, an owner-password PDF, a browser with a canvas limit (simulated), and large CSV input that waits for a pause.

## [1.9.1] — 2026-11-15

Page previews in the PDF Page Editor, and up-to-date descriptions.

### Added

- **Page previews in the PDF Page Editor**, on request: "Show page previews" draws every page with pdf.js 6.5.438 (Apache-2.0, self-hosted and pinned). pdf.js is downloaded only when previews are asked for, is not part of the install-time cache, and is kept by the service worker after its first use, so previews then work offline too. Previews turn with the pages.

### Changed

- The home page, its Turkish twin and the web app manifest describe the current catalogue (images, PDFs, CSS generators and more); the manifest's tool count is now kept in step by `build.py --tool-count`.
- README: what the project covers, and the pdf.js note among the self-hosted libraries.

### Tests

- Known answers for the previews in Firefox and Chromium: pdf.js is not fetched before it is asked for, every page is drawn (checked by pixel), previews turn with the page and no warning is shown. The test servers serve `.mjs` files as JavaScript.

## [1.9.0] — 2026-11-15

Fifteen new tools bring the catalogue to 119.

### Added

- **IP Subnet Calculator**: IPv4 and IPv6 networks from CIDR or a mask (network, broadcast, wildcard, usable hosts, address type, reverse DNS zone), splitting into smaller networks, address ranges to CIDR blocks, and an "is this address inside?" check.
- **JSONPath Tester**: JSONPath as standardised in RFC 9535, including filters and the length(), count(), match(), search() and value() functions; values, normalized paths or both.
- **JSON Schema Generator**: draft 2020-12 or draft-07 schemas from one or several samples, with merged array items, nullable values, required keys and formats.
- **JWT Signer**: HS256/384/512, RS*, PS*, ES* and EdDSA tokens from a secret or a PKCS #8 / JWK private key, iat and exp in one click, and test key pairs.
- **HTML to Markdown**: CommonMark with GitHub tables, task lists and fenced code; formatted text pasted from a page or a document arrives as HTML.
- **CSV / JSON to SQL**: INSERT statements and a CREATE TABLE with inferred types for PostgreSQL, MySQL, SQLite and SQL Server, with batching, NULLs and transactions.
- **TOML / JSON Converter**: TOML 1.0 both ways, checked against the official toml-test suite (all valid and invalid TOML 1.0 cases a browser can see), 64-bit integers and dates kept.
- **Dotenv Checker**: reads .env files as dotenv does and flags what breaks shells, Docker and Compose; compares with .env.example; values hidden by default.
- **Box Shadow Generator**, **Border Radius Generator** (with organic blobs), **Flexbox Playground** and **CSS Grid Generator** (named areas checked for mistakes).
- **Image Converter**: PNG, JPEG, WebP and (where the browser can encode it) AVIF; SVG to PNG at any size; cropping by dragging or by numbers with common ratios; rotate, flip and exact resizing.
- **PDF Merger** and **PDF Page Editor**: merge PDFs with page ranges; rotate, delete, reorder, extract and split pages (single pages, every N pages or ranges, as a ZIP). They use a self-hosted, pinned copy of pdf-lib 1.17.1 (MIT).

### Changed

- Example starters can set checkboxes.

### Tests

- Known answers for every new tool, including RFC 9535 and RFC 5952 examples, signatures verified with Web Crypto and Node's crypto, pixel checks of converted images and page-by-page checks of generated PDFs; `VECTORS_ONLY` runs the known answers of chosen tools.

## [1.8.10] — 2026-11-15

A new tool, Port Reference, brings the catalogue to 104 tools.

### Added

- **Port Reference** (Dev Tools): about 130 common ports and the services behind them (SSH, DNS, mail, databases, VPNs, Docker and Kubernetes, dev servers such as Vite, Angular and Jupyter, games), searchable by number or name and filtered by kind; ranges such as IRC 6665–6669 match any port inside them.
- Typing a port number explains it: its IANA range (system, user or dynamic), whether Linux and BSD need root to listen on it, whether Linux, Windows or macOS use it for outgoing connections, and whether browsers refuse it (the Fetch standard's 83 bad ports).
- A web page cannot see which ports are open on the computer, so the page says so and gives the Linux, macOS and Windows commands to check that port.

### Tests

- Known answers for PostgreSQL on 5432, root and browser blocking on 22, a port inside the IRC range, the dynamic range and outgoing-connection ranges, an out-of-range number, search by name, the category filter and the bad-port list.

## [1.8.9] — 2026-11-15

The Image Metadata Viewer signs images and checks their signatures.

### Added

- **Sign and verify** in the Image Metadata Viewer: create a signing key (ECDSA P-256, made in the browser and saved as a file you keep), or load a saved one, then download a signed copy of a JPEG or PNG. The signature covers the picture data, the signer's name, the time and the public key, and is stored in the EXIF user comment.
- Opening a signed image checks it at once: it shows the signer, the time and the key fingerprint, or says that the picture changed after it was signed. Editing the metadata with the tool keeps the signature valid; re-saving or editing the picture breaks it, and removing the metadata removes it.

### Tests

- Known answers for the key file, the fingerprint shown, the signed copy's name, the check on opening it, a signature that stays valid after a metadata edit, a changed byte in the picture reported as changed, and a cleaned file with no signature.

## [1.8.8] — 2026-11-15

The Image Metadata Viewer writes metadata too, and cleans many images at once.

### Added

- **Edit metadata** in the Image Metadata Viewer: write a description, author, copyright, the date taken and a location (keep the one in the file, remove it, or set new coordinates) into a copy of a JPEG or PNG. The form starts from what the file says; camera, lens and exposure details, the orientation and the software already in the file are kept; the picture data is copied unchanged. A new EXIF block replaces the old one (other blocks such as the colour profile stay).
- **Remove metadata from several images**: choose JPEG, PNG and WebP files and get them back cleaned, losslessly, in one ZIP.

### Tests

- Known answers for the editor's starting values, the written description, author and copyright, a new location (with a decimal comma), the kept camera details and orientation, and a three-file cleaning ZIP; an axe state with an image loaded. A Pillow check during development read every written field back.

## [1.8.7] — 2026-11-15

The Image Compressor handles several images at once and can aim for a file size.

### Added

- **Image Compressor** takes several images at once (chosen or dropped), with a maximum width and height, quality, JPEG, WebP or PNG output (and AVIF where the browser can encode it), and an optional target size in KB: it finds the highest quality that fits and shrinks the image when even the lowest does not, saying when the target cannot be reached. Each result shows the old and new size and dimensions with the saving, has its own download and a before and after slider, and several results download together as a ZIP. Images are read on the device; the copies carry no EXIF metadata or location.

### Tests

- Two 800 × 600 images under a 300 px height limit and a 20 KB target, their file names, the ZIP button and the before and after slider.

## [1.8.6] — 2026-11-15

The Favicon Generator makes a complete favicon set.

### Added

- **Favicon Generator** works from a letter or emoji, or from your own image (fit inside or fill), with a square, rounded or circle shape and an optional transparent background. It draws 16, 32 and 48 px icons, the 180 px Apple touch icon (always opaque, as iOS needs), and the 192 and 512 px Android and PWA icons; saves a multi-size `favicon.ico`, a `site.webmanifest` with your app name and theme colour, and the HTML that links them; and downloads everything as one ZIP. The image is read on the device and never uploaded.

### Changed

- The ZIP writer the QR Batch Generator introduced is now a shared module, `assets/js/core/zip.js`, precached for offline use.

### Tests

- Known answers for the ICO directory (16, 32 and 48 px PNG images), the manifest, the ZIP's nine files, the HTML snippet, an image filling the icon, a transparent circle's empty corner and the always-opaque Apple icon.

## [1.8.5] — 2026-11-15

A new Country Time Zones tool.

### Added

- **Country Time Zones** (tool 103): pick any of 247 countries and territories (names in English or Turkish, from the browser) and see each of its time zones with the region it covers, the local time now, the UTC offset and abbreviation, whether daylight saving is used and in effect, and the date and new offset of the next clock change. It lists the other countries that share the offset right now, and converts a date and time in any time zone into the country's zones, UTC and this device's zone. Zones come from the IANA tz database 2026f (public domain); offsets and daylight saving rules come from the browser.

### Changed

- The offline copy also stores tool data under `assets/js/data/`.

### Tests

- Known answers for offsets (Istanbul, New York in winter and summer, India, Nepal, Newfoundland), the 2026 US clock change on 8 March at 07:00 UTC, Istanbul noon in UTC, and the tool's tables for the United States and Türkiye.

## [1.8.4] — 2026-11-15

A new Credit Card Validator.

### Added

- **Credit Card Validator** (tool 102): type or paste a card number and see its network (Visa, Mastercard, American Express, Troy, and Discover, JCB, Diners Club, UnionPay, Maestro and Mir), whether the length suits that network, whether the Luhn check digit is right (and which digit would be), the industry digit, the issuer number (BIN) and the account part, the expiry date and the security code length (four digits on the front for American Express). The number is checked on the device only: it is never sent, saved or put in a share link.
- The page says plainly what a number cannot tell: whether the card exists, works or has funds, which bank issued it (that needs a BIN database), or an American Express "Member since" year, which is printed on the card and is not part of the number.

### Tests

- Known answers for every network's prefixes, the Luhn check, a mistyped digit, American Express grouping and security code, an expired date and Troy's national industry digit. The browser smoke suite now takes the tool count from the catalogue.

## [1.8.3] — 2026-11-14

Six tools that overlapped with another one now do something of their own.

### Added

- **JSON Validator** checks JSON against a JSON Schema you paste beside it (draft 2020-12 and draft-07 keywords: types, required and additional properties, patterns, formats, numbers and lengths, arrays, `$ref` and `$defs`, `allOf`/`anyOf`/`oneOf`/`not`, `if`/`then`/`else`) and lists every problem with its JSON path.
- **JSON Minifier** accepts JSON with comments and trailing commas (JSONC, as in `tsconfig.json` and editor settings) and can escape non-ASCII characters.
- **Open Graph Tag Generator** previews the link the way Facebook, X, LinkedIn and WhatsApp show it, with a local image of your choice (never uploaded; remote images are still not loaded), and checks the title and description length, an HTTPS image URL and the 1200 × 630 image size.
- **Find and Replace** runs a list of rules in order, each on the result of the one before, and shows how many each one replaced.
- **Image Metadata Viewer** reads EXIF from JPEG, PNG and WebP: camera and lens, exposure, aperture, ISO, date, orientation, author, and the GPS location with a warning and an OpenStreetMap link; XMP, IPTC, ICC profiles, comments and PNG text are listed too. "Download without metadata" saves a copy with all of it removed and the picture data untouched (no re-compression); a JPEG keeps only its orientation.
- **QR Batch Generator** downloads all codes as one ZIP, takes "name, value" lines whose names become the file names, and offers 300, 500 and 1000 px sizes.

### Fixed

- Find and Replace counted capture groups as matches when "Global replace" was off, and its Turkish count message was never translated.
- The Image Metadata Viewer wrote its results as a table inside a table.
- The drop zones of the Image Metadata Viewer, Image to Base64 and Image Dimension Checker did not open with Enter or Space; every element with `role="button"` now does.
- The QR Batch Generator's single downloads could be cancelled because the link was revoked at once.

### Tests

- `tests/tool-vectors.mjs` checks 54 tools with 237 known answers, including a schema with six kinds of problem, JSONC, rule lists, the Open Graph checks with a local 1200 × 630 image (and no request to the image URL), EXIF from a Pillow-made JPEG and its cleaned copy, and the QR ZIP's file names. The axe audit adds the schema problem list and a second replace rule.

## [1.8.2] — 2026-11-14

Every tool is now named and described in one place, and every description says what the tool does today.

### Changed

- `_data/tools.json` is the only source of a tool's name and descriptions. Its `name` goes into the page title, the `<h1>`, the breadcrumb and the home page card; `desc` into the line under the `<h1>`, the home page card and the tool finder; and a new `meta` field (or `desc`) into the meta, Open Graph, Twitter and JSON-LD descriptions. Until now a tool could be described four different ways, and 41 home page cards differed from the catalogue.
- Twelve tools that had two or three names now have one, for example "YAML to JSON Converter", "JSON Key Sorter", "CSS Unit Converter", "Query String Parser and Builder" and "File Checksum".

### Fixed

- Descriptions that promised what a tool does not do: EXIF and GPS in the Image Metadata Viewer, URLs in the Image Dimension Checker, uploaded images and many sizes in the Favicon Generator, sorting by value in the JSON Key Sorter, "diverse datasets" in the Random Name Generator, percentages in the CSS Unit Converter, and redundant declarations and unused attributes in the CSS and HTML minifiers.
- Descriptions that missed what a tool does: SHA-384 in the HMAC Generator, Rankine and Réaumur in the Temperature Converter, passphrases in the Password Generator, signature checks in the JWT Decoder, and the features added in 1.8.0 and 1.8.1 (Text Diff, JSON Formatter, Regex Tester, Markdown, SQL, YAML, CSV, Text Sorter, Case Converter, Color Converter, Base64, URL Parser, Password Strength).
- The ASCII Converter and Slug Generator descriptions had no Turkish translation.

### Tests

- `tests/site-audit.mjs` checks that every tool page's title, `<h1>`, breadcrumb, description line and meta tags, and its home page card, match the catalogue.

## [1.8.1] — 2026-11-14

Bug fixes from a review of all 101 tools, each tried with real-world and edge-case input.

### Fixed

- **SQL Formatter** split `'it''s'` into `'it' 's'` and squeezed the spaces inside strings, which changed the query. It now reads strings, quoted names and `--` / `/* */` comments exactly, upper-cases every keyword, indents subqueries and `AND`/`OR`, and keeps `BETWEEN … AND` on one line.
- **YAML to JSON** refused most real files. It now reads `[a, b]` and `{k: v}` with plain values, `|` and `>` multi-line text, anchors, aliases and `<<` merges, `0o`/`0x` numbers, comments, several documents, and errors name the line.
- **CSS Minifier** stopped at the first custom property or `url(...)` and never removed the spaces around `{ } : ; , >`. It now minifies the whole file, keeping strings, `calc()`, `url()` and `a :hover` intact.
- **JavaScript Minifier** stopped at the first regular expression, division or template literal. It now handles all three and removes the whitespace a statement does not need; every script in this project still parses after minifying (about 20% smaller).
- **HTML Minifier** stopped at `<!DOCTYPE>`. It now minifies whole documents, compacts `attr = "x"`, and a new option collapses whitespace in text (`<pre>`, `<textarea>`, scripts and styles are kept).
- **Number Base** left the previous number's conversions on screen when the input was invalid (such as `12.5`). It clears them and says which digits the base takes; `0x`/`0b`/`0o` prefixes and grouped digits (`1111 0000`) are accepted.
- **Color Converter** accepted only `#rrggbb`. It now reads `#rgb`, `#rgba`, `#rrggbbaa`, colours without `#`, `rgb()`/`rgba()`, `hsl()`/`hsla()` and CSS colour names, carries the alpha into every format and says when it cannot read a colour.
- **Base64** decodes the URL-safe alphabet (`-`, `_`), missing `=` padding and line breaks, and can encode URL-safe output.
- **Hex Codec** kept the old result after an error; it also reads `0x48, 0x65`, `\x48` and `48:65`.
- **Timestamp** showed the year 55840 for a millisecond value in seconds mode. 13, 16 and 19 digits are read as milliseconds, microseconds and nanoseconds, and the result says so.
- **Case Converter** lowered `İ` and `I` by the interface language instead of the text's: `İSTANBUL` became `i̇stanbul` on English pages. A Text language choice (automatic by default) fixes it. `XMLHttpRequest` and `userID` are split into words, and CONSTANT_CASE is added.
- **Remove Duplicate Lines** did not treat `IŞIK` and `ışık` as the same line.
- **Text Sorter** sorted Turkish words in English order (`şeker` before `su`) and put `file10` before `file2`. It now uses the Turkish alphabet when the text is Turkish (or when chosen) and natural number order; numerical sort puts lines without a number last.
- **CSV to JSON** read semicolon CSV (what Excel saves in Turkish) as one column. The delimiter is detected, or can be chosen.
- **Password Strength** only knew ten common passwords. It now spots a common English or Turkish word or name with characters added (`Galatasaray1905`, `P@ssw0rd!`), keyboard and number runs (`qwerty`, `1qaz2wsx`, `fgğıod`), repeats and a year at the end, and says which.
- **Favicon Generator**'s HTML snippet held a cut-off data URL and a `favicon-192.png` it never made; it now links the three files it downloads. Emoji such as 🇹🇷 are no longer cut in half.
- **URL Parser** shows the username and password, the host in Unicode for `xn--` names and the decoded path.

### Tests

- `tests/tool-vectors.mjs` checks 50 tools with 213 known answers, including every fix above; the tool count is now counted, not written by hand. `tests/conversion-regressions.mjs` covers the new YAML, CSS and HTML behaviour.

## [1.8.0] — 2026-11-14

Four tools grow up (Text Diff, JSON Formatter, Regex Tester, Markdown Previewer), and every page now passes an automated accessibility audit.

### Added

- **Text Diff:** "Ignore whitespace" and "Ignore case", a Unified / Side by side switch, line numbers on both sides, and the changed words marked inside each changed line. Large texts no longer freeze the tab: the common start and end are set aside first, and a comparison that is still too big says so.
- **JSON Formatter:** indent of 2 spaces, 4 spaces or a tab, and a Text / Tree switch. The tree opens two levels, draws deeper levels and long arrays (200 items at a time) when you open them, works with the keyboard, and has Expand all and Collapse all.
- **Regex Tester:** "Replace with" and a live result, with `$1`, `$<name>` and `$&`; without the `g` flag only the first match is replaced, as in JavaScript. The result can be copied or downloaded. The `d` and `v` flags are accepted.
- **Markdown Previewer:** "Download HTML" saves the preview as a standalone page, titled and named after the first heading.
- **Accessibility audit:** CI runs axe-core 4.14 on all 209 English and Turkish pages, on desktop and a phone, and with the tool finder and keyboard shortcuts open, and fails on any WCAG 2.2 A/AA or best-practice violation.

### Fixed

- The Markdown editor and preview sit side by side again; since 1.7.4 the "Open file" button had pushed the editor to the right and the preview below it.
- The JSON Formatter did nothing with `0`, `false`, `null` or `""`, which are valid JSON.
- The QR Code Reader's drop zone opens the file picker with Enter and Space.
- Text that was too faint is easier to read: Meta Tags counters, the Open Graph preview address, User Agent and URL Parser labels and the 404 footnote. Random Color and Color Palette write each colour's code in black or white, whichever reads better on it.
- Screen readers hear the visible text in every button name (the Esc buttons, the timestamp's ms button, the file drop zones), the copy columns in Bytes and Unit Converter have a header, and six tools no longer skip a heading level.
- The password show/hide button is easier to tap, the licence text can be scrolled with the keyboard, and the Turkish Regex Tester no longer has two regions with the same name.
- Random Color's hue and saturation fields show 360 and 100 in full.
- Success and error toasts were almost transparent, so over a light button their text could not be read; they are opaque now. The Random Token Generator no longer greets every visit with a "1 token generated!" toast.

### Tests

- `tests/axe-audit.mjs` (318 page states, including a success and an error toast over a light button). `tests/tool-vectors.mjs` checks 44 tools with 173 known answers, including both diff views, the JSON tree, regex replacement and the Markdown HTML file. The tool-page suite fails when a file or copy button row lands inside a side-by-side layout, and the audit regressions press Enter and Space on the QR drop zone.

### Documentation

- The README keeps only the last three releases and links to this changelog. README, CONTRIBUTING and SECURITY describe the privacy page, the update notice, the axe audit and the `.field-actions[data-for]` hook.

## [1.7.6] — 2026-11-14

A privacy page that says exactly what stays in your browser, and a notice when a new version is ready.

### Added

- **Privacy page** (English and Turkish), linked from every footer next to "No data leaves your device.": no accounts, cookies, analytics, ads or tracking; each item Toolkit keeps in your browser by name (language, recent tools, the Typing Speed Test's options and opt-in records, the redirect note) and the offline copy; what happens to text, files, the camera, the clipboard and share links; and what the website host, GitHub Pages, can see.
- **"A new version of Toolkit is ready."** When a newer release takes over a page you have open, a notice offers Reload. It never reloads by itself, so nothing you typed is lost, and it stays quiet on your first visit or when the page is already up to date. A tab left open looks for a new release when you come back to it, at most once an hour.

### Tests

- `tests/site-audit.mjs` checks that the privacy page lists exactly the storage keys the scripts use and that every footer links it.
- `tests/offline-e2e.mjs` publishes a pretend next release to the installed site: the notice appears, Reload reloads, and neither the first install nor a worker of the page's own release shows it.
- The privacy pages join the layout, accessibility, Turkish and offline checks.

## [1.7.5] — 2026-11-14

Six tools learn something new: check a JWT's signature, scan a QR code with the camera, MD5, UUID v7, passphrases and OKLCH.

### Added

- **JWT Decoder** checks the signature: paste the secret for HS256/384/512, or the public key as PEM, JWK or JWKS (the token's `kid` picks the key) for RS, PS and ES 256/384/512 and EdDSA. Unsigned tokens (`alg: none`) are flagged, and an HMAC token checked against a public key is refused, a known attack. Everything runs in your browser.
- **QR Code Reader** scans with the camera: it prefers the rear camera, reads about five frames a second, stops as soon as it finds a code or when you leave the tab, and keeps every frame in the browser.
- **Hash Generator** and **File Checksum** compute MD5, marked legacy, to compare published checksums.
- **UUID Generator** makes version 7 UUIDs (RFC 9562): time-ordered, so a batch comes out in ascending order. **UUID Validator** shows when a v7 UUID was created.
- **Password Generator** has a Words mode for passphrases from English or Turkish word lists, with separator, capitals and a digit; the strength meter now shows the bits.
- **Color Converter** shows OKLCH and HWB next to HEX, RGB and HSL.

### Fixed

- The JWT Decoder showed letters such as Ç or ş in claims as garbled text; header and payload are now read as UTF-8.
- The UUID Generator's link-preview description was cut off and appeared in English on the Turkish page.
- The SHA-1 warning in the Hash Generator had no Turkish text.

### Tests

- `tests/tool-vectors.mjs` now checks 41 tools with 149 known answers, including 15 JWT cases signed by Node's own crypto (valid keys of every family, wrong keys, a tampered payload, `alg: none` and the HMAC/public-key confusion), RFC 1321 MD5 vectors, ordered v7 UUIDs, OKLCH against CSS Color 4 values, passphrases, and a QR code shown to the camera as a canvas stream.

## [1.7.4] — 2026-11-14

Open files straight into the tools, and copy or download every result.

### Added

- "Open file" on 33 text fields in 31 tools, and a file dropped onto the field works too: the JSON, YAML, CSV, XML, SQL, CSS/JS/HTML, Markdown, text diff and line tools, plus JSON to TypeScript and Markdown, XML to JSON, CSV Viewer, AES-GCM, PEM/JWK, Certificate Inspector, HTTP Header Analyzer and Sitemap Generator. Files are read as text in your browser and never leave it; files over 5 MB are refused.
- Download on 22 results, with a fitting file name: `formatted.json`, `data.yaml`, `data.json`, `sorted.json`, `formatted.sql`, `formatted.xml`, `minified.html`/`.css`/`.js`, `types.ts`, `table.md`, `public-key.pem`, `private-key.pem` and the text tools' `.txt` files.
- Copy on the 18 results (in 17 tools) that had none: JSON to TypeScript and Markdown, XML to JSON, AES-GCM, both RSA keys, Certificate Inspector, Sitemap, TOTP code, HTTP header report, cron runs, Unix symbolic mode, CSS specificity and clamp, Unicode, time zones, date duration and colour contrast.

### Changed

- The new buttons sit next to an existing Copy button in its style, or to the right of the field's label, without moving fields that stand side by side. Expansion tools leave space between their run button and the next field.

### Tests

- New `tests/tool-io-e2e.mjs` (in CI) drops and opens files into every field that takes them, including the 5 MB limit, and checks that every Copy and Download hands over the exact result under the configured name, in English and Turkish.

## [1.7.3] — 2026-11-14

A lighter home page, clearer names for screen readers and voice control, and an up-to-date bcrypt.

### Changed

- The bcrypt tool uses bcryptjs 3.0.3 (was bcrypt.js 2.4.3). New hashes start with `$2b$`, like other current implementations; `$2a$` and `$2y$` hashes still verify, and known test vectors give the same results as before. The GitHub Advisory Database lists no advisories for any of the three bundled libraries; the QR generator and jsQR were already on their latest releases.
- The home page lists all 101 tools in its HTML and no longer loads the tool catalogue up front (the finder loads it when it opens, as on tool pages), English pages skip the translation pass they never needed, and off-screen cards are laid out only as they come into view. On a phone-speed CPU the home page does about a fifth less work, and its script time drops from 90 to 35 ms; Lighthouse moves from 94 to 100.

### Fixed

- The bcrypt tool now warns when a password is longer than 72 bytes: bcrypt ignores the rest, and letters such as ğ count twice.
- On phones the QR generator's options no longer jump down after the page loads (layout shift 0.061 → 0.003).
- Buttons say what they show: "Find tools", "Language: English", the "Esc" close buttons and Timestamp's "s"/"ms" now carry their visible text in their accessible names, so voice control and screen readers match what is on screen.
- 18 labelled areas in 14 tools (results, previews, tables) get a role, without which screen readers dropped their names.
- The licence text is 12 px on phones (was 11.2 px).

### Tests

- `tests/accessibility-audit.mjs` rejects a labelled element without a role and a control whose name leaves out its visible text; `tests/shortcuts-share-e2e.mjs` checks the same for controls built by script.
- `tests/tool-vectors.mjs` checks bcrypt against OpenBSD/jBCrypt vectors under every prefix, the `$2b$` default and the 72-byte warning.
- `tests/audit-regressions.mjs` checks that the home page leaves the catalogue to the finder; `tests/site-audit.mjs` pins the new library's checksum.

## [1.7.2] — 2026-11-14

Every tool now has an icon of its own.

### Changed

- 30 tools get a new icon, so no two of the 101 tools share one any more. Before, Hash, Hex and Number Base all showed "#", JSON Diff and Text Diff a bar chart, Binary Text and Bytes a monitor, and the image tools the same picture; a few more pairs (two globes, two targets, two tables, two database cylinders) looked alike. The new icons say what each tool does: "0x" for Hex, an abacus for Number Base, ".*" for Regex, tally marks for the Word Counter, a gauge for Password Strength, an ID card for UUID, a drive for Bytes, and more.
- The home page cards now take their icons from `_data/tools.json` when the site is built, so they can no longer drift from the tool pages.

### Tests

- `tests/site-audit.mjs` fails when two tools share an icon or a home page card shows another icon than the catalogue; `tests/shortcuts-share-e2e.mjs` checks that all 101 home cards show different icons.

## [1.7.1] — 2026-11-14

Every tool has its own icon, "?" lists the keyboard shortcuts, and ten tools can be shared as a link.

### Added

- "Copy link" on ten tools whose input is worth passing on: Regex Tester, Cron Expression Assistant, JSON Diff, Text Diff, cURL Builder, CSP Generator, JSON Formatter, SQL Formatter, CSS Specificity Calculator and JSON to TypeScript. The link carries the current input in its `#share=` fragment, which browsers never send to a server; opening it fills the tool and runs it. Links that are broken, too long or meant for another tool change nothing, and the input is only ever put into the fields as text. Tools whose input is usually a secret (keys, tokens, passwords) have no share link.
- "?" opens a list of the keyboard shortcuts the page answers to: Ctrl/Cmd + K, "/" on the home page, Ctrl/Cmd + Enter on tool pages, Esc and "?". A "Keyboard shortcuts" button in the footer opens it too. It never opens while you type in a field.

### Changed

- The 22 tools that shared one placeholder icon (AES-GCM, RSA, PEM/JWK, certificates, TOTP, CSP, cURL, HTTP headers, cron, Unix permissions, CSS specificity and clamp, JSON to TypeScript and Markdown, XML to JSON, CSV viewer, Unicode, time zones, date duration, image compressor, sitemap, colour contrast) each have their own, on the home page, in the tool header and in related-tool rows.

### Tests

- New `tests/shortcuts-share-e2e.mjs` (in CI) presses real keys in Firefox: "?" on the home, tool, licence, 404 and Turkish pages with focus and Esc checks, never while typing; shares each of the ten tools and reopens it from the link; refuses ten kinds of broken or hostile links and keeps markup as plain text; and checks that no request carries the shared input. It also checks that all 101 home cards have an icon.
- `tests/site-audit.mjs` checks the share buttons against `_data/tools.json`, that the new icons are unique, and that every core script a page loads is available offline.

## [1.7.0] — 2026-11-14

Every tool now leads to the next one.

### Added

- Every tool page ends with a row of four related tools and a link to the rest of its category ("Related … All security tools →"; on the Turkish pages "İlgili … Tüm güvenlik araçları →"). The four were picked by hand for all 101 tools and live under `related` in `_data/tools.json`; `build.py --related` writes the row, and a future tool without the list gets the tools that share most of its tags. The row is plain links, so it adds no script, and the category link always has a line of its own so every page shows it the same way.

### Fixed

- On phones the breadcrumb squeezed its items instead of wrapping, so on 47 Turkish tool pages and on Random Number Generator "← All Tools", the category and the tool name each broke over two lines. It now wraps between items.

### Tests

- `tests/tool-pages-e2e.mjs` measures every tool page in English and Turkish at 1440 px and 390 px: the header, breadcrumb and related-tools row share one column, the row sits between the tool and the footer, its links stay inside it on one line without overlapping, the category link has its own line, no breadcrumb item breaks, and nothing scrolls sideways.
- `tests/site-audit.mjs` checks that every English and Turkish tool page has one labelled related-tools row linking the four tools from `_data/tools.json` and its category.

## [1.6.7] — 2026-11-14

More tools show what they do in one click, every tool runs from the keyboard, and the Turkish "page not found" page is finally Turkish.

### Added

- "Try a sample" on 24 more tools, 64 in all: the JWT decoder, HMAC, Timestamp, Number Base, Case Converter, Hex, HTML and Binary codecs, Color Converter, Text Cleaner, Deduplicate Lines, Line Numbers, Text Reverser, ROT13, ASCII, Slug, MIME Lookup, Password Strength, Color Contrast, CSS Clamp, Unicode Inspector, Date Duration, Time Zone Converter and AES-GCM. Each has two examples with Turkish names. An example can now click several controls in order, so the Timestamp sample switches to seconds before converting and the MIME sample looks up by extension.
- Ctrl+Enter (⌘+Enter on a Mac) in a tool's field runs the tool on every page: it presses the nearest primary button around the field, which announces the shortcut in `aria-keyshortcuts` and a tooltip. Read-only result fields are left out. Tools with their own shortcut keep it (Base64's Shift to decode, the typing test), and the tools that already ran on Enter now claim the key, so nothing runs twice.

### Fixed

- A missing address under `/tr/` showed the 404 page in English unless Turkish had been chosen before, which is the usual case for a visitor from a search. It is now Turkish there, and its home, licence and tool links lead to the Turkish pages.
- On phones a long licence line wrapped to the left edge of the box, so the indented clauses lost their shape. `build.py --license` now publishes `LICENSE` one line per span with a hanging indent as wide as the line's leading spaces, so a wrapped line continues under its own text. The text is still exactly `LICENSE`, and wide screens look as before.
- The JWT decoder's copy buttons for the header and the payload had no Turkish label, and the signature's never reached the Turkish page. All three now read "Başlığı Kopyala", "Yükü Kopyala" and "İmzayı Kopyala".

### Tests

- `tests/tool-pages-e2e.mjs` fails when a sample only fills its fields: something else on the page has to change, with no error toast. It presses Ctrl+Enter in every field of every tool and checks that the key is handled and that at most one button runs (169 fields). On the licence pages it checks that no wrapped line starts left of its own text on a phone.
- `tests/offline-e2e.mjs` opens a missing `/tr/` address with no stored language and checks the Turkish heading and links.
- `tests/site-audit.mjs` lists the 24 new sample buttons, expects 128 example names, and checks that the licence block holds only line spans and still reads as `LICENSE`.

## [1.6.6] — 2026-11-14

The licence text reads cleanly on phones.

### Fixed

- The licence centres its first three lines ("Apache License", the version and the URL) with up to 33 leading spaces. Below about 560 px those spaces no longer fit, so each line broke over two lines under a run of blank indent. Up to 640 px the title now drops the leading spaces and keeps its three lines; wider screens still show it centred. The licence text itself is unchanged.

### Tests

- `tests/site-audit.mjs` allows only the title span inside the licence block and still compares the text with `LICENSE`.
- `tests/tool-pages-e2e.mjs` checks that the licence title takes three lines on both licence pages at 1280 px and 390 px.

## [1.6.5] — 2026-11-14

The licence page now matches the tool pages.

### Changed

- The licence page, in English and Turkish, uses the tool-page header: an icon tile with the title, the description under it, and the same left edge as the breadcrumb and the licence card. The centred "Open Source" label and the old section heading are gone. The breadcrumb marks the current page for screen readers and the section is named by its heading.

### Tests

- `tests/tool-pages-e2e.mjs` checks the header alignment of `license/` and `tr/license/` at 1280 px and 390 px along with the tool pages, and clears the stored language after a Turkish page so the English pages checked next are not redirected.

## [1.6.4] — 2026-11-14

The QR Code Generator's live preview is now in view on phones.

### Fixed

- On phones the QR preview came after every setting, about 1,400 px down a 390 px wide screen, so the live preview and its scan check could not be seen while typing. On screens up to 768 px wide the preview now sits under the content picker, with the capacity line beside it and the scan check and notes under it, and the content fields follow. At 390 px the preview and the first field share the first screen. Larger screens keep the preview column beside the form.
- Only parts you cannot tab to move up, and the download buttons stay after Generate, so the keyboard still walks the page from top to bottom.

### Tests

- `tests/qr-generator-e2e.mjs` checks the layout in English and Turkish at 390 px and 320 px, with an empty form, a readable code and a code with notes: the preview is in the first screen under the content picker, what stands beside it fits its height, nothing scrolls sideways, and the tab order never jumps back up the screen. At 1280 px it checks that the preview, check and downloads still form a column beside the form.

## [1.6.3] — 2026-11-14

A much more capable QR Code Generator that checks its own output.

### Added

- QR Code Generator: live preview. The code redraws as you type or change a setting; the Generate button is still there.
- Scan check: every code is decoded again with jsQR from the very image you download (scaled to camera-like resolution when it is larger than 1024 px), without colour inversion, the way phones read it. The page says whether it scans, and why it might not: light code on a dark background, contrast under 4:1, a margin under 2 modules, a logo without error correction H, a dense code (version 16 or more), or modules smaller than 3 px.
- Capacity line: QR version, module count and bytes used against the most the chosen level holds. Content that does not fit says by how much instead of failing with a library error.
- SVG download, and PNG sizes up to 2048 px (was 512) for print. PNG and SVG come from one geometry, so they always show the same code.
- Downloads are named after their content, for example `qr-wifi-cafe-istanbul.png`, instead of `toolkit-qr.png`.
- New content types: contact card (vCard 3.0), calendar event (iCalendar, timed or all-day) and location (`geo:`). Wi-Fi gains WPA3 (SAE), a show/hide password button, and leaves the password out of open networks.
- Style options: round dots and rounded corner markers. Finder and alignment patterns stay solid, so decoders still lock on.
- Optional logo in the middle, read in the browser and never uploaded. Choosing one switches error correction to H. It covers 14% or 16% of the code width. Tests in Firefox and Chromium found that jsQR and ZXing read logos up to 30%, but ZBar fails from 18%, once the logo hides the middle alignment pattern of version 7–13 codes.

### Fixed

- Email QR codes wrote spaces in the subject and body as "+", which mail apps show literally ("Hello+from+Toolkit"). They are now `%20`, and line breaks are `%0D%0A` (RFC 6068).
- A link typed without a scheme (`example.com`) now gets `https://`, so phones open it instead of treating it as text.
- The Turkish page showed the email, SMS and Wi-Fi form labels in English; they are translated now.
- The preview no longer adds its own white frame around the code, so it shows the margin you chose.

### Tests

- New `tests/qr-generator-e2e.mjs`, also run in CI:
  - checks the byte-capacity table (160 values) and the alignment-pattern positions (799 patterns, versions 2–40) against the QR library;
  - checks every content type's payload, decoded back from the page;
  - decodes the PNG and SVG exports of every style, colour, logo and size, including a 64-image size sweep and version 40 at 2048 px, with jsQR, ZBar and ZXing-C++;
  - checks the warnings for unreadable codes, the overflow message, download names and sizes, the logo picker and the Turkish page.
- CI installs ZBar and librsvg for this suite.

## [1.6.2] — 2026-11-14

Every tool page now has the same column, so the header stays put when you move between tools.

### Fixed

- Markdown Previewer, QR Code Generator and Text Diff Checker used a wider column than the other 98 tools, and their breadcrumb stayed in the narrow one, about 100 px to the right of the title. They now use the same 900 px column as every other tool; their two-column layouts still fit. `build.py --tool-headers` also gives the breadcrumb the header's container, so the two cannot drift apart again.
- Random Name Generator, Random Number Generator and Slug Generator drew their tool in a narrower, centred box under a full-width header; they now use the full column like every other tool.
- `tests/tool-pages-e2e.mjs` checks on every tool page, on desktop and mobile, that the breadcrumb, the icon, the "Try a sample" button and the tool share the header's left and right edges, and the site audit fails if a tool page uses the wide container.

## [1.6.1] — 2026-11-13

### Fixed

- After a release, the first visit of a returning visitor could show the new page with the previous release's stylesheets and scripts (in 1.6.0, the tool header without its layout) until the next reload. The previous service worker took the new HTML from the network but answered CSS and JavaScript from its cache. `build.py` now writes `?v=<CACHE_VERSION>` into every page's stylesheet and script links, so each release uses URLs the previous worker has never cached and the browser fetches them. `sw.js` answers its own version from the precache and sends any other version to the network without caching it, and `command-palette.js` loads the tool catalogue with the same version.
- The service worker fills a new cache with fresh copies instead of ones the browser kept for up to ten minutes, so a release can no longer be precached with files from the release before.
- `tests/offline-e2e.mjs` checks that every page links its assets with the current version, that the precache answers versioned links offline, and that a newer release's asset comes from the network and is not cached. The typing test's hand-written `?v=43` and `?v=42` links are replaced by the shared version, and sitemap `lastmod` dates ignore the version so releases do not touch every page's date.

## [1.6.0] — 2026-11-13

Tool pages get the same left-aligned look as the home page. No tool is added or changed.

### Changed

- New header on all 101 tool pages, in English and Turkish: left-aligned, with the tool's catalogue icon beside the title and the description below. The category pill above the title is gone; the category now sits in the breadcrumb ("All Tools / Security / Hash Generator") and links to that tab on the home page.
- The "Need a spark?" box is replaced by a "Try a sample" button beside the header, on the 40 tools that have examples. Tools start higher on the page.
- The home page opens on a category tab when its address ends in `#category-<name>`, for example `index.html#category-security`.
- The new `build.py --tool-headers` step (part of `--all`) generates the breadcrumb and header of every tool page from `_data/tools.json`, so the icon and category always match the catalogue, and the expansion-tool template uses it too. The site audit checks every page's header, icon and category link, and a browser test follows the category link to the home page.
- README screenshots of the password generator, the Turkish JSON formatter and the phone layout show the new header.

## [1.5.1] — 2026-11-13

Lighter tool pages and a more descriptive home page title. No tool is added or changed.

### Changed

- The home page title names what the site is: "Toolkit — 101 Free Developer Tools in Your Browser", and "Toolkit — 101 Ücretsiz Geliştirici Aracı" on `/tr/`. `og:title` and `twitter:title` follow it, and `build.py --tool-count` keeps the number in step with the catalogue.
- Only the home page loads the tool catalogue (`tools-data.js` and `extra-tools-data.js`) up front. On every other page `command-palette.js` fetches it the first time the tool finder is about to open (hovering or focusing the "Find tools" button, or Ctrl/Cmd + K), shows "Loading tools…" meanwhile, and says so if the list cannot be loaded. The tool names and descriptions move out of the shared Turkish pack into their own `assets/js/i18n/tr/catalogue.js`, which `/tr/` pages fetch together with the catalogue. An English tool page loads about 46 KB less JavaScript (10 KB compressed), and a Turkish one about 71 KB less (18 KB compressed).
- New browser tests check that tool pages leave the catalogue out until the finder opens, that the finder then lists and searches every tool and remembers the current one, and that a Turkish tool page fetches the Turkish catalogue pack and shows the finder in Turkish.

## [1.5.0] — 2026-11-13

A calmer, monochrome look, and pages roughly half the size of 1.4.0 on a first visit. No tool is added or removed.

### Changed

- New visual design on every page: near-black background, one light accent, flat surfaces and the system font. The cyan–purple gradients, background grid, glows, glass blur and neon badges are gone; colour is kept for meaning (success, warning, error, password strength). The colour tokens are renamed by role (`--accent`, `--accent-dim`, `--accent-ring`, `--accent-text`).
- The home page opens with a left-aligned headline, the tool search and a GitHub link, followed straight away by category tabs with tool counts and the tool cards. The "The Ultimate Toolkit" hero, the badge and the statistics box are removed, and cards show an icon, the name and the description. The card tilt effect is gone. New Turkish copy for the headline and subline.
- The logo keeps its shield but is drawn in flat light grey. The favicons and app icons put it on a dark rounded tile, and the social preview images (`og-en.png`, `og-tr.png`) and README screenshots are redrawn in the new style. The theme colour is `#0a0a0a`.
- Space Grotesk and the italic JetBrains Mono are no longer shipped, and JetBrains Mono is subset to Latin (with Turkish), punctuation, arrows and box drawing (73 KB to 48 KB). A first visit transfers about 100 KB instead of 185 KB on English pages and 115 KB instead of 230 KB on Turkish tool pages.
- The `/tr/` pages no longer load the whole Turkish catalogue. Their HTML is already translated, so at run time they only need the strings their scripts can produce. `build.py --turkish` now writes small packs to `assets/js/i18n/tr/`: one shared by every page for the core scripts (the tool finder, navigation, example starters) and one per page script, each holding the dictionary entries whose English text appears as a string in those scripts. A Turkish tool page now loads about 40 KB of Turkish strings instead of 140 KB (for Base64, 369 KB instead of 472 KB in all). `i18n-tr.js` and `i18n-expansion.js` remain the only place translations are written; `404.html` still loads them whole.
- `tests/turkish-pages-e2e.mjs` opens the tool finder and runs every Turkish tool page, then fails if the page shows English that the complete dictionaries would translate. The static-copy comparison now runs on `404.html`, the one page with the complete dictionaries.
- The home page no longer ships the unused `<template>` with the old single-page versions of the tools, about 40 KB and a third of its HTML.
- README and CONTRIBUTING describe the new design rules and images, and how to preview the site exactly as GitHub Pages serves it (404 page included) with the new `_scripts/serve.py`. The README opens with the link preview and has new screenshots, adding the Turkish pages and a phone. `.github/social-preview.png` is the matching 1280×640 image for the repository's social preview.

### Fixed

- Gradient Generator: the tooltip of the remove-stop button stayed in English on the Turkish page after a colour stop was added or removed.

## [1.4.0] — 2026-11-13

The Turkish pages are Turkish in their HTML, and English pages stop downloading Turkish copy. No tool is added or changed.

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

[1.9.2]: https://github.com/abel0x/toolkit/compare/v1.9.1...v1.9.2
[1.9.1]: https://github.com/abel0x/toolkit/compare/v1.9.0...v1.9.1
[1.9.0]: https://github.com/abel0x/toolkit/compare/v1.8.10...v1.9.0
[1.8.10]: https://github.com/abel0x/toolkit/compare/v1.8.9...v1.8.10
[1.8.9]: https://github.com/abel0x/toolkit/compare/v1.8.8...v1.8.9
[1.8.8]: https://github.com/abel0x/toolkit/compare/v1.8.7...v1.8.8
[1.8.7]: https://github.com/abel0x/toolkit/compare/v1.8.6...v1.8.7
[1.8.6]: https://github.com/abel0x/toolkit/compare/v1.8.5...v1.8.6
[1.8.5]: https://github.com/abel0x/toolkit/compare/v1.8.4...v1.8.5
[1.8.4]: https://github.com/abel0x/toolkit/compare/v1.8.3...v1.8.4
[1.8.3]: https://github.com/abel0x/toolkit/compare/v1.8.2...v1.8.3
[1.8.2]: https://github.com/abel0x/toolkit/compare/v1.8.1...v1.8.2
[1.8.1]: https://github.com/abel0x/toolkit/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/abel0x/toolkit/compare/v1.7.6...v1.8.0
[1.7.6]: https://github.com/abel0x/toolkit/compare/v1.7.5...v1.7.6
[1.7.5]: https://github.com/abel0x/toolkit/compare/v1.7.4...v1.7.5
[1.7.4]: https://github.com/abel0x/toolkit/compare/v1.7.3...v1.7.4
[1.7.3]: https://github.com/abel0x/toolkit/compare/v1.7.2...v1.7.3
[1.7.2]: https://github.com/abel0x/toolkit/compare/v1.7.1...v1.7.2
[1.7.1]: https://github.com/abel0x/toolkit/compare/v1.7.0...v1.7.1
[1.7.0]: https://github.com/abel0x/toolkit/compare/v1.6.7...v1.7.0
[1.6.7]: https://github.com/abel0x/toolkit/compare/v1.6.6...v1.6.7
[1.6.6]: https://github.com/abel0x/toolkit/compare/v1.6.5...v1.6.6
[1.6.5]: https://github.com/abel0x/toolkit/compare/v1.6.4...v1.6.5
[1.6.4]: https://github.com/abel0x/toolkit/compare/v1.6.3...v1.6.4
[1.6.3]: https://github.com/abel0x/toolkit/compare/v1.6.2...v1.6.3
[1.6.2]: https://github.com/abel0x/toolkit/compare/v1.6.1...v1.6.2
[1.6.1]: https://github.com/abel0x/toolkit/compare/v1.6.0...v1.6.1
[1.6.0]: https://github.com/abel0x/toolkit/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/abel0x/toolkit/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/abel0x/toolkit/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/abel0x/toolkit/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/abel0x/toolkit/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/abel0x/toolkit/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/abel0x/toolkit/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/abel0x/toolkit/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/abel0x/toolkit/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/abel0x/toolkit/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/abel0x/toolkit/releases/tag/v1.0.0
