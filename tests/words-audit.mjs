#!/usr/bin/env node
/* Static contract checks for reusable, offline word-list data. */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wordsRoot = join(root, 'words');
const groups = new Set(['Core', 'Places', 'Professional', 'Technical']);
const provenanceMethods = new Set([
  'editorially-reviewed',
  'original-translation',
  'public-domain-selection',
  'transformed'
]);
const requiredCategories = {
  en: ['common-200', 'common-1000', 'idioms', 'cities', 'countries', 'medical', 'legal', 'finance', 'programming', 'quotes'],
  tr: ['common-200', 'common-1000', 'cities', 'districts', 'medical', 'legal', 'finance', 'programming', 'idioms', 'quotes']
};
// Quality floors after removing synthetic vocabulary and unverified attributions.
// Source identifiers and compositional quote checks below replace inflated counts.
const sizeRules = {
  en: {
    'common-200': [200, 200], 'common-1000': [1000, 1000], 'cities': [200, 300], 'countries': [190, 200],
    'medical': [1000, 2000], 'legal': [500, 700], 'finance': [500, 700], 'programming': [400, 500], 'idioms': [300, 500], 'quotes': [120, 300]
  },
  tr: {
    'common-200': [200, 200], 'common-1000': [1000, 1000], 'cities': [81, 81], 'districts': [300, 500],
    'medical': [500, 1200], 'legal': [500, 800], 'finance': [500, 700], 'programming': [400, 500], 'idioms': [300, 500], 'quotes': [120, 300]
  }
};
const prohibitedTerms = new Set([
  'slur', 'profanity', 'obscenity', 'hate', 'violence', 'religion', 'politics'
]);
const legitimateTurkishFoldPairs = new Set([
  ['cam', 'çam'].sort().join('\u0000'),
  ['diş', 'dış'].sort().join('\u0000'),
  ['gol', 'göl'].sort().join('\u0000'),
  ['su', 'şu'].sort().join('\u0000')
]);

function fileText(path) {
  const text = readFileSync(path, 'utf8');
  assert(!text.includes('\r'), `${relative(root, path)} must use LF line endings.`);
  assert(text.endsWith('\n'), `${relative(root, path)} must have a final newline.`);
  return text;
}

function jsonFile(path) {
  const text = fileText(path);
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    assert.fail(`${relative(root, path)} is not valid JSON: ${error.message}`);
  }
  text.trimEnd().split('\n').forEach((line) => {
    assert(!line.startsWith('\t'), `${relative(root, path)} must not use tab indentation.`);
    const spaces = (line.match(/^ */) || [''])[0].length;
    assert.equal(spaces % 2, 0, `${relative(root, path)} must use two-space JSON indentation.`);
  });
  return data;
}

function codePointLength(value) {
  return Array.from(value).length;
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function foldTurkish(value) {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('tr')
    .replaceAll('ç', 'c')
    .replaceAll('ğ', 'g')
    .replaceAll('ı', 'i')
    .replaceAll('ö', 'o')
    .replaceAll('ş', 's')
    .replaceAll('ü', 'u');
}

function isLegitimateTurkishFoldPair(first, second) {
  const pair = [first, second]
    .map((value) => value.normalize('NFC').toLocaleLowerCase('tr'))
    .sort()
    .join('\u0000');
  return legitimateTurkishFoldPairs.has(pair);
}

function collectJsonFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectJsonFiles(path);
    return entry.isFile() && entry.name.endsWith('.json') ? [path] : [];
  });
}

function assertEntry(value, language, path, allowsMultiWord, quote, longForm) {
  assert.equal(typeof value, 'string', `${relative(root, path)} has a non-string entry.`);
  assert(value.length > 0, `${relative(root, path)} has an empty entry.`);
  assert.equal(value, value.trim(), `${relative(root, path)} has surrounding whitespace.`);
  assert(!/[\t\r\n\u00a0\u00ad\u200b-\u200f\ufeff]/u.test(value),
    `${relative(root, path)} has a forbidden invisible character.`);
  assert.equal(value, value.normalize('NFC'), `${relative(root, path)} has a non-NFC entry: ${value}`);
  if (!quote) {
    if (!allowsMultiWord) assert(!value.includes(' '), `${relative(root, path)} has an unexpected multi-word entry: ${value}`);
    if (allowsMultiWord && value.includes(' ')) assert(value.split(' ').every(Boolean), `${relative(root, path)} has invalid word separators.`);
    if (!longForm) {
      assert(codePointLength(value) >= 1 && codePointLength(value) <= 24,
        `${relative(root, path)} entry is outside the 1–24 character limit: ${value}`);
    }
  } else {
    assert(codePointLength(value) >= 40 && codePointLength(value) <= 260,
      `${relative(root, path)} quote is outside the 40–260 character limit.`);
  }
  const normalised = value.toLocaleLowerCase(language);
  assert(!prohibitedTerms.has(normalised), `${relative(root, path)} contains a prohibited loaded term: ${value}`);
}

const manifestPath = join(wordsRoot, 'manifest.json');
const manifest = jsonFile(manifestPath);
assert.equal(manifest.schemaVersion, 1, 'Word-list manifest has an unsupported schema version.');
assert.match(manifest.generated, /^\d{4}-\d{2}-\d{2}$/, 'Manifest generation date must use YYYY-MM-DD.');
assert(Array.isArray(manifest.languages) && manifest.languages.length === 2, 'Manifest must define English and Turkish.');

const references = new Set();
let totalEntries = 0;
let totalBytes = statSync(manifestPath).size;

for (const language of manifest.languages) {
  assert(['en', 'tr'].includes(language.code), `Unexpected language: ${language.code}`);
  assert.equal(language.direction, 'ltr', `${language.code} must be left-to-right.`);
  assert(Array.isArray(language.categories), `${language.code} must define categories.`);
  const ids = new Set();
  for (const category of language.categories) {
    assert.match(category.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `Invalid category id: ${category.id}`);
    assert(!ids.has(category.id), `Duplicate category id in ${language.code}: ${category.id}`);
    ids.add(category.id);
    assert(groups.has(category.group), `Invalid category group: ${category.group}`);
    assert(['words', 'quotes'].includes(category.type), `Invalid category type: ${category.type}`);
    assert(Number.isInteger(category.order), `Category order must be an integer: ${category.id}`);
    assert(Number.isInteger(category.count) && category.count > 0, `Category count is invalid: ${category.id}`);
    assert(!category.file.startsWith('/') && !category.file.includes('..'), `Unsafe category path: ${category.file}`);
    const expectedPrefix = `${language.code}/`;
    assert(category.file.startsWith(expectedPrefix), `Category file must stay in its language directory: ${category.file}`);
    const path = join(wordsRoot, category.file);
    assert.equal(statSync(path).isFile(), true, `Missing category file: ${category.file}`);
    references.add(category.file);
    totalBytes += statSync(path).size;
    const data = jsonFile(path);
    const entries = category.type === 'quotes' ? data.quotes : data.words;
    assert.equal(data.schemaVersion, 1, `${category.file} has an unsupported schema version.`);
    for (const key of ['id', 'language', 'label', 'type', 'license', 'source']) {
      assert(data[key], `${category.file} is missing ${key}.`);
    }
    assert.equal(data.id, category.id, `${category.file} id must match the manifest.`);
    assert.equal(data.id, category.file.split('/').at(-1).replace(/\.json$/, ''), `${category.file} id must match its filename.`);
    assert.equal(data.language, language.code, `${category.file} has the wrong language.`);
    assert.equal(data.label, category.label, `${category.file} label must match the manifest.`);
    assert.equal(data.type, category.type, `${category.file} type must match the manifest.`);
    assert([
      'CC0-1.0',
      'MIT',
      'NLM MeSH Terms and Conditions',
      'U.S. Government works (17 U.S.C. § 105)',
      'FSEK Art. 31 (official legislation)'
    ].includes(data.license),
      `${category.file} must state an approved redistribution licence.`);
    assert(!/(?:github|gitlab|bitbucket)\.com/i.test(data.source),
      `${category.file} must not use a code-hosting repository as its word-data source.`);
    assert(!/\bcompiled from\b/i.test(data.source),
      `${category.file} must describe its provenance instead of using an ambiguous compiled-source claim.`);
    assert(data.provenance && typeof data.provenance === 'object', `${category.file} is missing provenance.`);
    assert(provenanceMethods.has(data.provenance.method), `${category.file} has an unsupported provenance method.`);
    assert.match(data.provenance.reviewed, /^\d{4}-\d{2}-\d{2}$/,
      `${category.file} provenance review date must use YYYY-MM-DD.`);
    assert.equal(new Date(`${data.provenance.reviewed}T00:00:00Z`).toISOString().slice(0, 10), data.provenance.reviewed,
      `${category.file} has an invalid provenance review date.`);
    assert(data.provenance.reviewed <= manifest.generated,
      `${category.file} provenance review date is newer than the manifest generation date.`);
    assert(Array.isArray(data.provenance.sources) && data.provenance.sources.length > 0,
      `${category.file} must cite at least one provenance source URL.`);
    data.provenance.sources.forEach((source) => {
      assert.equal(typeof source, 'string', `${category.file} has a non-string provenance source.`);
      const url = new URL(source);
      assert.equal(url.protocol, 'https:', `${category.file} provenance sources must use HTTPS.`);
      assert(!/(?:github|gitlab|bitbucket)\.com/i.test(url.hostname),
        `${category.file} must not cite a code-hosting repository as provenance.`);
    });
    assert(data.meta && typeof data.meta === 'object', `${category.file} is missing meta.`);
    assert(Array.isArray(entries) && entries.length > 0, `${category.file} has no entries.`);
    assert.equal(entries.length, category.count, `${category.file} count differs from the manifest.`);
    const [minimum, maximum] = sizeRules[language.code][category.id];
    assert(entries.length >= minimum && entries.length <= maximum,
      `${category.file} must contain ${minimum === maximum ? minimum : `${minimum}–${maximum}`} entries.`);
    const values = category.type === 'quotes' ? entries.map((quote) => quote.text) : entries;
    if (category.file === 'en/medical.json') {
      const identifiers = data.provenance.descriptorIds;
      assert.equal(identifiers?.length, entries.length, 'Every MeSH word must retain its descriptor identifier.');
      identifiers.forEach((id) => assert.match(id, /^D\d{6,9}$/, 'Invalid MeSH descriptor identifier.'));
      assert.equal(new Set(identifiers).size, identifiers.length, 'MeSH descriptors must be unique.');
      assert(data.source.includes('Courtesy of the U.S. National Library of Medicine'), 'NLM acknowledgement is required.');
    }
    if (category.file === 'tr/medical.json') {
      assert.equal(data.provenance.method, 'editorially-reviewed');
      assert(!data.provenance.sources.some((source) => source.includes('wikidata.org')), 'Do not restore the unverified label import.');
      const badRoots = /^(?:renal|pulmo|endo|immüno)(?:loji|grafi|skopi|pati|terapi|genik|tomi|plasti|metre|gram|liz|sit|blast)$/u;
      values.forEach((value) => assert(!badRoots.test(value) || ['endoskopi', 'immünoloji', 'immünoterapi'].includes(value), 'Unreviewed synthetic medical form: ' + value));
    }
    if (language.code === 'en' && ['cities', 'countries'].includes(category.id)) {
      values.forEach((value) => assert(!/[a-z][A-Z]/.test(value), 'Geographical names must retain word separators: ' + value));
    }
    if (category.file === 'tr/idioms.json') {
      const rejectedCombination = /^(?:adım|akıl|anlayış|bakış|denge|dikkat|emek|güven|hedef|karar|sabır) (?:atmak|vermek|koymak|bulmak|almak|açmak|korumak|kurmak|izlemek|paylaşmak)$/u;
      const conventional = new Set(['adım atmak', 'akıl vermek', 'akıl almak', 'bakış atmak', 'emek vermek', 'güven vermek', 'hedef almak', 'karar vermek', 'karar almak']);
      values.forEach((value) => assert(!rejectedCombination.test(value) || conventional.has(value), 'Unreviewed noun-verb combination: ' + value));
    }
    if (category.file === 'en/programming.json') {
      const reviewed = new Set(['microservice', 'microtask', 'microcode', 'microdata', 'multithread', 'multitask', 'multigraph']);
      values.forEach((value) => assert(!/^(micro|multi|meta)(service|module|thread|task|cache|load|test|build|type|code|data|link|flow|graph|stack)$/.test(value) || reviewed.has(value), 'Unreviewed synthetic programming form: ' + value));
      ['machinelearning', 'sourcecode', 'accesscontrol', 'eventloop'].forEach((value) => assert(!values.includes(value), 'A programming concept lost its word separator: ' + value));
    }
    const seen = new Set();
    values.forEach((value, index) => {
      assertEntry(value, language.code, path, Boolean(data.meta.hasMultiWordEntries), category.type === 'quotes', category.id === 'idioms');
      const key = value.normalize('NFC').toLocaleLowerCase(language.code);
      assert(!seen.has(key), `${category.file} contains a duplicate entry: ${value}`);
      seen.add(key);
      if (category.type === 'quotes') {
        assert.equal(typeof entries[index].source, 'string', `${category.file} quote has no attribution.`);
        assert.match(entries[index].source, /.+ — .+/, `${category.file} quote attribution must name its author and work or excerpt.`);
        assert.notEqual(entries[index].source, 'Original neutral sentence', `${category.file} quote must be literary rather than a neutral practice sentence.`);
        assert.equal(entries[index].length, codePointLength(value), `${category.file} quote length is inaccurate.`);
        const quote = entries[index];
        if (quote.parts) {
          assert(quote.source.includes('Selected excerpts:'), 'A combined passage must disclose its editing.');
          assert(quote.parts.length >= 2 && quote.parts.length <= 3, 'A curated excerpt must reference two or three base passages.');
          quote.parts.forEach((part) => {
            assert(Number.isInteger(part) && part >= 0 && part < index && entries[part].bookId, 'Invalid base-passage reference.');
            assert.equal(entries[part].source.split(' — ')[0], quote.source.split(' — ')[0], 'Do not combine different authors.');
          });
          assert.equal(value, quote.parts.map((part) => entries[part].text).join(' '), 'Curated excerpts must preserve their verified passages.');
        } else {
          assert(Number.isInteger(quote.bookId) && quote.bookId > 0, 'A base quotation needs a specific edition identifier.');
          assert(data.provenance.sources.includes(`https://www.gutenberg.org/ebooks/${quote.bookId}`), 'The cited edition must appear in the source index.');
        }
      }
    });
    if (language.code === 'tr') {
      const folded = new Map();
      values.forEach((value) => {
        const key = foldTurkish(value);
        const siblings = folded.get(key) || [];
        const hasDiacritic = /[çğıöşü]/iu.test(value);
        const conflictingSibling = siblings.find((sibling) =>
          /[çğıöşü]/iu.test(sibling) !== hasDiacritic &&
          !isLegitimateTurkishFoldPair(sibling, value));
        if (conflictingSibling) {
          assert.fail(`${category.file} has an ASCII fallback duplicate: ${value}`);
        }
        siblings.push(value);
        folded.set(key, siblings);
      });
    }
    const lengths = values.map(codePointLength);
    assert.equal(data.meta.hasDiacritics, values.some((value) => /[^\x00-\x7f]/u.test(value)), `${category.file} diacritic metadata is inaccurate.`);
    assert.equal(data.meta.hasMultiWordEntries, values.some((value) => value.includes(' ')), `${category.file} multi-word metadata is inaccurate.`);
    assert.equal(data.meta.avgLength, roundOne(lengths.reduce((sum, length) => sum + length, 0) / lengths.length),
      `${category.file} has an inaccurate average length.`);
    assert.equal(data.meta.maxLength, Math.max(...lengths), `${category.file} has an inaccurate maximum length.`);
    totalEntries += values.length;
    if (category.id === 'quotes') {
      const quoteLengths = entries.map((quote) => quote.length);
      const short = quoteLengths.filter((length) => length <= 100).length;
      const medium = quoteLengths.filter((length) => length >= 101 && length <= 170).length;
      const long = quoteLengths.filter((length) => length >= 171 && length <= 260).length;
      assert(short >= 40 && medium >= 40 && long >= 40,
        `${category.file} must offer at least 40 short, medium, and long literary excerpts.`);
    }
  }
  assert.deepEqual([...ids].sort(), [...requiredCategories[language.code]].sort(),
    `${language.code} category catalogue is incomplete.`);
  const common200 = jsonFile(join(wordsRoot, language.code, 'common-200.json')).words;
  const common1000 = jsonFile(join(wordsRoot, language.code, 'common-1000.json')).words;
  const common1000Keys = new Set(common1000.map((value) => value.toLocaleLowerCase(language.code)));
  common200.forEach((value) => assert(common1000Keys.has(value.toLocaleLowerCase(language.code)),
    `${language.code}/common-1000.json must contain every common-200 entry.`));
  if (language.code === 'tr') {
    const generatedPrefixes = ['ön', 'son', 'ana', 'alt', 'üst', 'iç', 'dış', 'çok', 'tek', 'eş', 'karşı', 'yeni'];
    const generatedStems = [
      'adım', 'alan', 'bilgi', 'bölüm', 'değer', 'düzen', 'etki', 'görev', 'işlem', 'kaynak',
      'konu', 'kural', 'model', 'nokta', 'plan', 'süreç', 'tablo', 'yol', 'yöntem', 'zaman'
    ];
    generatedPrefixes.forEach((prefix) => generatedStems.forEach((stem) => {
      const generatedForm = `${prefix}${stem}`;
      assert(!common1000Keys.has(generatedForm),
        `tr/common-1000.json contains a generated compound form: ${generatedForm}`);
    }));
    ['soyadı', 'hikâye', 'imkân'].forEach((value) => assert(common1000Keys.has(value),
      `tr/common-1000.json is missing the reviewed spelling: ${value}`));
    ['soyad', 'hikaye', 'imkan'].forEach((value) => assert(!common1000Keys.has(value),
      `tr/common-1000.json contains an unreviewed spelling: ${value}`));
  }
}

const actualFiles = collectJsonFiles(wordsRoot)
  .map((path) => relative(wordsRoot, path).replaceAll('\\', '/'))
  .filter((path) => path !== 'manifest.json');
assert.deepEqual([...references].sort(), actualFiles.sort(), 'Word-list data has an orphan or dangling manifest entry.');
assert(totalBytes < 500 * 1024, `Word-list payload is ${totalBytes} bytes; budget is 512000 bytes.`);
for (const path of collectJsonFiles(wordsRoot)) {
  assert(statSync(path).size <= 80 * 1024, `${relative(root, path)} exceeds the 80 KB per-file budget.`);
}

console.log(`Words audit passed: ${manifest.languages.length} languages, ${references.size} categories, ${totalEntries} entries, ${totalBytes} bytes.`);
