#!/usr/bin/env node
/* Browser checks for the /tr/ pages: forced Turkish, shared assets and URL-based language switching. */

import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFirefox } from './browser-session.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

await withFirefox(async (page) => {
  async function settle(expectedPath) {
    for (let attempt = 0; attempt < 250; attempt += 1) {
      try {
        const { path, ready } = await page.evaluate(() => ({ path: location.pathname, ready: document.readyState }));
        if (path === expectedPath && ready === 'complete') return;
      } catch {}
      await sleep(20);
    }
    throw new Error(`Navigation to ${expectedPath} did not complete.`);
  }

  const inspect = () => page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    heading: document.querySelector('h1')?.textContent.trim().replace(/\s+/g, ' ') || '',
    language: document.querySelector('.nav-language__current')?.textContent || '',
    background: getComputedStyle(document.body).backgroundColor,
    toolLinks: [...document.querySelectorAll('a[href$=".html"]')].map((link) => new URL(link.href).pathname)
      .filter((path) => path.includes('/tools/')),
    failed: performance.getEntriesByType('resource').filter((entry) => entry.responseStatus >= 400).map((entry) => entry.name)
  }));

  const choose = (locale) => page.evaluate((target) => {
    document.querySelector(`.nav-language__option[data-language="${target}"]`).click();
  }, locale);

  // The test server has no directory index, so pages are opened by file name.
  // A first visit with an English preference still renders the Turkish URL in Turkish.
  await page.navigate('/index.html');
  await page.evaluate(() => { localStorage.setItem('toolkit-language', 'en'); });
  await page.navigate('/tr/index.html');
  const home = await inspect();
  assert.equal(home.lang, 'tr', '/tr/ did not force Turkish.');
  assert.equal(home.language, 'Türkçe', '/tr/ shows the wrong language in the menu.');
  assert.notEqual(home.background, 'rgba(0, 0, 0, 0)', '/tr/ rendered without its stylesheets.');
  assert.deepEqual(home.failed, [], `/tr/ requested missing files: ${home.failed.join(', ')}`);
  assert(home.toolLinks.length > 0 && home.toolLinks.every((path) => path.startsWith('/tr/tools/')),
    'Tool links on /tr/ leave the Turkish tree.');
  assert.equal(await page.evaluate(() => localStorage.getItem('toolkit-language')), 'tr',
    'Opening a Turkish page did not save the Turkish preference.');

  await page.navigate('/tr/tools/base64.html');
  const tool = await inspect();
  assert.equal(tool.title, 'Base64 Kodlama / Kod Çözme — Toolkit', 'The Turkish tool title is wrong.');
  assert.equal(tool.heading, 'Base64 Kodlama / Kod Çözme', 'The Turkish tool body was not translated.');
  assert.deepEqual(tool.failed, [], `The Turkish tool page requested missing files: ${tool.failed.join(', ')}`);

  // The language menu moves between the two URLs of the same page.
  await choose('en');
  await settle('/tools/base64.html');
  const english = await inspect();
  assert.equal(english.lang, 'en', 'Switching to English did not open the English page in English.');
  assert.equal(english.heading, 'Base64 Encode / Decode', 'The English page kept Turkish copy.');
  await choose('tr');
  await settle('/tr/tools/base64.html');
  assert.equal((await inspect()).lang, 'tr', 'Switching back to Turkish did not open the Turkish page.');

  // A saved Turkish preference sends an English URL straight to its twin,
  // replacing the history entry, and the arrival clears the loop guard.
  await page.navigate('/tools/hash.html?q=1#top');
  await settle('/tr/tools/hash.html');
  const redirected = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    search: location.search,
    hash: location.hash,
    guard: sessionStorage.getItem('toolkit-language-redirect'),
    dictionaries: Boolean(window.TOOLKIT_I18N_TR && window.TOOLKIT_I18N_EXTRA)
  }));
  assert.deepEqual(redirected, { lang: 'tr', search: '?q=1', hash: '#top', guard: null, dictionaries: true },
    'An English page did not redirect a Turkish visitor to the Turkish page.');

  // Root-relative runtime resources: the typing test still finds the shared word lists.
  await page.navigate('/tr/tools/typing-test.html');
  const typing = await page.evaluate(async () => {
    for (let attempt = 0; attempt < 250; attempt += 1) {
      if (document.querySelectorAll('#tt-stream .tt-word').length && document.querySelectorAll('[data-category]').length >= 9) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return {
      words: document.querySelectorAll('#tt-stream .tt-word').length,
      categories: document.querySelectorAll('[data-category]').length,
      failed: performance.getEntriesByType('resource').filter((entry) => entry.responseStatus >= 400).map((entry) => entry.name)
    };
  });
  assert(typing.words > 0 && typing.categories >= 9, 'The Turkish typing test did not load its word lists.');
  assert.deepEqual(typing.failed, [], `The Turkish typing test requested missing files: ${typing.failed.join(', ')}`);

  await page.navigate('/tr/license/index.html');
  const license = await inspect();
  assert.equal(license.title, 'Lisans — Toolkit', 'The Turkish license page title is wrong.');
  assert.deepEqual(license.failed, [], `The Turkish license page requested missing files: ${license.failed.join(', ')}`);

  // The static Turkish body must equal what i18n.js makes of the English body,
  // and leave the runtime nothing more to translate.
  const localized = ['index.html', 'license/index.html',
    ...(await readdir(join(root, 'tr', 'tools'))).filter((name) => name.endsWith('.html')).sort()
      .map((name) => `tools/${name}`)];
  const drift = await page.evaluate(async (paths) => {
    const parse = (html) => new DOMParser().parseFromString(html, 'text/html');
    const strings = (doc) => {
      const found = [];
      const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const value = walker.currentNode.nodeValue.replace(/\s+/g, ' ').trim();
        if (value) found.push(value);
      }
      doc.body.querySelectorAll('*').forEach((element) => {
        ['aria-label', 'title', 'placeholder', 'value'].forEach((attribute) => {
          if (element.hasAttribute(attribute)) found.push(`${element.localName}[${attribute}]=${element.getAttribute(attribute)}`);
        });
      });
      return found;
    };
    const problems = [];
    for (const path of paths) {
      const [englishHtml, turkishHtml] = await Promise.all([`/${path}`, `/tr/${path}`]
        .map((url) => fetch(url).then((response) => response.text())));
      const english = parse(englishHtml);
      window.ToolkitI18n.apply(english.body);
      const expected = strings(english);
      const turkish = parse(turkishHtml);
      const actual = strings(turkish);
      const compare = (label, wanted, found) => {
        const index = wanted.findIndex((value, position) => value !== found[position]);
        if (index !== -1 || wanted.length !== found.length) {
          problems.push(`${path}: ${label} ${JSON.stringify(wanted[index])}, found ${JSON.stringify(found[index])}`);
        }
      };
      compare('expected', expected, actual);
      window.ToolkitI18n.apply(turkish.body);
      compare('i18n.js would change', strings(turkish), actual);
    }
    return problems;
  }, localized);
  assert.deepEqual(drift, [], `Static Turkish copy differs from the runtime translation:\n${drift.join('\n')}`);

  // Tool scripts must cope with a body that is Turkish from the first paint.
  for (const path of localized.filter((name) => name.startsWith('tools/'))) {
    await page.navigate(`/tr/${path}`);
    const result = await page.evaluate(async () => {
      const errors = [];
      const record = (event) => errors.push(String(event.error?.message || event.message || event.reason?.message || event.reason));
      window.addEventListener('error', record);
      window.addEventListener('unhandledrejection', record);
      const examples = [...document.querySelectorAll('[data-example-group]')];
      examples.forEach((button) => button.click());
      await new Promise((resolve) => setTimeout(resolve, 30));
      [...document.querySelectorAll('main button.btn--primary, main button.btn-primary')]
        .filter((button) => !button.disabled && !button.matches('[data-example-group]') && button.offsetParent)
        .slice(0, 6).forEach((button) => button.click());
      await new Promise((resolve) => setTimeout(resolve, 150));
      return {
        errors,
        unloaded: examples.filter((button) => !button.dataset.exampleLoaded).map((button) => button.dataset.exampleGroup)
      };
    });
    assert.deepEqual(result.errors, [], `/tr/${path} threw while running its tool: ${result.errors.join(', ')}`);
    assert.deepEqual(result.unloaded, [], `/tr/${path} did not load its example: ${result.unloaded.join(', ')}`);
  }

  assert.deepEqual(page.errors(), [], 'Turkish pages logged browser errors.');
});

console.log('Turkish pages E2E passed: static Turkish copy matching the runtime, forced Turkish rendering, shared assets, '
  + 'Turkish internal links, URL-based language switching, the Turkish-preference redirect, working tool scripts and word lists.');
