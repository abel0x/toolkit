#!/usr/bin/env node
/* Real-browser typing, i18n and conversion regression coverage. */
import assert from 'node:assert/strict';
import { withFirefox } from './browser-session.mjs';

await withFirefox(async (page) => {
  await page.viewport(1280, 900);
  await page.navigate('/tools/typing-test.html');
  async function configure(settings, records = {}) {
    await page.evaluate(({ settings, records }) => {
      localStorage.setItem('toolkit-language', 'en');
      localStorage.setItem('toolkit-typing-test-settings', JSON.stringify({ contentLanguage: 'en', categoryId: 'common-200', categoryTouched: true, mode: 'zen', ...settings }));
      localStorage.setItem('toolkit-typing-test-records', JSON.stringify(records));
    }, { settings, records });
    await page.navigate('/tools/typing-test.html');
    await page.evaluate(async () => {
      for (let attempt = 0; attempt < 200 && document.getElementById('tt-prepare').disabled; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 20));
      if (document.getElementById('tt-prepare').disabled) throw new Error('Typing test did not become ready.');
      // This explicit content choice must keep the stream independent of UI language.
      const language = document.getElementById('tt-language');
      language.dispatchEvent(new Event('change', { bubbles: true }));
      for (let attempt = 0; attempt < 200 && document.getElementById('tt-start-selected').disabled; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  async function start() {
    await page.evaluate(() => document.getElementById('tt-start-selected').click());
  }
  async function type(value, inputType = 'insertText') {
    await page.evaluate(({ value, inputType }) => {
      const input = document.getElementById('tt-input');
      input.value = value;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType }));
    }, { value, inputType });
  }
  async function firstWord() {
    return page.evaluate(() => [...document.querySelectorAll('.tt-word--active > .tt-char:not(.tt-char--reserved):not(.tt-char--extra)')].map((node) => node.textContent).join(''));
  }
  async function finish() {
    return page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 320));
      document.getElementById('tt-end-zen').click();
      const text = (id) => document.getElementById(id).textContent;
      const canvas = document.getElementById('tt-chart');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return {
        visible: !document.getElementById('tt-results').hidden,
        accuracy: text('tt-result-accuracy'), incorrect: text('tt-incorrect'), extra: text('tt-extra'), correct: text('tt-correct'),
        errors: text('tt-error-list'), best: text('tt-best'), chartPainted: pixels.some((value, index) => index % 4 === 3 && value > 0),
        repeatHidden: document.getElementById('tt-repeat-errors').hidden
      };
    });
  }

  for (let repetition = 0; repetition < 3; repetition += 1) {
    await configure({});
    await start();
    const word = await firstWord();
    await type(word);
    await type('!' + word.slice(1), 'insertReplacementText');
    const replacement = await finish();
    assert.equal(replacement.incorrect, '1', 'A same-length replacement must enter the ledger.');
    assert.notEqual(replacement.accuracy, '100.0%');
    assert(replacement.chartPainted, 'The visible results chart must contain pixels.');
    assert(replacement.errors.includes('!' + word.slice(1)), 'An unfinished incorrect word must appear in review.');
    assert.equal(replacement.repeatHidden, false);
    const translated = await page.evaluate(() => {
      const before = document.getElementById('tt-stream').textContent;
      ToolkitI18n.setLanguage('tr');
      return { before, after: document.getElementById('tt-stream').textContent, accuracy: document.getElementById('tt-result-accuracy').textContent };
    });
    assert.equal(translated.before, translated.after, 'UI translation must not touch practice content.');
    assert(translated.accuracy.includes(','), 'Result numbers must be formatted again on language change.');
    await page.evaluate(async () => {
      document.getElementById('tt-repeat-errors').click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    assert.equal(await page.evaluate(() => document.querySelectorAll('.tt-word').length), 1,
      'Repeating one error must not pad the drill with duplicate words.');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('toolkit-typing-test-settings')).wordCount), 10,
      'A short error drill must not save a non-selectable word count.');

    await configure({ stopError: true });
    await start();
    await type('!');
    assert.equal(await page.evaluate(() => document.getElementById('tt-test').dataset.status), 'running', 'A rejected first attempt still starts time.');
    assert.equal(await page.evaluate(() => document.getElementById('tt-input').value), '');
    const stopped = await finish();
    assert.equal(stopped.incorrect, '1');
    assert.equal(stopped.repeatHidden, false, 'A rejected unfinished attempt must remain reviewable.');

    await configure({});
    await start();
    const extraWord = await firstWord();
    await type(extraWord + 'z');
    assert.equal(await page.evaluate(() => document.querySelector('.tt-char--extra').dataset.character), 'z');
    assert(await page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const extra = document.querySelector('.tt-char--extra').getBoundingClientRect();
      const caret = document.getElementById('tt-caret').getBoundingClientRect();
      return Math.abs(caret.left - (extra.right - 1)) < 2;
    }), 'The caret must follow extra typed glyphs, not stay at the expected word ending.');
    await type(extraWord, 'deleteContentBackward');
    assert(await page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const characters = document.querySelectorAll('.tt-word--active > .tt-char:not(.tt-char--reserved)');
      const last = characters[characters.length - 1].getBoundingClientRect();
      const caret = document.getElementById('tt-caret').getBoundingClientRect();
      return Math.abs(caret.left - (last.right - 1)) < 2;
    }), 'Deleting an extra glyph must return the caret to the expected word ending.');
    assert.equal((await finish()).extra, '1');

    await configure({}, { 'en/common-200/zen/short': { netWpm: 90000, accuracy: 100 } });
    await start();
    await type((await firstWord()).slice(0, 1));
    assert((await finish()).best.includes('90,000'), 'A lower session score must not hide a stored best.');

    await configure({ contentLanguage: 'tr', categoryId: 'cities', capitalisation: true });
    await start();
    await page.evaluate(() => {
      const input = document.getElementById('tt-input');
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      input.value = 'I\u0307';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    });
    assert.equal(await page.evaluate(() => document.getElementById('tt-test').dataset.status), 'ready', 'Composition must not count before it ends.');
    await page.evaluate(() => {
      const input = document.getElementById('tt-input');
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
      input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: false }));
    });
    const composed = await finish();
    assert.equal(Number(composed.correct) + Number(composed.incorrect), 1, 'Composition must be normalised and counted once.');

    await configure({ practice: 'custom' });
    assert.equal(await page.evaluate(() => document.getElementById('tt-prepare').disabled), false, 'Reloading empty custom practice must not block quick start.');
    assert.equal(await page.evaluate(() => document.getElementById('tt-customize').hidden), false);
    await page.evaluate(() => document.getElementById('tt-prepare').click());
    assert.equal(await page.evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return document.getElementById('tt-test').hidden;
    }), false);

    await configure({ categoryId: 'idioms', mode: 'words', wordCount: 100 });
    const phrases = await page.evaluate(async () => {
      const pool = (await (await fetch('../words/en/idioms.json')).json()).words.map((value) => value.toLocaleLowerCase('en').split(' '));
      const words = [...document.querySelectorAll('.tt-word')].map((word) => [...word.querySelectorAll('.tt-char:not(.tt-char--reserved)')].map((char) => char.textContent).join(''));
      const reachable = new Set([0]);
      for (let index = 0; index < words.length; index += 1) if (reachable.has(index)) {
        for (const phrase of pool) if (phrase.every((part, offset) => words[index + offset] === part)) reachable.add(index + phrase.length);
      }
      return { words: words.length, complete: reachable.has(words.length) };
    });
    assert(phrases.words >= 100 && phrases.complete, 'Idiom entries must stay ordered and complete.');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('toolkit-typing-test-settings')).wordCount), 100,
      'Completing an idiom must not overwrite the selected word-count preference.');

    await page.viewport(360, 780);
    await start();
    assert(await page.evaluate(() => {
      const stream = document.getElementById('tt-stream-shell');
      const line = parseFloat(getComputedStyle(document.getElementById('tt-stream')).lineHeight);
      const style = getComputedStyle(stream);
      const contentHeight = stream.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      return document.documentElement.scrollWidth <= 360 && contentHeight <= line * 3 + 2;
    }), 'The mobile stream must fit three lines without page overflow.');
    await page.viewport(1280, 900);

    await configure({ practice: 'custom', mode: 'words', wordCount: 100 });
    await page.evaluate(async () => {
      const custom = document.getElementById('tt-custom-text');
      custom.value = 'alpha beta gamma';
      custom.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    await start();
    const customWords = await page.evaluate(() => [...document.querySelectorAll('.tt-word')].map((word) => word.textContent));
    assert.equal(customWords.length, 3);
    await type(customWords[0] + ' ');
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 320)));
    for (const word of customWords.slice(1)) await type(word + ' ');
    assert.equal(await page.evaluate(() => document.getElementById('tt-results').hidden), false,
      'A custom word test must finish at its actual sequence length.');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('toolkit-typing-test-settings')).wordCount), 100,
      'Custom text length must not replace the selected word-count preference.');
    await page.navigate('/tools/typing-test.html');
    assert.equal(await page.evaluate(() => document.querySelector('[data-words="100"]').getAttribute('aria-checked')), 'true',
      'Reloading must retain the chosen word-count control.');

    await page.navigate('/tools/sitemap-generator.html');
    const xml = await page.evaluate(async () => {
      ToolkitI18n.setLanguage('tr');
      await new Promise((resolve) => setTimeout(resolve, 30));
      document.getElementById('sitemapUrls').value = 'https://example.com/';
      document.getElementById('sitemapRun').click();
      return document.getElementById('sitemapOutput').value;
    });
    assert(xml.includes('<changefreq>weekly</changefreq>'), 'Translated option labels must not change XML enum values.');
  }
  await configure({ mode: 'words', wordCount: 10 });
  const catalogue = await page.evaluate(async () => {
    const manifest = await (await fetch('../words/manifest.json')).json();
    const waitReady = async () => {
      for (let attempt = 0; attempt < 200; attempt += 1) {
        if (!document.getElementById('tt-start-selected').disabled) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error('Category did not load.');
    };
    let checked = 0;
    for (const language of manifest.languages) {
      const select = document.getElementById('tt-language');
      select.value = language.code;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await waitReady();
      for (const category of language.categories) {
        document.querySelector('[data-category="' + category.id + '"]').click();
        await waitReady();
        const payload = await (await fetch('../words/' + category.file)).json();
        const expected = new Set((payload.words || payload.quotes.map((quote) => quote.text)).flatMap((word) => word.toLocaleLowerCase(language.code).split(' ')));
        const words = [...document.querySelectorAll('.tt-word')].map((word) => word.textContent);
        if (!words.length || words.some((word) => !expected.has(word))) throw new Error('Wrong content: ' + category.file);
        checked += 1;
      }
    }
    return checked;
  });
  assert.equal(catalogue, 20, 'Every published category must load real data.');

  await configure({});
  await start();
  const hotPath = await page.evaluate(async () => {
    let insertions = 0;
    const observer = new MutationObserver((records) => { insertions += records.length; });
    observer.observe(document.getElementById('tt-stream'), { childList: true, subtree: true });
    const input = document.getElementById('tt-input');
    const word = document.querySelector('.tt-word--active').textContent;
    for (const character of Array.from(word)) {
      input.value += character;
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
    input.value += 'z';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    observer.disconnect();
    return insertions;
  });
  assert.equal(hotPath, 0, 'Keystrokes must not create or replace any word-stream nodes.');

  if (process.env.TYPING_TIMING === '1') {
    for (let repetition = 0; repetition < 3; repetition += 1) {
      await configure({ mode: 'time', duration: 60 });
      await start();
      // This is wall-clock input, not a mocked clock or access to private state.
      const result = await page.evaluate(async () => {
        const input = document.getElementById('tt-input');
        let typed = 0;
        const started = performance.now();
        while (document.getElementById('tt-results').hidden && performance.now() - started < 63000) {
          const word = document.querySelector('.tt-word--active').textContent;
          const characters = Array.from(word);
          const index = Array.from(input.value).length;
          input.value += characters[index] || ' ';
          input.dispatchEvent(new InputEvent('input', { bubbles: true }));
          typed += 1;
          await new Promise((resolve) => setTimeout(resolve, Math.max(0, started + typed * 200 - performance.now())));
        }
        return { finished: !document.getElementById('tt-results').hidden, wpm: Number(document.getElementById('tt-result-net').textContent), accuracy: document.getElementById('tt-result-accuracy').textContent };
      });
      assert(result.finished && result.wpm >= 58 && result.wpm <= 62 && result.accuracy === '100.0%', JSON.stringify(result));
      console.log('60-second steady-rate run ' + (repetition + 1) + ': ' + result.wpm + ' WPM, ' + result.accuracy);
    }
  }
  assert.deepEqual(page.errors(), [], 'Regression flows must not log browser errors.');
  console.log('Typing regressions passed in ' + (process.env.CHROMIUM_BINARY ? 'Chromium' : 'Firefox') + ': three repetitions of edge cases, all 20 categories and zero word-stream child mutations per keystroke.');
});
