(function initSqlFormatter() {
  'use strict';

  const inputEl = document.getElementById('sql-input');
  const outputEl = document.getElementById('sql-output');
  const formatBtn = document.getElementById('sql-btn');
  const copyBtn = document.getElementById('sql-copy');
  const upperEl = document.getElementById('sql-upper');
  if (!inputEl) return;

  const KEYWORDS = new Set(('SELECT DISTINCT FROM WHERE JOIN LEFT RIGHT INNER OUTER FULL CROSS NATURAL ON USING ORDER GROUP BY ' +
    'HAVING LIMIT OFFSET FETCH NEXT ROWS ONLY INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE INDEX VIEW DROP ALTER ADD ' +
    'COLUMN PRIMARY KEY FOREIGN REFERENCES UNIQUE DEFAULT CHECK CONSTRAINT UNION ALL EXCEPT INTERSECT WITH RECURSIVE AS ' +
    'CASE WHEN THEN ELSE END AND OR NOT IN EXISTS BETWEEN LIKE ILIKE IS NULL TRUE FALSE ASC DESC RETURNING CONFLICT DO NOTHING ' +
    'OVER PARTITION WINDOW COUNT SUM AVG MIN MAX COALESCE NULLIF CAST CONVERT IF REPLACE TRUNCATE BEGIN COMMIT ROLLBACK').split(' '));

  // Clauses that start a new line, longest first so "LEFT OUTER JOIN" wins over "JOIN".
  const CLAUSES = [
    'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'INSERT INTO', 'DELETE FROM', 'ORDER BY', 'GROUP BY',
    'PARTITION BY', 'UNION ALL', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'NATURAL JOIN',
    'ON CONFLICT', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'SELECT', 'FROM', 'WHERE', 'HAVING', 'LIMIT', 'OFFSET',
    'JOIN', 'VALUES', 'UPDATE', 'SET', 'UNION', 'EXCEPT', 'INTERSECT', 'WITH', 'RETURNING', 'WINDOW'
  ].map((clause) => clause.split(' '));
  // Conditions continue on their own line, one level in.
  const CONDITIONS = new Set(['AND', 'OR']);

  /* Tokens: whitespace is dropped, everything else keeps its exact text, so
     strings (with '' and "" escapes), quoted names and comments survive. */
  function tokenize(sql) {
    const tokens = [];
    const re = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*'?|"(?:[^"]|"")*"?|`(?:[^`]|``)*`?|\[[^\]]*\]?)|(\d+(?:\.\d+)?(?:e[+-]?\d+)?|\.\d+)|([\p{L}_@$][\p{L}\p{N}_$]*)|(::|<=|>=|<>|!=|\|\||->>|->|[(),;.*=<>!+\-/%^&|~?:])|(\S)/giu;
    let match;
    while ((match = re.exec(sql)) !== null) {
      const [text, comment, string, number, word, symbol] = match;
      if (comment) tokens.push({ type: 'comment', text });
      else if (string) tokens.push({ type: 'string', text });
      else if (number) tokens.push({ type: 'number', text });
      else if (word) tokens.push({ type: KEYWORDS.has(word.toUpperCase()) ? 'keyword' : 'word', text: word });
      else if (symbol) tokens.push({ type: 'symbol', text });
      else tokens.push({ type: 'other', text });
    }
    return tokens;
  }

  function formatSql(sql, uppercase) {
    const tokens = tokenize(sql);
    const keyword = (text) => (uppercase ? text.toUpperCase() : text.toLowerCase());
    const lines = [];
    let line = '';
    let indent = 0;
    // One entry per open parenthesis: how far a subquery inside it is indented (0: none).
    const parens = [];

    const flush = () => { if (line.trim()) lines.push('  '.repeat(Math.max(indent, 0)) + line.trimEnd()); line = ''; };
    const clauseAt = (index) => CLAUSES.find((parts) => parts.every((part, k) => tokens[index + k]?.type === 'keyword'
      && tokens[index + k].text.toUpperCase() === part));
    const append = (text, previous) => {
      const prev = previous?.text;
      const noSpaceBefore = /^[),;.]$/.test(text) || (text === '(' && previous && (previous.type === 'word'
        || (previous.type === 'keyword' && !/^(IN|VALUES|AS|ON|USING|EXISTS|AND|OR|NOT|WHEN|THEN|ELSE|FROM|JOIN)$/i.test(prev))));
      const noSpaceAfterPrev = prev === '(' || prev === '.' || prev === '::';
      if (!line || noSpaceBefore || noSpaceAfterPrev) line += text;
      else line += ' ' + text;
    };

    let index = 0;
    let previous = null;
    // BETWEEN x AND y keeps its AND on the same line.
    let between = false;
    while (index < tokens.length) {
      const token = tokens[index];
      const clause = token.type === 'keyword' ? clauseAt(index) : null;
      if (clause) {
        flush();
        line = clause.map(keyword).join(' ');
        index += clause.length;
        previous = { type: 'keyword', text: clause[clause.length - 1] };
        continue;
      }
      if (token.type === 'keyword' && token.text.toUpperCase() === 'BETWEEN') between = true;
      else if (between && token.type === 'keyword' && token.text.toUpperCase() === 'AND') {
        between = false;
        append(keyword(token.text), previous);
        previous = token;
        index += 1;
        continue;
      }
      if (token.type === 'keyword' && CONDITIONS.has(token.text.toUpperCase()) && !(parens.length && !parens[parens.length - 1])) {
        flush();
        line = '  ' + keyword(token.text);
        previous = token;
        index += 1;
        continue;
      }
      if (token.type === 'comment') {
        if (token.text.startsWith('/*')) append(token.text, previous);
        else { append(token.text, previous); flush(); }
        previous = token;
        index += 1;
        continue;
      }
      if (token.text === '(') {
        const next = tokens[index + 1];
        const subquery = next?.type === 'keyword' && /^(SELECT|WITH)$/i.test(next.text);
        append('(', previous);
        // A subquery opened on an AND/OR line goes one level deeper than it.
        const depth = subquery ? (line.startsWith('  ') ? 2 : 1) : 0;
        parens.push(depth);
        if (depth) { flush(); indent += depth; }
        previous = token;
        index += 1;
        continue;
      }
      if (token.text === ')') {
        const depth = parens.pop();
        if (depth) { flush(); indent -= depth; line = (depth === 2 ? '  ' : '') + ')'; } else append(')', previous);
        previous = token;
        index += 1;
        continue;
      }
      if (token.text === ';') {
        append(';', previous);
        flush();
        lines.push('');
        indent = 0;
        parens.length = 0;
        previous = null;
        index += 1;
        continue;
      }
      append(token.type === 'keyword' ? keyword(token.text) : token.text, previous);
      previous = token;
      index += 1;
    }
    flush();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines.join('\n');
  }

  function doFormat() {
    const raw = inputEl.value.trim();
    if (!raw) { showToast('Please enter SQL.', 'error'); return; }
    const uppercase = upperEl ? upperEl.checked : true;
    outputEl.value = formatSql(raw, uppercase);
    showToast('SQL formatted!', 'success');
  }

  formatBtn.addEventListener('click', doFormat);
  copyBtn.addEventListener('click', () => {
    if (outputEl.value) copyToClipboard(outputEl.value, 'SQL');
    else showToast('Nothing to copy.', 'error');
  });
})();
