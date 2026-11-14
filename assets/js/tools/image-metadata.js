(function initImageMetadata() {
  'use strict';

  const dropZone  = document.getElementById('imDrop');
  const fileInput = document.getElementById('imFile');
  const preview   = document.getElementById('imPreview');
  const tableEl   = document.getElementById('imTable');
  const metaEl    = document.getElementById('imMeta');
  const actionsEl = document.getElementById('imActions');
  const stripBtn  = document.getElementById('imStrip');
  const stripNote = document.getElementById('imStripNote');
  const editEl = document.getElementById('imEdit');
  const field = (id) => document.getElementById(id);

  if (!dropZone) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  let current = null;
  let previewUrl = null;

  /* ── Reading ─────────────────────────────────────────────────
     Everything is read from the file's bytes in this page: EXIF (TIFF
     IFDs) from JPEG APP1, PNG eXIf and WebP EXIF chunks; XMP, IPTC, ICC
     and comments are reported as present. */

  const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

  function readTiff(bytes, start) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + start, bytes.length - start);
    const order = String.fromCharCode(view.getUint8(0), view.getUint8(1));
    if (order !== 'II' && order !== 'MM') return null;
    const little = order === 'II';
    if (view.getUint16(2, little) !== 42) return null;
    const tags = {};
    const seen = new Set();

    function value(type, count, offset) {
      const size = (TYPE_SIZE[type] || 1) * count;
      if (offset + size > view.byteLength) return undefined;
      if (type === 2) {
        let text = '';
        for (let i = 0; i < count; i += 1) { const code = view.getUint8(offset + i); if (!code) break; text += String.fromCharCode(code); }
        try { return decodeURIComponent(escape(text)).trim(); } catch { return text.trim(); }
      }
      const one = (index) => {
        const at = offset + index * TYPE_SIZE[type];
        if (type === 1 || type === 7) return view.getUint8(at);
        if (type === 3) return view.getUint16(at, little);
        if (type === 4) return view.getUint32(at, little);
        if (type === 9) return view.getInt32(at, little);
        if (type === 5) return view.getUint32(at, little) / (view.getUint32(at + 4, little) || 1);
        if (type === 10) return view.getInt32(at, little) / (view.getInt32(at + 4, little) || 1);
        return undefined;
      };
      if (!TYPE_SIZE[type]) return undefined;
      if (count === 1) return one(0);
      return Array.from({ length: Math.min(count, 64) }, (_, index) => one(index));
    }

    function ifd(offset, prefix) {
      if (!offset || seen.has(offset) || offset + 2 > view.byteLength) return;
      seen.add(offset);
      const entries = view.getUint16(offset, little);
      for (let index = 0; index < entries; index += 1) {
        const entry = offset + 2 + index * 12;
        if (entry + 12 > view.byteLength) break;
        const tag = view.getUint16(entry, little);
        const type = view.getUint16(entry + 2, little);
        const count = view.getUint32(entry + 4, little);
        const size = (TYPE_SIZE[type] || 1) * count;
        const at = size <= 4 ? entry + 8 : view.getUint32(entry + 8, little);
        const read = value(type, count, at);
        if (tag === 0x8769) ifd(read, 'exif');
        else if (tag === 0x8825) ifd(read, 'gps');
        else tags[`${prefix}:${tag}`] = read;
      }
    }
    ifd(view.getUint32(4, little), 'ifd0');
    return tags;
  }

  function sniff(bytes) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
    if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp';
    return 'other';
  }

  const ascii = (bytes, start, length) => String.fromCharCode(...bytes.slice(start, start + length));
  const startsWith = (bytes, start, text) => ascii(bytes, start, text.length) === text;

  // JPEG segments before the image data: [{ marker, start, end (exclusive) }].
  function jpegSegments(bytes) {
    const segments = [];
    let offset = 2;
    while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { offset += 2; continue; }
      if (marker === 0xff) { offset += 1; continue; }
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      segments.push({ marker, start: offset, end: offset + 2 + length });
      if (marker === 0xda) break;
      offset += 2 + length;
    }
    return segments;
  }

  function pngChunks(bytes) {
    const chunks = [];
    let offset = 8;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset);
      const type = ascii(bytes, offset + 4, 4);
      chunks.push({ type, start: offset, data: offset + 8, length, end: offset + 12 + length });
      offset += 12 + length;
      if (type === 'IEND') break;
    }
    return chunks;
  }

  function webpChunks(bytes) {
    const chunks = [];
    let offset = 12;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    while (offset + 8 <= bytes.length) {
      const type = ascii(bytes, offset, 4);
      const length = view.getUint32(offset + 4, true);
      chunks.push({ type, start: offset, data: offset + 8, length, end: offset + 8 + length + (length % 2) });
      offset += 8 + length + (length % 2);
    }
    return chunks;
  }

  function inspect(bytes) {
    const kind = sniff(bytes);
    const found = { kind, tags: null, blocks: [], texts: [] };
    const exifAt = (start) => { const tags = readTiff(bytes, start); if (tags) found.tags = Object.assign(found.tags || {}, tags); };
    if (kind === 'jpeg') {
      for (const segment of jpegSegments(bytes)) {
        const body = segment.start + 4;
        if (segment.marker === 0xe1 && startsWith(bytes, body, 'Exif\0\0')) { exifAt(body + 6); found.blocks.push('EXIF'); }
        else if (segment.marker === 0xe1 && startsWith(bytes, body, 'http://ns.adobe.com/xap/1.0/')) found.blocks.push('XMP');
        else if (segment.marker === 0xed) found.blocks.push('IPTC / Photoshop');
        else if (segment.marker === 0xe2 && startsWith(bytes, body, 'ICC_PROFILE')) found.blocks.push('ICC colour profile');
        else if (segment.marker === 0xfe) found.texts.push(['Comment', new TextDecoder().decode(bytes.slice(body, segment.end))]);
      }
    } else if (kind === 'png') {
      for (const chunk of pngChunks(bytes)) {
        if (chunk.type === 'eXIf') { exifAt(chunk.data); found.blocks.push('EXIF'); }
        else if (chunk.type === 'iCCP') found.blocks.push('ICC colour profile');
        else if (chunk.type === 'tIME') found.blocks.push('Modification time');
        else if (chunk.type === 'tEXt' || chunk.type === 'iTXt' || chunk.type === 'zTXt') {
          const data = bytes.slice(chunk.data, chunk.data + chunk.length);
          const zero = data.indexOf(0);
          const keyword = new TextDecoder('latin1').decode(data.slice(0, zero));
          let text = '';
          if (chunk.type === 'tEXt') text = new TextDecoder('latin1').decode(data.slice(zero + 1));
          else if (chunk.type === 'iTXt' && data[zero + 1] === 0) {
            let at = zero + 3;
            at = data.indexOf(0, at) + 1;
            at = data.indexOf(0, at) + 1;
            text = new TextDecoder().decode(data.slice(at));
          } else text = t('(compressed)');
          if (keyword === 'XML:com.adobe.xmp') found.blocks.push('XMP');
          else found.texts.push([keyword, text]);
        }
      }
    } else if (kind === 'webp') {
      for (const chunk of webpChunks(bytes)) {
        if (chunk.type === 'EXIF') { exifAt(chunk.data + (startsWith(bytes, chunk.data, 'Exif\0\0') ? 6 : 0)); found.blocks.push('EXIF'); }
        else if (chunk.type === 'XMP ') found.blocks.push('XMP');
        else if (chunk.type === 'ICCP') found.blocks.push('ICC colour profile');
      }
    }
    found.blocks = [...new Set(found.blocks)];
    return found;
  }

  /* ── Showing ─────────────────────────────────────────────────── */

  const ORIENTATION = { 1: 'Normal', 2: 'Mirrored', 3: 'Rotated 180°', 4: 'Mirrored and rotated 180°',
    5: 'Mirrored and rotated 90° counter-clockwise', 6: 'Rotated 90° clockwise', 7: 'Mirrored and rotated 90° clockwise', 8: 'Rotated 90° counter-clockwise' };
  const round = (value, digits) => String(Number(Number(value).toFixed(digits)));

  function gps(tags) {
    const read = (key, ref, negative) => {
      const parts = tags[`gps:${key}`];
      if (!Array.isArray(parts) || parts.length < 3 || parts.some((part) => !Number.isFinite(part))) return null;
      const decimal = parts[0] + parts[1] / 60 + parts[2] / 3600;
      return tags[`gps:${ref}`] === negative ? -decimal : decimal;
    };
    const latitude = read(2, 1, 'S');
    const longitude = read(4, 3, 'W');
    if (latitude === null || longitude === null) return null;
    return { latitude, longitude, altitude: tags['gps:6'] };
  }

  function groups(found) {
    const tags = found.tags || {};
    const get = (key) => tags[key];
    const list = [];
    const add = (title, rows) => { const kept = rows.filter(([, value]) => value !== undefined && value !== null && value !== ''); if (kept.length) list.push([title, kept]); };
    add('Camera', [['Make', get('ifd0:271')], ['Model', get('ifd0:272')], ['Lens make', get('exif:42035')], ['Lens', get('exif:42036')]]);
    const exposure = get('exif:33434');
    add('Capture', [
      ['Taken', get('exif:36867') || get('ifd0:306')],
      ['Exposure', exposure ? (exposure < 1 ? `1/${Math.round(1 / exposure)} s` : `${round(exposure, 2)} s`) : undefined],
      ['Aperture', get('exif:33437') ? `f/${round(get('exif:33437'), 1)}` : undefined],
      ['ISO', Array.isArray(get('exif:34855')) ? get('exif:34855')[0] : get('exif:34855')],
      ['Focal length', get('exif:37386') ? `${round(get('exif:37386'), 1)} mm` : undefined],
      ['Flash', get('exif:37385') === undefined ? undefined : (get('exif:37385') & 1 ? t('Fired') : t('Did not fire'))]
    ]);
    add('Image', [['Orientation', get('ifd0:274') ? t(ORIENTATION[get('ifd0:274')] || String(get('ifd0:274'))) : undefined],
      ['Software', get('ifd0:305')], ['Description', get('ifd0:270')]]);
    add('Author', [['Artist', get('ifd0:315')], ['Copyright', get('ifd0:33432')]]);
    const location = gps(tags);
    if (location) {
      add('Location', [['Latitude', round(location.latitude, 6)], ['Longitude', round(location.longitude, 6)],
        ['Altitude', Number.isFinite(location.altitude) ? `${round(location.altitude, 1)} m` : undefined]]);
    }
    if (found.texts.length) add('Text', found.texts.map(([key, value]) => [key, value]));
    return { list, location };
  }

  function showMeta(found) {
    const { list, location } = groups(found);
    const nodes = [];
    const heading = document.createElement('h2');
    heading.className = 'im-meta__title';
    heading.textContent = t('Metadata in the file');
    nodes.push(heading);
    const summary = document.createElement('p');
    summary.className = 'im-meta__summary';
    summary.textContent = found.blocks.length || found.texts.length
      ? `${t('Found:')} ${[...found.blocks, ...found.texts.map(([key]) => key)].join(', ')}`
      : t('No metadata found: no EXIF, XMP, IPTC, ICC profile or text.');
    nodes.push(summary);
    if (location) {
      const warning = document.createElement('p');
      warning.className = 'im-meta__warning';
      warning.textContent = t('This image says where it was taken. Anyone you send the file to can read it.');
      const link = document.createElement('a');
      link.href = `https://www.openstreetmap.org/?mlat=${location.latitude.toFixed(6)}&mlon=${location.longitude.toFixed(6)}#map=16/${location.latitude.toFixed(6)}/${location.longitude.toFixed(6)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = t('Show on OpenStreetMap');
      warning.append(' ', link);
      nodes.push(warning);
    }
    for (const [title, rows] of list) {
      const section = document.createElement('section');
      section.className = 'im-meta__group';
      const name = document.createElement('h3');
      name.textContent = t(title);
      const dl = document.createElement('dl');
      for (const [label, value] of rows) {
        const dt = document.createElement('dt');
        dt.textContent = t(label);
        const dd = document.createElement('dd');
        dd.dataset.i18nSkip = '';
        dd.textContent = Array.isArray(value) ? value.join(', ') : String(value);
        dl.append(dt, dd);
      }
      section.append(name, dl);
      nodes.push(section);
    }
    metaEl.replaceChildren(...nodes);
    metaEl.hidden = false;
  }

  /* ── Removing ────────────────────────────────────────────────
     Lossless: the image data is copied untouched and only metadata
     blocks are left out. A JPEG keeps its orientation in a tiny EXIF block
     so it is not shown sideways. */

  function concat(parts) {
    const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let at = 0;
    for (const part of parts) { out.set(part, at); at += part.length; }
    return out;
  }

  function orientationExif(orientation) {
    const data = new Uint8Array(6 + 26);
    data.set([0x45, 0x78, 0x69, 0x66, 0, 0], 0);
    const view = new DataView(data.buffer);
    data.set([0x49, 0x49], 6);
    view.setUint16(8, 42, true);
    view.setUint32(10, 8, true);
    view.setUint16(14, 1, true);
    view.setUint16(16, 0x0112, true);
    view.setUint16(18, 3, true);
    view.setUint32(20, 1, true);
    view.setUint16(24, orientation, true);
    view.setUint32(28, 0, true);
    const segment = new Uint8Array(4 + data.length);
    segment.set([0xff, 0xe1, ((data.length + 2) >> 8) & 255, (data.length + 2) & 255]);
    segment.set(data, 4);
    return segment;
  }

  function strip(bytes, found) {
    if (found.kind === 'jpeg') {
      const segments = jpegSegments(bytes);
      const parts = [bytes.slice(0, 2)];
      const orientation = found.tags && found.tags['ifd0:274'];
      let inserted = !(orientation > 1 && orientation <= 8);
      for (const segment of segments) {
        const keep = segment.marker === 0xe0 || segment.marker === 0xee || segment.marker < 0xe0 || segment.marker > 0xef
          || (segment.marker === 0xe2 && startsWith(bytes, segment.start + 4, 'ICC_PROFILE'));
        const dropped = segment.marker === 0xfe || !keep;
        if (!inserted && segment.marker !== 0xe0) { parts.push(orientationExif(orientation)); inserted = true; }
        if (segment.marker === 0xda) { parts.push(bytes.slice(segment.start)); return concat(parts); }
        if (!dropped) parts.push(bytes.slice(segment.start, segment.end));
      }
      return null;
    }
    if (found.kind === 'png') {
      const drop = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME']);
      return concat([bytes.slice(0, 8), ...pngChunks(bytes).filter((chunk) => !drop.has(chunk.type)).map((chunk) => bytes.slice(chunk.start, chunk.end))]);
    }
    if (found.kind === 'webp') {
      const kept = webpChunks(bytes).filter((chunk) => chunk.type !== 'EXIF' && chunk.type !== 'XMP ').map((chunk) => {
        const copy = bytes.slice(chunk.start, chunk.end);
        if (chunk.type === 'VP8X') copy[8] &= ~0x0c;
        return copy;
      });
      const out = concat([bytes.slice(0, 12), ...kept]);
      new DataView(out.buffer).setUint32(4, out.length - 8, true);
      return out;
    }
    return null;
  }

  /* ── Writing ─────────────────────────────────────────────────
     A little-endian TIFF with IFD0, an Exif IFD and a GPS IFD, built from
     scratch: the fields of the form plus the camera details, orientation
     and software already in the file (and, for 1.8.9, a signature). */

  const utf8 = (text) => new TextEncoder().encode(text);
  function rational(value, scale = 10000) {
    const gcd = (a, b) => { while (b) { const r = a % b; a = b; b = r; } return a || 1; };
    const numerator = Math.round(Math.abs(value) * scale);
    const divisor = gcd(numerator, scale);
    return [numerator / divisor, scale / divisor];
  }

  // entries: [{ tag, type, values }] → bytes of one IFD placed at `at` in the TIFF.
  function ifdBytes(entries, at) {
    const sorted = entries.slice().sort((a, b) => a.tag - b.tag);
    const head = 2 + sorted.length * 12 + 4;
    const parts = sorted.map((entry) => {
      let data;
      if (entry.type === 2) data = new Uint8Array([...utf8(entry.values), 0]);
      else if (entry.type === 1 || entry.type === 7) data = Uint8Array.from(entry.values);
      else {
        const size = TYPE_SIZE[entry.type];
        const count = entry.type === 5 || entry.type === 10 ? entry.values.length : entry.values.length;
        data = new Uint8Array(size * count);
        const view = new DataView(data.buffer);
        entry.values.forEach((value, index) => {
          if (entry.type === 3) view.setUint16(index * 2, value, true);
          else if (entry.type === 4) view.setUint32(index * 4, value, true);
          else if (entry.type === 5) { view.setUint32(index * 8, value[0], true); view.setUint32(index * 8 + 4, value[1], true); }
        });
      }
      return { ...entry, data, count: entry.type === 2 || entry.type === 1 || entry.type === 7 ? data.length : entry.values.length };
    });
    let extra = 0;
    parts.forEach((part) => { if (part.data.length > 4) { part.offset = at + head + extra; extra += part.data.length + (part.data.length % 2); } });
    const out = new Uint8Array(head + extra);
    const view = new DataView(out.buffer);
    view.setUint16(0, parts.length, true);
    parts.forEach((part, index) => {
      const entry = 2 + index * 12;
      view.setUint16(entry, part.tag, true);
      view.setUint16(entry + 2, part.type, true);
      view.setUint32(entry + 4, part.count, true);
      if (part.data.length > 4) {
        view.setUint32(entry + 8, part.offset, true);
        out.set(part.data, part.offset - at);
      } else out.set(part.data, entry + 8);
    });
    return out;
  }

  // fields: { description, artist, copyright, date ("YYYY:MM:DD HH:MM:SS"), gps: { latitude, longitude, altitude } | null, comment }
  function buildTiff(fields, tags) {
    const keep = (key) => tags && tags[key] !== undefined && tags[key] !== null && tags[key] !== '';
    const ifd0 = [];
    const text = (tag, value) => { if (value) ifd0.push({ tag, type: 2, values: value }); };
    text(0x010e, fields.description);
    if (keep('ifd0:271')) text(0x010f, tags['ifd0:271']);
    if (keep('ifd0:272')) text(0x0110, tags['ifd0:272']);
    if (keep('ifd0:274')) ifd0.push({ tag: 0x0112, type: 3, values: [tags['ifd0:274']] });
    if (keep('ifd0:305')) text(0x0131, tags['ifd0:305']);
    text(0x013b, fields.artist);
    text(0x8298, fields.copyright);
    const exif = [{ tag: 0x9000, type: 7, values: [...utf8('0232')] }];
    if (fields.date) exif.push({ tag: 0x9003, type: 2, values: fields.date });
    if (keep('exif:33434')) exif.push({ tag: 0x829a, type: 5, values: [rational(tags['exif:33434'], 1000000)] });
    if (keep('exif:33437')) exif.push({ tag: 0x829d, type: 5, values: [rational(tags['exif:33437'], 10)] });
    if (keep('exif:34855')) exif.push({ tag: 0x8827, type: 3, values: [[].concat(tags['exif:34855'])[0]] });
    if (keep('exif:37386')) exif.push({ tag: 0x920a, type: 5, values: [rational(tags['exif:37386'], 10)] });
    if (keep('exif:37385')) exif.push({ tag: 0x9209, type: 3, values: [tags['exif:37385']] });
    if (keep('exif:42035')) exif.push({ tag: 0xa433, type: 2, values: tags['exif:42035'] });
    if (keep('exif:42036')) exif.push({ tag: 0xa434, type: 2, values: tags['exif:42036'] });
    // UserComment: an 8-byte character-code prefix, then the text.
    if (fields.comment) exif.push({ tag: 0x9286, type: 7, values: [...utf8('ASCII\0\0\0'), ...utf8(fields.comment)] });
    let gps = null;
    if (fields.gps) {
      const dms = (value) => {
        const absolute = Math.abs(value);
        const degrees = Math.floor(absolute);
        const minutes = Math.floor((absolute - degrees) * 60);
        const seconds = (absolute - degrees - minutes / 60) * 3600;
        return [[degrees, 1], [minutes, 1], rational(seconds, 1000)];
      };
      gps = [
        { tag: 0x0000, type: 1, values: [2, 3, 0, 0] },
        { tag: 0x0001, type: 2, values: fields.gps.latitude < 0 ? 'S' : 'N' },
        { tag: 0x0002, type: 5, values: dms(fields.gps.latitude) },
        { tag: 0x0003, type: 2, values: fields.gps.longitude < 0 ? 'W' : 'E' },
        { tag: 0x0004, type: 5, values: dms(fields.gps.longitude) }
      ];
      if (Number.isFinite(fields.gps.altitude)) {
        gps.push({ tag: 0x0005, type: 1, values: [fields.gps.altitude < 0 ? 1 : 0] }, { tag: 0x0006, type: 5, values: [rational(fields.gps.altitude, 10)] });
      }
    }
    // Pointers are LONGs; lay out IFD0 first with them in place, then the sub-IFDs.
    ifd0.push({ tag: 0x8769, type: 4, values: [0] });
    if (gps) ifd0.push({ tag: 0x8825, type: 4, values: [0] });
    const size0 = ifdBytes(ifd0, 8).length;
    const exifAt = 8 + size0 + (size0 % 2);
    const exifBytes = ifdBytes(exif, exifAt);
    const gpsAt = exifAt + exifBytes.length + (exifBytes.length % 2);
    ifd0.find((entry) => entry.tag === 0x8769).values = [exifAt];
    if (gps) ifd0.find((entry) => entry.tag === 0x8825).values = [gpsAt];
    const ifd0Bytes = ifdBytes(ifd0, 8);
    const gpsBytes = gps ? ifdBytes(gps, gpsAt) : new Uint8Array(0);
    const tiff = new Uint8Array(gps ? gpsAt + gpsBytes.length : exifAt + exifBytes.length);
    tiff.set([0x49, 0x49, 42, 0, 8, 0, 0, 0], 0);
    tiff.set(ifd0Bytes, 8);
    tiff.set(exifBytes, exifAt);
    if (gps) tiff.set(gpsBytes, gpsAt);
    return tiff;
  }

  // Put a TIFF into a copy of the file: a new JPEG APP1 or PNG eXIf, the old EXIF removed.
  function writeExif(bytes, found, tiff) {
    if (found.kind === 'jpeg') {
      const payload = concat([utf8('Exif\0\0'), tiff]);
      if (payload.length + 2 > 65535) throw new Error('The metadata is too large for a JPEG.');
      const app1 = concat([new Uint8Array([0xff, 0xe1, ((payload.length + 2) >> 8) & 255, (payload.length + 2) & 255]), payload]);
      const parts = [bytes.slice(0, 2)];
      let inserted = false;
      for (const segment of jpegSegments(bytes)) {
        const oldExif = segment.marker === 0xe1 && startsWith(bytes, segment.start + 4, 'Exif\0\0');
        if (!inserted && segment.marker !== 0xe0) { parts.push(app1); inserted = true; }
        if (segment.marker === 0xda) { parts.push(bytes.slice(segment.start)); return concat(parts); }
        if (!oldExif) parts.push(bytes.slice(segment.start, segment.end));
      }
      return null;
    }
    if (found.kind === 'png') {
      const crc32 = window.ToolkitZip.crc32;
      const chunk = new Uint8Array(12 + tiff.length);
      const view = new DataView(chunk.buffer);
      view.setUint32(0, tiff.length);
      chunk.set(utf8('eXIf'), 4);
      chunk.set(tiff, 8);
      view.setUint32(8 + tiff.length, crc32(chunk.slice(4, 8 + tiff.length)));
      const parts = [bytes.slice(0, 8)];
      let inserted = false;
      for (const item of pngChunks(bytes)) {
        if (item.type === 'eXIf') continue;
        if (!inserted && item.type === 'IDAT') { parts.push(chunk); inserted = true; }
        parts.push(bytes.slice(item.start, item.end));
      }
      return concat(parts);
    }
    return null;
  }

  /* ── Page ────────────────────────────────────────────────────── */

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast(t('Please select an image file'), 'error');
      return;
    }
    file.arrayBuffer().then((buffer) => {
      const bytes = new Uint8Array(buffer);
      const found = inspect(bytes);
      current = { file, bytes, found };
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      preview.src = previewUrl;
      preview.style.display = 'block';
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight;
        const gcd = (a, b) => { while (b) { const r = a % b; a = b; b = r; } return a; };
        const d = gcd(w, h) || 1;
        const rows = [
          ['Filename', file.name],
          ['File Type', file.type || 'unknown'],
          ['File Size', formatBytes(file.size)],
          ['Width', `${w} px`],
          ['Height', `${h} px`],
          ['Aspect Ratio', `${w / d}:${h / d}`],
          ['Last Modified', new Date(file.lastModified).toLocaleString()],
          ['Base64 Size (est.)', formatBytes(Math.ceil(file.size * 4 / 3))]
        ];
        const body = tableEl.tBodies[0] || tableEl.appendChild(document.createElement('tbody'));
        body.replaceChildren(...rows.map(([key, value]) => {
          const row = document.createElement('tr');
          const name = document.createElement('td');
          name.className = 'ix-f3ad31';
          name.textContent = t(key);
          const cell = document.createElement('td');
          cell.className = 'font-mono ix-470b04';
          cell.dataset.i18nSkip = '';
          cell.textContent = value;
          row.append(name, cell);
          return row;
        }));
      };
      img.src = previewUrl;
      showMeta(found);
      fillEditor(found);
      const removable = found.kind !== 'other' && (found.blocks.some((block) => block !== 'ICC colour profile') || found.texts.length);
      actionsEl.hidden = found.kind === 'other' ? false : !removable;
      stripBtn.hidden = found.kind === 'other';
      stripNote.textContent = found.kind === 'other'
        ? t('Removing metadata works for JPEG, PNG and WebP files.')
        : t('The picture itself is copied unchanged; the colour profile is kept.');
    }).catch(() => showToast(t('The file could not be read.'), 'error'));
  }

  stripBtn.addEventListener('click', () => {
    if (!current) return;
    const cleaned = strip(current.bytes, current.found);
    if (!cleaned) { showToast(t('This file could not be cleaned.'), 'error'); return; }
    const dot = current.file.name.lastIndexOf('.');
    const name = dot > 0 ? `${current.file.name.slice(0, dot)}-clean${current.file.name.slice(dot)}` : `${current.file.name}-clean`;
    const url = URL.createObjectURL(new Blob([cleaned], { type: current.file.type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(t(`Saved without metadata, ${formatBytes(current.bytes.length - cleaned.length)} smaller.`), 'success');
  });

  // The form starts from what the file already says.
  function fillEditor(found) {
    editEl.hidden = !(found.kind === 'jpeg' || found.kind === 'png');
    const tags = found.tags || {};
    field('imEditDescription').value = tags['ifd0:270'] || '';
    field('imEditArtist').value = tags['ifd0:315'] || '';
    field('imEditCopyright').value = tags['ifd0:33432'] || '';
    const taken = String(tags['exif:36867'] || tags['ifd0:306'] || '').match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    field('imEditDate').value = taken ? `${taken[1]}-${taken[2]}-${taken[3]}T${taken[4]}:${taken[5]}:${taken[6]}` : '';
    const location = gps(tags);
    const keepOption = document.querySelector('input[name="imEditGps"][value="keep"]');
    keepOption.disabled = !location;
    (location ? keepOption : document.querySelector('input[name="imEditGps"][value="remove"]')).checked = true;
    field('imEditLat').value = location ? location.latitude.toFixed(6) : '';
    field('imEditLon').value = location ? location.longitude.toFixed(6) : '';
  }

  function editorFields(found) {
    const choice = document.querySelector('input[name="imEditGps"]:checked').value;
    let location = null;
    if (choice === 'keep') location = gps(found.tags || {});
    if (choice === 'set') {
      const latitude = Number(field('imEditLat').value.replace(',', '.'));
      const longitude = Number(field('imEditLon').value.replace(',', '.'));
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !field('imEditLat').value.trim()) {
        throw new Error('Latitude must be between −90 and 90, longitude between −180 and 180.');
      }
      location = { latitude, longitude };
    }
    const date = field('imEditDate').value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    return {
      description: field('imEditDescription').value.trim(),
      artist: field('imEditArtist').value.trim(),
      copyright: field('imEditCopyright').value.trim(),
      date: date ? `${date[1]}:${date[2]}:${date[3]} ${date[4]}:${date[5]}:${date[6] || '00'}` : '',
      gps: location
    };
  }

  function saveBytes(bytes, type, name) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const renamed = (name, suffix) => {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)}-${suffix}${name.slice(dot)}` : `${name}-${suffix}`;
  };

  field('imWrite').addEventListener('click', () => {
    if (!current) return;
    try {
      const tiff = buildTiff(editorFields(current.found), current.found.tags);
      const written = writeExif(current.bytes, current.found, tiff);
      if (!written) throw new Error('This file could not be written.');
      saveBytes(written, current.file.type, renamed(current.file.name, 'edited'));
      showToast(t('Saved a copy with the new metadata.'), 'success');
    } catch (error) {
      showToast(t(error.message), 'error');
    }
  });

  // Several files: each cleaned the same lossless way, saved as one ZIP.
  field('imBatch').addEventListener('change', async () => {
    const files = [...field('imBatch').files];
    if (!files.length) return;
    const out = [];
    let skipped = 0;
    let saved = 0;
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const found = inspect(bytes);
      const cleaned = found.kind === 'other' ? null : strip(bytes, found);
      if (!cleaned) { skipped += 1; continue; }
      out.push({ name: renamed(file.name, 'clean'), data: cleaned });
      saved += bytes.length - cleaned.length;
    }
    field('imBatch').value = '';
    field('imBatchNote').textContent = t(`${out.length} cleaned, ${skipped} skipped, ${formatBytes(saved)} of metadata removed.`);
    if (out.length) saveBytes(window.ToolkitZip.zip(out), 'application/zip', 'clean-images.zip');
  });

  // Exposed for the tests: inspect, strip and write without a file dialog.
  window.ToolkitImageMetadata = Object.freeze({ inspect, strip, buildTiff, writeExif });

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
})();
