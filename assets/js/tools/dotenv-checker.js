/* TOOLKIT — assets/js/tools/env-checker.js
   Reads a .env file the way dotenv does (export, quotes, multi-line double
   quotes, inline comments, ${VAR} references) and reports what breaks or
   surprises other loaders: shells, Docker, Compose. Can compare it with a
   .env.example. Values never leave the page and are hidden by default. */
(function initEnvChecker() {
  'use strict';

  const field = (id) => document.getElementById(id);
  const inputEl = document.getElementById('envInput');
  const exampleEl = document.getElementById('envExample');
  const issuesEl = document.getElementById('envIssues');
  const summaryEl = document.getElementById('envSummary');
  const varsEl = document.getElementById('envVars');
  const showEl = document.getElementById('envShow');
  const jsonEl = document.getElementById('envJson');
  const issuesWrap = document.getElementById('envIssuesWrap');
  const varsWrap = document.getElementById('envVarsWrap');
  if (!inputEl || !issuesEl) return;

  const t = (key) => (window.ToolkitI18n ? window.ToolkitI18n.t(key) : key);

  const PORTABLE_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const DOTENV_KEY = /^[A-Za-z0-9_.-]+$/;

  /* ── Parsing ────────────────────────────────────────────────── */

  // { vars: [{ key, value, line, quote }], issues: [{ line, level, message }] }
  function parse(text) {
    const vars = [];
    const issues = [];
    const add = (line, level, message) => issues.push({ line, level, message });
    if (text.startsWith('\uFEFF')) { add(1, 'info', 'The file starts with a byte order mark; some loaders read it as part of the first key.'); text = text.slice(1); }
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const number = index + 1;
      const raw = lines[index];
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const match = raw.match(/^\s*(export\s+)?([^=\s:]+)?(\s*)([=:]?)(\s*)(.*)$/);
      if (!match || !match[2] || !match[4]) { add(number, 'error', 'This line is not KEY=value.'); continue; }
      const [, exported, key, spaceBefore, sign, spaceAfter, rest] = match;
      if (sign === ':') { add(number, 'error', 'Use “=” between the key and the value; “:” is not read by most loaders.'); continue; }
      if (!DOTENV_KEY.test(key)) { add(number, 'error', `“${key}” is not a valid variable name.`); continue; }
      if (!PORTABLE_KEY.test(key)) add(number, 'warning', `“${key}” works with dotenv but not in a shell: use letters, digits and _ and do not start with a digit.`);
      else if (key !== key.toUpperCase()) add(number, 'info', `“${key}” is not in upper case, as environment variables usually are.`);
      if (exported) add(number, 'info', '“export” works in shells and dotenv, but Docker’s --env-file reads it as part of the name.');
      if (spaceBefore || spaceAfter) add(number, 'warning', 'Spaces around “=” are fine for dotenv, but break the line in a shell and in Docker’s --env-file.');

      let value = '';
      let quote = '';
      const first = rest[0];
      if (first === '"' || first === "'" || first === '`') {
        quote = first;
        // The closing quote may be on a later line (multi-line values).
        let body = rest.slice(1);
        let end = closing(body, quote);
        let consumed = index;
        while (end === -1 && consumed + 1 < lines.length) {
          consumed += 1;
          body += `\n${lines[consumed]}`;
          end = closing(body, quote);
        }
        if (end === -1) { add(number, 'error', `The ${quote === '"' ? 'double' : quote === "'" ? 'single' : 'back'} quote is not closed.`); break; }
        if (consumed > index && quote !== '"') add(number, 'warning', 'Only double quotes are read across several lines by every dotenv loader.');
        index = consumed;
        const inside = body.slice(0, end);
        const after = body.slice(end + 1).trim();
        if (after && !after.startsWith('#')) add(number, 'warning', `Text after the closing quote is ignored: ${after}`);
        value = quote === '"' ? inside.replace(/\\([nrt"\\])/g, (_, char) => ({ n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' }[char])) : inside;
      } else {
        // An inline comment starts at " #"; a # without a space before it is part of the value.
        const comment = rest.search(/\s#/);
        value = (comment === -1 ? rest : rest.slice(0, comment)).trim();
        if (/^#/.test(rest)) {
          value = '';
          add(number, 'warning', `A value that starts with “#” is read as a comment, so ${key} is empty. Quote it: ${key}="${rest.trim()}"`);
        }
        if (/\S\s+\S/.test(value)) add(number, 'warning', 'The value has spaces but no quotes: a shell would cut it at the first space.');
        if (/\S#/.test(value)) add(number, 'info', 'The “#” is part of the value here; some loaders read it as the start of a comment. Quote the value to be safe.');
        if (/^["'`]/.test(value) || /["'`]$/.test(value)) add(number, 'warning', 'A quote at only one end of the value is kept as part of it.');
      }
      if (value === '' && !/^#/.test(rest)) add(number, 'info', `${key} is empty.`);
      vars.push({ key, value, line: number, quote });
    }

    // Repeated keys: dotenv, Compose and shells keep the last value.
    const seen = new Map();
    for (const entry of vars) {
      if (seen.has(entry.key)) add(entry.line, 'warning', `${entry.key} was already set on line ${seen.get(entry.key)}; most loaders use this later value.`);
      seen.set(entry.key, entry.line);
    }
    // ${VAR} references (dotenv-expand, Compose) to names that are not set here.
    for (const entry of vars) {
      if (entry.quote === "'") continue;
      for (const reference of entry.value.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?[-?+][^}]*)?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g)) {
        const name = reference[1] || reference[2];
        const hasDefault = /:?-/.test(reference[0]) && reference[1];
        if (!seen.has(name) && !hasDefault) add(entry.line, 'warning', `${entry.key} refers to ${name}, which is not set in this file.`);
      }
    }
    issues.sort((a, b) => a.line - b.line);
    return { vars, issues };
  }

  // Index of the closing quote, skipping \" in double-quoted values.
  function closing(body, quote) {
    for (let at = 0; at < body.length; at += 1) {
      if (quote === '"' && body[at] === '\\') { at += 1; continue; }
      if (body[at] === quote) return at;
    }
    return -1;
  }

  function compare(vars, example) {
    const keys = new Set(vars.map((entry) => entry.key));
    const expected = new Set(example.vars.map((entry) => entry.key));
    return {
      missing: [...expected].filter((key) => !keys.has(key)),
      extra: [...keys].filter((key) => !expected.has(key))
    };
  }

  /* ── Export ─────────────────────────────────────────────────── */

  const singleQuoted = (value) => `'${value.replace(/'/g, "'\\''")}'`;
  // YAML double-quoted strings accept JSON's escapes.
  const yamlString = (value) => JSON.stringify(value);

  // Later values win, as when the file is loaded.
  function finalValues(vars) {
    const map = new Map();
    for (const entry of vars) map.set(entry.key, entry.value);
    return map;
  }

  // { text, notes: [message], name } for one export format.
  function exportAs(vars, format) {
    const map = finalValues(vars);
    const notes = [];
    const lines = [];
    switch (format) {
      case 'shell':
        for (const [key, value] of map) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) { notes.push(`${key} is left out: a shell variable name cannot have that form.`); continue; }
          lines.push(`export ${key}=${singleQuoted(value)}`);
        }
        return { text: lines.join('\n'), notes, name: 'env.sh' };
      case 'docker':
        // --env-file takes each line as it is: no quotes, no escapes, one line per value.
        for (const [key, value] of map) {
          if (/[\r\n]/.test(value)) { lines.push(`# ${key} is left out: --env-file cannot hold values with line breaks.`); notes.push(`${key} is left out: --env-file cannot hold values with line breaks.`); continue; }
          lines.push(`${key}=${value}`);
        }
        return { text: lines.join('\n'), notes, name: 'docker.env' };
      case 'compose':
        // Compose reads $ as the start of a variable; $$ is a literal dollar.
        lines.push('services:', '  app:', '    environment:');
        for (const [key, value] of map) lines.push(`      ${key}: ${yamlString(value.replace(/\$/g, '$$$$'))}`);
        if ([...map.values()].some((value) => value.includes('$'))) notes.push('Dollar signs are written as $$ so that Compose keeps them.');
        return { text: lines.join('\n'), notes, name: 'compose.yaml' };
      case 'k8s':
        lines.push('apiVersion: v1', 'kind: Secret', 'metadata:', '  name: app-env', 'type: Opaque', 'stringData:');
        for (const [key, value] of map) {
          if (!/^[-._a-zA-Z0-9]+$/.test(key)) { notes.push(`${key} is left out: Kubernetes keys use letters, digits, -, _ and . only.`); continue; }
          lines.push(`  ${key}: ${yamlString(value)}`);
        }
        notes.push('Kubernetes stores stringData base64-encoded, not encrypted; keep the file private.');
        return { text: lines.join('\n'), notes, name: 'secret.yaml' };
      default: {
        const object = {};
        for (const [key, value] of map) object[key] = value;
        return { text: JSON.stringify(object, null, 2), notes, name: 'env.json' };
      }
    }
  }

  /* ── Page ───────────────────────────────────────────────────── */

  const LEVEL = { error: '✕', warning: '!', info: 'i' };

  function issueRow(line, level, message) {
    const row = document.createElement('tr');
    row.className = `env-issue env-issue--${level}`;
    const where = document.createElement('td');
    where.className = 'font-mono';
    where.textContent = line ? String(line) : '—';
    const kind = document.createElement('td');
    kind.textContent = `${LEVEL[level]} ${t(level === 'error' ? 'Error' : level === 'warning' ? 'Warning' : 'Note')}`;
    const text = document.createElement('td');
    text.textContent = t(message);
    row.append(where, kind, text);
    row.dataset.i18nSkip = '';
    return row;
  }

  function render() {
    const source = inputEl.value;
    if (!source.trim()) {
      issuesEl.replaceChildren(); varsEl.replaceChildren(); summaryEl.textContent = ''; jsonEl.value = '';
      issuesWrap.hidden = true; varsWrap.hidden = true;
      return;
    }
    const result = parse(source);
    const rows = result.issues.map((issue) => issueRow(issue.line, issue.level, issue.message));
    let missing = 0;
    if (exampleEl.value.trim()) {
      const diff = compare(result.vars, parse(exampleEl.value));
      missing = diff.missing.length;
      diff.missing.forEach((key) => rows.push(issueRow(0, 'error', `${key} is in the example file but not set here.`)));
      diff.extra.forEach((key) => rows.push(issueRow(0, 'info', `${key} is set here but not in the example file.`)));
    }
    issuesEl.replaceChildren(...rows);
    issuesWrap.hidden = !rows.length;
    const errors = result.issues.filter((issue) => issue.level === 'error').length + missing;
    const warnings = result.issues.filter((issue) => issue.level === 'warning').length;
    summaryEl.className = `env-summary env-summary--${errors ? 'error' : warnings ? 'warning' : 'ok'}`;
    const count = (number, word) => `${number} ${word}${number === 1 ? '' : 's'}`;
    summaryEl.textContent = !errors && !warnings
      ? `✓ ${t(`${count(result.vars.length, 'variable')}, no problems found.`)}`
      : t(`${count(result.vars.length, 'variable')}: ${count(errors, 'error')}, ${count(warnings, 'warning')}.`);

    const show = showEl.checked;
    varsEl.replaceChildren(...result.vars.map((entry) => {
      const row = document.createElement('tr');
      const key = document.createElement('td');
      key.className = 'font-mono';
      key.textContent = entry.key;
      const value = document.createElement('td');
      value.className = 'font-mono env-value';
      value.textContent = show ? entry.value : (entry.value ? '•'.repeat(Math.min(entry.value.length, 12)) : '');
      const line = document.createElement('td');
      line.className = 'font-mono';
      line.textContent = String(entry.line);
      row.append(key, value, line);
      row.dataset.i18nSkip = '';
      return row;
    }));
    varsWrap.hidden = !result.vars.length;
    const exported = exportAs(result.vars, field('envFormat').value);
    jsonEl.value = exported.text;
    field('envExportNote').textContent = exported.notes.map((note) => t(note)).join(' ');
  }

  [inputEl, exampleEl].forEach((field) => field.addEventListener('input', render));
  showEl.addEventListener('change', render);
  field('envFormat').addEventListener('change', render);
  field('envDownload').addEventListener('click', () => {
    if (!jsonEl.value) { showToast(t('Nothing to download yet.'), 'error'); return; }
    const { name } = exportAs([], field('envFormat').value);
    const url = URL.createObjectURL(new Blob([`${jsonEl.value}\n`], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.getElementById('envJsonCopy').addEventListener('click', () => {
    if (jsonEl.value) copyToClipboard(jsonEl.value, 'Variables');
    else showToast(t('Nothing to copy.'), 'error');
  });
  window.addEventListener('toolkit:languagechange', render);

  // Exposed for the tests.
  window.ToolkitEnvChecker = Object.freeze({ parse, compare, exportAs });
  render();
}());
