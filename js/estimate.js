// Startgewichten voor de nulmeting, geschat uit je profiel. Puur (geen DOM/DB), dus testbaar.
//
// Zolang er voor een oefening nog geen gelogde sets zijn, weet de app je 1RM niet. Dan
// schatten we hem uit lichaamsgewicht, geslacht, leeftijd en ervaring, en rekenen we terug
// naar een gewicht voor ±15 herhalingen. Bewust aan de voorzichtige kant: je test met 12 tot
// 15 reps, en het is makkelijker om daarna zwaarder te pakken dan om een te zware set af te
// breken. Na de eerste training rekent de app met je echte resultaten.

import { weightForReps, roundTo } from './calc.js';

// Geschatte 1RM als fractie van je lichaamsgewicht, voor een man (20–39 jaar) die al een paar
// jaar regelmatig traint en in vorm is. Gebaseerd op gangbare krachtstandaarden (niveau
// "gevorderd beginner" tot "gemiddeld"). part bepaalt de correctie voor vrouwen.
export const STRENGTH_RATIOS = {
  'back-squat': { ratio: 1.25, part: 'lower' },
  'bench-press': { ratio: 1.0, part: 'upper' },
  'tg-lat-machine': { ratio: 0.85, part: 'upper' },
  'overhead-press': { ratio: 0.6, part: 'upper' },
  'romanian-deadlift': { ratio: 1.1, part: 'lower' },
  'hip-thrust': { ratio: 1.4, part: 'lower' },
  'barbell-curl': { ratio: 0.45, part: 'arms' },
  'triceps-pushdown': { ratio: 0.45, part: 'arms' },
  'standing-calf-raise': { ratio: 1.0, part: 'lower' },
};

// Vrouwen zijn gemiddeld relatief sterker in benen dan in bovenlichaam en armen.
const FEMALE = { lower: 0.7, upper: 0.55, arms: 0.55 };

export const EXPERIENCE = [
  { id: 'beginner', name: 'Beginner (nog niet of nauwelijks getraind)', factor: 0.5 },
  { id: 'returning', name: 'Ervaren, maar een tijd niet getraind', factor: 0.75 },
  { id: 'trained', name: 'Ervaren en nu in vorm', factor: 1 },
];

/** Leeftijd in hele jaren uit een geboortejaar (ruw: op 1 juli jarig). */
export function ageFrom(birthYear, today = new Date()) {
  const y = Number(birthYear);
  if (!(y > 1900)) return null;
  return today.getFullYear() - y - (today.getMonth() < 6 ? 1 : 0);
}

/** Correctie voor leeftijd: vol tot 40, daarna ±1% per jaar minder; jonger dan 18 iets minder. */
export function ageFactor(age) {
  if (!(age > 0)) return 1;
  if (age < 18) return 0.85;
  if (age <= 40) return 1;
  return Math.max(0.6, 1 - (age - 40) * 0.01);
}

/**
 * Geschatte 1RM voor een oefening, of null als de oefening of het profiel niet genoeg zegt.
 * profile: { sex: 'm' | 'v', birthYear, experience }, bodyweight in kg.
 */
export function estimate1RM(exerciseId, profile, bodyweight, today = new Date()) {
  const s = STRENGTH_RATIOS[exerciseId];
  const bw = Number(bodyweight);
  if (!s || !(bw > 30)) return null;
  const sex = profile?.sex === 'v' ? FEMALE[s.part] : 1;
  const exp = EXPERIENCE.find((e) => e.id === profile?.experience)?.factor ?? EXPERIENCE[1].factor;
  return bw * s.ratio * sex * exp * ageFactor(ageFrom(profile?.birthYear, today));
}

/** Startgewicht voor de testset van de nulmeting (±15 reps), afgerond op 2,5 kg. */
export function startWeight(exerciseId, profile, bodyweight, reps = 15, today = new Date()) {
  const e1rm = estimate1RM(exerciseId, profile, bodyweight, today);
  if (!e1rm) return null;
  return Math.max(2.5, roundTo(weightForReps(e1rm, reps), 2.5));
}
