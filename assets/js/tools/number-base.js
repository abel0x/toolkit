(function initNumberBase() {
  'use strict';

  const binaryInput = document.getElementById('numBin');
  const octalInput = document.getElementById('numOct');
  const decimalInput = document.getElementById('numDec');
  const hexadecimalInput = document.getElementById('numHex');
  const customInput = document.getElementById('custInput');
  const customFrom = document.getElementById('custFrom');
  const customTo = document.getElementById('custTo');
  const customResult = document.getElementById('custResult');
  const errorEl = document.getElementById('numError');
  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const RULES = {
    2: 'Binary accepts the digits 0 and 1 only.',
    8: 'Octal accepts the digits 0 to 7 only.',
    10: 'Decimal accepts whole numbers only, without a decimal point.',
    16: 'Hexadecimal accepts the digits 0 to 9 and A to F only.'
  };
  // 0x, 0o and 0b prefixes are accepted in their own field.
  const PREFIX = { 2: /^0b/i, 8: /^0o/i, 16: /^0x/i };

  if (!binaryInput) return;

  const digits = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const standardInputs = [binaryInput, octalInput, decimalInput, hexadecimalInput];
  let updating = false;

  function parseInteger(value, base) {
    if (!Number.isInteger(base) || base < 2 || base > 36) {
      throw new Error('Invalid base.');
    }

    // Spaces and underscores group digits ("1111 0000", "1_000_000").
    let source = value.trim().replace(/[\s_]+/g, '');
    let negative = false;
    if (source.startsWith('-') || source.startsWith('+')) {
      negative = source[0] === '-';
      source = source.slice(1);
    }
    if (PREFIX[base]) source = source.replace(PREFIX[base], '');
    source = source.toLocaleUpperCase('en-US');
    if (!source) throw new Error('Invalid number.');

    let result = 0n;
    const bigBase = BigInt(base);
    for (const character of source) {
      const digit = digits.indexOf(character);
      if (digit < 0 || digit >= base) throw new Error('Invalid number.');
      result = result * bigBase + BigInt(digit);
    }
    return negative ? -result : result;
  }

  function formatInteger(value, base) {
    return value.toString(base).toLocaleUpperCase('en-US');
  }

  function markInvalid(element, invalid) {
    element.style.borderColor = invalid ? 'var(--red)' : '';
    element.setAttribute('aria-invalid', String(invalid));
  }

  function clearStandardValues() {
    standardInputs.forEach((element) => {
      element.value = '';
      markInvalid(element, false);
    });
  }

  function updateAll(value) {
    if (updating) return;
    updating = true;
    binaryInput.value = formatInteger(value, 2);
    octalInput.value = formatInteger(value, 8);
    decimalInput.value = formatInteger(value, 10);
    hexadecimalInput.value = formatInteger(value, 16);
    standardInputs.forEach((element) => markInvalid(element, false));
    updating = false;
  }

  function handleInput(element, base) {
    if (updating) return;
    const source = element.value.trim();
    if (!source) {
      updating = true;
      clearStandardValues();
      updating = false;
      errorEl.hidden = true;
      return;
    }
    try {
      updateAll(parseInteger(source, base));
      errorEl.hidden = true;
    } catch {
      // Never leave the previous number's conversions on screen.
      updating = true;
      standardInputs.forEach((other) => { if (other !== element) { other.value = ''; markInvalid(other, false); } });
      updating = false;
      markInvalid(element, true);
      errorEl.textContent = t(RULES[base]);
      errorEl.hidden = false;
    }
  }

  binaryInput.addEventListener('input', () => handleInput(binaryInput, 2));
  octalInput.addEventListener('input', () => handleInput(octalInput, 8));
  decimalInput.addEventListener('input', () => handleInput(decimalInput, 10));
  hexadecimalInput.addEventListener('input', () => handleInput(hexadecimalInput, 16));

  function updateCustom() {
    const from = Number(customFrom.value);
    const to = Number(customTo.value);
    if (!customInput.value.trim()) {
      customResult.textContent = '—';
      markInvalid(customInput, false);
      return;
    }
    try {
      const result = parseInteger(customInput.value, from);
      if (!Number.isInteger(to) || to < 2 || to > 36) throw new Error('Invalid base.');
      customResult.textContent = formatInteger(result, to);
      markInvalid(customInput, false);
    } catch {
      customResult.textContent = 'Invalid';
      markInvalid(customInput, true);
    }
  }

  [customInput, customFrom, customTo].forEach((element) => {
    element.addEventListener('input', updateCustom);
  });

  document.querySelectorAll('[data-copy-base]').forEach((button) => {
    button.addEventListener('click', () => {
      const inputs = { '2': binaryInput, '8': octalInput, '10': decimalInput, '16': hexadecimalInput };
      const field = inputs[button.dataset.copyBase];
      if (field && field.value) copyToClipboard(field.value, `Base ${button.dataset.copyBase}`);
    });
  });

  decimalInput.value = '255';
  handleInput(decimalInput, 10);
}());
