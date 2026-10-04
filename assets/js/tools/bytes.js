(function initBytesConverter() {
  'use strict';

  const inputEl = document.getElementById('bytesInput');
  const unitEl = document.getElementById('bytesUnit');
  const tableEl = document.getElementById('bytesTable');

  if (!inputEl) return;

  const UNITS = [
    { key: 'B',   label: 'Bytes (B)',       factor: 1,                    binary: false },
    { key: 'KB',  label: 'Kilobytes (KB)',   factor: 1e3,                  binary: false },
    { key: 'MB',  label: 'Megabytes (MB)',   factor: 1e6,                  binary: false },
    { key: 'GB',  label: 'Gigabytes (GB)',   factor: 1e9,                  binary: false },
    { key: 'TB',  label: 'Terabytes (TB)',   factor: 1e12,                 binary: false },
    { key: 'KiB', label: 'Kibibytes (KiB)',  factor: 1024,                 binary: true  },
    { key: 'MiB', label: 'Mebibytes (MiB)',  factor: 1024 ** 2,            binary: true  },
    { key: 'GiB', label: 'Gibibytes (GiB)',  factor: 1024 ** 3,            binary: true  },
    { key: 'TiB', label: 'Tebibytes (TiB)',  factor: 1024 ** 4,            binary: true  }
  ];

  function toBytes(value, unit) {
    const u = UNITS.find(x => x.key === unit);
    return value * u.factor;
  }

  function fmt(n) {
    if (n === 0) return '0';
    if (n < 1e-6) return n.toExponential(4);
    return +n.toPrecision(10) + '';
  }

  function update() {
    const val = parseFloat(inputEl.value);
    if (isNaN(val) || val < 0) { tableEl.innerHTML = ''; return; }
    const bytes = toBytes(val, unitEl.value);

    let html = '<table class="ix-c2b3a0">';
    html += '<thead><tr>';
    html += '<th class="ix-c4ccea">Unit</th>';
    html += '<th class="ix-be468c">Value</th>';
    html += '<th class="ix-d3c755">Type</th>';
    html += '<th class="ix-6c8182"></th>';
    html += '</tr></thead><tbody>';

    UNITS.forEach(u => {
      const v = bytes / u.factor;
      const typeLabel = u.binary
        ? '<span class="ix-2dc335">Binary</span>'
        : '<span class="ix-58b7a5">Decimal</span>';
      html += `<tr>
        <td class="ix-178d87">${u.label}</td>
        <td class="font-mono ix-6c43b0">${fmt(v)}</td>
        <td class="ix-934b90">${typeLabel}</td>
        <td class="ix-ed35b3">
          <button class="btn btn-secondary ix-bb3314" data-copy-value="${fmt(v)}" data-copy-label="${u.key}">Copy</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table>';
    tableEl.innerHTML = html;
  }

  // Copy buttons are rendered with the table; one delegated listener keeps them free of inline handlers.
  tableEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy-value]');
    if (button) copyToClipboard(button.dataset.copyValue, button.dataset.copyLabel);
  });
  inputEl.addEventListener('input', update);
  unitEl.addEventListener('change', update);
  update();
})();
