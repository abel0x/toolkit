/* TOOLKIT — assets/js/tools/qr-generator.js
   Live QR codes for text, links, contacts, events, places and Wi-Fi.
   One module-unit geometry draws both the PNG (canvas) and the SVG, and
   every code is decoded again with jsQR before it is offered for download. */
(function initQRGenerator() {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const modeSelect = $('qrMode');
  if (!modeSelect) return;

  const form = $('qrForm');
  const sizeSlider = $('qrSize');
  const sizeValue = $('qrSizeVal');
  const marginSlider = $('qrMargin');
  const marginValue = $('qrMarginVal');
  const darkColour = $('qrColorDark');
  const lightColour = $('qrColorLight');
  const correctionSelect = $('qrECC');
  const dotSelect = $('qrDots');
  const cornerSelect = $('qrCorners');
  const logoInput = $('qrLogoInput');
  const logoName = $('qrLogoName');
  const logoRemove = $('qrLogoRemove');
  const logoSize = $('qrLogoSize');
  const logoSizeValue = $('qrLogoSizeVal');
  const logoSizeRow = $('qrLogoSizeRow');
  const logoNote = $('qrLogoNote');
  const generateButton = $('qrGenBtn');
  const clearButton = $('qrClearBtn');
  const output = $('qrOutput');
  const canvasWrapper = $('qrCanvasWrap');
  const placeholder = $('qrPlaceholder');
  const status = $('qrStatus');
  const check = $('qrCheck');
  const warnings = $('qrWarnings');
  const capacityText = $('qrCapacity');
  const capacityFill = $('qrCapacityFill');
  const actions = $('qrActions');
  const downloadButton = $('qrDownloadBtn');
  const downloadSvgButton = $('qrDownloadSvgBtn');
  const copyImageButton = $('qrCopyImgBtn');

  // The release version build.py puts on every asset link (see sw.js).
  const scriptUrl = new URL(document.currentScript.src);

  // Byte-mode capacity of versions 1–40 per error-correction level, from
  // ISO/IEC 18004. tests/qr-generator-e2e.mjs checks every value against
  // the QR library.
  const CAPACITY = Object.freeze({
    L: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 321, 367, 425, 458, 520, 586, 644, 718, 792, 858, 929, 1003, 1091, 1171, 1273, 1367, 1465, 1528, 1628, 1732, 1840, 1952, 2068, 2188, 2303, 2431, 2563, 2699, 2809, 2953],
    M: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412, 450, 504, 560, 624, 666, 711, 779, 857, 911, 997, 1059, 1125, 1190, 1264, 1370, 1452, 1538, 1628, 1722, 1809, 1911, 1989, 2099, 2213, 2331],
    Q: [11, 20, 32, 46, 60, 74, 86, 108, 130, 151, 177, 203, 241, 258, 292, 322, 364, 394, 442, 482, 509, 565, 611, 661, 715, 751, 805, 868, 908, 982, 1030, 1112, 1168, 1228, 1283, 1351, 1423, 1499, 1579, 1663],
    H: [7, 14, 24, 34, 44, 58, 64, 84, 98, 119, 137, 155, 177, 194, 220, 250, 280, 310, 338, 382, 403, 439, 461, 511, 535, 593, 625, 658, 698, 742, 790, 842, 898, 958, 983, 1051, 1093, 1139, 1219, 1273]
  });
  const DENSE_VERSION = 15;
  const MAX_LOGO_BYTES = 5 * 1024 * 1024;

  function t(key, values) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key, values)
      : key.replace(/{{(\w+)}}/g, (_, name) => String(values?.[name] ?? ''));
  }

  const number = (value) => new Intl.NumberFormat(document.documentElement.lang || 'en').format(value);

  function toast(message, type) {
    if (typeof window.showToast === 'function') window.showToast(message, type);
  }

  /* ── Content forms ─────────────────────────────────────── */

  const group = (id, label, control) =>
    `<div class="qr-form-group"><label for="${id}" class="control-label">${label}</label>${control}</div>`;
  const input = (id, type, placeholder, extra = '') =>
    `<input id="${id}" class="input-field" type="${type}" placeholder="${placeholder}"${extra} />`;
  const textarea = (id, rows, placeholder) =>
    `<textarea id="${id}" class="textarea" rows="${rows}" placeholder="${placeholder}"></textarea>`;
  const checkbox = (id, label) =>
    `<div class="qr-form-group"><label class="checkbox-card ix-d87841" for="${id}"><input type="checkbox" id="${id}"><span class="checkbox-indicator"></span><span class="checkbox-text">${label}</span></label></div>`;

  const forms = {
    text: group('qrText', 'Text Content', textarea('qrText', 4, 'Enter any text…')),
    url: group('qrURL', 'URL', input('qrURL', 'url', 'https://example.com'))
      + '<p class="qr-note">A link without http:// or https:// gets https:// added.</p>',
    email: group('qrEmail', 'Email Address', input('qrEmail', 'email', 'hello@example.com'))
      + group('qrEmailSub', 'Subject (optional)', input('qrEmailSub', 'text', 'Hello from Toolkit'))
      + group('qrEmailBody', 'Body (optional)', textarea('qrEmailBody', 3, 'Message body…')),
    phone: group('qrPhone', 'Phone Number', input('qrPhone', 'tel', '+1234567890')),
    sms: group('qrSMSPhone', 'Phone Number', input('qrSMSPhone', 'tel', '+1234567890'))
      + group('qrSMSMsg', 'Message', textarea('qrSMSMsg', 3, 'Your message…')),
    wifi: group('qrWifiSSID', 'Network Name (SSID)', input('qrWifiSSID', 'text', 'MyNetwork'))
      + '<div class="qr-form-group"><label for="qrWifiPass" class="control-label">Password</label>'
      + '<div class="qr-inline"><input id="qrWifiPass" class="input-field" type="password" placeholder="Password" autocomplete="off" />'
      + '<button type="button" class="btn btn--ghost btn--sm" id="qrWifiPassToggle" aria-controls="qrWifiPass" aria-pressed="false">Show</button></div></div>'
      + group('qrWifiSec', 'Security', '<select id="qrWifiSec" class="select-field"><option value="WPA">WPA/WPA2</option>'
        + '<option value="SAE">WPA3 (SAE)</option><option value="WEP">WEP</option><option value="nopass">Open (No Password)</option></select>')
      + checkbox('qrWifiHidden', 'Hidden network'),
    vcard: '<div class="qr-form-grid">'
      + group('qrVcFirst', 'First name', input('qrVcFirst', 'text', 'Ada', ' autocomplete="off"'))
      + group('qrVcLast', 'Last name', input('qrVcLast', 'text', 'Lovelace', ' autocomplete="off"'))
      + group('qrVcOrg', 'Organization', input('qrVcOrg', 'text', 'Analytical Engines Ltd.'))
      + group('qrVcTitle', 'Job title', input('qrVcTitle', 'text', 'Programmer'))
      + group('qrVcPhone', 'Phone Number', input('qrVcPhone', 'tel', '+1234567890'))
      + group('qrVcEmail', 'Email Address', input('qrVcEmail', 'email', 'hello@example.com'))
      + group('qrVcUrl', 'Website', input('qrVcUrl', 'url', 'https://example.com'))
      + group('qrVcAddress', 'Address', input('qrVcAddress', 'text', '12 Example Street, London'))
      + '</div>',
    event: group('qrEvTitle', 'Event title', input('qrEvTitle', 'text', 'Team meeting'))
      + '<div class="qr-form-grid">'
      + group('qrEvStart', 'Starts', input('qrEvStart', 'datetime-local', ''))
      + group('qrEvEnd', 'Ends (optional)', input('qrEvEnd', 'datetime-local', ''))
      + '</div>'
      + checkbox('qrEvAllDay', 'All-day event')
      + group('qrEvLocation', 'Location (optional)', input('qrEvLocation', 'text', 'Room 4'))
      + group('qrEvDesc', 'Description (optional)', textarea('qrEvDesc', 3, 'Agenda, notes…')),
    geo: '<div class="qr-form-grid">'
      + group('qrGeoLat', 'Latitude', input('qrGeoLat', 'number', '41.0082', ' step="any" min="-90" max="90" inputmode="decimal"'))
      + group('qrGeoLng', 'Longitude', input('qrGeoLng', 'number', '28.9784', ' step="any" min="-180" max="180" inputmode="decimal"'))
      + '</div><p class="qr-note">Phones open the point in their map app.</p>'
  };

  function renderForm(mode) {
    form.innerHTML = forms[mode] || '';
    if (window.ToolkitI18n) window.ToolkitI18n.apply(form);
  }

  function field(id, preserveWhitespace) {
    const value = $(id)?.value || '';
    return preserveWhitespace ? value : value.trim();
  }

  const checked = (id) => Boolean($(id)?.checked);
  // RFC 6068: a line break in a mailto field is %0D%0A, and a space is %20, never "+".
  const mailtoPart = (value) => encodeURIComponent(value.replace(/\r?\n/g, '\r\n'));
  // Wi-Fi QR fields escape \ ; , : and " with a backslash.
  const wifiEscape = (value) => value.replace(/([\\;,:"])/g, '\\$1');
  // vCard 3.0 and iCalendar TEXT values escape \ ; , and line breaks.
  const textEscape = (value) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');

  const compactDate = (value) => value.slice(0, 10).replace(/-/g, '');
  const compactDateTime = (value) => `${compactDate(value)}T${value.slice(11, 13)}${value.slice(14, 16)}00`;
  function nextDay(value) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + 1));
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  // Returns { content, name, problem }: the encoded text, a short name for
  // the download, and why nothing can be encoded yet (null when it is just empty).
  function buildContent() {
    const none = (problem = null) => ({ content: '', name: '', problem });
    switch (modeSelect.value) {
      case 'text': {
        const value = field('qrText', true);
        return value.trim() ? { content: value, name: value } : none();
      }
      case 'url': {
        const value = field('qrURL');
        if (!value) return none();
        const link = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
        let host = link;
        try { host = new URL(link).hostname || link; } catch { /* keep the raw text */ }
        return { content: link, name: host };
      }
      case 'email': {
        const email = field('qrEmail');
        if (!email) return none();
        const query = [];
        const subject = field('qrEmailSub', true);
        const body = field('qrEmailBody', true);
        if (subject) query.push(`subject=${mailtoPart(subject)}`);
        if (body) query.push(`body=${mailtoPart(body)}`);
        return { content: `mailto:${email}${query.length ? `?${query.join('&')}` : ''}`, name: email };
      }
      case 'phone': {
        const phone = field('qrPhone');
        return phone ? { content: `tel:${phone}`, name: phone } : none();
      }
      case 'sms': {
        const phone = field('qrSMSPhone');
        if (!phone) return none();
        const message = field('qrSMSMsg', true);
        return { content: `sms:${phone}${message ? `?body=${encodeURIComponent(message)}` : ''}`, name: `sms ${phone}` };
      }
      case 'wifi': {
        const ssid = field('qrWifiSSID', true);
        if (!ssid.trim()) return none();
        const security = field('qrWifiSec') || 'WPA';
        const password = field('qrWifiPass', true);
        if (security !== 'nopass' && !password) return none('Enter the Wi-Fi password, or choose an open network.');
        const secret = security === 'nopass' ? '' : `P:${wifiEscape(password)};`;
        const hidden = checked('qrWifiHidden') ? 'H:true;' : '';
        return { content: `WIFI:T:${security};S:${wifiEscape(ssid)};${secret}${hidden};`, name: `wifi ${ssid}` };
      }
      case 'vcard': {
        const first = field('qrVcFirst');
        const last = field('qrVcLast');
        const organization = field('qrVcOrg');
        if (!first && !last && !organization) return none();
        const fullName = [first, last].filter(Boolean).join(' ') || organization;
        const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${textEscape(last)};${textEscape(first)};;;`, `FN:${textEscape(fullName)}`];
        const optional = [
          ['ORG', organization], ['TITLE', field('qrVcTitle')], ['TEL;TYPE=CELL', field('qrVcPhone')],
          ['EMAIL', field('qrVcEmail')], ['URL', field('qrVcUrl')]
        ];
        optional.forEach(([key, value]) => { if (value) lines.push(`${key}:${textEscape(value)}`); });
        const address = field('qrVcAddress');
        if (address) lines.push(`ADR:;;${textEscape(address)};;;;`);
        lines.push('END:VCARD');
        return { content: lines.join('\r\n'), name: `contact ${fullName}` };
      }
      case 'event': {
        const title = field('qrEvTitle');
        const start = field('qrEvStart');
        const end = field('qrEvEnd');
        if (!title && !start) return none();
        if (!title) return none('Give the event a title.');
        if (!start) return none('Choose when the event starts.');
        const allDay = checked('qrEvAllDay');
        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `SUMMARY:${textEscape(title)}`];
        if (allDay) {
          if (end && end.slice(0, 10) < start.slice(0, 10)) return none('The event cannot end before it starts.');
          lines.push(`DTSTART;VALUE=DATE:${compactDate(start)}`, `DTEND;VALUE=DATE:${nextDay(end || start)}`);
        } else {
          if (end && end <= start) return none('The event must end after it starts.');
          lines.push(`DTSTART:${compactDateTime(start)}`);
          if (end) lines.push(`DTEND:${compactDateTime(end)}`);
        }
        const location = field('qrEvLocation');
        const description = field('qrEvDesc', true).trim();
        if (location) lines.push(`LOCATION:${textEscape(location)}`);
        if (description) lines.push(`DESCRIPTION:${textEscape(description)}`);
        lines.push('END:VEVENT', 'END:VCALENDAR');
        return { content: lines.join('\r\n'), name: `event ${title}` };
      }
      case 'geo': {
        const latitudeText = field('qrGeoLat');
        const longitudeText = field('qrGeoLng');
        if (!latitudeText && !longitudeText) return none();
        const latitude = Number(latitudeText);
        const longitude = Number(longitudeText);
        if (!latitudeText || !Number.isFinite(latitude) || Math.abs(latitude) > 90) return none('Latitude must be a number from -90 to 90.');
        if (!longitudeText || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return none('Longitude must be a number from -180 to 180.');
        return { content: `geo:${latitude},${longitude}`, name: `location ${latitude} ${longitude}` };
      }
      default:
        return none();
    }
  }

  // "Café İstanbul!" → "cafe-istanbul"; Turkish ı and İ become i.
  function slug(text) {
    const value = String(text).toLowerCase().replace(/ı/g, 'i').normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
      .replace(/-+$/, '');
    return value || 'code';
  }

  /* ── Geometry: shared by canvas and SVG, in module units ──── */

  function makeCode(content, level) {
    if (typeof window.qrcode !== 'function') throw new Error('QR library not loaded yet — please try again');
    const code = window.qrcode(0, level);
    code.addData(content, 'Byte');
    code.make();
    return code;
  }

  const finderOrigins = (count) => [[0, 0], [0, count - 7], [count - 7, 0]];
  const inFinder = (row, column, count) =>
    (row < 7 && (column < 7 || column >= count - 7)) || (row >= count - 7 && column < 7);

  // Centres of the 5×5 alignment patterns (ISO/IEC 18004 Annex E), the same
  // rows and columns for every version; tests/qr-generator-e2e.mjs checks
  // them against the library's matrices for versions 2–40.
  function alignmentCentres(count) {
    const version = (count - 17) / 4;
    if (version < 2) return [];
    const total = Math.floor(version / 7) + 2;
    const step = version === 32 ? 26 : Math.floor((version * 4 + total * 2 + 1) / (total * 2 - 2)) * 2;
    const positions = [6];
    for (let index = 0, position = count - 7; index < total - 1; index++, position -= step) positions.splice(1, 0, position);
    const centres = [];
    for (const row of positions) {
      for (const column of positions) {
        const nearFinder = (row === 6 && (column === 6 || column === count - 7)) || (row === count - 7 && column === 6);
        if (!nearFinder) centres.push([row, column]);
      }
    }
    return centres;
  }

  function roundedRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    return `M${x + r} ${y}h${width - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${height - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}`
      + `h${-(width - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(height - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
  }

  // Path data for the finder patterns (always solid shapes, whatever the dot
  // style, so scanners can lock on) and for the remaining dark modules.
  function shapes(code, design) {
    const count = code.getModuleCount();
    const offset = design.margin;
    // Round dots break up the alignment patterns, and some decoders (jsQR
    // among them) then miss them at large sizes; keep those solid too.
    const solidAlignment = design.dots === 'round' ? alignmentCentres(count) : [];
    const inAlignment = (row, column) => solidAlignment.some(([centreRow, centreColumn]) =>
      Math.abs(row - centreRow) <= 2 && Math.abs(column - centreColumn) <= 2);
    let finders = '';
    for (const [row, column] of finderOrigins(count)) {
      const x = column + offset;
      const y = row + offset;
      finders += design.corners === 'rounded'
        ? roundedRect(x, y, 7, 7, 2) + roundedRect(x + 1, y + 1, 5, 5, 1.25) + roundedRect(x + 2, y + 2, 3, 3, 1)
        : `M${x} ${y}h7v7h-7zM${x + 1} ${y + 1}h5v5h-5zM${x + 2} ${y + 2}h3v3h-3z`;
    }
    for (const [row, column] of solidAlignment) {
      const x = column - 2 + offset;
      const y = row - 2 + offset;
      finders += design.corners === 'rounded'
        ? roundedRect(x, y, 5, 5, 1.5) + roundedRect(x + 1, y + 1, 3, 3, 0.75) + roundedRect(x + 2, y + 2, 1, 1, 0.5)
        : `M${x} ${y}h5v5h-5zM${x + 1} ${y + 1}h3v3h-3zM${x + 2} ${y + 2}h1v1h-1z`;
    }
    let modules = '';
    for (let row = 0; row < count; row++) {
      for (let column = 0; column < count; column++) {
        if (!code.isDark(row, column) || inFinder(row, column, count) || inAlignment(row, column)) continue;
        if (design.dots === 'round') {
          modules += `M${column + offset} ${row + offset + 0.5}a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0z`;
        } else {
          let end = column;
          while (end + 1 < count && code.isDark(row, end + 1) && !inFinder(row, end + 1, count)) end++;
          modules += `M${column + offset} ${row + offset}h${end - column + 1}v1h${-(end - column + 1)}z`;
          column = end;
        }
      }
    }
    return { count, total: count + offset * 2, finders, modules };
  }

  // The logo sits on a background-coloured pad in the middle of the code, at
  // 14–20% of its width. Measured with jsQR, ZBar and ZXing over every style
  // and 23 scales: ZXing and jsQR read all sizes, while ZBar fails from about
  // 22% and mistakes a small dark logo (10–12%) for a finder pattern.
  function logoBox(count, design) {
    if (!design.logo) return null;
    const side = count * design.logoScale;
    const x = design.margin + (count - side) / 2;
    return { x, y: x, side, pad: { x: x - 0.5, y: x - 0.5, side: side + 1 } };
  }

  const padPath = ({ x, y, side }) => roundedRect(x, y, side, side, 1);

  function containedImage(box, image) {
    const ratio = image.naturalWidth / image.naturalHeight || 1;
    const width = ratio >= 1 ? box.side : box.side * ratio;
    const height = ratio >= 1 ? box.side / ratio : box.side;
    return { x: box.x + (box.side - width) / 2, y: box.y + (box.side - height) / 2, width, height };
  }

  function drawCanvas(code, design, size) {
    const geometry = shapes(code, design);
    const scale = size / geometry.total;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = design.background;
    context.fillRect(0, 0, size, size);
    context.fillStyle = design.foreground;
    const square = design.dots === 'square' && design.corners === 'square';
    if (square) {
      // Snap square modules to whole pixels so neighbours never show seams.
      const count = geometry.count;
      const edge = (units) => Math.round(units * scale);
      for (let row = 0; row < count; row++) {
        for (let column = 0; column < count; column++) {
          if (!code.isDark(row, column)) continue;
          const x = column + design.margin;
          const y = row + design.margin;
          context.fillRect(edge(x), edge(y), edge(x + 1) - edge(x), edge(y + 1) - edge(y));
        }
      }
    } else {
      context.save();
      context.scale(scale, scale);
      context.fill(new Path2D(geometry.modules));
      context.fill(new Path2D(geometry.finders), 'evenodd');
      context.restore();
    }
    const box = logoBox(geometry.count, design);
    if (box) {
      context.save();
      context.scale(scale, scale);
      context.fillStyle = design.background;
      context.fill(new Path2D(padPath(box.pad)));
      const fit = containedImage(box, design.logo.image);
      context.drawImage(design.logo.image, fit.x, fit.y, fit.width, fit.height);
      context.restore();
    }
    return canvas;
  }

  const attribute = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function buildSvg(code, design, size) {
    const geometry = shapes(code, design);
    const square = design.dots === 'square' && design.corners === 'square';
    const parts = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${geometry.total} ${geometry.total}"${square ? ' shape-rendering="crispEdges"' : ''}>`,
      `<rect width="${geometry.total}" height="${geometry.total}" fill="${attribute(design.background)}"/>`,
      `<path fill="${attribute(design.foreground)}" d="${geometry.modules}"/>`,
      `<path fill="${attribute(design.foreground)}" fill-rule="evenodd" d="${geometry.finders}"/>`
    ];
    const box = logoBox(geometry.count, design);
    if (box) {
      const fit = containedImage(box, design.logo.image);
      parts.push(`<path fill="${attribute(design.background)}" d="${padPath(box.pad)}"/>`);
      parts.push(`<image href="${attribute(design.logo.dataUrl)}" x="${fit.x}" y="${fit.y}" width="${fit.width}" height="${fit.height}" preserveAspectRatio="xMidYMid meet"/>`);
    }
    parts.push('</svg>', '');
    return parts.join('\n');
  }

  /* ── Readability ───────────────────────────────────────── */

  function luminance(hex) {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
      .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrastRatio(first, second) {
    const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (light + 0.05) / (dark + 0.05);
  }

  let decoder = null;
  function loadDecoder() {
    if (typeof window.jsQR === 'function') return Promise.resolve(window.jsQR);
    if (!decoder) {
      decoder = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        const url = new URL('../vendor/jsQR.min.js', scriptUrl);
        const version = scriptUrl.searchParams.get('v');
        if (version) url.searchParams.set('v', version);
        script.src = url.href;
        script.onload = () => resolve(window.jsQR);
        script.onerror = () => { decoder = null; reject(new Error('jsQR unavailable')); };
        document.head.appendChild(script);
      });
    }
    return decoder;
  }

  // Decode the image that will be downloaded, the way a phone sees a
  // dark-on-light code: no colour inversion, and a large image scaled down
  // to camera-like resolution first.
  async function readsBack(canvas, content) {
    const jsQR = await loadDecoder();
    let source = canvas;
    if (canvas.width > 1024) {
      source = document.createElement('canvas');
      source.width = 1024;
      source.height = 1024;
      const context = source.getContext('2d');
      context.imageSmoothingQuality = 'high';
      context.drawImage(canvas, 0, 0, 1024, 1024);
    }
    const image = source.getContext('2d').getImageData(0, 0, source.width, source.height);
    const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
    return result?.data === content;
  }

  /* ── Rendering ─────────────────────────────────────────── */

  let logo = null;
  let levelBeforeLogo = null;
  let current = null;
  let renderToken = 0;
  let renderTimer = 0;

  function design() {
    return {
      margin: Number.parseInt(marginSlider.value, 10),
      foreground: darkColour.value,
      background: lightColour.value,
      dots: dotSelect.value,
      corners: cornerSelect.value,
      logo,
      logoScale: Number.parseInt(logoSize.value, 10) / 100
    };
  }

  function setCheck(state, message) {
    check.dataset.state = state;
    check.textContent = message;
  }

  function showWarnings(list) {
    warnings.replaceChildren(...list.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
    warnings.hidden = list.length === 0;
  }

  function showEmpty(problem) {
    current = null;
    output.replaceChildren();
    canvasWrapper.classList.remove('qr-canvas-wrap--ready');
    placeholder.hidden = false;
    actions.hidden = true;
    status.hidden = !problem;
    if (problem) {
      setCheck('fail', t(problem));
      showWarnings([]);
      capacityText.textContent = '';
      capacityFill.style.setProperty('--fill', '0%');
    }
  }

  function render() {
    clearTimeout(renderTimer);
    const token = ++renderToken;
    const { content, name, problem } = buildContent();
    if (!content) {
      showEmpty(problem);
      return false;
    }
    const level = correctionSelect.value;
    const bytes = new TextEncoder().encode(content).length;
    const maximum = CAPACITY[level][39];
    let code;
    try {
      code = makeCode(content, level);
    } catch (error) {
      if (String(error).includes('overflow')) {
        showEmpty(null);
        status.hidden = false;
        setCheck('fail', t('Too long: {{bytes}} bytes. Level {{level}} holds at most {{max}}; shorten the content or lower error correction.',
          { bytes: number(bytes), level, max: number(maximum) }));
        showWarnings([]);
        capacityText.textContent = t('{{used}} / {{max}} bytes at level {{level}}', { used: number(bytes), max: number(maximum), level });
        capacityFill.style.setProperty('--fill', '100%');
        return false;
      }
      throw error;
    }
    const settings = design();
    const size = Number.parseInt(sizeSlider.value, 10);
    const canvas = drawCanvas(code, settings, size);
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', t('Generated QR code'));
    output.replaceChildren(canvas);
    canvasWrapper.classList.add('qr-canvas-wrap--ready');
    placeholder.hidden = true;
    actions.hidden = false;
    status.hidden = false;
    current = { code, design: settings, size, name, content };

    const count = code.getModuleCount();
    const version = (count - 17) / 4;
    capacityText.textContent = `${t('Version {{version}} · {{count}}×{{count}} modules', { version, count })} · `
      + t('{{used}} / {{max}} bytes at level {{level}}', { used: number(bytes), max: number(maximum), level });
    capacityFill.style.setProperty('--fill', `${Math.max(1, Math.round((bytes / maximum) * 100))}%`);

    const notes = [];
    const ratio = contrastRatio(settings.foreground, settings.background);
    if (luminance(settings.foreground) > luminance(settings.background)) {
      notes.push(t('Light code on a dark background: many scanners only read dark on light.'));
    }
    if (ratio < 4) notes.push(t('Low contrast ({{ratio}}:1). Aim for at least 4:1.', { ratio: ratio.toFixed(1) }));
    if (settings.margin < 2) notes.push(t('A margin under 2 modules can stop phones from finding the code.'));
    if (settings.logo && level !== 'H') notes.push(t('With a logo, use error correction H so the hidden part can be recovered.'));
    const modulePixels = size / (count + settings.margin * 2);
    // Under 3 px a module, decoders start to fail (jsQR misses version 40 at 2.8 px).
    if (modulePixels < 3) {
      notes.push(t('Each module is only {{pixels}} px at this size: raise the image size.', { pixels: modulePixels.toFixed(1) }));
    }
    if (version > DENSE_VERSION) notes.push(t('Dense code (version {{version}}): print it larger or shorten the content.', { version }));
    showWarnings(notes);
    setCheck('pending', t('Checking that it scans…'));

    readsBack(canvas, content).then((readable) => {
      if (token !== renderToken) return;
      if (!readable) setCheck('fail', t('Could not read this code back. Use dark on light, raise the contrast, widen the margin or shrink the logo.'));
      else if (notes.length) setCheck('warn', t('Reads back here, but see the notes below.'));
      else setCheck('ok', t('Scans correctly: decoded again from this image.'));
    }, () => {
      if (token === renderToken) setCheck('warn', t('The scan check could not start. Reload the page to try again.'));
    });
    return true;
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 150);
  }

  /* ── Logo ──────────────────────────────────────────────── */

  function setLogoName(text) {
    logoName.textContent = text;
  }

  function removeLogo(announce) {
    if (!logo) return;
    logo = null;
    logoInput.value = '';
    setLogoName(t('No logo'));
    logoRemove.hidden = true;
    logoNote.hidden = true;
    logoSizeRow.hidden = true;
    if (levelBeforeLogo && correctionSelect.value === 'H') correctionSelect.value = levelBeforeLogo;
    levelBeforeLogo = null;
    if (announce) scheduleRender();
  }

  logoInput.addEventListener('change', async () => {
    const file = logoInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast(t('Choose an image file for the logo.'), 'error');
      logoInput.value = '';
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast(t('The logo must be smaller than 5 MB.'), 'error');
      logoInput.value = '';
      return;
    }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      if (!logo) levelBeforeLogo = correctionSelect.value;
      logo = { image, dataUrl };
      correctionSelect.value = 'H';
      setLogoName(file.name);
      logoRemove.hidden = false;
      logoNote.hidden = false;
      logoSizeRow.hidden = false;
      render();
    } catch {
      toast(t('This image could not be opened.'), 'error');
      logoInput.value = '';
    }
  });

  logoRemove.addEventListener('click', () => removeLogo(true));

  /* ── Events ────────────────────────────────────────────── */

  modeSelect.addEventListener('change', () => {
    renderForm(modeSelect.value);
    render();
  });
  form.addEventListener('input', scheduleRender);
  form.addEventListener('change', (event) => {
    if (event.target.id === 'qrWifiSec') {
      const password = $('qrWifiPass');
      const open = event.target.value === 'nopass';
      password.disabled = open;
      $('qrWifiPassToggle').disabled = open;
    }
    scheduleRender();
  });
  form.addEventListener('click', (event) => {
    const toggle = event.target.closest('#qrWifiPassToggle');
    if (!toggle) return;
    const password = $('qrWifiPass');
    const shown = password.type === 'password';
    password.type = shown ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(shown));
    toggle.textContent = shown ? t('Hide') : t('Show');
  });

  sizeSlider.addEventListener('input', () => {
    sizeValue.textContent = `${sizeSlider.value}px`;
    scheduleRender();
  });
  marginSlider.addEventListener('input', () => {
    marginValue.textContent = marginSlider.value;
    scheduleRender();
  });
  logoSize.addEventListener('input', () => {
    logoSizeValue.textContent = `${logoSize.value}%`;
    scheduleRender();
  });
  [darkColour, lightColour].forEach((control) => control.addEventListener('input', scheduleRender));
  [correctionSelect, dotSelect, cornerSelect].forEach((control) => control.addEventListener('change', scheduleRender));

  generateButton.addEventListener('click', () => {
    const { content, problem } = buildContent();
    if (!content) {
      toast(t(problem || 'Please fill in the required fields'), 'error');
      render();
      return;
    }
    if (render()) toast(t('QR code generated!'), 'success');
  });

  clearButton.addEventListener('click', () => {
    removeLogo(false);
    modeSelect.value = 'text';
    renderForm('text');
    sizeSlider.value = sizeSlider.defaultValue;
    sizeValue.textContent = `${sizeSlider.value}px`;
    marginSlider.value = marginSlider.defaultValue;
    marginValue.textContent = marginSlider.value;
    darkColour.value = darkColour.defaultValue;
    lightColour.value = lightColour.defaultValue;
    correctionSelect.value = 'M';
    dotSelect.value = 'square';
    cornerSelect.value = 'square';
    logoSize.value = logoSize.defaultValue;
    logoSizeValue.textContent = `${logoSize.value}%`;
    render();
    toast(t('Cleared'), 'success');
  });

  function download(blob, extension) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = `qr-${slug(current.name)}.${extension}`;
    anchor.href = url;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t('Downloaded!'), 'success');
  }

  downloadButton.addEventListener('click', () => {
    const canvas = output.querySelector('canvas');
    if (!canvas || !current) {
      toast(t('No QR code to download'), 'error');
      return;
    }
    canvas.toBlob((blob) => blob && download(blob, 'png'), 'image/png');
  });

  downloadSvgButton.addEventListener('click', () => {
    if (!current) {
      toast(t('No QR code to download'), 'error');
      return;
    }
    download(new Blob([buildSvg(current.code, current.design, current.size)], { type: 'image/svg+xml' }), 'svg');
  });

  copyImageButton.addEventListener('click', () => {
    const canvas = output.querySelector('canvas');
    if (!canvas) {
      toast(t('No QR code to copy'), 'error');
      return;
    }
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast(t('Image copied!'), 'success');
      } catch {
        toast(t('Copy not supported in this browser'), 'error');
      }
    }, 'image/png');
  });

  // Exposed for the browser tests, which compare the exports with the preview.
  window.ToolkitQR = Object.freeze({
    svg: () => (current ? buildSvg(current.code, current.design, current.size) : ''),
    fileName: (extension) => (current ? `qr-${slug(current.name)}.${extension}` : ''),
    capacity: CAPACITY,
    alignmentCentres,
    slug
  });

  renderForm('text');
  setLogoName(t('No logo'));
  showEmpty(null);
}());
