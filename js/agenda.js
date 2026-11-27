// Agenda: maandoverzicht van uitgevoerde en geplande trainingen.
// Een geplande training telt pas als gedaan wanneer er echt sets voor gelogd zijn.
import * as db from './db.js';
import { h, fill, todayISO, fmtDate, sortSessions, toast } from './ui.js';
import { allTemplates } from './workouts.js';

let month = null; // 'YYYY-MM'
let selected = null; // 'YYYY-MM-DD'

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Status van een planning: 'done' (gelogd), 'missed' (datum voorbij, niet gelogd) of 'planned'.
 * Gedaan = de training die vanuit deze planning is gestart heeft sets, of er is op die dag
 * een training van dezelfde workout met sets.
 */
export function planStatus(plan, sessions, setCountBySession, today = todayISO()) {
  const hasSets = (s) => s && (setCountBySession.get(s.id) || 0) > 0;
  const linked = plan.sessionId && sessions.find((s) => s.id === plan.sessionId);
  if (hasSets(linked)) return { status: 'done', session: linked };
  const sameDay = sessions.find((s) => s.date === plan.date && s.templateId === plan.templateId && hasSets(s));
  if (sameDay) return { status: 'done', session: sameDay };
  if (plan.date < today) return { status: 'missed', session: linked || null };
  return { status: 'planned', session: linked || null };
}

const STATUS_LABEL = { done: 'gedaan', missed: 'niet gedaan', planned: 'gepland' };

async function loadData() {
  const sessions = await db.getAll('sessions');
  const sets = await db.getAll('sets');
  const plans = await db.getAll('plans');
  const setCountBySession = new Map();
  for (const s of sets) if (s.reps) setCountBySession.set(s.sessionId, (setCountBySession.get(s.sessionId) || 0) + 1);
  return { sessions, sets, plans, setCountBySession };
}

/** Alle plannen van vandaag met hun status (ook al gedane). */
export async function plannedToday() {
  const { sessions, plans, setCountBySession } = await loadData();
  const today = todayISO();
  return plans
    .filter((p) => p.date === today)
    .map((p) => ({ plan: p, ...planStatus(p, sessions, setCountBySession, today) }));
}

export async function viewAgenda(ctx) {
  ctx.setTitle('Agenda');
  const today = todayISO();
  if (!month) month = today.slice(0, 7);
  if (!selected) selected = today;
  const { sessions, sets, plans, setCountBySession } = await loadData();
  const templates = new Map((await allTemplates()).map((t) => [t.id, t]));

  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // maandag = 0

  const byDate = new Map();
  const slot = (d) => byDate.get(d) || byDate.set(d, { done: 0, planned: 0, missed: 0 }).get(d);
  for (const s of sessions) if ((setCountBySession.get(s.id) || 0) > 0) slot(s.date).done++;
  for (const p of plans) {
    const st = planStatus(p, sessions, setCountBySession, today).status;
    if (st !== 'done') slot(p.date)[st]++;
  }

  const go = (delta) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    month = d.toISOString().slice(0, 7);
    ctx.render();
  };

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(h('div', { class: 'day empty' }));
  for (let d = 1; d <= daysInMonth; d++) {
    const date = iso(y, m, d);
    const info = byDate.get(date);
    const marks = [];
    if (info?.done) marks.push(h('span', { class: 'mark done', title: 'Training gedaan' }));
    if (info?.planned) marks.push(h('span', { class: 'mark planned', title: 'Gepland' }));
    if (info?.missed) marks.push(h('span', { class: 'mark missed', title: 'Gepland, niet gedaan' }));
    cells.push(h('button', {
      class: `day${date === today ? ' today' : ''}${date === selected ? ' selected' : ''}`,
      'aria-label': `${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}${info?.done ? ', training gedaan' : ''}${info?.planned ? ', gepland' : ''}${info?.missed ? ', niet gedaan' : ''}`,
      onclick: () => {
        selected = date;
        ctx.render();
      },
    }, h('span', { class: 'num' }, String(d)), h('span', { class: 'marks' }, marks)));
  }

  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });

  const calendar = h('div', { class: 'card' },
    h('div', { class: 'row cal-head' },
      h('button', { class: 'icon', 'aria-label': 'Vorige maand', onclick: () => go(-1) }, '‹'),
      h('div', { class: 'grow center strong cap' }, monthLabel),
      h('button', { class: 'icon', 'aria-label': 'Volgende maand', onclick: () => go(1) }, '›'),
    ),
    h('div', { class: 'cal' },
      ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((d) => h('div', { class: 'dow muted small' }, d)),
      cells,
    ),
    h('div', { class: 'legend muted small' },
      h('span', {}, h('span', { class: 'mark done' }), ' gedaan'),
      h('span', {}, h('span', { class: 'mark planned' }), ' gepland'),
      h('span', {}, h('span', { class: 'mark missed' }), ' niet gedaan'),
    ),
  );

  // Geselecteerde dag
  const daySessions = sortSessions(sessions.filter((s) => s.date === selected));
  const dayPlans = plans.filter((p) => p.date === selected);
  const dayPanel = h('div', { class: 'stack' },
    h('h2', { class: 'cap' }, fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })),
    dayPlans.map((p) => {
      const t = templates.get(p.templateId);
      const st = planStatus(p, sessions, setCountBySession, today);
      return h('div', { class: 'card row' },
        h('div', { class: 'grow' },
          h('div', { class: 'strong' }, t?.name ?? 'Verwijderde workout', h('span', { class: `pill status-${st.status}` }, STATUS_LABEL[st.status])),
          st.status === 'missed' ? h('div', { class: 'muted small' }, 'Telt pas als gedaan wanneer je hem logt.') : null,
        ),
        st.status === 'done'
          ? h('a', { class: 'btn small', href: `#/sessie/${st.session.id}` }, 'Bekijk')
          : t
            ? h('button', { class: 'btn small', onclick: () => ctx.startSession(t, { planId: p.id }) }, st.session ? 'Verder' : 'Start')
            : null,
        h('button', {
          class: 'icon',
          'aria-label': 'Planning verwijderen',
          onclick: async () => {
            if (!confirm('Deze planning verwijderen?')) return;
            await db.del('plans', p.id);
            ctx.render();
          },
        }, '✕'),
      );
    }),
    daySessions.filter((s) => !dayPlans.some((p) => planStatus(p, sessions, setCountBySession, today).session?.id === s.id)).map((s) => ctx.sessionRow(s, sets)),
    !dayPlans.length && !daySessions.length ? h('p', { class: 'muted small flush' }, 'Niets op deze dag.') : null,
    h('button', { class: 'btn', onclick: () => openPlanSheet(selected, ctx) }, '+ Workout plannen'),
  );

  // Alle trainingen van deze maand als lijst
  const monthSessions = sortSessions(sessions.filter((s) => s.date.startsWith(month)));

  return h('div', { class: 'stack' },
    calendar,
    dayPanel,
    monthSessions.length ? h('h2', { class: 'cap' }, `Trainingen in ${monthLabel}`) : null,
    monthSessions.map((s) => ctx.sessionRow(s, sets)),
  );
}

async function openPlanSheet(date, ctx) {
  const templates = await allTemplates();
  const close = () => overlay.remove();
  let templateId = templates[0]?.id;
  const dateIn = h('input', { type: 'date', value: date });
  const repeatSel = h('select', {},
    h('option', { value: '1' }, 'Eenmalig'),
    [4, 8, 12].map((n) => h('option', { value: String(n) }, `Wekelijks, ${n} weken`)),
  );
  const list = h('div', { class: 'stack tight' });
  const draw = () =>
    fill(list, 
      ...templates.map((t) =>
        h('button', { class: 'picker-item' + (t.id === templateId ? ' chosen' : ''), type: 'button', onclick: () => { templateId = t.id; draw(); } },
          h('span', {}, t.name),
          h('span', { class: 'muted small' }, `${(t.items || t.exerciseIds).length === 1 ? '1 oefening' : `${(t.items || t.exerciseIds).length} oefeningen`}`),
        ),
      ),
    );
  draw();

  const overlay = h('div', { class: 'overlay' },
    h('div', { class: 'sheet' },
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Workout plannen'), h('button', { class: 'icon', onclick: close, 'aria-label': 'Sluiten' }, '✕')),
      h('div', { class: 'sheet-scroll stack' },
        templates.length > 1 ? null : h('p', { class: 'muted small flush' }, 'Maak eerst een eigen workout via Training → Workouts beheren.'),
        list,
        h('label', {}, h('span', { class: 'muted small' }, 'Datum'), dateIn),
        h('label', {}, h('span', { class: 'muted small' }, 'Herhalen'), repeatSel),
        h('button', {
          class: 'btn primary',
          onclick: async () => {
            if (!templateId || !dateIn.value) return;
            const n = Number(repeatSel.value);
            for (let i = 0; i < n; i++) {
              await db.put('plans', {
                id: db.newId(),
                userId: db.USER_ID,
                date: addDays(dateIn.value, i * 7),
                templateId,
                sessionId: null,
                note: '',
              });
            }
            close();
            toast(n > 1 ? `${n} trainingen gepland` : 'Training gepland');
            ctx.render();
          },
        }, 'Plannen'),
      ),
    ),
  );
  document.body.append(overlay);
}

