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
