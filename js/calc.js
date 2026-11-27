// Rekenfuncties. Puur (geen DOM/DB), zodat ze makkelijk te testen zijn.

/** Geschatte 1RM volgens Epley: gewicht × (1 + reps/30). Bij 1 rep is het het gewicht zelf. */
export function epley1RM(weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!(w > 0) || !(r > 0)) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

/** Rond af op een stap (standaard 0,5 kg). */
export function roundTo(x, step = 0.5) {
  return Math.round(x / step) * step;
}

/** Totaal volume (reps × gewicht) van een lijst sets. */
export function volume(sets) {
  return sets.reduce((sum, s) => sum + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);
}

/** De set met de hoogste geschatte 1RM, of null. */
export function bestSet(sets) {
  let best = null;
  let bestVal = 0;
  for (const s of sets) {
    const v = epley1RM(s.weight, s.reps);
    if (v > bestVal) {
      bestVal = v;
      best = s;
    }
  }
  return best ? { set: best, e1rm: bestVal } : null;
}

/** Nederlandse getalnotatie, max. 1 decimaal. */
export function fmt(n) {
  if (n == null || Number.isNaN(n)) return '';
  return Number(n).toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}

/**
 * Eén prestatiegetal voor een oefening in een training, zodat trainingen te vergelijken zijn:
 * - met gewicht: hoogste geschatte 1RM (kg)
 * - zonder gewicht: meeste herhalingen in één set (of langste tijd in seconden)
 * - conditie: gemiddelde snelheid (km/u) als er afstand is, anders totale minuten
 * metric is 'reps', 'time' of 'cardio' (zie exercises.js). Geeft null als er niets bruikbaars is.
 */
export function performance(sets, metric = 'reps') {
  const valid = sets.filter((s) => Number(s.reps) > 0);
  if (!valid.length) return null;
  if (metric === 'cardio') {
    const min = valid.reduce((n, s) => n + Number(s.reps), 0);
    const km = valid.reduce((n, s) => n + (Number(s.km) || 0), 0);
    return km ? { value: (km / min) * 60, unit: 'km/u', kind: 'speed' } : { value: min, unit: 'min', kind: 'minutes' };
  }
  if (metric !== 'time' && valid.some((s) => Number(s.weight) > 0)) {
    const b = bestSet(valid);
    return { value: b.e1rm, unit: 'kg', kind: 'e1rm' };
  }
  const max = Math.max(...valid.map((s) => Number(s.reps)));
  return metric === 'time' ? { value: max, unit: 's', kind: 'time' } : { value: max, unit: 'reps', kind: 'reps' };
}

/** Procentuele verandering van a naar b, of null. */
export function pctChange(a, b) {
  if (!(a > 0) || b == null) return null;
  return ((b - a) / a) * 100;
}

/** Omgekeerde Epley: welk gewicht hoort bij een set van `reps` herhalingen, gegeven een (geschatte) 1RM. */
export function weightForReps(oneRM, reps) {
  const r = Number(reps);
  if (!(oneRM > 0) || !(r > 0)) return 0;
  if (r === 1) return oneRM;
  return oneRM / (1 + r / 30);
}

/** Herhalingsaantallen voor de werkgewicht-tabel. */
export const REP_TARGETS = [6, 8, 10, 12, 15, 20, 25];
