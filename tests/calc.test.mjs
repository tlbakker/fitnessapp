import { test } from 'node:test';
import assert from 'node:assert/strict';
import { epley1RM, bestSet, volume, roundTo } from '../js/calc.js';
import { BUILTIN_EXERCISES, MUSCLE_GROUPS } from '../js/exercises.js';

test('Epley: 100 kg x 10 = 133,3 kg', () => {
  assert.equal(Math.round(epley1RM(100, 10) * 10) / 10, 133.3);
});

test('Epley: 1 rep is het gewicht zelf', () => {
  assert.equal(epley1RM(140, 1), 140);
});

test('Epley: lege of nul-invoer geeft 0', () => {
  assert.equal(epley1RM(0, 8), 0);
  assert.equal(epley1RM(60, 0), 0);
  assert.equal(epley1RM(null, 5), 0);
});

test('bestSet kiest hoogste geschatte 1RM', () => {
  const sets = [{ weight: 100, reps: 5 }, { weight: 90, reps: 10 }, { weight: 105, reps: 1 }];
  assert.equal(bestSet(sets).set.weight, 90);
  assert.equal(bestSet([]), null);
});

test('volume en afronden', () => {
  assert.equal(volume([{ weight: 60, reps: 8 }, { weight: 60, reps: 7 }]), 900);
  assert.equal(roundTo(61.3, 2.5), 62.5);
});

test('oefeningenlijst: unieke ids en geldige spiergroepen', () => {
  const ids = new Set();
  const groups = new Set(MUSCLE_GROUPS.map((g) => g.id));
  for (const e of BUILTIN_EXERCISES) {
    assert.ok(!ids.has(e.id), `dubbel id ${e.id}`);
    ids.add(e.id);
    assert.ok(groups.has(e.group), `${e.id}: onbekende groep ${e.group}`);
    for (const s of e.secondary) assert.ok(groups.has(s), `${e.id}: onbekende groep ${s}`);
  }
  assert.ok(BUILTIN_EXERCISES.length >= 50);
});

import { performance, pctChange } from '../js/calc.js';
import { BASELINE } from '../js/exercises.js';

test('performance: met gewicht geeft geschatte 1RM', () => {
  const p = performance([{ weight: 100, reps: 5 }, { weight: 60, reps: 10 }]);
  assert.equal(p.kind, 'e1rm');
  assert.equal(Math.round(p.value * 10) / 10, 116.7);
});

test('performance: zonder gewicht geeft max. herhalingen of tijd', () => {
  assert.deepEqual(performance([{ reps: 20 }, { reps: 25, weight: null }]), { value: 25, unit: 'reps', kind: 'reps' });
  assert.equal(performance([{ reps: 60 }, { reps: 90 }], 'time').value, 90);
  assert.equal(performance([{ reps: null }]), null);
});

test('pctChange', () => {
  assert.equal(pctChange(100, 110), 10);
  assert.equal(pctChange(0, 5), null);
});

test('nulmeting gebruikt bestaande oefeningen', () => {
  const ids = new Set(BUILTIN_EXERCISES.map((e) => e.id));
  for (const id of BASELINE.exerciseIds) assert.ok(ids.has(id), id);
});

import { weightForReps, REP_TARGETS } from '../js/calc.js';

test('weightForReps is de omgekeerde Epley', () => {
  const oneRM = epley1RM(60, 14);
  assert.equal(Math.round(oneRM), 88);
  assert.ok(Math.abs(weightForReps(oneRM, 14) - 60) < 1e-9);
  assert.equal(Math.round(weightForReps(oneRM, 10)), 66);
  assert.equal(Math.round(weightForReps(oneRM, 20)), 53);
  assert.equal(weightForReps(100, 1), 100);
  assert.equal(weightForReps(0, 10), 0);
  assert.deepEqual(REP_TARGETS, [6, 8, 10, 12, 15, 20, 25]);
});

test('planStatus: gepland telt pas als gedaan met gelogde sets', async () => {
  globalThis.indexedDB ??= {};
  const { planStatus } = await import('../js/agenda.js');
  const sessions = [{ id: 's1', date: '2026-12-01', templateId: 't1' }];
  const counts = new Map();
  const plan = { id: 'p1', date: '2026-12-01', templateId: 't1', sessionId: 's1' };
  assert.equal(planStatus(plan, sessions, counts, '2026-12-01').status, 'planned');
  assert.equal(planStatus(plan, sessions, counts, '2026-12-02').status, 'missed');
  counts.set('s1', 3);
  assert.equal(planStatus(plan, sessions, counts, '2026-12-02').status, 'done');
  // Zonder koppeling, maar wel dezelfde workout op die dag gelogd
  assert.equal(planStatus({ ...plan, sessionId: null }, sessions, counts, '2026-12-05').status, 'done');
  // Andere workout op die dag telt niet
  assert.equal(planStatus({ ...plan, sessionId: null, templateId: 't2' }, sessions, counts, '2026-12-05').status, 'missed');
});

import { FORMS, CUSTOM, normalizeItem, buildTarget, readTarget, itemLabel, schemeLabel, packWorkout, encodeWorkout, decodeWorkout } from '../js/schemes.js';

test('vormen: oude workout-items blijven werken', () => {
  assert.deepEqual(normalizeItem({ exerciseId: 'a', sets: 3, reps: 10 }), { exerciseId: 'a', form: CUSTOM, reps: [10, 10, 10] });
  assert.deepEqual(normalizeItem({ exerciseId: 'a', reps: [6, 10, 15] }).reps, [6, 10, 15]);
  assert.equal(normalizeItem({ exerciseId: 'a' }, 'pyramid').form, 'pyramid');
  assert.equal(normalizeItem({ exerciseId: 'a', form: 'low-high' }, 'pyramid').form, 'low-high');
  // Oude trainingen met { reps: [] } als doel
  assert.deepEqual(readTarget({ reps: [8, 8] }).sets, [{ reps: 8, load: 8 }, { reps: 8, load: 8 }]);
  assert.equal(readTarget(undefined), null);
  assert.equal(schemeLabel([10, 10, 10]), '3 × 10');
  assert.equal(schemeLabel([6, 10, 15]), '6 · 10 · 15');
});

test('vormen: doelen per training', () => {
  const lh = buildTarget({ exerciseId: 'a' }, 'low-high');
  assert.deepEqual(lh.sets.map((s) => s.reps), [6, 10, 15]);
  const tot = buildTarget({ exerciseId: 'a' }, 'total-30');
  assert.equal(tot.total, 30);
  assert.equal(tot.load, 10);
  // Willekeurig: één laag, één midden, één hoog, in elke volgorde
  for (let i = 0; i < 50; i++) {
    const r = buildTarget({ exerciseId: 'a' }, 'random-3').sets.map((s) => s.reps).sort((x, y) => x - y);
    assert.ok(r[0] >= 4 && r[0] <= 6 && r[1] >= 8 && r[1] <= 12 && r[2] >= 15 && r[2] <= 20, r.join());
  }
  assert.equal(buildTarget({ exerciseId: 'a' }, null), null);
  assert.deepEqual(buildTarget({ exerciseId: 'a', form: CUSTOM, reps: [5, 5] }).sets.map((s) => s.reps), [5, 5]);
  assert.match(itemLabel({ exerciseId: 'a' }, 'total-30'), /30 reps totaal/);
  for (const f of FORMS) assert.ok(f.build(Math.random), f.id);
});

test('delen: inpakken en uitpakken via link-code en JSON', () => {
  const t = { name: 'Push Ä', form: 'pyramid', items: [{ exerciseId: 'bench-press' }, { exerciseId: 'custom-x', form: CUSTOM, reps: [12, 12] }, { exerciseId: 'db-fly', form: 'total-30' }] };
  const custom = [{ id: 'custom-x', name: 'Mijn oefening', group: 'chest', equipment: 'cable', metric: 'reps', userId: 'me' }, { id: 'custom-y', name: 'Ongebruikt' }];
  const pack = packWorkout(t, custom);
  assert.equal(pack.custom.length, 1);
  assert.equal(pack.custom[0].userId, undefined);
  const code = encodeWorkout(pack);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const back = decodeWorkout(code);
  assert.equal(back.name, 'Push Ä');
  assert.equal(back.form, 'pyramid');
  assert.deepEqual(back.items[0], { exerciseId: 'bench-press' });
  assert.deepEqual(back.items[1], { exerciseId: 'custom-x', form: CUSTOM, reps: [12, 12] });
  assert.deepEqual(back.items[2], { exerciseId: 'db-fly', form: 'total-30' });
  // Oude links (v1, alleen reps) blijven werken
  const v1 = decodeWorkout(JSON.stringify({ app: 'fitnessapp', type: 'workout', v: 1, name: 'Oud', items: [{ e: 'bench-press', r: [6, 10, 15] }] }));
  assert.deepEqual(v1.items[0].reps, [6, 10, 15]);
  assert.throws(() => decodeWorkout('rommel'), /geen geldige workout/);
  assert.throws(() => decodeWorkout('{"app":"x"}'), /geen geldige workout/);
});

import { BUILTIN_WORKOUTS } from '../js/exercises.js';

test('standaardworkouts: geldige oefeningen, unieke ids, bestaande vorm', () => {
  const ids = new Set(BUILTIN_EXERCISES.map((e) => e.id));
  const seen = new Set();
  for (const t of BUILTIN_WORKOUTS) {
    assert.ok(t.id.startsWith('tpl-') && !seen.has(t.id), t.id);
    seen.add(t.id);
    assert.ok(FORMS.some((f) => f.id === t.form), `${t.id}: vorm ${t.form}`);
    for (const i of t.items) assert.ok(ids.has(i.exerciseId), `${t.id}: ${i.exerciseId}`);
  }
});
