#!/usr/bin/env node
/* Browser smoke and accessibility contracts for every published tool page. */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toolsDirectory = join(root, 'tools');
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

// The breadcrumb, the header (icon, title, sample button) and the tool's
// first block must share the same left and right edges on every page,
// the licence pages included.
async function inspectHeaderAlignment(bidi, context, slug, layout) {
  const edges = await evaluate(bidi, context, `(() => {
    const box = (element) => element?.getBoundingClientRect();
    const header = document.querySelector('.tool-header');
    if (!header) return ['tool header missing'];
    let content = header?.nextElementSibling;
    while (content && !content.getBoundingClientRect().width) content = content.nextElementSibling;
    const stacked = getComputedStyle(header).flexDirection === 'column';
    const parts = {
      breadcrumb: box(document.querySelector('.tool-breadcrumb')),
      icon: box(document.querySelector('.tool-header__icon')),
      content: box(content)
    };
    const button = box(document.querySelector('.tool-header__sample'));
    const reference = box(header);
    const offsets = [];
    for (const [name, rect] of Object.entries(parts)) {
      if (!rect) offsets.push(name + ' missing');
      else if (Math.abs(rect.left - reference.left) > 1) offsets.push(name + ' left ' + Math.round(rect.left - reference.left) + 'px');
    }
    if (parts.content && Math.abs(parts.content.right - reference.right) > 1) offsets.push('content right ' + Math.round(parts.content.right - reference.right) + 'px');
    if (button && !stacked && Math.abs(button.right - reference.right) > 1) offsets.push('sample button right ' + Math.round(button.right - reference.right) + 'px');
    return offsets;
  })()`);
  return edges.length ? [`${slug}: ${layout} header is out of line with its page: ${edges.join(', ')}`] : [];
}

async function inspectDesktopPage(bidi, context, url, slug) {
  await navigate(bidi, context, url);
  const alignment = await inspectHeaderAlignment(bidi, context, slug, 'desktop');
  const page = await evaluate(bidi, context, `(async () => {
    for (let attempt = 0; attempt < 50 && !window.ToolkitI18n; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const text = (node) => String(node?.textContent || '').replace(/\s+/g, ' ').trim();
    const labelText = (node) => String(node.getAttribute('aria-labelledby') || '')
      .split(/\s+/)
      .map((id) => text(document.getElementById(id)))
      .join(' ')
      .trim();
    const accessibleName = (node) => {
      const ariaLabel = String(node.getAttribute('aria-label') || '').trim();
      if (ariaLabel) return ariaLabel;
      const labelled = labelText(node);
      if (labelled) return labelled;
      if (node.labels && [...node.labels].some((label) => text(label))) return text(node.labels[0]);
      if (node.matches('input[type="button"], input[type="submit"], input[type="reset"]')) return String(node.value || '').trim();
      if (node.matches('button, [role="button"]')) return text(node);
      return '';
    };
    const controls = [...document.querySelectorAll('button, input:not([type="hidden"]), select, textarea, [role="button"]')];
    const unnamed = controls
      .filter((node) => !node.closest('[hidden], [aria-hidden="true"]'))
      .filter((node) => !accessibleName(node))
      .map((node) => node.tagName.toLowerCase() + '#' + (node.id || node.className || 'unnamed'));
    const invalidLiveRegions = [...document.querySelectorAll('[aria-live]')]
      .filter((node) => !['off', 'polite', 'assertive'].includes(node.getAttribute('aria-live')))
      .map((node) => node.id || node.className || node.tagName.toLowerCase());
    const positiveTabIndexes = [...document.querySelectorAll('[tabindex]')]
      .filter((node) => Number(node.getAttribute('tabindex')) > 0)
      .map((node) => node.id || node.className || node.tagName.toLowerCase());
    const exposedHidden = [...document.querySelectorAll('[hidden]')]
      .filter((node) => getComputedStyle(node).display !== 'none')
      .map((node) => node.id || node.className || node.tagName.toLowerCase());
    const clippedControls = controls
      .filter((node) => !node.closest('[hidden], [aria-hidden="true"]'))
      .filter((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0
          && (rect.left < -1 || rect.right > window.innerWidth + 1);
      })
      .map((node) => node.tagName.toLowerCase() + '#' + (node.id || node.className || 'unnamed'));
    const unalignedTextareaPairs = [...document.querySelectorAll('.tool-split, .b64-grid, .diff-input-grid')]
      .map((container) => {
        const columns = [...container.children]
          .filter((child) => !child.matches('.tool-divider'))
          .filter((child) => getComputedStyle(child).display !== 'none');
        if (columns.length !== 2) return null;
        const fields = columns.map((column) => {
          if (container.matches('.b64-grid')) return column.querySelector('textarea');
          const firstGroup = [...column.children].find((child) => child.matches('.form-group'));
          return firstGroup?.querySelector(':scope > textarea') || null;
        });
        if (fields.some((field) => !field)) return null;
        if (fields.length !== 2) return null;
        const first = fields[0].getBoundingClientRect();
        const second = fields[1].getBoundingClientRect();
        const difference = Math.abs(first.top - second.top);
        return difference > 1 ? {
          layout: container.className || container.id || 'unnamed layout',
          fields: fields.map((field) => field.id || field.name || 'textarea'),
          difference: Math.round(difference * 10) / 10
        } : null;
      })
      .filter(Boolean);
    const exampleButtons = [...document.querySelectorAll('[data-example-group]')];
    // Turkish lives on the /tr/ twin (tests/turkish-pages-e2e.mjs); the English
    // page must not download its dictionaries but must offer the switch.
    const englishOnly = document.documentElement.lang === 'en' && !window.TOOLKIT_I18N_TR && !window.TOOLKIT_I18N_EXTRA;
    const turkishOption = Boolean(document.querySelector('.nav-language__option[data-language="tr"]'))
      && Boolean(document.querySelector('link[rel="alternate"][hreflang="tr"]'));
    exampleButtons.forEach((button) => button.click());
    await new Promise((resolve) => setTimeout(resolve, 30));
    const unloadedExamples = exampleButtons
      .filter((button) => !button.dataset.exampleLoaded)
      .map((button) => button.dataset.exampleGroup || 'unknown');
    const interactionErrors = [];
    const recordInteractionError = (event) => interactionErrors.push(String(event.error?.message || event.message || event.reason?.message || event.reason || 'Unknown error'));
    window.addEventListener('error', recordInteractionError);
    window.addEventListener('unhandledrejection', recordInteractionError);
    const primaryActions = [...document.querySelectorAll('main button')]
      .filter((button) => !button.disabled && !button.matches('[data-example-group]'))
      .filter((button) => button.classList.contains('btn--primary') || button.classList.contains('btn-primary'))
      .filter((button) => {
        const style = getComputedStyle(button);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    primaryActions.slice(0, 6).forEach((button) => button.click());
    await new Promise((resolve) => setTimeout(resolve, 150));
    window.removeEventListener('error', recordInteractionError);
    window.removeEventListener('unhandledrejection', recordInteractionError);
    return {
      title: document.title,
      hasLanguageRuntime: Boolean(window.ToolkitI18n),
      englishOnly,
      turkishOption,
      hasHeader: Boolean(document.querySelector('.nav-actions')),
      hasFooter: Boolean(document.querySelector('.footer-inner, .footer')),
      noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      unnamed,
      invalidLiveRegions,
      positiveTabIndexes,
      exposedHidden,
      clippedControls,
      unalignedTextareaPairs,
      primaryActions: primaryActions.length,
      interactionErrors,
      exampleCount: exampleButtons.length,
      unloadedExamples,
      controls: controls.length
    };
  })()`);
  const issues = [...alignment];
  if (!page.title) issues.push(`${slug}: missing document title.`);
  if (!page.hasLanguageRuntime) issues.push(`${slug}: i18n runtime did not initialise.`);
  if (!page.englishOnly) issues.push(`${slug}: the English page loaded the Turkish dictionaries.`);
  if (!page.turkishOption) issues.push(`${slug}: the language menu cannot open the Turkish page.`);
  if (!page.hasHeader) issues.push(`${slug}: shared header is missing.`);
  if (!page.hasFooter) issues.push(`${slug}: shared footer is missing.`);
  if (!page.noOverflow) issues.push(`${slug}: desktop page has horizontal overflow.`);
  if (page.unnamed.length) issues.push(`${slug}: controls without an accessible name: ${page.unnamed.join(', ')}`);
  if (page.invalidLiveRegions.length) issues.push(`${slug}: invalid aria-live values: ${page.invalidLiveRegions.join(', ')}`);
  if (page.positiveTabIndexes.length) issues.push(`${slug}: positive tabindex breaks keyboard focus order.`);
  if (page.exposedHidden.length) issues.push(`${slug}: hidden elements are visually exposed: ${page.exposedHidden.join(', ')}`);
  if (page.clippedControls.length) issues.push(`${slug}: controls extend beyond the desktop viewport: ${page.clippedControls.join(', ')}`);
  if (page.unalignedTextareaPairs.length) {
    issues.push(`${slug}: paired text areas are vertically misaligned: ${page.unalignedTextareaPairs
      .map((pair) => `${pair.layout} (${pair.fields.join(' / ')}, ${pair.difference}px)`).join(', ')}`);
  }
  if (page.interactionErrors.length) {
    issues.push(`${slug}: primary action caused a runtime error: ${page.interactionErrors.join(', ')}`);
  }
  if (page.unloadedExamples.length) issues.push(`${slug}: example starter did not load: ${page.unloadedExamples.join(', ')}`);
  return { controls: page.controls, examples: page.exampleCount, actions: page.primaryActions, issues };
}

async function inspectMobilePage(bidi, context, url, slug) {
  await navigate(bidi, context, url);
  const page = await evaluate(bidi, context, `(() => ({
    noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    hasFooter: Boolean(document.querySelector('.footer-inner, .footer'))
  }))()`);
  const issues = await inspectHeaderAlignment(bidi, context, slug, 'mobile');
  if (!page.noOverflow) issues.push(`${slug}: mobile page has horizontal overflow.`);
  if (!page.hasFooter) issues.push(`${slug}: mobile footer is missing.`);
  return issues;
}

// The licence page uses the tool header too, in both languages.
const licensePages = ['license/index.html', 'tr/license/index.html'];

// Opening a /tr/ page stores the Turkish preference, which would send the
// English tool pages checked after it to their Turkish twins.
// The licence title is centred with leading spaces; on narrow screens the
// spaces go so its three lines never wrap.
async function inspectLicenseTitle(bidi, context, page, layout) {
  const lines = await evaluate(bidi, context, `(() => {
    const title = document.querySelector('.license-text__title');
    if (!title) return 0;
    return Math.round(title.getBoundingClientRect().height / parseFloat(getComputedStyle(title.parentElement).lineHeight));
  })()`);
  return lines === 3 ? [] : [`${page}: ${layout} licence title takes ${lines} lines instead of 3.`];
}

async function forgetLanguage(bidi, context) {
  await evaluate(bidi, context, `(() => { localStorage.removeItem('toolkit-language'); sessionStorage.clear(); return true; })()`);
}

async function main() {
  const toolFiles = (await readdir(toolsDirectory))
    .filter((file) => file.endsWith('.html'))
    .sort();
  assert.equal(toolFiles.length, 101, 'The browser smoke suite expects 101 published tool pages.');
  const server = await startServer();
  const browserPort = await unusedPort();
  const profile = await mkdtemp(join(tmpdir(), 'toolkit-tool-pages-'));
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
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    let controlCount = 0;
    let exampleCount = 0;
    let actionCount = 0;
    const issues = [];

    await bidi.call('browsingContext.setViewport', { context: tab.context, viewport: { width: 1440, height: 900 }, devicePixelRatio: 1 });
    for (const file of toolFiles) {
      const result = await inspectDesktopPage(bidi, tab.context, `${baseUrl}/tools/${file}`, file);
      controlCount += result.controls;
      exampleCount += result.examples;
      actionCount += result.actions;
      issues.push(...result.issues);
    }
    for (const page of licensePages) {
      await navigate(bidi, tab.context, `${baseUrl}/${page}`);
      issues.push(...await inspectHeaderAlignment(bidi, tab.context, page, 'desktop'));
      issues.push(...await inspectLicenseTitle(bidi, tab.context, page, 'desktop'));
      await forgetLanguage(bidi, tab.context);
    }

    await bidi.call('browsingContext.setViewport', { context: tab.context, viewport: { width: 390, height: 844 }, devicePixelRatio: 1 });
    for (const file of toolFiles) {
      issues.push(...await inspectMobilePage(bidi, tab.context, `${baseUrl}/tools/${file}`, file));
    }
    for (const page of licensePages) {
      issues.push(...await inspectMobilePage(bidi, tab.context, `${baseUrl}/${page}`, page));
      issues.push(...await inspectLicenseTitle(bidi, tab.context, page, 'mobile'));
      await forgetLanguage(bidi, tab.context);
    }

    assert.deepEqual(issues, [], `Tool-page browser audit failed:\n${issues.join('\n')}`);
    const browserErrors = bidi.events
      .filter((event) => event.method === 'log.entryAdded' && event.params?.level === 'error');
    assert.equal(browserErrors.length, 0,
      `Browser console errors:\n${browserErrors.map((event) => event.params.text || JSON.stringify(event.params)).join('\n')}`);
    console.log(`Tool-page E2E passed: ${toolFiles.length} pages, ${controlCount} named controls, ${actionCount} exercised primary actions, ${exampleCount} working example starters, desktop and mobile layouts with aligned headers (licence pages included, with an unwrapped licence title), and English pages free of Turkish dictionaries.`);
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
