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

  // Building an Intl formatter costs far more than using one, so each is made once.
  const cache = new Map();
  const formatter = (key, make) => {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  };

  function abbreviation(zone, date) {
    const part = formatter(`abbr|${zone}`, () => new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }))
      .formatToParts(date).find((item) => item.type === 'timeZoneName');
    return part ? part.value : '';
  }

  function localTime(zone, date, withDate) {
    const locale = language() === 'tr' ? 'tr-TR' : 'en-GB';
    return formatter(`time|${locale}|${zone}|${withDate}`, () => new Intl.DateTimeFormat(locale, {
      timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      ...(withDate ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : { weekday: 'short' })
    })).format(date);
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

  // The next offset change within a year: weekly steps (no zone keeps a change
  // for less than a week; Morocco's Ramadan break lasts about a month), then a
  // binary search down to the minute.
  const WEEK = 7 * DAY;
  function nextChange(zone, date) {
    const start = offsetMinutes(zone, date);
    let low = date.getTime();
    let high = null;
    for (let step = 1; step <= 58; step += 1) {
      const at = date.getTime() + step * WEEK;
      if (offsetMinutes(zone, new Date(at)) !== start) { high = at; low = at - WEEK; break; }
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

  const names = new Map(); // language|code → name
  function countryName(code) {
    const key = `${language()}|${code}`;
    if (names.has(key)) return names.get(key);
    let name = DATA[code].n;
    try {
      const display = formatter(`region|${language()}`, () => new Intl.DisplayNames([language()], { type: 'region' })).of(code);
      if (display && display !== code) name = display;
    } catch { /* older browsers */ }
    names.set(key, name);
    return name;
  }

  const flag = (code) => String.fromCodePoint(...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0)));

  function fillCountries(selected) {
    const compare = collator().compare;
    const codes = Object.keys(DATA).sort((a, b) => compare(countryName(a), countryName(b)));
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

  const idle = (callback) => (window.requestIdleCallback || ((fn) => setTimeout(fn, 1)))(callback);
  const collator = () => formatter(`collator|${language()}`, () => new Intl.Collator(language()));

  // Other countries whose zones are now at one of these offsets.
  function renderSame(code, offsets, now, shared = Object.keys(DATA).filter((other) => other !== code
    && DATA[other].z.some(([zone]) => offsets.has(offsetMinutes(zone, now))))) {
    const label = [...offsets].sort((a, b) => a - b).map(formatOffset).join(', ');
    sameEl.textContent = shared.length
      ? `${label}: ${shared.map(countryName).sort(collator().compare).join(', ')}`
      : `${label}: ${t('no other country right now.')}`;
    sameEl.dataset.i18nSkip = '';
  }

  // Checking every zone in the world first builds a formatter for each, so it
  // runs in small idle slices that never hold the page up; a newer run wins.
  let sameRun = 0;
  function sameLater(code, offsets, now) {
    const run = ++sameRun;
    const countries = Object.keys(DATA).filter((other) => other !== code);
    const shared = [];
    let index = 0;
    const slice = () => {
      if (run !== sameRun) return;
      for (const end = Math.min(index + 40, countries.length); index < end; index += 1) {
        const other = countries[index];
        if (DATA[other].z.some(([zone]) => offsets.has(offsetMinutes(zone, now)))) shared.push(other);
      }
      if (index < countries.length) idle(slice); else renderSame(code, offsets, now, shared);
    };
    idle(slice);
  }

  // later: on page load and the minute refresh, the list of countries with the
  // same offset (a check of every zone in the world) waits until the browser is idle.
  function renderCountry(later = false) {
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

    if (later) sameLater(code, offsets, now); else { sameRun += 1; renderSame(code, offsets, now); }
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

  countryEl.addEventListener('change', () => renderCountry());
  [whenEl, fromEl].forEach((field) => field.addEventListener('input', renderConversion));
  fromEl.addEventListener('change', renderConversion);
  window.addEventListener('toolkit:languagechange', () => { fillCountries(countryEl.value); renderCountry(); });
  // The local times move on; refresh them each minute.
  setInterval(() => renderCountry(true), 60000);

  /* ── Meeting planner ────────────────────────────────────────── */

  const meetDateEl = document.getElementById('ctzMeetDate');
  const meetAddEl = document.getElementById('ctzMeetAdd');
  const meetZones = [];
  const hourKind = (hour) => (hour >= 9 && hour < 17 ? 'work' : hour >= 7 && hour < 22 ? 'edge' : 'night');
  const clock = (p) => `${String(p.hour).padStart(2, '0')}${p.minute ? `:${String(p.minute).padStart(2, '0')}` : ''}`;

  // For each hour of the day in the first zone: every zone's local time and kind.
  function meetingHours(zones, year, month, day) {
    return Array.from({ length: 24 }, (_, hour) => {
      const instant = instantFor(zones[0], year, month, day, hour, 0);
      const local = zones.map((zone) => parts(zone, instant));
      return { instant, local, allWork: local.every((p) => hourKind(p.hour + p.minute / 60) === 'work') };
    });
  }

  // Runs of hours that suit everyone, written in the first zone.
  function bestRuns(hours) {
    const runs = [];
    hours.forEach((hour, index) => {
      if (!hour.allWork) return;
      const last = runs[runs.length - 1];
      if (last && last.end === index - 1) last.end = index; else runs.push({ start: index, end: index });
    });
    return runs;
  }

  function renderMeeting() {
    const match = meetDateEl.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const chips = document.getElementById('ctzMeetZones');
    chips.replaceChildren(...meetZones.map((zone, index) => {
      const chip = document.createElement('span');
      chip.className = 'ctz-meet-chip';
      chip.textContent = zone;
      chip.dataset.i18nSkip = '';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-btn ctz-meet-remove';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', `${t('Remove')} ${zone}`);
      remove.disabled = meetZones.length < 2;
      remove.addEventListener('click', () => { meetZones.splice(index, 1); renderMeeting(); });
      chip.append(remove);
      return chip;
    }));
    const grid = document.getElementById('ctzMeetGrid');
    const best = document.getElementById('ctzMeetBest');
    if (!match || !meetZones.length) { grid.replaceChildren(); best.textContent = ''; return; }
    const hours = meetingHours(meetZones, ...match.slice(1).map(Number));
    grid.replaceChildren(...meetZones.map((zone, zoneIndex) => {
      const row = document.createElement('tr');
      const name = document.createElement('th');
      name.scope = 'row';
      name.className = 'font-mono';
      name.textContent = zone;
      row.append(name, ...hours.map((hour) => {
        const td = document.createElement('td');
        const p = hour.local[zoneIndex];
        td.className = `ctz-hour ctz-hour--${hourKind(p.hour + p.minute / 60)}${hour.allWork ? ' ctz-hour--shared' : ''}`;
        td.textContent = clock(p);
        return td;
      }));
      row.dataset.i18nSkip = '';
      return row;
    }));
    const runs = bestRuns(hours);
    if (!runs.length) { best.textContent = t('No hour of this day is within working hours everywhere.'); return; }
    // Each run in every zone: start of its first hour to the end of its last.
    const describe = (zoneIndex, run) => {
      const end = new Date(hours[run.end].instant.getTime() + 3600000);
      return `${clock(hours[run.start].local[zoneIndex])}–${clock(parts(meetZones[zoneIndex], end))}`;
    };
    best.textContent = `${t('Working hours everywhere:')} ${runs.map((run) => meetZones.map((zone, index) => `${zone} ${describe(index, run)}`).join(' · ')).join(' | ')}`;
  }

  function fillMeetZones() {
    meetAddEl.replaceChildren(...fromEl.cloneNode(true).children);
    meetAddEl.value = 'America/New_York';
  }

  // Start with this device's zone and two common partners.
  fillMeetZones();
  for (const zone of [ownZone && [...fromEl.options].some((option) => option.value === ownZone) ? ownZone : 'UTC', 'Europe/London', 'America/New_York']) {
    if (!meetZones.includes(zone)) meetZones.push(zone);
  }
  const today = parts(meetZones[0], new Date());
  meetDateEl.value = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
  meetDateEl.addEventListener('input', renderMeeting);
  document.getElementById('ctzMeetAddBtn').addEventListener('click', () => {
    if (!meetZones.includes(meetAddEl.value)) meetZones.push(meetAddEl.value);
    renderMeeting();
  });
  window.addEventListener('toolkit:languagechange', renderMeeting);
  // The planner sits low on the page; it is drawn once the browser is idle.
  (window.requestIdleCallback || ((callback) => setTimeout(callback, 1)))(() => renderMeeting());

  // Exposed for the tests.
  window.ToolkitCountryZones = Object.freeze({ offsetMinutes, instantFor, nextChange, dst, formatOffset, meetingHours, bestRuns, meetZones });
  renderCountry(true);
}());
