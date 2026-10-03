(function () {
  'use strict';

  function initWordCounter() {
    var input = document.getElementById('wc-input');
    if (!input) return;

    var elWords    = document.getElementById('wc-words');
    var elChars    = document.getElementById('wc-chars');
    var elCharsNS  = document.getElementById('wc-chars-ns');
    var elSent     = document.getElementById('wc-sentences');
    var elPara     = document.getElementById('wc-paragraphs');
    var elRead     = document.getElementById('wc-reading');
    var segmenter  = typeof Intl !== 'undefined' && Intl.Segmenter
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : null;

    function characters(value) {
      return segmenter
        ? Array.from(segmenter.segment(value)).length
        : Array.from(value).length;
    }

    function update() {
      var text = input.value;

      var words = text.trim() === '' ? 0 : text.trim().split(/\s+/).filter(Boolean).length;
      var chars = characters(text);
      var charsNS = characters(text.replace(/\s/gu, ''));
      var sentMatches = text.match(/[.!?]+/g);
      var sentences = sentMatches ? sentMatches.length : 0;
      var paraBlocks = text.split(/\n\s*\n/).filter(function (p) { return p.trim().length > 0; });
      var paragraphs = paraBlocks.length > 0 ? paraBlocks.length : (text.trim().length > 0 ? 1 : 0);
      var reading = Math.ceil(words / 200);

      if (elWords)   elWords.textContent   = words.toLocaleString();
      if (elChars)   elChars.textContent   = chars.toLocaleString();
      if (elCharsNS) elCharsNS.textContent = charsNS.toLocaleString();
      if (elSent)    elSent.textContent    = sentences.toLocaleString();
      if (elPara)    elPara.textContent    = paragraphs.toLocaleString();
      if (elRead)    elRead.textContent    = reading + ' min';
    }

    input.addEventListener('input', update);
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWordCounter);
  } else {
    initWordCounter();
  }
})();
