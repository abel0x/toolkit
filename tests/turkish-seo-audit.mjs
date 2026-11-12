#!/usr/bin/env node
/* Static contracts for the generated /tr/ pages, hreflang links and sitemap. */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPageMetadata } from './page-metadata.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siteBase = 'https://abel0x.github.io/toolkit/';
const read = (path) => readFileSync(join(root, path), 'utf8');
const decode = (value) => value
  .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const meta = (html, pattern) => {
  const match = html.match(pattern);
  return match ? decode(match[1]) : null;
};

const toolCount = JSON.parse(read('_data/tools.json')).tools.length;
const seo = JSON.parse(read('_data/seo-tr.json'));
const pages = ['index.html', 'license/index.html',
  ...readdirSync(join(root, 'tools')).filter((name) => name.endsWith('.html')).sort().map((name) => `tools/${name}`)];
const location = (page) => page.replace(/index\.html$/, '');
const fill = (value) => value.replaceAll('{{count}}', String(toolCount));

assert.deepEqual(Object.keys(seo).sort(), [...pages].sort(), '_data/seo-tr.json must list exactly the localized pages.');

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [relative(join(root, 'tr'), path).split('\\').join('/')];
  });
}
assert.deepEqual(walk(join(root, 'tr')).sort(), [...pages].sort(), 'tr/ must mirror the localized pages exactly.');

for (const page of pages) {
  const english = read(page);
  const turkish = read(`tr/${page}`);
  const englishURL = siteBase + location(page);
  const turkishURL = `${siteBase}tr/${location(page)}`;
  const entry = seo[page];
  const alternates = [
    `<link rel="alternate" hreflang="en" href="${englishURL}" />`,
    `<link rel="alternate" hreflang="tr" href="${turkishURL}" />`,
    `<link rel="alternate" hreflang="x-default" href="${englishURL}" />`
  ];

  for (const [label, html] of [[page, english], [`tr/${page}`, turkish]]) {
    for (const link of alternates) assert(html.includes(link), `${label} misses ${link}`);
    assert.equal(html.match(/hreflang=/g)?.length, 3, `${label} must declare exactly three hreflang links.`);
  }

  assert(english.includes('<html lang="en">'), `${page} is not declared English.`);
  assert(turkish.includes('<html lang="tr" data-page-language="tr">'), `tr/${page} is not locked to Turkish.`);
  assert(english.includes(`<link rel="canonical" href="${englishURL}" />`), `${page} has the wrong canonical URL.`);
  assert(turkish.includes(`<link rel="canonical" href="${turkishURL}" />`), `tr/${page} has the wrong canonical URL.`);

  const title = meta(turkish, /<title>(.*?)<\/title>/);
  const description = meta(turkish, /<meta name="description" content="([^"]*)"/);
  assert.equal(title, fill(entry.title), `tr/${page} does not use its Turkish title.`);
  assert.equal(description, fill(entry.description), `tr/${page} does not use its Turkish description.`);
  assert.notEqual(description, meta(english, /<meta name="description" content="([^"]*)"/),
    `tr/${page} still carries the English description.`);
  if (/og:url/.test(english)) {
    assert(turkish.includes(`<meta property="og:url" content="${turkishURL}" />`), `tr/${page} has the wrong og:url.`);
    assert.equal(meta(turkish, /<meta property="og:title" content="([^"]*)"/), title, `tr/${page} has an English og:title.`);
  }

  checkPageMetadata(turkish, `tr/${page}`, {
    language: 'tr', url: turkishURL, image: `${siteBase}assets/images/og-tr.png`
  });

  // Assets resolve to the shared files; page links stay inside tr/.
  for (const match of turkish.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
    const reference = match[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(reference)) continue;
    const path = reference.replace(/[?#].*$/, '');
    if (!path) continue;
    const target = resolve(dirname(join(root, 'tr', page)), decodeURIComponent(path));
    assert(existsSync(target), `tr/${page} has a broken reference: ${reference}`);
    const inside = relative(root, target).split('\\').join('/');
    if (/\.html$/.test(inside) || (existsSync(target) && statSync(target).isDirectory())) {
      assert(inside.startsWith('tr/') || inside === 'tr', `tr/${page} links out of the Turkish tree: ${reference}`);
    }
  }
}

const sitemap = read('sitemap.xml');
assert(sitemap.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"'), 'sitemap.xml lacks the xhtml namespace.');
const urls = [...sitemap.matchAll(/<url>(.*?)<\/url>/g)].map((match) => match[1]);
assert.equal(urls.length, pages.length * 2, 'sitemap.xml must list every English and Turkish page.');
for (const url of urls) {
  assert.equal(url.match(/<xhtml:link rel="alternate"/g)?.length, 3, `A sitemap entry lacks its hreflang alternates: ${url}`);
}

console.log(`Turkish SEO audit passed: ${pages.length} Turkish pages, reciprocal hreflang links, and ${urls.length} sitemap URLs.`);
