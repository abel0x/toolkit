#!/usr/bin/env node
/* Shared, dependency-free browser harness for focused regression tests. */

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

async function startServer() {
  const server = createServer(async (request, response) => {
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
      }, 90_000);
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
  if (response.result.type !== 'string') throw new Error(`Expected JSON result, received ${JSON.stringify(response.result)}`);
  return JSON.parse(response.result.value);
}


export async function withFirefox(callback) {
  if (process.env.CHROMIUM_BINARY) return withChromium(callback);
  const server = await startServer();
  const port = await unusedPort();
  const profile = await mkdtemp(join(tmpdir(), 'toolkit-regression-'));
  const browser = spawn(process.env.FIREFOX_BINARY || 'firefox', [
    '--headless', '--remote-debugging-port', String(port), '--profile', profile
  ], { stdio: 'ignore' });
  let bidi;
  try {
    bidi = await connectBidi(port);
    await bidi.call('session.new', { capabilities: {} });
    await bidi.call('session.subscribe', { events: ['log.entryAdded'] });
    const tab = await bidi.call('browsingContext.create', { type: 'tab' });
    const base = 'http://127.0.0.1:' + server.address().port;
    await callback({
      base,
      navigate: (path) => bidi.call('browsingContext.navigate', { context: tab.context, url: base + path, wait: 'complete' }),
      evaluate: (fn, argument) => evaluate(bidi, tab.context, '(' + fn.toString() + ')(' + JSON.stringify(argument) + ')'),
      viewport: (width, height) => bidi.call('browsingContext.setViewport', { context: tab.context, viewport: { width, height }, devicePixelRatio: 1 }),
      errors: () => bidi.events.filter((event) => event.method === 'log.entryAdded' && event.params?.level === 'error')
    });
  } finally {
    try { await bidi?.call('session.end'); } catch {}
    bidi?.close();
    browser.kill('SIGTERM');
    if (browser.exitCode === null) await new Promise((resolve) => browser.once('exit', resolve));
    await new Promise((resolve) => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
  }
}

async function withChromium(callback) {
  const server = await startServer();
  const port = await unusedPort();
  const profile = await mkdtemp(join(tmpdir(), 'toolkit-chromium-'));
  const browser = spawn(process.env.CHROMIUM_BINARY, [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });
  let cdp;
  try {
    let tabs;
    for (let attempt = 0; attempt < 120 && !tabs; attempt += 1) {
      try { tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); }
      catch { await sleep(100); }
    }
    if (!tabs) throw new Error('Chromium did not expose its debugging endpoint.');
    const socket = new WebSocket(tabs.find((tab) => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    cdp = new BidiClient(socket);
    await cdp.call('Runtime.enable');
    await cdp.call('Page.enable');
    const base = 'http://127.0.0.1:' + server.address().port;
    const run = async (expression) => {
      const result = await cdp.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await callback({
      base,
      async navigate(path) {
        const url = base + path;
        await cdp.call('Page.navigate', { url });
        for (let attempt = 0; attempt < 200; attempt += 1) {
          try { if (await run('location.href === ' + JSON.stringify(url) + ' && document.readyState === "complete"')) return; } catch {}
          await sleep(20);
        }
        throw new Error('Navigation did not complete: ' + url);
      },
      evaluate: (fn, argument) => run('(' + fn.toString() + ')(' + JSON.stringify(argument) + ')'),
      viewport: (width, height) => cdp.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }),
      errors: () => cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown' || (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error'))
    });
  } finally {
    cdp?.close();
    browser.kill('SIGTERM');
    if (browser.exitCode === null) await new Promise((resolve) => browser.once('exit', resolve));
    await new Promise((resolve) => server.close(resolve));
    await rm(profile, { recursive: true, force: true });
  }
}
