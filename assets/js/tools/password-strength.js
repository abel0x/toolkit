(function initPasswordStrength() {
  'use strict';

  const input     = document.getElementById('psInput');
  const meter     = document.getElementById('psMeter');
  const label     = document.getElementById('psLabel');
  const feedback  = document.getElementById('psFeedback');
  const toggleBtn = document.getElementById('psToggle');

  if (!input) return;

  const COMMON = ['password','123456','qwerty','letmein','admin','welcome','monkey','dragon','1234567890','abc123'];

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

    if (COMMON.includes(pw.toLowerCase())) { score = 0; hints.push('This is a very common password.'); }
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
