#!/usr/bin/env node
/* Real service-worker installation, isolation, and offline navigation checks. */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

// TOOLKIT_SITE_ROOT lets CI test the assembled _site/ exactly as it is published.
const root = resolve(process.env.TOOLKIT_SITE_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const mountPath = '/toolkit';
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolvePromise, reject) => {
    server.listen(0, '127.0.0.1', resolvePromise).on('error', reject);
  });
  const { port } = server.address();
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return port;
}

async function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname === `${mountPath}/__offline_test_bootstrap.html`) {
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          Connection: 'close'
        });
        response.end('<!doctype html><html lang="en"><title>Offline test bootstrap</title></html>');
        return;
      }
      if (url.pathname !== mountPath && !url.pathname.startsWith(`${mountPath}/`)) {
        throw new Error('Outside mount path');
      }

      let pathname = decodeURIComponent(url.pathname.slice(mountPath.length));
      if (!pathname || pathname === '/') pathname = '/index.html';
      else if (pathname.endsWith('/')) pathname += 'index.html';
      const target = resolve(root, `.${pathname}`);
      if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error('Forbidden');
      await stat(target);
      const contents = await readFile(target);
      response.writeHead(200, {
        'Content-Type': mimeTypes[extname(target)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        Connection: 'close'
      });
      response.end(contents);
    } catch {
      // Like GitHub Pages, answer any miss inside the site with the published 404 page.
      const inside = (request.url || '').startsWith(`${mountPath}/`);
      response.writeHead(404, {
        'Content-Type': inside ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8',
        Connection: 'close'
      });
      response.end(inside ? await readFile(join(root, '404.html')) : 'Not found');
    }
  });
  await new Promise((resolvePromise, reject) => {
    server.listen(0, '127.0.0.1', resolvePromise).on('error', reject);
  });
  return server;
}

class BidiClient {
  constructor(socket) {
    this.socket = socket;
    this.sequence = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(`${message.error}: ${message.message || ''}`));
      else request.resolve(message.result);
    });
  }

  call(method, params = {}) {
    return new Promise((resolvePromise, reject) => {
      const id = ++this.sequence;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for WebDriver BiDi: ${method}`));
      }, 45_000);
      this.pending.set(id, { resolve: resolvePromise, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function connectBidi(port) {
  let lastError;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/session`);
      await new Promise((resolvePromise, reject) => {
        socket.addEventListener('open', resolvePromise, { once: true });
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

async function navigate(bidi, context, url) {
  await bidi.call('browsingContext.navigate', { context, url, wait: 'complete' });
}

async function closeServer(server) {
  if (!server.listening) return;
  const closed = new Promise((resolvePromise) => server.close(resolvePromise));
  server.closeAllConnections?.();
  await closed;
}

async function main() {
  const serviceWorker = readFileSync(join(root, 'sw.js'), 'utf8');
  const versionMatch = serviceWorker.match(/const CACHE_VERSION = '([^']+)'/);
  assert(versionMatch, 'Could not read the service-worker cache version.');
  const expectedCache = `toolkit-${versionMatch[1]}`;
  const server = await startServer();
  const serverPort = server.address().port;
  const browserPort = await unusedPort();
  const profile = await mkdtemp(join(tmpdir(), 'toolkit-offline-e2e-'));
  const browser = spawn(process.env.FIREFOX_BINARY || 'firefox', [
    '--headless', '--remote-debugging-port', String(browserPort), '--profile', profile
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let browserError = '';
  browser.stderr.on('data', (chunk) => { browserError += chunk; });
  let bidi;

  try {
    bidi = await connectBidi(browserPort);
    await bidi.call('session.new', { capabilities: {} });
    const tab = await bidi.call('browsingContext.create', { type: 'tab' });
    const origin = `http://127.0.0.1:${serverPort}`;
    const baseUrl = `${origin}${mountPath}`;

    await navigate(bidi, tab.context, `${baseUrl}/__offline_test_bootstrap.html`);
    await evaluate(bidi, tab.context, `(async () => {
      const stale = await caches.open('toolkit-v00-release-test');
      await stale.put('/toolkit/stale', new Response('stale'));
      const unrelated = await caches.open('another-project-release-test');
      await unrelated.put('/other-project/value', new Response('keep'));
      return true;
    })()`);

    await navigate(bidi, tab.context, `${baseUrl}/`);
    const installation = await evaluate(bidi, tab.context, `(async () => {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Service worker installation timed out.')), 30000))
      ]);
      // ready resolves while the worker is still "activating"; clients.claim()
      // runs inside activation, so wait for both control and the final state.
      for (let attempt = 0; attempt < 200 && (!navigator.serviceWorker.controller || registration.active?.state !== 'activated'); attempt += 1) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
      }
      const cacheNames = await caches.keys();
      const cache = await caches.open(${JSON.stringify(expectedCache)});
      const requests = (await cache.keys()).map((request) => new URL(request.url).pathname + new URL(request.url).search);
      return {
        active: registration.active?.state,
        controlled: navigator.serviceWorker.controller?.scriptURL.endsWith('/toolkit/sw.js') || false,
        cacheNames,
        requests
      };
    })()`);

    assert.equal(installation.active, 'activated', 'The real service worker did not activate.');
    assert.equal(installation.controlled, true, 'The first loaded page was not claimed by the service worker.');
    assert(installation.cacheNames.includes(expectedCache), 'The current Toolkit cache was not created.');
    assert(!installation.cacheNames.includes('toolkit-v00-release-test'), 'A stale Toolkit cache survived activation.');
    assert(installation.cacheNames.includes('another-project-release-test'), 'Toolkit deleted an unrelated origin cache.');
    for (const pathname of [
      '/toolkit/index.html',
      '/toolkit/tools/typing-test.html',
      '/toolkit/words/manifest.json',
      '/toolkit/words/en/common-1000.json',
      '/toolkit/words/tr/common-1000.json',
      '/toolkit/assets/js/vendor/qrcode-generator.js',
      '/toolkit/assets/js/vendor/bcrypt.min.js',
      '/toolkit/license/'
    ]) {
      assert(installation.requests.some((request) => request === pathname || request.startsWith(`${pathname}?`)),
        `The installed offline cache is missing ${pathname}.`);
    }

    // A miss below a subdirectory still renders the styled 404 page with site-root links.
    await navigate(bidi, tab.context, `${baseUrl}/tools/not-a-published-tool.html`);
    const nestedMissing = await evaluate(bidi, tab.context, `(async () => {
      await document.fonts.ready;
      const failed = performance.getEntriesByType('resource')
        .filter((entry) => entry.responseStatus >= 400)
        .map((entry) => entry.name);
      return {
        title: document.title,
        background: getComputedStyle(document.body).backgroundColor,
        home: document.querySelector('.nav-brand')?.href || '',
        failed
      };
    })()`);
    assert(nestedMissing.title.includes('Page Not Found'), 'A nested miss did not serve the 404 page.');
    assert.notEqual(nestedMissing.background, 'rgba(0, 0, 0, 0)', 'The nested 404 page rendered without its stylesheets.');
    assert.equal(nestedMissing.home, `${baseUrl}/index.html`, 'The nested 404 page links outside the site root.');
    assert.deepEqual(nestedMissing.failed, [], `The nested 404 page requested missing assets: ${nestedMissing.failed.join(', ')}`);

    // Turkish pages live one level deeper but share the root worker and assets.
    await navigate(bidi, tab.context, `${baseUrl}/tr/tools/base64.html`);
    const turkishOnline = await evaluate(bidi, tab.context, `(async () => {
      await document.fonts.ready;
      for (let attempt = 0; attempt < 200 && !navigator.serviceWorker.controller; attempt += 1) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
      }
      const registrations = await navigator.serviceWorker.getRegistrations();
      return {
        lang: document.documentElement.lang,
        heading: document.querySelector('h1')?.textContent.trim() || '',
        background: getComputedStyle(document.body).backgroundColor,
        worker: navigator.serviceWorker.controller?.scriptURL || '',
        scopes: registrations.map((registration) => new URL(registration.scope).pathname),
        failed: performance.getEntriesByType('resource').filter((entry) => entry.responseStatus >= 400).map((entry) => entry.name)
      };
    })()`);
    assert.equal(turkishOnline.lang, 'tr', 'The Turkish page did not render in Turkish.');
    assert.equal(turkishOnline.heading, 'Base64 Kodlama / Kod Çözme', 'The Turkish page body was not translated.');
    assert.notEqual(turkishOnline.background, 'rgba(0, 0, 0, 0)', 'The Turkish page rendered without its stylesheets.');
    assert(turkishOnline.worker.endsWith('/toolkit/sw.js'), `The Turkish page registered the wrong worker: ${turkishOnline.worker}`);
    assert.deepEqual(turkishOnline.scopes, ['/toolkit/'], 'The Turkish page registered an extra service-worker scope.');
    assert.deepEqual(turkishOnline.failed, [], `The Turkish page requested missing assets: ${turkishOnline.failed.join(', ')}`);
    // Opening a /tr/ page saves Turkish; restore English for the checks below.
    await evaluate(bidi, tab.context, `(() => { localStorage.setItem('toolkit-language', 'en'); return true; })()`);

    await closeServer(server);

    await navigate(bidi, tab.context, `${baseUrl}/tools/typing-test.html`);
    const typingOffline = await evaluate(bidi, tab.context, `(async () => {
      for (let attempt = 0; attempt < 200; attempt += 1) {
        if (document.querySelectorAll('#tt-stream .tt-word').length && !document.querySelector('#tt-start-selected')?.disabled) break;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
      }
      const wordList = await fetch('../words/tr/common-1000.json');
      const qrLibrary = await fetch('../assets/js/vendor/qrcode-generator.js');
      const unavailable = await fetch('../__offline-test-missing.json');
      return {
        controlled: Boolean(navigator.serviceWorker.controller),
        title: document.title,
        readyWords: document.querySelectorAll('#tt-stream .tt-word').length,
        categoryCount: document.querySelectorAll('[data-category]').length,
        wordListStatus: wordList.status,
        qrLibraryStatus: qrLibrary.status,
        unavailableStatus: unavailable.status
      };
    })()`);
    assert.equal(typingOffline.controlled, true, 'Offline typing page lost service-worker control.');
    assert(typingOffline.title.includes('Typing Speed Test'), 'Cached typing page did not render offline.');
    assert(typingOffline.readyWords > 0, 'Typing practice did not prepare words offline.');
    assert(typingOffline.categoryCount >= 9, 'The complete English category catalogue did not render offline.');
    assert.equal(typingOffline.wordListStatus, 200, 'A precached Turkish word list was unavailable offline.');
    assert.equal(typingOffline.qrLibraryStatus, 200, 'A precached vendor library was unavailable offline.');
    assert.equal(typingOffline.unavailableStatus, 503, 'An uncached non-HTML request did not return the offline 503 response.');

    await navigate(bidi, tab.context, `${baseUrl}/license/`);
    const licenseOffline = await evaluate(bidi, tab.context, `(() => ({
      title: document.title,
      canonicalText: document.querySelector('#license-text')?.textContent || ''
    }))()`);
    assert(licenseOffline.title.includes('License'), 'The published license page did not open offline.');
    assert(licenseOffline.canonicalText.includes('Apache License'), 'The canonical license text was missing offline.');

    await navigate(bidi, tab.context, `${baseUrl}/not-a-published-page`);
    const fallback = await evaluate(bidi, tab.context, `(() => ({
      title: document.title,
      heading: document.querySelector('h1')?.textContent.trim() || ''
    }))()`);
    assert(fallback.title.includes('Page Not Found'), 'An uncached offline route did not fall back to 404.html.');
    assert(fallback.heading, 'The offline 404 fallback did not render its heading.');

    // A visited Turkish page comes from the cache; an unvisited one redirects
    // to its precached English twin, still rendered in Turkish.
    await navigate(bidi, tab.context, `${baseUrl}/tr/tools/base64.html`);
    const turkishCached = await evaluate(bidi, tab.context, `(() => ({
      path: location.pathname,
      heading: document.querySelector('h1')?.textContent.trim() || ''
    }))()`);
    assert.equal(turkishCached.path, '/toolkit/tr/tools/base64.html', 'A visited Turkish page did not open offline.');
    assert.equal(turkishCached.heading, 'Base64 Kodlama / Kod Çözme', 'A visited Turkish page lost its translation offline.');
    await navigate(bidi, tab.context, `${baseUrl}/tr/tools/hash.html`);
    const turkishTwin = await evaluate(bidi, tab.context, `(async () => {
      for (let attempt = 0; attempt < 200 && document.documentElement.lang !== 'tr'; attempt += 1) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
      }
      return {
        path: location.pathname,
        lang: document.documentElement.lang,
        background: getComputedStyle(document.body).backgroundColor
      };
    })()`);
    assert.equal(turkishTwin.path, '/toolkit/tools/hash.html', 'An unvisited Turkish page did not fall back to its English twin offline.');
    assert.equal(turkishTwin.lang, 'tr', 'The offline English twin ignored the saved Turkish preference.');
    assert.notEqual(turkishTwin.background, 'rgba(0, 0, 0, 0)', 'The offline English twin rendered without its stylesheets.');


    console.log(`Offline E2E passed: ${expectedCache} installed at /toolkit/, preserved unrelated caches, and served tools, Turkish pages, word lists, vendor assets, license, and 404 fallback without a network.`);
  } finally {
    try { await bidi?.call('session.end'); } catch {}
    bidi?.close();
    browser.kill('SIGTERM');
    await new Promise((resolvePromise) => browser.once('exit', resolvePromise));
    await closeServer(server);
    await rm(profile, { recursive: true, force: true });
    if (browser.exitCode && !bidi) throw new Error(browserError || 'Firefox could not start.');
  }
}

await main();
