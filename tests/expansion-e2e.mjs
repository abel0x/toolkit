#!/usr/bin/env node
/*
 * Browser-level contract tests for the 22 locally implemented expansion tools
 * plus i18n form-control safety checks on conventional tool pages.
 * Uses Firefox WebDriver BiDi directly, so no npm dependency or external
 * service is required. Run with: node tests/expansion-e2e.mjs
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expansionTools = [
  'aes-gcm', 'rsa-keypair', 'pem-jwk', 'certificate-inspector', 'totp',
  'csp-generator', 'curl-builder', 'http-header-analyzer', 'cron-assistant',
  'unix-permissions', 'css-specificity', 'css-clamp', 'json-to-typescript',
  'json-to-markdown', 'xml-to-json', 'csv-viewer', 'unicode-inspector',
  'time-zone-converter', 'date-duration', 'image-compressor',
  'sitemap-generator', 'color-contrast'
];

const mimeTypes = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.xml': 'application/xml; charset=utf-8'
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).on('error', reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      // This suite exercises tool UI. Use a no-op worker here so a long
      // precache installation cannot race the isolated test server; offline
      // manifest coverage is asserted separately by site-audit.mjs.
      if (url.pathname === '/sw.js') {
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end("self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));");
        return;
      }
      const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
      const target = resolve(root, `.${pathname}`);
      if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error('Forbidden');
      const file = await readFile(target);
      await stat(target);
      response.writeHead(200, {
        'Content-Type': mimeTypes[extname(target)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      response.end(file);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).on('error', reject));
  return server;
}

class BidiClient {
  constructor(socket) {
    this.socket = socket;
    this.sequence = 0;
    this.pending = new Map();
    this.events = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) { this.events.push(message); return; }
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(`${message.error}: ${message.message || ''}`));
      else request.resolve(message.result);
    });
  }

  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for WebDriver BiDi: ${method}`));
      }, 30_000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() { this.socket.close(); }
}

async function connectBidi(port) {
  let lastError;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
      await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
      });
      return new BidiClient(socket);
    } catch (error) {
      lastError = error;
      await sleep(100);
    }
  }
  throw lastError || new Error('Firefox did not expose WebDriver BiDi.');
}

async function evaluate(bidi, context, source) {
  const response = await bidi.call('script.evaluate', {
    expression: `Promise.resolve(${source}).then((value) => JSON.stringify(value))`,
    target: { context },
    awaitPromise: true,
    resultOwnership: 'none'
  });
  if (response.type !== 'success') throw new Error(`Browser evaluation failed: ${JSON.stringify(response)}`);
  if (response.result.type !== 'string') throw new Error(`Expected JSON result, received ${JSON.stringify(response.result)}`);
  return JSON.parse(response.result.value);
}

async function navigate(bidi, context, baseUrl, slug) {
  await navigateRaw(bidi, context, `${baseUrl}/tools/${slug}.html`);
  return evaluate(bidi, context, `(() => {
    const footer = document.querySelector('.footer');
    const requiredStyles = ['core.css', 'components.css', 'compatibility.css', 'tool.css', 'expansion-tools.css'];
    return {
      title: document.title,
      app: Boolean(document.querySelector('#toolApp')),
      controls: document.querySelectorAll('#toolApp button, #toolApp input, #toolApp textarea, #toolApp select').length,
      footer: Boolean(footer?.querySelector('.footer-inner') && footer.querySelector('.footer-social') && footer.querySelector('.footer-bottom')),
      footerStyled: footer ? Number.parseFloat(getComputedStyle(footer).paddingTop) > 0 : false,
      styles: requiredStyles.every((name) => [...document.styleSheets].some((sheet) => sheet.href?.endsWith(name))),
      overflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      languageReady: Boolean(window.ToolkitI18n && document.querySelector('.nav-language'))
    };
  })()`);
}

async function runTool(bidi, context, baseUrl, slug, body) {
  const page = await navigate(bidi, context, baseUrl, slug);
  assert.equal(page.app, true, `${slug}: the application root did not render.`);
  assert(page.controls > 0, `${slug}: no interactive controls rendered.`);
  assert.equal(page.footer, true, `${slug}: the complete shared footer is missing.`);
  assert.equal(page.footerStyled, true, `${slug}: footer CSS did not apply.`);
  assert.equal(page.styles, true, `${slug}: a required stylesheet did not load.`);
  assert.equal(page.overflow, true, `${slug}: desktop page has horizontal overflow.`);
  assert.equal(page.languageReady, true, `${slug}: language control did not initialise.`);

  const result = await evaluate(bidi, context, `(async () => {
    const wait = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const expect = (condition, message) => { if (!condition) throw new Error(message); };
    ${body}
  })()`);
  assert.equal(result.ok, true, `${slug}: ${result.message || 'functional assertion failed.'}`);

  // English pages leave Turkish to their /tr/ twin and never download its dictionaries.
  const i18n = await evaluate(bidi, context, `(() => ({
    ok: document.documentElement.lang === 'en' && !window.TOOLKIT_I18N_TR && !window.TOOLKIT_I18N_EXTRA
      && Boolean(document.querySelector('link[rel="alternate"][hreflang="tr"]')),
    message: 'The English page loaded the Turkish dictionaries or lost its Turkish twin.'
  }))()`);
  assert.equal(i18n.ok, true, `${slug}: ${i18n.message}`);
}

async function navigateRaw(bidi, context, url) {
  // Opening a /tr/ page saves Turkish, and English pages would then redirect
  // to their twin; English checks start from an English preference.
  if (!new URL(url).pathname.startsWith('/tr/')) {
    try {
      await evaluate(bidi, context, `(() => { localStorage.setItem('toolkit-language', 'en'); return true; })()`);
    } catch {}
  }
  await bidi.call('browsingContext.navigate', {
    context,
    url,
    wait: 'complete'
  });
}

// Turkish behaviour is exercised on the /tr/ pages, where the dictionaries load.
async function assertI18nFormControlSafety(bidi, context, baseUrl) {
  await navigateRaw(bidi, context, `${baseUrl}/tr/tools/qr-generator.html`);
  const qr = await evaluate(bidi, context, `(() => {
    const mode = document.querySelector('#qrMode');
    const initialValue = mode.value;
    mode.value = 'wifi';
    mode.dispatchEvent(new Event('change', { bubbles: true }));
    const security = document.querySelector('#qrWifiSec');
    return {
      initialValue,
      selectedValue: mode.value,
      selectedText: mode.options[mode.selectedIndex].textContent,
      securityValue: security?.value,
      securityOptionValue: security?.options[0]?.value
    };
  })()`);
  assert.deepEqual(qr, {
    initialValue: 'text',
    selectedValue: 'wifi',
    selectedText: 'Wi-Fi Kimlik Bilgileri',
    securityValue: 'WPA',
    securityOptionValue: 'WPA'
  }, 'QR Generator: Turkish UI translation changed a functional select value.');

  await navigateRaw(bidi, context, `${baseUrl}/tr/tools/meta-tags.html`);
  const meta = await evaluate(bidi, context, `(() => {
    const robots = document.querySelector('#metaRobots');
    robots.value = 'noindex, nofollow';
    robots.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      value: robots.value,
      selectedText: robots.options[robots.selectedIndex].textContent,
      output: document.querySelector('#metaOutput').value
    };
  })()`);
  assert.equal(meta.value, 'noindex, nofollow', 'Meta Tag Generator: translated robots directive value.');
  assert.equal(meta.selectedText, 'noindex, nofollow', 'Meta Tag Generator: robots directive label changed unexpectedly.');
  assert(meta.output.includes('content="noindex, nofollow"'), 'Meta Tag Generator: translated directive changed generated markup.');

  await navigateRaw(bidi, context, `${baseUrl}/tr/tools/text-reverser.html`);
  const reverser = await evaluate(bidi, context, `(() => {
    const radio = document.querySelector('input[name="tr-mode"][value="word"]');
    radio.checked = true;
    const input = document.querySelector('#tr-input');
    input.value = 'one two three';
    document.querySelector('#tr-reverse-btn').click();
    return {
      radioValue: radio.value,
      output: document.querySelector('#tr-output').value
    };
  })()`);
  assert.equal(reverser.radioValue, 'word', 'Text Reverser: Turkish UI translation changed a radio value.');
  assert.equal(reverser.output, 'three two one', 'Text Reverser: translated radio value changed behaviour.');
}

async function assertGeneratedContentI18nIsolation(bidi, context, baseUrl) {
  async function run(slug, body) {
    await navigateRaw(bidi, context, `${baseUrl}/tr/tools/${slug}.html`);
    const result = await evaluate(bidi, context, `(async () => {
      const wait = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      ${body}
    })()`);
    assert.equal(result.ok, true, `${slug}: ${result.message || 'generated content was altered by i18n.'}`);
  }

  await run('text-diff', `
    document.querySelector('#diffA').value = 'Home\\nCopy';
    document.querySelector('#diffB').value = 'Home\\nClear';
    document.querySelector('#diffCompareBtn').click();
    await wait(30);
    const output = document.querySelector('#diffOutput').textContent.replace(/\\s+/g, ' ').trim();
    return {
      ok: output.includes('Home') && output.includes('Copy') && output.includes('Clear')
        && !output.includes('Ana Sayfa'),
      message: 'diff lines containing i18n keys were translated.'
    };`);

  await run('regex-tester', `
    document.querySelector('#regexPattern').value = '(Home)';
    document.querySelector('#regexTest').value = 'Home Copy';
    document.querySelector('#regexTest').dispatchEvent(new Event('input', { bubbles: true }));
    await wait(30);
    return {
      ok: document.querySelector('#regexHighlight').textContent === 'Home Copy'
        && document.querySelector('.group-value')?.textContent === 'Home',
      message: 'highlighted input or a capture group was translated.'
    };`);

  await run('query-string', `
    const input = document.querySelector('#qsParseInput');
    input.value = '?key=Home&copy=Clear';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(30);
    const cells = [...document.querySelectorAll('#qsParseTable tbody td[data-i18n-skip]')]
      .map((node) => node.textContent);
    return {
      ok: cells.join('|') === 'key|Home|copy|Clear',
      message: 'parsed query-string keys or values were translated.'
    };`);

  await run('open-graph', `
    const values = {
      ogTitle: 'Home',
      ogDesc: 'Copy',
      ogUrl: 'https://example.test/value',
      ogImage: 'https://example.test/private-image.png'
    };
    Object.entries(values).forEach(([id, value]) => {
      const input = document.querySelector('#' + id);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await wait(30);
    return {
      ok: document.querySelector('#prevTitle').textContent === 'Home'
        && document.querySelector('#prevDesc').textContent === 'Copy'
        && document.querySelector('#prevUrl').textContent === 'https://example.test/value'
        && !document.querySelector('#ogPreview img')
        && !document.querySelector('#prevImgNotice').hidden,
      message: 'preview content was translated or a remote preview image was loaded.'
    };`);

  await run('markdown', `
    const input = document.querySelector('#mdInput');
    input.value = '# Home\\n\\nCopy and Clear';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(30);
    const preview = document.querySelector('#mdPreview');
    return {
      ok: preview.querySelector('h1')?.textContent === 'Home'
        && preview.textContent.includes('Copy and Clear')
        && !preview.textContent.includes('Ana Sayfa'),
      message: 'rendered Markdown content was translated.'
    };`);
}

async function assertHmacGeneration(bidi, context, baseUrl) {
  await navigateRaw(bidi, context, `${baseUrl}/tools/hmac.html`);
  const result = await evaluate(bidi, context, `(async () => {
    const key = document.querySelector('#hmacKey');
    const message = document.querySelector('#hmacMessage');
    key.value = 'key';
    message.value = 'The quick brown fox jumps over the lazy dog';
    document.querySelector('#hmacBtn').click();
    for (let attempt = 0; attempt < 100 && !document.querySelector('#hmacOutput').value; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return document.querySelector('#hmacOutput').value;
  })()`);
  assert.equal(result, 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
    'HMAC Generator: SHA-256 output does not match the standard test vector.');
}

async function assertBcryptCompatibility(bidi, context, baseUrl) {
  await navigateRaw(bidi, context, `${baseUrl}/tools/bcrypt.html`);
  const result = await evaluate(bidi, context, `(async () => {
    const waitFor = async (predicate) => {
      for (let attempt = 0; attempt < 240; attempt += 1) {
        if (predicate()) return true;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return false;
    };
    const password = document.querySelector('#bcryptVerifyPw');
    const hash = document.querySelector('#bcryptVerifyHash');
    const verifyResult = document.querySelector('#bcryptVerifyResult');
    password.value = 'password';
    hash.value = '$2b$04$abcdefghijklmnopqrstuughE8Ev8uGFaUgY2cNEySvxngrb/Jzdm';
    document.querySelector('#bcryptVerifyBtn').click();
    const knownVectorMatches = await waitFor(() => verifyResult.classList.contains('verify-result--success'));

    password.value = 'wrong password';
    document.querySelector('#bcryptVerifyBtn').click();
    const wrongPasswordRejected = await waitFor(() => verifyResult.classList.contains('verify-result--error'));

    document.querySelector('#bcryptInput').value = 'Toolkit test';
    document.querySelector('#bcryptCost').value = '4';
    document.querySelector('#bcryptGenBtn').click();
    const generated = await waitFor(() => /^\\$2[aby]\\$04\\$/.test(document.querySelector('#bcryptOutput').value));
    const generatedHash = document.querySelector('#bcryptOutput').value;
    return {
      knownVectorMatches,
      wrongPasswordRejected,
      generated,
      generatedRoundTrip: generated && window.dcodeIO.bcrypt.compareSync('Toolkit test', generatedHash)
    };
  })()`);
  assert.deepEqual(result, {
    knownVectorMatches: true,
    wrongPasswordRejected: true,
    generated: true,
    generatedRoundTrip: true
  }, 'Bcrypt Generator: standard-vector verification or generated-hash round trip failed.');
}

async function assertConventionalCoreTools(bidi, context, baseUrl) {
  async function run(slug, body, language = 'en') {
    await navigateRaw(bidi, context, `${baseUrl}/${language === 'tr' ? 'tr/' : ''}tools/${slug}.html`);
    const result = await evaluate(bidi, context, `(async () => {
      const wait = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      ${body}
    })()`);
    assert.equal(result.ok, true, `${slug}: ${result.message || 'core functional assertion failed.'}`);
  }

  await run('base64', `
    const source = 'İstanbul çığ 🧪';
    const input = document.querySelector('#b64Input');
    input.value = source;
    document.querySelector('#b64EncodeBtn').click();
    const encoded = document.querySelector('#b64Output').value;
    input.value = encoded;
    document.querySelector('#b64DecodeBtn').click();
    return {
      ok: encoded === 'xLBzdGFuYnVsIMOnxLHEnyDwn6eq' && document.querySelector('#b64Output').value === source,
      message: 'UTF-8 Base64 vector or round trip failed.'
    };`);

  await run('base32', `
    const source = 'İstanbul çığ 🧪';
    const input = document.querySelector('#base32Input');
    input.value = source;
    document.querySelector('#base32EncodeBtn').click();
    const encoded = document.querySelector('#base32Output').value;
    input.value = encoded;
    document.querySelector('#base32DecodeBtn').click();
    return {
      ok: encoded === 'YSYHG5DBNZRHK3BAYOT4JMOET4QPBH5HVI======' && document.querySelector('#base32Output').value === source,
      message: 'RFC 4648 UTF-8 Base32 vector or round trip failed.'
    };`);

  await run('binary-text', `
    const source = 'İstanbul çığ 🧪';
    const expected = '11000100 10110000 01110011 01110100 01100001 01101110 01100010 01110101 01101100 00100000 11000011 10100111 11000100 10110001 11000100 10011111 00100000 11110000 10011111 10100111 10101010';
    const input = document.querySelector('#binInput');
    input.value = source;
    document.querySelector('#binEncodeBtn').click();
    const encoded = document.querySelector('#binOutput').value;
    input.value = encoded;
    document.querySelector('#binDecodeBtn').click();
    return {
      ok: encoded === expected && document.querySelector('#binOutput').value === source,
      message: 'UTF-8 binary vector or round trip failed.'
    };`);

  await run('hex-codec', `
    const source = 'İstanbul çığ 🧪';
    const input = document.querySelector('#hexInput');
    input.value = source;
    document.querySelector('#hexEncodeBtn').click();
    const encoded = document.querySelector('#hexOutput').value;
    input.value = encoded;
    document.querySelector('#hexDecodeBtn').click();
    return {
      ok: encoded === 'c4 b0 73 74 61 6e 62 75 6c 20 c3 a7 c4 b1 c4 9f 20 f0 9f a7 aa' && document.querySelector('#hexOutput').value === source,
      message: 'UTF-8 hexadecimal vector or round trip failed.'
    };`);

  await run('html-codec', `
    const source = 'İstanbul çığ 🧪';
    const input = document.querySelector('#htmlInput');
    document.querySelector('#htmlExtended').checked = true;
    input.value = source;
    document.querySelector('#htmlEncodeBtn').click();
    const encoded = document.querySelector('#htmlOutput').value;
    input.value = encoded;
    document.querySelector('#htmlDecodeBtn').click();
    return {
      ok: encoded === '&#304;stanbul &#231;&#305;&#287; &#129514;' && document.querySelector('#htmlOutput').value === source,
      message: 'Unicode code points were not preserved by HTML entity conversion.'
    };`);

  await run('text-reverser', `
    const family = '👨‍👩‍👧‍👦';
    const source = 'A' + family + 'é';
    document.querySelector('#tr-input').value = source;
    document.querySelector('#tr-reverse-btn').click();
    return {
      ok: document.querySelector('#tr-output').value === 'é' + family + 'A',
      message: 'Grapheme reversal split a combining sequence or joined emoji.'
    };`);

  await run('word-counter', `
    const input = document.querySelector('#wc-input');
    input.value = 'A👨‍👩‍👧‍👦é';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      ok: document.querySelector('#wc-chars').textContent === '3' && document.querySelector('#wc-chars-ns').textContent === '3',
      message: 'Character totals count UTF-16 units instead of graphemes.'
    };`);

  await run('slug', `
    const input = document.querySelector('#slug-input');
    input.value = 'İstanbul Iğdır Şişli';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      ok: document.querySelector('#slug-output').value === 'istanbul-igdir-sisli',
      message: 'Turkish dotted or dotless I transliteration is incorrect.'
    };`);

  await run('number-base', `
    const decimal = document.querySelector('#numDec');
    decimal.value = '9007199254740993';
    decimal.dispatchEvent(new Event('input', { bubbles: true }));
    const exact = document.querySelector('#numHex').value === '20000000000001';
    const binary = document.querySelector('#numBin');
    binary.value = '102';
    binary.dispatchEvent(new Event('input', { bubbles: true }));
    const invalidRejected = binary.getAttribute('aria-invalid') === 'true'
      && document.querySelector('#numDec').value === '9007199254740993';
    document.querySelector('#custInput').value = 'ZZ';
    document.querySelector('#custFrom').value = '36';
    document.querySelector('#custTo').value = '10';
    document.querySelector('#custInput').dispatchEvent(new Event('input', { bubbles: true }));
    return {
      ok: exact && invalidRejected && document.querySelector('#custResult').textContent === '1295',
      message: 'Large integer precision, strict digit validation, or custom conversion failed.'
    };`);

  await run('password', `
    const originalRandom = window.secureRandInt;
    window.secureRandInt = () => 0;
    try {
      document.querySelector('#pwdLength').value = '4';
      ['#optUpper', '#optLower', '#optNumbers', '#optSymbols', '#optAmbiguous'].forEach((selector) => {
        document.querySelector(selector).checked = true;
      });
      document.querySelector('#pwdGenBtn').click();
      const password = document.querySelector('#pwdOutput').textContent;
      return {
        ok: password.length === 4 && /[A-Z]/.test(password) && /[a-z]/.test(password)
          && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) && !/[0Ol1I|]/.test(password),
        message: 'Selected character types are not all guaranteed or ambiguous characters leaked.'
      };
    } finally {
      window.secureRandInt = originalRandom;
    }`);

  await run('case-converter', `
    const input = document.querySelector('#caseInput');
    input.value = 'istanbul ışık. izmir işi';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    let values = [...document.querySelectorAll('.case-value')].map((node) => node.textContent);
    const casing = values[0] === 'İSTANBUL IŞIK. İZMİR İŞİ'
      && values[2] === 'İstanbul Işık. İzmir İşi';
    window.__caseConverterXss = false;
    input.value = '<img src=x onerror="window.__caseConverterXss=true"> Home';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(50);
    values = [...document.querySelectorAll('.case-value')].map((node) => node.textContent);
    const titleIndex = 2;
    const untouched = values[titleIndex].endsWith('Home');
    const safe = !window.__caseConverterXss && !document.querySelector('.case-value img');
    return {
      ok: casing && untouched && safe,
      message: 'Turkish casing, i18n output isolation, or safe rendering failed.'
    };`, 'tr');

  await run('markdown', `
    window.__markdownXss = false;
    const input = document.querySelector('#mdInput');
    input.value = '<img src=x onerror="window.__markdownXss=true">\\n\\n[Safe](https://example.test/path)\\n\\n[Unsafe](javascript:window.__markdownXss=true)\\n\\n![Remote](https://example.test/pixel.png)';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(50);
    const preview = document.querySelector('#mdPreview');
    const links = [...preview.querySelectorAll('a')];
    return {
      ok: !window.__markdownXss && !preview.querySelector('img') && links.length === 1
        && links[0].href === 'https://example.test/path' && preview.textContent.includes('Unsafe'),
      message: 'Raw HTML, unsafe link schemes, or automatic remote images escaped the safe preview.'
    };`);

  await run('qr-generator', `
    const source = 'İstanbul çığ 🧪';
    document.querySelector('#qrText').value = source;
    document.querySelector('#qrGenBtn').click();
    const canvas = document.querySelector('#qrOutput canvas');
    const script = document.createElement('script');
    const loaded = new Promise((resolve, reject) => {
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
    });
    script.src = '../assets/js/vendor/jsQR.min.js';
    document.head.appendChild(script);
    await loaded;
    const image = canvas?.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const decoded = image ? window.jsQR(image.data, image.width, image.height) : null;
    return {
      ok: Boolean(canvas && decoded?.data === source && !document.querySelector('#qrActions').hidden),
      message: 'Generated QR code does not round-trip Turkish and supplementary Unicode text.'
    };`);

  await run('qr-batch', `
    document.querySelector('#qrbValues').value = 'İstanbul 🧪\\nsecond value';
    document.querySelector('#qrbGenerate').click();
    await wait(20);
    return {
      ok: document.querySelectorAll('#qrbGrid canvas').length === 2
        && document.querySelector('#qrbCount').textContent.includes('2 QR codes generated'),
      message: 'Batch QR generation did not create one canvas per input line.'
    };`);

  await run('qr-reader', `
    const loadScript = (source) => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
    await loadScript('/assets/js/vendor/qrcode-generator.js');
    await loadScript('/assets/js/vendor/qrcode-generator-utf8.js');
    const payload = 'WIFI:T:WPA;S:<img src=x onerror="window.__qrReaderXss=true">;P:secret;H:false;;';
    const code = window.qrcode(0, 'M');
    code.addData(payload, 'Byte');
    code.make();
    const modules = code.getModuleCount();
    const margin = 4;
    const scale = 8;
    const canvas = document.createElement('canvas');
    canvas.width = (modules + margin * 2) * scale;
    canvas.height = canvas.width;
    const drawing = canvas.getContext('2d');
    drawing.fillStyle = '#ffffff';
    drawing.fillRect(0, 0, canvas.width, canvas.height);
    drawing.fillStyle = '#000000';
    for (let row = 0; row < modules; row += 1) {
      for (let column = 0; column < modules; column += 1) {
        if (code.isDark(row, column)) drawing.fillRect((column + margin) * scale, (row + margin) * scale, scale, scale);
      }
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'unsafe-qr.png', { type: 'image/png' }));
    window.__qrReaderXss = false;
    const input = document.querySelector('#qrFileInput');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    for (let attempt = 0; attempt < 120 && !document.querySelector('.wifi-val'); attempt += 1) await wait(25);
    await wait(30);
    const values = [...document.querySelectorAll('.wifi-val')].map((node) => node.textContent);
    return {
      ok: !window.__qrReaderXss && !document.querySelector('#qrReaderResult img')
        && values.includes('<img src=x onerror="window.__qrReaderXss=true">'),
      message: 'Decoded QR content was not preserved safely in the result view.'
    };`, 'tr');
}

async function assertHomeCategoryFilterLayout(bidi, context, baseUrl) {
  await bidi.call('browsingContext.setViewport', { context, viewport: { width: 1024, height: 900 }, devicePixelRatio: 1 });
  const measure = `(async () => {
    for (let attempt = 0; attempt < 50 && !window.ToolkitI18n; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const filter = document.querySelector('.hub-filter');
    const track = document.querySelector('.hub-filter-track');
    const buttons = [...document.querySelectorAll('.hub-filter-btn')];
    const layout = () => {
      const rows = new Set(buttons.map((button) => Math.round(button.offsetTop)));
      const filterRect = filter.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      return {
        singleRow: rows.size === 1,
        // Tabs start at the left edge of the content column, under the search box.
        aligned: Math.abs(trackRect.left - filterRect.left) <= 1
      };
    };
    return {
      noPageOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      language: document.documentElement.lang,
      layout: layout(),
      hasAllCategories: buttons.length === 9
    };
  })()`;
  await navigateRaw(bidi, context, `${baseUrl}/`);
  const englishPage = await evaluate(bidi, context, measure);
  await navigateRaw(bidi, context, `${baseUrl}/tr/index.html`);
  const turkishPage = await evaluate(bidi, context, measure);
  const desktop = {
    noPageOverflow: englishPage.noPageOverflow && turkishPage.noPageOverflow,
    english: englishPage.layout,
    turkish: turkishPage.layout,
    hasAllCategories: englishPage.hasAllCategories && turkishPage.hasAllCategories
  };
  assert.deepEqual([englishPage.language, turkishPage.language], ['en', 'tr'], 'Homepage: wrong page language.');
  assert.equal(desktop.noPageOverflow, true, 'Homepage: Turkish category filters cause page-level horizontal overflow.');
  assert.equal(desktop.english.singleRow, true, 'Homepage: English category filters wrap onto multiple rows.');
  assert.equal(desktop.english.aligned, true, 'Homepage: English category tabs are not left-aligned.');
  assert.equal(desktop.turkish.singleRow, true, 'Homepage: Turkish category filters wrap onto multiple rows.');
  assert.equal(desktop.turkish.aligned, true, 'Homepage: Turkish category tabs are not left-aligned.');
  assert.equal(desktop.hasAllCategories, true, 'Homepage: a category filter is missing.');

  await bidi.call('browsingContext.setViewport', { context, viewport: { width: 390, height: 844 }, devicePixelRatio: 1 });
  const mobile = await evaluate(bidi, context, `(() => {
    const filter = document.querySelector('.hub-filter');
    const buttons = [...document.querySelectorAll('.hub-filter-btn')];
    const rows = new Set(buttons.map((button) => Math.round(button.offsetTop)));
    return {
      noPageOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      singleRow: rows.size === 1,
      scrollable: filter.scrollWidth > filter.clientWidth
    };
  })()`);
  assert.equal(mobile.noPageOverflow, true, 'Homepage: mobile category filters cause page-level horizontal overflow.');
  assert.equal(mobile.singleRow, true, 'Homepage: mobile category filters wrap onto multiple rows.');
  assert.equal(mobile.scrollable, true, 'Homepage: mobile category filters are not horizontally reachable.');
}

async function assertTypingCoreFlow(bidi, context, baseUrl) {
  await navigateRaw(bidi, context, `${baseUrl}/tools/typing-test.html`);
  await evaluate(bidi, context, `(() => {
    localStorage.removeItem('toolkit-language');
    localStorage.removeItem('toolkit-typing-test-settings');
    localStorage.removeItem('toolkit-typing-test-records');
    return true;
  })()`);
  await navigateRaw(bidi, context, `${baseUrl}/tools/typing-test.html`);
  const result = await evaluate(bidi, context, `(async () => {
    const wait = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const waitFor = async (predicate, message) => {
      for (let attempt = 0; attempt < 160; attempt += 1) {
        if (predicate()) return;
        await wait(25);
      }
      throw new Error(message);
    };
    const words = () => [...document.querySelectorAll('#tt-stream .tt-word')]
      .map((node) => [...node.querySelectorAll('.tt-char:not(.tt-char--reserved)')]
        .map((character) => character.textContent).join(''));
    const waitForReady = () => waitFor(
      () => !document.querySelector('#tt-start-selected').disabled && words().length,
      'Typing test did not prepare a word stream.'
    );
    const typeCurrentRun = async () => {
      const input = document.querySelector('#tt-input');
      const runWords = words();
      const first = runWords[0];
      const initialCaret = document.querySelector('#tt-caret').style.transform;
      input.value = Array.from(first)[0];
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const caretMoved = document.querySelector('#tt-caret').style.transform !== initialCaret;
      const liveCaret = getComputedStyle(document.querySelector('#tt-caret')).transitionDuration === '0s';
      await wait(280);
      input.value = first + ' ';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      for (const word of runWords.slice(1)) {
        input.value = word + ' ';
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      }
      await waitFor(() => !document.querySelector('#tt-results').hidden, 'Typing results did not open.');
      return { caretMoved, liveCaret };
    };

    await waitForReady();
    const initialCategory = document.querySelector('.tt-chip--selected')?.dataset.category;
    const initialDuration = document.querySelector('[data-duration="60"]')?.getAttribute('aria-checked');
    const categoryCount = document.querySelectorAll('.tt-chip').length;
    document.querySelector('#tt-prepare').click();
    await waitFor(() => !document.querySelector('#tt-test').hidden, 'Quick start did not open the test.');
    const quickStart = {
      category: initialCategory,
      duration: initialDuration,
      categoryCount,
      timer: document.querySelector('#tt-timer').textContent
    };
    document.querySelector('#tt-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await waitFor(() => !document.querySelector('#tt-config').hidden, 'Escape did not return to settings.');

    document.querySelector('#tt-customize-toggle').click();
    const language = document.querySelector('#tt-language');
    language.value = 'en';
    language.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-mode="words"]').click();
    document.querySelector('[data-practice="custom"]').click();
    const custom = document.querySelector('#tt-custom-text');
    custom.value = 'Home Copy Clear Value open close';
    custom.dispatchEvent(new Event('input', { bubbles: true }));
    await waitForReady();
    document.querySelector('#tt-start-selected').click();
    await waitFor(() => !document.querySelector('#tt-test').hidden, 'Selected test did not open.');

    const shell = document.querySelector('#tt-stream-shell');
    const stream = document.querySelector('#tt-stream');
    const shellStyle = getComputedStyle(shell);
    const usableHeight = shell.clientHeight
      - Number.parseFloat(shellStyle.paddingTop)
      - Number.parseFloat(shellStyle.paddingBottom);
    const lineHeight = Number.parseFloat(getComputedStyle(stream).lineHeight);
    const compactThreeLines = usableHeight >= lineHeight * 2.8 && usableHeight <= lineHeight * 3.2;
    // Custom words that are also interface keys stay as typed.
    const streamIsolated = /Home|Copy|Clear|Value|open|close/.test(words().join(' '));
    const englishInputAndLayout = document.querySelector('#tt-input').lang === 'en';

    const firstRun = await typeCurrentRun();
    const keyboardLabels = [...document.querySelectorAll('#tt-keyboard .tt-key-label')]
      .map((node) => node.textContent).join('');
    const firstResult = {
      resultsFocused: document.activeElement === document.querySelector('#tt-results-heading'),
      accuracy: document.querySelector('#tt-result-accuracy').textContent,
      correct: Number(document.querySelector('#tt-correct').textContent),
      descriptor: document.querySelector('#tt-descriptor').textContent,
      englishKeyboard: keyboardLabels === 'QWERTYUIOPASDFGHJKLZXCVBNM',
      noStoredRecord: localStorage.getItem('toolkit-typing-test-records') === null
    };

    const remember = document.querySelector('#tt-remember');
    remember.checked = true;
    remember.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#tt-restart').click();
    await waitFor(() => !document.querySelector('#tt-test').hidden, 'Restart did not reopen the test.');
    const secondRun = await typeCurrentRun();
    const stored = JSON.parse(localStorage.getItem('toolkit-typing-test-records') || '{}');
    const storedValues = Object.values(stored);
    const recordShapeSafe = storedValues.length === 1
      && Object.keys(storedValues[0]).sort().join(',') === 'accuracy,netWpm,scoring'
      && !JSON.stringify(stored).includes('Home');
    const settingsSafe = !String(localStorage.getItem('toolkit-typing-test-settings')).includes('Home');
    const clearVisible = !document.querySelector('#tt-clear-records').hidden;
    document.querySelector('#tt-clear-records').click();
    const clearWorked = localStorage.getItem('toolkit-typing-test-records') === null
      && document.querySelector('#tt-clear-records').hidden;

    localStorage.removeItem('toolkit-typing-test-settings');
    return {
      ok: quickStart.category === 'common-1000'
        && quickStart.duration === 'true'
        && quickStart.categoryCount === 10
        && quickStart.timer === '1:00'
        && compactThreeLines
        && streamIsolated
        && englishInputAndLayout
        && firstRun.caretMoved
        && firstRun.liveCaret
        && secondRun.caretMoved
        && secondRun.liveCaret
        && firstResult.resultsFocused
        && firstResult.accuracy.startsWith('100')
        && firstResult.correct > 0
        && firstResult.descriptor.includes('6 words')
        && firstResult.englishKeyboard
        && firstResult.noStoredRecord
        && recordShapeSafe
        && settingsSafe
        && clearVisible
        && clearWorked,
      message: JSON.stringify({ quickStart, compactThreeLines, streamIsolated, englishInputAndLayout, firstRun, firstResult, secondRun, recordShapeSafe, settingsSafe, clearVisible, clearWorked })
    };
  })()`);
  assert.equal(result.ok, true, `Typing test core flow failed: ${result.message}`);
}

async function assertTypingTurkishDiacritics(bidi, context, baseUrl) {
  await navigateRaw(bidi, context, `${baseUrl}/tr/tools/typing-test.html`);
  const result = await evaluate(bidi, context, `(async () => {
    const wait = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const waitFor = async (predicate, message) => {
      for (let attempt = 0; attempt < 160; attempt += 1) {
        if (predicate()) return;
        await wait(25);
      }
      throw new Error(message);
    };
    const displayedWords = () => [...document.querySelectorAll('#tt-stream .tt-word')]
      .map((node) => [...node.querySelectorAll('.tt-char:not(.tt-char--reserved)')]
        .map((character) => character.textContent).join(''));
    const waitForReady = () => waitFor(
      () => !document.querySelector('#tt-start-selected').disabled && displayedWords().length,
      'Turkish practice did not become ready.'
    );
    // Drop only the accents; lenient mode still requires the letter case shown.
    const asciiTurkish = (value) => value.normalize('NFC')
      .replace(/[çğıöşüÇĞİÖŞÜ]/g, (character) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' })[character]);

    await waitForReady();
    document.querySelector('#tt-customize-toggle').click();
    const language = document.querySelector('#tt-language');
    language.value = 'tr';
    language.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-mode="words"]').click();
    document.querySelector('[data-practice="custom"]').click();
    const custom = document.querySelector('#tt-custom-text');
    custom.value = 'İstanbul şık';
    custom.dispatchEvent(new Event('input', { bubbles: true }));
    await waitForReady();
    const strict = document.querySelector('#tt-strict');
    const strictVisual = strict.checked && strict.closest('.checkbox-card').classList.contains('tt-checkbox-card--selected');
    document.querySelector('#tt-start-selected').click();
    await waitFor(() => !document.querySelector('#tt-test').hidden, 'Strict Turkish test did not open.');
    let runWords = displayedWords();
    const strictInput = document.querySelector('#tt-input');
    strictInput.value = Array.from(asciiTurkish(runWords[0]))[0];
    strictInput.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const strictRejected = Boolean(document.querySelector('.tt-word--active .tt-char--incorrect'))
      && !document.querySelector('#tt-live-accuracy').textContent.startsWith('100');
    strictInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await waitFor(() => !document.querySelector('#tt-config').hidden, 'Escape did not end the strict Turkish run.');

    strict.checked = false;
    strict.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForReady();
    const lenientVisual = !strict.closest('.checkbox-card').classList.contains('tt-checkbox-card--selected');
    document.querySelector('#tt-start-selected').click();
    await waitFor(() => !document.querySelector('#tt-test').hidden, 'Lenient Turkish test did not open.');
    runWords = displayedWords();
    const input = document.querySelector('#tt-input');
    const firstAscii = asciiTurkish(runWords[0]);
    input.value = Array.from(firstAscii)[0];
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    await wait(300);
    input.value = firstAscii + ' ';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    for (const word of runWords.slice(1)) {
      input.value = asciiTurkish(word) + ' ';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    }
    await waitFor(() => !document.querySelector('#tt-results').hidden, 'Lenient Turkish results did not open.');
    const keyboard = [...document.querySelectorAll('#tt-keyboard .tt-key-label')]
      .map((node) => node.textContent).join('');
    const answer = {
      strictVisual,
      strictRejected,
      lenientVisual,
      exactGlyphsRemain: runWords.includes('İstanbul') && runWords.includes('şık'),
      lenientAccepted: document.querySelector('#tt-result-accuracy').textContent.startsWith('100'),
      lenientLabelled: document.querySelector('#tt-descriptor').textContent.includes('Esnek Türkçe karakterler'),
      turkishInput: input.lang === 'tr',
      turkishKeyboard: keyboard === 'QWERTYUIOPĞÜASDFGHJKLŞİZXCVBNMÖÇ',
      noPersistedResult: localStorage.getItem('toolkit-typing-test-records') === null
    };
    localStorage.removeItem('toolkit-typing-test-settings');
    localStorage.removeItem('toolkit-typing-test-records');
    return { ok: Object.values(answer).every(Boolean), message: JSON.stringify(answer) };
  })()`);
  assert.equal(result.ok, true, `Typing test Turkish-diacritic flow failed: ${result.message}`);
}

async function assertTypingPracticeOrdering(bidi, context, baseUrl) {
  await bidi.call('browsingContext.setViewport', { context, viewport: { width: 1024, height: 900 }, devicePixelRatio: 1 });
  await navigateRaw(bidi, context, `${baseUrl}/tools/typing-test.html`);
  const result = await evaluate(bidi, context, `(async () => {
    const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const waitForReady = async () => {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const words = document.querySelectorAll('#tt-stream .tt-word');
        if (!document.querySelector('#tt-start-selected').disabled && words.length) return;
        await wait(50);
      }
      throw new Error('Typing test did not prepare a word stream.');
    };
    const words = () => [...document.querySelectorAll('#tt-stream .tt-word')]
      .map((node) => [...node.querySelectorAll('.tt-char:not(.tt-char--reserved)')]
        .map((character) => character.textContent).join(''));
    const choose = async (practice) => {
      document.querySelector('[data-practice="' + practice + '"]').click();
      await waitForReady();
    };
    for (let attempt = 0; attempt < 120 && !window.ToolkitI18n; attempt += 1) await wait(25);
    const originalRandom = window.secureRandInt;
    let cursor = 0;
    window.secureRandInt = (maximum) => {
      cursor += 1;
      return cursor % maximum;
    };
    try {
      document.querySelector('[data-mode="words"]').click();
      await waitForReady();
      document.querySelector('[data-practice="custom"]').click();
      const customInput = document.querySelector('#tt-custom-text');
      customInput.value = 'atlas birch cedar delta ember fable grove harbor indigo juniper kettle lantern';
      customInput.dispatchEvent(new Event('input', { bubbles: true }));
      await waitForReady();
      const firstCustom = words();
      document.querySelector('#tt-new').click();
      await waitForReady();
      const secondCustom = words();

      await choose('code');
      const firstCode = words();
      document.querySelector('#tt-new').click();
      await waitForReady();
      const secondCode = words();

      await choose('daily');
      const firstDaily = words().slice(0, 20);
      document.querySelector('#tt-new').click();
      await waitForReady();
      const secondDaily = words().slice(0, 20);
      return {
        customUsesEveryEntry: firstCustom.length === 12 && new Set(firstCustom).size === 12,
        customNewTestChangesOrder: firstCustom.join(' ') !== secondCustom.join(' '),
        codeNewTestChangesSnippetOrder: firstCode.join(' ') !== secondCode.join(' '),
        dailyNewTestIsStable: firstDaily.join(' ') === secondDaily.join(' ')
      };
    } finally {
      window.secureRandInt = originalRandom;
    }
  })()`);
  assert.equal(result.customUsesEveryEntry, true, 'Typing test: custom practice does not use every supplied entry before repeating.');
  assert.equal(result.customNewTestChangesOrder, true, 'Typing test: New test does not reshuffle custom practice.');
  assert.equal(result.codeNewTestChangesSnippetOrder, true, 'Typing test: New test does not reshuffle code snippets.');
  assert.equal(result.dailyNewTestIsStable, true, 'Typing test: daily challenge changes before the UTC day changes.');
}

const tests = {
  'aes-gcm': `
    const text = document.querySelector('#aesText');
    document.querySelector('#aesPass').value = 'correct horse battery staple';
    text.value = 'Toolkit round-trip ✓';
    document.querySelector('#aesEncrypt').click();
    for (let i = 0; i < 100 && !document.querySelector('#aesOutput').value; i++) await wait(50);
    const payload = document.querySelector('#aesOutput').value;
    expect(JSON.parse(payload).alg === 'AES-256-GCM', 'Encryption did not create an AES-GCM payload.');
    text.value = payload;
    document.querySelector('#aesDecrypt').click();
    for (let i = 0; i < 100 && document.querySelector('#aesOutput').value !== 'Toolkit round-trip ✓'; i++) await wait(50);
    return { ok: document.querySelector('#aesOutput').value === 'Toolkit round-trip ✓', message: 'AES decrypt did not restore the plaintext.' };`,
  'rsa-keypair': `
    document.querySelector('#rsaGenerate').click();
    for (let i = 0; i < 300 && !document.querySelector('#rsaPrivate').value; i++) await wait(50);
    const publicKey = document.querySelector('#rsaPublic').value;
    const privateKey = document.querySelector('#rsaPrivate').value;
    return { ok: publicKey.includes('BEGIN PUBLIC KEY') && privateKey.includes('BEGIN PRIVATE KEY'), message: 'RSA PEM export is incomplete.' };`,
  'pem-jwk': `
    const pair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
    const source = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.publicKey));
    document.querySelector('#pemInput').value = source;
    document.querySelector('#pemConvert').click();
    for (let i = 0; i < 100 && !document.querySelector('#pemOutput').value; i++) await wait(25);
    const pem = document.querySelector('#pemOutput').value;
    document.querySelector('#pemInput').value = pem;
    document.querySelector('#pemConvert').click();
    for (let i = 0; i < 100 && !document.querySelector('#pemOutput').value.startsWith('{'); i++) await wait(25);
    const converted = JSON.parse(document.querySelector('#pemOutput').value);
    return { ok: Boolean(pem.includes('BEGIN PUBLIC KEY') && converted.kty === 'RSA' && converted.n), message: 'PEM/JWK public-key round trip failed.' };`,
  'certificate-inspector': `
    document.querySelector('#certInput').value = '-----BEGIN CERTIFICATE-----\\nMAMCAQE=\\n-----END CERTIFICATE-----';
    document.querySelector('#certInspect').click();
    const output = document.querySelector('#certOutput').value;
    return { ok: output.includes('Certificate size: 5 bytes') && output.includes('SEQUENCE') && output.includes('INTEGER'), message: 'DER report was not generated.' };`,
  'totp': `
    document.querySelector('#totpSecret').value = 'JBSWY3DPEHPK3PXP';
    document.querySelector('#totpGenerate').click();
    for (let i = 0; i < 40 && !/^\\d{6}$/.test(document.querySelector('#totpCode').textContent); i++) await wait(25);
    return { ok: /^\\d{6}$/.test(document.querySelector('#totpCode').textContent) && /Refreshes in/.test(document.querySelector('#totpCountdown').textContent), message: 'TOTP code or countdown did not render.' };`,
  'csp-generator': `
    document.querySelector('#cspDirectives').value = "default-src 'self'\\nimg-src https: data:";
    document.querySelector('#cspBuild').click();
    return { ok: document.querySelector('#cspOutput').value === "Content-Security-Policy: default-src 'self'; img-src https: data:", message: 'CSP header output is incorrect.' };`,
  'curl-builder': `
    document.querySelector('#curlMethod').value = 'POST';
    document.querySelector('#curlUrl').value = 'https://api.example.test/items';
    document.querySelector('#curlHeaders').value = 'Content-Type: application/json';
    document.querySelector('#curlBody').value = '{"name":"Ada"}';
    document.querySelector('#curlBuild').click();
    const slash = String.fromCharCode(92);
    const expected = ['curl --request POST ' + slash, "  'https://api.example.test/items' " + slash, "  --header 'Content-Type: application/json' " + slash, '  --data ' + String.fromCharCode(39) + '{"name":"Ada"}' + String.fromCharCode(39)].join('\\n');
    return { ok: document.querySelector('#curlOutput').value === expected, message: 'cURL command does not preserve valid shell continuations.' };`,
  'http-header-analyzer': `
    document.querySelector('#headerInput').value = "HTTP/2 200 OK\\nContent-Security-Policy: default-src 'self'\\nStrict-Transport-Security: max-age=31536000";
    document.querySelector('#headerAnalyze').click();
    const text = document.querySelector('#headerResults').textContent;
    return { ok: text.includes('✓ Content-Security-Policy') && text.includes('✓ Strict-Transport-Security') && text.includes('○ X-Content-Type-Options'), message: 'Header presence report is incorrect.' };`,
  'cron-assistant': `
    document.querySelector('#cronInput').value = '0 0 * * 7';
    document.querySelector('#cronRun').click();
    const sundayScheduled = document.querySelectorAll('#cronResult li').length === 5;
    document.querySelector('#cronInput').value = '0 0 13 * 5';
    document.querySelector('#cronRun').click();
    const scheduled = document.querySelectorAll('#cronResult li').length === 5;
    document.querySelector('#cronInput').value = '61 * * * *';
    document.querySelector('#cronRun').click();
    await wait(20);
    const invalidReported = [...document.querySelectorAll('.toast-msg')].some((node) => node.textContent.includes('outside its allowed range'));
    return { ok: sundayScheduled && scheduled && invalidReported, message: 'Cron scheduling semantics or range validation failed.' };`,
  'unix-permissions': `
    const octal = document.querySelector('#permOctal');
    octal.value = '755'; octal.dispatchEvent(new Event('input', { bubbles: true }));
    const first = document.querySelector('#permSymbolic').textContent;
    const boxes = document.querySelectorAll('#permChecks input');
    boxes[7].click();
    return { ok: first === 'rwxr-xr-x' && octal.value === '757' && document.querySelector('#permSymbolic').textContent === 'rwxr-xrwx', message: 'Octal and checkbox permissions are out of sync.' };`,
  'css-specificity': `
    document.querySelector('#specificityInput').value = '#app .card:hover > h2::before';
    document.querySelector('#specificityRun').click();
    return { ok: document.querySelector('#specificityResult').textContent.startsWith('Specificity: 1-2-2'), message: 'Basic selector specificity is incorrect.' };`,
  'css-clamp': `
    document.querySelector('#clampMin').value = '16'; document.querySelector('#clampMax').value = '24';
    document.querySelector('#clampVmin').value = '320'; document.querySelector('#clampVmax').value = '1280';
    document.querySelector('#clampRun').click();
    return { ok: document.querySelector('#clampOutput').value === 'font-size: clamp(16px, calc(0.8333vw + 13.3333px), 24px);', message: 'clamp() calculation is incorrect.' };`,
  'json-to-typescript': `
    document.querySelector('#tsInput').value = '{"user":{"id":1,"active":true}}';
    document.querySelector('#tsRun').click();
    const output = document.querySelector('#tsOutput').value;
    return { ok: output.includes('type Root =') && output.includes('"id": number;') && output.includes('"active": boolean;'), message: 'TypeScript inference is incomplete.' };`,
  'json-to-markdown': `
    document.querySelector('#markdownJsonInput').value = '[{"name":"Ada","note":"a|b"},{"name":"Lin","active":true}]';
    document.querySelector('#markdownJsonRun').click();
    const output = document.querySelector('#markdownJsonOutput').value;
    return { ok: output.includes('| name | note | active |') && output.includes('a\\\\|b') && output.includes('| Lin |  | true |'), message: 'Markdown table conversion or escaping failed.' };`,
  'xml-to-json': `
    document.querySelector('#xmlJsonInput').value = '<person id="1"><name>Ada</name><role>Engineer</role></person>';
    document.querySelector('#xmlJsonRun').click();
    const output = JSON.parse(document.querySelector('#xmlJsonOutput').value);
    return { ok: output.person['@id'] === '1' && output.person.name['#text'] === 'Ada' && output.person.role['#text'] === 'Engineer', message: 'XML structure was not preserved in JSON.' };`,
  'csv-viewer': `
    document.querySelector('#csvViewerInput').value = 'name,note\\nAda,"hello, world"';
    document.querySelector('#csvViewerRun').click();
    const cells = [...document.querySelectorAll('#csvViewerResult td')].map((node) => node.textContent);
    return { ok: cells.join('|') === 'Ada|hello, world', message: 'Quoted CSV cell parsing failed.' };`,
  'unicode-inspector': `
    document.querySelector('#unicodeInput').value = 'e\\u0301👋';
    document.querySelector('#unicodeForm').value = 'NFC';
    document.querySelector('#unicodeRun').click();
    const output = document.querySelector('#unicodeOutput').value;
    return { ok: output.includes('Normalized (NFC): é👋') && output.includes('U+0301') && output.includes('U+1F44B'), message: 'Unicode normalization or code point inspection failed.' };`,
  'time-zone-converter': `
    document.querySelector('#zoneDate').value = '2026-01-15T12:00';
    document.querySelector('#zoneList').value = 'UTC\\nEurope/Istanbul\\nInvalid/Zone';
    document.querySelector('#zoneRun').click();
    const rows = [...document.querySelectorAll('#zoneResult p')].map((node) => node.textContent);
    return { ok: rows.length === 3 && rows[0].startsWith('UTC:') && rows[1].startsWith('Europe/Istanbul:') && rows[2].includes('unsupported time zone'), message: 'Time zone conversion result is incomplete.' };`,
  'date-duration': `
    document.querySelector('#durationStart').value = '2024-01-01';
    document.querySelector('#durationEnd').value = '2024-03-01';
    document.querySelector('#durationRun').click();
    return { ok: document.querySelector('#durationResult').textContent.startsWith('60 days • 8.57 weeks'), message: 'Leap-year date duration is incorrect.' };`,
  'image-compressor': `
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 10;
    canvas.getContext('2d').fillRect(0, 0, 20, 10);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'fixture.png', { type: 'image/png' }));
    const input = document.querySelector('#imageCompressInput'); input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#imageMaxWidth').value = '10';
    document.querySelector('#imageFormat').value = 'image/jpeg';
    document.querySelector('#imageCompressRun').click();
    for (let i = 0; i < 100 && !document.querySelector('#imageCompressResult a'); i++) await wait(25);
    const result = document.querySelector('#imageCompressResult');
    const pickerIsCustom = input.classList.contains('sr-only')
      && document.querySelector('label[for="imageCompressInput"].file-picker__trigger')
      && document.querySelector('#imageCompressFileName').textContent === 'fixture.png';
    return { ok: pickerIsCustom && !result.hidden && result.textContent.includes('20×10 → 10×5') && result.querySelector('a')?.download === 'compressed.jpeg', message: 'Local image compression or its accessible file picker failed.' };`,
  'sitemap-generator': `
    document.querySelector('#sitemapUrls').value = 'https://example.com/\\nhttps://example.com/about?x=1&y=2\\nhttps://example.com/';
    document.querySelector('#sitemapFreq').value = 'daily';
    document.querySelector('#sitemapPriority').value = '1.0';
    document.querySelector('#sitemapRun').click();
    const output = document.querySelector('#sitemapOutput').value;
    return { ok: (output.match(/<url>/g) || []).length === 2 && output.includes('about?x=1&amp;y=2') && output.includes('<changefreq>daily</changefreq>') && output.includes('<priority>1.0</priority>'), message: 'Sitemap output is not deduplicated or XML-safe.' };`,
  'color-contrast': `
    document.querySelector('#contrastForeground').value = '#ffffff';
    document.querySelector('#contrastBackground').value = '#000000';
    document.querySelector('#contrastRun').click();
    const output = document.querySelector('#contrastResult').textContent;
    return { ok: output.includes('Contrast ratio: 21.00:1') && output.includes('Normal text AA: Pass') && output.includes('AAA: Pass'), message: 'WCAG contrast calculation is incorrect.' };`
};

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const browserPort = await unusedPort();
  const profile = await mkdtemp(join(tmpdir(), 'toolkit-e2e-'));
  const browser = spawn(process.env.FIREFOX_BINARY || 'firefox', [
    '--headless', '--remote-debugging-port', String(browserPort), '--profile', profile
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let browserError = '';
  browser.stderr.on('data', (chunk) => { browserError += chunk; });
  let bidi;

  try {
    bidi = await connectBidi(browserPort);
    await bidi.call('session.new', { capabilities: {} });
    await bidi.call('session.subscribe', { events: ['log.entryAdded'] });
    const tab = await bidi.call('browsingContext.create', { type: 'tab' });
    const baseUrl = `http://127.0.0.1:${port}`;
    await bidi.call('browsingContext.setViewport', { context: tab.context, viewport: { width: 1440, height: 900 }, devicePixelRatio: 1 });

    for (const slug of expansionTools) {
      await runTool(bidi, tab.context, baseUrl, slug, tests[slug]);
      process.stdout.write(`✓ ${slug}\n`);
    }

    await assertI18nFormControlSafety(bidi, tab.context, baseUrl);
    process.stdout.write('✓ conventional i18n form-control safety\n');
    await assertGeneratedContentI18nIsolation(bidi, tab.context, baseUrl);
    process.stdout.write('✓ generated-content i18n isolation and private previews\n');
    await assertHmacGeneration(bidi, tab.context, baseUrl);
    process.stdout.write('✓ HMAC Generator standard vector\n');
    await assertBcryptCompatibility(bidi, tab.context, baseUrl);
    process.stdout.write('✓ bcrypt standard vector and round trip\n');
    await assertConventionalCoreTools(bidi, tab.context, baseUrl);
    process.stdout.write('✓ conventional core vectors, Unicode handling and generator invariants\n');
    await assertHomeCategoryFilterLayout(bidi, tab.context, baseUrl);
    process.stdout.write('✓ Turkish homepage category-filter layout\n');
    await assertTypingCoreFlow(bidi, tab.context, baseUrl);
    process.stdout.write('✓ typing-test quick start, metrics, i18n, keyboard and record privacy\n');
    await assertTypingTurkishDiacritics(bidi, tab.context, baseUrl);
    process.stdout.write('✓ typing-test strict and lenient Turkish diacritics\n');
    await assertTypingPracticeOrdering(bidi, tab.context, baseUrl);
    process.stdout.write('✓ typing-practice ordering\n');

    await bidi.call('browsingContext.setViewport', { context: tab.context, viewport: { width: 390, height: 844 }, devicePixelRatio: 1 });
    for (const slug of expansionTools) {
      const page = await navigate(bidi, tab.context, baseUrl, slug);
      assert.equal(page.overflow, true, `${slug}: mobile page has horizontal overflow.`);
      assert.equal(page.footerStyled, true, `${slug}: mobile footer CSS did not apply.`);
    }

    const browserErrors = bidi.events.filter((event) => event.method === 'log.entryAdded' && event.params?.level === 'error');
    assert.equal(browserErrors.length, 0, `Browser console errors:\n${browserErrors.map((event) => event.params.text || JSON.stringify(event.params)).join('\n')}`);
    console.log(`Expansion E2E passed: ${expansionTools.length} expansion tools plus conventional i18n controls across desktop, mobile and functional flows.`);
  } finally {
    try { await bidi?.call('session.end'); } catch {}
    bidi?.close();
    browser.kill('SIGTERM');
    await new Promise((resolve) => browser.once('exit', resolve));
    await new Promise((resolve) => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
    if (browser.exitCode && !bidi) throw new Error(browserError || 'Firefox could not start.');
  }
}

await main();
