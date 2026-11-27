// Trainingsvormen en het delen van workouts. Puur (geen DOM/DB), dus testbaar.
//
// Een trainingsvorm beschrijft per set hoeveel reps je doet en op basis van welk xRM het
// gewicht wordt berekend ("load"). Normaal is load = reps (12 reps → 12RM-gewicht), maar
// een vorm kan dat loskoppelen, bijv. 30 reps totaal met het gewicht van je 10RM.
// Gewichten staan nooit in een workout: die rekent ieders app uit de eigen geschatte 1RM.
//
// Een workout heeft een standaardvorm ({ form }) en per oefening optioneel een afwijkende
// vorm of eigen reps: items: [{ exerciseId, form?, reps? }].

const sets = (...reps) => ({ sets: reps.map((r) => ({ reps: r, load: r })) });
const pick = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// Een set kan ook "zo veel mogelijk reps" zijn (amrap) en een gewicht als fractie van het
// gewicht van zijn load hebben (pct, voor drop sets).
export const FORMS = [
  {
    id: 'low-high',
    name: 'Laag → hoog',
    description: 'Zwaar begin met weinig reps, daarna lichter met meer reps.',
    build: () => sets(6, 10, 15),
  },
  {
    id: 'high-low',
    name: 'Hoog → laag',
    description: 'Licht begin met veel reps, daarna steeds zwaarder.',
    build: () => sets(15, 10, 6),
  },
  {
    id: 'pyramid-3',
    name: 'Piramide 3',
    description: 'Zwaar, licht, zwaar: de reps lopen op en weer af.',
    build: () => sets(8, 15, 8),
  },
  {
    id: 'pyramid-5',
    name: 'Piramide 5',
    description: 'Vijf sets: de reps lopen op tot 15 en weer af.',
    build: () => sets(8, 12, 15, 12, 8),
  },
  {
    id: 'reverse-pyramid-3',
    name: 'Piramide omgekeerd 3',
    description: 'Licht, zwaar, licht: de reps lopen af en weer op.',
    build: () => sets(15, 8, 15),
  },
  {
    id: 'reverse-pyramid-5',
    name: 'Piramide omgekeerd 5',
    description: 'Vijf sets: de reps lopen af tot 8 en weer op.',
    build: () => sets(15, 12, 8, 12, 15),
  },
  {
    id: 'rest-pause-30',
    name: 'Rest-pause',
    description: 'Gewicht van je 10RM; haal 30 reps in zoveel sets als nodig, met korte pauzes.',
    build: () => ({ sets: [], total: 30, load: 10 }),
  },
  {
    id: 'random-3',
    name: 'Random 3 sets',
    description: 'Elke training andere reps: één set laag (4–6), midden (8–12) en hoog (15–20), in willekeurige volgorde.',
    random: true,
    build: (rng = Math.random) => {
      const s = [pick(rng, 4, 6), pick(rng, 8, 12), pick(rng, 15, 20)];
      for (let i = s.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [s[i], s[j]] = [s[j], s[i]];
      }
      return sets(...s);
    },
  },
  { id: 'straight-3', name: 'Rechte sets 3', description: 'Drie gelijke sets.', build: () => sets(10, 10, 10) },
  { id: 'straight-4', name: 'Rechte sets 4', description: 'Vier gelijke sets.', build: () => sets(8, 8, 8, 8) },
  { id: 'straight-5', name: 'Rechte sets 5', description: 'Vijf gelijke sets, zwaarder gewicht.', build: () => sets(6, 6, 6, 6, 6) },
  {
    id: 'drop-set',
    name: 'Drop set',
    description: 'Eén set op je 10RM, dan direct 20% lichter tot je niet meer kunt, en nog een keer 20% lichter.',
    build: () => ({
      sets: [
        { reps: 10, load: 10 },
        { reps: null, load: 10, pct: 0.8, amrap: true },
        { reps: null, load: 10, pct: 0.64, amrap: true },
      ],
    }),
  },
  {
    id: 'amrap-finisher',
    name: 'AMRAP-finisher',
    description: 'Drie sets van 10, en als afsluiter één lichte set (je 20RM) met zo veel mogelijk reps.',
    build: () => ({ sets: [...sets(10, 10, 10).sets, { reps: null, load: 20, amrap: true }] }),
  },
];

/** Hoe een set in een schema staat: "10", of "max" bij zo veel mogelijk reps. */
export function setLabel(set) {
  if (set.amrap) return set.reps ? `${set.reps}+` : 'max';
  return set.reps;
}

/** Vorm voor eigen reps per set (geen preset). */
export const CUSTOM = 'custom';

export function formById(id) {
  return FORMS.find((f) => f.id === id) || null;
}

/** Zet een workout-item (ook oude formaten) om naar { exerciseId, form, reps }. */
export function normalizeItem(item, workoutForm = null) {
  const exerciseId = item.exerciseId;
  if (Array.isArray(item.reps) && item.reps.length && (!item.form || item.form === CUSTOM)) {
    return { exerciseId, form: CUSTOM, reps: item.reps.map(Number).filter((r) => r > 0) };
  }
  if (!Array.isArray(item.reps) && (item.sets || item.reps)) {
    // Oudste formaat: { sets: 3, reps: 10 }
    const n = Number(item.sets) || 1;
    const r = Number(item.reps) || 0;
    return { exerciseId, form: CUSTOM, reps: r ? Array(n).fill(r) : [] };
  }
  const form = item.form && (item.form === CUSTOM || formById(item.form)) ? item.form : workoutForm;
  return { exerciseId, form: form || null, reps: [] };
}

/**
 * Concreet doel voor één training. Bij willekeurige vormen wordt hier geloot, zodat het
 * doel in de training vastligt.
 * Resultaat: { form, label, sets: [{ reps, load }], total?, load? }
 */
export function buildTarget(item, workoutForm = null, rng = Math.random) {
  const it = normalizeItem(item, workoutForm);
  if (it.form === CUSTOM) {
    return { form: CUSTOM, label: schemeLabel(it.reps), sets: it.reps.map((r) => ({ reps: r, load: r })) };
  }
  const f = formById(it.form);
  if (!f) return null;
  const t = f.build(rng);
  return { form: f.id, label: f.name, ...t };
}

/** Doel uit een training lezen, ook van oudere trainingen ({ reps: [] } of { sets, reps }). */
export function readTarget(target) {
  if (!target) return null;
  if (Array.isArray(target.sets)) return target;
  const it = normalizeItem({ exerciseId: '', ...target });
  if (!it.reps.length) return null;
  return { form: CUSTOM, label: schemeLabel(it.reps), sets: it.reps.map((r) => ({ reps: r, load: r })) };
}

/** Korte omschrijving van reps per set: "3 × 10" of "6 · 10 · 15". */
export function schemeLabel(reps) {
  if (!reps?.length) return '';
  if (reps.every((r) => r === reps[0])) return `${reps.length} × ${reps[0]}`;
  return reps.join(' · ');
}

/** Wat er bij een workout-oefening als doel staat, voor in lijsten. */
export function itemLabel(item, workoutForm = null) {
  const it = normalizeItem(item, workoutForm);
  if (it.form === CUSTOM) return schemeLabel(it.reps);
  const f = formById(it.form);
  if (!f) return '';
  if (f.random) return f.name;
  const t = f.build();
  if (t.total) return `${f.name} (${t.total} reps totaal, ${t.load}RM)`;
  return `${f.name} (${schemeLabel(t.sets.map(setLabel))})`;
}

// ---------- Delen ----------

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/**
 * Maak een deelbaar pakket van een workout. Eigen oefeningen gaan mee, zodat de ontvanger
 * ze ook heeft. Persoonlijke gegevens (gewichten, trainingen) gaan nooit mee.
 */
export function packWorkout(template, customExercises = []) {
  const items = (template.items || []).map((i) => normalizeItem(i, template.form));
  const used = new Set(items.map((i) => i.exerciseId));
  return {
    app: 'fitnessapp',
    type: 'workout',
    v: 2,
    name: template.name,
    f: template.form || undefined,
    items: items.map((i) => ({
      e: i.exerciseId,
      ...(i.form === CUSTOM ? { r: i.reps } : i.form && i.form !== template.form ? { f: i.form } : {}),
    })),
    custom: customExercises
      .filter((e) => used.has(e.id))
      .map(({ id, name, group, equipment, metric }) => ({ id, name, group, equipment, metric })),
  };
}

export function encodeWorkout(pack) {
  return toBase64Url(JSON.stringify(pack));
}

/** Lees een pakket uit een link-code of JSON-tekst. Gooit een fout bij ongeldige invoer. */
export function decodeWorkout(input) {
  let data;
  try {
    data = typeof input === 'string' && input.trim().startsWith('{') ? JSON.parse(input) : JSON.parse(fromBase64Url(input));
  } catch {
    throw new Error('Deze link of dit bestand is geen geldige workout.');
  }
  if (data?.app !== 'fitnessapp' || data.type !== 'workout' || !Array.isArray(data.items)) {
    throw new Error('Deze link of dit bestand is geen geldige workout.');
  }
  const validForm = (f) => (typeof f === 'string' && formById(f) ? f : null);
  return {
    name: String(data.name || 'Gedeelde workout').slice(0, 80),
    form: validForm(data.f),
    items: data.items
      .filter((i) => typeof i.e === 'string')
      .map((i) => {
        if (Array.isArray(i.r)) return { exerciseId: i.e, form: CUSTOM, reps: i.r.map(Number).filter((r) => r > 0 && r < 1000).slice(0, 20) };
        const f = validForm(i.f);
        return f ? { exerciseId: i.e, form: f } : { exerciseId: i.e };
      }),
    custom: (Array.isArray(data.custom) ? data.custom : [])
      .filter((e) => typeof e.id === 'string' && e.id.startsWith('custom-') && typeof e.name === 'string')
      .map((e) => ({ id: e.id, name: e.name.slice(0, 80), group: String(e.group || ''), equipment: String(e.equipment || ''), metric: e.metric === 'time' ? 'time' : 'reps' })),
  };
}
