#!/usr/bin/env node
/* Full-page screenshot of a page in headless Firefox, after an optional script
   has run in it (to open files, click, or wait for work that finishes later).

     node _scripts/screenshot.mjs URL out.png WIDTH HEIGHT ['script body']

   SCREENSHOT_VIEWPORT=1 captures only the visible WIDTH × HEIGHT area (as the
   README screenshots are) instead of the whole page.

   Serve the site first: python3 build.py --site && python3 _scripts/serve.py _site
   then use http://127.0.0.1:8000/toolkit/... The script body runs as an async
   function in the page; what it returns is printed. Firefox is driven through
   WebDriver BiDi, as in tests/browser-session.mjs. */
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, width = '1280', height = '900', script = ''] = process.argv.slice(2);
if (!url || !out) {
  console.error('Usage: node _scripts/screenshot.mjs URL out.png [WIDTH] [HEIGHT] [script]');
  process.exit(1);
}
const port = 9300 + Math.floor(Math.random() * 500);
const profile = await mkdtemp(join(tmpdir(), 'toolkit-screenshot-'));
const firefox = spawn(process.env.FIREFOX_BINARY || 'firefox', ['--headless', '--remote-debugging-port', String(port), '--profile', profile], { stdio: 'ignore' });
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let socket;
for (let attempt = 0; attempt < 100 && !socket; attempt += 1) {
  try {
    const candidate = new WebSocket(`ws://127.0.0.1:${port}/session`);
    await new Promise((resolve, reject) => { candidate.onopen = resolve; candidate.onerror = reject; });
    socket = candidate;
  } catch {
    await sleep(150);
  }
}
if (!socket) { firefox.kill(); throw new Error('Firefox did not start.'); }
let id = 0;
const waiting = new Map();
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); }
};
const call = (method, params) => new Promise((resolve, reject) => {
  const number = ++id;
  waiting.set(number, (message) => (message.type === 'error' ? reject(new Error(message.message)) : resolve(message.result)));
  socket.send(JSON.stringify({ id: number, method, params }));
});
try {
  await call('session.new', { capabilities: {} });
  const { context } = await call('browsingContext.create', { type: 'tab' });
  await call('browsingContext.setViewport', { context, viewport: { width: Number(width), height: Number(height) }, devicePixelRatio: 1 });
  await call('browsingContext.navigate', { context, url, wait: 'complete' });
  if (script) {
    const result = await call('script.evaluate', { expression: `(async () => { ${script} })().then((value) => String(value))`, target: { context }, awaitPromise: true });
    console.log(result.result?.value ?? JSON.stringify(result));
  }
  const shot = await call('browsingContext.captureScreenshot', { context, origin: process.env.SCREENSHOT_VIEWPORT ? 'viewport' : 'document' });
  await writeFile(out, Buffer.from(shot.data, 'base64'));
  console.log(`saved ${out}`);
} finally {
  try { await call('session.end', {}); } catch { /* already closed */ }
  socket.close();
  firefox.kill();
}
