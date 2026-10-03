/* Typing Speed Test — local, bilingual typing practice. */

(function initTypingTest() {
  'use strict';

  const root = document.getElementById('typing-test');
  if (!root) return;

  const MODES = ['time', 'words', 'quote', 'zen'];
  const PRACTICES = ['standard', 'weak-keys', 'turkish-q', 'turkish-f', 'daily', 'custom', 'code', 'repeat-errors'];
  const DURATIONS = [15, 30, 60, 120];
  const WORD_COUNTS = [10, 25, 50, 100];
  const SETTINGS_KEY = 'toolkit-typing-test-settings';
  const RECORDS_KEY = 'toolkit-typing-test-records';
  const MAX_EXTRA_CHARACTERS = 10;
  const INITIAL_STREAM_WORDS = 36;
  const REFILL_THRESHOLD = 14;
  const REFILL_WORDS = 28;
  const GROUPS = ['Core', 'Places', 'Professional', 'Technical'];
  const TURKISH_FOLD = new Map([
    ['ç', 'c'], ['ğ', 'g'], ['ı', 'i'], ['ö', 'o'], ['ş', 's'], ['ü', 'u']
  ]);
  const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
  const FALLBACK_POOLS = Object.freeze({
    en: 'the of and to in is you that it for on with this have from word but not what all were we when your can said there use each which she do how their if will up other about out many then them these so some her would make like him into time has look two more write go see number no way could people my than first water been call who oil its now find long down day did get come made may part'.split(' '),
    tr: 'bir ve bu için ile de da o ben sen biz siz onlar ne mi ama gibi çok daha en her sonra önce kadar olarak olan değil ise veya hem çünkü ancak şimdi bugün yarın dün zaman gün gece sabah akşam yıl ay hafta saat dakika insan çocuk kadın erkek arkadaş aile ev okul iş yol şehir ülke dünya hayat su hava toprak deniz gökyüzü güneş ışık ses söz kitap sayfa kalem masa kapı pencere el göz baş yüz kalp akıl düşünce bilgi soru cevap örnek durum şey yer taraf sıra ad dil metin kelime cümle harf sayı renk büyük küçük yeni eski iyi kötü doğru yanlış'.split(' ')
  });
  const TURKISH_LESSONS = Object.freeze({
    'turkish-q': 'şişe şehir ışık çiçek öğün düğün küçük büyük güzel göğüs ölçü sözcük özgür düşünce çalışma öğretmen öğrenci çözüm güçlü işaret çizgi yüzük gölgelik'.split(' '),
    'turkish-f': 'fırın fıstık görüntü dürüm harf öfke şifre çığlık uzaklık türkçe üretim örnek görev düzen fikir ölçüm güvenlik yüzey çizim'.split(' ')
  });
  const CODE_SNIPPETS = Object.freeze([
    'const total = items.filter(Boolean).length;',
    'function format(value) { return value.trim(); }',
    'if (response.ok) { return response.json(); }',
    'const userId = query.get("user_id") ?? "guest";',
    'for (const item of list) { console.log(item); }',
    'await navigator.clipboard.writeText(result);'
  ]);

  const elements = {
    config: document.getElementById('tt-config'),
    language: document.getElementById('tt-language'),
    practiceOptions: document.getElementById('tt-practice-options'),
    practiceHelp: document.getElementById('tt-practice-help'),
    customTextWrap: document.getElementById('tt-custom-text-wrap'),
    customText: document.getElementById('tt-custom-text'),
    categories: document.getElementById('tt-categories'),
    categoryPrev: document.getElementById('tt-category-prev'),
    categoryNext: document.getElementById('tt-category-next'),
    status: document.getElementById('tt-status'),
    dataNotice: document.getElementById('tt-data-notice'),
    fileNotice: document.getElementById('tt-file-notice'),
    prepare: document.getElementById('tt-prepare'),
    customize: document.getElementById('tt-customize'),
    customizeToggle: document.getElementById('tt-customize-toggle'),
    startSelected: document.getElementById('tt-start-selected'),
    clearRecordsConfig: document.getElementById('tt-clear-records-config'),
    strictWrap: document.getElementById('tt-strict-wrap'),
    punctuation: document.getElementById('tt-punctuation'),
    numbers: document.getElementById('tt-numbers'),
    capitalisation: document.getElementById('tt-capitalisation'),
    strict: document.getElementById('tt-strict'),
    stopError: document.getElementById('tt-stop-error'),
    blind: document.getElementById('tt-blind'),
    goalEnabled: document.getElementById('tt-goal-enabled'),
    goalToggle: document.getElementById('tt-goal-toggle'),
    goalOptions: document.getElementById('tt-goal-options'),
    goalWpm: document.getElementById('tt-goal-wpm'),
    goalAccuracy: document.getElementById('tt-goal-accuracy'),
    test: document.getElementById('tt-test'),
    stream: document.getElementById('tt-stream'),
    streamShell: document.getElementById('tt-stream-shell'),
    input: document.getElementById('tt-input'),
    caret: document.getElementById('tt-caret'),
    quoteAttribution: document.getElementById('tt-quote-attribution'),
    timer: document.getElementById('tt-timer'),
    progressLabel: document.getElementById('tt-progress-label'),
    liveWpm: document.getElementById('tt-live-wpm'),
    liveCpm: document.getElementById('tt-live-cpm'),
    liveAccuracy: document.getElementById('tt-live-accuracy'),
    endZen: document.getElementById('tt-end-zen'),
    results: document.getElementById('tt-results'),
    resultsHeading: document.getElementById('tt-results-heading'),
    summary: document.getElementById('tt-summary'),
    descriptor: document.getElementById('tt-descriptor'),
    resultQuoteAttribution: document.getElementById('tt-result-quote-attribution'),
    best: document.getElementById('tt-best'),
    goalResult: document.getElementById('tt-goal-result'),
    resultNet: document.getElementById('tt-result-net'),
    resultRaw: document.getElementById('tt-result-raw'),
    resultCpm: document.getElementById('tt-result-cpm'),
    resultAccuracy: document.getElementById('tt-result-accuracy'),
    resultConsistency: document.getElementById('tt-result-consistency'),
    resultElapsed: document.getElementById('tt-result-elapsed'),
    correct: document.getElementById('tt-correct'),
    incorrect: document.getElementById('tt-incorrect'),
    extra: document.getElementById('tt-extra'),
    missed: document.getElementById('tt-missed'),
    chart: document.getElementById('tt-chart'),
    samplesBody: document.querySelector('#tt-samples-table tbody'),
    keyboard: document.getElementById('tt-keyboard'),
    errorList: document.getElementById('tt-error-list'),
    remember: document.getElementById('tt-remember'),
    clearRecords: document.getElementById('tt-clear-records'),
    restart: document.getElementById('tt-restart'),
    restartRunning: document.getElementById('tt-restart-running'),
    weakKeys: document.getElementById('tt-weak-keys'),
    repeatErrors: document.getElementById('tt-repeat-errors'),
    newTest: document.getElementById('tt-new'),
    copy: document.getElementById('tt-copy')
  };

  const settings = readSettings();
  const state = {
    phase: 'idle',
    manifest: null,
    listCache: new Map(),
    shuffleBags: new Map(),
    deckLastValues: new Map(),
    requestToken: 0,
    contentLanguageTouched: false,
    contentLanguage: ['en', 'tr'].includes(settings.contentLanguage) ? settings.contentLanguage : uiLanguage(),
    practice: PRACTICES.includes(settings.practice) && !['weak-keys', 'repeat-errors'].includes(settings.practice)
      ? settings.practice
      : 'standard',
    categoryId: location.hash.slice(1) || (settings.categoryTouched && settings.categoryId ? settings.categoryId : 'common-1000'),
    categoryTouched: Boolean(settings.categoryTouched),
    mode: MODES.includes(settings.mode) ? settings.mode : 'time',
    duration: DURATIONS.includes(settings.duration) ? settings.duration : 60,
    wordCount: WORD_COUNTS.includes(settings.wordCount) ? settings.wordCount : 10,
    quoteLength: ['short', 'medium', 'long'].includes(settings.quoteLength) ? settings.quoteLength : 'short',
    goal: {
      enabled: Boolean(settings.goalEnabled),
      wpm: Number.isFinite(settings.goalWpm) ? Math.max(1, Math.min(500, settings.goalWpm)) : 40,
      accuracy: Number.isFinite(settings.goalAccuracy) ? Math.max(1, Math.min(100, settings.goalAccuracy)) : 95
    },
    modifiers: {
      punctuation: Boolean(settings.punctuation),
      numbers: Boolean(settings.numbers),
      capitalisation: Boolean(settings.capitalisation),
      strict: settings.strict !== false,
      stopError: Boolean(settings.stopError),
      blind: Boolean(settings.blind)
    },
    sequence: [],
    wordNodes: [],
    payload: null,
    wordIndex: 0,
    activeWordIndex: 0,
    renderedCount: 0,
    streamOffset: 0,
    streamLineHeight: 0,
    typed: '',
    previousInput: [],
    beforeInput: null,
    ledger: [],
    wordRecords: new Map(),
    errorKeyCounts: new Map(),
    repeatPool: [],
    practiceOffset: 0,
    missed: 0,
    startedAt: 0,
    endedAt: 0,
    rafId: 0,
    caretRaf: 0,
    refillRaf: 0,
    lastSampleSecond: 0,
    lastLiveAt: 0,
    samples: [],
    isComposing: false,
    invalid: false,
    sessionRecords: new Map(),
    storedRecords: readRecords(),
    selectedQuote: null
  };

  function t(key, values) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key, values) : key;
  }

  function uiLanguage() {
    return window.ToolkitI18n ? window.ToolkitI18n.getLanguage() : 'en';
  }

  function graphemes(value) {
    const normalised = String(value || '').normalize('NFC');
    return segmenter
      ? Array.from(segmenter.segment(normalised), (entry) => entry.segment)
      : Array.from(normalised);
  }

  function localeLower(value, language) {
    return String(value || '').normalize('NFC').toLocaleLowerCase(language);
  }

  function localeUpper(value, language) {
    return String(value || '').normalize('NFC').toLocaleUpperCase(language);
  }

  function charactersMatch(expected, actual) {
    if (state.contentLanguage !== 'tr' || state.modifiers.strict) return expected === actual;
    const fold = (value) => TURKISH_FOLD.get(localeLower(value, 'tr')) || localeLower(value, 'tr');
    return fold(expected) === fold(actual);
  }

  function safeRandom(max) {
    return typeof window.secureRandInt === 'function'
      ? window.secureRandInt(max)
      : Math.floor(Math.random() * max);
  }

  function formatNumber(value, decimals) {
    return new Intl.NumberFormat(uiLanguage(), {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals
    }).format(value);
  }

  function formatElapsed(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  function renderMetadata() {
    const name = t('Typing Speed Test');
    const description = t('Measure typing speed and accuracy in English or Turkish with themed word lists.');
    const title = `${name} — Toolkit`;
    const setContent = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) element.setAttribute('content', value);
    };
    setContent('meta[name="description"]', description);
    setContent('meta[property="og:title"]', title);
    setContent('meta[property="og:description"]', description);
    setContent('meta[name="twitter:title"]', title);
    setContent('meta[name="twitter:description"]', description);
  }

  function readSettings() {
    try {
      const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        mode: state.mode,
        practice: state.practice === 'repeat-errors' ? 'standard' : state.practice,
        duration: state.duration,
        wordCount: state.wordCount,
        quoteLength: state.quoteLength,
        contentLanguage: state.contentLanguage,
        categoryId: state.categoryId,
        categoryTouched: state.categoryTouched,
        punctuation: state.modifiers.punctuation,
        numbers: state.modifiers.numbers,
        capitalisation: state.modifiers.capitalisation,
        strict: state.modifiers.strict,
        stopError: state.modifiers.stopError,
        blind: state.modifiers.blind,
        goalEnabled: state.goal.enabled,
        goalWpm: state.goal.wpm,
        goalAccuracy: state.goal.accuracy,
        rememberRecords: Boolean(settings.rememberRecords)
      }));
    } catch {}
  }

  function readRecords() {
    try {
      const value = JSON.parse(localStorage.getItem(RECORDS_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function saveRecords() {
    try {
      localStorage.setItem(RECORDS_KEY, JSON.stringify(state.storedRecords));
    } catch {}
  }

  function hasStoredRecords() {
    return Object.keys(state.storedRecords).length > 0;
  }

  function syncStoredRecordControls() {
    const hidden = !hasStoredRecords();
    elements.clearRecords.hidden = hidden;
    elements.clearRecordsConfig.hidden = hidden;
  }

  function manifestLanguage(language) {
    return state.manifest && state.manifest.languages.find((entry) => entry.code === language);
  }

  function categoryFor(language, id) {
    const entry = manifestLanguage(language);
    return entry && entry.categories.find((category) => category.id === id);
  }

  function fallbackManifest() {
    return {
      schemaVersion: 1,
      languages: ['en', 'tr'].map((code) => ({
        code,
        nativeName: code === 'tr' ? 'Türkçe' : 'English',
        englishName: code === 'tr' ? 'Turkish' : 'English',
        direction: 'ltr',
        categories: [{
          id: 'fallback',
          file: '',
          label: 'Fallback practice list',
          group: 'Core',
          type: 'words',
          count: FALLBACK_POOLS[code].length,
          order: 10
        }]
      }))
    };
  }

  async function loadManifest() {
    if (location.protocol === 'file:') {
      state.manifest = fallbackManifest();
      state.categoryId = 'common-200';
      elements.fileNotice.hidden = false;
      setStatus('Local files cannot load every word list. A fallback list is ready.', 'error');
      return;
    }
    try {
      const response = await fetch(new URL('../words/manifest.json', document.baseURI), { cache: 'default' });
      if (!response.ok) throw new Error('manifest unavailable');
      state.manifest = await response.json();
    } catch {
      state.manifest = fallbackManifest();
      state.categoryId = 'common-200';
      setStatus('Word lists could not be loaded. A small offline fallback is ready.', 'error');
    }
  }

  async function loadList(language, id, token) {
    const cacheKey = `${language}/${id}`;
    if (state.listCache.has(cacheKey)) return state.listCache.get(cacheKey);
    const category = categoryFor(language, id);
    if (!category || !category.file || location.protocol === 'file:') {
      const payload = { type: 'words', words: FALLBACK_POOLS[language] || FALLBACK_POOLS.en };
      state.listCache.set(cacheKey, payload);
      return payload;
    }
    const response = await fetch(new URL(`../words/${category.file}`, document.baseURI), { cache: 'default' });
    if (!response.ok) throw new Error(`Word list unavailable: ${cacheKey}`);
    const payload = await response.json();
    if (token !== state.requestToken) return null;
    state.listCache.set(cacheKey, payload);
    return payload;
  }

  function setStatus(message, values, type) {
    const interpolation = values && typeof values === 'object' ? values : undefined;
    elements.status.textContent = t(message, interpolation);
    elements.status.dataset.type = typeof values === 'string' ? values : type || 'info';
  }

  function practiceHelpKey() {
    const keys = {
      standard: 'Use the selected word list and test mode.',
      'weak-keys': 'Build a shuffled drill from keys missed during this session.',
      'turkish-q': 'Practise Turkish diacritics in a shuffled Q keyboard lesson.',
      'turkish-f': 'Practise Turkish diacritics in a shuffled F keyboard lesson.',
      daily: 'A fixed 30-second challenge for this day and word list. It uses every entry once before repeating.',
      custom: 'Your text is shuffled in this tab and is never saved.',
      code: 'Practise punctuation, symbols, and common code patterns in shuffled snippets.',
      'repeat-errors': 'Repeat the words missed in your most recent run in a shuffled order.'
    };
    return keys[state.practice] || keys.standard;
  }

  function isTurkishLesson() {
    return state.practice === 'turkish-q' || state.practice === 'turkish-f';
  }

  function applyPractice(practice) {
    const requested = PRACTICES.includes(practice) ? practice : 'standard';
    if (requested === 'weak-keys' && !state.errorKeyCounts.size) {
      setStatus('Complete a test with mistakes to unlock the weak-key drill.', 'error');
      return;
    }
    if (requested === 'repeat-errors' && !state.repeatPool.length) {
      setStatus('No errors are available to repeat.', 'error');
      return;
    }
    state.practice = requested;
    if (isTurkishLesson()) {
      state.contentLanguage = 'tr';
      state.contentLanguageTouched = true;
      if (!categoryFor('tr', state.categoryId)) state.categoryId = 'common-1000';
      state.mode = 'words';
      state.wordCount = 25;
    }
    if (state.practice === 'daily') {
      state.mode = 'time';
      state.duration = 30;
      state.modifiers.punctuation = false;
      state.modifiers.numbers = false;
      state.modifiers.capitalisation = false;
    }
    if (state.practice === 'weak-keys' || state.practice === 'code') {
      state.mode = 'words';
      state.wordCount = 25;
    }
    syncControls();
    renderCategories();
    prepareTest();
  }

  function updateGoalFromControls() {
    state.goal.enabled = elements.goalEnabled.checked;
    state.goal.wpm = Math.max(1, Math.min(500, Number(elements.goalWpm.value) || 40));
    state.goal.accuracy = Math.max(1, Math.min(100, Number(elements.goalAccuracy.value) || 95));
    syncControls();
    saveSettings();
  }

  function syncControls() {
    // Discard an old persisted Turkish lesson if the content language changed elsewhere.
    if (state.contentLanguage !== 'tr' && isTurkishLesson()) state.practice = 'standard';
    elements.language.value = state.contentLanguage;
    elements.practiceOptions.querySelectorAll('.tt-practice-btn').forEach((button) => {
      const practice = button.dataset.practice;
      const selected = practice === state.practice;
      const lessonUnavailable = (practice === 'turkish-q' || practice === 'turkish-f')
        && state.contentLanguage !== 'tr';
      const unavailable = (practice === 'weak-keys' && !state.errorKeyCounts.size)
        || (practice === 'repeat-errors' && !state.repeatPool.length)
        || lessonUnavailable;
      button.hidden = lessonUnavailable;
      button.disabled = unavailable;
      if (practice === 'weak-keys' && unavailable) {
        button.title = t('Complete a test with mistakes to unlock the weak-key drill.');
      } else if (practice === 'repeat-errors' && unavailable) {
        button.title = t('No errors are available to repeat.');
      } else {
        button.removeAttribute('title');
      }
      button.classList.toggle('tt-practice-btn--selected', selected);
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    elements.practiceHelp.textContent = t(practiceHelpKey());
    elements.customTextWrap.hidden = state.practice !== 'custom';
    document.querySelectorAll('.tt-mode-btn').forEach((button) => {
      const selected = button.dataset.mode === state.mode;
      button.classList.toggle('tt-mode-btn--selected', selected);
      button.setAttribute('aria-checked', String(selected));
    });
    document.querySelectorAll('[data-mode-options]').forEach((group) => {
      group.hidden = group.dataset.modeOptions !== state.mode;
    });
    document.querySelectorAll('[data-duration]').forEach((button) => {
      const selected = Number(button.dataset.duration) === state.duration;
      button.classList.toggle('tt-option-btn--selected', selected);
      button.setAttribute('aria-checked', String(selected));
    });
    document.querySelectorAll('[data-words]').forEach((button) => {
      const selected = Number(button.dataset.words) === state.wordCount;
      button.classList.toggle('tt-option-btn--selected', selected);
      button.setAttribute('aria-checked', String(selected));
    });
    document.querySelectorAll('[data-quote-length]').forEach((button) => {
      const selected = button.dataset.quoteLength === state.quoteLength;
      button.classList.toggle('tt-option-btn--selected', selected);
      button.setAttribute('aria-checked', String(selected));
    });
    elements.punctuation.checked = state.modifiers.punctuation;
    elements.numbers.checked = state.modifiers.numbers;
    elements.capitalisation.checked = state.modifiers.capitalisation;
    elements.strict.checked = state.modifiers.strict;
    elements.stopError.checked = state.modifiers.stopError;
    elements.blind.checked = state.modifiers.blind;
    [elements.punctuation, elements.numbers, elements.capitalisation, elements.strict, elements.stopError, elements.blind].forEach((control) => {
      control.closest('.checkbox-card')?.classList.toggle('tt-checkbox-card--selected', control.checked);
    });
    elements.strictWrap.hidden = state.contentLanguage !== 'tr';
    elements.goalEnabled.checked = state.goal.enabled;
    elements.goalWpm.value = String(state.goal.wpm);
    elements.goalAccuracy.value = String(state.goal.accuracy);
    elements.goalToggle.classList.toggle('tt-goal-toggle--selected', state.goal.enabled);
    elements.goalOptions.hidden = !state.goal.enabled;
    const daily = state.practice === 'daily';
    document.querySelectorAll('.tt-mode-btn').forEach((button) => { button.disabled = daily; });
    document.querySelectorAll('[data-duration]').forEach((button) => { button.disabled = daily && Number(button.dataset.duration) !== 30; });
    elements.remember.checked = Boolean(settings.rememberRecords);
    syncStoredRecordControls();
  }

  function setStartButtonsDisabled(disabled) {
    elements.prepare.disabled = disabled;
    elements.startSelected.disabled = disabled;
  }

  function setCustomizationVisible(visible) {
    elements.customize.hidden = !visible;
    elements.customizeToggle.setAttribute('aria-expanded', String(visible));
    elements.customizeToggle.textContent = t(visible ? 'Hide customization' : 'Customize test');
  }

  function handlePracticeKeydown(event) {
    const buttons = Array.from(elements.practiceOptions.querySelectorAll('.tt-practice-btn:not(:disabled)'));
    const current = buttons.indexOf(event.currentTarget);
    if (!buttons.length || current === -1) return;
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % buttons.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + buttons.length) % buttons.length;
    if (next !== current) {
      event.preventDefault();
      buttons[next].focus();
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      applyPractice(event.currentTarget.dataset.practice);
    }
  }

  function renderCategories() {
    const language = manifestLanguage(state.contentLanguage);
    elements.dataNotice.hidden = !(state.contentLanguage === 'en' && state.categoryId === 'medical' && state.payload?.provenance?.descriptorIds);
    elements.categories.replaceChildren();
    elements.categories.setAttribute('aria-busy', 'false');
    if (!language || !language.categories.length) {
      setStatus('No word lists are available for this language.', 'error');
      return;
    }
    if (!language.categories.some((category) => category.id === state.categoryId)) {
      state.categoryId = language.categories[0].id;
    }
    GROUPS.forEach((groupName) => {
      const categories = language.categories
        .filter((category) => category.group === groupName)
        .sort((first, second) => first.order - second.order);
      if (!categories.length) return;
      const group = document.createElement('div');
      group.className = 'tt-category-group';
      const label = document.createElement('span');
      label.className = 'tt-group-label';
      label.textContent = t(groupName);
      group.appendChild(label);
      categories.forEach((category) => {
        const chip = document.createElement('button');
        const selected = category.id === state.categoryId;
        const labelText = t(category.label);
        const countText = formatNumber(category.count, 0);
        const labelAlreadyStatesCount = new RegExp(`(^|\\D)${category.count}(\\D|$)`).test(category.label);
        chip.type = 'button';
        chip.className = `tt-chip${selected ? ' tt-chip--selected' : ''}`;
        chip.dataset.category = category.id;
        chip.setAttribute('role', 'radio');
        chip.setAttribute('aria-checked', String(selected));
        chip.setAttribute('aria-label', labelAlreadyStatesCount
          ? labelText
          : t('{{category}}, {{count}} entries', { category: labelText, count: countText }));
        chip.tabIndex = selected ? 0 : -1;
        const name = document.createElement('span');
        name.textContent = labelText;
        chip.appendChild(name);
        if (!labelAlreadyStatesCount) {
          const count = document.createElement('span');
          count.className = 'tt-chip-count';
          count.textContent = countText;
          count.setAttribute('aria-hidden', 'true');
          chip.appendChild(count);
        }
        chip.addEventListener('click', () => selectCategory(category.id));
        chip.addEventListener('keydown', handleCategoryKeydown);
        group.appendChild(chip);
      });
      elements.categories.appendChild(group);
    });
    requestAnimationFrame(() => {
      const selected = elements.categories.querySelector('.tt-chip--selected');
      selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      syncCategoryScrollControls();
    });
  }

  function syncCategoryScrollControls() {
    const maximum = elements.categories.scrollWidth - elements.categories.clientWidth;
    const canScroll = maximum > 1;
    elements.categoryPrev.disabled = !canScroll || elements.categories.scrollLeft <= 1;
    elements.categoryNext.disabled = !canScroll || elements.categories.scrollLeft >= maximum - 1;
  }

  function scrollCategories(direction) {
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    elements.categories.scrollBy({
      left: direction * Math.max(160, elements.categories.clientWidth * 0.7),
      behavior: reducedMotion ? 'auto' : 'smooth'
    });
  }

  function handleCategoryKeydown(event) {
    const chips = Array.from(elements.categories.querySelectorAll('.tt-chip'));
    const current = chips.indexOf(event.currentTarget);
    if (!chips.length || current === -1) return;
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % chips.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + chips.length) % chips.length;
    if (next !== current) {
      event.preventDefault();
      chips[next].focus();
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      selectCategory(event.currentTarget.dataset.category);
    }
  }

  function selectCategory(id) {
    state.categoryTouched = true;
    if (id === state.categoryId && state.phase === 'ready') {
      saveSettings();
      return;
    }
    const selected = categoryFor(state.contentLanguage, id);
    if (state.mode === 'quote' && selected && selected.type !== 'quotes') {
      const quoteCategory = manifestLanguage(state.contentLanguage).categories.find((category) => category.type === 'quotes');
      if (quoteCategory) id = quoteCategory.id;
    }
    state.categoryId = id;
    try { history.replaceState(null, '', `#${encodeURIComponent(id)}`); } catch {}
    renderCategories();
    prepareTest();
  }

  function setContentLanguage(language, touched) {
    state.contentLanguage = language === 'tr' ? 'tr' : 'en';
    if (state.contentLanguage !== 'tr' && isTurkishLesson()) state.practice = 'standard';
    if (touched) state.contentLanguageTouched = true;
    const matching = categoryFor(state.contentLanguage, state.categoryId);
    if (!matching) {
      state.categoryId = categoryFor(state.contentLanguage, 'common-1000')
        ? 'common-1000'
        : 'common-200';
    }
    syncControls();
    renderCategories();
    prepareTest();
  }

  function expandEntry(entry) {
    return String(entry || '').normalize('NFC').split(' ').filter(Boolean);
  }

  function capitaliseWord(value) {
    const chars = graphemes(value);
    if (!chars.length) return value;
    return `${localeUpper(chars[0], state.contentLanguage)}${chars.slice(1).join('')}`;
  }

  function normalisePracticeWord(value) {
    const word = String(value || '').normalize('NFC');
    if (state.mode === 'quote' || state.practice === 'custom' || state.practice === 'code') return word;
    return localeLower(word, state.contentLanguage);
  }

  function decorateWord(value, index) {
    let word = normalisePracticeWord(value);
    if (state.modifiers.capitalisation && index % 8 === 0) word = capitaliseWord(word);
    if (state.modifiers.numbers && index % 11 === 7) word = String(safeRandom(9999) + 1);
    if (state.modifiers.punctuation) {
      const punctuation = ['.', ',', ';', ':', '!', '?', "'", '"'];
      if (index % 6 === 5) word += punctuation[safeRandom(punctuation.length)];
      if (index % 17 === 9) word = `[${word}]`;
      if (index % 19 === 11) word = `"${word}"`;
    }
    return word;
  }

  function quoteFor(payload) {
    const quotes = payload.quotes || [];
    const ranges = { short: [40, 100], medium: [101, 170], long: [171, 260] };
    const range = ranges[state.quoteLength];
    const candidates = quotes.filter((quote) => quote.length >= range[0] && quote.length <= range[1]);
    return takeFromShuffleBag(
      `${listDeckKey('quotes')}/${state.quoteLength}`,
      candidates.length ? candidates : quotes,
      1
    )[0] || null;
  }

  function renderQuoteAttribution() {
    const attribution = state.mode === 'quote' && state.selectedQuote?.source
      ? `— ${state.selectedQuote.source}`
      : '';
    [elements.quoteAttribution, elements.resultQuoteAttribution].forEach((element) => {
      element.textContent = attribution;
      element.hidden = !attribution;
    });
  }

  function generateSequence(payload, desiredLength) {
    const category = categoryFor(state.contentLanguage, state.categoryId);
    const listType = payload.type || (category && category.type) || 'words';
    if (state.mode === 'quote') {
      if (listType === 'quotes') {
        state.selectedQuote = quoteFor(payload);
        return state.selectedQuote ? expandEntry(state.selectedQuote.text) : [];
      }
      const source = payload.words || FALLBACK_POOLS[state.contentLanguage];
      return buildShuffleBagWords(source, Math.max(12, desiredLength || 22), 'quote-words');
    }
    const source = listType === 'quotes'
      ? (payload.quotes || []).map((quote) => quote.text)
      : (payload.words || []);
    const count = state.mode === 'words' ? state.wordCount : desiredLength;
    return buildShuffleBagWords(source.length ? source : FALLBACK_POOLS[state.contentLanguage], count, listType);
  }

  function poolFromPayload(payload) {
    const category = categoryFor(state.contentLanguage, state.categoryId);
    const listType = payload.type || (category && category.type) || 'words';
    const source = listType === 'quotes'
      ? (payload.quotes || []).map((quote) => quote.text)
      : (payload.words || []);
    return source.length ? source : FALLBACK_POOLS[state.contentLanguage];
  }

  function uniquePracticePool(pool) {
    const seen = new Set();
    return pool.filter((entry) => {
      const word = String(entry).normalize('NFC');
      const key = localeLower(word, state.contentLanguage);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function dailySeed() {
    const day = new Date().toISOString().slice(0, 10);
    const source = `${day}/${state.contentLanguage}/${state.categoryId}`;
    return Array.from(source).reduce((value, character) => ((value * 31) + character.codePointAt(0)) >>> 0, 2166136261);
  }

  function dailyDeck(pool) {
    const deck = Array.from({ length: pool.length }, (_, index) => index);
    let seed = dailySeed();
    for (let index = deck.length - 1; index > 0; index -= 1) {
      seed = (Math.imul(seed ^ (seed >>> 16), 2246822507) + 3266489917) >>> 0;
      const swapIndex = seed % (index + 1);
      [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
    }
    return deck;
  }

  function dailyWords(pool, count, offset) {
    if (!pool.length) return [];
    const deck = dailyDeck(pool).flatMap((index) => expandEntry(pool[index]));
    return Array.from({ length: count }, (_, index) => normalisePracticeWord(deck[(offset + index) % deck.length]));
  }

  function weakKeyPool(payload) {
    const keys = new Set(state.errorKeyCounts.keys());
    if (!keys.size) return [];
    return poolFromPayload(payload).filter((word) => graphemes(word).some((character) => keys.has(localeLower(character, state.contentLanguage))));
  }

  function buildPracticeSequence(payload, desiredLength, offset) {
    const count = state.mode === 'words' ? state.wordCount : desiredLength;
    if (state.practice === 'standard') return generateSequence(payload, desiredLength);
    if (state.practice === 'daily') return dailyWords(uniquePracticePool(poolFromPayload(payload)), desiredLength, offset);
    if (state.practice === 'custom') {
      const customWords = expandEntry(elements.customText.value);
      if (!customWords.length) return [];
      const target = state.mode === 'words' ? customWords.length : desiredLength;
      return buildShuffledPlainWords(customWords, target, 'custom');
    }
    if (state.practice === 'code') return buildShuffledCodeWords(count);
    if (isTurkishLesson()) return buildShuffledPlainWords(TURKISH_LESSONS[state.practice], count, state.practice);
    if (state.practice === 'weak-keys') {
      const pool = weakKeyPool(payload);
      return buildShuffleBagWords(pool.length ? pool : poolFromPayload(payload), count, 'weak-keys');
    }
    if (state.practice === 'repeat-errors') {
      const target = state.mode === 'words' ? Math.min(count, state.repeatPool.length) : count;
      return buildShuffledPlainWords(state.repeatPool, target, 'repeat-errors');
    }
    return generateSequence(payload, desiredLength);
  }

  function initialSequenceLength() {
    if (state.practice === 'daily') return 300;
    return state.mode === 'time' || state.mode === 'zen' ? INITIAL_STREAM_WORDS : state.wordCount;
  }

  function shuffleIndexes(length) {
    const indexes = Array.from({ length }, (_, index) => index);
    for (let index = indexes.length - 1; index > 0; index -= 1) {
      const swap = safeRandom(index + 1);
      [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]];
    }
    return indexes;
  }

  function deckEntryText(entry) {
    return typeof entry === 'string' ? entry : entry.text;
  }

  function takeFromShuffleBag(key, pool, count) {
    if (!pool.length || !count) return [];
    let bag = state.shuffleBags.get(key);
    if (!bag || bag.length !== pool.length) {
      bag = { length: pool.length, indexes: [] };
      state.shuffleBags.set(key, bag);
    }
    const values = [];
    while (values.length < count) {
      if (!bag.indexes.length) {
        bag.indexes = shuffleIndexes(pool.length);
        const previous = state.deckLastValues.get(key);
        const next = deckEntryText(pool[bag.indexes[bag.indexes.length - 1]]);
        if (pool.length > 1 && next === previous) {
          const replacement = bag.indexes.findIndex((index) => deckEntryText(pool[index]) !== previous);
          if (replacement !== -1) {
            const last = bag.indexes.length - 1;
            [bag.indexes[last], bag.indexes[replacement]] = [bag.indexes[replacement], bag.indexes[last]];
          }
        }
      }
      const value = pool[bag.indexes.pop()];
      values.push(value);
      state.deckLastValues.set(key, deckEntryText(value));
    }
    return values;
  }

  function listDeckKey(kind) {
    return `${state.contentLanguage}/${state.categoryId}/${kind}`;
  }

  function poolFingerprint(pool) {
    let hash = 2166136261;
    pool.forEach((entry) => {
      Array.from(String(entry || '').normalize('NFC')).forEach((character) => {
        hash = Math.imul(hash ^ character.codePointAt(0), 16777619) >>> 0;
      });
      hash = Math.imul(hash ^ 31, 16777619) >>> 0;
    });
    return `${pool.length}-${hash}`;
  }

  function buildShuffleBagWords(pool, count, kind) {
    const words = [];
    while (words.length < count && pool.length) {
      const entry = takeFromShuffleBag(listDeckKey(kind), pool, 1)[0];
      words.push(...expandEntry(entry));
    }
    return words.map((word, index) => decorateWord(word, index));
  }

  function buildShuffledPlainWords(pool, count, kind) {
    return takeFromShuffleBag(`${listDeckKey(kind)}/${poolFingerprint(pool)}`, pool, count)
      .map((word) => normalisePracticeWord(word));
  }

  function buildShuffledCodeWords(count) {
    const words = [];
    while (words.length < count) {
      const snippet = takeFromShuffleBag(`${listDeckKey('code')}/snippets`, CODE_SNIPPETS, 1)[0];
      words.push(...expandEntry(snippet).map((word) => normalisePracticeWord(word)));
    }
    return words;
  }

  function appendRenderedWords(words, offset) {
    if (!words.length) return;
    const fragment = document.createDocumentFragment();
    words.forEach((word, relativeIndex) => {
      const wordIndex = offset + relativeIndex;
      const wordNode = document.createElement('span');
      wordNode.className = `tt-word${wordIndex === 0 ? ' tt-word--active' : ''}`;
      wordNode.dataset.wordIndex = String(wordIndex);
      const chars = graphemes(word);
      const charNodes = [];
      chars.forEach((character) => {
        const charNode = document.createElement('span');
        charNode.className = 'tt-char';
        charNode.textContent = character;
        charNodes.push(charNode);
        wordNode.appendChild(charNode);
      });
      const extraNodes = [];
      for (let extraIndex = 0; extraIndex < MAX_EXTRA_CHARACTERS; extraIndex += 1) {
        const extraNode = document.createElement('span');
        extraNode.className = 'tt-char tt-char--reserved';
        extraNode.setAttribute('aria-hidden', 'true');
        extraNodes.push(extraNode);
        wordNode.appendChild(extraNode);
      }
      state.wordNodes.push({ wordNode, chars, charNodes, extraNodes });
      fragment.appendChild(wordNode);
    });
    elements.stream.appendChild(fragment);
    state.renderedCount += words.length;
  }

  function renderSequence() {
    state.wordNodes = [];
    state.renderedCount = 0;
    state.streamOffset = 0;
    state.streamLineHeight = 0;
    elements.stream.replaceChildren();
    elements.stream.style.transform = 'translate3d(0, 0, 0)';
    const count = state.mode === 'time' || state.mode === 'zen' ? INITIAL_STREAM_WORDS : state.sequence.length;
    appendRenderedWords(state.sequence.slice(0, count), 0);
    renderQuoteAttribution();
    positionCaret();
  }

  function renderLoadingStream() {
    const skeleton = document.createElement('span');
    skeleton.className = 'tt-stream-skeleton';
    skeleton.textContent = t('Loading word list…');
    elements.stream.replaceChildren(skeleton);
  }

  function updateWordClasses() {
    const current = state.wordNodes[state.wordIndex];
    if (!current) return;
    const previous = state.wordNodes[state.activeWordIndex];
    if (previous && previous !== current) previous.wordNode.classList.remove('tt-word--active');
    current.wordNode.classList.add('tt-word--active');
    state.activeWordIndex = state.wordIndex;
    const typedChars = graphemes(state.typed);
    current.charNodes.forEach((node, index) => {
      let className = 'tt-char';
      if (index < typedChars.length) className += charactersMatch(current.chars[index], typedChars[index]) ? ' tt-char--correct' : ' tt-char--incorrect';
      node.className = className;
    });
    current.extraNodes.forEach((node, index) => {
      // Attribute-backed glyphs avoid childList mutations and i18n observer work.
      const character = typedChars[current.chars.length + index] || '';
      if (node.dataset.character !== character) node.dataset.character = character;
      node.className = index < Math.max(0, typedChars.length - current.chars.length)
        ? 'tt-char tt-char--extra'
        : 'tt-char tt-char--reserved';
    });
    requestCaretPosition();
  }

  function requestCaretPosition() {
    if (state.caretRaf) return;
    state.caretRaf = requestAnimationFrame(() => {
      state.caretRaf = 0;
      positionCaret();
    });
  }

  function positionCaret() {
    const current = state.wordNodes[state.wordIndex];
    if (!current) return;
    const typedLength = graphemes(state.typed).length;
    const nextCharacter = current.charNodes[typedLength];
    const extraLength = Math.min(MAX_EXTRA_CHARACTERS, Math.max(0, typedLength - current.chars.length));
    const lastCharacter = extraLength
      ? current.extraNodes[extraLength - 1]
      : current.charNodes[Math.max(0, current.chars.length - 1)];
    const characterLeft = nextCharacter
      ? nextCharacter.offsetLeft
      : lastCharacter ? lastCharacter.offsetLeft + lastCharacter.offsetWidth : 0;
    const characterTop = nextCharacter ? nextCharacter.offsetTop : lastCharacter ? lastCharacter.offsetTop : 0;
    const contentTop = current.wordNode.offsetTop + characterTop;
    if (!state.streamLineHeight) {
      state.streamLineHeight = Number.parseFloat(getComputedStyle(elements.stream).lineHeight) || 45;
    }
    const activeLine = Math.max(0, Math.floor((contentTop + state.streamLineHeight * 0.15) / state.streamLineHeight));
    const nextOffset = -Math.max(0, activeLine - 1) * state.streamLineHeight;
    if (nextOffset !== state.streamOffset) {
      state.streamOffset = nextOffset;
      elements.stream.style.transform = `translate3d(0, ${nextOffset}px, 0)`;
    }
    const left = elements.stream.offsetLeft + current.wordNode.offsetLeft + characterLeft - 1;
    const top = elements.stream.offsetTop + contentTop + state.streamOffset;
    elements.caret.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  function requestStreamRefill() {
    if (state.phase !== 'running') return;
    if (state.renderedCount - state.wordIndex >= REFILL_THRESHOLD || state.refillRaf) return;
    state.refillRaf = requestAnimationFrame(() => {
      state.refillRaf = 0;
      if ((state.mode === 'time' || state.mode === 'zen') && state.sequence.length - state.renderedCount < REFILL_WORDS) {
        const extension = buildPracticeSequence(state.payload, REFILL_WORDS, state.practiceOffset);
        state.sequence.push(...extension);
        state.practiceOffset += extension.length;
      }
      const next = state.sequence.slice(state.renderedCount, state.renderedCount + REFILL_WORDS);
      appendRenderedWords(next, state.renderedCount);
      updateWordClasses();
    });
  }

  function resetRun() {
    cancelAnimationFrame(state.rafId);
    cancelAnimationFrame(state.caretRaf);
    cancelAnimationFrame(state.refillRaf);
    state.rafId = 0;
    state.caretRaf = 0;
    state.refillRaf = 0;
    state.phase = 'ready';
    state.wordIndex = 0;
    state.activeWordIndex = 0;
    state.typed = '';
    state.previousInput = [];
    state.ledger = [];
    state.beforeInput = null;
    state.isComposing = false;
    state.wordRecords = new Map();
    state.missed = 0;
    state.startedAt = 0;
    state.endedAt = 0;
    state.samples = [];
    state.lastSampleSecond = 0;
    state.lastLiveAt = 0;
    state.invalid = false;
    elements.input.value = '';
    elements.test.dataset.status = 'ready';
    elements.test.classList.toggle('tt--blind', state.modifiers.blind);
    renderSequence();
    renderLive(0);
  }

  async function prepareTest() {
    const token = ++state.requestToken;
    if (state.practice === 'custom' && !expandEntry(elements.customText.value).length) {
      state.phase = 'idle';
      setStartButtonsDisabled(true);
      elements.prepare.disabled = false;
      setCustomizationVisible(true);
      elements.categories.setAttribute('aria-busy', 'false');
      elements.stream.replaceChildren();
      setStatus('Enter custom text to prepare this practice.', 'error');
      saveSettings();
      return;
    }
    state.phase = 'loading';
    elements.categories.setAttribute('aria-busy', 'true');
    setStartButtonsDisabled(true);
    renderLoadingStream();
    setStatus('Loading word list…');
    try {
      const payload = await loadList(state.contentLanguage, state.categoryId, token);
      if (!payload || token !== state.requestToken) return;
      state.payload = payload;
      state.selectedQuote = null;
      state.practiceOffset = 0;
      state.sequence = buildPracticeSequence(payload, initialSequenceLength(), state.practiceOffset);
      if (!state.sequence.length) throw new Error('empty list');
      state.practiceOffset = state.sequence.length;
      resetRun();
      state.phase = 'ready';
      if (state.practice === 'weak-keys' && !state.errorKeyCounts.size) {
        setStatus('Complete a test with mistakes to create a weak-key drill. Standard words are ready meanwhile.', 'error');
      } else {
        setStatus('{{count}} words loaded', { count: state.sequence.length });
      }
      setStartButtonsDisabled(false);
      renderCategories();
      saveSettings();
    } catch {
      if (token !== state.requestToken) return;
      state.payload = { type: 'words', words: FALLBACK_POOLS[state.contentLanguage] || FALLBACK_POOLS.en };
      state.practiceOffset = 0;
      state.sequence = buildPracticeSequence(state.payload, initialSequenceLength(), state.practiceOffset);
      if (!state.sequence.length) state.sequence = generateSequence(state.payload, INITIAL_STREAM_WORDS);
      state.practiceOffset = state.sequence.length;
      resetRun();
      state.phase = 'ready';
      setStatus('This word list is unavailable offline. A fallback list is ready.', 'error');
      setStartButtonsDisabled(false);
      renderCategories();
    }
  }

  function showTest() {
    if (state.phase !== 'ready') return;
    elements.config.hidden = true;
    elements.results.hidden = true;
    elements.test.hidden = false;
    elements.endZen.hidden = state.mode !== 'zen';
    elements.input.lang = state.contentLanguage;
    elements.input.focus({ preventScroll: true });
    positionCaret();
  }

  function showConfig() {
    if (state.phase === 'running') finishRun('cancelled');
    elements.config.hidden = false;
    elements.test.hidden = true;
    elements.results.hidden = true;
    setCustomizationVisible(false);
    elements.prepare.focus({ preventScroll: true });
  }

  function startNewTest() {
    showConfig();
    prepareTest();
  }

  function startQuickTest() {
    state.practice = 'standard';
    state.mode = 'time';
    state.duration = 60;
    state.categoryId = categoryFor(state.contentLanguage, 'common-1000') ? 'common-1000' : 'common-200';
    state.categoryTouched = false;
    state.modifiers.punctuation = false;
    state.modifiers.numbers = false;
    state.modifiers.capitalisation = false;
    state.modifiers.strict = true;
    state.modifiers.stopError = false;
    state.modifiers.blind = false;
    state.goal.enabled = false;
    syncControls();
    renderCategories();
    prepareTest().then(() => {
      if (state.phase === 'ready') showTest();
    });
  }

  function startRun() {
    if (state.phase !== 'ready') return;
    state.phase = 'running';
    state.startedAt = performance.now();
    state.lastLiveAt = -100;
    elements.test.dataset.status = 'running';
    state.rafId = requestAnimationFrame(tick);
  }

  function appendLedger(actual, expected, wordIndex, charIndex, isExtra) {
    const correct = !isExtra && charactersMatch(expected, actual);
    state.ledger.push({
      t: performance.now(),
      expected: expected || '',
      actual,
      correct,
      wordIndex,
      charIndex,
      extra: Boolean(isExtra)
    });
    return correct;
  }

  function evaluateInput(event) {
    if (state.isComposing || event.isComposing || !['ready', 'running'].includes(state.phase)) return;
    const value = elements.input.value.normalize('NFC');
    const parts = value.split(/\s/u);
    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      if (!['ready', 'running'].includes(state.phase)) break;
      const expectedChars = graphemes(state.sequence[state.wordIndex] || '');
      if (!expectedChars.length) break;
      const current = graphemes(parts[partIndex]);
      const previous = state.previousInput;
      let prefix = 0;
      while (prefix < previous.length && prefix < current.length && previous[prefix] === current[prefix]) prefix += 1;
      let suffix = 0;
      while (suffix < previous.length - prefix && suffix < current.length - prefix
        && previous[previous.length - 1 - suffix] === current[current.length - 1 - suffix]) suffix += 1;
      // Selection replacement may reinsert the same text. beforeinput records
      // that edit independently from compositionend's subsequent duplicate input.
      if (partIndex === 0 && state.beforeInput && event.inputType?.startsWith('insert')) {
        const edit = state.beforeInput;
        if (edit.end > edit.start) {
          prefix = Math.min(prefix, graphemes(edit.value.slice(0, edit.start)).length);
          suffix = Math.min(suffix, graphemes(edit.value.slice(edit.end)).length);
        }
      }
      const inserted = current.slice(prefix, current.length - suffix);
      if (inserted.length && state.phase === 'ready') startRun();
      const accepted = current.slice(0, prefix);
      inserted.forEach((character) => {
        const index = accepted.length;
        const expected = expectedChars[index] || '';
        const correct = appendLedger(character, expected, state.wordIndex, index, index >= expectedChars.length);
        if (!state.modifiers.stopError || correct) accepted.push(character);
      });
      accepted.push(...(suffix ? current.slice(-suffix) : []));
      state.typed = accepted.join('');
      state.previousInput = accepted;
      updateWordClasses();
      if (partIndex < parts.length - 1 && state.phase === 'running') commitWord();
    }
    state.beforeInput = null;
    if (elements.input.value !== state.typed) elements.input.value = state.typed;
  }

  function commitWord() {
    const chars = graphemes(state.sequence[state.wordIndex] || '');
    if (!chars.length) return;
    const typedChars = graphemes(state.typed);
    const missing = Math.max(0, chars.length - typedChars.length);
    state.missed += missing;
    if (state.phase === 'running') appendLedger(' ', ' ', state.wordIndex, chars.length, false);
    const hasError = typedChars.length !== chars.length || typedChars.some((character, index) => !charactersMatch(chars[index], character));
    state.wordRecords.set(state.wordIndex, { expected: state.sequence[state.wordIndex], typed: state.typed, hasError, missing });
    state.wordIndex += 1;
    state.typed = '';
    state.previousInput = [];
    elements.input.value = '';
    if (state.mode === 'words' && state.wordIndex >= state.sequence.length) {
      finishRun(false);
      return;
    }
    if (state.mode === 'quote' && state.wordIndex >= state.sequence.length) {
      finishRun(false);
      return;
    }
    if (!state.wordNodes[state.wordIndex]) {
      requestStreamRefill();
      return;
    }
    updateWordClasses();
    requestStreamRefill();
  }

  function clearOrReturnWord(event) {
    if (!['ready', 'running'].includes(state.phase) || state.isComposing) return false;
    if (!event.ctrlKey && !event.metaKey) return false;
    event.preventDefault();
    if (state.typed) {
      state.typed = '';
      state.previousInput = [];
      elements.input.value = '';
      updateWordClasses();
      return true;
    }
    const previousIndex = state.wordIndex - 1;
    const previousRecord = state.wordRecords.get(previousIndex);
    if (previousIndex >= 0 && previousRecord && previousRecord.hasError) {
      state.wordIndex = previousIndex;
      state.typed = previousRecord.typed;
      state.previousInput = graphemes(state.typed);
      elements.input.value = state.typed;
      updateWordClasses();
      return true;
    }
    return false;
  }

  function tick(now) {
    if (state.phase !== 'running') return;
    const elapsed = now - state.startedAt;
    if (state.mode === 'time' && elapsed >= state.duration * 1000) {
      finishRun(false);
      return;
    }
    const second = Math.floor(elapsed / 1000);
    if (second > state.lastSampleSecond) {
      state.lastSampleSecond = second;
      state.samples.push(sampleFor(elapsed));
    }
    if (elapsed - state.lastLiveAt >= 100) {
      state.lastLiveAt = elapsed;
      renderLive(elapsed);
    }
    state.rafId = requestAnimationFrame(tick);
  }

  function totals() {
    const correct = state.ledger.filter((entry) => entry.correct).length;
    const incorrect = state.ledger.filter((entry) => !entry.correct && !entry.extra).length;
    const extra = state.ledger.filter((entry) => entry.extra).length;
    return { correct, incorrect, extra, total: state.ledger.length };
  }

  function metricValues(elapsed) {
    const safeElapsed = Math.max(elapsed, 1);
    const minutes = safeElapsed / 60000;
    const counts = totals();
    return {
      raw: (counts.total / 5) / minutes,
      net: (counts.correct / 5) / minutes,
      cpm: counts.correct / minutes,
      accuracy: counts.total ? (counts.correct / counts.total) * 100 : 100,
      counts
    };
  }

  function sampleFor(elapsed) {
    const metrics = metricValues(elapsed);
    return {
      second: Math.max(1, Math.floor(elapsed / 1000)),
      net: metrics.net,
      raw: metrics.raw,
      errors: metrics.counts.incorrect + metrics.counts.extra + state.missed
    };
  }

  function renderLive(elapsed) {
    const metrics = metricValues(elapsed);
    if (state.mode === 'time') {
      elements.progressLabel.textContent = t('Time remaining');
      elements.timer.textContent = formatElapsed(Math.max(0, state.duration * 1000 - elapsed));
    } else if (state.mode === 'words' || state.mode === 'quote') {
      elements.progressLabel.textContent = t('Progress');
      elements.timer.textContent = `${formatNumber(Math.min(state.wordIndex, state.sequence.length), 0)}/${formatNumber(state.sequence.length, 0)}`;
    } else {
      elements.progressLabel.textContent = t('Elapsed time');
      elements.timer.textContent = formatElapsed(elapsed);
    }
    elements.liveWpm.textContent = formatNumber(metrics.net, 0);
    elements.liveCpm.textContent = formatNumber(metrics.cpm, 0);
    elements.liveAccuracy.textContent = `${formatNumber(metrics.accuracy, 1)}%`;
  }

  function finishRun(invalid) {
    if (state.phase !== 'running' && state.phase !== 'ready') return;
    state.endedAt = performance.now();
    cancelAnimationFrame(state.rafId);
    cancelAnimationFrame(state.caretRaf);
    cancelAnimationFrame(state.refillRaf);
    state.caretRaf = 0;
    state.refillRaf = 0;
    state.phase = 'finished';
    elements.test.dataset.status = 'finished';
    state.invalid = Boolean(invalid);
    const elapsed = state.startedAt ? state.endedAt - state.startedAt : 0;
    if (invalid) {
      if (invalid !== 'cancelled') showToast(t('This run ended because the tab was hidden.'), 'error');
      showConfig();
      return;
    }
    if (elapsed < 250) {
      showToast(t('This run was too short to score. Please try again.'), 'error');
      showConfig();
      return;
    }
    const finalSample = sampleFor(elapsed);
    if (!state.samples.length || state.samples[state.samples.length - 1].second !== finalSample.second) state.samples.push(finalSample);
    const attempts = state.ledger.filter((entry) => entry.wordIndex === state.wordIndex && entry.actual !== ' ');
    if (state.typed || attempts.length) {
      const expected = state.sequence[state.wordIndex];
      const expectedChars = graphemes(expected);
      const typedChars = graphemes(state.typed);
      const hasError = typedChars.some((character, index) => !charactersMatch(expectedChars[index], character))
        || (state.modifiers.stopError && attempts.some((entry) => !entry.correct));
      // Untyped trailing characters are not missed unless a space committed them.
      state.wordRecords.set(state.wordIndex, { expected, typed: state.typed || attempts.map((entry) => entry.actual).join(''), hasError, missing: 0 });
    }
    updateErrorProfile();
    updateRecord(metricValues(elapsed));
    elements.test.hidden = true;
    elements.results.hidden = false;
    renderResults(elapsed);
    elements.resultsHeading.focus({ preventScroll: true });
  }

  function consistency(samples) {
    if (samples.length < 3) return null;
    const values = samples.map((sample) => sample.raw);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (!mean) return 0;
    const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
    return Math.max(0, Math.min(100, 100 * (1 - Math.sqrt(variance) / mean)));
  }

  function descriptor() {
    const modeLabels = { time: 'Timed', words: 'Words', quote: 'Quote', zen: 'Zen' };
    const practiceLabels = {
      'weak-keys': 'Weak-key drill',
      'turkish-q': 'Turkish Q keyboard lesson',
      'turkish-f': 'Turkish F keyboard lesson',
      daily: 'Daily challenge',
      custom: 'Custom text',
      code: 'Code typing',
      'repeat-errors': 'Repeat recent errors'
    };
    const category = categoryFor(state.contentLanguage, state.categoryId);
    const parts = [
      t(state.contentLanguage === 'tr' ? 'Turkish' : 'English'),
      t(category ? category.label : state.categoryId),
      t(modeLabels[state.mode])
    ];
    if (state.practice !== 'standard') parts.push(t(practiceLabels[state.practice] || state.practice));
    if (state.mode === 'time') parts.push(t('{{count}} seconds', { count: formatNumber(state.duration, 0) }));
    if (state.mode === 'words') parts.push(t('{{count}} words', { count: formatNumber(state.sequence.length, 0) }));
    if (state.mode === 'quote') parts.push(t({ short: 'Short', medium: 'Medium', long: 'Long' }[state.quoteLength] || state.quoteLength));
    if (state.modifiers.punctuation) parts.push(t('Punctuation'));
    if (state.modifiers.numbers) parts.push(t('Numbers'));
    if (state.contentLanguage === 'tr' && !state.modifiers.strict) parts.push(t('Lenient diacritics'));
    return parts.join(' · ');
  }

  function errorRecords() {
    return Array.from(state.wordRecords.values()).filter((record) => record.hasError);
  }

  function updateErrorProfile() {
    state.ledger.filter((entry) => !entry.correct).forEach((entry) => {
      const source = entry.expected || entry.actual;
      graphemes(source).forEach((character) => {
        if (/\s/u.test(character)) return;
        const key = localeLower(character, state.contentLanguage);
        state.errorKeyCounts.set(key, (state.errorKeyCounts.get(key) || 0) + 1);
      });
    });
  }

  function renderGoalResult(metrics) {
    if (!state.goal.enabled) {
      elements.goalResult.hidden = true;
      return;
    }
    const passed = metrics.net >= state.goal.wpm && metrics.accuracy >= state.goal.accuracy;
    elements.goalResult.hidden = false;
    elements.goalResult.classList.toggle('tt-goal-result--missed', !passed);
    elements.goalResult.textContent = t(passed ? 'Goal passed: {{wpm}} WPM and {{accuracy}}% accuracy.' : 'Goal not reached: {{wpm}} WPM and {{accuracy}}% accuracy.', {
      wpm: state.goal.wpm,
      accuracy: formatNumber(state.goal.accuracy, 1)
    });
  }

  function renderPracticeActions() {
    elements.weakKeys.hidden = !state.errorKeyCounts.size;
    elements.repeatErrors.hidden = !errorRecords().length;
  }

  function renderResults(elapsed) {
    const metrics = metricValues(elapsed);
    const stable = consistency(state.samples);
    elements.descriptor.textContent = descriptor();
    renderQuoteAttribution();
    elements.resultNet.textContent = formatNumber(metrics.net, 0);
    elements.resultRaw.textContent = formatNumber(metrics.raw, 0);
    elements.resultCpm.textContent = formatNumber(metrics.cpm, 0);
    elements.resultAccuracy.textContent = `${formatNumber(metrics.accuracy, 1)}%`;
    elements.resultConsistency.textContent = stable === null ? '—' : `${formatNumber(stable, 1)}%`;
    elements.resultElapsed.textContent = formatElapsed(elapsed);
    elements.summary.textContent = t('Finished: {{wpm}} WPM, {{accuracy}}% accuracy in {{elapsed}}.', {
      wpm: formatNumber(metrics.net, 0), accuracy: formatNumber(metrics.accuracy, 1), elapsed: formatElapsed(elapsed)
    });
    elements.correct.textContent = formatNumber(metrics.counts.correct, 0);
    elements.incorrect.textContent = formatNumber(metrics.counts.incorrect, 0);
    elements.extra.textContent = formatNumber(metrics.counts.extra, 0);
    elements.missed.textContent = formatNumber(state.missed, 0);
    renderGoalResult(metrics);
    renderPracticeActions();
    renderErrorList();
    renderKeyboard();
    renderSamplesTable();
    drawChart();
    renderBest();
  }

  function renderErrorList() {
    elements.errorList.replaceChildren();
    const errors = errorRecords();
    if (!errors.length) {
      const empty = document.createElement('li');
      empty.className = 'tt-error-empty';
      empty.textContent = t('No words need review.');
      elements.errorList.appendChild(empty);
      return;
    }
    errors.slice(0, 20).forEach((record) => {
      const item = document.createElement('li');
      item.className = 'tt-error-item';
      const expected = document.createElement('b');
      expected.textContent = record.expected;
      const typed = document.createElement('em');
      typed.textContent = record.typed || '∅';
      item.append(expected, document.createTextNode(' → '), typed);
      elements.errorList.appendChild(item);
    });
  }

  function keyboardRows() {
    if (state.practice === 'turkish-f') return ['FGĞIODRNHPQW', 'UIEAÜTKMLYŞ', 'JÖVCÇZSB.'];
    return state.contentLanguage === 'tr'
      ? ['QWERTYUIOPĞÜ', 'ASDFGHJKLŞİ', 'ZXCVBNMÖÇ']
      : ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  }

  function renderKeyboard() {
    const namespace = 'http://www.w3.org/2000/svg';
    const rows = keyboardRows();
    const keyStats = new Map();
    state.ledger.forEach((entry) => {
      const key = localeUpper(entry.expected || entry.actual, state.contentLanguage);
      const stats = keyStats.get(key) || { attempts: 0, errors: 0 };
      stats.attempts += 1;
      if (!entry.correct) stats.errors += 1;
      keyStats.set(key, stats);
    });
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('viewBox', '0 0 720 185');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('Keyboard error heat map'));
    const border = getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
    const red = getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
    rows.forEach((row, rowIndex) => {
      const offset = rowIndex === 1 ? 23 : rowIndex === 2 ? 48 : 0;
      graphemes(row).forEach((key, keyIndex) => {
        const x = offset + keyIndex * 54;
        const y = 10 + rowIndex * 58;
        const stats = keyStats.get(key) || { attempts: 0, errors: 0 };
        const errors = stats.errors;
        const rate = stats.attempts ? errors / stats.attempts : 0;
        const rect = document.createElementNS(namespace, 'rect');
        rect.setAttribute('class', 'tt-key');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', '48');
        rect.setAttribute('height', '48');
        rect.setAttribute('rx', '7');
        rect.style.fill = errors ? `color-mix(in srgb, ${red} ${Math.max(20, rate * 100)}%, ${border})` : border;
        const title = document.createElementNS(namespace, 'title');
        title.textContent = t('{{key}}: {{count}} errors in {{attempts}} attempts ({{rate}}%)', {
          key,
          count: formatNumber(errors, 0),
          attempts: formatNumber(stats.attempts, 0),
          rate: formatNumber(rate * 100, 1)
        });
        rect.appendChild(title);
        const text = document.createElementNS(namespace, 'text');
        text.setAttribute('class', 'tt-key-label');
        text.setAttribute('x', String(x + 24));
        text.setAttribute('y', String(y + 30));
        text.textContent = key;
        svg.append(rect, text);
      });
    });
    elements.keyboard.replaceChildren(svg);
  }

  function renderSamplesTable() {
    elements.samplesBody.replaceChildren();
    state.samples.forEach((sample) => {
      const row = document.createElement('tr');
      [sample.second, Math.round(sample.net), Math.round(sample.raw), sample.errors].forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = formatNumber(value, 0);
        row.appendChild(cell);
      });
      elements.samplesBody.appendChild(row);
    });
  }

  function drawChart() {
    const canvas = elements.chart;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    const width = rect.width;
    const height = rect.height;
    const styles = getComputedStyle(document.documentElement);
    const cyan = styles.getPropertyValue('--cyan').trim();
    const purple = styles.getPropertyValue('--purple').trim();
    const red = styles.getPropertyValue('--red').trim();
    const muted = styles.getPropertyValue('--text-muted').trim();
    const border = styles.getPropertyValue('--border').trim();
    context.clearRect(0, 0, width, height);
    context.font = '11px sans-serif';
    context.fillStyle = muted;
    context.strokeStyle = border;
    context.lineWidth = 1;
    const pad = { left: 36, right: 12, top: 18, bottom: 28 };
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;
    const samples = state.samples.length ? state.samples : [{ second: 0, net: 0, raw: 0, errors: 0 }];
    const maximum = Math.max(10, ...samples.flatMap((sample) => [sample.net, sample.raw]));
    [0, 0.5, 1].forEach((fraction) => {
      const y = pad.top + chartHeight * fraction;
      context.beginPath();
      context.moveTo(pad.left, y);
      context.lineTo(width - pad.right, y);
      context.stroke();
      context.fillText(formatNumber(maximum * (1 - fraction), 0), 3, y + 4);
    });
    const drawSeries = (field, color) => {
      context.beginPath();
      samples.forEach((sample, index) => {
        const x = pad.left + (samples.length === 1 ? 0 : (index / (samples.length - 1)) * chartWidth);
        const y = pad.top + chartHeight - (sample[field] / maximum) * chartHeight;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.stroke();
    };
    drawSeries('net', cyan);
    drawSeries('raw', purple);
    samples.forEach((sample, index) => {
      if (sample.errors <= (samples[index - 1]?.errors || 0)) return;
      const x = pad.left + (samples.length === 1 ? 0 : (index / (samples.length - 1)) * chartWidth);
      context.fillStyle = red;
      context.beginPath();
      context.arc(x, pad.top + chartHeight + 10, 3, 0, Math.PI * 2);
      context.fill();
    });
    context.fillStyle = cyan;
    context.fillText(t('Net WPM'), pad.left, 12);
    context.fillStyle = purple;
    context.fillText(t('Raw WPM'), pad.left + 70, 12);
    context.fillStyle = muted;
    context.fillText(t('Seconds'), width - 58, height - 8);
    canvas.setAttribute('aria-label', t('Speed chart with a peak of {{wpm}} WPM', { wpm: formatNumber(maximum, 0) }));
  }

  function recordKey() {
    const size = state.mode === 'time' ? state.duration : state.mode === 'words' ? state.sequence.length : state.quoteLength;
    return `${state.contentLanguage}/${state.categoryId}/${state.mode}/${size}`;
  }

  function updateRecord(metrics) {
    const key = recordKey();
    const score = { netWpm: Math.round(metrics.net), accuracy: Number(metrics.accuracy.toFixed(1)) };
    const current = state.sessionRecords.get(key);
    if (!current || score.netWpm > current.netWpm) state.sessionRecords.set(key, score);
    if (elements.remember.checked) {
      const stored = state.storedRecords[key];
      if (!stored || score.netWpm > stored.netWpm) {
        state.storedRecords[key] = score;
        saveRecords();
      }
      syncStoredRecordControls();
    }
    renderBest();
  }

  function renderBest() {
    const key = recordKey();
    const best = [state.sessionRecords.get(key), state.storedRecords[key]]
      .filter((score) => score && Number.isFinite(score.netWpm))
      .sort((first, second) => second.netWpm - first.netWpm || second.accuracy - first.accuracy)[0];
    elements.best.textContent = best
      ? t('Personal best: {{wpm}} WPM', { wpm: formatNumber(best.netWpm, 0) })
      : '';
  }

  function launchResultPractice(practice) {
    state.practice = practice;
    state.mode = 'words';
    state.wordCount = practice === 'weak-keys' ? 25 : 10;
    syncControls();
    renderCategories();
    elements.results.hidden = true;
    prepareTest().then(() => {
      if (state.phase === 'ready') showTest();
    });
  }

  function startWeakKeyPractice() {
    if (!state.errorKeyCounts.size) {
      showToast(t('Complete a test with mistakes to create a weak-key drill.'), 'error');
      return;
    }
    launchResultPractice('weak-keys');
  }

  function startErrorRepeat() {
    state.repeatPool = errorRecords().slice(0, 10).map((record) => record.expected);
    if (!state.repeatPool.length) {
      showToast(t('No errors are available to repeat.'), 'error');
      return;
    }
    launchResultPractice('repeat-errors');
  }

  function copyResult() {
    const elapsed = state.endedAt - state.startedAt;
    const metrics = metricValues(elapsed);
    const summary = [
      t('Typing Speed Test'),
      descriptor(),
      t('Net WPM: {{value}}', { value: formatNumber(Math.round(metrics.net), 0) }),
      t('Raw WPM: {{value}}', { value: formatNumber(Math.round(metrics.raw), 0) }),
      t('CPM: {{value}}', { value: formatNumber(Math.round(metrics.cpm), 0) }),
      t('Accuracy: {{value}}%', { value: formatNumber(metrics.accuracy, 1) }),
      t('Elapsed time: {{value}}', { value: formatElapsed(elapsed) })
    ].join('\n');
    copyToClipboard(summary, 'Result');
  }

  function bindEvents() {
    elements.language.addEventListener('change', () => setContentLanguage(elements.language.value, true));
    elements.practiceOptions.querySelectorAll('.tt-practice-btn').forEach((button) => {
      button.addEventListener('click', () => applyPractice(button.dataset.practice));
      button.addEventListener('keydown', handlePracticeKeydown);
    });
    elements.customText.addEventListener('input', debounce(() => {
      if (state.practice === 'custom') prepareTest();
    }, 250));
    elements.goalEnabled.addEventListener('change', updateGoalFromControls);
    elements.goalWpm.addEventListener('change', updateGoalFromControls);
    elements.goalAccuracy.addEventListener('change', updateGoalFromControls);
    elements.categoryPrev.addEventListener('click', () => scrollCategories(-1));
    elements.categoryNext.addEventListener('click', () => scrollCategories(1));
    elements.categories.addEventListener('scroll', syncCategoryScrollControls, { passive: true });
    document.querySelectorAll('.tt-mode-btn').forEach((button) => button.addEventListener('click', () => {
      state.mode = button.dataset.mode;
      if (state.mode === 'quote') {
        const quoteCategory = manifestLanguage(state.contentLanguage).categories.find((category) => category.type === 'quotes');
        if (quoteCategory) state.categoryId = quoteCategory.id;
      }
      syncControls();
      renderCategories();
      prepareTest();
    }));
    document.querySelectorAll('[data-duration]').forEach((button) => button.addEventListener('click', () => {
      state.duration = Number(button.dataset.duration);
      syncControls();
      prepareTest();
    }));
    document.querySelectorAll('[data-words]').forEach((button) => button.addEventListener('click', () => {
      state.wordCount = Number(button.dataset.words);
      syncControls();
      prepareTest();
    }));
    document.querySelectorAll('[data-quote-length]').forEach((button) => button.addEventListener('click', () => {
      state.quoteLength = button.dataset.quoteLength;
      syncControls();
      prepareTest();
    }));
    [elements.punctuation, elements.numbers, elements.capitalisation, elements.strict, elements.stopError, elements.blind].forEach((control) => {
      control.addEventListener('change', () => {
        state.modifiers.punctuation = elements.punctuation.checked;
        state.modifiers.numbers = elements.numbers.checked;
        state.modifiers.capitalisation = elements.capitalisation.checked;
        state.modifiers.strict = elements.strict.checked;
        state.modifiers.stopError = elements.stopError.checked;
        state.modifiers.blind = elements.blind.checked;
        syncControls();
        prepareTest();
      });
    });
    elements.prepare.addEventListener('click', startQuickTest);
    elements.customizeToggle.addEventListener('click', () => {
      setCustomizationVisible(elements.customize.hidden);
    });
    elements.startSelected.addEventListener('click', () => {
      if (state.phase === 'ready') showTest(); else prepareTest();
    });
    elements.input.addEventListener('compositionstart', () => { state.isComposing = true; });
    elements.input.addEventListener('compositionupdate', () => { state.isComposing = true; });
    elements.input.addEventListener('compositionend', (event) => {
      state.isComposing = false;
      evaluateInput(event);
    });
    elements.input.addEventListener('input', evaluateInput);
    elements.input.addEventListener('beforeinput', () => {
      state.beforeInput = { value: elements.input.value, start: elements.input.selectionStart, end: elements.input.selectionEnd };
    });
    elements.input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        showConfig();
      }
      if (event.key === 'Backspace') clearOrReturnWord(event);
    });
    elements.endZen.addEventListener('click', () => finishRun(false));
    const restartRun = () => {
      resetRun();
      showTest();
    };
    elements.restart.addEventListener('click', restartRun);
    elements.restartRunning.addEventListener('click', restartRun);
    elements.weakKeys.addEventListener('click', () => startWeakKeyPractice());
    elements.repeatErrors.addEventListener('click', () => startErrorRepeat());
    elements.newTest.addEventListener('click', startNewTest);
    elements.copy.addEventListener('click', copyResult);
    elements.remember.addEventListener('change', () => {
      settings.rememberRecords = elements.remember.checked;
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...readSettings(), rememberRecords: settings.rememberRecords })); } catch {}
      if (elements.remember.checked && state.phase === 'finished' && !state.invalid && state.endedAt - state.startedAt >= 250) {
        updateRecord(metricValues(state.endedAt - state.startedAt));
      }
    });
    const clearStoredResults = () => {
      state.storedRecords = {};
      try { localStorage.removeItem(RECORDS_KEY); } catch {}
      syncStoredRecordControls();
      renderBest();
      showToast(t('Stored results cleared.'));
    };
    elements.clearRecords.addEventListener('click', clearStoredResults);
    elements.clearRecordsConfig.addEventListener('click', clearStoredResults);
    window.addEventListener('resize', debounce(() => {
      state.streamLineHeight = 0;
      drawChart();
      positionCaret();
    }, 160));
    window.addEventListener('toolkit:languagechange', (event) => {
      renderMetadata();
      syncControls();
      renderCategories();
      renderLive(state.startedAt ? performance.now() - state.startedAt : 0);
      if (!elements.results.hidden) {
        renderResults(state.endedAt - state.startedAt);
      }
      if (!state.contentLanguageTouched && state.contentLanguage !== event.detail.language) {
        showConfig();
        setContentLanguage(event.detail.language, false);
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.phase === 'running') finishRun(true);
    });
  }

  function debounce(callback, wait) {
    let timer = 0;
    return () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(callback, wait);
    };
  }

  async function init() {
    bindEvents();
    renderMetadata();
    syncControls();
    setCustomizationVisible(false);
    await loadManifest();
    renderCategories();
    await prepareTest();
  }

  init();
}());
