/* TOOLKIT — assets/js/tools/country-time-zones.js
   Every country's IANA time zones (from country-time-zones-data.js), with
   the current time, UTC offset and daylight saving worked out by this
   browser's own time zone rules, and a converter between zones. */
(function initCountryTimeZones() {
  'use strict';

  const DATA = window.TOOLKIT_COUNTRY_ZONES;
  const countryEl = document.getElementById('ctzCountry');
  const summaryEl = document.getElementById('ctzSummary');
  const zonesEl = document.getElementById('ctzZones');
  const sameEl = document.getElementById('ctzSame');
  const whenEl = document.getElementById('ctzWhen');
  const fromEl = document.getElementById('ctzFrom');
  const convertedEl = document.getElementById('ctzConverted');
  if (!countryEl || !DATA) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const language = () => (window.ToolkitI18n && window.ToolkitI18n.getLanguage() === 'tr' ? 'tr' : 'en');
  const DAY = 86400000;
  const formatters = new Map();

  function parts(zone, date) {
    if (!formatters.has(zone)) {
      formatters.set(zone, new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
    const out = {};
    for (const part of formatters.get(zone).formatToParts(date)) out[part.type] = Number(part.value);
    return out;
  }

  // Minutes east of UTC for a zone at an instant.
  function offsetMinutes(zone, date) {
    const p = parts(zone, date);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  }

  function formatOffset(minutes) {
    const sign = minutes < 0 ? '−' : '+';
    const value = Math.abs(minutes);
    return `UTC${sign}${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }

  function abbreviation(zone, date) {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(date)
      .find((item) => item.type === 'timeZoneName');
    return part ? part.value : '';
  }

  function localTime(zone, date, withDate) {
    return new Intl.DateTimeFormat(language() === 'tr' ? 'tr-TR' : 'en-GB', {
      timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      ...(withDate ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : { weekday: 'short' })
    }).format(date);
  }

  // Daylight saving: the zone's January and July offsets differ, and now
  // is on the larger one.
  function dst(zone, date) {
    const year = date.getUTCFullYear();
    const january = offsetMinutes(zone, new Date(Date.UTC(year, 0, 1)));
    const july = offsetMinutes(zone, new Date(Date.UTC(year, 6, 1)));
    if (january === july) return 'none';
    return offsetMinutes(zone, date) === Math.max(january, july) ? 'on' : 'off';
  }

  // The next offset change within a year: daily steps, then a binary search
  // down to the minute.
  function nextChange(zone, date) {
    const start = offsetMinutes(zone, date);
    let low = date.getTime();
    let high = null;
    for (let step = 1; step <= 400; step += 1) {
      const at = date.getTime() + step * DAY;
      if (offsetMinutes(zone, new Date(at)) !== start) { high = at; low = at - DAY; break; }
    }
    if (high === null) return null;
    while (high - low > 60000) {
      const middle = Math.floor((low + high) / 2);
      if (offsetMinutes(zone, new Date(middle)) === start) low = middle; else high = middle;
    }
    // Clocks change on a whole minute, and low < change <= high < low + 1 minute.
    const at = new Date(Math.floor(high / 60000) * 60000);
    return { at, offset: offsetMinutes(zone, at) };
  }

  // A wall-clock time in a zone to an instant (the later reading in a gap).
  function instantFor(zone, year, month, day, hour, minute) {
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    let instant = guess - offsetMinutes(zone, new Date(guess)) * 60000;
    const second = guess - offsetMinutes(zone, new Date(instant)) * 60000;
    if (second !== instant) instant = second;
    return new Date(instant);
  }

  function countryName(code) {
    try {
      const names = new Intl.DisplayNames([language()], { type: 'region' });
      const name = names.of(code);
      if (name && name !== code) return name;
    } catch { /* older browsers */ }
    return DATA[code].n;
  }

  const flag = (code) => String.fromCodePoint(...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0)));

  function fillCountries(selected) {
    const codes = Object.keys(DATA).sort((a, b) => countryName(a).localeCompare(countryName(b), language()));
    countryEl.replaceChildren(...codes.map((code) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = `${flag(code)} ${countryName(code)}`;
      return option;
    }));
    countryEl.value = selected;
  }

  function cell(text, className) {
    const td = document.createElement('td');
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function renderCountry() {
    const code = countryEl.value;
    const country = DATA[code];
    if (!country) return;
    const now = new Date();
    const offsets = new Set();
    zonesEl.replaceChildren(...country.z.map(([zone, region]) => {
      const row = document.createElement('tr');
      const offset = offsetMinutes(zone, now);
      offsets.add(offset);
      const name = document.createElement('td');
      const zoneLabel = document.createElement('span');
      zoneLabel.className = 'ctz-zone font-mono';
      zoneLabel.textContent = zone;
      name.append(zoneLabel);
      if (region) {
        const note = document.createElement('span');
        note.className = 'ctz-region';
        note.textContent = region;
        name.append(note);
      }
      name.dataset.i18nSkip = '';
      const state = dst(zone, now);
      const change = nextChange(zone, now);
      row.append(name, cell(localTime(zone, now, false), 'font-mono'),
        cell(`${formatOffset(offset)} (${abbreviation(zone, now)})`, 'font-mono'),
        cell(t(state === 'none' ? 'Not used' : state === 'on' ? 'In effect now' : 'Not in effect now')),
        cell(change ? `${localTime(zone, change.at, true)} → ${formatOffset(change.offset)}` : '—', 'font-mono'));
      row.cells[1].dataset.i18nSkip = '';
      row.cells[2].dataset.i18nSkip = '';
      row.cells[4].dataset.i18nSkip = '';
      return row;
    }));
    const count = country.z.length;
    summaryEl.textContent = count === 1
      ? t(`${countryName(code)} uses one time zone.`)
      : t(`${countryName(code)} uses ${count} time zones.`);

    // Other countries whose zones are now at one of these offsets.
    const shared = Object.keys(DATA).filter((other) => other !== code
      && DATA[other].z.some(([zone]) => offsets.has(offsetMinutes(zone, now))));
    const label = [...offsets].sort((a, b) => a - b).map(formatOffset).join(', ');
    sameEl.textContent = shared.length
      ? `${label}: ${shared.map(countryName).sort((a, b) => a.localeCompare(b, language())).join(', ')}`
      : `${label}: ${t('no other country right now.')}`;
    sameEl.dataset.i18nSkip = '';
    renderConversion();
  }

  function fillFromZones() {
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    const list = [...new Set(['UTC', ...zones, ...Object.values(DATA).flatMap((country) => country.z.map(([zone]) => zone))])].sort();
    fromEl.replaceChildren(...list.map((zone) => {
      const option = document.createElement('option');
      option.value = zone;
      option.textContent = zone;
      return option;
    }));
  }

  function renderConversion() {
    const match = whenEl.value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) { convertedEl.replaceChildren(); return; }
    const instant = instantFor(fromEl.value, ...match.slice(1).map(Number));
    const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const zones = [...new Set([fromEl.value, ...DATA[countryEl.value].z.map(([zone]) => zone), 'UTC', own])];
    convertedEl.replaceChildren(...zones.map((zone) => {
      const row = document.createElement('tr');
      const name = cell(zone === own ? `${zone} (${t('this device')})` : zone, 'font-mono');
      row.append(name, cell(localTime(zone, instant, true), 'font-mono'), cell(formatOffset(offsetMinutes(zone, instant)), 'font-mono'));
      [...row.cells].forEach((td) => { td.dataset.i18nSkip = ''; });
      return row;
    }));
  }

  // Start with this device's country and the current minute.
  const ownZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ownCountry = Object.keys(DATA).find((code) => DATA[code].z.some(([zone]) => zone === ownZone)) || 'TR';
  fillCountries(ownCountry);
  fillFromZones();
  fromEl.value = ownZone && [...fromEl.options].some((option) => option.value === ownZone) ? ownZone : 'UTC';
  const now = parts(fromEl.value, new Date());
  whenEl.value = `${now.year}-${String(now.month).padStart(2, '0')}-${String(now.day).padStart(2, '0')}T${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`;

  countryEl.addEventListener('change', renderCountry);
  [whenEl, fromEl].forEach((field) => field.addEventListener('input', renderConversion));
  fromEl.addEventListener('change', renderConversion);
  window.addEventListener('toolkit:languagechange', () => { fillCountries(countryEl.value); renderCountry(); });
  // The local times move on; refresh them each minute.
  setInterval(renderCountry, 60000);

  // Exposed for the tests.
  window.ToolkitCountryZones = Object.freeze({ offsetMinutes, instantFor, nextChange, dst, formatOffset });
  renderCountry();
}());
