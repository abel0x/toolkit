/* TOOLKIT — assets/js/tools/case-converter.js */
(function initCaseConverter() {
  'use strict';

  const input = document.getElementById('caseInput');
  const grid = document.getElementById('caseGrid');
  if (!input || !grid) return;

  function uiLanguage() {
    if (!window.ToolkitI18n) return 'en';
    return window.ToolkitI18n.getLanguage() === 'tr' ? 'tr' : 'en';
  }

  function t(key) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key) : key;
  }

  function lower(value) {
    return value.normalize('NFC').toLocaleLowerCase(uiLanguage());
  }

  function upper(value) {
    return value.normalize('NFC').toLocaleUpperCase(uiLanguage());
  }

  function capitalise(value) {
    const characters = Array.from(value);
    if (!characters.length) return value;
    return upper(characters[0]) + characters.slice(1).join('');
  }

  function words(value) {
    return value.normalize('NFC').trim().split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
  }

  function titleCase(value) {
    return lower(value).replace(/\p{L}[\p{L}\p{M}\p{N}'’]*/gu, (word) => capitalise(word));
  }

  function sentenceCase(value) {
    const normalised = lower(value);
    let capitaliseNext = true;
    return Array.from(normalised).map((character) => {
      if (capitaliseNext && /\p{L}/u.test(character)) {
        capitaliseNext = false;
        return upper(character);
      }
      if (/[.!?]/u.test(character)) capitaliseNext = true;
      return character;
    }).join('');
  }

  function camelCase(value, pascal) {
    return words(value).map((word, index) => {
      const normalised = lower(word);
      return pascal || index > 0 ? capitalise(normalised) : normalised;
    }).join('');
  }

  const cases = [
    { label: 'UPPERCASE', convert: upper },
    { label: 'lowercase', convert: lower },
    { label: 'Title Case', convert: titleCase },
    { label: 'Sentence case', convert: sentenceCase },
    { label: 'camelCase', convert: (value) => camelCase(value, false) },
    { label: 'PascalCase', convert: (value) => camelCase(value, true) },
    { label: 'snake_case', convert: (value) => words(value).map(lower).join('_') },
    { label: 'kebab-case', convert: (value) => words(value).map(lower).join('-') }
  ];

  function copyIcon() {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('width', '13');
    svg.setAttribute('height', '13');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('aria-hidden', 'true');

    const rectangle = document.createElementNS(namespace, 'rect');
    rectangle.setAttribute('x', '9');
    rectangle.setAttribute('y', '9');
    rectangle.setAttribute('width', '13');
    rectangle.setAttribute('height', '13');
    rectangle.setAttribute('rx', '2');

    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
    svg.append(rectangle, path);
    return svg;
  }

  function buildGrid(text) {
    grid.replaceChildren();
    if (!text.trim()) return;

    cases.forEach(({ label, convert }) => {
      const result = convert(text);
      const card = document.createElement('div');
      const header = document.createElement('div');
      const typeLabel = document.createElement('span');
      const copyButton = document.createElement('button');
      const value = document.createElement('div');

      card.className = 'case-card';
      header.className = 'case-card-header';
      typeLabel.className = 'case-type-label';
      typeLabel.textContent = t(label);

      copyButton.type = 'button';
      copyButton.className = 'icon-btn case-copy-btn';
      copyButton.setAttribute('aria-label', t('Copy'));
      copyButton.title = t('Copy');
      copyButton.appendChild(copyIcon());
      copyButton.addEventListener('click', () => copyToClipboard(result, label));

      value.className = 'case-value';
      value.dataset.i18nSkip = '';
      value.textContent = result;

      header.append(typeLabel, copyButton);
      card.append(header, value);
      grid.appendChild(card);
    });
  }

  input.addEventListener('input', () => buildGrid(input.value));
  window.addEventListener('toolkit:languagechange', () => buildGrid(input.value));
}());
