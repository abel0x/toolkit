/* TOOLKIT — assets/js/tools/subnet-calculator.js
   IPv4 and IPv6 subnets: network and broadcast addresses, mask, usable
   hosts, address type, reverse DNS zone; splitting a network into smaller
   ones, turning an address range into CIDR blocks, and checking whether an
   address is inside. All arithmetic is done with BigInt. */
(function initSubnetCalculator() {
  'use strict';

  const inputEl = document.getElementById('snInput');
  const errorEl = document.getElementById('snError');
  const resultEl = document.getElementById('snResult');
  const splitWrapEl = document.getElementById('snSplitBox');
  const splitEl = document.getElementById('snSplit');
  const subnetsEl = document.getElementById('snSubnets');
  const splitNoteEl = document.getElementById('snSplitNote');
  const checkEl = document.getElementById('snCheck');
  const checkResultEl = document.getElementById('snCheckResult');
  if (!inputEl || !resultEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);
  const LIST_LIMIT = 256;

  class InputError extends Error {}

  /* ── Addresses ──────────────────────────────────────────────── */

  function parseV4(text) {
    const match = text.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return null;
    const parts = match.slice(1);
    if (parts.some((part) => part.length > 1 && part[0] === '0')) {
      throw new InputError('Leading zeros are ambiguous: some systems read 010 as octal. Write the number without them.');
    }
    if (parts.some((part) => Number(part) > 255)) throw new InputError('Each IPv4 number must be between 0 and 255.');
    return parts.reduce((value, part) => (value << 8n) | BigInt(part), 0n);
  }

  function parseV6(text) {
    let source = text.toLowerCase();
    if (source.includes('%')) throw new InputError('Remove the zone (the part after %) from the IPv6 address.');
    const embedded = source.match(/^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (embedded) {
      const v4 = parseV4(embedded[2]);
      source = `${embedded[1]}${(v4 >> 16n).toString(16)}:${(v4 & 0xffffn).toString(16)}`;
    }
    const halves = source.split('::');
    if (halves.length > 2) return null;
    const groups = (part) => (part === '' ? [] : part.split(':'));
    const head = groups(halves[0]);
    const tail = halves.length === 2 ? groups(halves[1]) : [];
    if ([...head, ...tail].some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
    let all;
    if (halves.length === 2) {
      const missing = 8 - head.length - tail.length;
      if (missing < 1) return null;
      all = [...head, ...Array(missing).fill('0'), ...tail];
    } else {
      if (head.length !== 8) return null;
      all = head;
    }
    return all.reduce((value, group) => (value << 16n) | BigInt(parseInt(group, 16)), 0n);
  }

  // { family, bits, value } or an InputError.
  function parseAddress(text) {
    const source = text.trim();
    if (source.includes(':')) {
      const value = parseV6(source);
      if (value === null) throw new InputError(`Not a valid IPv6 address: ${source}`);
      return { family: 6, bits: 128, value };
    }
    const value = parseV4(source);
    if (value === null) throw new InputError(`Not a valid IP address: ${source}`);
    return { family: 4, bits: 32, value };
  }

  const formatV4 = (value) => [24n, 16n, 8n, 0n].map((shift) => String((value >> shift) & 0xffn)).join('.');

  const v6Groups = (value) => Array.from({ length: 8 }, (_, index) => Number((value >> BigInt((7 - index) * 16)) & 0xffffn));

  // RFC 5952: lower case, no leading zeros, the longest run of two or more
  // zero groups (the first one on a tie) as "::", IPv4-mapped as ::ffff:a.b.c.d.
  function formatV6(value) {
    if (value >> 32n === 0xffffn) return `::ffff:${formatV4(value & 0xffffffffn)}`;
    const groups = v6Groups(value);
    let best = -1;
    let bestLength = 1;
    for (let index = 0; index < 8;) {
      if (groups[index] !== 0) { index += 1; continue; }
      let end = index;
      while (end < 8 && groups[end] === 0) end += 1;
      if (end - index > bestLength) { best = index; bestLength = end - index; }
      index = end;
    }
    const hex = groups.map((group) => group.toString(16));
    if (best < 0) return hex.join(':');
    return `${hex.slice(0, best).join(':')}::${hex.slice(best + bestLength).join(':')}`;
  }

  const expandV6 = (value) => v6Groups(value).map((group) => group.toString(16).padStart(4, '0')).join(':');
  const format = (family, value) => (family === 4 ? formatV4(value) : formatV6(value));

  /* ── Input ──────────────────────────────────────────────────── */

  function prefixFromMask(mask) {
    const value = parseV4(mask);
    if (value === null) throw new InputError(`Not a valid mask: ${mask}`);
    const binary = value.toString(2).padStart(32, '0');
    if (!/^1*0*$/.test(binary)) throw new InputError('A mask must be ones followed by zeros, such as 255.255.255.0.');
    return binary.indexOf('0') === -1 ? 32 : binary.indexOf('0');
  }

  // 'range' → { kind, family, bits, start, end }; otherwise { kind: 'subnet', family, bits, value, prefix }.
  function parseInput(text) {
    const source = text.trim();
    const range = source.match(/^([^\s\-–]+)\s*[-–]\s*([^\s\-–]+)$/);
    if (range) {
      const start = parseAddress(range[1]);
      const end = parseAddress(range[2]);
      if (start.family !== end.family) throw new InputError('Both ends of a range must be IPv4, or both IPv6.');
      if (start.value > end.value) throw new InputError('The range must start with the lower address.');
      return { kind: 'range', family: start.family, bits: start.bits, start: start.value, end: end.value };
    }
    const match = source.match(/^(\S+?)(?:\s*\/\s*(\S+)|\s+(\S+))?$/);
    if (!match) throw new InputError('Enter an address such as 192.168.1.10/24.');
    const address = parseAddress(match[1]);
    let prefix = address.bits;
    const suffix = match[2] || match[3];
    if (suffix !== undefined) {
      if (/^\d{1,3}$/.test(suffix)) prefix = Number(suffix);
      else if (address.family === 4) prefix = prefixFromMask(suffix);
      else throw new InputError('Write the IPv6 prefix as a number, such as /64.');
      if (prefix > address.bits) throw new InputError(`The prefix must be between 0 and ${address.bits}.`);
    }
    return { kind: 'subnet', ...address, prefix };
  }

  /* ── Arithmetic ─────────────────────────────────────────────── */

  function subnet(family, value, prefix) {
    const bits = family === 4 ? 32 : 128;
    const size = 1n << BigInt(bits - prefix);
    const all = (1n << BigInt(bits)) - 1n;
    const mask = all ^ (size - 1n);
    const network = value & mask;
    const last = network + size - 1n;
    let first = network;
    let lastUsable = last;
    let usable = size;
    // IPv4 keeps the network and broadcast addresses, except /31 point-to-point
    // links (RFC 3021) and /32 single hosts.
    if (family === 4 && prefix < 31) { first = network + 1n; lastUsable = last - 1n; usable = size - 2n; }
    return { family, bits, value, prefix, size, mask, network, last, first, lastUsable, usable };
  }

  const RANGES_V4 = [
    ['255.255.255.255/32', 'Limited broadcast'], ['0.0.0.0/8', 'This network (unspecified)'],
    ['10.0.0.0/8', 'Private (RFC 1918)'], ['172.16.0.0/12', 'Private (RFC 1918)'], ['192.168.0.0/16', 'Private (RFC 1918)'],
    ['100.64.0.0/10', 'Shared address space for carrier-grade NAT (RFC 6598)'], ['127.0.0.0/8', 'Loopback'],
    ['169.254.0.0/16', 'Link-local'], ['192.0.0.0/24', 'IETF protocol assignments'],
    ['192.0.2.0/24', 'Documentation (TEST-NET-1)'], ['198.51.100.0/24', 'Documentation (TEST-NET-2)'], ['203.0.113.0/24', 'Documentation (TEST-NET-3)'],
    ['198.18.0.0/15', 'Benchmarking (RFC 2544)'], ['224.0.0.0/4', 'Multicast'], ['240.0.0.0/4', 'Reserved']
  ];
  const RANGES_V6 = [
    ['::/128', 'Unspecified'], ['::1/128', 'Loopback'], ['::ffff:0:0/96', 'IPv4-mapped'], ['64:ff9b::/96', 'NAT64'],
    ['2001:db8::/32', 'Documentation'], ['2002::/16', '6to4'], ['fc00::/7', 'Unique local (private)'], ['fe80::/10', 'Link-local'],
    ['ff00::/8', 'Multicast'], ['2000::/3', 'Global unicast (public)']
  ];

  const KNOWN = { 4: RANGES_V4.map(([cidr, label]) => [parseInput(cidr), label]), 6: RANGES_V6.map(([cidr, label]) => [parseInput(cidr), label]) };

  // The type of the first listed range that holds the whole subnet.
  function addressType(family, network, prefix) {
    const found = KNOWN[family].find(([range]) => prefix >= range.prefix
      && subnet(family, network, range.prefix).network === subnet(family, range.value, range.prefix).network);
    if (found) return found[1];
    return family === 4 ? 'Public' : 'Reserved';
  }

  function reverseZone(family, network, prefix) {
    if (family === 4) {
      const octets = formatV4(network).split('.').slice(0, Math.floor(prefix / 8)).reverse();
      return `${octets.length ? `${octets.join('.')}.` : ''}in-addr.arpa`;
    }
    const nibbles = expandV6(network).replace(/:/g, '').slice(0, Math.floor(prefix / 4)).split('').reverse();
    return `${nibbles.length ? `${nibbles.join('.')}.` : ''}ip6.arpa`;
  }

  const trailingZeros = (value, bits) => {
    if (value === 0n) return bits;
    let count = 0;
    while (((value >> BigInt(count)) & 1n) === 0n) count += 1;
    return count;
  };

  // The fewest CIDR blocks that cover exactly start..end.
  function rangeToCidrs(family, start, end) {
    const bits = family === 4 ? 32 : 128;
    const blocks = [];
    let current = start;
    while (current <= end) {
      let prefix = bits - trailingZeros(current, bits);
      while (current + (1n << BigInt(bits - prefix)) - 1n > end) prefix += 1;
      blocks.push({ network: current, prefix });
      current += 1n << BigInt(bits - prefix);
    }
    return blocks;
  }

  function contains(net, address) {
    return address.family === net.family && (address.value & net.mask) === net.network;
  }

  /* ── Page ───────────────────────────────────────────────────── */

  const language = () => (window.ToolkitI18n && window.ToolkitI18n.getLanguage() === 'tr' ? 'tr-TR' : 'en-US');
  const grouped = (value) => value.toLocaleString(language());
  // 2^exponent, written out while it stays readable.
  const power = (exponent) => (exponent > 32 ? `2^${exponent}` : grouped(1n << BigInt(exponent)));
  const binaryV4 = (value) => value.toString(2).padStart(32, '0').match(/.{8}/g).join('.');

  function row(label, value, prose) {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = t(label);
    const td = document.createElement('td');
    if (!prose) td.className = 'font-mono';
    td.textContent = value;
    td.dataset.i18nSkip = '';
    tr.append(th, td);
    return tr;
  }

  // A table in a scrolling box that the keyboard can reach.
  function scroller(element, label) {
    const wrap = document.createElement('div');
    wrap.className = 'ctz-table-wrap';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', t(label));
    wrap.tabIndex = 0;
    wrap.append(element);
    return wrap;
  }

  function table(rows) {
    const element = document.createElement('table');
    element.className = 'ctz-table sn-table';
    const body = document.createElement('tbody');
    body.append(...rows);
    element.append(body);
    return scroller(element, 'Subnet details');
  }

  let current = null;

  function showSubnet(parsed) {
    const net = subnet(parsed.family, parsed.value, parsed.prefix);
    current = net;
    const v4 = net.family === 4;
    const rows = [
      row('Address', format(net.family, net.value)),
      row('Network', `${format(net.family, net.network)}/${net.prefix}`)
    ];
    if (v4) {
      rows.push(row('Netmask', formatV4(net.mask)), row('Wildcard mask', formatV4(((1n << 32n) - 1n) ^ net.mask)));
      if (net.prefix < 31) rows.push(row('Broadcast', formatV4(net.last)));
    }
    rows.push(
      row(v4 ? 'Usable host range' : 'Address range', net.usable === 1n ? format(net.family, net.first) : `${format(net.family, net.first)} – ${format(net.family, net.lastUsable)}`),
      row('Total addresses', v4 ? grouped(net.size) : `2^${net.bits - net.prefix} = ${grouped(net.size)}`)
    );
    if (v4) rows.push(row('Usable hosts', grouped(net.usable)));
    rows.push(row('Address type', t(addressType(net.family, net.network, net.prefix)), true));
    if (v4) rows.push(row('Binary', binaryV4(net.value)), row('Binary mask', binaryV4(net.mask)), row('As an integer', net.value.toString()));
    else rows.push(row('Full form', expandV6(net.value)));
    rows.push(row('Reverse DNS zone', reverseZone(net.family, net.network, net.prefix)));
    const notes = [];
    if (net.value !== net.network) notes.push(t('The address is inside the network; the host bits were cleared to find it.'));
    if (v4 && net.prefix === 31) notes.push(t('/31: both addresses are usable on a point-to-point link (RFC 3021).'));
    if (!v4 && net.prefix === 64) notes.push(t('/64 is the standard size for one IPv6 network; SLAAC needs it.'));
    resultEl.replaceChildren(table(rows), ...notes.map((text) => {
      const note = document.createElement('p');
      note.className = 'sn-note';
      note.textContent = text;
      return note;
    }));

    // Split options: up to 16 bits smaller, never past the address size.
    const options = [];
    for (let prefix = net.prefix + 1; prefix <= Math.min(net.bits, net.prefix + 16); prefix += 1) options.push(prefix);
    const previous = Number(splitEl.value);
    splitEl.replaceChildren(...options.map((prefix) => {
      const option = document.createElement('option');
      option.value = String(prefix);
      option.textContent = `/${prefix} (${power(prefix - net.prefix)} × ${power(net.bits - prefix)})`;
      return option;
    }));
    splitWrapEl.hidden = !options.length;
    if (options.length) {
      splitEl.value = String(options.includes(previous) ? previous : options[Math.min(options.length - 1, v4 ? Math.max(0, 26 - net.prefix - 1) : Math.max(0, 64 - net.prefix - 1))]);
      showSplit();
    }
  }

  function listTable(blocks, family, total) {
    const rows = blocks.map((block) => {
      const net = subnet(family, block.network, block.prefix);
      const tr = document.createElement('tr');
      const cells = [`${format(family, net.network)}/${net.prefix}`, net.usable === 1n ? format(family, net.first) : `${format(family, net.first)} – ${format(family, net.lastUsable)}`];
      if (family === 4) cells.push(net.prefix < 31 ? formatV4(net.last) : '—');
      tr.append(...cells.map((text) => {
        const td = document.createElement('td');
        td.className = 'font-mono';
        td.textContent = text;
        td.dataset.i18nSkip = '';
        return td;
      }));
      return tr;
    });
    const head = document.createElement('thead');
    const tr = document.createElement('tr');
    tr.append(...['Network', family === 4 ? 'Usable host range' : 'Address range', ...(family === 4 ? ['Broadcast'] : [])].map((label) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = t(label);
      return th;
    }));
    head.append(tr);
    const element = document.createElement('table');
    element.className = 'ctz-table';
    const body = document.createElement('tbody');
    body.append(...rows);
    element.append(head, body);
    splitNoteEl.textContent = total > BigInt(blocks.length)
      ? t(`Showing the first ${blocks.length} of ${total > 1n << 32n ? `2^${total.toString(2).length - 1}` : grouped(total)}.`)
      : (total === 1n ? t('1 network.') : t(`${grouped(total)} networks.`));
    return scroller(element, 'Networks');
  }

  function showSplit() {
    if (!current) return;
    const prefix = Number(splitEl.value);
    const total = 1n << BigInt(prefix - current.prefix);
    const step = 1n << BigInt(current.bits - prefix);
    const blocks = [];
    for (let index = 0n; index < total && index < BigInt(LIST_LIMIT); index += 1n) blocks.push({ network: current.network + index * step, prefix });
    subnetsEl.replaceChildren(listTable(blocks, current.family, total));
  }

  function showRange(parsed) {
    current = null;
    splitWrapEl.hidden = true;
    const blocks = rangeToCidrs(parsed.family, parsed.start, parsed.end);
    const intro = document.createElement('p');
    intro.className = 'sn-note';
    const count = parsed.end - parsed.start + 1n;
    intro.textContent = blocks.length === 1
      ? t(`${grouped(count)} addresses: exactly one CIDR block.`)
      : t(`${grouped(count)} addresses in ${blocks.length} CIDR blocks.`);
    resultEl.replaceChildren(intro, listTable(blocks, parsed.family, BigInt(blocks.length)));
    splitNoteEl.textContent = '';
  }

  function showCheck() {
    const text = checkEl.value.trim();
    checkResultEl.className = 'sn-check';
    if (!text || !current) { checkResultEl.textContent = ''; return; }
    try {
      const address = parseAddress(text);
      const inside = contains(current, address);
      checkResultEl.classList.add(inside ? 'sn-check--in' : 'sn-check--out');
      checkResultEl.textContent = inside
        ? `✓ ${t('Inside')} ${format(current.family, current.network)}/${current.prefix}`
        : `✕ ${t('Not inside')} ${format(current.family, current.network)}/${current.prefix}`;
    } catch (error) {
      checkResultEl.classList.add('sn-check--out');
      checkResultEl.textContent = t(error.message);
    }
  }

  function render() {
    const text = inputEl.value.trim();
    errorEl.hidden = true;
    if (!text) { current = null; resultEl.replaceChildren(); splitWrapEl.hidden = true; showCheck(); return; }
    try {
      const parsed = parseInput(text);
      if (parsed.kind === 'range') showRange(parsed); else showSubnet(parsed);
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      current = null;
      resultEl.replaceChildren();
      splitWrapEl.hidden = true;
      errorEl.textContent = t(error.message);
      errorEl.hidden = false;
    }
    showCheck();
  }

  inputEl.addEventListener('input', render);
  splitEl.addEventListener('change', showSplit);
  checkEl.addEventListener('input', showCheck);
  window.addEventListener('toolkit:languagechange', render);

  // Exposed for the tests.
  window.ToolkitSubnet = Object.freeze({ parseInput, subnet, formatV6, expandV6, rangeToCidrs, addressType, reverseZone });
  render();
}());
