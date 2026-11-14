/* TOOLKIT — assets/js/tools/color-converter.js */
(function initColorConverter() {
  const swatch  = document.getElementById('colorSwatch');
  const picker  = document.getElementById('colorPicker');
  const hexIn   = document.getElementById('colorHex');
  const rgbOut  = document.getElementById('colorRGB');
  const hslOut  = document.getElementById('colorHSL');
  const copyHex = document.getElementById('copyHex');
  const copyRGB = document.getElementById('copyRGB');
  const copyHSL = document.getElementById('copyHSL');
  const oklchOut = document.getElementById('colorOKLCH');
  const hwbOut   = document.getElementById('colorHWB');
  const copyOKLCH = document.getElementById('copyOKLCH');
  const copyHWB   = document.getElementById('copyHWB');
  if (!swatch) return;

  const errorEl = document.getElementById('colorError');
  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  // A number, or a percentage of `full`.
  function amount(text, full) {
    const match = String(text).trim().match(/^([-+]?(?:\d+\.?\d*|\.\d+))(%?)$/);
    if (!match) return NaN;
    return match[2] ? (Number(match[1]) / 100) * full : Number(match[1]);
  }

  function hslToRGB(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
  }

  /* #rgb, #rgba, #rrggbb, #rrggbbaa (with or without #), rgb()/rgba() and
     hsl()/hsla() in comma or space syntax, and anything else the browser
     knows as a colour (names such as rebeccapurple). Returns {r, g, b, a}. */
  function parseColor(input) {
    const text = input.trim().toLowerCase();
    const hex = text.match(/^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/);
    if (hex) {
      let digits = hex[1];
      if (digits.length <= 4) digits = digits.split('').map((c) => c + c).join('');
      const value = (index) => parseInt(digits.slice(index, index + 2), 16);
      return { r: value(0), g: value(2), b: value(4), a: digits.length === 8 ? Math.round((value(6) / 255) * 1000) / 1000 : 1 };
    }
    const fn = text.match(/^(rgba?|hsla?)\(\s*([^)]*)\)$/);
    if (fn) {
      const parts = fn[2].split(/\s*[,/]\s*|\s+/).filter(Boolean);
      if (parts.length < 3 || parts.length > 4) return null;
      const alpha = parts[3] === undefined ? 1 : amount(parts[3], 1);
      if (!(alpha >= 0 && alpha <= 1)) return null;
      if (fn[1].startsWith('rgb')) {
        const [r, g, b] = parts.slice(0, 3).map((part) => amount(part, 255));
        if ([r, g, b].some((value) => !Number.isFinite(value))) return null;
        return { r: Math.round(clamp(r, 0, 255)), g: Math.round(clamp(g, 0, 255)), b: Math.round(clamp(b, 0, 255)), a: alpha };
      }
      const hue = Number(parts[0].replace(/deg$/, ''));
      const sat = amount(parts[1], 100);
      const light = amount(parts[2], 100);
      if (![hue, sat, light].every(Number.isFinite)) return null;
      return { ...hslToRGB(((hue % 360) + 360) % 360, clamp(sat, 0, 100), clamp(light, 0, 100)), a: alpha };
    }
    // Colour names and other syntaxes: let the browser read them.
    if (/^[a-z]+$/.test(text) || /^[a-z]+\(/.test(text)) {
      const context = document.createElement('canvas').getContext('2d');
      if (!context) return null;
      context.fillStyle = '#010203';
      context.fillStyle = text;
      const normalised = context.fillStyle;
      if (normalised === '#010203' && text !== '#010203') return null;
      if (normalised !== text) return parseColor(normalised);
    }
    return null;
  }

  const hexByte = (value) => Math.round(value).toString(16).padStart(2, '0');

  function rgbToHSL(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max+min)/2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g-b)/d + (g<b?6:0)) / 6; break;
        case g: h = ((b-r)/d + 2) / 6; break;
        case b: h = ((r-g)/d + 4) / 6; break;
      }
    }
    return { h: Math.round(h*360), s: Math.round(s*100), l: Math.round(l*100) };
  }

  // OKLCH (CSS Color 4) through OKLab, after Björn Ottosson: linear sRGB →
  // LMS → cube root → Lab, then chroma and hue. Chroma under 0.0005 is grey
  // and has no meaningful hue, written 0.
  function rgbToOKLCH(r, g, b) {
    const linear = [r, g, b].map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const [lr, lg, lb] = linear;
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    const C = Math.hypot(A, B);
    let H = C < 0.0005 ? 0 : (Math.atan2(B, A) * 180) / Math.PI;
    if (H < 0) H += 360;
    return { l: L, c: C < 0.0005 ? 0 : C, h: H };
  }

  // HWB: the HSL hue, whiteness = the smallest channel, blackness = 1 − the largest.
  function rgbToHWB(r, g, b) {
    return { h: rgbToHSL(r, g, b).h, w: Math.round((Math.min(r, g, b) / 255) * 100), b: Math.round((1 - Math.max(r, g, b) / 255) * 100) };
  }

  const trim = (value, digits) => String(Number(value.toFixed(digits)));

  function update(color) {
    const { r, g, b, a } = color;
    const hsl = rgbToHSL(r, g, b);
    const opaque = a >= 1;
    const hex = `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
    const alpha = trim(a, 3);
    swatch.style.background = opaque ? hex : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    picker.value = hex;
    rgbOut.value = opaque ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    hslOut.value = opaque ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${alpha})`;
    const oklch = rgbToOKLCH(r, g, b);
    oklchOut.value = `oklch(${trim(oklch.l * 100, 1)}% ${trim(oklch.c, 3)} ${trim(oklch.h, 1)}${opaque ? '' : ` / ${alpha}`})`;
    const hwb = rgbToHWB(r, g, b);
    hwbOut.value = `hwb(${hwb.h} ${hwb.w}% ${hwb.b}%${opaque ? '' : ` / ${alpha}`})`;
    return opaque ? hex : hex + hexByte(a * 255);
  }

  update(parseColor('#6366f1'));

  function readInput(normalise) {
    const value = hexIn.value.trim();
    if (!value) { errorEl.hidden = true; return; }
    const color = parseColor(value);
    if (!color) {
      errorEl.textContent = t('Not a colour Toolkit can read. Try #rrggbb, #rgb, rgb(), hsl() or a CSS colour name.');
      errorEl.hidden = false;
      hexIn.setAttribute('aria-invalid', 'true');
      return;
    }
    errorEl.hidden = true;
    hexIn.removeAttribute('aria-invalid');
    const hex = update(color);
    // On leaving the field, show what was typed as HEX.
    if (normalise) hexIn.value = hex;
  }

  hexIn.addEventListener('input', () => readInput(false));
  hexIn.addEventListener('change', () => readInput(true));

  picker.addEventListener('input', () => {
    hexIn.value = picker.value;
    errorEl.hidden = true;
    update(parseColor(picker.value));
  });

  copyHex.addEventListener('click', () => copyToClipboard(hexIn.value, 'HEX'));
  copyRGB.addEventListener('click', () => copyToClipboard(rgbOut.value, 'RGB'));
  copyHSL.addEventListener('click', () => copyToClipboard(hslOut.value, 'HSL'));
  copyOKLCH.addEventListener('click', () => copyToClipboard(oklchOut.value, 'OKLCH'));
  copyHWB.addEventListener('click', () => copyToClipboard(hwbOut.value, 'HWB'));
})();
