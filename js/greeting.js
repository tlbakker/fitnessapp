// Groet op het voorblad. Puur (geen DOM/DB), dus testbaar.
//
// De zin wordt per dag "willekeurig" gekozen met de datum als zaadje, zodat hij niet bij
// elke klik verspringt maar wel elke dag anders is.

function seeded(str) {
  let x = 2166136261;
  for (const c of str) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
  return () => {
    x = Math.imul(x ^ (x >>> 15), 2246822507);
    x = Math.imul(x ^ (x >>> 13), 3266489909);
    return ((x ^= x >>> 16) >>> 0) / 4294967296;
  };
}

const pickFrom = (rng, list) => list[Math.floor(rng() * list.length)];

export function dayPart(hour) {
  if (hour < 6) return 'Hé nachtbraker';
  if (hour < 12) return 'Goedemorgen';
  if (hour < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

const PLANNED = [
  (w) => `Vandaag staat ${w} op het programma.`,
  (w) => `${w} staat klaar. Zin in?`,
  (w) => `Klaar voor ${w}?`,
  (w) => `Op de planning: ${w}. Je kunt meteen beginnen.`,
  (w) => `Vandaag is het ${w}-dag.`,
];
const DONE = [
  (w) => `${w} zit er vandaag al op. Lekker bezig!`,
  (w) => `Je hebt ${w} vandaag al gedaan. Goed werk.`,
  (w) => `${w}: afgevinkt. Herstel is ook training.`,
];
const FREE = [
  'Niets gepland vandaag. Rustdag, of toch een losse training?',
  'Geen training op de planning. Kies er een als je zin hebt.',
  'Vrije dag in de agenda. Jij bepaalt.',
];

const list = (names) => (names.length <= 1 ? names[0] : `${names.slice(0, -1).join(', ')} en ${names[names.length - 1]}`);

/**
 * { title, line } voor het voorblad.
 * planned: namen van workouts die vandaag nog gedaan moeten worden; done: die vandaag al gedaan zijn.
 */
export function greeting({ name = '', hour = 12, date = '', planned = [], done = [] } = {}) {
  const rng = seeded(`${date}|${planned.join()}|${done.join()}`);
  const n = String(name || '').trim();
  const title = n ? `${dayPart(hour)}, ${n}!` : `${dayPart(hour)}!`;
  let line;
  if (planned.length) line = pickFrom(rng, PLANNED)(list(planned));
  else if (done.length) line = pickFrom(rng, DONE)(list(done));
  else line = pickFrom(rng, FREE);
  return { title, line: line.charAt(0).toUpperCase() + line.slice(1) };
}
