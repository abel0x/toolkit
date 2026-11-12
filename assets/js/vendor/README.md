# Self-hosted browser libraries

Toolkit does not load scripts from a CDN. The files in this directory are pinned copies used by browser-only tools and are included in the service-worker cache.

| Files | Upstream version or revision | Licence | SHA-256 |
| --- | --- | --- | --- |
| `bcrypt.min.js` | bcrypt.js 2.4.3 | Bundled upstream notices in `bcrypt.LICENSE.txt` | `afd4bd299bcde6710dd6fa029156e3e1174c48bc006b8a9eba32f964e5923783` |
| `qrcode-generator.js` | QR Code Generator revision `83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8` | MIT; see `qrcode-generator.LICENSE.txt` | `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c` |
| `qrcode-generator-utf8.js` | Same revision; official UTF-8 adapter | MIT; see `qrcode-generator.LICENSE.txt` | `e522d64003b332e29271fdce4993ed3ae2934c8947f41654bd324ddcfa2de301` |
| `jsQR.min.js` | jsQR 1.4.0, locally retained jsDelivr minification | Apache-2.0; see `jsQR.LICENSE.txt` | `6f139698c4ccab1764764600cc6d1baf12fa00f00ee4b8781e36ed337e0fda07` |

Upstream projects:

- bcrypt.js: <https://github.com/dcodeIO/bcrypt.js>
- QR Code Generator: <https://github.com/kazuhikoarase/qrcode-generator>
- jsQR: <https://github.com/cozmo/jsQR>

When updating a library, replace it from the upstream project, retain its licence, update the checksum here and in `tests/site-audit.mjs`, verify script load order, run `python3 build.py --all` (it recomputes `CACHE_VERSION` in `sw.js`), and run the complete test suite.

Pinned distributions remain byte-for-byte identical to the documented upstream artifact. `jsQR.min.js` therefore intentionally retains its upstream end-of-file style without an added newline; changing it would invalidate the pinned checksum without changing executable behaviour.
