#!/usr/bin/env node
/* Static contract checks for the published, dependency-free site. */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPageMetadata, checkPreviewImage } from './page-metadata.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toolsDirectory = join(root, 'tools');
const toolPages = readdirSync(toolsDirectory)
  .filter((name) => name.endsWith('.html'))
  .sort()
  .map((name) => join(toolsDirectory, name));
const licensePage = join(root, 'license', 'index.html');
const pages = [join(root, 'index.html'), join(root, '404.html'), licensePage, ...toolPages];

// _data/tools.json is the single source of the catalogue; build.py generates
// the browser registries, expansion shells and sitemap from it.
const catalogue = JSON.parse(readFileSync(join(root, '_data/tools.json'), 'utf8')).tools;
const catalogueSlugs = catalogue.map((tool) => tool.slug);
const expansionSlugs = new Set(catalogue.filter((tool) => tool.shell === 'expansion').map((tool) => tool.slug));
assert.equal(toolPages.length, catalogue.length,
  `Expected ${catalogue.length} tool pages (one per _data/tools.json entry), found ${toolPages.length}.`);

const sharedStyles = [
  'assets/css/core.css',
  'assets/css/components.css',
  'assets/css/compatibility.css'
];

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const relativeName = file.slice(root.length + 1);
  const prefix = '../'.repeat(relativeName.split('/').length - 1);

  assert(!/href="(?:\.\.\/)?style\.css"/.test(html), `${relativeName} still loads style.css.`);
  for (const stylesheet of sharedStyles) {
    assert(html.includes(`href="${prefix}${stylesheet}"`), `${relativeName} misses ${stylesheet}.`);
  }

  const pageStyle = relativeName === 'index.html'
    ? 'assets/css/pages/home.css'
    : 'assets/css/pages/tool.css';
  assert(html.includes(`href="${prefix}${pageStyle}"`), `${relativeName} misses its page stylesheet.`);
  assert(html.includes(`rel="icon" type="image/png" sizes="32x32" href="${prefix}assets/images/favicon-32.png"`),
    `${relativeName} does not use the new browser favicon.`);

  const expansionStyle = `${prefix}assets/css/features/expansion-tools.css`;
  const isExpansionTool = html.includes('id="toolApp"');
  if (relativeName.startsWith('tools/')) {
    assert.equal(isExpansionTool, expansionSlugs.has(basename(file, '.html')),
      `${relativeName} does not match its shell in _data/tools.json.`);
  }
  assert(isExpansionTool === html.includes(`href="${expansionStyle}"`),
    `${relativeName} has an incorrect expansion-tool stylesheet.`);
  if (isExpansionTool) {
    assert(html.includes('class="footer-inner"') && html.includes('class="footer-social"'),
      `${relativeName} does not use the complete shared footer shell.`);
  }

  assert(html.includes('class="nav-actions"'), `${relativeName} misses the compact shared header.`);
  assert(!html.includes('class="nav-links"'), `${relativeName} still contains retired navigation markup.`);
  assert(html.includes(`src="${prefix}assets/images/favicon-64.png"`),
    `${relativeName} does not use the new navigation logo.`);

  const extensionIndex = html.indexOf(`${prefix}assets/js/core/i18n-expansion.js`);
  const runtimeIndex = html.indexOf(`${prefix}assets/js/core/i18n.js`);
  assert(extensionIndex !== -1 && runtimeIndex !== -1 && extensionIndex < runtimeIndex,
    `${relativeName} has an invalid i18n script order.`);

  const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert(policy, `${relativeName} misses the Content-Security-Policy meta tag.`);
  for (const directive of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "connect-src 'self'"]) {
    assert(policy[1].includes(directive), `${relativeName} CSP misses ${directive}.`);
  }
  assert(/script-src 'self'(?: 'sha256-[A-Za-z0-9+/=]+')?;/.test(policy[1]),
    `${relativeName} CSP must not allow inline or remote scripts.`);
  assert(/style-src 'self';/.test(policy[1]), `${relativeName} CSP must not allow inline styles.`);
  assert(!/<style\b/i.test(html), `${relativeName} has an inline <style> block, which the CSP blocks.`);
  assert(!/\sstyle\s*=\s*["']/i.test(html.replace(/<pre[\s\S]*?<\/pre>|<textarea[\s\S]*?<\/textarea>/gi, '')),
    `${relativeName} has a style attribute, which the CSP blocks; use a class in assets/css/inline-styles.css.`);
  assert(!/\son[a-z]+\s*=\s*["']/i.test(html.replace(/<pre[\s\S]*?<\/pre>|<textarea[\s\S]*?<\/textarea>/gi, '')),
    `${relativeName} uses an inline event handler, which the CSP blocks.`);

  // 404.html is served at nested missing URLs; its <base> points at the published site root.
  if (relativeName === '404.html') {
    assert(/<base href="\/toolkit\/" \/>/.test(html), '404.html must resolve assets from the site root.');
    const inline = html.match(/<script>([\s\S]*?)<\/script>/);
    const digest = inline && createHash('sha256').update(inline[1]).digest('base64');
    assert(inline && policy[1].includes(`'sha256-${digest}'`), '404.html CSP hash does not match its inline script.');
  }

  for (const match of html.replace(/<base\b[^>]*>/gi, '').matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
    const reference = match[1];
    assert(!/^javascript:/i.test(reference), `${relativeName} contains a javascript: resource URL.`);
    if (!reference || /^(?:https?:|mailto:|tel:|data:|\/\/|#)/i.test(reference)) continue;
    const localPath = decodeURIComponent(reference.replace(/[?#].*$/, ''));
    if (!localPath) continue;
    assert(existsSync(resolve(dirname(file), localPath)), `${relativeName} has a broken local reference: ${reference}`);
  }

  if (file.startsWith(`${toolsDirectory}/`)) {
    const pageName = basename(file);
    const slug = pageName.replace(/\.html$/, '');
    const canonical = `https://abel0x.github.io/toolkit/tools/${pageName}`;
    for (const contract of [
      '<meta name="description"',
      `<link rel="canonical" href="${canonical}"`,
      '<meta property="og:title"',
      '<meta property="og:description"',
      `<meta property="og:url" content="${canonical}"`,
      '<meta property="og:type"',
      '<meta name="twitter:card"',
      '<meta name="twitter:title"',
      '<meta name="twitter:description"'
    ]) {
      assert(html.includes(contract), `${relativeName} misses publication metadata: ${contract}`);
    }
    const implementation = isExpansionTool
      ? '../assets/js/tools/expansion-tools.js'
      : `../assets/js/tools/${slug}.js`;
    assert(html.includes(`src="${implementation}`), `${relativeName} does not load ${implementation}.`);
  }
}

const registrySource = [
  readFileSync(join(root, 'assets/js/core/tools-data.js'), 'utf8'),
  readFileSync(join(root, 'assets/js/core/extra-tools-data.js'), 'utf8')
].join('\n');
const registeredSlugs = [...registrySource.matchAll(/slug:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
const publishedSlugs = toolPages.map((file) => basename(file, '.html'));
assert.equal(new Set(registeredSlugs).size, registeredSlugs.length, 'Tool registries contain a duplicate slug.');
assert.deepEqual([...registeredSlugs].sort(), [...publishedSlugs].sort(),
  'Published tool pages and registry entries are out of sync.');
assert.deepEqual(registeredSlugs, catalogueSlugs,
  'Browser registries differ from _data/tools.json; run `python3 build.py --all`.');
const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
for (const slug of registeredSlugs) {
  const location = `https://abel0x.github.io/toolkit/tools/${slug}.html`;
  assert.equal(sitemap.split(`<loc>${location}</loc>`).length - 1, 1,
    `Sitemap must contain exactly one entry for ${slug}.`);
}
assert.equal(sitemap.split('<loc>https://abel0x.github.io/toolkit/license/</loc>').length - 1, 1,
  'Sitemap must contain exactly one published license entry.');

for (const asset of [
  ...sharedStyles,
  'assets/css/pages/home.css',
  'assets/css/pages/tool.css',
  'assets/css/features/expansion-tools.css',
  'assets/css/features/typing-test.css',
  'assets/js/core/example-starters.js',
  'assets/js/core/i18n-expansion.js',
  'assets/js/core/i18n.js'
]) {
  assert(existsSync(join(root, asset)), `Missing required asset: ${asset}`);
}

for (const stylesheet of [
  ...sharedStyles,
  'assets/css/pages/home.css',
  'assets/css/pages/tool.css',
  'assets/css/features/expansion-tools.css',
  'assets/css/features/typing-test.css'
]) {
  const css = readFileSync(join(root, stylesheet), 'utf8');
  assert(!css.includes(':has('), `${stylesheet} uses a selector outside the site's compatibility baseline.`);
}

const sharedComponents = readFileSync(join(root, 'assets/css/components.css'), 'utf8');
assert(!/\.reveal\s*\{[^}]*opacity\s*:\s*0/i.test(sharedComponents),
  'Reveal elements must not start hidden; pages must remain usable before JavaScript runs.');
assert(sharedComponents.includes('.footer {') && sharedComponents.includes('.footer-bottom {'),
  'Shared footer styles must be available to the hub page.');
assert(sharedComponents.includes('.error-msg[hidden] { display: none; }'),
  'Hidden error messages must not leave a warning icon visible.');
const coreStyles = readFileSync(join(root, 'assets/css/core.css'), 'utf8');
assert(coreStyles.includes('[hidden] { display: none !important; }'),
  'The shared hidden attribute rule must override component display declarations.');

const toolPageStyles = readFileSync(join(root, 'assets/css/pages/tool.css'), 'utf8');
assert(!toolPageStyles.includes('/* ── Footer ───────────────────────────────────────────────── */'),
  'Footer styles belong in the shared component stylesheet, not the tool-page stylesheet.');

const serviceWorker = readFileSync(join(root, 'sw.js'), 'utf8');
assert(/const CACHE_VERSION = '[0-9a-f]{12}';/.test(serviceWorker),
  'CACHE_VERSION must be the content hash written by build.py; run `python3 build.py --all`.');
for (const asset of [
  ...sharedStyles,
  'assets/css/pages/home.css',
  'assets/css/pages/tool.css',
  'assets/css/features/expansion-tools.css',
  'assets/css/features/typing-test.css',
  'assets/js/vendor/qrcode-generator.js',
  'assets/js/vendor/qrcode-generator-utf8.js',
  'assets/js/vendor/qrcode-generator.LICENSE.txt',
  'assets/js/vendor/jsQR.min.js',
  'assets/js/vendor/jsQR.LICENSE.txt',
  'assets/js/vendor/bcrypt.min.js',
  'assets/js/vendor/bcrypt.LICENSE.txt',
  'words/manifest.json',
  'license/',
  'license/index.html',
  'assets/js/core/example-starters.js',
  'assets/js/core/i18n-expansion.js'
]) {
  assert(serviceWorker.includes(`'${asset}'`), `Service worker does not precache ${asset}.`);
}
for (const asset of [
  'assets/images/favicon-32.png',
  'assets/images/favicon-64.png',
  'assets/images/favicon-128.png',
  'assets/images/favicon-256.png',
  'assets/images/favicon-512.png'
]) {
  assert(existsSync(join(root, asset)), `Missing published logo asset: ${asset}`);
  assert(serviceWorker.includes(`'${asset}'`), `Service worker does not precache ${asset}.`);
}
assert(!serviceWorker.includes('favicon.svg'), 'Service worker still precaches the retired logo.');
assert(!serviceWorker.includes('abel-neon'), 'Service worker still references a temporary logo asset name.');
assert(!serviceWorker.includes('qrious.min.js'), 'Service worker still precaches the retired GPL QR dependency.');
for (const asset of [
  'assets/js/vendor/README.md',
  'assets/js/vendor/qrcode-generator.js',
  'assets/js/vendor/qrcode-generator-utf8.js',
  'assets/js/vendor/qrcode-generator.LICENSE.txt',
  'assets/js/vendor/jsQR.min.js',
  'assets/js/vendor/jsQR.LICENSE.txt'
]) {
  assert(existsSync(join(root, asset)), `Missing QR vendor asset or licence: ${asset}`);
}
assert.equal(
  createHash('sha256').update(readFileSync(join(root, 'assets/js/vendor/qrcode-generator.js'))).digest('hex'),
  '79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c',
  'The pinned QR generator distribution has changed unexpectedly.'
);
assert.equal(
  createHash('sha256').update(readFileSync(join(root, 'assets/js/vendor/qrcode-generator-utf8.js'))).digest('hex'),
  'e522d64003b332e29271fdce4993ed3ae2934c8947f41654bd324ddcfa2de301',
  'The pinned QR generator UTF-8 adapter has changed unexpectedly.'
);
assert.equal(
  createHash('sha256').update(readFileSync(join(root, 'assets/js/vendor/jsQR.min.js'))).digest('hex'),
  '6f139698c4ccab1764764600cc6d1baf12fa00f00ee4b8781e36ed337e0fda07',
  'The pinned jsQR 1.4.0 distribution has changed unexpectedly.'
);
assert(existsSync(join(root, 'assets/js/vendor/bcrypt.min.js')), 'The self-hosted bcrypt library is missing.');
assert(existsSync(join(root, 'assets/js/vendor/bcrypt.LICENSE.txt')), 'The bcrypt library licence is missing.');
const bcryptVendor = readFileSync(join(root, 'assets/js/vendor/bcrypt.min.js'));
assert.equal(
  createHash('sha256').update(bcryptVendor).digest('hex'),
  'afd4bd299bcde6710dd6fa029156e3e1174c48bc006b8a9eba32f964e5923783',
  'The pinned bcrypt.js 2.4.3 distribution has changed unexpectedly.'
);
const bcryptHtml = readFileSync(join(toolsDirectory, 'bcrypt.html'), 'utf8');
const bcryptVendorIndex = bcryptHtml.indexOf('../assets/js/vendor/bcrypt.min.js');
const bcryptModuleIndex = bcryptHtml.indexOf('../assets/js/tools/bcrypt.js');
assert(bcryptVendorIndex !== -1 && bcryptVendorIndex < bcryptModuleIndex,
  'Bcrypt Generator must load the local bcrypt library before its tool module.');
const bcryptModule = readFileSync(join(root, 'assets/js/tools/bcrypt.js'), 'utf8');
assert(bcryptModule.includes('window.dcodeIO.bcrypt'), 'Bcrypt Generator does not use the pinned bcrypt implementation.');
assert(!bcryptModule.includes('PBKDF2'), 'Bcrypt Generator must not substitute PBKDF2 output for bcrypt.');
for (const pageName of ['qr-generator.html', 'qr-batch.html']) {
  const html = readFileSync(join(toolsDirectory, pageName), 'utf8');
  const generatorIndex = html.indexOf('../assets/js/vendor/qrcode-generator.js');
  const utf8Index = html.indexOf('../assets/js/vendor/qrcode-generator-utf8.js');
  assert(generatorIndex !== -1 && utf8Index > generatorIndex,
    `${pageName} must load the pinned QR generator and its UTF-8 adapter in order.`);
  assert(!html.includes('qrious.min.js') && !html.includes('qrcode.min.js'),
    `${pageName} still loads a retired QR dependency.`);
}
const webManifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
assert.deepEqual(webManifest.icons.map((icon) => icon.src), [
  'assets/images/favicon-256.png',
  'assets/images/favicon-512.png'
], 'Web manifest does not use the new PWA logo sizes.');

const smoke = readFileSync(join(root, 'tests', 'smoke.html'), 'utf8');
assert(!smoke.includes('../style.css'), 'The smoke test still loads the retired stylesheet.');

const qrGenerator = readFileSync(join(root, 'assets/js/tools/qr-generator.js'), 'utf8');
assert(!qrGenerator.includes('alpha-qr.png'), 'QR downloads still use retired Alpha branding.');

const firstPartyScripts = [
  ...readdirSync(join(root, 'assets/js/core')).map((name) => `assets/js/core/${name}`),
  ...readdirSync(join(root, 'assets/js/pages')).map((name) => `assets/js/pages/${name}`),
  ...readdirSync(join(root, 'assets/js/tools')).map((name) => `assets/js/tools/${name}`)
].filter((name) => name.endsWith('.js'));
for (const scriptName of firstPartyScripts) {
  const source = readFileSync(join(root, scriptName), 'utf8');
  const fetchCalls = [...source.matchAll(/\bfetch\s*\(/g)];
  if (scriptName === 'assets/js/tools/typing-test.js') {
    assert.equal(fetchCalls.length, 2, 'Typing Speed Test should fetch only its manifest and selected word list.');
  } else {
    assert.equal(fetchCalls.length, 0, `${scriptName} makes an unexpected network request.`);
  }
  assert(!/\bnew\s+(?:WebSocket|EventSource)\s*\(|\bXMLHttpRequest\s*\(|navigator\.sendBeacon\s*\(/.test(source),
    `${scriptName} uses a forbidden network API.`);
}
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const relativeName = file.slice(root.length + 1);
  assert(!/<script\b[^>]*\bsrc=["']https?:\/\//i.test(html), `${relativeName} loads a remote script.`);
  assert(!/<img\b[^>]*\bsrc=["']https?:\/\//i.test(html), `${relativeName} loads a remote image.`);
  assert(!/<link\b(?=[^>]*\brel=["'](?:stylesheet|icon|apple-touch-icon)["'])[^>]*\bhref=["']https?:\/\//i.test(html),
    `${relativeName} loads a remote stylesheet or icon.`);
}
const openGraphModule = readFileSync(join(root, 'assets/js/tools/open-graph.js'), 'utf8');
assert(!openGraphModule.includes("getElementById('prevImg')") && !/\.src\s*=/.test(openGraphModule),
  'Open Graph Generator must not load the user-provided preview image URL.');
const markdownHtml = readFileSync(join(toolsDirectory, 'markdown.html'), 'utf8');
assert(markdownHtml.includes('id="mdPreview"') && /id="mdPreview"[^>]*data-i18n-skip/.test(markdownHtml),
  'Markdown Previewer output must be isolated from DOM translation.');

const i18nCore = readFileSync(join(root, 'assets/js/core/i18n.js'), 'utf8');
const i18nExpansion = readFileSync(join(root, 'assets/js/core/i18n-expansion.js'), 'utf8');
for (const source of [
  'Generate SHA family digests from any text input using the Web Crypto API.',
  'Type or paste text to hash…',
  'Generate Hashes',
  'Hash Generator Tool'
]) {
  assert(i18nCore.includes(`'${source}'`) || i18nExpansion.includes(`'${source}'`),
    `Turkish i18n is missing the Hash Generator key: ${source}`);
}
assert(i18nExpansion.includes("'Cryptography': 'Kriptografi'"),
  'Turkish i18n is missing the Cryptography category translation.');

const exampleStarterPages = {
  'base64.html': 'base64',
  'base32.html': 'base32',
  'hash.html': 'hash',
  'regex-tester.html': 'regex',
  'url-codec.html': 'url-codec',
  'query-string.html': 'query-string',
  'json-formatter.html': 'json-formatter',
  'json-validator.html': 'json-validator',
  'json-minifier.html': 'json-minifier',
  'json-sorter.html': 'json-sorter',
  'json-to-yaml.html': 'json-to-yaml',
  'csv-to-json.html': 'csv-to-json',
  'markdown.html': 'markdown',
  'meta-tags.html': 'meta-tags',
  'open-graph.html': 'open-graph',
  'xml-formatter.html': 'xml-formatter',
  'yaml-to-json.html': 'yaml-to-json',
  'json-to-csv.html': 'json-to-csv',
  'sql-formatter.html': 'sql-formatter',
  'html-minifier.html': 'html-minifier',
  'css-minifier.html': 'css-minifier',
  'js-minifier.html': 'js-minifier',
  'url-parser.html': 'url-parser',
  'url-builder.html': 'url-builder',
  'user-agent.html': 'user-agent',
  'text-diff.html': 'text-diff',
  'find-replace.html': 'find-replace',
  'text-sorter.html': 'text-sorter',
  'word-counter.html': 'word-counter',
  'json-diff.html': 'json-diff',
  'csp-generator.html': 'csp-generator',
  'curl-builder.html': 'curl-builder',
  'http-header-analyzer.html': 'http-header-analyzer',
  'cron-assistant.html': 'cron-assistant',
  'unix-permissions.html': 'unix-permissions',
  'css-specificity.html': 'css-specificity',
  'json-to-typescript.html': 'json-to-typescript',
  'json-to-markdown.html': 'json-to-markdown',
  'xml-to-json.html': 'xml-to-json',
  'csv-viewer.html': 'csv-viewer'
};
for (const [pageName, group] of Object.entries(exampleStarterPages)) {
  const html = readFileSync(join(toolsDirectory, pageName), 'utf8');
  assert(html.includes(`data-example-group="${group}"`), `${pageName} misses its example starter.`);
  assert(html.includes('src="../assets/js/core/example-starters.js"'), `${pageName} misses the example starter runtime.`);
}
for (const source of [
  'Need a spark?',
  'Load a ready-made example, then make it yours.',
  'Try a sample',
  'Example loaded: {{name}}'
]) {
  assert(i18nExpansion.includes(`'${source}'`), `Turkish i18n is missing the example-starter key: ${source}`);
}
const exampleStarterSource = readFileSync(join(root, 'assets/js/core/example-starters.js'), 'utf8');
const exampleNames = [...exampleStarterSource.matchAll(/name: '([^']+)'/g)].map((match) => match[1]);
assert.equal(exampleNames.length, 80, 'Example starter definitions unexpectedly changed.');
for (const source of exampleNames) {
  assert(i18nExpansion.includes(`'${source}'`), `Turkish i18n is missing the example name: ${source}`);
}

const typingPage = join(root, 'tools', 'typing-test.html');
assert(existsSync(typingPage), 'Typing Speed Test page is missing.');
const typingHtml = readFileSync(typingPage, 'utf8');
assert(typingHtml.includes('href="../assets/css/features/typing-test.css?v=43"'),
  'Typing Speed Test does not load its feature stylesheet.');
assert(!typingHtml.includes('id="toolApp"'), 'Typing Speed Test must use the conventional tool shell.');
assert(typingHtml.includes('src="../assets/js/tools/typing-test.js?v=42"'),
  'Typing Speed Test does not load its module.');
assert(existsSync(join(root, 'words', 'manifest.json')), 'Word-list manifest is missing.');
assert.doesNotThrow(() => JSON.parse(readFileSync(join(root, 'words', 'manifest.json'), 'utf8')),
  'Word-list manifest is not valid JSON.');
for (const source of [
  'Typing Speed Test',
  'Most Common 200',
  'Provinces',
  'Medical Terms',
  'Legal Terms',
  'Words per minute'
]) {
  assert(i18nExpansion.includes(`'${source}'`),
    `Turkish i18n is missing the Typing Speed Test key: ${source}`);
}

assert(existsSync(licensePage), 'Published license page is missing.');
// Search Console verifies the URL-prefix property from this tag; removing it loses ownership.
assert(readFileSync(join(root, 'index.html'), 'utf8')
  .includes('<meta name="google-site-verification" content="XacY5y52KIxRIvYicwvR-VJYq8Yw1od7nXy4N9m9evI" />'),
  'index.html lost its Google Search Console verification meta tag.');

for (const language of ['en', 'tr']) checkPreviewImage(join(root, `assets/images/og-${language}.png`), `og-${language}.png`);
const metadataTypes = new Set();
for (const file of [join(root, 'index.html'), licensePage, ...toolPages]) {
  const relativeName = file.slice(root.length + 1);
  metadataTypes.add(checkPageMetadata(readFileSync(file, 'utf8'), relativeName, {
    language: 'en',
    url: `https://abel0x.github.io/toolkit/${relativeName.replace(/index\.html$/, '')}`,
    image: 'https://abel0x.github.io/toolkit/assets/images/og-en.png'
  }));
}
assert.deepEqual([...metadataTypes].sort(), ['WebApplication', 'WebPage', 'WebSite'], 'Unexpected JSON-LD page types.');

const licenseHtml = readFileSync(licensePage, 'utf8');
assert(licenseHtml.includes('https://abel0x.github.io/toolkit/license/'),
  'License page has an invalid canonical URL.');
assert(licenseHtml.includes('data-i18n-skip lang="en"'),
  'License text must be excluded from DOM translation.');
const licenseMarker = '<pre class="license-text" id="license-text" data-i18n-skip lang="en">';
const licenseStart = licenseHtml.indexOf(licenseMarker);
assert.notEqual(licenseStart, -1, 'License page does not include the canonical license block.');
const licenseTextStart = licenseStart + licenseMarker.length;
const licenseTextEnd = licenseHtml.indexOf('</pre>', licenseTextStart);
assert.notEqual(licenseTextEnd, -1, 'License page does not close its canonical license block.');
assert.equal(
  licenseHtml.slice(licenseTextStart, licenseTextEnd),
  readFileSync(join(root, 'LICENSE'), 'utf8'),
  'Published license text has drifted from LICENSE.'
);
assert(licenseHtml.includes('href="../license/index.html"'), 'License page nav misses the project license link.');
assert(i18nCore.includes("'View project license': 'Proje lisansını görüntüle'"),
  'Turkish i18n is missing the project license navigation label.');

console.log(`Site audit passed: ${pages.length} published pages and ${toolPages.length} tools.`);
