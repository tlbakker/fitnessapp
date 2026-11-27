// Rep-schema's per set en het delen van workouts. Puur (geen DOM/DB), dus testbaar.
//
// Een workout-oefening heeft een doel per set: { exerciseId, reps: [6, 10, 15] }.
// Gewichten staan er bewust niet in: die rekent ieders eigen app uit de eigen geschatte 1RM.

export const SCHEMES = [
  { id: 'low-high', label: 'Laag → hoog', reps: [6, 10, 15] },
  { id: 'pyramid', label: 'Piramide', reps: [15, 10, 6] },
  { id: 'straight-10', label: '3 × 10', reps: [10, 10, 10] },
  { id: 'straight-12', label: '3 × 12', reps: [12, 12, 12] },
  { id: 'strength', label: '4 × 6', reps: [6, 6, 6, 6] },
  { id: 'endurance', label: '2 × 20', reps: [20, 20] },
];

/** Zet een (eventueel oud) workout-item om naar { exerciseId, reps: number[] }. */
export function normalizeItem(item) {
  if (Array.isArray(item.reps)) return { exerciseId: item.exerciseId, reps: item.reps.map(Number).filter((r) => r > 0) };
  const n = Number(item.sets) || 0;
  const r = Number(item.reps) || 0;
  if (n && r) return { exerciseId: item.exerciseId, reps: Array(n).fill(r) };
  if (n) return { exerciseId: item.exerciseId, reps: [], sets: n };
  if (r) return { exerciseId: item.exerciseId, reps: [r] };
  return { exerciseId: item.exerciseId, reps: [] };
}

/** Doel-reps per set uit een sessie-doel (oud formaat { sets, reps } of nieuw { reps: [] }). */
export function targetReps(target) {
  if (!target) return [];
  return normalizeItem({ exerciseId: '', ...target }).reps;
}

/** Korte omschrijving: "3 × 10" of "6 · 10 · 15". */
export function schemeLabel(reps) {
  if (!reps?.length) return '';
  if (reps.every((r) => r === reps[0])) return `${reps.length} × ${reps[0]}`;
  return reps.join(' · ');
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
  const items = (template.items || []).map(normalizeItem);
  const used = new Set(items.map((i) => i.exerciseId));
  return {
    app: 'fitnessapp',
    type: 'workout',
    v: 1,
    name: template.name,
    items: items.map((i) => ({ e: i.exerciseId, r: i.reps })),
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
  return {
    name: String(data.name || 'Gedeelde workout').slice(0, 80),
    items: data.items
      .filter((i) => typeof i.e === 'string')
      .map((i) => ({ exerciseId: i.e, reps: (Array.isArray(i.r) ? i.r : []).map(Number).filter((r) => r > 0 && r < 1000).slice(0, 20) })),
    custom: (Array.isArray(data.custom) ? data.custom : [])
      .filter((e) => typeof e.id === 'string' && e.id.startsWith('custom-') && typeof e.name === 'string')
      .map((e) => ({ id: e.id, name: e.name.slice(0, 80), group: String(e.group || ''), equipment: String(e.equipment || ''), metric: e.metric === 'time' ? 'time' : 'reps' })),
  };
}
