(function initFaviconGenerator() {
  'use strict';

  const textEl    = document.getElementById('fgText');
  const bgColor   = document.getElementById('fgBg');
  const fgColor   = document.getElementById('fgFg');
  const fontSizeEl = document.getElementById('fgFontSize');
  const fontSizeVal = document.getElementById('fgFontSizeVal');
  const snippetEl = document.getElementById('fgSnippet');
  const SIZES = [16, 32, 48];

  if (!textEl) return;

  function draw() {
    const text = textEl.value || '?';
    const bg   = bgColor.value;
    const fg   = fgColor.value;
    const baseFontPct = parseInt(fontSizeEl.value) / 100;
    fontSizeVal.textContent = fontSizeEl.value + '%';

    SIZES.forEach(size => {
      const canvas = document.getElementById(`fgCanvas${size}`);
      if (!canvas) return;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = fg;
      const fontSize = Math.round(size * baseFontPct);
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(firstCharacters(text, 2), size / 2, size / 2 + 1);
    });

    updateSnippet();
  }

  // Whole characters: an emoji such as 🇹🇷 or 👍🏽 is never cut in half.
  function firstCharacters(text, count) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (part) => part.segment).slice(0, count).join('');
    }
    return Array.from(text).slice(0, count).join('');
  }

  // Links for the three files the Download buttons save, in the site root.
  function updateSnippet() {
    snippetEl.value = SIZES.map((size) => `<link rel="icon" type="image/png" sizes="${size}x${size}" href="/favicon-${size}.png" />`).join('\n');
  }

  SIZES.forEach(size => {
    const btn = document.getElementById(`fgDownload${size}`);
    if (btn) {
      btn.addEventListener('click', () => {
        const canvas = document.getElementById(`fgCanvas${size}`);
        canvas.toBlob(blob => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `favicon-${size}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
      });
    }
  });

  [textEl, bgColor, fgColor, fontSizeEl].forEach(el => el.addEventListener('input', draw));
  draw();
})();
