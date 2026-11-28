import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { estimate1RM, startWeight, ageFrom, ageFactor, STRENGTH_RATIOS } from '../js/estimate.js';
import { BUILTIN_EXERCISES, BASELINE } from '../js/exercises.js';

const today = new Date('2026-11-27');
const tim = { sex: 'm', birthYear: 1991, experience: 'returning' };

test('leeftijd uit geboortejaar', () => {
  assert.equal(ageFrom(1991, today), 35);
  assert.equal(ageFrom(null, today), null);
});

test('leeftijd telt pas mee na 40', () => {
  assert.equal(ageFactor(35), 1);
  assert.equal(ageFactor(50), 0.9);
  assert.equal(ageFactor(95), 0.6);
});

test('bankdrukken: man 90 kg, terug na een jaar rust', () => {
  assert.equal(estimate1RM('bench-press', tim, 90, today), 67.5);
  assert.equal(startWeight('bench-press', tim, 90, 15, today), 45);
});

test('vrouw en ouder geeft lichtere startgewichten', () => {
  const man = startWeight('back-squat', tim, 70, 15, today);
  assert.ok(startWeight('back-squat', { ...tim, sex: 'v' }, 70, 15, today) < man);
  assert.ok(startWeight('back-squat', { ...tim, birthYear: 1966 }, 70, 15, today) < man);
  assert.ok(startWeight('back-squat', { ...tim, experience: 'beginner' }, 70, 15, today) < man);
});

test('zonder gewicht of voor onbekende oefening geen schatting', () => {
  assert.equal(startWeight('bench-press', tim, null, 15, today), null);
  assert.equal(startWeight('push-up', tim, 90, 15, today), null);
});

test('elke geschatte oefening bestaat en zit in de nulmeting', () => {
  const ids = new Set(BUILTIN_EXERCISES.map((e) => e.id));
  for (const id of Object.keys(STRENGTH_RATIOS)) {
    assert.ok(ids.has(id), id);
    assert.ok(BASELINE.exerciseIds.includes(id), id);
  }
});

test('app en service worker hebben dezelfde versie, en elke module staat in de cache', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.equal(sw.match(/VERSION = '(v\d+)'/)[1], app.match(/APP_VERSION = '(v\d+)'/)[1]);
  for (const f of readdirSync(new URL('../js/', import.meta.url))) {
    assert.ok(sw.includes(`./js/${f}`), f);
  }
});
