// Voortgang: kracht/uithouding per oefening en lichaamsmetingen.
import * as db from './db.js';
import { h, todayISO, fmtDate, sortSessions, toast } from './ui.js';
import { fmt, performance, pctChange } from './calc.js';
import { BASELINE, groupLabel } from './exercises.js';
import { lineChart } from './chart.js';

export const BODY_METRICS = [
  { key: 'weight', label: 'Gewicht', unit: 'kg', step: '0.1' },
  { key: 'fatPct', label: 'Vetpercentage', unit: '%', step: '0.1' },
  { key: 'muscleKg', label: 'Spiermassa', unit: 'kg', step: '0.1' },
  { key: 'waistCm', label: 'Buikomtrek', unit: 'cm', step: '0.5' },
  { key: 'visceral', label: 'Visceraal vet', unit: '', step: '0.5' },
];

const UNIT_LABEL = { kg: 'kg (geschatte 1RM)', reps: 'herhalingen', s: 'seconden' };

let selectedExercise = null;

/** Per oefening: lijst van { session, value, unit, kind } oplopend op datum. */
function performanceByExercise(sessions, sets, ex) {
  const bySession = new Map();
  for (const s of sets) {
    const k = `${s.sessionId}|${s.exerciseId}`;
    if (!bySession.has(k)) bySession.set(k, []);
    bySession.get(k).push(s);
  }
  const out = new Map();
  const ordered = sortSessions([...sessions]).reverse();
  for (const sess of ordered) {
    for (const exId of sess.exerciseIds) {
      const list = bySession.get(`${sess.id}|${exId}`);
      if (!list) continue;
      const p = performance(list, ex(exId).metric);
      if (!p) continue;
      if (!out.has(exId)) out.set(exId, []);
      out.get(exId).push({ session: sess, ...p });
    }
  }
  return out;
}

function changeLabel(pct, digits = 0) {
  if (pct == null) return '';
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '±';
  return `${sign}${Math.abs(pct).toFixed(digits).replace('.', ',')}%`;
}

export async function viewProgress({ ex, setTitle, render }) {
  setTitle('Voortgang');
  const sessions = await db.getAll('sessions');
  const sets = await db.getAll('sets');
  const measurements = (await db.getAll('measurements')).sort((a, b) => a.date.localeCompare(b.date));
  const perf = performanceByExercise(sessions, sets, ex);

  return h('div', { class: 'stack' },
    h('h2', {}, 'Kracht & uithouding'),
    baselineCard(sessions, sets, perf, ex),
    exerciseChartCard(perf, ex),
    h('h2', {}, 'Lichaam'),
    bodyCard(measurements, render),
  );
}

// ---------- Nulmeting vs. nu ----------

function baselineCard(sessions, sets, perf, ex) {
  const baselines = sortSessions(sessions.filter((s) => s.templateId === BASELINE.id)).reverse();
  if (!baselines.length) {
    return h('div', { class: 'card small muted' },
      'Doe eerst een nulmeting (op het tabblad Training). Daarna zie je hier per spiergroep je startniveau en hoe je ervoor staat.');
  }
  const first = baselines[0];
  const rows = [];
  for (const exId of BASELINE.exerciseIds) {
    const list = perf.get(exId) || [];
    // Startwaarde: uit de eerste nulmeting, of anders de eerste keer na de nulmeting
    // (handig als je de nulmeting over twee dagen hebt verdeeld).
    const start = list.find((p) => p.session.id === first.id) || list.find((p) => p.session.date >= first.date);
    const last = list[list.length - 1];
    const e = ex(exId);
    rows.push(h('tr', {},
      h('td', {}, h('a', { href: `#/oefening/${encodeURIComponent(exId)}` }, e.name.replace(' (Technogym)', '')), h('div', { class: 'muted small' }, groupLabel(e.group))),
      h('td', { class: 'num' }, start ? `${fmt(start.value)} ${start.unit}` : '–'),
      h('td', { class: 'num' }, last && last !== start ? `${fmt(last.value)} ${last.unit}` : '–'),
      h('td', { class: 'num strong' }, start && last && last !== start && start.kind === last.kind ? changeLabel(pctChange(start.value, last.value)) : ''),
    ));
  }
  return h('div', { class: 'card' },
    h('div', { class: 'row' },
      h('div', { class: 'grow strong' }, 'Nulmeting en nu'),
      h('div', { class: 'muted small' }, `sinds ${fmtDate(first.date, { day: 'numeric', month: 'short', year: 'numeric' })}`),
    ),
    h('p', { class: 'muted small' }, 'Gewichtsoefeningen: geschatte 1RM (Epley). Zonder gewicht: meeste herhalingen of seconden.'),
    h('table', { class: 'data' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Oefening'), h('th', { class: 'num' }, 'Start'), h('th', { class: 'num' }, 'Laatst'), h('th', { class: 'num' }, '±'))),
      h('tbody', {}, rows),
    ),
  );
}

// ---------- Grafiek per oefening ----------

function exerciseChartCard(perf, ex) {
  const used = [...perf.keys()].sort((a, b) => ex(a).name.localeCompare(ex(b).name));
  if (!used.length) return h('div', { class: 'card small muted' }, 'Nog geen gelogde oefeningen.');
  if (!selectedExercise || !perf.has(selectedExercise)) {
    // Standaard: de oefening die het vaakst gelogd is
    selectedExercise = used.reduce((a, b) => (perf.get(b).length > perf.get(a).length ? b : a), used[0]);
  }
  const body = h('div');
  const draw = () => {
    const list = perf.get(selectedExercise);
    // Alleen punten van hetzelfde soort meten (bijv. niet 1RM en max. reps door elkaar)
    const kind = list[list.length - 1].kind;
    const pts = list.filter((p) => p.kind === kind);
    const unit = pts[0].unit;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const best = pts.reduce((m, p) => (p.value > m.value ? p : m), pts[0]);
    body.replaceChildren(
      h('div', { class: 'stats' },
        h('div', {}, h('div', { class: 'stat' }, `${fmt(last.value)}`), h('div', { class: 'muted small' }, `Laatst (${unit})`)),
        h('div', {}, h('div', { class: 'stat' }, `${fmt(best.value)}`), h('div', { class: 'muted small' }, `Beste (${unit})`)),
        h('div', {}, h('div', { class: 'stat' }, pts.length > 1 ? changeLabel(pctChange(first.value, last.value)) : '–'), h('div', { class: 'muted small' }, 'Sinds start')),
      ),
      lineChart(pts.map((p) => ({ date: p.session.date, value: p.value })), {
        unit,
        label: `${ex(selectedExercise).name}: ${UNIT_LABEL[unit]} per training`,
      }),
      h('p', { class: 'muted small flush' }, `${UNIT_LABEL[unit]} per training`),
    );
  };
  const select = h('select', {
    onchange: (e) => {
      selectedExercise = e.target.value;
      draw();
    },
  }, used.map((id) => h('option', { value: id, selected: id === selectedExercise }, ex(id).name)));
  draw();
  return h('div', { class: 'card stack' }, select, body);
}

// ---------- Lichaamsmetingen ----------

function bodyCard(measurements, render) {
  const addBtn = h('button', { class: 'btn', onclick: () => openMeasurement(null, render) }, '+ Meting toevoegen');
  if (!measurements.length) {
    return h('div', { class: 'stack' },
      h('div', { class: 'card small muted' }, 'Voeg een meting toe wanneer je je meet, bijvoorbeeld op de weegschaal in de sportschool. Alle velden zijn optioneel.'),
      addBtn,
    );
  }
  const charts = [];
  for (const m of BODY_METRICS) {
    const pts = measurements.filter((x) => x[m.key] != null).map((x) => ({ date: x.date, value: x[m.key] }));
    if (!pts.length) continue;
    const first = pts[0].value;
    const last = pts[pts.length - 1].value;
    const diff = last - first;
    charts.push(h('div', { class: 'card' },
      h('div', { class: 'row' },
        h('div', { class: 'grow strong' }, m.label),
        h('div', { class: 'right' },
          h('span', { class: 'stat' }, `${fmt(last)} ${m.unit}`.trim()),
          pts.length > 1 ? h('div', { class: 'muted small' }, `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${fmt(Math.abs(diff))} ${m.unit} sinds start`.trim()) : null,
        ),
      ),
      pts.length > 1 ? lineChart(pts, { unit: m.unit, label: `${m.label} over tijd` }) : null,
    ));
  }
  const list = [...measurements].reverse().map((x) =>
    h('button', { class: 'card row link list-btn', onclick: () => openMeasurement(x, render) },
      h('div', { class: 'grow' },
        h('div', { class: 'strong' }, fmtDate(x.date)),
        h('div', { class: 'muted small' },
          BODY_METRICS.filter((m) => x[m.key] != null).map((m) => `${m.label} ${fmt(x[m.key])}${m.unit ? ' ' + m.unit : ''}`).join(' · ') || x.note || ''),
      ),
    ));
  return h('div', { class: 'stack' }, addBtn, charts, h('details', { class: 'card' }, h('summary', { class: 'strong' }, `Alle metingen (${measurements.length})`), h('div', { class: 'stack tight list' }, list)));
}

function openMeasurement(existing, render) {
  const dateIn = h('input', { type: 'date', value: existing?.date ?? todayISO(), required: true });
  const inputs = BODY_METRICS.map((m) => [m, h('input', { type: 'number', inputmode: 'decimal', step: m.step, min: 0, value: existing?.[m.key] ?? '', placeholder: m.unit || '' })]);
  const noteIn = h('input', { type: 'text', value: existing?.note ?? '', placeholder: 'Bijv. weegschaal sportschool, nuchter' });
  const close = () => overlay.remove();
  const form = h('form', {
    class: 'stack',
    onsubmit: async (ev) => {
      ev.preventDefault();
      const rec = {
        id: existing?.id ?? db.newId(),
        userId: db.USER_ID,
        date: dateIn.value || todayISO(),
        note: noteIn.value.trim(),
      };
      let any = false;
      for (const [m, input] of inputs) {
        rec[m.key] = input.value === '' ? null : Number(input.value);
        if (rec[m.key] != null) any = true;
      }
      if (!any) return toast('Vul minstens één waarde in.');
      await db.put('measurements', rec);
      close();
      toast('Meting opgeslagen');
      render();
    },
  },
    h('label', {}, h('span', { class: 'muted small' }, 'Datum'), dateIn),
    h('div', { class: 'grid2' }, inputs.map(([m, input]) => h('label', {}, h('span', { class: 'muted small' }, `${m.label}${m.unit ? ` (${m.unit})` : ''}`), input))),
    h('label', {}, h('span', { class: 'muted small' }, 'Notitie'), noteIn),
    h('button', { class: 'btn primary', type: 'submit' }, 'Opslaan'),
    existing
      ? h('button', {
          class: 'btn danger ghost',
          type: 'button',
          onclick: async () => {
            if (!confirm('Deze meting verwijderen?')) return;
            await db.del('measurements', existing.id);
            close();
            render();
          },
        }, 'Verwijderen')
      : null,
  );
  const overlay = h('div', { class: 'overlay' },
    h('div', { class: 'sheet' },
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, existing ? 'Meting bewerken' : 'Nieuwe meting'), h('button', { class: 'icon', type: 'button', onclick: close, 'aria-label': 'Sluiten' }, '✕')),
      h('div', { class: 'sheet-scroll' }, form),
    ),
  );
  document.body.append(overlay);
}
