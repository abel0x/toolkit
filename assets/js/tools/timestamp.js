/* TOOLKIT — assets/js/tools/timestamp.js */
(function initTimestamp() {
  const t = (key, values) => window.ToolkitI18n?.t(key, values) || key;
  const liveEl      = document.getElementById('tsLive');
  const nowBtn      = document.getElementById('tsNowBtn');
  const unixInput   = document.getElementById('tsUnixInput');
  const secBtn      = document.getElementById('tsSecBtn');
  const msBtn       = document.getElementById('tsMsBtn');
  const toDateBtn   = document.getElementById('tsToDateBtn');
  const unixResult  = document.getElementById('tsUnixResult');
  const dateInput   = document.getElementById('tsDateInput');
  const toUnixBtn   = document.getElementById('tsToUnixBtn');
  const dateResult  = document.getElementById('tsDateResult');
  if (!liveEl) return;

  let unit = 's';

  // Live clock
  function updateLive() {
    const now = Date.now();
    liveEl.textContent = t('Now: {{seconds}} (s) · {{milliseconds}} (ms)', {
      seconds: Math.floor(now / 1000), milliseconds: now
    });
  }
  updateLive();
  setInterval(updateLive, 1000);

  // Unit toggle
  secBtn.addEventListener('click', () => { unit='s'; secBtn.classList.add('active'); msBtn.classList.remove('active'); });
  msBtn.addEventListener('click',  () => { unit='ms'; msBtn.classList.add('active'); secBtn.classList.remove('active'); });

  nowBtn.addEventListener('click', () => {
    const now = Date.now();
    unixInput.value = unit === 's' ? Math.floor(now/1000) : now;
  });

  function resultRow(label, value, copyVal) {
    const row = document.createElement('div');
    row.className = 'ts-result-row';
    row.innerHTML = `
      <span class="ts-result-label">${label}</span>
      <span class="ts-result-val">${value}</span>
      <button class="icon-btn ix-c2bafe" aria-label="Copy ${label}" title="Copy">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>`;
    row.querySelector('button').addEventListener('click', () => copyToClipboard(copyVal || value, label));
    return row;
  }

  toDateBtn.addEventListener('click', () => {
    const raw = unixInput.value.trim();
    if (!raw || isNaN(raw)) { showToast('Enter a valid Unix timestamp', 'error'); return; }
    const ms  = unit === 's' ? Number(raw) * 1000 : Number(raw);
    const d   = new Date(ms);
    if (isNaN(d.getTime())) { showToast('Invalid timestamp', 'error'); return; }
    unixResult.innerHTML = '';
    unixResult.appendChild(resultRow('Local', d.toLocaleString(), d.toLocaleString()));
    unixResult.appendChild(resultRow('UTC', d.toUTCString(), d.toUTCString()));
    unixResult.appendChild(resultRow('ISO 8601', d.toISOString(), d.toISOString()));
    unixResult.appendChild(resultRow('Relative', timeFromNow(d), timeFromNow(d)));
  });

  toUnixBtn.addEventListener('click', () => {
    const val = dateInput.value;
    if (!val) { showToast('Select a date and time', 'error'); return; }
    const d = new Date(val);
    if (isNaN(d.getTime())) { showToast('Invalid date', 'error'); return; }
    const sec = Math.floor(d.getTime() / 1000);
    const ms  = d.getTime();
    dateResult.innerHTML = '';
    dateResult.appendChild(resultRow('Seconds', String(sec)));
    dateResult.appendChild(resultRow('Milliseconds', String(ms)));
  });

  function timeFromNow(date) {
    const diff = (Date.now() - date.getTime()) / 1000;
    const abs = Math.abs(diff);
    const units = [[3600*24*365,'year'],[3600*24*30,'month'],[3600*24,'day'],[3600,'hour'],[60,'minute'],[1,'second']];
    for (const [s, u] of units) {
      if (abs >= s) {
        const n = Math.floor(abs/s);
        return diff > 0 ? `${n} ${u}${n>1?'s':''} ago` : `in ${n} ${u}${n>1?'s':''}`;
      }
    }
    return 'just now';
  }
})();
