// Garmin op het trainingsscherm: training exporteren als .fit (handmatig importeren in
// Garmin Connect) en hartslag uit een Garmin-activiteit aan de training koppelen.
// Er is geen verbinding met Garmin zelf: alles gaat via bestanden, je gegevens blijven op je toestel.
import { h, fill, fmtDate, toast } from './ui.js';
import * as db from './db.js';
import { encodeSessionFit, decodeFit, heartRateSummary, unzipFit } from './fit.js';

const SVG = 'http://www.w3.org/2000/svg';

function hrChart(samples) {
  if (!samples?.length || samples.length < 2) return null;
  const W = 340, H = 70, P = 4;
  const xs = samples.map((s) => s[0]);
  const ys = samples.map((s) => s[1]);
  const x0 = xs[0], x1 = xs[xs.length - 1] || 1;
  const lo = Math.min(...ys) - 5, hi = Math.max(...ys) + 5;
  const pts = samples.map(([x, y]) =>
    `${(P + ((x - x0) / (x1 - x0 || 1)) * (W - 2 * P)).toFixed(1)},${(H - P - ((y - lo) / (hi - lo || 1)) * (H - 2 * P)).toFixed(1)}`).join(' ');
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'hr-chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Hartslag tijdens de training');
  const line = document.createElementNS(SVG, 'polyline');
  line.setAttribute('points', pts);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'var(--danger)');
  line.setAttribute('stroke-width', '1.8');
  line.setAttribute('stroke-linejoin', 'round');
  svg.append(line);
  return svg;
}

const localDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const clock = (iso) => new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

function download(bytes, name) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/** Kaart 'Garmin' onder een training. */
export function garminCard(session, sessionSets, ex) {
  const body = h('div', { class: 'stack tight' });

  const fileIn = h('input', {
    type: 'file',
    accept: '.fit,.zip,application/zip,application/octet-stream',
    class: 'hidden',
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const bytes = await unzipFit(new Uint8Array(await file.arrayBuffer()));
        const hr = heartRateSummary(decodeFit(bytes));
        const day = localDate(hr.start);
        if (day !== session.date &&
            !confirm(`Deze Garmin-activiteit is van ${fmtDate(day)}, de training van ${fmtDate(session.date)}. Toch koppelen?`)) return;
        session.hr = { ...hr, fileName: file.name, importedAt: new Date().toISOString() };
        await db.put('sessions', session);
        toast('Hartslag gekoppeld ❤️');
        draw();
      } catch (err) {
        toast(`Lezen mislukt: ${err.message}`);
      }
    },
  });

  const exportBtn = h('button', {
    class: 'btn',
    onclick: () => {
      if (!sessionSets.length) return toast('Log eerst een set.');
      const bytes = encodeSessionFit(session, sessionSets, ex);
      download(bytes, `training-${session.date}.fit`);
      toast('Bestand opgeslagen. Importeer het in Garmin Connect.');
    },
  }, 'Exporteer naar Garmin (.fit)');

  function draw() {
    const hr = session.hr;
    fill(body,
      hr
        ? h('div', { class: 'stack tight' },
            h('div', { class: 'hr-stats' },
              hr.avg != null ? h('div', {}, h('b', {}, hr.avg), h('span', { class: 'muted small' }, 'gem. bpm')) : null,
              hr.max != null ? h('div', {}, h('b', {}, hr.max), h('span', { class: 'muted small' }, 'max bpm')) : null,
              hr.kcal != null ? h('div', {}, h('b', {}, hr.kcal), h('span', { class: 'muted small' }, 'kcal')) : null,
              hr.durationSec ? h('div', {}, h('b', {}, Math.round(hr.durationSec / 60)), h('span', { class: 'muted small' }, 'min')) : null,
            ),
            hrChart(hr.samples),
            h('p', { class: 'muted small flush' }, `Van je horloge, ${clock(hr.start)}${hr.durationSec ? `–${clock(new Date(Date.parse(hr.start) + hr.durationSec * 1000).toISOString())}` : ''}.`),
            h('div', { class: 'row' },
              h('button', { class: 'btn small ghost', onclick: () => fileIn.click() }, 'Ander bestand'),
              h('button', {
                class: 'btn small ghost danger',
                onclick: async () => { delete session.hr; await db.put('sessions', session); draw(); },
              }, 'Hartslag verwijderen'),
            ),
          )
        : h('button', { class: 'btn ghost', onclick: () => fileIn.click() }, '❤️ Hartslag uit Garmin toevoegen'),
      exportBtn,
      h('details', { class: 'small muted' },
        h('summary', {}, 'Hoe werkt dit?'),
        h('p', {}, h('b', {}, 'Naar Garmin: '),
          'tik op Exporteer en open daarna connect.garmin.com in je browser (de Garmin Connect-app kan geen bestanden importeren). ',
          'Kies rechtsboven ☁️ / + > Importeer gegevens en kies het .fit-bestand uit je Downloads. Je sets, reps en gewichten komen als krachttraining binnen. ',
          'Heb je de training ook op je horloge opgenomen? Dan krijg je hem dubbel; verwijder er dan één.'),
        h('p', {}, h('b', {}, 'Hartslag van je horloge: '),
          'start op je horloge een activiteit (bijv. Krachttraining) als je begint en stop hem als je klaar bent. ',
          'Open de activiteit op connect.garmin.com, kies ⚙️ > Exporteer origineel en kies hier dat bestand (de .zip mag ook). ',
          'Exporteer je de training daarna naar Garmin, dan zit de hartslag erin en kun je de horloge-activiteit verwijderen.'),
      ),
      fileIn,
    );
  }
  draw();

  return h('section', { class: 'card stack tight garmin' },
    h('h2', { class: 'flush' }, 'Garmin'),
    body,
  );
}
