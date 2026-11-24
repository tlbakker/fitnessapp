// Vooringeladen oefeningen. De id's zijn vast: ze worden gebruikt om sets aan
// oefeningen te koppelen, en straks om imports (bijv. Virtuagym) te matchen.
// Verander dus nooit een bestaand id; voeg alleen nieuwe toe.

export const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Borst' },
  { id: 'back', label: 'Rug' },
  { id: 'shoulders', label: 'Schouders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'forearms', label: 'Onderarmen' },
  { id: 'quads', label: 'Quadriceps' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'glutes', label: 'Bilspieren' },
  { id: 'hips', label: 'Heup (ad-/abductoren)' },
  { id: 'calves', label: 'Kuiten' },
  { id: 'abs', label: 'Buikspieren' },
  { id: 'lowerback', label: 'Onderrug' },
];

export const EQUIPMENT = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  cable: 'Kabel',
  machine: 'Machine',
  technogym: 'Technogym',
  bodyweight: 'Lichaamsgewicht',
  kettlebell: 'Kettlebell',
};

// [id, naam, spiergroep, materiaal, secundaire spiergroepen, extra]
// extra.metric: 'reps' (standaard) of 'time' (seconden), extra.aka: zoekwoorden
const RAW = [
  // Borst
  ['bench-press', 'Bench Press', 'chest', 'barbell', ['triceps', 'shoulders'], { aka: 'bankdrukken' }],
  ['incline-bench-press', 'Incline Bench Press', 'chest', 'barbell', ['shoulders', 'triceps'], { aka: 'schuin bankdrukken' }],
  ['decline-bench-press', 'Decline Bench Press', 'chest', 'barbell', ['triceps']],
  ['db-bench-press', 'Dumbbell Bench Press', 'chest', 'dumbbell', ['triceps', 'shoulders'], { aka: 'bankdrukken' }],
  ['incline-db-press', 'Incline Dumbbell Press', 'chest', 'dumbbell', ['shoulders', 'triceps']],
  ['db-fly', 'Dumbbell Fly', 'chest', 'dumbbell', [], { aka: 'flyes' }],
  ['cable-crossover', 'Cable Crossover', 'chest', 'cable', [], { aka: 'cable fly' }],
  ['dips', 'Dips', 'chest', 'bodyweight', ['triceps', 'shoulders']],
  ['push-up', 'Push-up', 'chest', 'bodyweight', ['triceps', 'shoulders'], { aka: 'opdrukken' }],
  // Rug
  ['deadlift', 'Deadlift', 'back', 'barbell', ['hamstrings', 'glutes', 'lowerback'], { aka: 'deadlift' }],
  ['pull-up', 'Pull-up', 'back', 'bodyweight', ['biceps'], { aka: 'optrekken' }],
  ['chin-up', 'Chin-up', 'back', 'bodyweight', ['biceps'], { aka: 'optrekken' }],
  ['barbell-row', 'Barbell Row', 'back', 'barbell', ['biceps', 'lowerback'], { aka: 'roeien bent over' }],
  ['db-row', 'One-arm Dumbbell Row', 'back', 'dumbbell', ['biceps'], { aka: 'roeien' }],
  ['t-bar-row', 'T-bar Row', 'back', 'barbell', ['biceps']],
  ['lat-pulldown', 'Lat Pulldown', 'back', 'cable', ['biceps'], { aka: 'lat pull' }],
  ['seated-cable-row', 'Seated Cable Row', 'back', 'cable', ['biceps'], { aka: 'roeien' }],
  ['straight-arm-pulldown', 'Straight-arm Pulldown', 'back', 'cable', []],
  ['shrug', 'Shrug', 'back', 'barbell', [], { aka: 'trapezius' }],
  // Schouders
  ['overhead-press', 'Overhead Press', 'shoulders', 'barbell', ['triceps'], { aka: 'military press schouderdrukken' }],
  ['db-shoulder-press', 'Dumbbell Shoulder Press', 'shoulders', 'dumbbell', ['triceps'], { aka: 'schouderdrukken' }],
  ['arnold-press', 'Arnold Press', 'shoulders', 'dumbbell', ['triceps']],
  ['lateral-raise', 'Lateral Raise', 'shoulders', 'dumbbell', [], { aka: 'zijwaarts heffen' }],
  ['front-raise', 'Front Raise', 'shoulders', 'dumbbell', []],
  ['rear-delt-fly', 'Rear Delt Fly', 'shoulders', 'dumbbell', ['back'], { aka: 'reverse fly' }],
  ['face-pull', 'Face Pull', 'shoulders', 'cable', ['back']],
  ['upright-row', 'Upright Row', 'shoulders', 'barbell', ['back']],
  // Biceps
  ['barbell-curl', 'Barbell Curl', 'biceps', 'barbell', ['forearms']],
  ['db-curl', 'Dumbbell Curl', 'biceps', 'dumbbell', ['forearms']],
  ['hammer-curl', 'Hammer Curl', 'biceps', 'dumbbell', ['forearms']],
  ['incline-db-curl', 'Incline Dumbbell Curl', 'biceps', 'dumbbell', []],
  ['preacher-curl', 'Preacher Curl', 'biceps', 'barbell', [], { aka: 'scott curl' }],
  ['cable-curl', 'Cable Curl', 'biceps', 'cable', []],
  // Triceps
  ['close-grip-bench-press', 'Close-grip Bench Press', 'triceps', 'barbell', ['chest']],
  ['skull-crusher', 'Skull Crusher', 'triceps', 'barbell', [], { aka: 'french press' }],
  ['triceps-pushdown', 'Triceps Pushdown', 'triceps', 'cable', [], { aka: 'pushdown' }],
  ['overhead-triceps-extension', 'Overhead Triceps Extension', 'triceps', 'dumbbell', []],
  // Onderarmen
  ['wrist-curl', 'Wrist Curl', 'forearms', 'barbell', []],
  ['farmers-walk', "Farmer's Walk", 'forearms', 'dumbbell', ['back'], { metric: 'time' }],
  // Benen
  ['back-squat', 'Back Squat', 'quads', 'barbell', ['glutes', 'hamstrings'], { aka: 'squat kniebuigen' }],
  ['front-squat', 'Front Squat', 'quads', 'barbell', ['glutes']],
  ['goblet-squat', 'Goblet Squat', 'quads', 'dumbbell', ['glutes']],
  ['smith-squat', 'Smith Machine Squat', 'quads', 'machine', ['glutes']],
  ['hack-squat', 'Hack Squat', 'quads', 'machine', ['glutes']],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'quads', 'dumbbell', ['glutes']],
  ['lunge', 'Lunge', 'quads', 'dumbbell', ['glutes'], { aka: 'uitvalspas walking lunge' }],
  ['step-up', 'Step-up', 'quads', 'dumbbell', ['glutes']],
  ['romanian-deadlift', 'Romanian Deadlift', 'hamstrings', 'barbell', ['glutes', 'lowerback'], { aka: 'rdl' }],
  ['good-morning', 'Good Morning', 'hamstrings', 'barbell', ['lowerback']],
  ['hip-thrust', 'Hip Thrust', 'glutes', 'barbell', ['hamstrings']],
  ['glute-bridge', 'Glute Bridge', 'glutes', 'bodyweight', ['hamstrings'], { aka: 'bekkenlift' }],
  ['cable-kickback', 'Cable Kickback', 'glutes', 'cable', []],
  ['kettlebell-swing', 'Kettlebell Swing', 'glutes', 'kettlebell', ['hamstrings', 'lowerback']],
  ['standing-calf-raise', 'Standing Calf Raise', 'calves', 'machine', [], { aka: 'kuiten' }],
  ['seated-calf-raise', 'Seated Calf Raise', 'calves', 'machine', [], { aka: 'kuiten' }],
  // Buik / onderrug
  ['plank', 'Plank', 'abs', 'bodyweight', [], { metric: 'time' }],
  ['crunch', 'Crunch', 'abs', 'bodyweight', []],
  ['cable-crunch', 'Cable Crunch', 'abs', 'cable', []],
  ['hanging-leg-raise', 'Hanging Leg Raise', 'abs', 'bodyweight', [], { aka: 'benen heffen' }],
  ['ab-wheel', 'Ab Wheel Rollout', 'abs', 'bodyweight', []],
  ['russian-twist', 'Russian Twist', 'abs', 'bodyweight', []],
  ['back-extension', 'Back Extension', 'lowerback', 'bodyweight', ['glutes', 'hamstrings'], { aka: 'hyperextension' }],

  // Technogym (benamingen zoals op de Selection/Pure Strength-lijn)
  ['tg-chest-press', 'Chest Press (Technogym)', 'chest', 'technogym', ['triceps', 'shoulders']],
  ['tg-incline-chest-press', 'Incline Chest Press (Technogym)', 'chest', 'technogym', ['shoulders', 'triceps']],
  ['tg-pectoral', 'Pectoral / Butterfly (Technogym)', 'chest', 'technogym', [], { aka: 'pec deck vlinder' }],
  ['tg-shoulder-press', 'Shoulder Press (Technogym)', 'shoulders', 'technogym', ['triceps']],
  ['tg-delts', 'Delts Machine (Technogym)', 'shoulders', 'technogym', [], { aka: 'lateral raise' }],
  ['tg-rear-delt', 'Rear Delt (Technogym)', 'shoulders', 'technogym', ['back'], { aka: 'reverse fly' }],
  ['tg-lat-machine', 'Lat Machine (Technogym)', 'back', 'technogym', ['biceps'], { aka: 'lat pulldown' }],
  ['tg-vertical-traction', 'Vertical Traction (Technogym)', 'back', 'technogym', ['biceps'], { aka: 'pulldown' }],
  ['tg-low-row', 'Low Row (Technogym)', 'back', 'technogym', ['biceps'], { aka: 'roeien' }],
  ['tg-upper-back', 'Upper Back (Technogym)', 'back', 'technogym', ['shoulders'], { aka: 'row' }],
  ['tg-lower-back', 'Lower Back (Technogym)', 'lowerback', 'technogym', []],
  ['tg-arm-curl', 'Arm Curl (Technogym)', 'biceps', 'technogym', []],
  ['tg-arm-extension', 'Arm Extension (Technogym)', 'triceps', 'technogym', []],
  ['tg-leg-press', 'Leg Press (Technogym)', 'quads', 'technogym', ['glutes', 'hamstrings'], { aka: 'beenpers' }],
  ['tg-leg-extension', 'Leg Extension (Technogym)', 'quads', 'technogym', [], { aka: 'beenstrekken' }],
  ['tg-leg-curl', 'Leg Curl (Technogym)', 'hamstrings', 'technogym', [], { aka: 'seated leg curl' }],
  ['tg-prone-leg-curl', 'Prone Leg Curl (Technogym)', 'hamstrings', 'technogym', [], { aka: 'lying leg curl' }],
  ['tg-glute', 'Glute (Technogym)', 'glutes', 'technogym', ['hamstrings']],
  ['tg-multi-hip', 'Multi Hip (Technogym)', 'glutes', 'technogym', ['hips']],
  ['tg-abductor', 'Abductor (Technogym)', 'hips', 'technogym', ['glutes']],
  ['tg-adductor', 'Adductor (Technogym)', 'hips', 'technogym', []],
  ['tg-abdominal-crunch', 'Abdominal Crunch (Technogym)', 'abs', 'technogym', []],
  ['tg-rotary-torso', 'Rotary Torso (Technogym)', 'abs', 'technogym', [], { aka: 'obliques' }],
];

export const BUILTIN_EXERCISES = RAW.map(([id, name, group, equipment, secondary, extra = {}]) => ({
  id,
  name,
  group,
  equipment,
  secondary,
  metric: extra.metric || 'reps',
  aka: extra.aka || '',
  builtin: true,
}));

export function groupLabel(id) {
  return MUSCLE_GROUPS.find((g) => g.id === id)?.label ?? id;
}
