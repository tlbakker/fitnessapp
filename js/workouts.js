// Vaste workouts: opgeslagen groepen oefeningen met een doel (sets × reps) per oefening.
import * as db from './db.js';
import { h, fill, toast } from './ui.js';
import { BASELINE } from './exercises.js';

/** De oefeningen van een workout als [{ exerciseId, sets, reps }]. */
export function templateItems(t) {
  if (!t) return [];
  if (t.items) return t.items;
  return (t.exerciseIds || []).map((exerciseId) => ({ exerciseId, sets: null, reps: null }));
}

/** Ingebouwde workouts (nulmeting) + eigen workouts, op naam. */
export async function allTemplates() {
  const own = (await db.getAll('templates')).sort((a, b) => a.name.localeCompare(b.name));
  return [...own, { ...BASELINE, builtin: true }];
}

export async function getTemplate(id) {
  if (!id) return null;
  if (id === BASELINE.id) return { ...BASELINE, builtin: true };
  return db.get('templates', id);
}

function targetLabel(item) {
  if (item.sets && item.reps) return `${item.sets} × ${item.reps}`;
  if (item.sets) return `${item.sets} sets`;
  if (item.reps) return `${item.reps} reps`;
  return '';
}

// ---------- Overzicht ----------

export async function viewWorkouts(ctx) {
  ctx.setTitle('Workouts');
  const templates = await allTemplates();
  return h('div', { class: 'stack' },
    h('a', { class: 'btn primary', href: '#/workout/nieuw' }, '+ Nieuwe workout'),
    templates.map((t) => workoutRow(t, ctx)),
    h('p', { class: 'muted small center' }, 'Tip: je kunt ook een gelogde training opslaan als workout, onderaan de training.'),
  );
}

export function workoutRow(t, ctx, { compact = false } = {}) {
  const items = templateItems(t);
  const names = items.map((i) => ctx.ex(i.exerciseId).name.replace(' (Technogym)', ''));
  return h('div', { class: 'card stack tight' },
    h('div', { class: 'row' },
      h('div', { class: 'grow' },
        h('div', { class: 'strong' }, t.name),
        h('div', { class: 'muted small' }, `${items.length} ${items.length === 1 ? 'oefening' : 'oefeningen'}`, compact ? '' : ` · ${names.slice(0, 4).join(', ')}${names.length > 4 ? ' …' : ''}`),
      ),
      t.builtin ? null : h('a', { class: 'icon', href: `#/workout/${t.id}`, 'aria-label': `${t.name} bewerken` }, '✏️'),
    ),
    h('button', { class: 'btn small', onclick: () => ctx.startSession(t) }, 'Start'),
  );
}

// ---------- Bewerken ----------

export async function viewWorkoutEdit(id, ctx) {
  const isNew = id === 'nieuw';
  const existing = isNew ? null : await db.get('templates', id);
  if (!isNew && !existing) {
    location.hash = '#/workouts';
    return h('div');
  }
  ctx.setTitle(isNew ? 'Nieuwe workout' : 'Workout bewerken');
  const t = existing
    ? structuredClone(existing)
    : { id: db.newId(), userId: db.USER_ID, name: '', items: [], createdAt: new Date().toISOString() };

  const nameIn = h('input', { type: 'text', value: t.name, placeholder: 'Bijv. Push, Benen, Full body A' });
  const list = h('div', { class: 'stack tight' });

  const num = (item, field, placeholder) =>
    h('input', {
      type: 'number',
      inputmode: 'numeric',
      min: 1,
      step: 1,
      value: item[field] ?? '',
      placeholder,
      'aria-label': placeholder,
      oninput: (e) => (item[field] = e.target.value === '' ? null : Number(e.target.value)),
    });

  function draw() {
    fill(list, 
      ...t.items.map((item, i) =>
        h('div', { class: 'card workout-item' },
          h('div', { class: 'row' },
            h('div', { class: 'grow strong' }, ctx.ex(item.exerciseId).name),
            h('button', { class: 'icon', 'aria-label': 'Omhoog', disabled: i === 0, onclick: () => { t.items.splice(i - 1, 0, t.items.splice(i, 1)[0]); draw(); } }, '↑'),
            h('button', { class: 'icon', 'aria-label': 'Omlaag', disabled: i === t.items.length - 1, onclick: () => { t.items.splice(i + 1, 0, t.items.splice(i, 1)[0]); draw(); } }, '↓'),
            h('button', { class: 'icon', 'aria-label': 'Verwijderen', onclick: () => { t.items.splice(i, 1); draw(); } }, '✕'),
          ),
          h('div', { class: 'row target' },
            h('label', { class: 'grow' }, h('span', { class: 'muted small' }, 'Sets'), num(item, 'sets', 'sets')),
            h('span', { class: 'muted' }, '×'),
            h('label', { class: 'grow' }, h('span', { class: 'muted small' }, 'Reps'), num(item, 'reps', 'reps')),
          ),
        ),
      ),
      t.items.length ? null : h('p', { class: 'muted center small' }, 'Nog geen oefeningen.'),
    );
  }
  draw();

  return h('div', { class: 'stack' },
    h('label', { class: 'card' }, h('span', { class: 'muted small' }, 'Naam'), nameIn),
    list,
    h('button', {
      class: 'btn',
      onclick: () => ctx.openPicker((exId) => {
        t.items.push({ exerciseId: exId, sets: 3, reps: 10 });
        draw();
      }),
    }, '+ Oefening toevoegen'),
    h('p', { class: 'muted small flush' }, 'Sets × reps is je doel. Tijdens de training zie je daarbij een voorgesteld gewicht op basis van je laatste geschatte 1RM.'),
    h('button', {
      class: 'btn primary',
      onclick: async () => {
        t.name = nameIn.value.trim();
        if (!t.name) return toast('Geef de workout een naam.');
        if (!t.items.length) return toast('Voeg minstens één oefening toe.');
        t.updatedAt = new Date().toISOString();
        await db.put('templates', t);
        toast('Workout opgeslagen');
        location.hash = '#/workouts';
      },
    }, 'Opslaan'),
    isNew
      ? null
      : h('button', {
          class: 'btn danger ghost',
          onclick: async () => {
            if (!confirm(`Workout "${t.name}" verwijderen? Gelogde trainingen blijven staan.`)) return;
            await db.del('templates', t.id);
            location.hash = '#/workouts';
          },
        }, 'Workout verwijderen'),
  );
}

/** Sla een (gelogde) training op als nieuwe workout. */
export function saveSessionAsWorkout(session, sessionSets, ctx) {
  const items = session.exerciseIds.map((exerciseId) => {
    const sets = sessionSets.filter((s) => s.exerciseId === exerciseId && s.reps);
    const target = session.targets?.[exerciseId];
    // Doel: wat er bij deze training als doel stond, anders wat je echt deed
    const reps = target?.reps ?? mostCommon(sets.map((s) => Number(s.reps)));
    return { exerciseId, sets: target?.sets ?? (sets.length || null), reps: reps ?? null };
  });
  const nameIn = h('input', { type: 'text', placeholder: 'Naam van de workout' });
  const close = () => overlay.remove();
  const overlay = h('div', { class: 'overlay' },
    h('div', { class: 'sheet short' },
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Opslaan als workout'), h('button', { class: 'icon', onclick: close, 'aria-label': 'Sluiten' }, '✕')),
      h('form', {
        class: 'stack',
        onsubmit: async (e) => {
          e.preventDefault();
          const name = nameIn.value.trim();
          if (!name) return;
          await db.put('templates', { id: db.newId(), userId: db.USER_ID, name, items, createdAt: new Date().toISOString() });
          close();
          toast(`Workout "${name}" opgeslagen`);
        },
      },
        nameIn,
        h('p', { class: 'muted small flush' }, items.map((i) => `${ctx.ex(i.exerciseId).name}${targetLabel(i) ? ` (${targetLabel(i)})` : ''}`).join(', ')),
        h('button', { class: 'btn primary', type: 'submit' }, 'Opslaan'),
      ),
    ),
  );
  document.body.append(overlay);
  nameIn.focus();
}

function mostCommon(values) {
  if (!values.length) return null;
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

export { targetLabel };
