#!/usr/bin/env node
/* Static and runtime contracts for the client-side English/Turkish interface. */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corePath = join(root, 'assets/js/core/i18n.js');
const turkishPath = join(root, 'assets/js/core/i18n-tr.js');
const expansionPath = join(root, 'assets/js/core/i18n-expansion.js');
const coreSource = readFileSync(corePath, 'utf8');
const turkishSource = readFileSync(turkishPath, 'utf8');
const expansionSource = readFileSync(expansionPath, 'utf8');
const coreDictionaryStart = turkishSource.indexOf('  const strings = Object.freeze({');
const coreDictionaryEnd = turkishSource.indexOf('\n  });', coreDictionaryStart);
assert(coreDictionaryStart !== -1 && coreDictionaryEnd !== -1, 'Could not locate the core Turkish dictionary.');
const coreDictionarySource = turkishSource.slice(coreDictionaryStart, coreDictionaryEnd);

class FakeElement {
  constructor(tagName = 'div', attributes = {}) {
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.dataset = {};
    this.textContent = '';
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  get value() {
    return this.getAttribute('value') ?? this.textContent;
  }

  set value(value) {
    this.setAttribute('value', value);
  }

  matches(selector) {
    return selector === 'option:not([value])' && this.tagName === 'OPTION' && !this.hasAttribute('value');
  }

  querySelectorAll() {
    return [];
  }
}

function createRuntime() {
  const body = new FakeElement('body');
  const document = {
    title: '',
    body,
    documentElement: { dataset: {} },
    addEventListener() {},
    createTreeWalker() {
      return { currentNode: null, nextNode: () => false };
    },
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const window = {
    addEventListener() {},
    dispatchEvent() {}
  };
  const context = {
    window,
    document,
    localStorage: {
      getItem: () => null,
      setItem() {}
    },
    NodeFilter: { SHOW_TEXT: 4 },
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    MutationObserver: class {
      observe() {}
    },
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(turkishSource, context, { filename: turkishPath });
  vm.runInContext(expansionSource, context, { filename: expansionPath });
  vm.runInContext(coreSource, context, { filename: corePath });
  return { context, runtime: window.ToolkitI18n };
}

function findDuplicateSourceKeys(source) {
  const lines = source.split('\n');
  const seen = new Map();
  lines.forEach((line, index) => {
    const match = line.match(/^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:/);
    if (!match) return;
    const key = match[2].replace(/\\(['"\\])/g, '$1');
    seen.set(key, [...(seen.get(key) || []), index + 1]);
  });
  return [...seen.entries()].filter(([, linesForKey]) => linesForKey.length > 1);
}


const { context, runtime } = createRuntime();
assert(runtime, 'The i18n runtime did not initialise.');
runtime.setLanguage('tr');

const duplicateExpansionKeys = findDuplicateSourceKeys(expansionSource);
assert.deepEqual(duplicateExpansionKeys, [], 'The expansion Turkish dictionary has duplicate source keys.');
const duplicateCoreKeys = findDuplicateSourceKeys(coreDictionarySource);
assert.deepEqual(duplicateCoreKeys, [], 'The core Turkish dictionary has duplicate source keys.');

const coreDictionary = context.window.TOOLKIT_I18N_TR.strings;
const expansionDictionary = context.window.TOOLKIT_I18N_EXTRA.tr;
const overlappingKeys = Object.keys(coreDictionary).filter((key) => Object.hasOwn(expansionDictionary, key));
assert.deepEqual(overlappingKeys, [], 'Core and expansion dictionaries must not shadow each other.');

const expectedTranslations = {
  'Duration': 'Süre',
  'Date Duration Calculator': 'Tarih Aralığı Hesaplayıcı',
  'Typing Speed Test': 'Yazma Hızı Testi',
  'Markdown': 'Markdown',
  'Bold': 'Kalın',
  'Order:': 'Sıralama:',
  'Open Graph Title': 'Open Graph Başlığı',
  'Open Graph Tags Generator': 'Open Graph Etiket Oluşturucu',
  'Data URI (data:image/…;base64,…)': 'Veri URI’si (data:image/…;base64,…)',
  'Raw Base64 only': 'Yalnızca ham Base64',
  'Token': 'Belirteç',
  'hex': 'onaltılık',
  'X% of Y': 'Y’nin %X’i',
  'To (Y)': 'Bitiş (Y)',
  'User-Agent': 'User-Agent',
  'Water Freezing': 'Suyun Donma Noktası',
  'Water Boiling': 'Suyun Kaynama Noktası',
  'Words per minute': 'Dakikadaki kelime sayısı'
};
for (const [source, translated] of Object.entries(expectedTranslations)) {
  assert.equal(runtime.t(source), translated, `Incorrect Turkish translation for: ${source}`);
}

const expectedPatterns = {
  'Search 101 tools…': '101 araç ara…',
  'Browse 101 Tools': '101 Araca Göz At',
  '101 Tools': '101 Araç',
  'Generated 12 name(s)': '12 ad oluşturuldu',
  '3 minutes ago': '3 dakika önce',
  '8 valid / 2 invalid': '8 geçerli / 2 geçersiz'
};
for (const [source, translated] of Object.entries(expectedPatterns)) {
  assert.equal(runtime.t(source), translated, `Turkish pattern translation regressed for: ${source}`);
}

for (const file of readdirSync(join(root, 'tools')).filter((name) => name.endsWith('.html'))) {
  const html = readFileSync(join(root, 'tools', file), 'utf8');
  const title = html.match(/<title>(.*?) — Toolkit<\/title>/)?.[1];
  assert(title, `${file} has no conventional Toolkit title.`);
  assert.notEqual(runtime.t(title), title, `${file} has no Turkish document-title translation for ${title}.`);
}

const option = new FakeElement('option', { value: 'text' });
const implicitOption = new FakeElement('option');
implicitOption.textContent = 'weekly';
const radio = new FakeElement('input', { type: 'radio', value: 'integer' });
const textInput = new FakeElement('input', { type: 'text', value: 'custom value' });
const submit = new FakeElement('input', { type: 'submit', value: 'Generate', 'aria-label': 'Open' });
const controlsRoot = new FakeElement('div');
controlsRoot.querySelectorAll = (selector) => {
  const controls = [option, implicitOption, radio, textInput, submit];
  return selector === 'option:not([value])' ? controls.filter((control) => control.matches(selector)) : controls;
};
runtime.apply(controlsRoot);
assert.equal(option.getAttribute('value'), 'text', 'Translation changed an option value.');
assert.equal(implicitOption.getAttribute('value'), 'weekly', 'An implicit option value must be pinned before translating its text.');
assert.equal(radio.getAttribute('value'), 'integer', 'Translation changed a radio value.');
assert.equal(textInput.getAttribute('value'), 'custom value', 'Translation changed user input data.');
assert.equal(submit.getAttribute('value'), 'Oluştur', 'A submit control label was not translated.');
assert.equal(submit.getAttribute('aria-label'), 'Aç', 'An accessible name was not translated.');

runtime.setLanguage('en');
runtime.apply(controlsRoot);
assert.equal(option.getAttribute('value'), 'text', 'English restore changed an option value.');
assert.equal(implicitOption.getAttribute('value'), 'weekly', 'English restore changed a pinned implicit option value.');
assert.equal(radio.getAttribute('value'), 'integer', 'English restore changed a radio value.');
assert.equal(textInput.getAttribute('value'), 'custom value', 'English restore changed user input data.');
assert.equal(submit.getAttribute('value'), 'Generate', 'English restore did not restore a submit label.');
assert.equal(submit.getAttribute('aria-label'), 'Open', 'English restore did not restore an accessible name.');

console.log(`i18n audit passed: ${Object.keys(coreDictionary).length} core keys, ${Object.keys(expansionDictionary).length} expansion keys, and ${readdirSync(join(root, 'tools')).filter((name) => name.endsWith('.html')).length} translated tool titles.`);
