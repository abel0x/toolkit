/* TOOLKIT — assets/js/tools/pdf-page-editor.js
   One PDF: pick pages, rotate them, delete them, change their order, then
   save the result, extract the picked pages, or split the file into
   several PDFs (every page, every N pages, or by ranges) in one ZIP.
   Uses the self-hosted pdf-lib; the file never leaves the browser. */
(function initPdfPageEditor() {
  'use strict';

  const field = (id) => document.getElementById(id);
  const dropEl = field('peDrop');
  const fileEl = field('peFile');
  const editorEl = field('peEditor');
  const gridEl = field('pePages');
  if (!dropEl || !gridEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const formatBytes = (bytes) => (bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`);

  class PageRangeError extends Error {}

  function parseRanges(text, count) {
    const source = text.trim().toLowerCase();
    if (!source || source === 'all') return Array.from({ length: count }, (_, index) => index);
    const pages = [];
    for (const part of source.split(/[,;]+/).map((item) => item.trim()).filter(Boolean)) {
      const match = part.match(/^(\d*)\s*-\s*(\d*)$|^(\d+)$/);
      if (!match) throw new PageRangeError(`“${part}” is not a page or a range like 2-5.`);
      let from;
      let to;
      if (match[3]) { from = Number(match[3]); to = from; } else {
        from = match[1] ? Number(match[1]) : 1;
        to = match[2] ? Number(match[2]) : count;
      }
      if (from < 1 || to > count || from > to) throw new PageRangeError(`Pages ${part} are outside 1–${count}.`);
      for (let page = from; page <= to; page += 1) pages.push(page - 1);
    }
    return pages;
  }

  // Common paper sizes in points (1/72 inch), either way round.
  const PAPER = [['A3', 841.89, 1190.55], ['A4', 595.28, 841.89], ['A5', 419.53, 595.28], ['Letter', 612, 792], ['Legal', 612, 1008]];
  function paperName(width, height) {
    const [short, long] = width < height ? [width, height] : [height, width];
    const found = PAPER.find(([, w, h]) => Math.abs(w - short) < 3 && Math.abs(h - long) < 3);
    const mm = (points) => Math.round((points / 72) * 25.4);
    return found ? found[0] : `${mm(width)} × ${mm(height)} mm`;
  }

  let file = null;
  let doc = null;
  // One entry per page in its current place: { index, rotate, deleted, size: [w, h], baseRotation }
  let pages = [];
  const selected = new Set();

  async function load(input) {
    if (!input) return;
    if (!/pdf$/i.test(input.type) && !/\.pdf$/i.test(input.name)) { showToast(t('Choose a PDF file.'), 'error'); return; }
    try {
      doc = await PDFLib.PDFDocument.load(new Uint8Array(await input.arrayBuffer()));
    } catch (error) {
      showToast(/encrypt/i.test(error.message) ? t('This PDF is password-protected, so its pages cannot be edited here.') : t('This is not a PDF this tool can read.'), 'error');
      return;
    }
    file = input;
    pages = doc.getPages().map((page, index) => ({ index, rotate: 0, deleted: false, size: [page.getWidth(), page.getHeight()], baseRotation: page.getRotation().angle }));
    selected.clear();
    editorEl.hidden = false;
    field('peSource').textContent = `${input.name} · ${pages.length} ${t(pages.length === 1 ? 'page' : 'pages')} · ${formatBytes(input.size)}`;
    field('peResult').textContent = '';
    render();
  }

  function render() {
    gridEl.replaceChildren(...pages.map((page, position) => {
      const tile = document.createElement('div');
      tile.className = `pe-tile${selected.has(position) ? ' pe-tile--selected' : ''}${page.deleted ? ' pe-tile--deleted' : ''}`;
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'pe-pick';
      pick.setAttribute('aria-pressed', String(selected.has(position)));
      const turn = (page.baseRotation + page.rotate) % 180 !== 0;
      const [width, height] = turn ? [page.size[1], page.size[0]] : page.size;
      const sheet = document.createElement('span');
      sheet.className = 'pe-sheet';
      // The sheet keeps the page's proportions (and shows a turn) without loading its content.
      const box = 92;
      const factor = box / Math.max(width, height);
      sheet.style.width = `${Math.round(width * factor)}px`;
      sheet.style.height = `${Math.round(height * factor)}px`;
      sheet.textContent = String(page.index + 1);
      const label = document.createElement('span');
      label.className = 'pe-label';
      label.textContent = page.deleted ? t('Deleted') : `${paperName(width, height)}${page.rotate ? ` · ${page.rotate}°` : ''}`;
      pick.append(sheet, label);
      pick.setAttribute('aria-label', `${t('Page')} ${page.index + 1}${page.deleted ? `, ${t('deleted')}` : ''}`);
      pick.addEventListener('click', (event) => {
        if (event.shiftKey && selected.size) {
          const last = Math.max(...selected);
          for (let index = Math.min(last, position); index <= Math.max(last, position); index += 1) selected.add(index);
        } else if (selected.has(position)) selected.delete(position); else selected.add(position);
        render();
      });
      const moves = document.createElement('span');
      moves.className = 'pe-moves';
      const move = (label, title, delta) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-btn pe-move';
        button.textContent = label;
        button.title = title;
        button.setAttribute('aria-label', `${title}: ${t('page')} ${page.index + 1}`);
        button.disabled = position + delta < 0 || position + delta >= pages.length;
        button.addEventListener('click', () => {
          [pages[position], pages[position + delta]] = [pages[position + delta], pages[position]];
          const a = selected.has(position);
          const b = selected.has(position + delta);
          selected.delete(position); selected.delete(position + delta);
          if (a) selected.add(position + delta);
          if (b) selected.add(position);
          render();
        });
        return button;
      };
      moves.append(move('←', t('Move earlier'), -1), move('→', t('Move later'), 1));
      tile.append(pick, moves);
      tile.dataset.i18nSkip = '';
      return tile;
    }));
    const kept = pages.filter((page) => !page.deleted).length;
    field('peStatus').textContent = t(`${selected.size} selected · ${kept} of ${pages.length} pages kept`);
    ['peRotateLeft', 'peRotateRight', 'peDelete', 'peRestore', 'peExtract'].forEach((id) => { field(id).disabled = !selected.size; });
  }

  const targets = () => [...selected].sort((a, b) => a - b);

  // A new PDF from page entries, with their rotations added to the page's own.
  async function build(list) {
    const out = await PDFLib.PDFDocument.create();
    const copied = await out.copyPages(doc, list.map((page) => page.index));
    copied.forEach((page, index) => {
      const entry = list[index];
      if (entry.rotate) page.setRotation(PDFLib.degrees((entry.baseRotation + entry.rotate + 360) % 360));
      out.addPage(page);
    });
    const title = doc.getTitle();
    if (title) out.setTitle(title);
    out.setProducer('Toolkit PDF Page Editor (pdf-lib)');
    return out.save();
  }

  function save(bytes, name, type = 'application/pdf') {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const base = () => file.name.replace(/\.pdf$/i, '') || 'document';

  async function run(task) {
    try {
      await task();
    } catch (error) {
      showToast(t(error.message), 'error');
    }
  }

  // Split into groups of page entries.
  function groups() {
    const kept = pages.filter((page) => !page.deleted);
    const mode = field('peSplitMode').value;
    if (mode === 'each') return kept.map((page) => [page]);
    if (mode === 'every') {
      const size = Math.max(1, Math.floor(Number(field('peSplitEvery').value) || 1));
      const out = [];
      for (let index = 0; index < kept.length; index += size) out.push(kept.slice(index, index + size));
      return out;
    }
    // Ranges refer to the page numbers of the original file.
    return field('peSplitRanges').value.split(/[;,]+/).map((part) => part.trim()).filter(Boolean).map((part) => {
      const indexes = parseRanges(part, doc.getPageCount());
      return indexes.map((index) => pages.find((page) => page.index === index)).filter((page) => page && !page.deleted);
    }).filter((group) => group.length);
  }

  const label = (group) => {
    const first = group[0].index + 1;
    const last = group[group.length - 1].index + 1;
    return first === last ? `${first}` : `${first}-${last}`;
  };

  // Exposed actions, so the tests can check the bytes without a download.
  const actions = {
    async edited() {
      const kept = pages.filter((page) => !page.deleted);
      if (!kept.length) throw new Error('Every page is deleted; keep at least one.');
      return build(kept);
    },
    async extract() {
      const list = targets().map((position) => pages[position]);
      if (!list.length) throw new Error('Pick pages first.');
      return build(list);
    },
    async split() {
      const parts = groups();
      if (!parts.length) throw new Error('There are no pages to split.');
      const files = [];
      for (const group of parts) files.push({ name: `${base()}-${label(group)}.pdf`, data: await build(group) });
      return files;
    }
  };

  field('peSaveEdited').addEventListener('click', () => run(async () => {
    const bytes = await actions.edited();
    save(bytes, `${base()}-edited.pdf`);
    field('peResult').textContent = t(`Saved ${base()}-edited.pdf: ${formatBytes(bytes.length)}.`);
  }));
  field('peExtract').addEventListener('click', () => run(async () => {
    const bytes = await actions.extract();
    save(bytes, `${base()}-pages.pdf`);
    field('peResult').textContent = t(`Saved ${base()}-pages.pdf: ${formatBytes(bytes.length)}.`);
  }));
  field('peSplit').addEventListener('click', () => run(async () => {
    const files = await actions.split();
    if (files.length === 1) save(files[0].data, files[0].name);
    else save(window.ToolkitZip.zip(files), `${base()}-split.zip`, 'application/zip');
    field('peResult').textContent = t(`Saved ${files.length} PDF files.`);
  }));

  field('peRotateLeft').addEventListener('click', () => { targets().forEach((position) => { pages[position].rotate = (pages[position].rotate + 270) % 360; }); render(); });
  field('peRotateRight').addEventListener('click', () => { targets().forEach((position) => { pages[position].rotate = (pages[position].rotate + 90) % 360; }); render(); });
  field('peDelete').addEventListener('click', () => { targets().forEach((position) => { pages[position].deleted = true; }); selected.clear(); render(); });
  field('peRestore').addEventListener('click', () => { targets().forEach((position) => { pages[position].deleted = false; }); render(); });
  field('peSelectAll').addEventListener('click', () => { pages.forEach((_, position) => selected.add(position)); render(); });
  field('peSelectNone').addEventListener('click', () => { selected.clear(); render(); });
  field('peSelectRange').addEventListener('click', () => {
    try {
      const wanted = new Set(parseRanges(field('peRange').value, doc.getPageCount()));
      selected.clear();
      pages.forEach((page, position) => { if (wanted.has(page.index)) selected.add(position); });
      render();
    } catch (error) {
      showToast(t(error.message), 'error');
    }
  });
  field('peSplitMode').addEventListener('change', () => {
    field('peEveryRow').hidden = field('peSplitMode').value !== 'every';
    field('peRangesRow').hidden = field('peSplitMode').value !== 'ranges';
  });

  dropEl.addEventListener('click', () => fileEl.click());
  dropEl.addEventListener('dragover', (event) => { event.preventDefault(); dropEl.classList.add('drag-over'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-over'));
  dropEl.addEventListener('drop', (event) => { event.preventDefault(); dropEl.classList.remove('drag-over'); load(event.dataTransfer.files[0]); });
  fileEl.addEventListener('change', () => { load(fileEl.files[0]); fileEl.value = ''; });
  window.addEventListener('toolkit:languagechange', () => { if (doc) render(); });

  // Exposed for the tests.
  window.ToolkitPdfPageEditor = Object.freeze({ parseRanges, paperName, actions, state: () => pages.map((page) => ({ ...page })) });
}());
