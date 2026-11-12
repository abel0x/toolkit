#!/usr/bin/env node
/* Shared checks for social preview tags and JSON-LD. */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Social previews and JSON-LD, shared by the English and Turkish audits.
export function checkPageMetadata(html, label, { language, url, image }) {
  const meta = (pattern) => html.match(pattern)?.[1] ?? null;
  assert.equal(meta(/<meta property="og:image" content="([^"]*)"/), image, `${label} has the wrong og:image.`);
  assert.equal(meta(/<meta name="twitter:image" content="([^"]*)"/), image, `${label} has the wrong twitter:image.`);
  assert.equal(meta(/<meta name="twitter:card" content="([^"]*)"/), 'summary_large_image', `${label} lacks a large preview card.`);
  assert.equal(meta(/<meta property="og:locale" content="([^"]*)"/), language === 'tr' ? 'tr_TR' : 'en_US', `${label} has the wrong og:locale.`);
  assert(meta(/<meta property="og:image:alt" content="([^"]*)"/), `${label} lacks og:image:alt.`);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1, `${label} must have exactly one JSON-LD block.`);
  const data = JSON.parse(blocks[0][1]);
  assert.equal(data['@context'], 'https://schema.org', `${label} JSON-LD has the wrong @context.`);
  const nodes = data['@graph'] || [data];
  const main = nodes[0];
  assert.equal(main.inLanguage, language, `${label} JSON-LD has the wrong language.`);
  assert.equal(main.url, url, `${label} JSON-LD points at the wrong URL.`);
  assert(main.description, `${label} JSON-LD lacks a description.`);
  if (main['@type'] === 'WebApplication') {
    const crumbs = nodes.find((node) => node['@type'] === 'BreadcrumbList')?.itemListElement || [];
    assert.equal(crumbs.length, 2, `${label} lacks its breadcrumb.`);
    assert.equal(crumbs[1].item, url, `${label} breadcrumb does not end at the page.`);
  }
  return main['@type'];
}

export function checkPreviewImage(path, label) {
  const png = readFileSync(path);
  assert.equal(png.toString('ascii', 1, 4), 'PNG', `${label} is not a PNG.`);
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], `${label} must be 1200×630.`);
  assert(png.length < 300_000, `${label} is larger than 300 KB.`);
}
