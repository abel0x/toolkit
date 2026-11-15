/* TOOLKIT — assets/js/tools/csv-to-sql.js
   CSV or JSON rows to SQL INSERT statements for PostgreSQL, MySQL, SQLite
   and SQL Server, with an optional CREATE TABLE whose column types are
   inferred from the data. Quoting and escaping follow each dialect. */
(function initCsvToSql() {
  'use strict';

  const field = (id) => document.getElementById(id);
  const inputEl = field('c2sInput');
  const outputEl = field('c2sOutput');
  const errorEl = field('c2sError');
  const statsEl = field('c2sStats');
  const copyBtn = field('c2sCopy');
  if (!inputEl || !outputEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  class InputError extends Error {}

  /* ── Reading ────────────────────────────────────────────────── */

  // The delimiter that appears most often outside quotes on the first line.
  function detectDelimiter(text) {
    const line = [];
    let quoted = false;
    for (const char of text) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && (char === '\n' || char === '\r')) break;
      if (!quoted) line.push(char);
    }
    const counts = [',', ';', '\t', '|'].map((delimiter) => [delimiter, line.filter((char) => char === delimiter).length]);
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] ? counts[0][0] : ',';
  }

  // RFC 4180: quoted fields may hold delimiters, quotes ("") and line breaks.
  function parseCsv(text, delimiter) {
    const rows = [];
    let row = [];
    let value = '';
    let quoted = false;
    let at = 0;
    while (at < text.length) {
      const char = text[at];
      if (quoted) {
        if (char === '"' && text[at + 1] === '"') { value += '"'; at += 2; continue; }
        if (char === '"') { quoted = false; at += 1; continue; }
        value += char;
        at += 1;
        continue;
      }
      if (char === '"' && value === '') { quoted = true; at += 1; continue; }
      if (char === delimiter) { row.push(value); value = ''; at += 1; continue; }
      if (char === '\r' || char === '\n') {
        row.push(value);
        rows.push(row);
        row = [];
        value = '';
        at += char === '\r' && text[at + 1] === '\n' ? 2 : 1;
        continue;
      }
      value += char;
      at += 1;
    }
    if (quoted) throw new InputError('A quoted CSV field is not closed.');
    if (value !== '' || row.length) { row.push(value); rows.push(row); }
    return rows.filter((cells) => cells.length > 1 || cells[0] !== '');
  }

  function uniqueNames(names) {
    const seen = new Map();
    return names.map((name, index) => {
      const base = name.trim() || `column_${index + 1}`;
      const count = seen.get(base.toLowerCase()) || 0;
      seen.set(base.toLowerCase(), count + 1);
      return count ? `${base}_${count + 1}` : base;
    });
  }

  // { columns: [...], rows: [[...]], source: 'csv' | 'json' }; CSV cells stay strings.
  function readInput(text, format, header) {
    const trimmed = text.trim();
    const kind = format === 'auto' ? (/^[[{]/.test(trimmed) ? 'json' : 'csv') : format;
    if (kind === 'json') {
      let data;
      try { data = JSON.parse(trimmed); } catch (error) { throw new InputError(`${t('The JSON is not valid:')} ${error.message}`); }
      const list = Array.isArray(data) ? data : [data];
      if (!list.length) throw new InputError('The JSON array is empty.');
      if (!list.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))) {
        throw new InputError('Use a JSON object or an array of objects: one object per row.');
      }
      const columns = [];
      for (const item of list) for (const key of Object.keys(item)) if (!columns.includes(key)) columns.push(key);
      return { source: 'json', columns, rows: list.map((item) => columns.map((key) => (key in item ? item[key] : undefined))) };
    }
    const rows = parseCsv(trimmed, detectDelimiter(trimmed));
    if (!rows.length) throw new InputError('There are no rows.');
    const width = Math.max(...rows.map((row) => row.length));
    const columns = header ? uniqueNames(Array.from({ length: width }, (_, index) => rows[0][index] || '')) : Array.from({ length: width }, (_, index) => `column_${index + 1}`);
    const body = (header ? rows.slice(1) : rows).map((row) => Array.from({ length: width }, (_, index) => row[index]));
    return { source: 'csv', columns, rows: body };
  }

  /* ── Types ──────────────────────────────────────────────────── */

  const INTEGER = /^-?(0|[1-9]\d*)$/;
  const DECIMAL = /^-?(0|[1-9]\d*)(\.\d+)?([eE][-+]?\d+)?$/;
  const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
  const DATETIME_TZ = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})$/;

  // A cell's value before typing: null for missing (and for empty when asked).
  function normalise(value, source, emptyIsNull) {
    if (value === undefined || value === null) return null;
    if (source === 'csv' && value === '' && emptyIsNull) return null;
    return value;
  }

  function kindOf(value, source) {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? (Math.abs(value) > 2147483647 ? 'bigint' : 'integer') : 'decimal';
    if (typeof value === 'object') return 'json';
    const text = String(value);
    if (source === 'csv') {
      if (/^(true|false)$/i.test(text)) return 'boolean';
      if (INTEGER.test(text)) return Number.isSafeInteger(Number(text)) ? (Math.abs(Number(text)) > 2147483647 ? 'bigint' : 'integer') : 'text';
      if (DECIMAL.test(text)) return 'decimal';
    }
    if (DATE.test(text)) return 'date';
    if (DATETIME_TZ.test(text)) return 'timestamptz';
    if (DATETIME.test(text)) return 'timestamp';
    return 'text';
  }

  // The one kind that holds every value of a column.
  function columnKind(values, source) {
    const kinds = new Set(values.filter((value) => value !== null).map((value) => kindOf(value, source)));
    if (!kinds.size) return 'text';
    if (kinds.size === 1) return [...kinds][0];
    if ([...kinds].every((kind) => ['integer', 'bigint', 'decimal'].includes(kind))) return kinds.has('decimal') ? 'decimal' : 'bigint';
    if ([...kinds].every((kind) => ['timestamp', 'timestamptz'].includes(kind))) return 'timestamp';
    if ([...kinds].every((kind) => ['date', 'timestamp'].includes(kind))) return 'timestamp';
    return 'text';
  }

  const SQL_TYPES = {
    postgresql: { integer: 'INTEGER', bigint: 'BIGINT', decimal: 'NUMERIC', boolean: 'BOOLEAN', date: 'DATE', timestamp: 'TIMESTAMP', timestamptz: 'TIMESTAMPTZ', json: 'JSONB', text: () => 'TEXT' },
    mysql: { integer: 'INT', bigint: 'BIGINT', decimal: 'DOUBLE', boolean: 'BOOLEAN', date: 'DATE', timestamp: 'DATETIME', timestamptz: 'VARCHAR(40)', json: 'JSON', text: (length) => (length <= 255 ? 'VARCHAR(255)' : 'TEXT') },
    sqlite: { integer: 'INTEGER', bigint: 'INTEGER', decimal: 'REAL', boolean: 'INTEGER', date: 'TEXT', timestamp: 'TEXT', timestamptz: 'TEXT', json: 'TEXT', text: () => 'TEXT' },
    sqlserver: { integer: 'INT', bigint: 'BIGINT', decimal: 'FLOAT', boolean: 'BIT', date: 'DATE', timestamp: 'DATETIME2', timestamptz: 'DATETIMEOFFSET', json: 'NVARCHAR(MAX)', text: (length) => (length <= 4000 ? `NVARCHAR(${Math.max(1, Math.min(4000, 2 ** Math.ceil(Math.log2(Math.max(length, 16)))))})` : 'NVARCHAR(MAX)') }
  };

  /* ── Writing ────────────────────────────────────────────────── */

  function quoteName(name, dialect) {
    return name.split('.').map((part) => {
      if (dialect === 'mysql') return `\`${part.replace(/`/g, '``')}\``;
      if (dialect === 'sqlserver') return `[${part.replace(/]/g, ']]')}]`;
      return `"${part.replace(/"/g, '""')}"`;
    }).join('.');
  }

  function quoteText(text, dialect) {
    let body = text.replace(/'/g, "''");
    // MySQL reads backslashes as escapes in strings by default.
    if (dialect === 'mysql') body = body.replace(/\\/g, '\\\\');
    // SQL Server needs N'...' to keep characters outside the code page.
    return dialect === 'sqlserver' && /[^\x00-\x7f]/.test(body) ? `N'${body}'` : `'${body}'`;
  }

  function literal(value, kind, dialect) {
    if (value === null) return 'NULL';
    if (kind === 'boolean') {
      const text = String(value);
      const truth = typeof value === 'boolean' ? value : /^(true|1|yes)$/i.test(text);
      // A type picked by hand may meet a value that is not true or false; it stays text.
      if (typeof value !== 'boolean' && !/^(true|false|1|0|yes|no)$/i.test(text)) return quoteText(text, dialect);
      return dialect === 'postgresql' || dialect === 'mysql' ? (truth ? 'TRUE' : 'FALSE') : (truth ? '1' : '0');
    }
    if (kind === 'integer' || kind === 'bigint' || kind === 'decimal') {
      if (typeof value === 'number' || DECIMAL.test(String(value))) return String(value);
      return quoteText(String(value), dialect);
    }
    if (typeof value === 'object') return quoteText(JSON.stringify(value), dialect);
    return quoteText(String(value), dialect);
  }

  const TRANSACTION = {
    postgresql: ['BEGIN;', 'COMMIT;'], mysql: ['START TRANSACTION;', 'COMMIT;'], sqlite: ['BEGIN TRANSACTION;', 'COMMIT;'], sqlserver: ['BEGIN TRANSACTION;', 'COMMIT;']
  };

  // options: { table, dialect, batch, create, emptyIsNull, transaction, conflict: 'insert' | 'update' | 'skip', key, types: { column: kind } }
  function generate(data, options) {
    const dialect = options.dialect;
    const table = quoteName(options.table.trim() || 'my_table', dialect);
    const rows = data.rows.map((row) => row.map((value) => normalise(value, data.source, options.emptyIsNull)));
    const types = options.types || {};
    const kinds = data.columns.map((name, index) => types[name] || columnKind(rows.map((row) => row[index]), data.source));
    const conflict = options.conflict || 'insert';
    const key = options.key && data.columns.includes(options.key) ? options.key : '';
    // MySQL finds the conflicting row through its own unique keys; the others are told which column.
    if (conflict !== 'insert' && !key && dialect !== 'mysql') throw new InputError('Pick the key column that identifies existing rows.');
    const lines = [];
    if (options.transaction) lines.push(TRANSACTION[options.dialect][0], '');
    if (options.create) {
      const sqlTypes = SQL_TYPES[dialect];
      const definitions = data.columns.map((name, index) => {
        const kind = kinds[index];
        const longest = Math.max(0, ...rows.map((row) => (row[index] === null ? 0 : String(typeof row[index] === 'object' ? JSON.stringify(row[index]) : row[index]).length)));
        // MySQL cannot index TEXT without a length, so a text key is a VARCHAR.
        const type = kind === 'text' ? (name === key && dialect === 'mysql' ? 'VARCHAR(255)' : sqlTypes.text(longest)) : sqlTypes[kind];
        return `  ${quoteName(name, dialect)} ${type}`;
      });
      if (key) definitions.push(`  PRIMARY KEY (${quoteName(key, dialect)})`);
      lines.push(`CREATE TABLE ${table} (\n${definitions.join(',\n')}\n);`, '');
    }
    const columns = data.columns.map((name) => quoteName(name, options.dialect)).join(', ');
    // SQL Server accepts at most 1000 rows in one VALUES list.
    const size = options.dialect === 'sqlserver' ? Math.min(options.batch, 1000) : options.batch;
    const names = data.columns.map((name) => quoteName(name, dialect));
    const others = data.columns.filter((name) => name !== key).map((name) => quoteName(name, dialect));
    const keyName = key ? quoteName(key, dialect) : '';
    for (let start = 0; start < rows.length; start += size) {
      const chunk = rows.slice(start, start + size).map((row) => `(${row.map((value, index) => literal(value, kinds[index], dialect)).join(', ')})`);
      const values = chunk.length === 1 ? ` ${chunk[0]}` : `\n  ${chunk.join(',\n  ')}`;
      if (dialect === 'sqlserver' && conflict !== 'insert') {
        // SQL Server has no ON CONFLICT; MERGE compares each row with the table.
        const merge = [`MERGE INTO ${table} AS target`, `USING (VALUES${values}\n) AS source (${columns})`, `ON target.${keyName} = source.${keyName}`];
        if (conflict === 'update' && others.length) merge.push(`WHEN MATCHED THEN UPDATE SET ${others.map((name) => `target.${name} = source.${name}`).join(', ')}`);
        merge.push(`WHEN NOT MATCHED THEN INSERT (${columns}) VALUES (${names.map((name) => `source.${name}`).join(', ')});`);
        lines.push(merge.join('\n'));
        continue;
      }
      let head = `INSERT INTO ${table} (${columns}) VALUES`;
      let tail = '';
      if (conflict === 'skip') {
        if (dialect === 'mysql') head = `INSERT IGNORE INTO ${table} (${columns}) VALUES`;
        else tail = `\nON CONFLICT (${keyName}) DO NOTHING`;
      }
      if (conflict === 'update') {
        if (dialect === 'mysql') tail = others.length ? `\nON DUPLICATE KEY UPDATE ${others.map((name) => `${name} = VALUES(${name})`).join(', ')}` : '';
        else tail = others.length ? `\nON CONFLICT (${keyName}) DO UPDATE SET ${others.map((name) => `${name} = excluded.${name}`).join(', ')}` : `\nON CONFLICT (${keyName}) DO NOTHING`;
      }
      lines.push(`${head}${values}${tail};`);
    }
    if (options.transaction) lines.push('', TRANSACTION[options.dialect][1]);
    return { sql: lines.join('\n'), kinds };
  }

  /* ── Page ───────────────────────────────────────────────────── */

  function options() {
    const batch = field('c2sBatch').value;
    return {
      table: field('c2sTable').value, dialect: field('c2sDialect').value, batch: batch === 'all' ? Infinity : Number(batch),
      create: field('c2sCreate').checked, emptyIsNull: field('c2sEmptyNull').checked, transaction: field('c2sTransaction').checked,
      conflict: field('c2sConflict').value, key: field('c2sKey').value, types: Object.fromEntries(typeChoices)
    };
  }

  // Large inputs wait for a pause in typing; small ones update at once.
  const LARGE = 200000;
  let pending = 0;
  const later = (source, fn) => () => {
    clearTimeout(pending);
    if (source.value.length > LARGE) pending = setTimeout(fn, 200); else fn();
  };

  // The rows read from the input are kept until the input or how it is read changes.
  let read = { key: null, data: null, error: null };
  function readCached(text, format, header) {
    const key = `${format}|${header}|${text}`;
    if (read.key !== key) {
      try { read = { key, data: readInput(text, format, header), error: null }; } catch (error) { read = { key, data: null, error }; }
    }
    if (read.error) throw read.error;
    return read.data;
  }

  // Column choices: the key for updates, and a type per column (Auto = as inferred).
  const typeChoices = new Map();
  let shownColumns = '';
  const KINDS = ['text', 'integer', 'bigint', 'decimal', 'boolean', 'date', 'timestamp', 'timestamptz', 'json'];
  function syncColumns(data) {
    const signature = data.columns.join('\u0000');
    if (signature === shownColumns) return;
    shownColumns = signature;
    const keyEl = field('c2sKey');
    const previous = keyEl.value;
    keyEl.replaceChildren(new Option(t('None'), ''), ...data.columns.map((name) => new Option(name, name)));
    keyEl.value = data.columns.includes(previous) ? previous : '';
    for (const name of [...typeChoices.keys()]) if (!data.columns.includes(name)) typeChoices.delete(name);
    field('c2sTypes').replaceChildren(...data.columns.map((name) => {
      const row = document.createElement('tr');
      const label = document.createElement('td');
      label.className = 'font-mono';
      label.textContent = name;
      label.dataset.i18nSkip = '';
      const cell = document.createElement('td');
      const select = document.createElement('select');
      select.className = 'form-control form-select c2s-type';
      select.setAttribute('aria-label', `${t('Type of')} ${name}`);
      select.append(new Option(t('Auto'), ''), ...KINDS.map((kind) => new Option(kind, kind)));
      select.value = typeChoices.get(name) || '';
      select.addEventListener('change', () => {
        if (select.value) typeChoices.set(name, select.value); else typeChoices.delete(name);
        render();
      });
      cell.append(select);
      row.append(label, cell);
      return row;
    }));
    field('c2sTypesBox').hidden = false;
  }
  // "Auto" shows what it would choose.
  function showInferred(kinds) {
    field('c2sTypes').querySelectorAll('select').forEach((select, index) => {
      select.options[0].textContent = `${t('Auto')} (${kinds[index]})`;
    });
  }

  function render() {
    errorEl.hidden = true;
    statsEl.textContent = '';
    if (!inputEl.value.trim()) { outputEl.value = ''; return; }
    try {
      const data = readCached(inputEl.value, field('c2sFormat').value, field('c2sHeader').checked);
      if (!data.rows.length) throw new InputError('There are no data rows, only a header.');
      syncColumns(data);
      const result = generate(data, options());
      outputEl.value = result.sql;
      showInferred(result.kinds);
      statsEl.textContent = t(`${data.rows.length} rows, ${data.columns.length} columns`);
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      outputEl.value = '';
      errorEl.textContent = t(error.message);
      errorEl.hidden = false;
    }
  }

  inputEl.addEventListener('input', later(inputEl, render));
  field('c2sTable').addEventListener('input', later(inputEl, render));
  ['c2sFormat', 'c2sDialect', 'c2sBatch', 'c2sCreate', 'c2sEmptyNull', 'c2sHeader', 'c2sTransaction', 'c2sConflict', 'c2sKey'].forEach((id) => field(id).addEventListener('change', render));
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'SQL');
    else showToast(t('Nothing to copy.'), 'error');
  });

  // Exposed for the tests.
  window.ToolkitCsvToSql = Object.freeze({ readInput, generate, parseCsv });
  render();
}());
