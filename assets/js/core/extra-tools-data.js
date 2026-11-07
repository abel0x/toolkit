/* ═══════════════════════════════════════════════════════════
   Toolkit — expansion tool metadata
   All tools are browser-only and require no network service.
   The list is generated from _data/tools.json by
   `python3 build.py --all`; edit that file, not the list below.
   ═══════════════════════════════════════════════════════════ */

const EXPANSION_TOOLS = [
  // EXPANSION-TOOLS:START
  { name: 'AES-GCM Encryptor', slug: 'aes-gcm', cat: 'security', catLabel: 'Security', desc: 'Encrypt or decrypt text locally with AES-GCM and a passphrase.', tags: ['aes', 'encrypt', 'decrypt', 'crypto', 'passphrase'] },
  { name: 'RSA Key Pair Generator', slug: 'rsa-keypair', cat: 'security', catLabel: 'Security', desc: 'Generate browser-only RSA-OAEP key pairs and export PEM or JWK.', tags: ['rsa', 'key', 'pem', 'jwk', 'crypto'] },
  { name: 'PEM / JWK Converter', slug: 'pem-jwk', cat: 'security', catLabel: 'Security', desc: 'Convert supported RSA public and private keys between PEM and JWK.', tags: ['pem', 'jwk', 'rsa', 'key', 'convert'] },
  { name: 'Certificate Inspector', slug: 'certificate-inspector', cat: 'security', catLabel: 'Security', desc: 'Inspect an X.509 PEM certificate locally as a readable ASN.1 tree.', tags: ['certificate', 'x509', 'pem', 'asn1', 'security'] },
  { name: 'TOTP Generator', slug: 'totp', cat: 'security', catLabel: 'Security', desc: 'Generate time-based one-time passwords from a Base32 secret, entirely offline.', tags: ['totp', '2fa', 'otp', 'base32', 'security'] },
  { name: 'CSP Generator', slug: 'csp-generator', cat: 'web', catLabel: 'Web Utils', desc: 'Build a Content-Security-Policy header from directive values.', tags: ['csp', 'security', 'header', 'content security policy'] },
  { name: 'cURL Builder', slug: 'curl-builder', cat: 'web', catLabel: 'Web Utils', desc: 'Create a shell-safe cURL command from a method, URL, headers and body.', tags: ['curl', 'http', 'api', 'request', 'command'] },
  { name: 'HTTP Header Analyzer', slug: 'http-header-analyzer', cat: 'web', catLabel: 'Web Utils', desc: 'Parse pasted HTTP headers and flag common browser security headers.', tags: ['http', 'headers', 'security', 'analyze'] },
  { name: 'Cron Expression Assistant', slug: 'cron-assistant', cat: 'devtools', catLabel: 'Dev Tools', desc: 'Explain a five-field cron expression and calculate upcoming runs locally.', tags: ['cron', 'schedule', 'time', 'devops'] },
  { name: 'Unix Permissions Calculator', slug: 'unix-permissions', cat: 'devtools', catLabel: 'Dev Tools', desc: 'Translate Unix rwx permissions between checkboxes, symbolic mode and octal.', tags: ['chmod', 'unix', 'permissions', 'octal'] },
  { name: 'CSS Specificity Calculator', slug: 'css-specificity', cat: 'devtools', catLabel: 'Dev Tools', desc: 'Calculate CSS selector specificity with an inspectable A-B-C score.', tags: ['css', 'specificity', 'selector', 'frontend'] },
  { name: 'CSS Clamp Calculator', slug: 'css-clamp', cat: 'devtools', catLabel: 'Dev Tools', desc: 'Generate a responsive CSS clamp() expression from size and viewport ranges.', tags: ['css', 'clamp', 'responsive', 'fluid typography'] },
  { name: 'JSON to TypeScript', slug: 'json-to-typescript', cat: 'devtools', catLabel: 'Dev Tools', desc: 'Infer TypeScript interfaces from JSON without uploading data.', tags: ['json', 'typescript', 'interface', 'generate'] },
  { name: 'JSON to Markdown Table', slug: 'json-to-markdown', cat: 'devtools', catLabel: 'Dev Tools', desc: 'Convert a JSON array of objects into a Markdown table.', tags: ['json', 'markdown', 'table', 'convert'] },
  { name: 'XML to JSON Converter', slug: 'xml-to-json', cat: 'devtools', catLabel: 'Dev Tools', desc: 'Convert XML documents to a clear JSON representation in the browser.', tags: ['xml', 'json', 'convert', 'parser'] },
  { name: 'CSV Viewer', slug: 'csv-viewer', cat: 'devtools', catLabel: 'Dev Tools', desc: 'Preview CSV data as a searchable local table.', tags: ['csv', 'table', 'viewer', 'data'] },
  { name: 'Unicode Inspector', slug: 'unicode-inspector', cat: 'text', catLabel: 'Text Tools', desc: 'Inspect Unicode code points and normalize text with standard Unicode forms.', tags: ['unicode', 'text', 'normalize', 'code point'] },
  { name: 'Time Zone Converter', slug: 'time-zone-converter', cat: 'converters', catLabel: 'Converters', desc: 'View one date and time across IANA time zones using browser locale data.', tags: ['timezone', 'date', 'time', 'intl'] },
  { name: 'Date Duration Calculator', slug: 'date-duration', cat: 'converters', catLabel: 'Converters', desc: 'Calculate the exact day and week distance between two calendar dates.', tags: ['date', 'duration', 'days', 'weeks'] },
  { name: 'Image Compressor', slug: 'image-compressor', cat: 'media', catLabel: 'Media', desc: 'Resize and recompress images locally with Canvas; nothing is uploaded.', tags: ['image', 'compress', 'resize', 'canvas'] },
  { name: 'Sitemap Generator', slug: 'sitemap-generator', cat: 'web', catLabel: 'Web Utils', desc: 'Generate a standards-friendly sitemap.xml from a list of URLs.', tags: ['sitemap', 'seo', 'xml', 'urls'] },
  { name: 'Color Contrast Checker', slug: 'color-contrast', cat: 'devtools', catLabel: 'Dev Tools', desc: 'Check WCAG contrast ratios for foreground and background colors.', tags: ['color', 'contrast', 'wcag', 'accessibility'] },  // EXPANSION-TOOLS:END
];

if (typeof TOOLS_DATA !== 'undefined' && !TOOLS_DATA.some((tool) => tool.slug === 'aes-gcm')) {
  TOOLS_DATA.push(...EXPANSION_TOOLS);
}

/* The navigation uses this event to add the browser-only tools to its finder
   after the base navigation script has loaded. */
window.EXPANSION_TOOLS = EXPANSION_TOOLS;
window.dispatchEvent(new CustomEvent('toolkit:tools-ready'));

(function syncGlobalToolCount() {
  if (typeof TOOLS_DATA === 'undefined') return;
  const count = TOOLS_DATA.length;
  document.querySelectorAll('.footer-tech').forEach((element) => {
    element.textContent = `${count} tools · HTML · CSS · Vanilla JS · Web Crypto API`;
  });
  document.querySelectorAll('[data-tool-count]').forEach((element) => {
    element.textContent = String(count);
  });
}());
