#!/usr/bin/env node
/*
 * Safari-engine smoke test: every published page in WebKit at desktop and phone widths,
 * in English and Turkish, plus core browser APIs the tools rely on.
 * Needs Playwright with WebKit (CI installs it; it is never a site dependency):
 *   npm install --no-save playwright && npx playwright install --with-deps webkit
 *   node tests/webkit-smoke.mjs
 * BROWSER=chromium (optionally with BROWSER_EXECUTABLE=/path) runs the same checks in Chromium.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(process.env.PLAYWRIGHT_FROM || join(root, 'package.json'));
const playwright = require('playwright');
const engine = playwright[process.env.BROWSER || 'webkit'];
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.xml': 'application/xml', '.webp': 'image/webp'
};

// Serve the site under /toolkit/ like GitHub Pages, including the nested 404 page.
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (!pathname.startsWith('/toolkit/')) { response.writeHead(404); response.end(); return; }
  let file = resolve(root, '.' + pathname.slice('/toolkit'.length));
  try {
    if (file !== root && !file.startsWith(root + sep)) throw new Error('outside');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(await readFile(join(root, '404.html')));
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}/toolkit/`;

const pages = ['', 'license/', 'tools/missing-page.html', ...readdirSync(join(root, 'tools')).filter((name) => name.endsWith('.html')).map((name) => 'tools/' + name)];
const problems = [];
const browser = await engine.launch(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {});
try {
  for (const [viewport, width] of [['desktop', 1280], ['phone', 390]]) {
    for (const language of ['en', 'tr']) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      await context.addInitScript((value) => {
        localStorage.setItem('toolkit-language', value);
        document.addEventListener('securitypolicyviolation', (event) => console.error(`CSP ${event.violatedDirective} ${event.blockedURI}`));
      }, language);
      const page = await context.newPage();
      let current = '';
      page.on('pageerror', (error) => problems.push(`${current} [${viewport}/${language}] page error: ${error.message}`));
      page.on('console', (message) => {
        // The deliberately missing page reports its own expected 404.
        if (current === 'tools/missing-page.html' && /status of 404/.test(message.text())) return;
        if (message.type() === 'error') problems.push(`${current} [${viewport}/${language}] console: ${message.text()}`);
      });
      page.on('response', (reply) => {
        if (reply.status() >= 400 && !reply.url().endsWith('missing-page.html')) problems.push(`${current} [${viewport}/${language}] HTTP ${reply.status()} ${reply.url()}`);
      });
      for (const path of pages) {
        current = path || 'index';
        await page.goto(base + path, { waitUntil: 'load' });
        await page.waitForTimeout(150);
        const state = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          lang: document.documentElement.lang,
          styled: getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)'
        }));
        if (state.overflow) problems.push(`${current} [${viewport}/${language}] horizontal overflow`);
        if (state.lang !== language) problems.push(`${current} [${viewport}/${language}] html lang is ${state.lang}`);
        if (!state.styled) problems.push(`${current} [${viewport}/${language}] stylesheets did not apply`);
      }
      await context.close();
    }
  }

  // Core APIs and flows in the engine.
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`functional: ${error.message}`));
  await page.goto(base + 'tools/hash.html');
  await page.fill('#hashInput', 'abc');
  await page.click('#hashGenBtn');
  await page.waitForTimeout(300);
  assert((await page.textContent('#hashResults')).includes('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'), 'Web Crypto SHA-256 vector failed.');
  await page.goto(base + 'tools/base64.html');
  await page.fill('#b64Input', 'İstanbul çığ 🧪');
  await page.click('#b64EncodeBtn');
  assert.equal(await page.inputValue('#b64Output'), 'xLBzdGFuYnVsIMOnxLHEnyDwn6eq', 'UTF-8 Base64 vector failed.');
  await page.goto(base + 'tools/typing-test.html');
  await page.waitForFunction(() => !document.getElementById('tt-prepare').disabled);
  await page.click('#tt-prepare');
  await page.waitForFunction(() => !document.getElementById('tt-test').hidden && document.querySelector('.tt-word--active'));
  const word = await page.evaluate(() => [...document.querySelectorAll('.tt-word--active > .tt-char:not(.tt-char--reserved):not(.tt-char--extra)')].map((node) => node.textContent).join(''));
  await page.keyboard.type(word + ' ', { delay: 30 });
  const typing = await page.evaluate(() => ({ correct: document.querySelectorAll('.tt-char--correct').length, status: document.getElementById('tt-test').dataset.status }));
  assert.equal(typing.status, 'running', 'Typing test did not start from keyboard input.');
  assert(typing.correct >= word.length, `Typed characters were not marked correct: ${JSON.stringify(typing)}`);
  await context.close();
} finally {
  await browser.close();
  server.close();
}

if (problems.length) console.log(problems.slice(0, 50).join('\n'));
assert.equal(problems.length, 0, `${problems.length} problem(s) in ${process.env.BROWSER || 'webkit'}.`);
console.log(`${process.env.BROWSER || 'WebKit'} smoke passed: ${pages.length} pages x 2 widths x 2 languages, Web Crypto, UTF-8 Base64 and keyboard typing.`);
