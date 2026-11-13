#!/usr/bin/env node
/* Real-browser coverage for defects found in the October 2026 audit. */
import assert from 'node:assert/strict';
import { withFirefox } from './browser-session.mjs';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

await withFirefox(async (page) => {
  await page.viewport(1280, 900);

  async function open(path, language = 'en') {
    await page.navigate(path);
    await page.evaluate((language) => localStorage.setItem('toolkit-language', language), language);
    await page.navigate(path);
    await wait(150);
  }

  // Turkish dotted capital İ must match a typed lower-case i, on the home page and in the palette.
  await open('/index.html', 'tr');
  const homeMatches = await page.evaluate(async () => {
    const results = {};
    for (const query of ['iyileştirici', 'İKİLİ']) {
      const search = document.getElementById('hubSearch');
      search.value = query;
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 300));
      results[query] = [...document.querySelectorAll('.hub-card[data-cat]')]
        .filter((card) => card.style.display !== 'none')
        .map((card) => card.querySelector('.hub-card-title').textContent.trim());
    }
    return results;
  });
  assert(homeMatches['iyileştirici'].includes('SVG İyileştirici'), 'Turkish home search missed "SVG İyileştirici".');
  assert(homeMatches['İKİLİ'].includes('İkili Metin Dönüştürücü'), 'Turkish upper-case home search missed "İkili Metin Dönüştürücü".');

  // Every catalogue description has Turkish copy for the command palette.
  const untranslated = await page.evaluate(() => TOOLS_DATA
    .filter((tool) => window.ToolkitI18n.t(tool.desc) === tool.desc)
    .map((tool) => tool.slug));
  assert.deepEqual(untranslated, [], `Tool descriptions without Turkish copy: ${untranslated.join(', ')}`);
  const paletteMatches = await page.evaluate(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    const input = document.querySelector('.command-palette input');
    input.value = 'iyileştirici';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    return [...document.querySelectorAll('.command-palette [role="option"]')].map((option) => option.textContent);
  });
  assert(paletteMatches.some((text) => text.includes('SVG İyileştirici')), 'Turkish palette search missed "SVG İyileştirici".');

  // Tool pages leave the catalogue out until the finder opens, then list every tool.
  await open('/tools/hash.html');
  assert.equal(await page.evaluate(() => typeof TOOLS_DATA), 'undefined', 'Tool pages should not load the tool catalogue up front.');
  const lazyPalette = await page.evaluate(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    const input = document.querySelector('.command-palette input');
    for (let tries = 0; tries < 50 && !document.querySelector('.command-palette [role="option"]'); tries += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const recent = [...document.querySelectorAll('.command-palette [role="option"] strong')].map((name) => name.textContent);
    input.value = 'yaml';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      count: TOOLS_DATA.length,
      recent,
      subtitle: document.querySelector('.command-palette__header p').textContent,
      matches: [...document.querySelectorAll('.command-palette [role="option"] strong')].map((name) => name.textContent)
    };
  });
  assert.equal(lazyPalette.subtitle, `Search all ${lazyPalette.count} utilities`);
  assert.equal(lazyPalette.recent[0], 'Hash Generator', 'The current tool was not remembered as the most recent one.');
  assert(lazyPalette.matches.includes('YAML to JSON'), `Lazy palette search missed "YAML to JSON": ${lazyPalette.matches}`);
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));

  // Case-insensitive de-duplication folds İ and i together.
  await open('/tools/deduplicate-lines.html', 'tr');
  const deduplicated = await page.evaluate(() => {
    document.getElementById('dd-case-insensitive').checked = true;
    document.getElementById('dd-input').value = 'İstanbul\nistanbul\nISTANBUL\nApple\napple';
    document.getElementById('dd-dedup-btn').click();
    return document.getElementById('dd-output').value.split('\n');
  });
  assert.deepEqual(deduplicated, ['İstanbul', 'Apple']);

  // Markdown: tables, ordered lists and code/URL contents survive inline formatting, and stay inert.
  await open('/tools/markdown.html');
  const markdown = await page.evaluate(async () => {
    const editor = document.getElementById('mdInput');
    const render = async (value) => {
      editor.value = value;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 50));
      return document.getElementById('mdPreview');
    };
    const preview = await render([
      '| a | b |', '|---|---|', '| 1 | 2 |', '',
      '1. one', '2. two', '',
      '```py', 'my_var = 2 * 3 * 4', '- not a list', '```', '',
      'Use `snake_case_name`.', '',
      '[docs](https://example.com/my_page_name)', '',
      '[bad](javascript:window.__markdownXss=1) <img src=x onerror="window.__markdownXss=2">'
    ].join('\n'));
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      cells: preview.querySelectorAll('table td').length,
      ordered: preview.querySelectorAll('ol > li').length,
      fence: preview.querySelector('pre code')?.textContent,
      inline: preview.querySelector('p code')?.textContent,
      href: preview.querySelector('a')?.getAttribute('href'),
      hrefs: [...preview.querySelectorAll('a')].map((link) => link.getAttribute('href')),
      images: preview.querySelectorAll('img').length,
      xss: window.__markdownXss || 0
    };
  });
  assert.equal(markdown.cells, 2, 'A two-column Markdown table did not render.');
  assert.equal(markdown.ordered, 2, 'Numbered Markdown items were not wrapped in <ol>.');
  assert.equal(markdown.fence, 'my_var = 2 * 3 * 4\n- not a list', 'Fenced code was rewritten by inline rules.');
  assert.equal(markdown.inline, 'snake_case_name', 'Inline code was rewritten by inline rules.');
  assert.equal(markdown.href, 'https://example.com/my_page_name', 'A link URL with underscores was rewritten.');
  assert(!markdown.hrefs.some((href) => /^javascript:/i.test(href)), 'A javascript: link was rendered.');
  assert.equal(markdown.images, 0, 'Raw HTML in Markdown produced an element.');
  assert.equal(markdown.xss, 0, 'Markdown input executed script.');

  // Base64 image: Download becomes available only after a successful preview.
  await open('/tools/base64-to-image.html');
  const base64Image = await page.evaluate(async () => {
    const input = document.getElementById('b2iInput');
    const preview = document.getElementById('b2iPreviewBtn');
    const download = document.getElementById('b2iDownloadBtn');
    const settle = () => new Promise((resolve) => setTimeout(resolve, 300));
    input.value = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    preview.click();
    await settle();
    const afterValid = download.disabled;
    input.value = 'not-base64!!';
    preview.click();
    await settle();
    return { afterValid, afterInvalid: download.disabled, info: document.getElementById('b2iInfo').textContent };
  });
  assert.equal(base64Image.afterValid, false, 'Download stayed disabled after a valid preview.');
  assert.equal(base64Image.afterInvalid, true, 'Download stayed enabled after invalid input.');
  assert.equal(base64Image.info, '', 'Stale image details remained after invalid input.');

  // File checksum: the most recent selection wins even when an earlier, larger file finishes later.
  await open('/tools/file-checksum.html');
  const checksum = await page.evaluate(async () => {
    const input = document.getElementById('checksumFileInput');
    const choose = (file) => {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    choose(new File([new Uint8Array(96 * 1024 * 1024)], 'large.bin'));
    choose(new File(['abc'], 'small.txt', { type: 'text/plain' }));
    for (let attempt = 0; attempt < 300; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (document.getElementById('checksumResults').style.display === 'block') break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const result = document.getElementById('checksumResultInner');
    return { name: result.querySelector('p')?.textContent, hashes: [...result.querySelectorAll('code')].map((code) => code.textContent) };
  });
  assert.equal(checksum.name, 'small.txt', 'An older file overwrote the latest checksum result.');
  assert(checksum.hashes.includes('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'), 'The SHA-256 of "abc" was not shown.');

  // Image compressor: repeated runs keep only the current result's blob URL alive.
  await open('/tools/image-compressor.html');
  const liveUrls = await page.evaluate(async () => {
    const live = new Set();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const url = create(blob); live.add(url); return url; };
    URL.revokeObjectURL = (url) => { live.delete(url); revoke(url); };
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    canvas.getContext('2d').fillRect(0, 0, 64, 48);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'square.png', { type: 'image/png' }));
    const input = document.querySelector('#toolApp input[type="file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    for (let run = 0; run < 4; run += 1) {
      document.getElementById('imageCompressRun').click();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return live.size;
  });
  assert.equal(liveUrls, 1, `Image compressor kept ${liveUrls} blob URLs alive after four runs.`);

  // Text reverser: the status message names the mode in the interface language.
  await open('/tools/text-reverser.html', 'tr');
  const reverserToast = await page.evaluate(async () => {
    document.getElementById('tr-input').value = 'merhaba dünya';
    document.querySelector('input[name="tr-mode"][value="lines"]').checked = true;
    document.getElementById('tr-reverse-btn').click();
    await new Promise((resolve) => setTimeout(resolve, 150));
    return [...document.querySelectorAll('.toast-msg')].at(-1)?.textContent;
  });
  assert.equal(reverserToast, 'Metin satır satır ters çevrildi');

  // Copy buttons rendered without inline handlers still copy the row value.
  await open('/tools/bytes.html');
  const copied = await page.evaluate(async () => {
    let value = null;
    window.copyToClipboard = (text) => { value = text; };
    document.getElementById('bytesInput').value = '2048';
    document.getElementById('bytesInput').dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#bytesTable [data-copy-value]').click();
    return { value, inline: document.querySelectorAll('#bytesTable [onclick]').length };
  });
  assert.equal(copied.inline, 0, 'Bytes table still renders inline click handlers.');
  assert.equal(copied.value, '2048', 'A delegated Copy button did not copy its row value.');

  // Typing test: lenient Turkish forgives only diacritics, never case; skipped characters lower accuracy.
  async function typingRun(settings, transform) {
    // Write settings from another page: an open typing test saves its own settings once words load.
    await page.navigate('/index.html');
    await page.evaluate((settings) => {
      localStorage.setItem('toolkit-language', 'en');
      localStorage.setItem('toolkit-typing-test-settings', JSON.stringify({ categoryTouched: true, mode: 'zen', ...settings }));
    }, settings);
    await page.navigate('/tools/typing-test.html');
    return page.evaluate(async (transformSource) => {
      const transform = new Function('word', `return (${transformSource})(word);`);
      const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      for (let attempt = 0; attempt < 250 && document.getElementById('tt-start-selected').disabled; attempt += 1) await pause(20);
      document.getElementById('tt-start-selected').click();
      await pause(100);
      const input = document.getElementById('tt-input');
      const words = [];
      for (let index = 0; index < 3; index += 1) {
        const active = document.querySelector('.tt-word--active');
        const word = [...active.querySelectorAll('.tt-char:not(.tt-char--reserved):not(.tt-char--extra)')].map((node) => node.textContent).join('');
        words.push(word);
        input.value = transform(word) + ' ';
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        // Read the next word only after the stream has moved on.
        for (let attempt = 0; attempt < 100 && document.querySelector('.tt-word--active') === active; attempt += 1) await pause(10);
      }
      await pause(320);
      document.getElementById('tt-end-zen').click();
      return {
        accuracy: document.getElementById('tt-result-accuracy').textContent,
        incorrect: document.getElementById('tt-incorrect').textContent,
        missed: document.getElementById('tt-missed').textContent,
        words
      };
    }, transform.toString());
  }
  const swapCase = (word) => (word[0] === word[0].toLocaleUpperCase('tr') ? word[0].toLocaleLowerCase('tr') : word[0].toLocaleUpperCase('tr')) + word.slice(1);
  const lenientCase = await typingRun({ contentLanguage: 'tr', categoryId: 'cities', strict: false }, swapCase);
  assert.equal(lenientCase.incorrect, '3', `Lenient Turkish mode must count one case mistake per word: ${JSON.stringify(lenientCase)}`);
  const plainLetters = (word) => word.replace(/[çğıöşüÇĞİÖŞÜ]/g, (character) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' })[character]);
  async function turkishLettersRun(strict) {
    let result;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      result = await typingRun({ contentLanguage: 'tr', categoryId: 'districts', strict }, plainLetters);
      if (result.words.some((word) => /[çğıöşüÇĞİÖŞÜ]/.test(word))) break;
    }
    return result;
  }
  const lenientPlain = await turkishLettersRun(false);
  assert(lenientPlain.words.some((word) => /[çğıöşüÇĞİÖŞÜ]/.test(word)), `No Turkish letters to test: ${lenientPlain.words}`);
  assert.equal(lenientPlain.accuracy, '100.0%', `Lenient Turkish mode rejected an unaccented letter: ${JSON.stringify(lenientPlain)}`);
  const strictPlain = await turkishLettersRun(true);
  assert.notEqual(strictPlain.accuracy, '100.0%', `Strict Turkish mode accepted an unaccented letter: ${JSON.stringify(strictPlain)}`);
  const skipped = await typingRun({ contentLanguage: 'en', categoryId: 'common-1000', strict: true }, (word) => word.slice(0, 1));
  assert.notEqual(skipped.missed, '0', 'Skipped characters were not counted.');
  assert.equal(skipped.incorrect, '0', `Skipped-character run typed a wrong letter: ${JSON.stringify(skipped)}`);
  assert.notEqual(skipped.accuracy, '100.0%', `Skipping most of each word kept 100% accuracy: ${JSON.stringify(skipped)}`);

  const errors = page.errors();
  assert.deepEqual(errors, [], `Browser errors: ${JSON.stringify(errors).slice(0, 500)}`);
});

console.log('Audit regressions passed: Turkish search and folding, palette copy, Markdown, Base64 image, checksum ordering, blob cleanup, reverser copy, delegated copy buttons, and typing case/skip accuracy.');
