#!/usr/bin/env node
/* Keyboard shortcut help ("?"), share links ("Copy link") and the tool icons,
   driven in Firefox with real key presses over WebDriver BiDi. */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8'
};

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).on('error', reject));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startServer(requests) {
  const server = createServer(async (request, response) => {
    requests.push(request.url || '');
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/sw.js') {
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end("self.addEventListener('install', () => self.skipWaiting()); self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));");
        return;
      }
      const pathname = decodeURIComponent(url.pathname);
      const target = resolve(root, `.${pathname}`);
      if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error('Forbidden');
      const contents = await readFile(target);
      await stat(target);
      response.writeHead(200, {
        'Content-Type': mimeTypes[extname(target)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      response.end(contents);
    } catch {
      // Like GitHub Pages, a miss gets the published 404 page.
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(await readFile(join(root, '404.html')));
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
      if (!message.id) {
        this.events.push(message);
        return;
      }
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

  close() {
    this.socket.close();
  }
}

async function connectBidi(port) {
  let lastError;
  for (let attempt = 0; attempt < 120; attempt += 1) {
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
    expression: `Promise.resolve(${source}).then((value) => JSON.stringify(value === undefined ? null : value))`,
    target: { context },
    awaitPromise: true,
    resultOwnership: 'none'
  });
  if (response.type !== 'success') throw new Error(`Browser evaluation failed: ${JSON.stringify(response)}`);
  return JSON.parse(response.result.value);
}

// Opening a /tr/ page stores Turkish, which would send the next English page
// to its Turkish twin; every navigation starts from a clean slate.
async function navigate(bidi, context, url) {
  try {
    await bidi.call('script.evaluate', {
      expression: "try { localStorage.removeItem('toolkit-language'); sessionStorage.clear(); } catch {}",
      target: { context }, awaitPromise: false, resultOwnership: 'none'
    });
  } catch {}
  await bidi.call('browsingContext.navigate', { context, url: 'about:blank', wait: 'complete' });
  await bidi.call('browsingContext.navigate', { context, url, wait: 'complete' });
  await sleep(150);
}

// Real, trusted key presses: what a visitor's keyboard sends.
async function press(bidi, context, ...keys) {
  const actions = [];
  keys.forEach((key) => actions.push({ type: 'keyDown', value: key }));
  [...keys].reverse().forEach((key) => actions.push({ type: 'keyUp', value: key }));
  await bidi.call('input.performActions', { context, actions: [{ type: 'key', id: 'keyboard', actions }] });
  await bidi.call('input.releaseActions', { context });
  await sleep(80);
}

const ESCAPE = '';
const CONTROL = '';
const english = {
  find: 'Find a tool', search: 'Search the tools on this page', run: 'Run the tool from one of its fields',
  close: 'Close a window or menu', show: 'Show these shortcuts', title: 'Keyboard shortcuts',
  copied: 'Link copied. Anyone who opens it sees this input.', loaded: 'Loaded the input from the shared link.',
  broken: 'This shared link is broken or incomplete.', long: 'This input is too long to share as a link.',
  empty: 'Fill in the tool before sharing it.'
};
const turkish = {
  find: 'Araç bul', run: 'Aracı alanlarından birindeyken çalıştır', close: 'Açık pencereyi veya menüyü kapat',
  show: 'Bu kısayolları göster', title: 'Klavye kısayolları', loaded: 'Paylaşılan bağlantıdaki girdi yüklendi.'
};

const dialogState = `(() => {
  const dialog = document.querySelector('dialog.shortcut-help');
  return {
    open: Boolean(dialog?.open),
    title: dialog?.querySelector('h2')?.textContent || '',
    rows: dialog ? [...dialog.querySelectorAll('.shortcut-help__list dd')].map((item) => item.textContent) : [],
    keys: dialog ? [...dialog.querySelectorAll('.shortcut-help__list dt')].map((item) => item.textContent) : [],
    focusInside: Boolean(dialog?.contains(document.activeElement)),
    active: document.activeElement?.className || document.activeElement?.tagName || ''
  };
})()`;

function base64url(text) {
  return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function inspectHelp(bidi, context, baseUrl, issues) {
  const pages = [
    ['index.html', [english.find, english.search, english.close, english.show], english.title],
    ['tools/jwt-decoder.html', [english.find, english.run, english.close, english.show], english.title],
    ['license/index.html', [english.find, english.close, english.show], english.title],
    ['tools/not-a-published-tool.html', [english.find, english.close, english.show], english.title],
    ['tr/tools/jwt-decoder.html', [turkish.find, turkish.run, turkish.close, turkish.show], turkish.title]
  ];
  for (const [page, rows, title] of pages) {
    await navigate(bidi, context, `${baseUrl}/${page}`);
    await evaluate(bidi, context, `(() => { document.activeElement?.blur(); return true; })()`);
    await press(bidi, context, '?');
    const opened = await evaluate(bidi, context, dialogState);
    if (!opened.open) { issues.push(`${page}: "?" did not open the shortcut list.`); continue; }
    if (opened.title !== title) issues.push(`${page}: the shortcut list is titled "${opened.title}".`);
    try { assert.deepEqual(opened.rows, rows); } catch { issues.push(`${page}: the shortcut list shows ${JSON.stringify(opened.rows)}.`); }
    if (!opened.focusInside) issues.push(`${page}: focus stayed outside the open shortcut list.`);
    if (opened.keys.some((key) => !key.trim())) issues.push(`${page}: a shortcut row has no key.`);
    await press(bidi, context, ESCAPE);
    const closed = await evaluate(bidi, context, dialogState);
    if (closed.open) issues.push(`${page}: Esc did not close the shortcut list.`);
    // The footer button opens it too and gets the focus back afterwards.
    const footer = await evaluate(bidi, context, `(async () => {
      const button = document.querySelector('.footer-shortcuts');
      if (!button) return { missing: true };
      button.focus();
      button.click();
      const open = document.querySelector('dialog.shortcut-help')?.open;
      document.querySelector('.shortcut-help__close')?.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { open, focusBack: document.activeElement === button, label: button.textContent.trim() };
    })()`);
    if (footer.missing) issues.push(`${page}: the footer has no keyboard shortcuts button.`);
    else {
      if (!footer.open) issues.push(`${page}: the footer button did not open the shortcut list.`);
      if (!footer.focusBack) issues.push(`${page}: closing the shortcut list did not return focus to the footer button.`);
      if (!footer.label.startsWith(title)) issues.push(`${page}: the footer button reads "${footer.label}".`);
    }
  }

  // "?" typed into a field stays a character.
  await navigate(bidi, context, `${baseUrl}/tools/jwt-decoder.html`);
  await evaluate(bidi, context, `(() => { const field = document.getElementById('jwtInput'); field.value = ''; field.focus(); return true; })()`);
  await press(bidi, context, '?');
  const typed = await evaluate(bidi, context, `(() => ({ value: document.getElementById('jwtInput').value, open: Boolean(document.querySelector('dialog.shortcut-help')?.open) }))()`);
  if (typed.open || typed.value !== '?') issues.push(`jwt-decoder: "?" in the token field gave ${JSON.stringify(typed)}.`);

  // Nor does it interrupt the typing test, or the tool finder's search box.
  await navigate(bidi, context, `${baseUrl}/tools/typing-test.html`);
  await evaluate(bidi, context, `(async () => {
    document.querySelector('main button.btn--primary, main button.btn-primary')?.click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    document.getElementById('tt-input')?.focus();
    return true;
  })()`);
  await press(bidi, context, '?');
  if ((await evaluate(bidi, context, dialogState)).open) issues.push('typing-test: "?" while typing opened the shortcut list.');
  await navigate(bidi, context, `${baseUrl}/index.html`);
  await press(bidi, context, CONTROL, 'k');
  await press(bidi, context, '?');
  const finder = await evaluate(bidi, context, `(() => ({ open: Boolean(document.querySelector('dialog.shortcut-help')?.open), query: document.getElementById('commandPaletteInput')?.value }))()`);
  if (finder.open || finder.query !== '?') issues.push(`tool finder: "?" in its search box gave ${JSON.stringify(finder)}.`);
}

const stubClipboard = `(() => {
  window.__copied = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__copied.push(text); } } });
  return true;
})()`;

const toasts = `[...document.querySelectorAll('#toast-container .toast')].map((toast) => ({ type: toast.className, text: toast.textContent.replace(/^[✓✕]\\s*/, '').trim() }))`;

function snapshot(fields) {
  return `(() => {
    const main = document.querySelector('main');
    const shared = new Set(${JSON.stringify(fields)}.map((selector) => document.querySelector(selector)));
    return {
      shared: ${JSON.stringify(fields)}.map((selector) => document.querySelector(selector)?.value ?? null),
      others: [...main.querySelectorAll('input, textarea, select, output')].filter((field) => !shared.has(field))
        .map((field) => field.type === 'checkbox' || field.type === 'radio' ? String(field.checked) : field.value),
      text: main.innerText,
      toasts: ${toasts},
      hash: location.hash
    };
  })()`;
}

async function inspectShare(bidi, context, baseUrl, issues, catalogue) {
  const sharing = catalogue.filter((tool) => tool.share);
  assert.equal(sharing.length, 10, 'Expected ten tools with a share link.');
  for (const tool of sharing) {
    const { fields } = tool.share;
    const page = `${baseUrl}/tools/${tool.slug}.html`;
    await navigate(bidi, context, page);
    const fresh = await evaluate(bidi, context, snapshot(fields));
    await evaluate(bidi, context, stubClipboard);
    await evaluate(bidi, context, `(async () => { document.querySelector('[data-example-group]')?.click(); await new Promise((r) => setTimeout(r, 400)); return true; })()`);
    const before = await evaluate(bidi, context, snapshot(fields));
    const copied = await evaluate(bidi, context, `(async () => {
      document.querySelector('.tool-header__share').click();
      await new Promise((r) => setTimeout(r, 150));
      return { copied: window.__copied, href: location.href, toasts: ${toasts} };
    })()`);
    const link = copied.copied[0] || '';
    if (copied.copied.length !== 1 || !link.startsWith(`${page}#share=1.`)) { issues.push(`${tool.slug}: "Copy link" copied ${JSON.stringify(copied.copied)}.`); continue; }
    if (copied.href !== link) issues.push(`${tool.slug}: the address bar does not show the copied link.`);
    if (!copied.toasts.some((toast) => toast.text === english.copied)) issues.push(`${tool.slug}: no "Link copied" message after copying.`);

    await navigate(bidi, context, link);
    await sleep(400);
    const opened = await evaluate(bidi, context, snapshot(fields));
    try { assert.deepEqual(opened.shared, before.shared); } catch { issues.push(`${tool.slug}: the shared link restored ${JSON.stringify(opened.shared)} instead of ${JSON.stringify(before.shared)}.`); }
    const changed = opened.text !== fresh.text || JSON.stringify(opened.others) !== JSON.stringify(fresh.others);
    if (!changed) issues.push(`${tool.slug}: opening the shared link filled the fields but ran nothing.`);
    if (!opened.toasts.some((toast) => toast.text === english.loaded)) issues.push(`${tool.slug}: no "Loaded" message when opening the shared link.`);
    if (opened.toasts.some((toast) => toast.type.includes('error'))) issues.push(`${tool.slug}: opening its shared link showed an error: ${JSON.stringify(opened.toasts)}.`);
  }

  // Broken, foreign or hostile fragments change nothing and run no code.
  const jsonDiff = `${baseUrl}/tools/json-diff.html`;
  await navigate(bidi, context, jsonDiff);
  const pristine = await evaluate(bidi, context, snapshot(['#jdiff-a', '#jdiff-b']));
  const bad = [
    ['bad characters', '#share=1.!!!*'],
    ['an object', `#share=1.${base64url('{"a":1}')}`],
    ['too few values', `#share=1.${base64url('["only one"]')}`],
    ['too many values', `#share=1.${base64url('["a","b","c"]')}`],
    ['numbers', `#share=1.${base64url('[1,2]')}`],
    ['another version', `#share=2.${base64url('["a","b"]')}`],
    ['broken UTF-8', `#share=1.${Buffer.from([0x5b, 0x22, 0xff, 0xfe, 0x22, 0x5d]).toString('base64url')}`],
    ['not JSON', `#share=1.${base64url('["a",')}`],
    ['an oversized fragment', `#share=1.${'A'.repeat(9000)}`]
  ];
  for (const [name, fragment] of bad) {
    await navigate(bidi, context, jsonDiff + fragment);
    const state = await evaluate(bidi, context, snapshot(['#jdiff-a', '#jdiff-b']));
    try { assert.deepEqual(state.shared, pristine.shared); } catch { issues.push(`json-diff: a link with ${name} changed the fields to ${JSON.stringify(state.shared)}.`); }
    if (!state.toasts.some((toast) => toast.text === english.broken)) issues.push(`json-diff: a link with ${name} gave no "broken link" message.`);
  }
  await navigate(bidi, context, `${baseUrl}/tools/curl-builder.html#share=1.${base64url(JSON.stringify(['HACK', 'https://example.com', '', '']))}`);
  const curl = await evaluate(bidi, context, `(() => ({ method: document.getElementById('curlMethod').value, url: document.getElementById('curlUrl').value, toasts: ${toasts} }))()`);
  if (curl.url || curl.method === 'HACK' || !curl.toasts.some((toast) => toast.text === english.broken)) issues.push(`curl-builder: a link with an unknown method was applied: ${JSON.stringify(curl)}.`);

  const payload = '<img src="x" onerror="window.__pwned = 1"><script>window.__pwned = 2</script>';
  await navigate(bidi, context, `${baseUrl}/tools/json-formatter.html#share=1.${base64url(JSON.stringify([payload]))}`);
  const injected = await evaluate(bidi, context, `(() => ({ value: document.getElementById('jsonInput').value, pwned: window.__pwned ?? null, images: document.querySelectorAll('img[src="x"]').length }))()`);
  if (injected.value !== payload || injected.pwned !== null || injected.images) issues.push(`json-formatter: markup in a shared link was not kept as plain text: ${JSON.stringify(injected)}.`);

  // Copying refuses an empty tool and an input too long for a link.
  await navigate(bidi, context, `${baseUrl}/tools/json-formatter.html`);
  await evaluate(bidi, context, stubClipboard);
  for (const [name, value, message] of [['an empty tool', '', english.empty], ['a long input', 'x'.repeat(7000), english.long]]) {
    const result = await evaluate(bidi, context, `(async () => {
      document.getElementById('jsonInput').value = ${JSON.stringify(value)};
      document.querySelector('.tool-header__share').click();
      await new Promise((r) => setTimeout(r, 150));
      return { copied: window.__copied.length, hash: location.hash, toasts: ${toasts} };
    })()`);
    if (result.copied || result.hash || !result.toasts.some((toast) => toast.text === message)) issues.push(`json-formatter: sharing ${name} gave ${JSON.stringify(result)}.`);
  }

  // The Turkish twin shares a Turkish link and greets it in Turkish.
  await navigate(bidi, context, `${baseUrl}/tr/tools/cron-assistant.html`);
  await evaluate(bidi, context, stubClipboard);
  const turkishLink = await evaluate(bidi, context, `(async () => {
    document.querySelector('[data-example-group]').click();
    await new Promise((r) => setTimeout(r, 300));
    document.querySelector('.tool-header__share').click();
    await new Promise((r) => setTimeout(r, 150));
    return window.__copied[0] || '';
  })()`);
  if (!turkishLink.startsWith(`${baseUrl}/tr/tools/cron-assistant.html#share=1.`)) issues.push(`tr/cron-assistant: copied ${turkishLink}.`);
  else {
    await navigate(bidi, context, turkishLink);
    const greeted = await evaluate(bidi, context, toasts);
    if (!greeted.some((toast) => toast.text === turkish.loaded)) issues.push(`tr/cron-assistant: the shared link was not greeted in Turkish: ${JSON.stringify(greeted)}.`);
  }
  await evaluate(bidi, context, `(() => { localStorage.removeItem('toolkit-language'); sessionStorage.clear(); return true; })()`);
}

async function inspectIcons(bidi, context, baseUrl, issues, catalogue) {
  await navigate(bidi, context, `${baseUrl}/index.html`);
  const cards = await evaluate(bidi, context, `[...document.querySelectorAll('.hub-card[href]')].map((card) => ({
    slug: card.getAttribute('href').replace(/^tools\\//, '').replace(/\\.html$/, ''),
    icon: card.querySelector('.hub-card-icon svg')?.innerHTML || ''
  }))`);
  if (cards.length !== catalogue.length) issues.push(`home: ${cards.length} tool cards instead of ${catalogue.length}.`);
  const expansion = new Set(catalogue.filter((tool) => tool.shell === 'expansion').map((tool) => tool.slug));
  const drawn = cards.filter((card) => expansion.has(card.slug));
  if (drawn.length !== expansion.size) issues.push(`home: ${drawn.length} of ${expansion.size} expansion tools have cards.`);
  if (cards.some((card) => !card.icon)) issues.push(`home: cards without an icon: ${cards.filter((card) => !card.icon).map((card) => card.slug).join(', ')}.`);
  if (cards.some((card) => card.icon.includes('M12 3v18M3 12h18'))) issues.push('home: a card still shows the old shared icon.');
  if (new Set(drawn.map((card) => card.icon)).size !== drawn.length) issues.push('home: two expansion tools show the same icon.');
}

async function main() {
  const catalogue = JSON.parse(await readFile(join(root, '_data/tools.json'), 'utf8')).tools;
  const requests = [];
  const server = await startServer(requests);
  const browserPort = await unusedPort();
  const profile = await mkdtemp(join(tmpdir(), 'toolkit-shortcuts-share-'));
  const browser = spawn(process.env.FIREFOX_BINARY || 'firefox', [
    '--headless', '--remote-debugging-port', String(browserPort), '--profile', profile
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let bidi;
  try {
    bidi = await connectBidi(browserPort);
    await bidi.call('session.new', { capabilities: {} });
    await bidi.call('session.subscribe', { events: ['log.entryAdded'] });
    const tab = await bidi.call('browsingContext.create', { type: 'tab' });
    await bidi.call('browsingContext.setViewport', { context: tab.context, viewport: { width: 1280, height: 900 }, devicePixelRatio: 1 });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const issues = [];
    await inspectHelp(bidi, tab.context, baseUrl, issues);
    await inspectShare(bidi, tab.context, baseUrl, issues, catalogue);
    await inspectIcons(bidi, tab.context, baseUrl, issues, catalogue);

    // A fragment never leaves the browser: no request carried a shared value.
    const leaked = requests.filter((url) => url.includes('#') || url.includes('share='));
    if (leaked.length) issues.push(`requests carried shared input: ${leaked.slice(0, 3).join(', ')}`);

    assert.deepEqual(issues, [], `Shortcut and share audit failed:\n${issues.join('\n')}`);
    const browserErrors = bidi.events.filter((event) => event.method === 'log.entryAdded' && event.params?.level === 'error');
    assert.equal(browserErrors.length, 0, `Browser console errors:\n${browserErrors.map((event) => event.params.text || JSON.stringify(event.params)).join('\n')}`);
    console.log(`Shortcuts and share E2E passed: "?" help on home, tool, licence, 404 and Turkish pages (real keys, focus, Esc, footer button), never while typing; ${catalogue.filter((tool) => tool.share).length} tools shared and reopened from a link; ${11} broken or hostile links refused; no shared input in ${requests.length} requests; ${catalogue.length} home cards with icons.`);
  } finally {
    try { await bidi?.call('session.end'); } catch {}
    bidi?.close();
    browser.kill('SIGTERM');
    await new Promise((resolve) => browser.once('exit', resolve));
    await new Promise((resolve) => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
