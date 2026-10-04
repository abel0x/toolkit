(function initTemperature() {
  'use strict';

  const inputs = {
    C: document.getElementById('tempC'),
    F: document.getElementById('tempF'),
    K: document.getElementById('tempK'),
    Ra: document.getElementById('tempRa'),
    Re: document.getElementById('tempRe')
  };
  const formulaDisplay = document.getElementById('formulaDisplay');
  const refTableBody = document.getElementById('refTableBody');

  if (!inputs.C) return;

  const REFS = [
    { label: 'Absolute Zero', c: -273.15 },
    { label: 'Water Freezing', c: 0 },
    { label: 'Room Temperature', c: 22 },
    { label: 'Human Body', c: 37 },
    { label: 'Water Boiling', c: 100 }
  ];

  function cToF(c) { return c * 9 / 5 + 32; }
  function cToK(c) { return c + 273.15; }
  function cToRa(c) { return (c + 273.15) * 9 / 5; }
  function cToRe(c) { return c * 4 / 5; }
  function fToC(f) { return (f - 32) * 5 / 9; }
  function kToC(k) { return k - 273.15; }
  function raToC(ra) { return ra * 5 / 9 - 273.15; }
  function reToC(re) { return re * 5 / 4; }

  function fmt(n) {
    if (isNaN(n)) return '';
    return +n.toFixed(6) + '';
  }

  let updating = false;

  function updateFrom(source) {
    if (updating) return;
    updating = true;
    const raw = inputs[source].value.trim();
    if (raw === '') {
      Object.keys(inputs).forEach(k => { if (k !== source) inputs[k].value = ''; });
      formulaDisplay.innerHTML = '';
      updating = false;
      return;
    }
    const val = parseFloat(raw);
    let c;
    switch (source) {
      case 'C':  c = val; break;
      case 'F':  c = fToC(val); break;
      case 'K':  c = kToC(val); break;
      case 'Ra': c = raToC(val); break;
      case 'Re': c = reToC(val); break;
    }
    if (source !== 'C')  inputs.C.value  = fmt(c);
    if (source !== 'F')  inputs.F.value  = fmt(cToF(c));
    if (source !== 'K')  inputs.K.value  = fmt(cToK(c));
    if (source !== 'Ra') inputs.Ra.value = fmt(cToRa(c));
    if (source !== 'Re') inputs.Re.value = fmt(cToRe(c));

    formulaDisplay.innerHTML =
      `°C = ${fmt(c)} &nbsp;|&nbsp; °F = ${fmt(cToF(c))} &nbsp;|&nbsp; K = ${fmt(cToK(c))} &nbsp;|&nbsp; °Ra = ${fmt(cToRa(c))} &nbsp;|&nbsp; °Ré = ${fmt(cToRe(c))}<br>` +
      `<small>F = C × 9/5 + 32 &nbsp;&nbsp; K = C + 273.15 &nbsp;&nbsp; Ra = (C + 273.15) × 9/5 &nbsp;&nbsp; Ré = C × 4/5</small>`;
    updating = false;
  }

  Object.keys(inputs).forEach(key => {
    inputs[key].addEventListener('input', () => updateFrom(key));
  });

  // Reference table
  if (refTableBody) {
    REFS.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="ix-6bf00e">${r.label}</td>
        <td class="font-mono ix-bd234f">${fmt(r.c)}</td>
        <td class="font-mono ix-bd234f">${fmt(cToF(r.c))}</td>
        <td class="font-mono ix-bd234f">${fmt(cToK(r.c))}</td>
      `;
      refTableBody.appendChild(tr);
    });
  }

  // Default: show 0°C
  inputs.C.value = '0';
  updateFrom('C');
})();
