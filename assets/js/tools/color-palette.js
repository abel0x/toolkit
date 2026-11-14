(function () {
  'use strict';

  function initColorPalette() {
    var baseEl    = document.getElementById('cp-base');
    var schemesEl = document.getElementById('cp-schemes');
    var paletteEl = document.getElementById('cp-palette');
    var randomBtn = document.getElementById('cp-random-btn');
    if (!baseEl || !paletteEl) return;

    var activeScheme = 'complementary';

    function hexToHsl(hex) {
      var r = parseInt(hex.slice(1, 3), 16) / 255;
      var g = parseInt(hex.slice(3, 5), 16) / 255;
      var b = parseInt(hex.slice(5, 7), 16) / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var h, s, l = (max + min) / 2;
      if (max === min) { h = s = 0; }
      else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if      (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else                h = (r - g) / d + 4;
        h /= 6;
      }
      return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    }

    function hslToHex(h, s, l) {
      h /= 360; s /= 100; l /= 100;
      var r, g, b;
      if (s === 0) { r = g = b = l; }
      else {
        var hue2rgb = function (p, q, t) {
          if (t < 0) t += 1; if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return '#' + [r, g, b].map(function (x) {
        return Math.round(x * 255).toString(16).padStart(2, '0');
      }).join('');
    }

    function generateColors(hex, scheme) {
      var hsl = hexToHsl(hex);
      var h = hsl[0], s = hsl[1], l = hsl[2];
      var hues;
      if      (scheme === 'complementary')    hues = [h, (h + 180) % 360];
      else if (scheme === 'analogous')        hues = [(h + 330) % 360, (h + 345) % 360, h, (h + 15) % 360, (h + 30) % 360];
      else if (scheme === 'triadic')          hues = [h, (h + 120) % 360, (h + 240) % 360];
      else if (scheme === 'tetradic')         hues = [h, (h + 90) % 360, (h + 180) % 360, (h + 270) % 360];
      else if (scheme === 'monochromatic')    {
        return [20, 35, 50, 65, 80].map(function (lt) { return hslToHex(h, s, lt); });
      }
      return hues.map(function (hu) { return hslToHex(hu, s, l); });
    }

    // Black or white, whichever reads better on the swatch (WCAG contrast).
    function readableOn(hex) {
      var n = parseInt(hex.slice(1, 7), 16);
      var lin = [n >> 16, (n >> 8) & 255, n & 255].map(function (v) {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      var lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
      return (lum + 0.05) / 0.05 >= 1.05 / (lum + 0.05) ? '#000' : '#fff';
    }

    function renderPalette(colors) {
      paletteEl.innerHTML = '';
      colors.forEach(function (hex) {
        var swatch = document.createElement('div');
        swatch.style.cssText = 'background:' + hex + ';border-radius:8px;padding:1rem;display:flex;flex-direction:column;align-items:center;gap:.5rem;min-width:80px;cursor:pointer;';
        var label = document.createElement('span');
        label.style.cssText = 'font-family:monospace;font-size:.75rem;color:' + readableOn(hex) + ';';
        label.textContent = hex.toUpperCase();
        swatch.appendChild(label);
        var btn = document.createElement('button');
        btn.textContent = 'Copy';
        btn.className = 'btn btn-secondary';
        btn.style.cssText = 'padding:.2rem .6rem;font-size:.7rem;';
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          copyToClipboard(hex.toUpperCase(), 'Color');
        });
        swatch.appendChild(btn);
        swatch.addEventListener('click', function () {
          copyToClipboard(hex.toUpperCase(), 'Color');
        });
        paletteEl.appendChild(swatch);
      });
    }

    function update() {
      var colors = generateColors(baseEl.value, activeScheme);
      renderPalette(colors);
    }

    if (schemesEl) {
      schemesEl.querySelectorAll('[data-scheme]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          schemesEl.querySelectorAll('[data-scheme]').forEach(function (b) { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); });
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
          activeScheme = btn.dataset.scheme;
          update();
        });
      });
    }

    baseEl.addEventListener('input', update);

    if (randomBtn) {
      randomBtn.addEventListener('click', function () {
        var h = secureRandInt(360);
        var s = 50 + secureRandInt(51);
        var l = 40 + secureRandInt(26);
        baseEl.value = hslToHex(h, s, l);
        update();
      });
    }

    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initColorPalette);
  } else {
    initColorPalette();
  }
})();
