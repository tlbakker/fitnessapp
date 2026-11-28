import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeSessionFit, decodeFit, heartRateSummary, fitCrc, garminCategory, sessionTimeline } from '../js/fit.js';
import { BUILTIN_EXERCISES } from '../js/exercises.js';

const map = new Map(BUILTIN_EXERCISES.map((e) => [e.id, e]));
const ex = (id) => map.get(id);

const session = { id: 's1', date: '2026-11-27', startedAt: '2026-11-27T17:00:00Z', finishedAt: '2026-11-27T18:00:00Z', exerciseIds: ['bench-press', 'tg-treadmill'] };
const sets = [
  { sessionId: 's1', exerciseId: 'bench-press', idx: 0, reps: 10, weight: 62.5, createdAt: '2026-11-27T17:05:00Z' },
  { sessionId: 's1', exerciseId: 'bench-press', idx: 1, reps: 8, weight: 70, createdAt: '2026-11-27T17:08:00Z' },
  { sessionId: 's1', exerciseId: 'tg-treadmill', idx: 0, reps: 10, km: 1.6, createdAt: '2026-11-27T17:40:00Z' },
];

test('FIT-export heeft een geldige header en CRC', () => {
  const b = encodeSessionFit(session, sets, ex);
  assert.equal(String.fromCharCode(...b.subarray(8, 12)), '.FIT');
  assert.equal(fitCrc(b), 0); // CRC over alles inclusief de CRC zelf is 0
});

test('FIT-export: sets, reps en gewicht lezen we terug', () => {
  const fit = decodeFit(encodeSessionFit(session, sets, ex));
  const active = fit.sets.filter((s) => s.type === 1);
  assert.equal(active.length, 3);
  assert.deepEqual(active.slice(0, 2).map((s) => [s.reps, s.weight, s.category]), [[10, 62.5, 0], [8, 70, 0]]);
  assert.equal(fit.sessions[0].sport, 10); // training
  assert.equal(fit.sessions[0].subSport, 20); // krachttraining
  assert.equal(fit.sessions[0].elapsed, 3600);
});

test('Alleen loopband wordt een loopactiviteit', () => {
  const fit = decodeFit(encodeSessionFit(session, sets.slice(2), ex));
  assert.equal(fit.sessions[0].sport, 1);
  assert.equal(fit.sets.length, 0);
});

test('Tijdlijn past binnen de training, ook als die niet is afgerond', () => {
  const tl = sessionTimeline({ ...session, finishedAt: null }, sets, ex);
  assert.ok(tl.totalSec >= 45 * 2 + 600);
  assert.ok(tl.sets.at(-1).end <= tl.end);
});

test('Hartslag uit een FIT-bestand en weer mee in de export', () => {
  const withHr = { ...session, hr: { start: '2026-11-27T17:00:00.000Z', durationSec: 3600, avg: 128, max: 162, kcal: 400, samples: [[0, 95], [15, 110], [30, 130]] } };
  const fit = decodeFit(encodeSessionFit(withHr, sets, ex));
  assert.equal(fit.records.length, 3);
  const hr = heartRateSummary(fit, { step: 15 });
  assert.equal(hr.avg, 128);
  assert.equal(hr.max, 162);
  assert.equal(hr.kcal, 400);
  assert.equal(hr.start, '2026-11-27T17:00:00.000Z');
  assert.deepEqual(hr.samples, [[0, 95], [15, 110], [30, 130]]);
});

test('Elke vaste oefening krijgt een Garmin-categorie', () => {
  for (const e of BUILTIN_EXERCISES) assert.notEqual(garminCategory(e), 65534, e.id);
  assert.equal(garminCategory(ex('tg-leg-curl')), 15);
  assert.equal(garminCategory(ex('tg-lat-machine')), 21);
  assert.equal(garminCategory(ex('hammer-curl')), 7);
});
