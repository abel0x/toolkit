#!/usr/bin/env node
/*
 * Build helper for `build.py --turkish`: translates English UI strings with
 * the same runtime the browser uses (assets/js/core/i18n.js with
 * i18n-tr.js and i18n-expansion.js), so the static Turkish pages and the live translator
 * never disagree.
 *
 * stdin:  a JSON array of English keys
 * stdout: a JSON object { key: Turkish } for the keys that change
 *
 * It fails when a Turkish result would be translated again by the runtime,
 * because the /tr/ pages still run i18n.js over their already-Turkish body.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const core = join(root, 'assets', 'js', 'core');

// Just enough of a browser for i18n.js to load without a body to translate.
const context = {
  document: {
    documentElement: { dataset: { pageLanguage: 'tr' } },
    title: '',
    currentScript: null,
    body: null,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  },
  localStorage: { getItem: () => null, setItem: () => {} },
  MutationObserver: class { observe() {} },
  CustomEvent: class {},
  dispatchEvent: () => {}
};
context.window = context;
vm.createContext(context);
for (const name of ['i18n-tr.js', 'i18n-expansion.js', 'i18n.js']) {
  vm.runInContext(readFileSync(join(core, name), 'utf8'), context, { filename: name });
}
if (!context.TOOLKIT_I18N_TR || !context.TOOLKIT_I18N_EXTRA || context.ToolkitI18n.getLanguage() !== 'tr') {
  process.stderr.write('The Turkish dictionaries did not load, so nothing could be translated.\n');
  process.exit(1);
}
const { t } = context.ToolkitI18n;

const keys = JSON.parse(readFileSync(0, 'utf8'));
const translations = {};
const unstable = [];
for (const key of keys) {
  const turkish = t(key);
  if (turkish === key) continue;
  translations[key] = turkish;
  const again = t(turkish);
  if (again !== turkish) unstable.push(`  ${JSON.stringify(key)} → ${JSON.stringify(turkish)} → ${JSON.stringify(again)}`);
}
if (unstable.length) {
  process.stderr.write('These Turkish strings would be translated twice by i18n.js:\n' + unstable.join('\n') + '\n');
  process.exit(1);
}
process.stdout.write(JSON.stringify(translations));
