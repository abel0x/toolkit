#!/usr/bin/env node
/* axe-core accessibility audit of every published page, in Firefox.
   Needs axe-core: `npm install --no-save --no-package-lock axe-core@4.14.0`
   (or AXE_CORE_PATH pointing at axe.min.js). */

import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFirefox } from './browser-session.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tools = readdirSync(join(root, 'tools')).filter((name) => name.endsWith('.html')).sort();
const onlyPages = process.env.AXE_PAGES ? process.env.AXE_PAGES.split(',') : null;
const englishPagesAll = ['index.html', '404.html', 'license/index.html', 'privacy/index.html', ...tools.map((name) => `tools/${name}`)];
const turkishPagesAll = ['index.html', 'license/index.html', 'privacy/index.html', ...tools.map((name) => `tools/${name}`)].map((page) => `tr/${page}`);
// AXE_PAGES=tools/a.html,tr/tools/a.html narrows a local run.
const englishPages = onlyPages ? englishPagesAll.filter((page) => onlyPages.includes(page)) : englishPagesAll;
const turkishPages = onlyPages ? turkishPagesAll.filter((page) => onlyPages.includes(page)) : turkishPagesAll;
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

// WCAG 2.2 A and AA plus axe's best practices.
const runOptions = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'best-practice'] },
  resultTypes: ['violations']
};

await withFirefox(async (page) => {
  async function settle(path) {
    for (let attempt = 0; attempt < 250; attempt += 1) {
      try {
        const state = await page.evaluate(() => ({ path: location.pathname, ready: document.readyState }));
        if (state.path === path && state.ready === 'complete') return;
      } catch {}
      await sleep(20);
    }
    throw new Error(`${path} did not finish loading.`);
  }

  // Reveal animations start at opacity 0; axe would measure contrast mid-fade.
  const audit = (label) => page.evaluate(async ({ options, label: name }) => {
    document.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));
    const style = document.createElement('style');
    style.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
    document.head.append(style);
    if (!window.axe) {
      await new Promise((resolvePromise, reject) => {
        const script = document.createElement('script');
        script.src = '/__test/axe.min.js';
        script.onload = resolvePromise;
        script.onerror = () => reject(new Error('axe-core could not load; install it (see tests/axe-audit.mjs).'));
        document.head.append(script);
      });
    }
    const result = await window.axe.run(document, options);
    return result.violations.map((violation) => ({
      page: name,
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.slice(0, 4).map((node) => node.target.join(' ')),
      detail: violation.nodes.slice(0, 2).map((node) => `${node.html.slice(0, 200)}\n      ${node.failureSummary.replace(/\s+/g, ' ').slice(0, 300)}`),
      count: violation.nodes.length
    }));
  }, { options: runOptions, label });

  const violations = [];
  let audits = 0;
  const visit = async (path, layout) => {
    await page.evaluate(() => { localStorage.removeItem('toolkit-language'); sessionStorage.clear(); return true; }).catch(() => {});
    await page.navigate(`/${path}`);
    await settle(`/${path}`);
    violations.push(...await audit(`${path} (${layout})`));
    audits += 1;
  };

  await page.navigate('/index.html');
  for (const [width, height, layout, list] of [
    [1280, 900, 'desktop', [...englishPages, ...turkishPages]],
    [390, 844, 'mobile', englishPages]
  ]) {
    await page.viewport(width, height);
    for (const path of list) await visit(path, layout);
  }

  // Dialogs and notices that only exist after an action.
  await page.viewport(1280, 900);
  for (const [path, action, label] of [
    ['index.html', () => { document.querySelector('.nav-command-trigger').click(); return true; }, 'tool finder open'],
    ['tools/hash.html', () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true })); return true; }, 'shortcut help open']
  ]) {
    await page.navigate(`/${path}`);
    await settle(`/${path}`);
    await page.evaluate(action);
    await sleep(300);
    const open = await page.evaluate(() => Boolean(document.querySelector('dialog[open], [role="dialog"]:not([hidden])')));
    assert(open, `${path}: the ${label} state did not open a dialog.`);
    violations.push(...await audit(`${path} (${label})`));
    audits += 1;
  }

  if (violations.length) {
    const lines = violations.map((violation) =>
      `${violation.page}: [${violation.impact}] ${violation.id} — ${violation.help} (${violation.count}×: ${violation.targets.join(' | ')})`
      + (process.env.AXE_DETAIL ? `\n    ${violation.detail.join('\n    ')}` : ''));
    throw new Error(`axe-core found ${violations.length} violations:\n${lines.join('\n')}`);
  }
  console.log(`axe audit passed: ${audits} page states (${englishPages.length} English and ${turkishPages.length} Turkish pages on desktop, the English pages on a phone, the tool finder and the shortcut help) with no WCAG 2.2 A/AA or best-practice violations.`);
});
