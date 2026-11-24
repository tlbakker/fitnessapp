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
