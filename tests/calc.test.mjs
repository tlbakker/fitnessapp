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
