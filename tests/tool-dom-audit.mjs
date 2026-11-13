#!/usr/bin/env node
/* Verify static DOM ids referenced by conventional tool modules. */

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const modulesDirectory = join(root, 'assets/js/tools');
const toolsDirectory = join(root, 'tools');
const dynamicElementIds = new Map([
  ['qr-generator', new Set([
    'qrText', 'qrURL', 'qrEmail', 'qrEmailSub', 'qrEmailBody', 'qrPhone',
    'qrSMSPhone', 'qrSMSMsg', 'qrWifiSSID', 'qrWifiPass', 'qrWifiPassToggle', 'qrWifiSec', 'qrWifiHidden',
    'qrVcFirst', 'qrVcLast', 'qrVcOrg', 'qrVcTitle', 'qrVcPhone', 'qrVcEmail', 'qrVcUrl', 'qrVcAddress',
    'qrEvTitle', 'qrEvStart', 'qrEvEnd', 'qrEvAllDay', 'qrEvLocation', 'qrEvDesc', 'qrGeoLat', 'qrGeoLng'
  ])],
  ['qr-reader', new Set(['qrReadCopyBtn'])]
]);

const modules = (await readdir(modulesDirectory))
  .filter((file) => file.endsWith('.js') && file !== 'expansion-tools.js')
  .sort();
const missingPages = [];
const unresolved = [];
let references = 0;

for (const moduleFile of modules) {
  const slug = moduleFile.slice(0, -3);
  const pageFile = join(toolsDirectory, `${slug}.html`);
  let page;
  try {
    page = await readFile(pageFile, 'utf8');
  } catch {
    missingPages.push(`${moduleFile} has no matching tool page.`);
    continue;
  }
  const source = await readFile(join(modulesDirectory, moduleFile), 'utf8');
  for (const match of source.matchAll(/document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const id = match[1];
    references += 1;
    const staticId = page.includes(`id="${id}"`) || page.includes(`id='${id}'`);
    const dynamicId = dynamicElementIds.get(slug)?.has(id);
    if (!staticId && !dynamicId) unresolved.push(`${slug}: #${id}`);
  }
}

assert.deepEqual(missingPages, [], `Tool module/page mapping failures:\n${missingPages.join('\n')}`);
assert.deepEqual(unresolved, [], `Tool modules reference missing DOM ids:\n${unresolved.join('\n')}`);
console.log(`Tool DOM audit passed: ${modules.length} conventional modules and ${references} element-id references.`);
