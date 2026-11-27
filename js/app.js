import { BUILTIN_EXERCISES, MUSCLE_GROUPS, EQUIPMENT, groupLabel, BASELINE, TEMPLATES } from './exercises.js';
import { epley1RM, bestSet, volume, fmt, weightForReps, roundTo, REP_TARGETS } from './calc.js';
import * as db from './db.js';
import { h, todayISO, fmtDate, setLabel, sortSessions, toast } from './ui.js';
import { viewProgress } from './progress.js';

const $app = document.getElementById('app');
const $title = document.getElementById('title');

// ---------- oefeningen ----------

let exerciseMap = new Map();

async function loadExercises() {
  const custom = await db.getAll('exercises');
  exerciseMap = new Map();
  for (const e of BUILTIN_EXERCISES) exerciseMap.set(e.id, e);
  for (const e of custom) exerciseMap.set(e.id, e);
}

function ex(id) {
  return exerciseMap.get(id) || { id, name: 'Onbekende oefening', group: '', metric: 'reps' };
}

function allExercises() {
  return [...exerciseMap.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function matches(e, q) {
  if (!q) return true;
  const hay = `${e.name} ${e.aka || ''} ${groupLabel(e.group)} ${EQUIPMENT[e.equipment] || ''}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

/** Oefening-id's gesorteerd op laatst gebruikt. */
async function recentExerciseIds(limit = 12) {
  const sessions = sortSessions(await db.getAll('sessions'));
  const seen = [];
  for (const s of sessions) {
    for (const id of s.exerciseIds) if (!seen.includes(id) && exerciseMap.has(id)) seen.push(id);
    if (seen.length >= limit) break;
  }
  return seen.slice(0, limit);
}

// ---------- router ----------

const routes = [
  [/^#?\/?$/, viewTraining],
  [/^#\/training$/, viewTraining],
  [/^#\/sessie\/(.+)$/, (id) => viewSession(id)],
  [/^#\/geschiedenis$/, viewHistory],
  [/^#\/voortgang$/, () => viewProgress({ ex, setTitle, render })],
  [/^#\/oefeningen$/, viewExercises],
  [/^#\/oefening\/(.+)$/, (id) => viewExercise(decodeURIComponent(id))],
  [/^#\/meer$/, viewMore],
];

async function render() {
  const hash = location.hash || '#/';
  for (const [re, fn] of routes) {
    const m = hash.match(re);
    if (m) {
      const tab = hash.split('/')[1] || 'training';
      document.querySelectorAll('nav a').forEach((a) => {
        const t = a.getAttribute('href').split('/')[1];
        const active = t === tab || (t === 'training' && tab === 'sessie') || (t === 'oefeningen' && tab === 'oefening');
        a.classList.toggle('active', active);
      });
      const node = await fn(...m.slice(1));
      $app.replaceChildren(node);
      window.scrollTo(0, 0);
      return;
    }
  }
  location.hash = '#/';
}

function setTitle(t) {
  $title.textContent = t;
  document.title = t === 'Fitness' ? 'Fitness' : `${t} · Fitness`;
}

// ---------- Training ----------

async function activeSession() {
  const sessions = sortSessions(await db.getAll('sessions'));
  return sessions.find((s) => !s.finishedAt);
}

async function startSession(template) {
  const s = {
    id: db.newId(),
    userId: db.USER_ID,
    date: todayISO(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exerciseIds: template?.exerciseIds ? [...template.exerciseIds] : [],
    note: '',
    templateId: template?.id ?? null,
  };
  await db.put('sessions', s);
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  location.hash = `#/sessie/${s.id}`;
}

async function viewTraining() {
  const active = await activeSession();
  if (active) return viewSession(active.id);
  setTitle('Training');
  const sessions = sortSessions(await db.getAll('sessions')).slice(0, 3);
  const sets = await db.getAll('sets');
  return h(
    'div',
    { class: 'stack' },
    h('div', { class: 'card hero' },
      h('p', { class: 'muted' }, fmtDate(todayISO(), { weekday: 'long', day: 'numeric', month: 'long' })),
      h('button', { class: 'btn primary big', onclick: () => startSession() }, 'Start training'),
    ),
    h('div', { class: 'card stack tight' },
      h('div', { class: 'strong' }, 'Nulmeting'),
      h('p', { class: 'small muted flush' }, `${BASELINE.exerciseIds.length} basisoefeningen, één per spiergroep. Hiermee bepaal je je startniveau en geschatte 1RM; het overzicht staat daarna onder Voortgang.`),
      h('button', { class: 'btn', onclick: () => startSession(BASELINE) }, 'Nulmeting starten'),
    ),
    sessions.length ? h('h2', {}, 'Laatste trainingen') : h('p', { class: 'muted center' }, 'Nog geen trainingen gelogd. Succes met je eerste!'),
    sessions.map((s) => sessionRow(s, sets)),
  );
}

function sessionRow(s, allSets) {
  const sets = allSets.filter((x) => x.sessionId === s.id);
  const names = s.exerciseIds.map((id) => ex(id).name.replace(' (Technogym)', ''));
  return h('a', { class: 'card row link', href: `#/sessie/${s.id}` },
    h('div', { class: 'grow' },
      h('div', { class: 'strong' }, fmtDate(s.date), !s.finishedAt ? h('span', { class: 'pill' }, 'bezig') : null),
      h('div', { class: 'muted small' }, names.length ? names.slice(0, 4).join(', ') + (names.length > 4 ? ` +${names.length - 4}` : '') : 'Geen oefeningen'),
    ),
    h('div', { class: 'right small muted' }, sets.length === 1 ? '1 set' : `${sets.length} sets`, h('br'), `${fmt(volume(sets))} kg`),
  );
}

// ---------- Sessie-editor ----------

async function viewSession(id) {
  const session = await db.get('sessions', id);
  if (!session) {
    location.hash = '#/';
    return h('div');
  }
  setTitle(session.finishedAt ? 'Training' : 'Training bezig');
  const allSets = await db.getAll('sets');
  const allSessions = await db.getAll('sessions');
  const sessionSets = allSets.filter((s) => s.sessionId === id);

  const save = () => db.put('sessions', session);

  const dateInput = h('input', {
    type: 'date',
    value: session.date,
    onchange: async (e) => {
      if (!e.target.value) return;
      session.date = e.target.value;
      await save();
    },
  });

  const vol = h('span');
  function refreshSummary() {
    vol.textContent = `${sessionSets.length} sets · ${fmt(volume(sessionSets))} kg volume`;
  }
  refreshSummary();

  const list = h('div', { class: 'stack' });
  for (const exId of session.exerciseIds) {
    list.append(exerciseCard(session, exId, sessionSets, allSets, allSessions, save, refreshSummary));
  }

  const addBtn = h('button', {
    class: 'btn',
    onclick: () =>
      openPicker(async (exId) => {
        // Klap oefeningen met sets in, zodat je direct bij de nieuwe bent.
        const done = new Set(sessionSets.map((x) => x.exerciseId));
        session.collapsed = [...new Set([...(session.collapsed || []), ...session.exerciseIds.filter((x) => done.has(x))])];
        if (!session.exerciseIds.includes(exId)) session.exerciseIds.push(exId);
        session.collapsed = session.collapsed.filter((x) => x !== exId);
        await save();
        render();
      }),
  }, '+ Oefening toevoegen');

  const finishBtn = session.finishedAt
    ? h('button', { class: 'btn ghost', onclick: async () => { session.finishedAt = null; await save(); render(); } }, 'Training heropenen')
    : h('button', {
        class: 'btn primary',
        onclick: async () => {
          session.finishedAt = new Date().toISOString();
          await save();
          toast('Training opgeslagen 💪');
          location.hash = '#/geschiedenis';
        },
      }, 'Training afronden');

  const deleteBtn = h('button', {
    class: 'btn danger ghost',
    onclick: async () => {
      if (!confirm('Deze training en alle sets verwijderen?')) return;
      await db.deleteSession(id);
      location.hash = '#/';
    },
  }, 'Training verwijderen');


  const allCollapsed = () => session.exerciseIds.length && session.exerciseIds.every((x) => (session.collapsed || []).includes(x));
  const collapseAllBtn = h('button', {
    class: 'btn small ghost',
    onclick: async () => {
      session.collapsed = allCollapsed() ? [] : [...session.exerciseIds];
      await save();
      list.querySelectorAll('.exercise').forEach((c) => {
        c.classList.toggle('collapsed', session.collapsed.includes(c.dataset.ex));
        c.updateSummary?.();
      });
      collapseAllBtn.textContent = allCollapsed() ? 'Alles uitklappen' : 'Alles inklappen';
    },
  }, allCollapsed() ? 'Alles uitklappen' : 'Alles inklappen');

  const template = session.templateId ? TEMPLATES.find((t) => t.id === session.templateId) : null;

  return h('div', { class: 'stack' },
    h('div', { class: 'card row' },
      h('label', { class: 'grow' }, h('span', { class: 'muted small' }, 'Datum'), dateInput),
      h('div', { class: 'right small muted' }, vol),
    ),
    template
      ? h('details', { class: 'card info', open: !sessionSets.length },
          h('summary', { class: 'strong' }, `${template.name}: zo pak je het aan`),
          h('div', { class: 'small', html: template.instructions }),
        )
      : null,
    session.exerciseIds.length > 1 ? h('div', { class: 'row end' }, collapseAllBtn) : null,
    session.exerciseIds.length ? null : h('p', { class: 'muted center' }, 'Voeg je eerste oefening toe.'),
    list,
    addBtn,
    h('label', { class: 'card' },
      h('span', { class: 'muted small' }, 'Notitie'),
      h('textarea', { rows: 2, placeholder: 'Hoe ging het?', value: session.note || '', oninput: (e) => { session.note = e.target.value; save(); } }),
    ),
    finishBtn,
    deleteBtn,
  );
}

/** Sets van deze oefening in de meest recente eerdere training. */
function previousPerformance(session, exId, allSets, allSessions) {
  const key = session.date + session.startedAt;
  const earlier = sortSessions(allSessions.filter((s) => s.id !== session.id && s.date + s.startedAt < key && s.exerciseIds.includes(exId)));
  for (const s of earlier) {
    const sets = allSets.filter((x) => x.sessionId === s.id && x.exerciseId === exId).sort((a, b) => a.idx - b.idx);
    if (sets.length) return { session: s, sets };
  }
  return null;
}

function exerciseCard(session, exId, sessionSets, allSets, allSessions, saveSession, onSessionChange) {
  const e = ex(exId);
  const onChange = () => {
    onSessionChange();
    updateSummary();
  };
  const isTime = e.metric === 'time';
  const sets = sessionSets.filter((s) => s.exerciseId === exId).sort((a, b) => a.idx - b.idx);
  const prev = previousPerformance(session, exId, allSets, allSessions);

  const tbody = h('tbody');
  const renumber = () => [...tbody.children].forEach((tr, i) => (tr.firstChild.textContent = i + 1));

  const addRow = (s) => {
    const e1 = h('td', { class: 'e1rm muted small' });
    const updateE1 = () => {
      const v = isTime ? 0 : epley1RM(s.weight, s.reps);
      e1.textContent = v && s.reps > 1 ? fmt(v) : '';
    };
    const num = (field, mode, step) =>
      h('input', {
        type: 'number',
        inputmode: mode,
        step,
        min: 0,
        value: s[field] ?? '',
        placeholder: '0',
        onfocus: (ev) => ev.target.select(),
        oninput: (ev) => {
          const v = ev.target.value === '' ? null : Number(ev.target.value);
          s[field] = v;
          updateE1();
          onChange();
          db.put('sets', s);
        },
      });
    const tr = h('tr', {},
      h('td', { class: 'muted' }, String(s.idx + 1)),
      h('td', {}, num('weight', 'decimal', 'any')),
      h('td', {}, num('reps', 'numeric', 1)),
      e1,
      h('td', {}, h('button', {
        class: 'icon',
        'aria-label': 'Set verwijderen',
        onclick: async () => {
          await db.del('sets', s.id);
          const i = sets.indexOf(s);
          sets.splice(i, 1);
          sessionSets.splice(sessionSets.indexOf(s), 1);
          tr.remove();
          sets.forEach((x, j) => { if (x.idx !== j) { x.idx = j; db.put('sets', x); } });
          renumber();
          onChange();
        },
      }, '✕')),
    );
    updateE1();
    tbody.append(tr);
    return tr;
  };
  sets.forEach(addRow);

  const addSet = async () => {
    const last = sets[sets.length - 1];
    const prevSame = prev?.sets[sets.length] || prev?.sets[prev.sets.length - 1];
    const template = last || prevSame || {};
    const s = {
      id: db.newId(),
      userId: db.USER_ID,
      sessionId: session.id,
      exerciseId: exId,
      idx: sets.length,
      reps: template.reps ?? null,
      weight: template.weight ?? null,
      createdAt: new Date().toISOString(),
    };
    await db.put('sets', s);
    sets.push(s);
    sessionSets.push(s);
    const tr = addRow(s);
    onChange();
    const input = tr.querySelector(template.weight != null ? 'td:nth-child(3) input' : 'input');
    input?.focus();
  };

  const removeExercise = async () => {
    if (sets.length && !confirm(`${e.name} en ${sets.length} set(s) uit deze training verwijderen?`)) return;
    for (const s of sets) await db.del('sets', s.id);
    session.exerciseIds = session.exerciseIds.filter((x) => x !== exId);
    await saveSession();
    render();
  };

  const prevBest = prev ? bestSet(prev.sets) : null;

  // Inklappen: de status wordt in de training bewaard, zodat hij blijft staan.
  const summary = h('div', { class: 'muted small summary' });
  const updateSummary = () => {
    const filled = sets.filter((x) => x.reps);
    if (!filled.length) {
      summary.textContent = 'Nog geen sets';
      return;
    }
    const b = isTime ? null : bestSet(filled);
    const top = b ? b.set : filled.reduce((m, x) => (Number(x.reps) > Number(m.reps) ? x : m), filled[0]);
    summary.textContent = `${filled.length} ${filled.length === 1 ? 'set' : 'sets'} · beste ${setLabel(top, e)}`;
  };
  updateSummary();
  const card = h('section', { class: 'card exercise' + ((session.collapsed || []).includes(exId) ? ' collapsed' : ''), 'data-ex': exId });
  card.updateSummary = updateSummary;
  const toggle = async () => {
    const isCollapsed = card.classList.toggle('collapsed');
    const set = new Set(session.collapsed || []);
    if (isCollapsed) set.add(exId);
    else set.delete(exId);
    session.collapsed = [...set];
    updateSummary();
    await saveSession();
  };

  card.append(
    h('div', { class: 'row card-head' },
      h('button', { class: 'head-toggle grow', 'aria-label': `${e.name} in- of uitklappen`, onclick: toggle },
        h('span', { class: 'chev' }, '▾'),
        h('span', { class: 'grow' }, h('span', { class: 'strong' }, e.name), summary),
      ),
      h('a', { class: 'icon', href: `#/oefening/${encodeURIComponent(exId)}`, 'aria-label': 'Geschiedenis van deze oefening' }, '📈'),
      h('button', { class: 'icon', 'aria-label': 'Oefening verwijderen', onclick: removeExercise }, '🗑'),
    ),
    h('div', { class: 'card-body' },
    prev
      ? h('div', { class: 'muted small prev' },
          `Vorige keer (${fmtDate(prev.session.date, { day: 'numeric', month: 'short' })}): `,
          prev.sets.map((s) => setLabel(s, e)).join(', '),
          prevBest && !isTime ? ` · 1RM ≈ ${fmt(prevBest.e1rm)} kg` : '')
      : h('div', { class: 'muted small prev' }, groupLabel(e.group)),
    h('table', { class: 'sets' },
      h('thead', {}, h('tr', {},
        h('th', {}, '#'), h('th', {}, 'kg'), h('th', {}, isTime ? 'sec' : 'reps'), h('th', {}, isTime ? '' : '1RM'), h('th'),
      )),
      tbody,
    ),
    h('button', { class: 'btn small', onclick: addSet }, '+ Set'),
    ),
  );
  return card;
}

// ---------- Oefening kiezen ----------

async function openPicker(onPick) {
  const recent = await recentExerciseIds();
  let query = '';
  let group = recent.length ? 'recent' : 'all';

  const list = h('div', { class: 'picker-list' });
  const search = h('input', {
    type: 'search',
    placeholder: 'Zoek oefening…',
    oninput: (e) => {
      query = e.target.value;
      draw();
    },
  });
  const chips = h('div', { class: 'chips' });

  const close = () => overlay.remove();
  const pick = (id) => {
    close();
    onPick(id);
  };

  const chipDefs = [
    ...(recent.length ? [['recent', 'Recent']] : []),
    ['all', 'Alles'],
    ['technogym', 'Technogym'],
    ...MUSCLE_GROUPS.map((g) => [g.id, g.label]),
  ];

  function drawChips() {
    chips.replaceChildren(
      ...chipDefs.map(([id, label]) =>
        h('button', { class: 'chip' + (group === id ? ' active' : ''), onclick: () => { group = id; drawChips(); draw(); } }, label),
      ),
    );
  }

  function draw() {
    let items;
    if (query) items = allExercises().filter((e) => matches(e, query));
    else if (group === 'recent') items = recent.map(ex);
    else if (group === 'all') items = allExercises();
    else if (group === 'technogym') items = allExercises().filter((e) => e.equipment === 'technogym');
    else items = allExercises().filter((e) => e.group === group);

    list.replaceChildren(
      ...items.map((e) =>
        h('button', { class: 'picker-item', onclick: () => pick(e.id) },
          h('span', {}, e.name),
          h('span', { class: 'muted small' }, `${groupLabel(e.group)} · ${EQUIPMENT[e.equipment] || ''}`),
        ),
      ),
      items.length ? null : h('p', { class: 'muted center' }, 'Niets gevonden.'),
      h('button', { class: 'btn ghost', onclick: () => { close(); openCustomExercise(query, pick); } }, '+ Eigen oefening aanmaken'),
    );
  }

  const overlay = h('div', { class: 'overlay' },
    h('div', { class: 'sheet' },
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, 'Oefening kiezen'), h('button', { class: 'icon', onclick: close, 'aria-label': 'Sluiten' }, '✕')),
      search,
      chips,
      list,
    ),
  );
  drawChips();
  draw();
  document.body.append(overlay);
}

function openCustomExercise(name, onCreated, existing) {
  const nameIn = h('input', { type: 'text', value: existing?.name ?? name ?? '', placeholder: 'Naam', required: true });
  const groupSel = h('select', {}, MUSCLE_GROUPS.map((g) => h('option', { value: g.id, selected: existing?.group === g.id }, g.label)));
  const eqSel = h('select', {}, Object.entries(EQUIPMENT).map(([id, l]) => h('option', { value: id, selected: existing?.equipment === id }, l)));
  const metricSel = h('select', {},
    h('option', { value: 'reps', selected: existing?.metric !== 'time' }, 'Herhalingen'),
    h('option', { value: 'time', selected: existing?.metric === 'time' }, 'Tijd (seconden)'),
  );
  const close = () => overlay.remove();
  const form = h('form', {
    class: 'stack',
    onsubmit: async (ev) => {
      ev.preventDefault();
      const n = nameIn.value.trim();
      if (!n) return;
      const e = {
        id: existing?.id ?? 'custom-' + db.newId(),
        userId: db.USER_ID,
        name: n,
        group: groupSel.value,
        equipment: eqSel.value,
        secondary: existing?.secondary ?? [],
        metric: metricSel.value,
        aka: '',
        builtin: false,
      };
      await db.put('exercises', e);
      await loadExercises();
      close();
      onCreated?.(e.id);
    },
  },
    h('label', {}, h('span', { class: 'muted small' }, 'Naam'), nameIn),
    h('label', {}, h('span', { class: 'muted small' }, 'Spiergroep'), groupSel),
    h('label', {}, h('span', { class: 'muted small' }, 'Materiaal'), eqSel),
    h('label', {}, h('span', { class: 'muted small' }, 'Meten in'), metricSel),
    h('button', { class: 'btn primary', type: 'submit' }, existing ? 'Opslaan' : 'Toevoegen'),
  );
  const overlay = h('div', { class: 'overlay' },
    h('div', { class: 'sheet' },
      h('div', { class: 'row' }, h('h2', { class: 'grow' }, existing ? 'Oefening bewerken' : 'Eigen oefening'), h('button', { class: 'icon', onclick: close, 'aria-label': 'Sluiten' }, '✕')),
      form,
    ),
  );
  document.body.append(overlay);
  nameIn.focus();
}

// ---------- Geschiedenis ----------

async function viewHistory() {
  setTitle('Geschiedenis');
  const sessions = sortSessions(await db.getAll('sessions'));
  const sets = await db.getAll('sets');
  if (!sessions.length) return h('p', { class: 'muted center' }, 'Nog geen trainingen.');
  let lastMonth = '';
  const out = [];
  for (const s of sessions) {
    const month = fmtDate(s.date, { month: 'long', year: 'numeric' });
    if (month !== lastMonth) {
      out.push(h('h2', {}, month));
      lastMonth = month;
    }
    out.push(sessionRow(s, sets));
  }
  return h('div', { class: 'stack' }, out);
}

// ---------- Oefeningen ----------

let exQuery = '';
let exGroup = 'all';

async function viewExercises() {
  setTitle('Oefeningen');
  const sets = await db.getAll('sets');
  const used = new Set(sets.map((s) => s.exerciseId));
  const list = h('div', { class: 'stack tight' });
  const chips = h('div', { class: 'chips' });
  const chipDefs = [['all', 'Alles'], ['used', 'Gedaan'], ['technogym', 'Technogym'], ...MUSCLE_GROUPS.map((g) => [g.id, g.label])];

  function draw() {
    chips.replaceChildren(...chipDefs.map(([id, label]) =>
      h('button', { class: 'chip' + (exGroup === id ? ' active' : ''), onclick: () => { exGroup = id; draw(); } }, label)));
    let items = allExercises().filter((e) => matches(e, exQuery));
    if (exGroup === 'used') items = items.filter((e) => used.has(e.id));
    else if (exGroup === 'technogym') items = items.filter((e) => e.equipment === 'technogym');
    else if (exGroup !== 'all') items = items.filter((e) => e.group === exGroup);
    list.replaceChildren(
      ...items.map((e) =>
        h('a', { class: 'card row link', href: `#/oefening/${encodeURIComponent(e.id)}` },
          h('div', { class: 'grow' }, h('div', {}, e.name), h('div', { class: 'muted small' }, `${groupLabel(e.group)} · ${EQUIPMENT[e.equipment] || ''}`)),
          used.has(e.id) ? h('span', { class: 'pill' }, '✓') : null,
        ),
      ),
      items.length ? null : h('p', { class: 'muted center' }, 'Niets gevonden.'),
    );
  }
  draw();

  return h('div', { class: 'stack' },
    h('input', { type: 'search', placeholder: 'Zoek oefening…', value: exQuery, oninput: (e) => { exQuery = e.target.value; draw(); } }),
    chips,
    h('button', { class: 'btn ghost', onclick: () => openCustomExercise('', (id) => (location.hash = `#/oefening/${encodeURIComponent(id)}`)) }, '+ Eigen oefening aanmaken'),
    list,
  );
}

async function viewExercise(id) {
  const e = ex(id);
  setTitle('Oefening');
  const isTime = e.metric === 'time';
  const sets = await db.getByIndex('sets', 'exerciseId', id);
  const sessions = new Map((await db.getAll('sessions')).map((s) => [s.id, s]));
  const bySession = new Map();
  for (const s of sets) {
    if (!sessions.has(s.sessionId)) continue;
    if (!bySession.has(s.sessionId)) bySession.set(s.sessionId, []);
    bySession.get(s.sessionId).push(s);
  }
  const history = sortSessions([...bySession.keys()].map((sid) => sessions.get(sid)));
  const best = bestSet(sets);
  const bestSession = best ? sessions.get(best.set.sessionId) : null;
  const maxWeight = sets.reduce((m, s) => Math.max(m, Number(s.weight) || 0), 0);
  const maxReps = sets.reduce((m, s) => Math.max(m, Number(s.reps) || 0), 0);

  const stats = isTime
    ? [['Langste', maxReps ? `${fmt(maxReps)} s` : '–'], ['Trainingen', history.length]]
    : [
        ['Geschatte 1RM', best ? `${fmt(best.e1rm)} kg` : '–'],
        ['Zwaarste set', maxWeight ? `${fmt(maxWeight)} kg` : '–'],
        ['Trainingen', history.length],
      ];

  return h('div', { class: 'stack' },
    h('div', { class: 'card' },
      h('h2', { class: 'flush' }, e.name),
      h('div', { class: 'muted small' },
        [groupLabel(e.group), ...(e.secondary || []).map(groupLabel)].join(' · '),
        ` — ${EQUIPMENT[e.equipment] || ''}`),
      h('div', { class: 'stats' }, stats.map(([l, v]) => h('div', {}, h('div', { class: 'stat' }, v), h('div', { class: 'muted small' }, l)))),
      best && !isTime
        ? h('p', { class: 'muted small' }, `Beste set: ${setLabel(best.set, e)} op ${fmtDate(bestSession?.date, { day: 'numeric', month: 'long', year: 'numeric' })} (Epley).`)
        : null,
      e.builtin ? null : h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: () => openCustomExercise('', () => render(), e) }, 'Bewerken'),
        h('button', {
          class: 'btn small danger ghost',
          onclick: async () => {
            if (sets.length) return toast('Deze oefening heeft gelogde sets en kan niet worden verwijderd.');
            if (!confirm(`${e.name} verwijderen?`)) return;
            await db.del('exercises', e.id);
            await loadExercises();
            location.hash = '#/oefeningen';
          },
        }, 'Verwijderen'),
      ),
    ),
    !isTime && history.length ? workingWeightsCard(history[0], bySession.get(history[0].id), e) : null,
    history.length ? h('h2', {}, 'Geschiedenis') : h('p', { class: 'muted center' }, 'Nog niet gelogd.'),
    history.map((s) => {
      const ss = bySession.get(s.id).sort((a, b) => a.idx - b.idx);
      const b = bestSet(ss);
      return h('a', { class: 'card link', href: `#/sessie/${s.id}` },
        h('div', { class: 'row' },
          h('span', { class: 'grow strong' }, fmtDate(s.date)),
          b && !isTime ? h('span', { class: 'muted small' }, `1RM ≈ ${fmt(b.e1rm)} kg`) : null,
        ),
        h('div', { class: 'small' }, ss.map((x) => setLabel(x, e)).join(' · ')),
      );
    }),
  );
}

/** Werkgewichten per aantal herhalingen, teruggerekend uit de geschatte 1RM van de laatste training. */
function workingWeightsCard(session, sessionSets, e) {
  const b = bestSet(sessionSets);
  if (!b) return null;
  return h('div', { class: 'card' },
    h('div', { class: 'row' },
      h('div', { class: 'grow strong' }, 'Werkgewicht per aantal reps'),
      h('div', { class: 'muted small' }, `1RM ≈ ${fmt(b.e1rm)} kg`),
    ),
    h('table', { class: 'data reps' },
      h('thead', {}, h('tr', {}, REP_TARGETS.map((r) => h('th', { class: 'num' }, `${r}×`)))),
      h('tbody', {}, h('tr', {}, REP_TARGETS.map((r) => h('td', { class: 'num strong' }, fmt(roundTo(weightForReps(b.e1rm, r), 0.5)))))),
    ),
    h('p', { class: 'muted small flush' },
      `kg, op basis van je beste set op ${fmtDate(session.date, { day: 'numeric', month: 'short' })} (${setLabel(b.set, e)}), Epley. `,
      'Het gewicht waarmee je die reps nét haalt: kies voor werksets iets lichter als je 1 à 2 reps over wilt houden.'),
  );
}

// ---------- Meer ----------

async function viewMore() {
  setTitle('Meer');
  const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
  const counts = {
    sessions: (await db.getAll('sessions')).length,
    sets: (await db.getAll('sets')).length,
    exercises: (await db.getAll('exercises')).length,
  };

  const exportBtn = h('button', {
    class: 'btn',
    onclick: async () => {
      const data = await db.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `fitness-backup-${todayISO()}.json` });
      document.body.append(a);
      a.click();
      a.remove();
    },
  }, 'Back-up downloaden');

  const fileIn = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'hidden',
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const n = await db.importAll(JSON.parse(await file.text()));
        await loadExercises();
        toast(`${n} records teruggezet.`);
        render();
      } catch (err) {
        toast(`Mislukt: ${err.message}`);
      }
    },
  });

  return h('div', { class: 'stack' },
    h('div', { class: 'card stack' },
      h('h2', { class: 'flush' }, 'Gegevens'),
      h('p', { class: 'small' }, `${counts.sessions} trainingen, ${counts.sets} sets, ${counts.exercises} eigen oefeningen.`),
      h('p', { class: 'small muted' },
        'Alles staat alleen op dit toestel. Maak af en toe een back-up, bijvoorbeeld naar Google Drive. ',
        persisted ? 'De browser heeft beloofd je gegevens niet zelf op te ruimen.' : 'Installeer de app op je startscherm, dan ruimt de browser je gegevens niet zomaar op.'),
      exportBtn,
      h('button', { class: 'btn ghost', onclick: () => fileIn.click() }, 'Back-up terugzetten'),
      fileIn,
    ),
    h('div', { class: 'card' },
      h('h2', { class: 'flush' }, 'Geschatte 1RM'),
      h('p', { class: 'small' }, 'De app schat je 1RM met de formule van Epley: gewicht × (1 + reps ÷ 30). Hoe dichter bij je max je test, hoe nauwkeuriger. Bij sets boven de ±12 herhalingen is het een ruwe schatting; vergelijk dan vooral metingen die op dezelfde manier zijn gedaan.'),
    ),
    h('p', { class: 'muted small center' }, 'Fitness · v2'),
  );
}

// ---------- start ----------

window.addEventListener('hashchange', render);

(async function init() {
  await db.openDB();
  await loadExercises();
  await render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
