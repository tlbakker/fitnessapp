// Vaste workouts: een trainingsvorm (zie schemes.js) plus een selectie oefeningen.
// Workouts zijn deelbaar via een link of bestand; gewichten gaan nooit mee, die rekent
// ieders app zelf uit de eigen geschatte 1RM.
import * as db from './db.js';
import { h, fill, toast, todayISO } from './ui.js';
import { BASELINE, BUILTIN_WORKOUTS } from './exercises.js';
import { FORMS, CUSTOM, formById, normalizeItem, itemLabel, packWorkout, encodeWorkout, decodeWorkout } from './schemes.js';

/** De oefeningen van een workout als [{ exerciseId, form, reps }] (form null = geen doel). */
export function templateItems(t) {
  if (!t) return [];
  if (t.items) return t.items.map((i) => normalizeItem(i, t.form));
  return (t.exerciseIds || []).map((exerciseId) => ({ exerciseId, form: null, reps: [] }));
}

/** Items zoals ze opgeslagen worden: alleen een eigen vorm/reps als die afwijkt van de workout. */
function storeItems(items, workoutForm) {
  return items.map((i) => {
    if (i.form === CUSTOM) return { exerciseId: i.exerciseId, form: CUSTOM, reps: i.reps.filter((r) => r > 0) };
    if (i.form && i.form !== workoutForm) return { exerciseId: i.exerciseId, form: i.form };
    return { exerciseId: i.exerciseId };
  });
}

const BUILTINS = [...BUILTIN_WORKOUTS, BASELINE].map((t) => ({ ...t, builtin: true }));

/** Eigen workouts op naam, daarna de standaardworkouts uit de app (incl. nulmeting). */
export async function allTemplates() {
  const own = (await db.getAll('templates')).sort((a, b) => a.name.localeCompare(b.name));
  return [...own, ...BUILTINS];
}

export async function getTemplate(id) {
  if (!id) return null;
  return BUILTINS.find((t) => t.id === id) ?? db.get('templates', id);
}

/** Kopieer een (standaard)workout naar je eigen workouts en open de editor. */
async function copyToOwn(t) {
  const own = await db.getAll('templates');
  let name = t.name;
  for (let n = 2; own.some((x) => x.name === name); n++) name = `${t.name} (${n})`;
  const copy = { id: db.newId(), userId: db.USER_ID, name, form: t.form ?? null, items: storeItems(templateItems(t), t.form), basedOn: t.id, createdAt: new Date().toISOString() };
  await db.put('templates', copy);
  toast('Gekopieerd naar je eigen workouts');
  location.hash = `#/workout/${copy.id}`;
}

// ---------- Overzicht ----------

export async function viewWorkouts(ctx) {
  ctx.setTitle('Workouts');
  const templates = await allTemplates();
  const fileIn = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'hidden',
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        decodeWorkout(text); // eerst controleren
        location.hash = `#/import/${encodeWorkout(JSON.parse(text))}`;
      } catch (err) {
        toast(err.message);
      }
    },
  });
  const own = templates.filter((t) => !t.builtin);
  const builtin = templates.filter((t) => t.builtin && t.id !== BASELINE.id);
  return h('div', { class: 'stack' },
    h('a', { class: 'btn primary', href: '#/workout/nieuw' }, '+ Nieuwe workout'),
    h('h2', {}, 'Mijn workouts'),
    own.length ? own.map((t) => workoutRow(t, ctx)) : h('p', { class: 'muted small flush' }, 'Nog geen eigen workouts. Maak er een, of kopieer een standaardworkout hieronder.'),
    h('h2', {}, 'Standaardworkouts'),
    h('p', { class: 'muted small flush' }, 'Deze zitten in de app zelf en krijgt iedereen via updates. Start ze direct, of kopieer er een om aan te passen.'),
    builtin.map((t) => workoutRow(t, ctx)),
    h('button', { class: 'btn ghost', onclick: () => fileIn.click() }, 'Workout importeren uit bestand'),
    fileIn,
    h('p', { class: 'muted small center' }, 'Tip: je kunt ook een gelogde training opslaan als workout, onderaan de training. Een gedeelde link opent vanzelf het importscherm.'),
  );
}

export function workoutRow(t, ctx, { compact = false } = {}) {
  const items = templateItems(t);
  const names = items.map((i) => ctx.ex(i.exerciseId).name.replace(' (Technogym)', ''));
  return h('div', { class: 'card stack tight' },
    h('div', { class: 'row' },
      h('div', { class: 'grow' },
        h('div', { class: 'strong' }, t.name),
        h('div', { class: 'muted small' }, formById(t.form) ? `${formById(t.form).name} · ` : '', `${items.length} ${items.length === 1 ? 'oefening' : 'oefeningen'}`, compact ? '' : ` · ${names.slice(0, 4).join(', ')}${names.length > 4 ? ' …' : ''}`),
        !compact && t.description ? h('div', { class: 'muted small' }, t.description) : null,
      ),
      t.builtin ? h('button', { class: 'icon', 'aria-label': `${t.name} kopiëren naar mijn workouts`, title: 'Kopiëren om aan te passen', onclick: () => copyToOwn(t) }, '📄') : null,
      t.builtin ? null : h('button', { class: 'icon', 'aria-label': `${t.name} delen`, onclick: () => openShare(t, ctx) }, '📤'),
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
    ? { ...structuredClone(existing), form: existing.form ?? null }
    : { id: db.newId(), userId: db.USER_ID, name: '', form: FORMS[0].id, items: [], createdAt: new Date().toISOString() };
  // Werk-items: form null = volgt de vorm van de workout
  let items = (t.items || []).map((i) => {
    const n = normalizeItem(i, null);
    return { ...n, form: n.form === t.form ? null : n.form };
  });

  const nameIn = h('input', { type: 'text', value: t.name, placeholder: 'Bijv. Push, Benen, Full body A' });
  const formList = h('div', { class: 'form-list' });
  const list = h('div', { class: 'stack tight' });

  function drawForms() {
    fill(formList,
      FORMS.map((f) =>
        h('button', {
          class: 'form-option' + (t.form === f.id ? ' chosen' : ''),
          type: 'button',
          'aria-pressed': String(t.form === f.id),
          onclick: () => { t.form = f.id; drawForms(); draw(); },
        },
          h('span', { class: 'strong' }, f.name),
          h('span', { class: 'muted small' }, f.description),
          h('span', { class: 'small form-preview' }, itemLabel({ form: f.id })),
        ),
      ),
    );
  }

  function formSelect(item) {
    const current = item.form ?? '';
    return h('select', {
      'aria-label': 'Vorm voor deze oefening',
      onchange: (e) => {
        const v = e.target.value;
        item.form = v || null;
        if (v === CUSTOM && !item.reps.length) {
          const base = formById(t.form)?.build();
          item.reps = base?.sets?.length ? base.sets.map((x) => x.reps || 10) : [10, 10, 10];
        }
        draw();
      },
    },
      h('option', { value: '', selected: current === '' }, `Vorm van de workout${formById(t.form) ? ` (${formById(t.form).name})` : ''}`),
      FORMS.map((f) => h('option', { value: f.id, selected: current === f.id }, f.name)),
      h('option', { value: CUSTOM, selected: current === CUSTOM }, 'Eigen reps per set'),
    );
  }

  function customReps(item) {
    return h('div', { class: 'set-targets' },
      item.reps.map((r, j) =>
        h('label', { class: 'set-target' },
          h('span', { class: 'muted small' }, `Set ${j + 1}`),
          h('input', {
            type: 'number', inputmode: 'numeric', min: 1, step: 1, value: r, 'aria-label': `Set ${j + 1} reps`,
            oninput: (e) => { item.reps[j] = Number(e.target.value) || 0; },
          }),
        ),
      ),
      h('div', { class: 'set-target-btns' },
        h('button', { class: 'icon', type: 'button', 'aria-label': 'Set toevoegen', onclick: () => { item.reps.push(item.reps[item.reps.length - 1] || 10); draw(); } }, '＋'),
        item.reps.length > 1 ? h('button', { class: 'icon', type: 'button', 'aria-label': 'Laatste set weghalen', onclick: () => { item.reps.pop(); draw(); } }, '－') : null,
      ),
    );
  }

  function draw() {
    fill(list,
      items.map((item, i) =>
        h('div', { class: 'card workout-item stack tight' },
          h('div', { class: 'row' },
            h('div', { class: 'grow' },
              h('div', { class: 'strong' }, ctx.ex(item.exerciseId).name),
              item.form === CUSTOM ? null : h('div', { class: 'muted small' }, itemLabel(item, t.form)),
            ),
            h('button', { class: 'icon', 'aria-label': 'Omhoog', disabled: i === 0, onclick: () => { items.splice(i - 1, 0, items.splice(i, 1)[0]); draw(); } }, '↑'),
            h('button', { class: 'icon', 'aria-label': 'Omlaag', disabled: i === items.length - 1, onclick: () => { items.splice(i + 1, 0, items.splice(i, 1)[0]); draw(); } }, '↓'),
            h('button', { class: 'icon', 'aria-label': 'Verwijderen', onclick: () => { items.splice(i, 1); draw(); } }, '✕'),
          ),
          formSelect(item),
          item.form === CUSTOM ? customReps(item) : null,
        ),
      ),
      items.length ? null : h('p', { class: 'muted center small' }, 'Nog geen oefeningen. Elke oefening die je toevoegt krijgt de gekozen vorm.'),
    );
  }
  drawForms();
  draw();

  return h('div', { class: 'stack' },
    h('label', { class: 'card' }, h('span', { class: 'muted small' }, 'Naam'), nameIn),
    h('h2', {}, '1. Trainingsvorm'),
    h('p', { class: 'muted small flush' }, 'Het gewicht per set rekent de app tijdens de training uit je eigen geschatte 1RM.'),
    formList,
    h('h2', {}, '2. Oefeningen'),
    list,
    h('button', {
      class: 'btn',
      onclick: () => ctx.openPicker((exId) => {
        items.push({ exerciseId: exId, form: null, reps: [] });
        draw();
      }),
    }, '+ Oefening toevoegen'),
    h('button', {
      class: 'btn primary',
      onclick: async () => {
        t.name = nameIn.value.trim();
        if (!t.name) return toast('Geef de workout een naam.');
        if (!items.length) return toast('Voeg minstens één oefening toe.');
        t.items = storeItems(items, t.form);
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

/** Sla een (gelogde) training op als nieuwe workout: de reps per set worden het doel. */
export function saveSessionAsWorkout(session, sessionSets, ctx) {
  const items = session.exerciseIds.map((exerciseId) => {
    const done = sessionSets.filter((s) => s.exerciseId === exerciseId && s.reps).sort((a, b) => a.idx - b.idx);
    const target = session.targets?.[exerciseId];
    if (done.length) return { exerciseId, form: CUSTOM, reps: done.map((s) => Number(s.reps)) };
    if (target?.form && target.form !== CUSTOM) return { exerciseId, form: target.form, reps: [] };
    return { exerciseId, form: target?.sets?.length ? CUSTOM : null, reps: target?.sets?.map((x) => x.reps).filter(Boolean) ?? [] };
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
          await db.put('templates', { id: db.newId(), userId: db.USER_ID, name, form: null, items: storeItems(items, null), createdAt: new Date().toISOString() });
          close();
          toast(`Workout "${name}" opgeslagen`);
        },
      },
        nameIn,
        h('p', { class: 'muted small flush' }, items.map((i) => `${ctx.ex(i.exerciseId).name}${itemLabel(i) ? ` (${itemLabel(i)})` : ''}`).join(', ')),
        h('button', { class: 'btn primary', type: 'submit' }, 'Opslaan'),
      ),
    ),
  );
  document.body.append(overlay);
  nameIn.focus();
}

// ---------- Delen ----------

async function openShare(t, ctx) {
  const custom = await db.getAll('exercises');
  const pack = packWorkout(t, custom);
  const url = `${location.origin}${location.pathname}#/import/${encodeWorkout(pack)}`;
  const text = `Workout "${t.name}" voor de fitnessapp. Open de link om hem te importeren; de gewichten rekent de app uit je eigen 1RM.`;
  const close = () => overlay.remove();
  const overlay = h('div', { class: 'overlay' },
    h('div', { class: 'sheet short' },
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, `"${t.name}" delen`), h('button', { class: 'icon', onclick: close, 'aria-label': 'Sluiten' }, '✕')),
      h('div', { class: 'stack' },
        h('p', { class: 'muted small flush' }, 'Alleen de oefeningen en het rep-schema worden gedeeld, geen gewichten of trainingen.'),
        navigator.share
          ? h('button', {
              class: 'btn primary',
              onclick: async () => {
                try {
                  await navigator.share({ title: t.name, text, url });
                  close();
                } catch { /* geannuleerd */ }
              },
            }, 'Deel link (WhatsApp e.d.)')
          : null,
        h('button', {
          class: navigator.share ? 'btn' : 'btn primary',
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast('Link gekopieerd');
            } catch {
              prompt('Kopieer deze link:', url);
            }
          },
        }, 'Kopieer link'),
        h('button', {
          class: 'btn ghost',
          onclick: () => {
            const blob = new Blob([JSON.stringify(pack, null, 1)], { type: 'application/json' });
            const safe = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workout';
            const a = h('a', { href: URL.createObjectURL(blob), download: `workout-${safe}.json` });
            document.body.append(a);
            a.click();
            a.remove();
          },
        }, 'Download als bestand'),
      ),
    ),
  );
  document.body.append(overlay);
}

/** Importscherm voor een gedeelde link (#/import/<code>). */
export async function viewImport(code, ctx) {
  ctx.setTitle('Workout importeren');
  let data;
  try {
    data = decodeWorkout(code);
  } catch (err) {
    return h('div', { class: 'card' }, h('p', {}, err.message), h('a', { class: 'btn', href: '#/workouts' }, 'Naar workouts'));
  }
  const existingNames = new Set((await db.getAll('templates')).map((t) => t.name));
  let name = data.name;
  for (let n = 2; existingNames.has(name); n++) name = `${data.name} (${n})`;
  const nameIn = h('input', { type: 'text', value: name });
  const ownCustom = new Set((await db.getAll('exercises')).map((e) => e.id));
  const exName = (id) => data.custom.find((c) => c.id === id)?.name ?? ctx.ex(id).name;

  return h('div', { class: 'stack' },
    h('div', { class: 'card stack tight' },
      h('p', { class: 'muted small flush' }, 'Iemand heeft een workout met je gedeeld. De gewichten rekent jouw app uit jouw eigen geschatte 1RM; doe eventueel eerst de nulmeting.'),
      h('label', {}, h('span', { class: 'muted small' }, 'Naam'), nameIn),
      formById(data.form) ? h('div', { class: 'small' }, h('span', { class: 'muted' }, 'Vorm: '), formById(data.form).name) : null,
    ),
    h('div', { class: 'card' },
      h('table', { class: 'data' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Oefening'), h('th', { class: 'num' }, 'Doel'))),
        h('tbody', {}, data.items.map((i) => h('tr', {}, h('td', {}, exName(i.exerciseId)), h('td', { class: 'num' }, itemLabel(i, data.form) || '–')))),
      ),
    ),
    h('button', {
      class: 'btn primary',
      onclick: async () => {
        for (const c of data.custom) {
          if (!ownCustom.has(c.id)) await db.put('exercises', { ...c, userId: db.USER_ID, secondary: [], aka: '', builtin: false });
        }
        await ctx.reloadExercises();
        const t = {
          id: db.newId(),
          userId: db.USER_ID,
          name: nameIn.value.trim() || data.name,
          form: data.form,
          items: data.items,
          createdAt: new Date().toISOString(),
          importedAt: todayISO(),
        };
        await db.put('templates', t);
        toast('Workout geïmporteerd');
        location.hash = `#/workout/${t.id}`;
      },
    }, 'Importeren'),
    h('a', { class: 'btn ghost', href: '#/workouts' }, 'Annuleren'),
  );
}
