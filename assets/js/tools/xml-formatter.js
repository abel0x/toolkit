(function initXmlFormatter() {
  const inputEl = document.getElementById('xml-input');
  const outputEl = document.getElementById('xml-output');
  const formatBtn = document.getElementById('xml-format-btn');
  const minifyBtn = document.getElementById('xml-minify-btn');
  const copyBtn = document.getElementById('xml-copy');
  if (!inputEl) return;

  function indentXml(xml, indent) {
    const pad = ' '.repeat(indent);
    let result = '';
    let level = 0;
    // Comments, CDATA and processing instructions are single tokens even when they contain ">".
    const tokens = xml.replace(/>\s*</g, '><')
      .match(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[^>]+>|[^<]+/g) || [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const isOpening = token.startsWith('<') && !token.startsWith('</') && !token.startsWith('<?') && !token.startsWith('<!') && !token.endsWith('/>');
      // Keep an element that holds only text on one line so its text content is not changed.
      if (isOpening && tokens[index + 1] && !tokens[index + 1].startsWith('<') && tokens[index + 2]?.startsWith('</')) {
        result += pad.repeat(level) + token + tokens[index + 1] + tokens[index + 2] + '\n';
        index += 2;
      } else if (token.startsWith('</')) {
        level--;
        result += pad.repeat(level) + token + '\n';
      } else if (isOpening) {
        result += pad.repeat(level) + token + '\n';
        level++;
      } else if (token.startsWith('<')) {
        result += pad.repeat(level) + token + '\n';
      } else {
        const t = token.trim();
        if (t) result += pad.repeat(level) + t + '\n';
      }
    }
    return result.trim();
  }

  function format() {
    const raw = inputEl.value.trim();
    if (!raw) { showToast('Please enter XML.', 'error'); return; }
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(raw, 'application/xml');
      const err = doc.querySelector('parsererror');
      if (err) { showToast('XML parse error: ' + err.textContent.split('\n')[0], 'error'); return; }
      const serializer = new XMLSerializer();
      const str = serializer.serializeToString(doc);
      outputEl.value = indentXml(str, 2);
      showToast('XML formatted!', 'success');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  function minify() {
    const raw = inputEl.value.trim();
    if (!raw) { showToast('Please enter XML.', 'error'); return; }
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(raw, 'application/xml');
      const err = doc.querySelector('parsererror');
      if (err) { showToast('XML parse error: ' + err.textContent.split('\n')[0], 'error'); return; }
      const serializer = new XMLSerializer();
      outputEl.value = serializer.serializeToString(doc).replace(/>\s+</g, '><').trim();
      showToast('XML minified!', 'success');
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  formatBtn.addEventListener('click', format);
  minifyBtn.addEventListener('click', minify);
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'XML');
    else showToast('Nothing to copy.', 'error');
  });
})();
