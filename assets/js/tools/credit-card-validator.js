/* TOOLKIT — assets/js/tools/credit-card-validator.js
   Reads what a payment card number itself says: the network from its
   first digits, whether the length suits it, and the Luhn check digit.
   Nothing is sent anywhere; the number is not stored or shared. */
(function initCardValidator() {
  'use strict';

  const numberEl = document.getElementById('ccNumber');
  const expiryEl = document.getElementById('ccExpiry');
  const cvcEl = document.getElementById('ccCvc');
  const networkEl = document.getElementById('ccNetwork');
  const formattedEl = document.getElementById('ccFormatted');
  const checksEl = document.getElementById('ccChecks');
  const factsEl = document.getElementById('ccFacts');
  const cardEl = document.getElementById('ccCard');
  const noteEl = document.getElementById('ccNote');
  if (!numberEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  /* Prefix ranges (IIN), allowed lengths and the grouping printed on the
     card. Longer, more specific prefixes win. UnionPay numbers need not
     pass the Luhn check. */
  const NETWORKS = [
    { name: 'Troy', id: 'troy', ranges: [[9792, 9792]], lengths: [16], groups: [4, 4, 4, 4], cvc: 3 },
    { name: 'Visa', id: 'visa', ranges: [[4, 4]], lengths: [13, 16, 19], groups: [4, 4, 4, 4, 3], cvc: 3 },
    { name: 'Mastercard', id: 'mastercard', ranges: [[51, 55], [2221, 2720]], lengths: [16], groups: [4, 4, 4, 4], cvc: 3 },
    { name: 'American Express', id: 'amex', ranges: [[34, 34], [37, 37]], lengths: [15], groups: [4, 6, 5], cvc: 4 },
    { name: 'Discover', id: 'discover', ranges: [[6011, 6011], [644, 649], [65, 65]], lengths: [16, 17, 18, 19], groups: [4, 4, 4, 4, 3], cvc: 3 },
    { name: 'JCB', id: 'jcb', ranges: [[3528, 3589]], lengths: [16, 17, 18, 19], groups: [4, 4, 4, 4, 3], cvc: 3 },
    { name: 'Diners Club', id: 'diners', ranges: [[300, 305], [3095, 3095], [36, 36], [38, 39]], lengths: [14, 15, 16, 17, 18, 19], groups: [4, 6, 4, 5], cvc: 3 },
    { name: 'UnionPay', id: 'unionpay', ranges: [[62, 62]], lengths: [16, 17, 18, 19], groups: [4, 4, 4, 4, 3], cvc: 3, luhnOptional: true },
    { name: 'Maestro', id: 'maestro', ranges: [[5018, 5018], [5020, 5020], [5038, 5038], [5893, 5893], [6304, 6304], [6759, 6759], [6761, 6763]], lengths: [12, 13, 14, 15, 16, 17, 18, 19], groups: [4, 4, 4, 4, 3], cvc: 3 },
    { name: 'Mir', id: 'mir', ranges: [[2200, 2204]], lengths: [16, 17, 18, 19], groups: [4, 4, 4, 4, 3], cvc: 3 }
  ];

  // The first digit is the Major Industry Identifier (ISO/IEC 7812).
  const INDUSTRY = {
    1: 'Airlines', 2: 'Airlines and financial', 3: 'Travel and entertainment', 4: 'Banking and financial',
    5: 'Banking and financial', 6: 'Merchandising and banking', 7: 'Petroleum', 8: 'Healthcare and telecommunications',
    9: 'National assignment', 0: 'ISO/TC 68 and other industry'
  };

  function detect(digits) {
    let best = null;
    let bestLength = 0;
    for (const network of NETWORKS) {
      for (const [low, high] of network.ranges) {
        const size = String(low).length;
        if (digits.length < size) continue;
        const prefix = Number(digits.slice(0, size));
        if (prefix >= low && prefix <= high && size > bestLength) { best = network; bestLength = size; }
      }
    }
    return best;
  }

  // Luhn (mod 10): double every second digit from the right.
  function luhn(digits) {
    let sum = 0;
    for (let index = 0; index < digits.length; index += 1) {
      let digit = Number(digits[digits.length - 1 - index]);
      if (index % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
      sum += digit;
    }
    return sum % 10 === 0;
  }

  // The check digit that would make the number pass.
  function expectedCheckDigit(digits) {
    const body = digits.slice(0, -1);
    for (let digit = 0; digit <= 9; digit += 1) if (luhn(body + digit)) return String(digit);
    return '';
  }

  function group(digits, groups) {
    const parts = [];
    let at = 0;
    for (const size of groups) {
      if (at >= digits.length) break;
      parts.push(digits.slice(at, at + size));
      at += size;
    }
    if (at < digits.length) parts.push(digits.slice(at));
    return parts.join(' ');
  }

  function expiryState(text) {
    const match = text.trim().match(/^(\d{1,2})\s*[/-]\s*(\d{2}|\d{4})$/);
    if (!match) return text.trim() ? 'invalid' : 'empty';
    const month = Number(match[1]);
    if (month < 1 || month > 12) return 'invalid';
    const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
    const now = new Date();
    // A card is valid through the last day of its expiry month.
    return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1) ? 'valid' : 'expired';
  }

  function item(ok, text) {
    const li = document.createElement('li');
    li.className = ok ? 'cc-check cc-check--ok' : 'cc-check cc-check--bad';
    li.textContent = `${ok ? '✓' : '✕'} ${t(text)}`;
    return li;
  }

  function fact(label, value) {
    const dt = document.createElement('dt');
    dt.textContent = t(label);
    const dd = document.createElement('dd');
    dd.textContent = value;
    dd.dataset.i18nSkip = '';
    return [dt, dd];
  }

  function render() {
    const raw = numberEl.value;
    const digits = raw.replace(/[\s-]/g, '');
    const checks = [];
    const facts = [];
    cardEl.className = 'cc-card';
    if (!digits) {
      networkEl.textContent = t('Enter a card number');
      formattedEl.textContent = '•••• •••• •••• ••••';
      checksEl.replaceChildren();
      factsEl.replaceChildren();
      noteEl.hidden = true;
      return;
    }
    if (!/^\d+$/.test(digits)) {
      noteEl.hidden = true;
      networkEl.textContent = t('Not a card number');
      formattedEl.textContent = raw.trim();
      checksEl.replaceChildren(item(false, 'Only digits, spaces and dashes belong in a card number.'));
      factsEl.replaceChildren();
      return;
    }
    const network = detect(digits);
    const lengthOk = network ? network.lengths.includes(digits.length) : digits.length >= 12 && digits.length <= 19;
    const luhnOk = luhn(digits);
    if (network) cardEl.classList.add(`cc-card--${network.id}`);
    networkEl.textContent = network ? network.name : t('Unknown network');
    formattedEl.textContent = group(digits, network ? network.groups : [4, 4, 4, 4, 3]);

    checks.push(item(Boolean(network), network ? `Network: ${network.name}` : 'The first digits match no known card network.'));
    checks.push(item(lengthOk, network
      ? `${digits.length} digits (${network.name} uses ${network.lengths.join(', ')})`
      : `${digits.length} digits (cards have 12 to 19)`));
    if (network && network.luhnOptional && !luhnOk) checks.push(item(true, 'Check digit: UnionPay numbers do not always use the Luhn check.'));
    else checks.push(item(luhnOk, luhnOk ? 'Check digit is correct (Luhn).' : `Check digit is wrong (Luhn): the last digit would be ${expectedCheckDigit(digits)}.`));

    const expiry = expiryState(expiryEl.value);
    if (expiry === 'valid') checks.push(item(true, 'Expiry date has not passed.'));
    if (expiry === 'expired') checks.push(item(false, 'Expiry date has passed.'));
    if (expiry === 'invalid') checks.push(item(false, 'Expiry date should be MM/YY.'));
    const cvc = cvcEl.value.trim();
    if (cvc) {
      const wanted = network ? network.cvc : 3;
      const ok = /^\d+$/.test(cvc) && cvc.length === wanted;
      checks.push(item(ok, `Security code: ${wanted} digits${network && network.id === 'amex' ? ', on the front of the card' : ''}.`));
    }

    const valid = Boolean(network) && lengthOk && (luhnOk || Boolean(network && network.luhnOptional));
    const verdict = document.createElement('li');
    verdict.className = valid ? 'cc-verdict cc-verdict--ok' : 'cc-verdict cc-verdict--bad';
    verdict.textContent = t(valid ? 'The number is well formed. That does not show that the card exists or works.' : 'This is not a valid card number.');
    checksEl.replaceChildren(verdict, ...checks);

    facts.push(fact('Industry (first digit)', `${digits[0]} — ${t(INDUSTRY[digits[0]])}`));
    if (digits.length >= 6) facts.push(fact('Issuer number (BIN, first 6 digits)', digits.slice(0, 6)));
    if (digits.length >= 8) facts.push(fact('Issuer number (8-digit BIN)', digits.slice(0, 8)));
    if (digits.length >= 8) facts.push(fact('Account number part', digits.slice(6, -1)));
    facts.push(fact('Check digit', digits.slice(-1)));
    if (network) facts.push(fact('Security code', `${network.cvc} ${t('digits')}`));
    factsEl.replaceChildren(...facts.flat());
    noteEl.hidden = !(network && network.id === 'troy');
    noteEl.textContent = noteEl.hidden ? '' : t('Troy is Türkiye’s national card network, run by the Interbank Card Center (BKM).');
  }

  [numberEl, expiryEl, cvcEl].forEach((field) => field.addEventListener('input', render));
  window.addEventListener('toolkit:languagechange', render);

  // Exposed for the tests.
  window.ToolkitCardValidator = Object.freeze({ detect: (digits) => detect(digits)?.name || null, luhn });
  render();
}());
