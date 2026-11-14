/* TOOLKIT — assets/js/tools/password.js */
(function initPasswordGenerator() {
  'use strict';

  const CHARS = {
    upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower:   'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{}|;:,.<>?',
  };
  const AMBIGUOUS = /[0Ol1I|]/g;

  const lengthSlider   = document.getElementById('pwdLength');
  const lengthVal      = document.getElementById('pwdLengthVal');
  const optUpper       = document.getElementById('optUpper');
  const optLower       = document.getElementById('optLower');
  const optNumbers     = document.getElementById('optNumbers');
  const optSymbols     = document.getElementById('optSymbols');
  const optAmbiguous   = document.getElementById('optAmbiguous');
  const genBtn         = document.getElementById('pwdGenBtn');
  const output         = document.getElementById('pwdOutput');
  const copyBtn        = document.getElementById('pwdCopyBtn');
  const strengthLabel  = document.getElementById('strengthLabel');
  const bars           = [1, 2, 3, 4].map(i => document.getElementById(`sb${i}`));
  const modeWords      = document.getElementById('pwdModeWords');
  const charOptions    = document.getElementById('pwdCharOptions');
  const wordOptions    = document.getElementById('pwdWordOptions');
  const wordsSlider    = document.getElementById('pwdWords');
  const wordsVal       = document.getElementById('pwdWordsVal');
  const separator      = document.getElementById('pwdSeparator');
  const wordLanguage   = document.getElementById('pwdWordLanguage');
  const capitalize     = document.getElementById('pwdCapitalize');
  const addNumber      = document.getElementById('pwdAddNumber');
  // assets/js/tools/password.js → the site root, where words/ lives.
  const wordsRoot      = new URL('../../../words/', document.currentScript.src);
  const wordLists      = new Map();

  if (!lengthSlider) return;

  function t(key, values) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key, values)
      : key.replace(/{{(\w+)}}/g, (_, name) => String(values?.[name] ?? ''));
  }

  function updateLengthSlider() {
    const pct = ((lengthSlider.value - lengthSlider.min) / (lengthSlider.max - lengthSlider.min)) * 100;
    lengthSlider.style.setProperty('--val', pct + '%');
    lengthVal.textContent = lengthSlider.value;
  }

  lengthSlider.addEventListener('input', updateLengthSlider);
  updateLengthSlider();

  function buildCharset() {
    let charset = '';
    if (optUpper.checked)   charset += CHARS.upper;
    if (optLower.checked)   charset += CHARS.lower;
    if (optNumbers.checked) charset += CHARS.numbers;
    if (optSymbols.checked) charset += CHARS.symbols;

    if (optAmbiguous.checked) {
      charset = charset.replace(AMBIGUOUS, '');
    }
    return charset;
  }

  function generatePassword() {
    const charset = buildCharset();
    if (!charset.length) {
      showToast('Select at least one character type', 'error');
      return;
    }

    const length = parseInt(lengthSlider.value, 10);
    // Guarantee one character from each selected type
    const required = [];
    if (optUpper.checked)   required.push(getChar(CHARS.upper));
    if (optLower.checked)   required.push(getChar(CHARS.lower));
    if (optNumbers.checked) required.push(getChar(CHARS.numbers));
    if (optSymbols.checked) required.push(getChar(CHARS.symbols));

    function getChar(pool) {
      let p = optAmbiguous.checked ? pool.replace(AMBIGUOUS, '') : pool;
      if (!p.length) p = pool;
      return p[secureRandInt(p.length)];
    }

    const password = required.slice();
    while (password.length < length) {
      password.push(charset[secureRandInt(charset.length)]);
    }

    // Shuffle after seeding the required characters so no type can be overwritten.
    for (let i = password.length - 1; i > 0; i--) {
      const position = secureRandInt(i + 1);
      [password[i], password[position]] = [password[position], password[i]];
    }

    const result = password.join('');
    output.textContent = result;
    updateStrength(result.length * Math.log2(charset.length || 2));
  }

  // Passphrases: words from the site's own CC0 lists of the 1,000 most
  // common words, kept to 3–10 letters so they are easy to type and read.
  async function loadWords(language) {
    if (!wordLists.has(language)) {
      wordLists.set(language, fetch(new URL(`${language}/common-1000.json`, wordsRoot))
        .then((response) => { if (!response.ok) throw new Error(response.status); return response.json(); })
        .then((list) => [...new Set(list.words
          .map((word) => word.toLocaleLowerCase(language))
          .filter((word) => /^\p{L}{3,10}$/u.test(word)))])
        .catch((error) => { wordLists.delete(language); throw error; }));
    }
    return wordLists.get(language);
  }

  async function generatePassphrase() {
    const language = wordLanguage.value;
    let words;
    try {
      words = await loadWords(language);
    } catch {
      showToast(t('The word list could not be loaded.'), 'error');
      return;
    }
    const count = parseInt(wordsSlider.value, 10);
    const chosen = Array.from({ length: count }, () => words[secureRandInt(words.length)]);
    if (capitalize.checked) {
      chosen.forEach((word, index) => {
        chosen[index] = word.charAt(0).toLocaleUpperCase(language) + word.slice(1);
      });
    }
    // Each word adds log2(list size) bits; a digit after a random word adds
    // log2(10) for the digit and log2(count) for where it goes.
    let entropy = count * Math.log2(words.length);
    if (addNumber.checked) {
      const index = secureRandInt(count);
      chosen[index] += String(secureRandInt(10));
      entropy += Math.log2(10) + Math.log2(count);
    }
    const result = chosen.join(separator.value);
    output.textContent = result;
    updateStrength(entropy);
  }

  function updateWordsSlider() {
    const pct = ((wordsSlider.value - wordsSlider.min) / (wordsSlider.max - wordsSlider.min)) * 100;
    wordsSlider.style.setProperty('--val', pct + '%');
    wordsVal.textContent = wordsSlider.value;
  }

  function setMode() {
    const words = modeWords.checked;
    wordOptions.hidden = !words;
    charOptions.hidden = words;
    output.classList.toggle('pwd-output--words', words);
    generate();
  }

  function generate() {
    if (modeWords.checked) generatePassphrase();
    else generatePassword();
  }

  function updateStrength(entropy) {

    let level, label, cls;
    if      (entropy < 40)  { level = 0; label = 'Weak';   cls = 's-weak'; }
    else if (entropy < 70)  { level = 1; label = 'Fair';   cls = 's-fair'; }
    else if (entropy < 100) { level = 2; label = 'Good';   cls = 's-good'; }
    else                    { level = 3; label = 'Strong';  cls = 's-strong'; }

    bars.forEach((bar, i) => {
      bar.className = 'strength-bar';
      if (i <= level) bar.classList.add(`active-${level}`);
    });

    strengthLabel.className = `strength-label ${cls}`;
    strengthLabel.textContent = `${t(label)} · ${t('≈{{bits}} bits', { bits: Math.round(entropy) })}`;
  }

  genBtn.addEventListener('click', generate);
  document.querySelectorAll('input[name="pwdMode"]').forEach((radio) => radio.addEventListener('change', setMode));
  wordsSlider.addEventListener('input', () => { updateWordsSlider(); generate(); });
  [separator, wordLanguage, capitalize, addNumber].forEach((control) => control.addEventListener('change', generate));
  // Turkish pages start with the Turkish word list.
  if (document.documentElement.lang === 'tr') wordLanguage.value = 'tr';
  updateWordsSlider();
  copyBtn.addEventListener('click', () => copyToClipboard(output.textContent, 'Password'));

  // Generate on page load
  generatePassword();
})();
