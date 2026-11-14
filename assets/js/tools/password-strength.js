(function initPasswordStrength() {
  'use strict';

  const input     = document.getElementById('psInput');
  const meter     = document.getElementById('psMeter');
  const label     = document.getElementById('psLabel');
  const feedback  = document.getElementById('psFeedback');
  const toggleBtn = document.getElementById('psToggle');

  if (!input) return;

  /* Passwords are rarely random: most are a common word or number run,
     with digits, a year or a symbol added, or a keyboard row. These short
     lists (English and Turkish) and rules catch those shapes; a password
     is checked on this device only. */
  const COMMON = new Set(('123456 1234567 12345678 123456789 1234567890 111111 000000 123123 654321 666666 121212 112233 ' +
    '159753 147258 147258369 1q2w3e 1q2w3e4r 1qaz2wsx qwe123 abc123 a1b2c3 aa123456 qwerty qwerty123 asdfgh zxcvbnm ' +
    'password passw0rd p@ssw0rd letmein iloveyou admin admin123 root welcome changeme default test test123 guest login ' +
    'sifre şifre sifre123 parola parola123 qwe asd 123qwe').split(' '));
  const WORDS = new Set(('password admin administrator root user guest login welcome letmein iloveyou love monkey dragon ' +
    'master shadow sunshine princess football baseball soccer hockey basketball superman batman starwars pokemon freedom ' +
    'whatever trustno hello secret summer winter spring autumn michael jennifer jordan charlie daniel thomas robert ' +
    'matthew ashley jessica computer internet google facebook apple samsung microsoft cookie chocolate flower tiger ' +
    'killer ninja mustang harley ranger hunter buster pepper ginger maggie banana orange purple cheese coffee money ' +
    'family friends london paris america qwerty changeme default ' +
    'sifre şifre parola galatasaray cimbom cimbombom fenerbahce fenerbahçe fener besiktas beşiktaş kartal trabzonspor ' +
    'bursaspor istanbul ankara izmir antalya bursa turkiye türkiye turkey ataturk atatürk ask aşk askim aşkım canim ' +
    'canım bebegim bebeğim sevgilim annem babam kardesim kardeşim allah merhaba selam aslan mehmet ahmet mustafa ali ' +
    'ayse ayşe fatma emine zeynep elif yusuf ibrahim hüseyin huseyin hasan murat emre burak').split(' '));
  // Keyboard rows (QWERTY and Turkish F) and alphabet/number runs.
  const RUNS = ['qwertyuiopğü', 'asdfghjklşi', 'zxcvbnmöç', '1234567890', 'qazwsxedcrfvtgb', '1qaz2wsx3edc4rfv',
    'abcdefghijklmnopqrstuvwxyz', 'fgğıodrnhpqw', 'uieaüştkmlyx', 'jövcçzsbx'];
  const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };

  function patterns(pw) {
    const lower = pw.toLocaleLowerCase('tr');
    const plain = pw.toLowerCase();
    const found = [];
    if (COMMON.has(plain) || COMMON.has(lower)) return ['common'];
    // Strip what people add around a word, then undo letter-for-digit swaps.
    const core = lower.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    const unleet = lower.replace(/^[^\p{L}\d@$]+|[^\p{L}\d@$]+$/gu, '').replace(/[013457@$!]/g, (c) => LEET[c])
      .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
    const word = [core, unleet, core.replace(/ı/g, 'i')].find((candidate) => WORDS.has(candidate));
    if (word && word.length * 2 >= lower.length) found.push('word');
    let longest = 0;
    for (const run of RUNS) {
      for (const sequence of [run, Array.from(run).reverse().join('')]) {
        for (let size = Math.min(sequence.length, lower.length); size >= 4 && size > longest; size -= 1) {
          for (let start = 0; start + size <= sequence.length; start += 1) {
            if (lower.includes(sequence.slice(start, start + size))) { longest = size; break; }
          }
        }
      }
    }
    if (longest >= 4 && longest * 2 >= lower.length) found.push('keyboard');
    if (/(?:19|20)\d{2}[^\p{L}\d]*$/u.test(pw)) found.push('year');
    if (/^(.{2,})\1+$/.test(lower)) found.push('repeat');
    return found;
  }

  function t(key) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key) : key;
  }

  function entropy(pw) {
    const set = new Set(pw.split(''));
    return pw.length * Math.log2(set.size || 1);
  }

  function analyse(pw) {
    const hints = [];
    let score = 0;

    if (pw.length === 0) return { score: 0, label: '', hints: [], color: '' };

    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (pw.length >= 16) score++;

    if (/[a-z]/.test(pw)) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score += 2;

    const found = patterns(pw);
    if (found.includes('common')) { score = 0; hints.push('This is a very common password.'); }
    if (found.includes('word')) { score = Math.min(score, 3); hints.push('It is a common word or name with a few characters added.'); }
    if (found.includes('keyboard')) { score = Math.min(score, 3); hints.push('It is mostly a keyboard or number run, such as qwerty or 123456.'); }
    if (found.includes('repeat')) { score = Math.min(score, 3); hints.push('It repeats the same part.'); }
    if (found.includes('year')) { score = Math.max(0, score - 1); hints.push('It ends with a year, which is easy to guess.'); }
    if (/(.)\1{2,}/.test(pw)) { score = Math.max(0, score - 1); hints.push('Avoid repeated characters.'); }
    if (pw.length < 8)  hints.push('Use at least 8 characters.');
    if (!/[A-Z]/.test(pw)) hints.push('Add uppercase letters.');
    if (!/[0-9]/.test(pw)) hints.push('Add numbers.');
    if (!/[^a-zA-Z0-9]/.test(pw)) hints.push('Add special characters (!@#$%^&*).');
    if (pw.length < 12) hints.push('Aim for 12+ characters for stronger protection.');

    const clampedScore = Math.min(score, 8);
    let strengthLabel, color;
    if (clampedScore <= 2)      { strengthLabel = 'Very Weak';  color = '#f87171'; }
    else if (clampedScore <= 4) { strengthLabel = 'Weak';       color = '#fb923c'; }
    else if (clampedScore <= 5) { strengthLabel = 'Fair';       color = '#e3b341'; }
    else if (clampedScore <= 6) { strengthLabel = 'Strong';     color = '#7fd48f'; }
    else                        { strengthLabel = 'Very Strong'; color = '#3ecf8e'; }

    return { score: clampedScore, max: 8, label: strengthLabel, color, hints };
  }

  function render(pw) {
    const result = analyse(pw);
    if (!pw) {
      if (meter) { meter.style.width = '0%'; meter.style.background = ''; }
      if (label) label.textContent = '';
      if (feedback) feedback.replaceChildren();
      return;
    }
    const pct = (result.score / result.max) * 100;
    if (meter) { meter.style.width = pct + '%'; meter.style.background = result.color; }
    if (label) { label.textContent = t(result.label); label.style.color = result.color; }
    if (feedback) {
      const hints = result.hints.length ? result.hints : ['Looks good!'];
      feedback.replaceChildren(...hints.map((hint) => {
        const item = document.createElement('li');
        item.textContent = t(hint);
        if (!result.hints.length) {
          item.textContent += ' ✓';
          item.style.color = 'var(--green)';
        }
        return item;
      }));
    }
  }

  function updateVisibilityControl() {
    if (!toggleBtn) return;
    const labelText = input.type === 'password' ? 'Show password' : 'Hide password';
    toggleBtn.setAttribute('aria-label', t(labelText));
    toggleBtn.title = t(labelText);
  }

  input.addEventListener('input', () => render(input.value));

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
      updateVisibilityControl();
    });
  }

  window.addEventListener('toolkit:languagechange', () => {
    render(input.value);
    updateVisibilityControl();
  });

  updateVisibilityControl();
})();
