#!/usr/bin/env node
/*
 * Build helper for `build.py --turkish`, using the same runtime the browser
 * uses (assets/js/core/i18n.js with i18n-tr.js and i18n-expansion.js), so the
 * static Turkish pages and the live translator never disagree.
 *
 * Default mode
 *   stdin:  a JSON array of English keys
 *   stdout: a JSON object { key: Turkish } for the keys that change
 *   It fails when a Turkish result would be translated again by the runtime,
 *   because the /tr/ pages still run i18n.js over their already-Turkish body.
 *
 * --packs
 *   stdin:  { "shared": "<source text>", "modules": { "<name>": "<source text>" } }
 *   stdout: { "shared": { key: Turkish }, "modules": { "<name>": { key: Turkish } } }
 *   The dictionary entries whose English key appears as a string in each
 *   source: what scripts can ask i18n.js to translate at run time. Module
 *   packs leave out what the shared pack already has.
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

if (process.argv.includes('--packs')) {
  const { shared, modules } = JSON.parse(readFileSync(0, 'utf8'));
  const dictionary = { ...context.TOOLKIT_I18N_TR.strings, ...context.TOOLKIT_I18N_EXTRA.tr };
  // A key counts as used when it appears as written in a JS or JSON string.
  const spellings = (key) => [...new Set([key, key.replace(/'/g, "\\'"), JSON.stringify(key).slice(1, -1)])];
  const pick = (source, skip = {}) => Object.fromEntries(Object.entries(dictionary)
    .filter(([key]) => !Object.hasOwn(skip, key) && spellings(key).some((spelling) => source.includes(spelling))));
  const sharedPack = pick(shared);
  for (const key of context.TOOLKIT_I18N_TR.patternKeys) {
    if (!Object.hasOwn(dictionary, key)) {
      process.stderr.write(`patternKeys lists ${JSON.stringify(key)}, which has no Turkish entry.\n`);
      process.exit(1);
    }
    sharedPack[key] = dictionary[key];
  }
  const modulePacks = Object.fromEntries(Object.entries(modules)
    .map(([name, source]) => [name, pick(source, sharedPack)]));
  process.stdout.write(JSON.stringify({ shared: sharedPack, modules: modulePacks }));
} else {
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
    process.exitCode = 1;
  } else {
    process.stdout.write(JSON.stringify(translations));
  }
}
