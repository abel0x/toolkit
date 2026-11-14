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

  function hexToRGB(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
    const n = parseInt(hex, 16);
    return isNaN(n) ? null : { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

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

  function update(hex) {
    const rgb = hexToRGB(hex);
    if (!rgb) return;
    const { r, g, b } = rgb;
    const hsl = rgbToHSL(r, g, b);
    swatch.style.background = hex;
    picker.value = hex;
    rgbOut.value = `rgb(${r}, ${g}, ${b})`;
    hslOut.value = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    const oklch = rgbToOKLCH(r, g, b);
    oklchOut.value = `oklch(${trim(oklch.l * 100, 1)}% ${trim(oklch.c, 3)} ${trim(oklch.h, 1)})`;
    const hwb = rgbToHWB(r, g, b);
    hwbOut.value = `hwb(${hwb.h} ${hwb.w}% ${hwb.b}%)`;
  }

  update('#6366f1');

  hexIn.addEventListener('input', () => {
    const v = hexIn.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) update(v);
  });

  picker.addEventListener('input', () => {
    hexIn.value = picker.value;
    update(picker.value);
  });

  copyHex.addEventListener('click', () => copyToClipboard(hexIn.value, 'HEX'));
  copyRGB.addEventListener('click', () => copyToClipboard(rgbOut.value, 'RGB'));
  copyHSL.addEventListener('click', () => copyToClipboard(hslOut.value, 'HSL'));
  copyOKLCH.addEventListener('click', () => copyToClipboard(oklchOut.value, 'OKLCH'));
  copyHWB.addEventListener('click', () => copyToClipboard(hwbOut.value, 'HWB'));
})();
