# Self-hosted browser libraries

Toolkit does not load scripts from a CDN. The files in this directory are pinned copies used by browser-only tools and are included in the service-worker cache.

| Files | Upstream version or revision | Licence | SHA-256 |
| --- | --- | --- | --- |
| `bcryptjs.umd.js` | bcryptjs 3.0.3, `umd/index.js` from the npm package (tarball SHA-1 `4b93d6a398c48bfc9f32ee65d301174a8a8ea56f`, as npm lists it) | Bundled upstream notices in `bcrypt.LICENSE.txt` | `ed01b52b436504d8bb7086d93fee4bd8edbb22d8ed88e1b456e0c604f30e79c4` |
| `qrcode-generator.js` | QR Code Generator revision `83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8` | MIT; see `qrcode-generator.LICENSE.txt` | `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c` |
| `qrcode-generator-utf8.js` | Same revision; official UTF-8 adapter | MIT; see `qrcode-generator.LICENSE.txt` | `e522d64003b332e29271fdce4993ed3ae2934c8947f41654bd324ddcfa2de301` |
| `jsQR.min.js` | jsQR 1.4.0, locally retained jsDelivr minification | Apache-2.0; see `jsQR.LICENSE.txt` | `6f139698c4ccab1764764600cc6d1baf12fa00f00ee4b8781e36ed337e0fda07` |

Last reviewed on 2026-11-14: the GitHub Advisory Database lists no advisories for `bcryptjs`, `jsqr` or `qrcode-generator`. The QR Code Generator revision is the one npm publishes as 2.0.4, its latest release; jsQR 1.4.0 is still the latest release (the project has not released since 2020). bcrypt.js moved from 2.4.3 to 3.0.3, which hashes with the `$2b$` prefix by default (it still verifies `$2a$` and `$2y$` hashes) and offers `truncates()`, which the bcrypt tool uses to warn that only the first 72 bytes of a password count.

Upstream projects:

- bcrypt.js: <https://github.com/dcodeIO/bcrypt.js>
- QR Code Generator: <https://github.com/kazuhikoarase/qrcode-generator>
- jsQR: <https://github.com/cozmo/jsQR>

When updating a library, replace it from the upstream project, retain its licence, update the checksum here and in `tests/site-audit.mjs`, verify script load order, run `python3 build.py --all` (it recomputes `CACHE_VERSION` in `sw.js`), and run the complete test suite.

Pinned distributions remain byte-for-byte identical to the documented upstream artifact. `jsQR.min.js` therefore intentionally retains its upstream end-of-file style without an added newline; changing it would invalidate the pinned checksum without changing executable behaviour.
