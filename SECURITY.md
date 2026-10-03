# Security Policy

## Overview

Toolkit is a static, client-side application. Hashing, encoding, password generation, file analysis, conversion, and image work are performed in the visitor's browser with native Web APIs such as Web Crypto, FileReader, Canvas, and `Intl`. Toolkit has no application backend, user accounts, database, or endpoint that receives tool input.

This design reduces the attack surface, but it does not remove it. Cross-site scripting, unsafe output rendering, incorrect cryptographic use, cache issues, and unintended client-side persistence are security concerns and are handled seriously.

## Supported versions

| Version | Supported |
| --- | --- |
| `main` and the current GitHub Pages deployment | Yes |
| Older snapshots and forks | Best effort only |

## Reporting a vulnerability

**Do not report security vulnerabilities in a public GitHub issue.** Open a private [GitHub Security Advisory](https://github.com/abel0x/toolkit/security/advisories/new) instead.

Please include:

- a clear vulnerability description and affected URL/tool;
- reproducible steps or a safe proof of concept;
- the impact and any relevant browser/version details;
- a suggested mitigation, if you have one.

An acknowledgement is targeted within **72 hours** and an initial status update within **7 days**. Please allow reasonable time for investigation and a fix before public disclosure.

## In scope

- Cross-site scripting or HTML injection, especially in tools that render user content (for example Markdown, HTML, JSON, or SVG-related tools).
- Insecure randomness or misuse of `crypto.getRandomValues()` and `crypto.subtle`.
- Incorrect cryptographic behaviour, including HMAC, AES-GCM, RSA, TOTP, certificate, encoding, or verification errors that create a security risk.
- Service-worker cache poisoning, unsafe cache handling, or offline content substitution.
- Tool input, generated output, uploaded files, language settings, or recent-tool data persisting or being exposed unexpectedly.
- Sensitive data leaking through an external request, referrer, console output, or browser storage outside the documented local UI state.

## Out of scope

- Vulnerabilities in locally bundled third-party libraries, unless Toolkit's integration creates the vulnerability. Please report upstream defects to the appropriate maintainer as well.
- Self-XSS that requires pasting code into the browser console or voluntarily running an untrusted script.
- Attacks requiring physical access to an already-unlocked device.
- Resource exhaustion caused solely by intentionally huge local files or inputs, unless it escapes normal browser containment or creates a broader security impact.

## Security design

| Decision | Rationale |
| --- | --- |
| Browser-native cryptography | Web Crypto avoids implementing sensitive primitives in application code. |
| No application backend | Tool input has no Toolkit server destination. |
| Self-hosted application assets | The published runtime does not depend on a third-party CDN. |
| Careful DOM output | Prefer `textContent` and explicit escaping over rendering untrusted values as HTML. |
| Same-origin service worker | Cache scope is limited to Toolkit's own origin and path. |
| Minimal local state | The selected language, optional recent-tool slugs, and tool preferences may be stored locally. Typing-test personal bests are opt-in, aggregate-only, off by default, and user-clearable. Typed input, generated sequences, error text, uploaded files, and full run history are never persisted. |
| External-link isolation | External links use `rel="noopener"` to avoid opener access. |

## Acknowledgements

With permission, responsible reporters may be credited in the changelog or release notes for the fix.
