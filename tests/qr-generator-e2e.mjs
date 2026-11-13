#!/usr/bin/env node
/* QR Code Generator: payload formats, readability and exports, checked
   several independent ways:
   1. the byte-capacity table (160 values) and the alignment-pattern
      positions (versions 2–40) against the QR library itself;
   2. every content type's payload against its standard format, decoded
      back from the rendered canvas with jsQR;
   3. every style, colour, logo and size variant, exported as PNG and SVG,
      decoded by jsQR in the browser and by ZBar (zbarimg) and, when
      installed, ZXing-C++ (ZXingReader) outside it; SVGs are rasterised by
      librsvg (rsvg-convert);
   4. the scan check and notes for codes that should not scan well;
   5. the Turkish page, download names, PNG size and the logo picker.
   Set TOOLKIT_SKIP_EXTERNAL_DECODERS=1 to run without zbarimg/rsvg-convert. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { withFirefox } from './browser-session.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wait = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));
const has = (command) => spawnSync('sh', ['-c', `command -v ${command}`]).status === 0;
const skipExternal = process.env.TOOLKIT_SKIP_EXTERNAL_DECODERS === '1';
const decoders = { zbar: has('zbarimg'), zxing: has('ZXingReader'), rsvg: has('rsvg-convert') };
if (!skipExternal) {
  assert(decoders.zbar && decoders.rsvg,
    'zbarimg and rsvg-convert are required (zbar-tools and librsvg2-bin), or set TOOLKIT_SKIP_EXTERNAL_DECODERS=1.');
}

/* ── 1. Capacity table against the library ─────────────────── */
const library = {};
vm.createContext(library);
vm.runInContext(`${readFileSync(join(root, 'assets/js/vendor/qrcode-generator.js'), 'utf8')}\nthis.qrcode = qrcode;`, library);
const moduleSource = readFileSync(join(root, 'assets/js/tools/qr-generator.js'), 'utf8');
const capacity = JSON.parse(moduleSource.match(/const CAPACITY = Object\.freeze\((\{[\s\S]*?\})\);/)[1]
  .replace(/([LMQH]):/g, '"$1":'));
const fits = (version, level, bytes) => {
  try {
    const code = library.qrcode(version, level);
    code.addData('a'.repeat(bytes), 'Byte');
    code.make();
    return true;
  } catch (error) {
    if (String(error).includes('overflow')) return false;
    throw error;
  }
};
for (const level of ['L', 'M', 'Q', 'H']) {
  assert.equal(capacity[level].length, 40, `Capacity table ${level} must list versions 1–40.`);
  capacity[level].forEach((bytes, index) => {
    const version = index + 1;
    assert(fits(version, level, bytes), `Version ${version}-${level} should hold ${bytes} bytes.`);
    assert(!fits(version, level, bytes + 1), `Version ${version}-${level} should not hold ${bytes + 1} bytes.`);
  });
}

// Round dots keep the alignment patterns solid, so their positions must be
// exactly where the library puts them.
const alignmentSource = moduleSource.match(/function alignmentCentres\(count\) \{[\s\S]*?\n  \}\n/)[0];
const alignmentCentres = new Function(`${alignmentSource}; return alignmentCentres;`)();
let alignmentPatterns = 0;
for (let version = 1; version <= 40; version++) {
  const code = library.qrcode(version, 'L');
  code.addData('a', 'Byte');
  code.make();
  const centres = alignmentCentres(code.getModuleCount());
  assert.equal(centres.length, version === 1 ? 0 : (Math.floor(version / 7) + 2) ** 2 - 3, `Version ${version}: wrong number of alignment patterns.`);
  for (const [row, column] of centres) {
    for (let dRow = -2; dRow <= 2; dRow++) {
      for (let dColumn = -2; dColumn <= 2; dColumn++) {
        const dark = Math.max(Math.abs(dRow), Math.abs(dColumn)) !== 1;
        assert.equal(code.isDark(row + dRow, column + dColumn), dark,
          `Version ${version}: no alignment pattern at (${row}, ${column}).`);
      }
    }
    alignmentPatterns += 1;
  }
}
assert.equal(alignmentPatterns, 799, 'Versions 2–40 have 799 alignment patterns.');

/* ── Browser helpers ───────────────────────────────────────── */
const work = mkdtempSync(join(tmpdir(), 'toolkit-qr-'));
if (process.env.TOOLKIT_KEEP_QR_FILES) console.log(`QR test files: ${work}`);
const externalChecks = [];

function decodeFile(path) {
  const results = {};
  if (decoders.zbar) {
    const zbar = spawnSync('zbarimg', ['--quiet', '--raw', '-Sbinary', path], { encoding: 'utf8' });
    results.zbar = zbar.status === 0 ? zbar.stdout : null;
  }
  if (decoders.zxing) {
    const zxing = spawnSync('ZXingReader', ['-formats', 'QRCode', '-bytes', path]);
    results.zxing = zxing.status === 0 && zxing.stdout.length ? zxing.stdout.toString('utf8') : null;
  }
  return results;
}

// Fill the form like a user, wait for the live preview and its scan check,
// then report what the page shows and what the canvas decodes to.
async function scenario(page, setup) {
  return page.evaluate(async (setup) => {
    const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
    const fire = (element, type) => element.dispatchEvent(new Event(type, { bubbles: true }));
    const mode = document.getElementById('qrMode');
    if (mode.value !== (setup.mode || 'text')) {
      mode.value = setup.mode || 'text';
      fire(mode, 'change');
    }
    for (const [id, value] of Object.entries(setup.options || {})) {
      const element = document.getElementById(id);
      element.value = value;
      fire(element, element.tagName === 'SELECT' ? 'change' : 'input');
    }
    for (const [id, value] of Object.entries(setup.checks || {})) {
      const element = document.getElementById(id);
      element.checked = value;
      fire(element, 'change');
    }
    for (const [id, value] of Object.entries(setup.fields || {})) {
      const element = document.getElementById(id);
      element.value = value;
      fire(element, element.tagName === 'SELECT' ? 'change' : 'input');
    }
    await sleep(250);
    const check = document.getElementById('qrCheck');
    for (let attempt = 0; attempt < 200 && check.dataset.state === 'pending'; attempt += 1) await sleep(25);
    const canvas = document.querySelector('#qrOutput canvas');
    let decoded = null;
    if (canvas && window.jsQR) {
      const image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      decoded = window.jsQR(image.data, image.width, image.height)?.data ?? null;
    }
    return {
      state: document.getElementById('qrStatus').hidden ? 'hidden' : check.dataset.state,
      check: check.textContent,
      notes: [...document.querySelectorAll('#qrWarnings li')].map((item) => item.textContent),
      capacity: document.getElementById('qrCapacity').textContent,
      decoded,
      width: canvas?.width ?? 0,
      png: setup.export && canvas ? canvas.toDataURL('image/png') : null,
      svg: setup.export ? window.ToolkitQR.svg() : null,
      fileName: window.ToolkitQR.fileName('png')
    };
  }, setup);
}

// The PNG and the SVG (rasterised at the same size) must read in every
// decoder. A camera sees the code at any scale, so the SVG is also drawn at
// five other sizes: ZXing must read them all; ZBar, which misses about 1% of
// logo renders at single scales (see qr-generator.js), may miss one.
function exportAndDecode(label, result, expected) {
  if (skipExternal) return;
  const base = join(work, label.replace(/[^a-z0-9]+/gi, '-'));
  writeFileSync(`${base}.png`, Buffer.from(result.png.split(',')[1], 'base64'));
  writeFileSync(`${base}.svg`, result.svg);
  const raster = (size) => {
    const file = `${base}-svg-${size}.png`;
    const run = spawnSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', file, `${base}.svg`]);
    assert.equal(run.status, 0, `${label}: rsvg-convert could not render the SVG: ${run.stderr}`);
    return file;
  };
  for (const [file, kind] of [[`${base}.png`, 'PNG'], [raster(result.width), 'SVG']]) {
    for (const [decoder, text] of Object.entries(decodeFile(file))) {
      assert.equal(text, expected, `${label}: ${decoder} read the ${kind} export as ${JSON.stringify(text)}.`);
      externalChecks.push(`${label} ${kind} ${decoder}`);
    }
  }
  const misses = { zbar: 0, zxing: 0 };
  for (const size of [400, 560, 720, 880, 1040]) {
    for (const [decoder, text] of Object.entries(decodeFile(raster(size)))) {
      if (text !== expected) misses[decoder] += 1;
      externalChecks.push(`${label} SVG@${size} ${decoder}`);
    }
  }
  assert.equal(misses.zxing, 0, `${label}: ZXing missed the SVG at ${misses.zxing} of 5 scales.`);
  assert(misses.zbar <= 1, `${label}: ZBar missed the SVG at ${misses.zbar} of 5 scales.`);
}

await withFirefox(async (page) => {
  await page.viewport(1280, 1000);
  const open = async (path) => {
    await page.navigate(path);
    await page.evaluate(() => localStorage.setItem('toolkit-language', 'en'));
    await page.navigate(path);
    await wait(150);
  };

  /* ── 2. Payload formats ───────────────────────────────────── */
  await open('/tools/qr-generator.html');
  const payloads = [
    ['text with Turkish and emoji', { mode: 'text', fields: { qrText: 'İstanbul çığ 🧪\nline two' } }, 'İstanbul çığ 🧪\nline two'],
    ['bare link gets https', { mode: 'url', fields: { qrURL: 'example.com/path?q=1' } }, 'https://example.com/path?q=1'],
    ['link keeps its scheme', { mode: 'url', fields: { qrURL: 'ftp://files.example.com/a' } }, 'ftp://files.example.com/a'],
    ['mailto spaces are %20', {
      mode: 'email', fields: { qrEmail: 'hi@example.com', qrEmailSub: 'Hello from Toolkit', qrEmailBody: 'Line 1\nLine 2 & more' }
    }, 'mailto:hi@example.com?subject=Hello%20from%20Toolkit&body=Line%201%0D%0ALine%202%20%26%20more'],
    ['mailto without fields', { mode: 'email', fields: { qrEmail: 'hi@example.com', qrEmailSub: '', qrEmailBody: '' } }, 'mailto:hi@example.com'],
    ['phone', { mode: 'phone', fields: { qrPhone: '+90 212 555 0101' } }, 'tel:+90 212 555 0101'],
    ['sms', { mode: 'sms', fields: { qrSMSPhone: '+15550101', qrSMSMsg: 'On my way & late' } }, 'sms:+15550101?body=On%20my%20way%20%26%20late'],
    ['wifi escapes and hidden', {
      mode: 'wifi', fields: { qrWifiSSID: 'Café;Net', qrWifiPass: 'p:a"s\\s,1', qrWifiSec: 'WPA' }, checks: { qrWifiHidden: true }
    }, 'WIFI:T:WPA;S:Café\\;Net;P:p\\:a\\"s\\\\s\\,1;H:true;;'],
    ['wifi WPA3', {
      mode: 'wifi', fields: { qrWifiSSID: 'Home', qrWifiPass: 'secret123', qrWifiSec: 'SAE' }, checks: { qrWifiHidden: false }
    }, 'WIFI:T:SAE;S:Home;P:secret123;;'],
    ['wifi open network drops the password', {
      mode: 'wifi', fields: { qrWifiSSID: 'Guest', qrWifiPass: 'ignored', qrWifiSec: 'nopass' }
    }, 'WIFI:T:nopass;S:Guest;;'],
    ['vCard escapes', {
      mode: 'vcard', fields: {
        qrVcFirst: 'Ada', qrVcLast: 'Lovelace', qrVcOrg: 'Engines, Ltd.', qrVcTitle: 'Programmer',
        qrVcPhone: '+44 20 7946 0000', qrVcEmail: 'ada@example.com', qrVcUrl: 'https://example.com', qrVcAddress: '12 Main St; Floor 2'
      }
    }, ['BEGIN:VCARD', 'VERSION:3.0', 'N:Lovelace;Ada;;;', 'FN:Ada Lovelace', 'ORG:Engines\\, Ltd.', 'TITLE:Programmer',
      'TEL;TYPE=CELL:+44 20 7946 0000', 'EMAIL:ada@example.com', 'URL:https://example.com', 'ADR:;;12 Main St\\; Floor 2;;;;', 'END:VCARD'].join('\r\n')],
    ['vCard with only an organization', {
      mode: 'vcard', fields: { qrVcFirst: '', qrVcLast: '', qrVcOrg: 'Toolkit', qrVcTitle: '', qrVcPhone: '', qrVcEmail: '', qrVcUrl: '', qrVcAddress: '' }
    }, ['BEGIN:VCARD', 'VERSION:3.0', 'N:;;;;', 'FN:Toolkit', 'ORG:Toolkit', 'END:VCARD'].join('\r\n')],
    ['timed event', {
      mode: 'event', fields: {
        qrEvTitle: 'Launch; party', qrEvStart: '2026-11-20T18:30', qrEvEnd: '2026-11-20T21:00', qrEvLocation: 'Room 4', qrEvDesc: 'Snacks\nand demos'
      }, checks: { qrEvAllDay: false }
    }, ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'SUMMARY:Launch\\; party', 'DTSTART:20261120T183000', 'DTEND:20261120T210000',
      'LOCATION:Room 4', 'DESCRIPTION:Snacks\\nand demos', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')],
    ['all-day event ends the next day, across a month', {
      mode: 'event', fields: { qrEvTitle: 'Holiday', qrEvStart: '2026-02-28T00:00', qrEvEnd: '', qrEvLocation: '', qrEvDesc: '' }, checks: { qrEvAllDay: true }
    }, ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'SUMMARY:Holiday', 'DTSTART;VALUE=DATE:20260228', 'DTEND;VALUE=DATE:20260301',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n')],
    ['all-day event over the year end', {
      mode: 'event', fields: { qrEvTitle: 'Break', qrEvStart: '2026-12-30T00:00', qrEvEnd: '2026-12-31T00:00' }, checks: { qrEvAllDay: true }
    }, ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'SUMMARY:Break', 'DTSTART;VALUE=DATE:20261230', 'DTEND;VALUE=DATE:20270101',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n')],
    ['location', { mode: 'geo', fields: { qrGeoLat: '41.0082', qrGeoLng: '-28.97840' } }, 'geo:41.0082,-28.9784']
  ];
  for (const [label, setup, expected] of payloads) {
    const result = await scenario(page, setup);
    assert.equal(result.decoded, expected, `${label}: the code decodes to ${JSON.stringify(result.decoded)}.`);
    assert.equal(result.state, 'ok', `${label}: the scan check says "${result.check}" (${result.notes.join(' | ')}).`);
  }

  // Inputs that cannot be encoded yet explain why instead of drawing a code.
  const problems = [
    ['Wi-Fi without a password', { mode: 'wifi', fields: { qrWifiSSID: 'Home', qrWifiPass: '', qrWifiSec: 'WPA' } }, 'Enter the Wi-Fi password'],
    ['event without a start', { mode: 'event', fields: { qrEvTitle: 'Party', qrEvStart: '', qrEvEnd: '' }, checks: { qrEvAllDay: false } }, 'Choose when the event starts'],
    ['event ending before it starts', {
      mode: 'event', fields: { qrEvTitle: 'Party', qrEvStart: '2026-11-20T18:00', qrEvEnd: '2026-11-20T17:00' }, checks: { qrEvAllDay: false }
    }, 'must end after it starts'],
    ['latitude out of range', { mode: 'geo', fields: { qrGeoLat: '91', qrGeoLng: '10' } }, 'Latitude must be'],
    ['longitude out of range', { mode: 'geo', fields: { qrGeoLat: '10', qrGeoLng: '181' } }, 'Longitude must be']
  ];
  for (const [label, setup, message] of problems) {
    const result = await scenario(page, setup);
    assert.equal(result.state, 'fail', `${label}: expected a failed state, got ${result.state}.`);
    assert(result.check.includes(message), `${label}: the status reads "${result.check}".`);
    assert.equal(result.width, 0, `${label}: no code should be drawn.`);
  }

  /* ── 3. Styles, colours, logos and sizes through three decoders ── */
  await open('/tools/qr-generator.html');
  // A drawn logo: a coloured tile with a letter, as a file through the real picker.
  const setLogo = (percent) => page.evaluate(async (percent) => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 80;
    const context = canvas.getContext('2d');
    context.fillStyle = '#e63946';
    context.fillRect(0, 0, 120, 80);
    context.fillStyle = '#fff';
    context.font = 'bold 60px sans-serif';
    context.fillText('T', 40, 62);
    const blob = await new Promise((done) => canvas.toBlob(done, 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'Brand Logo.png', { type: 'image/png' }));
    const input = document.getElementById('qrLogoInput');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    for (let attempt = 0; attempt < 100 && document.getElementById('qrLogoRemove').hidden; attempt += 1) {
      await new Promise((done) => setTimeout(done, 20));
    }
    const size = document.getElementById('qrLogoSize');
    size.value = String(percent);
    size.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      level: document.getElementById('qrECC').value,
      note: !document.getElementById('qrLogoNote').hidden,
      sizeRow: !document.getElementById('qrLogoSizeRow').hidden,
      name: document.getElementById('qrLogoName').textContent
    };
  }, percent);
  const removeLogo = () => page.evaluate(() => {
    document.getElementById('qrLogoRemove').click();
    return { level: document.getElementById('qrECC').value, sizeRow: !document.getElementById('qrLogoSizeRow').hidden };
  });

  const link = 'https://abel0x.github.io/toolkit/tools/qr-generator.html?utm_source=print';
  const reset = { qrSize: '512', qrMargin: '4', qrColorDark: '#000000', qrColorLight: '#ffffff', qrECC: 'M', qrDots: 'square', qrCorners: 'square' };
  const variants = [
    ['square defaults', {}],
    ['round dots', { qrDots: 'round' }],
    ['rounded corners', { qrCorners: 'rounded' }],
    ['round dots and rounded corners', { qrDots: 'round', qrCorners: 'rounded' }],
    ['brand colours', { qrColorDark: '#1d3557', qrColorLight: '#f1faee' }],
    ['level L, margin 2', { qrECC: 'L', qrMargin: '2' }],
    ['2048 px print size', { qrSize: '2048' }],
    ['odd size 704 px', { qrSize: '704', qrDots: 'round' }]
  ];
  for (const [label, options] of variants) {
    const result = await scenario(page, { mode: 'text', options: { ...reset, ...options }, fields: { qrText: link }, export: true });
    assert.equal(result.decoded, link, `${label}: jsQR read ${JSON.stringify(result.decoded)}.`);
    assert.equal(result.state, 'ok', `${label}: the scan check says "${result.check}" (${result.notes.join(' | ')}).`);
    assert.equal(result.width, Number(options.qrSize || reset.qrSize), `${label}: the PNG is not the chosen size.`);
    exportAndDecode(label, result, link);
  }

  // Every 128 px from 128 to 2048 in all four styles: full-size jsQR in the
  // page, and ZBar/ZXing on the exported PNG.
  let sweep = 0;
  for (const dots of ['square', 'round']) {
    for (const corners of ['square', 'rounded']) {
      for (let size = 128; size <= 2048; size += 128) {
        const label = `${dots} dots, ${corners} corners, ${size}px`;
        const result = await scenario(page, { mode: 'text', options: { ...reset, qrDots: dots, qrCorners: corners, qrSize: String(size) }, fields: { qrText: link }, export: true });
        assert.equal(result.decoded, link, `${label}: jsQR read ${JSON.stringify(result.decoded)}.`);
        // The link is version 5 with a margin of 4: 45 modules, so 128 px is 2.8 px a module.
        if (size / 45 < 3) {
          assert.equal(result.state, 'warn', `${label}: expected the module-size note, got "${result.check}".`);
          assert.deepEqual(result.notes, ['Each module is only 2.8 px at this size: raise the image size.'], `${label}: ${result.notes}`);
        } else {
          assert.equal(result.state, 'ok', `${label}: the scan check says "${result.check}" (${result.notes.join(' | ')}).`);
        }
        if (!skipExternal) {
          const file = join(work, `sweep-${dots}-${corners}-${size}.png`);
          writeFileSync(file, Buffer.from(result.png.split(',')[1], 'base64'));
          for (const [decoder, text] of Object.entries(decodeFile(file))) {
            assert.equal(text, link, `${label}: ${decoder} read ${JSON.stringify(text)}.`);
            externalChecks.push(`${label} ${decoder}`);
          }
        }
        sweep += 1;
      }
    }
  }
  assert.equal(sweep, 64);

  const logoLimit = await page.evaluate(() => {
    const slider = document.getElementById('qrLogoSize');
    return { min: slider.min, max: slider.max, value: slider.value };
  });
  assert.deepEqual(logoLimit, { min: '14', max: '20', value: '16' },
    'The logo must stay at 14–20% of the width, where all three decoders read it.');
  const logoInfo = await setLogo(20);
  assert.deepEqual(logoInfo, { level: 'H', note: true, sizeRow: true, name: 'Brand Logo.png' },
    'Choosing a logo must switch to level H, explain why and show the size control.');
  for (const [label, percent, options] of [
    ['logo 20%', 20, {}],
    ['logo 20% with round dots', 20, { qrDots: 'round', qrCorners: 'rounded' }],
    ['logo 14% in brand colours', 14, { qrColorDark: '#1d3557', qrColorLight: '#f1faee' }],
    ['logo 20% at 2048 px', 20, { qrSize: '2048', qrDots: 'round' }]
  ]) {
    await page.evaluate((percent) => {
      const size = document.getElementById('qrLogoSize');
      size.value = String(percent);
      size.dispatchEvent(new Event('input', { bubbles: true }));
    }, percent);
    const result = await scenario(page, { mode: 'text', options: { ...reset, qrECC: 'H', ...options }, fields: { qrText: link }, export: true });
    assert.equal(result.decoded, link, `${label}: jsQR read ${JSON.stringify(result.decoded)}.`);
    assert.equal(result.state, 'ok', `${label}: the scan check says "${result.check}".`);
    assert(result.svg.includes('<image href="data:image/png;base64,'), `${label}: the SVG does not embed the logo.`);
    exportAndDecode(label, result, link);
  }
  const lowered = await scenario(page, { mode: 'text', options: { ...reset, qrECC: 'L' }, fields: { qrText: link } });
  assert(lowered.notes.some((note) => note.includes('error correction H')), 'Lowering the level under a logo must warn.');
  assert.deepEqual(await removeLogo(), { level: 'L', sizeRow: false }, 'Removing the logo must keep a level the user chose and hide the size control.');
  await setLogo(20);
  assert.deepEqual(await removeLogo(), { level: 'L', sizeRow: false }, 'Removing the logo must restore the level from before the logo.');

  /* ── 4. Codes that should not scan well ───────────────────── */
  const readability = [
    ['inverted colours', { qrColorDark: '#ffffff', qrColorLight: '#000000' }, 'fail', 'Light code on a dark background'],
    ['low contrast', { qrColorDark: '#777777', qrColorLight: '#9a9a9a' }, null, 'Low contrast'],
    ['no margin', { qrMargin: '0' }, null, 'margin under 2 modules']
  ];
  for (const [label, options, state, note] of readability) {
    const result = await scenario(page, { mode: 'text', options: { ...reset, ...options }, fields: { qrText: link } });
    if (state) assert.equal(result.state, state, `${label}: expected ${state}, got ${result.state} ("${result.check}").`);
    else assert.notEqual(result.state, 'ok', `${label}: a risky code must not get a plain "scans correctly".`);
    assert(result.notes.some((text) => text.includes(note)), `${label}: missing the note "${note}" in ${JSON.stringify(result.notes)}.`);
  }
  const dense = await scenario(page, { mode: 'text', options: reset, fields: { qrText: 'x'.repeat(500) } });
  assert(dense.notes.some((text) => text.includes('Dense code (version 17)')), `A 500-byte code must be flagged as dense: ${dense.notes}`);
  assert(dense.capacity.includes('Version 17 · 85×85 modules') && dense.capacity.includes('500 / 2,331 bytes at level M'),
    `Unexpected capacity line: ${dense.capacity}`);
  const tooLong = await scenario(page, { mode: 'text', options: { ...reset, qrECC: 'H' }, fields: { qrText: 'x'.repeat(1274) } });
  assert.equal(tooLong.state, 'fail', 'Content over the level H limit must fail.');
  assert(tooLong.check.includes('1,274 bytes') && tooLong.check.includes('at most 1,273'), `Unexpected overflow message: ${tooLong.check}`);
  assert.equal(tooLong.width, 0, 'An overflowing code must not be drawn.');
  // Version 40 (185 modules with the margin) is 2.8 px a module at 512 px: too
  // small to read, and the page says why. At 2048 px it reads.
  const cramped = await scenario(page, { mode: 'text', options: { ...reset, qrECC: 'H' }, fields: { qrText: 'x'.repeat(1273) } });
  assert(cramped.capacity.startsWith('Version 40 · 177×177 modules'), `Unexpected capacity line: ${cramped.capacity}`);
  assert(cramped.notes.some((text) => text.includes('Each module is only 2.8 px')), `Missing the module-size note: ${cramped.notes}`);
  assert.notEqual(cramped.state, 'ok', 'A 2.8 px-per-module code must not be called readable.');
  const limit = await scenario(page, { mode: 'text', options: { ...reset, qrECC: 'H', qrSize: '2048' }, fields: { qrText: 'x'.repeat(1273) }, export: true });
  assert.equal(limit.decoded, 'x'.repeat(1273), 'The largest level H code (version 40) must read back at 2048 px.');
  assert.equal(limit.state, 'warn', `Version 40 should read but carry the dense-code note: ${limit.check}`);
  exportAndDecode('version 40 at 2048 px', limit, 'x'.repeat(1273));

  /* ── 5. Names, sizes, picker and Turkish page ─────────────── */
  const names = [
    [{ mode: 'wifi', fields: { qrWifiSSID: 'Café İstanbul', qrWifiPass: 'secret123', qrWifiSec: 'WPA' } }, 'qr-wifi-cafe-istanbul.png'],
    [{ mode: 'url', fields: { qrURL: 'https://www.example.com/a/b' } }, 'qr-www-example-com.png'],
    [{ mode: 'event', fields: { qrEvTitle: 'Yıl sonu partisi', qrEvStart: '2026-12-31T20:00', qrEvEnd: '' }, checks: { qrEvAllDay: false } }, 'qr-event-yil-sonu-partisi.png'],
    [{ mode: 'text', fields: { qrText: '!!!' } }, 'qr-code.png']
  ];
  for (const [setup, expected] of names) {
    const result = await scenario(page, { ...setup, options: reset });
    assert.equal(result.fileName, expected, `Download name for ${setup.mode}: ${result.fileName}`);
  }

  const download = await page.evaluate(async () => {
    const size = document.getElementById('qrSize');
    size.value = '1024';
    size.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((done) => setTimeout(done, 300));
    // Capture what the page hands to the download: the Blob and the file name.
    let captured = null;
    let blob = null;
    const originalClick = HTMLAnchorElement.prototype.click;
    const originalUrl = URL.createObjectURL;
    URL.createObjectURL = (value) => { blob = value; return originalUrl.call(URL, value); };
    HTMLAnchorElement.prototype.click = function capture() { captured = { name: this.download }; };
    document.getElementById('qrDownloadBtn').click();
    for (let attempt = 0; attempt < 100 && !captured; attempt += 1) await new Promise((done) => setTimeout(done, 20));
    const png = blob;
    const pngName = captured.name;
    const bitmap = await createImageBitmap(png);
    captured = null;
    document.getElementById('qrDownloadSvgBtn').click();
    const svg = await blob.text();
    HTMLAnchorElement.prototype.click = originalClick;
    URL.createObjectURL = originalUrl;
    return { pngType: png.type, pngName, width: bitmap.width, height: bitmap.height, svgName: captured.name, svgType: blob.type, svgStart: svg.slice(0, 60), svgSize: svg.match(/width="(\d+)"/)?.[1] };
  });
  assert.deepEqual(download, {
    pngType: 'image/png', pngName: 'qr-code.png', width: 1024, height: 1024, svgName: 'qr-code.svg', svgType: 'image/svg+xml',
    svgStart: '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://ww', svgSize: '1024'
  }, 'Downloads must be a PNG and an SVG of the chosen size.');

  const cleared = await page.evaluate(async () => {
    document.getElementById('qrClearBtn').click();
    await new Promise((done) => setTimeout(done, 50));
    return {
      mode: document.getElementById('qrMode').value,
      size: document.getElementById('qrSize').value,
      level: document.getElementById('qrECC').value,
      preview: document.querySelector('#qrOutput canvas') === null,
      status: document.getElementById('qrStatus').hidden,
      actions: document.getElementById('qrActions').hidden
    };
  });
  assert.deepEqual(cleared, { mode: 'text', size: '512', level: 'M', preview: true, status: true, actions: true }, 'Clear must reset everything.');

  await page.navigate('/tr/tools/qr-generator.html');
  await wait(150);
  const turkish = await scenario(page, { mode: 'vcard', fields: { qrVcFirst: 'Ayşe', qrVcLast: 'Yılmaz' } });
  assert.equal(turkish.decoded, 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Yılmaz;Ayşe;;;\r\nFN:Ayşe Yılmaz\r\nEND:VCARD');
  assert.equal(turkish.check, 'Doğru taranıyor: bu görüntüden yeniden çözüldü.', `Turkish status: ${turkish.check}`);
  assert(turkish.capacity.includes('modül') && turkish.capacity.includes('M seviyesinde') && turkish.capacity.includes('2.331'),
    `Turkish capacity line: ${turkish.capacity}`);
  const labels = await page.evaluate(() => [...document.querySelectorAll('#qrForm label')].map((label) => label.textContent.trim()));
  assert.deepEqual(labels.slice(0, 4), ['Ad', 'Soyad', 'Kurum', 'Unvan'], `Turkish contact labels: ${labels}`);
  const turkishOverflow = await scenario(page, { mode: 'text', options: { qrECC: 'H' }, fields: { qrText: 'x'.repeat(1300) } });
  assert(turkishOverflow.check.startsWith('Çok uzun: 1.300 bayt'), `Turkish overflow message: ${turkishOverflow.check}`);

  const errors = page.errors();
  assert.deepEqual(errors.map((event) => event.params?.text), [], 'The QR generator logged errors.');
});

if (!process.env.TOOLKIT_KEEP_QR_FILES) rmSync(work, { recursive: true, force: true });
else console.log(`QR test files kept in ${work}`);
const external = skipExternal ? 'external decoders skipped' : `${externalChecks.length} PNG/SVG decodes by ${Object.entries(decoders).filter(([name, ok]) => ok && name !== 'rsvg').map(([name]) => name).join(' and ')}`;
console.log(`QR generator E2E passed: 160 capacity values and 799 alignment patterns against the library, a 64-image size and style sweep, payload formats for every content type, style, colour, logo and size variants, readability notes, overflow, download names and sizes, and the Turkish page; ${external}.`);
