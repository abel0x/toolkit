(function () {
  'use strict';

  function initRandomColor() {
    var generateBtn = document.getElementById('rc-generate-btn');
    var copyAllBtn  = document.getElementById('rc-copy-all-btn');
    var gridEl      = document.getElementById('rc-grid');
    if (!generateBtn) return;

    var currentFormat = 'hex';
    var lastColors    = [];

    function hslToRgb(h, s, l) {
      s /= 100; l /= 100;
      var k = function (n) { return (n + h / 30) % 12; };
      var a = s * Math.min(l, 1 - l);
      var f = function (n) { return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); };
      return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
    }

    function rgbToHex(r, g, b) {
      return '#' + [r, g, b].map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    }

    function formatColor(h, s, l) {
      if (currentFormat === 'hsl') return 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
      var rgb = hslToRgb(h, s, l);
      if (currentFormat === 'rgb') return 'rgb(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ')';
      return rgbToHex(rgb[0], rgb[1], rgb[2]).toUpperCase();
    }

    function getInt(id) { return parseInt(document.getElementById(id).value, 10) || 0; }

    function generate() {
      var count = parseInt(document.getElementById('rc-count').value, 10) || 5;
      var hMin = getInt('rc-hmin'), hMax = getInt('rc-hmax');
      var sMin = getInt('rc-smin'), sMax = getInt('rc-smax');
      var lMin = getInt('rc-lmin'), lMax = getInt('rc-lmax');

      lastColors = [];
      for (var i = 0; i < count; i++) {
        var h = hMin + secureRandInt(Math.max(1, hMax - hMin + 1));
        var s = sMin + secureRandInt(Math.max(1, sMax - sMin + 1));
        var l = lMin + secureRandInt(Math.max(1, lMax - lMin + 1));
        lastColors.push({ h: h, s: s, l: l });
      }
      renderGrid();
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

    function renderGrid() {
      if (!gridEl) return;
      gridEl.innerHTML = '';
      gridEl.style.cssText = 'display:flex;flex-wrap:wrap;gap:.75rem;';
      lastColors.forEach(function (c) {
        var code = formatColor(c.h, c.s, c.l);
        var rgb  = hslToRgb(c.h, c.s, c.l);
        var hex  = rgbToHex(rgb[0], rgb[1], rgb[2]);
        var swatch = document.createElement('div');
        swatch.style.cssText = 'background:' + hex + ';border-radius:8px;padding:.75rem;min-width:100px;display:flex;flex-direction:column;align-items:center;gap:.4rem;flex:1;';
        var label = document.createElement('span');
        label.style.cssText = 'font-family:monospace;font-size:.7rem;color:' + readableOn(hex) + ';word-break:break-all;text-align:center;';
        label.textContent = code;
        swatch.appendChild(label);
        var btn = document.createElement('button');
        btn.textContent = 'Copy';
        btn.className = 'btn btn-secondary';
        btn.style.cssText = 'padding:.2rem .5rem;font-size:.65rem;';
        btn.addEventListener('click', function () { copyToClipboard(code, 'Color'); });
        swatch.appendChild(btn);
        gridEl.appendChild(swatch);
      });
    }

    ['rc-fmt-hex','rc-fmt-rgb','rc-fmt-hsl'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', function () {
        currentFormat = btn.dataset.fmt;
        ['rc-fmt-hex','rc-fmt-rgb','rc-fmt-hsl'].forEach(function (bid) {
          var b = document.getElementById(bid);
          if (b) { b.classList.remove('btn-primary'); b.classList.add('btn-secondary'); }
        });
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        renderGrid();
      });
    });

    generateBtn.addEventListener('click', generate);

    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', function () {
        var codes = lastColors.map(function (c) { return formatColor(c.h, c.s, c.l); });
        copyToClipboard(codes.join('\n'), 'Colors');
      });
    }

    generate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRandomColor);
  } else {
    initRandomColor();
  }
})();
