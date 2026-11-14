#!/usr/bin/env node
/* Open file / drop, Copy and Download (tool-io.js) on every tool with "io" in
   _data/tools.json, in Firefox over WebDriver BiDi. */

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


const toasts = `[...document.querySelectorAll('#toast-container .toast')].map((toast) => ({ type: toast.className, text: toast.textContent.replace(/^[✓✕]\\s*/, '').trim() }))`;

// Stubs the clipboard and file saving, so the test can read what the
// buttons hand over without touching the real clipboard or disk.
const stubs = `(() => {
  window.__copied = []; window.__saved = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__copied.push(text); } } });
  const blobs = new Map();
  const create = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => { const url = create(blob); blobs.set(url, blob); return url; };
  HTMLAnchorElement.prototype.click = function click() { if (this.download) window.__saved.push({ name: this.download, blob: blobs.get(this.href) }); };
  window.__readSaved = async () => Promise.all(window.__saved.map(async (entry) => ({ name: entry.name, text: entry.blob ? await entry.blob.text() : null })));
  return true;
})()`;

async function inspectTool(bidi, context, baseUrl, tool, issues) {
  const { inputs = {}, outputs = {} } = tool.io;
  const page = `tools/${tool.slug}.html`;
  await navigate(bidi, context, `${baseUrl}/${page}`);
  await evaluate(bidi, context, stubs);
  const expected = Object.keys(inputs).length
    + Object.values(outputs).reduce((sum, options) => sum + (options.copy ? 1 : 0) + (options.save ? 1 : 0), 0);
  const count = await evaluate(bidi, context, `document.querySelectorAll('[data-tool-io]').length`);
  if (count !== expected) issues.push(`${page}: ${count} file/copy/download buttons instead of ${expected}.`);

  for (const [selector, accept] of Object.entries(inputs)) {
    const result = await evaluate(bidi, context, `(async () => {
      const field = document.querySelector(${JSON.stringify(selector)});
      if (!field) return { missing: true };
      let inputs = 0;
      field.addEventListener('input', () => { inputs += 1; });
      const file = (name, text) => { const transfer = new DataTransfer(); transfer.items.add(new File([text], name, { type: 'text/plain' })); return transfer; };
      const wait = () => new Promise((resolve) => setTimeout(resolve, 80));
      const dropped = 'dropped ✓ çğş\\nline two';
      field.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: file('drop.txt', dropped) }));
      await wait();
      const afterDrop = field.value;
      const button = document.querySelector('[data-tool-io="open"][data-tool-io-for="${selector}"]');
      const picker = button?.parentElement.querySelector('input[type="file"]');
      const opened = '{"opened":true}';
      if (picker) { picker.files = file('open.json', opened).files; picker.dispatchEvent(new Event('change')); }
      await wait();
      const afterOpen = field.value;
      const big = new DataTransfer(); big.items.add(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.bin'));
      field.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: big }));
      await wait();
      return { afterDrop, afterOpen, afterBig: field.value, inputs, accept: picker?.accept, button: Boolean(button), toasts: ${toasts}, dropped, opened };
    })()`);
    if (result.missing) { issues.push(`${page}: ${selector} is missing.`); continue; }
    if (!result.button) issues.push(`${page}: ${selector} has no "Open file" button.`);
    if (result.afterDrop !== result.dropped) issues.push(`${page}: dropping a file on ${selector} gave ${JSON.stringify(result.afterDrop)}.`);
    if (result.afterOpen !== result.opened) issues.push(`${page}: opening a file into ${selector} gave ${JSON.stringify(result.afterOpen)}.`);
    if (result.afterBig !== result.opened) issues.push(`${page}: a file over 5 MB replaced ${selector}.`);
    if (result.inputs < 2) issues.push(`${page}: ${selector} did not announce the opened files to the tool.`);
    if (result.accept !== accept) issues.push(`${page}: ${selector} accepts ${result.accept} instead of ${accept}.`);
    if (!result.toasts.some((toast) => toast.text === 'big.bin is larger than 5 MB.')) issues.push(`${page}: no message for a file over 5 MB.`);
  }

  for (const [selector, options] of Object.entries(outputs)) {
    const result = await evaluate(bidi, context, `(async () => {
      const output = document.querySelector(${JSON.stringify(selector)});
      if (!output) return { missing: true };
      const editable = 'value' in output && !(output instanceof HTMLButtonElement);
      const write = (text) => { if (editable) output.value = text; else output.textContent = text; };
      const wait = () => new Promise((resolve) => setTimeout(resolve, 80));
      const own = (kind) => document.querySelector('[data-tool-io="' + kind + '"][data-tool-io-for="${selector}"]');
      const copyButton = ${options.copy ? "own('copy')" : 'null'};
      const saveButton = ${options.save ? "own('save')" : 'null'};
      write('');
      copyButton?.click(); saveButton?.click();
      await wait();
      const emptyToasts = ${toasts};
      const text = 'line one ✓\\nline two çğş';
      write(text);
      copyButton?.click(); saveButton?.click();
      await wait();
      return { copied: window.__copied, saved: await window.__readSaved(), emptyToasts, text };
    })()`);
    if (result.missing) { issues.push(`${page}: ${selector} is missing.`); continue; }
    if (options.copy) {
      if (result.copied.length !== 1 || result.copied[0] !== result.text) issues.push(`${page}: Copy on ${selector} handed over ${JSON.stringify(result.copied)}.`);
      if (!result.emptyToasts.some((toast) => toast.text === 'Nothing to copy')) issues.push(`${page}: copying an empty ${selector} gave no message.`);
    }
    if (options.save) {
      if (result.saved.length !== 1 || result.saved[0].name !== options.save || result.saved[0].text !== result.text) issues.push(`${page}: Download on ${selector} saved ${JSON.stringify(result.saved)}.`);
      if (!result.emptyToasts.some((toast) => toast.text === 'Nothing to download yet.')) issues.push(`${page}: downloading an empty ${selector} gave no message.`);
    }
    await evaluate(bidi, context, `(() => { window.__copied.length = 0; window.__saved.length = 0; return true; })()`);
  }
}

async function main() {
  const catalogue = JSON.parse(await readFile(join(root, '_data/tools.json'), 'utf8')).tools;
  const tools = catalogue.filter((tool) => tool.io);
  assert(tools.length >= 40, `Expected at least 40 tools with file, copy or download buttons, found ${tools.length}.`);
  const requests = [];
  const server = await startServer(requests);
  const browserPort = await unusedPort();
  const profile = await mkdtemp(join(tmpdir(), 'toolkit-tool-io-'));
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
    for (const tool of tools) await inspectTool(bidi, tab.context, baseUrl, tool, issues);

    // The Turkish twins label the buttons in Turkish.
    for (const slug of ['json-formatter', 'json-to-typescript', 'cron-assistant']) {
      await navigate(bidi, tab.context, `${baseUrl}/tr/tools/${slug}.html`);
      const labels = await evaluate(bidi, tab.context, `[...document.querySelectorAll('[data-tool-io]')].map((button) => button.textContent.trim() || button.getAttribute('aria-label'))`);
      const english = labels.filter((label) => ['Open file', 'Copy', 'Download'].includes(label));
      if (english.length || !labels.length) issues.push(`tr/${slug}: buttons read ${JSON.stringify(labels)}.`);
    }

    assert.deepEqual(issues, [], `Tool I/O audit failed:\n${issues.join('\n')}`);
    const browserErrors = bidi.events.filter((event) => event.method === 'log.entryAdded' && event.params?.level === 'error');
    assert.equal(browserErrors.length, 0, `Browser console errors:\n${browserErrors.map((event) => event.params.text || JSON.stringify(event.params)).join('\n')}`);
    const counts = tools.reduce((sum, tool) => ({
      inputs: sum.inputs + Object.keys(tool.io.inputs || {}).length,
      copy: sum.copy + Object.values(tool.io.outputs || {}).filter((options) => options.copy).length,
      save: sum.save + Object.values(tool.io.outputs || {}).filter((options) => options.save).length
    }), { inputs: 0, copy: 0, save: 0 });
    console.log(`Tool I/O E2E passed: ${tools.length} tools; ${counts.inputs} fields open and accept dropped files (5 MB limit), ${counts.copy} Copy and ${counts.save} Download buttons hand over the exact output, Turkish labels.`);
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
