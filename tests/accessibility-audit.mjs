#!/usr/bin/env node
/* Static accessibility contracts that complement the browser tool-page audit. */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const toolsDirectory = join(root, 'tools');
const pages = [
  join(root, 'index.html'),
  join(root, '404.html'),
  join(root, 'license', 'index.html'),
  join(root, 'privacy', 'index.html'),
  ...readdirSync(toolsDirectory).filter((file) => file.endsWith('.html')).sort().map((file) => join(toolsDirectory, file))
];
const liveValues = new Set(['off', 'polite', 'assertive']);

function pageName(file) {
  return file.slice(root.length + 1);
}

function token(css, name) {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  assert(match, `Missing ${name} colour token.`);
  return match[1];
}

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const name = pageName(file);
  assert(/<html\s+lang="en">/.test(html), `${name}: document language must declare English as the source locale.`);
  assert(/<main(?:\s|>)/.test(html), `${name}: main landmark is missing.`);
  assert(/<h1(?:\s|>)/.test(html), `${name}: primary heading is missing.`);
  assert(!/tabindex\s*=\s*["'][1-9]\d*["']/i.test(html), `${name}: positive tabindex breaks natural keyboard focus order.`);

  for (const image of html.matchAll(/<img\b[^>]*>/gi)) {
    assert(/\balt\s*=\s*["'][^"']*["']/i.test(image[0]), `${name}: image is missing an alt attribute.`);
  }

  for (const input of html.matchAll(/<input\b[^>]*\btype\s*=\s*["']file["'][^>]*>/gi)) {
    assert(/\bclass\s*=\s*["'][^"']*\bsr-only\b[^"']*["']/i.test(input[0])
      || /\bstyle\s*=\s*["'][^"']*display\s*:\s*none/i.test(input[0])
      || /\bhidden\b/i.test(input[0]),
    `${name}: a native browser file input is visibly exposed instead of using the accessible file-picker UI.`);
  }

  const ids = new Set([...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]));
  for (const label of html.matchAll(/<label\b[^>]*\bfor\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    assert(ids.has(label[1]), `${name}: label references missing control #${label[1]}.`);
  }

  for (const region of html.matchAll(/\baria-live\s*=\s*["']([^"']+)["']/gi)) {
    assert(liveValues.has(region[1]), `${name}: invalid aria-live value "${region[1]}".`);
  }
}

// ARIA 1.2 forbids naming generic elements: a labelled div, span, p, pre or
// code needs a role (region, group, img, note, status …) or the name is lost.
for (const file of pages) {
  const name = pageName(file);
  const html = readFileSync(file, 'utf8');
  for (const element of html.matchAll(/<(div|span|p|pre|code)\b[^>]*\baria-label(?:ledby)?\s*=[^>]*>/gi)) {
    assert(/\brole\s*=/.test(element[0]), `${name}: ${element[0].slice(0, 90)} is named but has no role.`);
  }
  // A control whose name differs from its visible text cannot be called by
  // what it shows (WCAG 2.5.3): the name must contain the visible words.
  for (const control of html.matchAll(/<(button|a)\b([^>]*)\baria-label="([^"]*)"([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    const visible = control[5].replace(/<[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/[a-z]+>/gi, '').replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!/[A-Za-z]/.test(visible)) continue;
    assert(control[3].toLowerCase().includes(visible.toLowerCase()),
      `${name}: "${control[3]}" does not contain the visible label "${visible}".`);
  }
}

const expansionScript = readFileSync(join(root, 'assets', 'js', 'tools', 'expansion-tools.js'), 'utf8');
for (const input of expansionScript.matchAll(/<input\b[^>]*\btype=["']file["'][^>]*>/gi)) {
  assert(/\bclass=["'][^"']*\bsr-only\b[^"']*["']/i.test(input[0]) || /\bhidden\b/i.test(input[0]),
    'Dynamically rendered tools must not expose a native browser file input.');
}

const coreCss = readFileSync(join(root, 'assets', 'css', 'core.css'), 'utf8');
assert(/:focus-visible\s*\{[\s\S]*outline:\s*2px solid var\(--accent\) !important/.test(coreCss),
  'Shared styles must provide a visible keyboard focus indicator.');
assert(/--radius-full:\s*999px/.test(coreCss), 'Shared styles must define the full-radius token used by controls.');

const typingCss = readFileSync(join(root, 'assets', 'css', 'features', 'typing-test.css'), 'utf8');
const reducedMotionBlock = typingCss.slice(typingCss.indexOf('@media (prefers-reduced-motion: reduce)'));
assert(reducedMotionBlock.includes('animation: none !important; transition: none !important;'),
  'Typing-test reduced-motion styles must fully disable caret and stream motion.');

const background = token(coreCss, 'bg-base');
for (const name of ['text-primary', 'text-secondary', 'text-muted', 'accent', 'green', 'yellow', 'red']) {
  assert(contrast(token(coreCss, name), background) >= 4.5,
    `${name} does not meet the 4.5:1 text contrast baseline against the base background.`);
}

console.log(`Accessibility audit passed: ${pages.length} pages, static and dynamic file controls, semantic landmarks, labels, focus order, live-region values, and colour contrast.`);
