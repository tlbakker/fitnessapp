// FIT-bestanden (het formaat van Garmin) schrijven en lezen, zonder externe libraries.
//
// - encodeSessionFit(): een gelogde training als .fit-activiteit, om handmatig te
//   importeren in Garmin Connect (connect.garmin.com > Importeer gegevens). Krachttraining
//   wordt een 'Krachttraining' met sets, reps en gewichten; alleen conditie wordt
//   loopband/fiets/roeien/crosstrainer met tijd en afstand.
// - decodeFit(): leest een .fit-activiteit van je horloge (uit Garmin Connect
//   geëxporteerd) en haalt de hartslag, calorieën en tijden eruit.
// - unzipFit(): Garmin Connect levert 'Origineel exporteren' als .zip; daar halen we de
//   .fit uit.
//
// Tijden in FIT zijn seconden sinds 31-12-1989 00:00 UTC.

export const FIT_EPOCH_MS = Date.UTC(1989, 11, 31);
export const toFitTime = (ms) => Math.round((ms - FIT_EPOCH_MS) / 1000);
export const fromFitTime = (s) => FIT_EPOCH_MS + s * 1000;

// ---------- CRC ----------

const CRC_TABLE = [
  0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401,
  0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400,
];

export function fitCrc(bytes, start = 0, end = bytes.length, crc = 0) {
  for (let i = start; i < end; i++) {
    const b = bytes[i];
    let tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[b & 0xf];
    tmp = CRC_TABLE[crc & 0xf];
    crc = (crc >> 4) & 0x0fff;
    crc = crc ^ tmp ^ CRC_TABLE[(b >> 4) & 0xf];
  }
  return crc;
}

// ---------- basistypes ----------

const T = {
  enum: { id: 0x00, size: 1, invalid: 0xff },
  uint8: { id: 0x02, size: 1, invalid: 0xff },
  uint16: { id: 0x84, size: 2, invalid: 0xffff },
  uint32: { id: 0x86, size: 4, invalid: 0xffffffff },
  uint32z: { id: 0x8c, size: 4, invalid: 0 },
};

// Globale berichtnummers
const MSG = { fileId: 0, session: 18, lap: 19, record: 20, event: 21, activity: 34, set: 225 };

// sport / sub_sport
const SPORT = { running: 1, cycling: 2, fitnessEquipment: 4, training: 10, rowing: 15 };
const SUB = { generic: 0, treadmill: 1, indoorCycling: 6, indoorRowing: 14, elliptical: 15, stairClimbing: 16, strength: 20 };

// ---------- schrijven ----------

class FitWriter {
  constructor() {
    this.chunks = [];
    this.defs = new Map(); // local -> fields
  }

  define(local, global, fields) {
    // fields: [[fieldNum, typeName]]
    const b = [0x40 | local, 0, 0, global & 0xff, global >> 8, fields.length];
    for (const [num, type] of fields) b.push(num, T[type].size, T[type].id);
    this.chunks.push(Uint8Array.from(b));
    this.defs.set(local, fields);
  }

  data(local, values) {
    const fields = this.defs.get(local);
    const size = 1 + fields.reduce((n, [, t]) => n + T[t].size, 0);
    const buf = new Uint8Array(size);
    const dv = new DataView(buf.buffer);
    buf[0] = local;
    let o = 1;
    fields.forEach(([, type], i) => {
      const t = T[type];
      let v = values[i];
      if (v == null || !Number.isFinite(v)) v = t.invalid;
      v = Math.max(0, Math.min(t.invalid === 0 ? 0xffffffff : t.invalid, Math.round(v)));
      if (t.size === 1) dv.setUint8(o, v);
      else if (t.size === 2) dv.setUint16(o, v, true);
      else dv.setUint32(o, v, true);
      o += t.size;
    });
    this.chunks.push(buf);
  }

  bytes() {
    const dataSize = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(14 + dataSize + 2);
    const dv = new DataView(out.buffer);
    out[0] = 14;
    out[1] = 0x20; // protocol 2.0
    dv.setUint16(2, 2132, true); // profiel 21.32
    dv.setUint32(4, dataSize, true);
    out.set([0x2e, 0x46, 0x49, 0x54], 8); // ".FIT"
    dv.setUint16(12, fitCrc(out, 0, 12), true);
    let o = 14;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    dv.setUint16(o, fitCrc(out, 0, o), true);
    return out;
  }
}

// Garmin exercise_category, zodat Connect de oefening een naam geeft (je kunt hem daar
// nog aanpassen). Volgorde telt: de eerste die past wint.
const CATEGORY_RULES = [
  [/calf/, 1], // calf_raise
  [/kettlebell-swing|swing/, 12], // hip_swing
  [/lunge|split-squat|step-up|uitval/, 17], // lunge
  [/leg-curl|hamstring curl/, 15], // leg_curl
  [/wrist-curl|curl/, 7], // curl
  [/triceps|skull|pushdown|arm-extension|dips/, 30], // triceps_extension
  [/push-up|opdrukken/, 22], // push_up
  [/fly|crossover|pectoral|butterfly|rear-delt/, 9], // flye
  [/bench|chest-press/, 0], // bench_press
  [/romanian|deadlift|good-morning/, 8], // deadlift
  [/pull-up|chin-up|pulldown|lat-machine|vertical-traction|optrekken/, 21], // pull_up
  [/shrug/, 26],
  [/row|face-pull|upper-back/, 23], // row
  [/lateral|delts|front-raise/, 14], // lateral_raise
  [/shoulder-press|overhead-press|arnold|press.*shoulder|schouder/, 24], // shoulder_press
  [/squat|leg-press|leg-extension|beenpers/, 28], // squat
  [/hip-thrust|glute|kickback|bridge/, 10], // hip_raise
  [/abductor|adductor|multi-hip/, 11], // hip_stability
  [/plank/, 19],
  [/crunch/, 6],
  [/leg-raise/, 16],
  [/ab-wheel|russian-twist|rotary|torso/, 5], // core
  [/back-extension|lower-back|hyperextension/, 13], // hyperextension
  [/farmer|carry/, 3], // carry
];
const GROUP_FALLBACK = {
  chest: 0, back: 23, shoulders: 24, biceps: 7, triceps: 30, forearms: 7, quads: 28, hamstrings: 15,
  glutes: 10, hips: 11, calves: 1, abs: 5, lowerback: 13, cardio: 2,
};

export function garminCategory(e) {
  if (!e) return 65534;
  if (e.metric === 'cardio') return 2;
  const hay = `${e.id} ${e.name}`.toLowerCase().replace(/\s+/g, '-');
  for (const [re, cat] of CATEGORY_RULES) if (re.test(hay)) return cat;
  return GROUP_FALLBACK[e.group] ?? 65534; // unknown
}

/** Sport voor een training met alleen conditie op één soort apparaat. */
export function cardioSport(e) {
  const hay = `${e.id} ${e.name} ${e.aka || ''}`.toLowerCase();
  if (/treadmill|loopband|run/.test(hay)) return [SPORT.running, SUB.treadmill];
  if (/row|roei/.test(hay)) return [SPORT.rowing, SUB.indoorRowing];
  if (/bike|fiets|recline/.test(hay)) return [SPORT.cycling, SUB.indoorCycling];
  if (/cross|ellip|synchro/.test(hay)) return [SPORT.fitnessEquipment, SUB.elliptical];
  if (/step|climb|trap/.test(hay)) return [SPORT.fitnessEquipment, SUB.stairClimbing];
  return [SPORT.fitnessEquipment, SUB.generic];
}

const parseMs = (iso) => (iso ? Date.parse(iso) : NaN);

/**
 * Bouwt de tijdlijn van een training: begin, eind en per set een begin- en eindtijd.
 * De app weet niet precies hoe lang een set duurde, dus we verdelen de trainingstijd:
 * krachtsets 45 s (tijd-oefeningen hun seconden, conditie hun minuten), de rest is rust.
 */
export function sessionTimeline(session, sets, ex) {
  const ordered = [...sets].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.idx - b.idx);
  const activeSec = (s) => {
    const e = ex(s.exerciseId);
    if (e.metric === 'cardio') return Math.max(60, (Number(s.reps) || 0) * 60);
    if (e.metric === 'time') return Math.max(10, Number(s.reps) || 30);
    return 45;
  };
  const active = ordered.map(activeSec);
  const activeTotal = active.reduce((a, b) => a + b, 0);

  let start = parseMs(session.hr?.start) || parseMs(session.startedAt);
  let end = session.hr?.durationSec ? start + session.hr.durationSec * 1000 : parseMs(session.finishedAt);
  if (!session.hr?.start && Number.isFinite(start)) {
    // De datum van de training kan achteraf zijn aangepast: houd de kloktijd, verschuif de dag.
    const d = new Date(start);
    const [y, m, day] = (session.date || '').split('-').map(Number);
    if (y && (d.getFullYear() !== y || d.getMonth() + 1 !== m || d.getDate() !== day)) {
      const shifted = new Date(y, m - 1, day, d.getHours(), d.getMinutes(), d.getSeconds()).getTime();
      if (Number.isFinite(end)) end += shifted - start;
      start = shifted;
    }
  }
  if (!Number.isFinite(start)) {
    const [y, m, day] = (session.date || '').split('-').map(Number);
    start = new Date(y, m - 1, day, 18, 0, 0).getTime();
  }
  let total = Number.isFinite(end) ? Math.round((end - start) / 1000) : 0;
  // Training niet afgerond of tijd onlogisch (minder dan de sets zelf, of langer dan 4 uur)
  if (total < activeTotal || total > 4 * 3600) total = activeTotal + ordered.length * 90;
  const rest = ordered.length ? (total - activeTotal) / ordered.length : 0;

  let t = start;
  const timed = ordered.map((s, i) => {
    const from = t;
    t += active[i] * 1000;
    const to = t;
    t += rest * 1000;
    return { set: s, start: from, end: to, rest: Math.round(rest) };
  });
  return { start, end: start + total * 1000, totalSec: total, sets: timed };
}

/** Een gelogde training als FIT-activiteit (Uint8Array). */
export function encodeSessionFit(session, sets, ex) {
  const tl = sessionTimeline(session, sets, ex);
  const startF = toFitTime(tl.start);
  const endF = toFitTime(tl.end);
  const exercises = [...new Set(tl.sets.map((x) => x.set.exerciseId))].map(ex);
  const cardioOnly = exercises.length > 0 && exercises.every((e) => e.metric === 'cardio');
  const devices = new Set(exercises.map((e) => cardioSport(e).join('/')));
  const [sport, subSport] = cardioOnly && devices.size === 1 ? cardioSport(exercises[0]) : [SPORT.training, SUB.strength];
  const km = tl.sets.reduce((n, x) => n + (Number(x.set.km) || 0), 0);
  const hr = session.hr || {};
  const tzOffsetSec = -new Date(tl.start).getTimezoneOffset() * 60;

  const w = new FitWriter();
  w.define(0, MSG.fileId, [[0, 'enum'], [1, 'uint16'], [2, 'uint16'], [3, 'uint32z'], [4, 'uint32']]);
  // type 4 = activiteit; fabrikant 255 = 'development' (eigen app)
  w.data(0, [4, 255, 1, (startF % 0xfffffffe) + 1, startF]);

  w.define(1, MSG.event, [[253, 'uint32'], [0, 'enum'], [1, 'enum'], [4, 'uint8']]);
  w.data(1, [startF, 0, 0, 0]); // timer start

  if (!cardioOnly) {
    w.define(2, MSG.set, [
      [254, 'uint32'], // timestamp (bij set is dat veld 254)
      [0, 'uint32'], // duur (ms)
      [3, 'uint16'], // reps
      [4, 'uint16'], // gewicht × 16
      [5, 'uint8'], // 1 = actief, 0 = rust
      [6, 'uint32'], // starttijd
      [7, 'uint16'], // categorie
      [9, 'uint16'], // eenheid: 1 = kg
      [10, 'uint16'], // volgnummer
    ]);
    let i = 0;
    for (const x of tl.sets) {
      const e = ex(x.set.exerciseId);
      const dur = x.end - x.start;
      const reps = e.metric === 'reps' ? Number(x.set.reps) || null : null;
      const weight = e.metric !== 'cardio' && Number(x.set.weight) ? Number(x.set.weight) * 16 : null;
      w.data(2, [toFitTime(x.end), dur, reps, weight, 1, toFitTime(x.start), garminCategory(e), 1, i++]);
      if (x.rest > 0) {
        w.data(2, [toFitTime(x.end) + x.rest, x.rest * 1000, null, null, 0, toFitTime(x.end), null, 1, i++]);
      }
    }
  }

  // Hartslag (als die eerder uit een Garmin-bestand is gehaald)
  const samples = Array.isArray(hr.samples) ? hr.samples : [];
  if (samples.length && hr.start) {
    const hrStart = toFitTime(parseMs(hr.start));
    w.define(3, MSG.record, [[253, 'uint32'], [3, 'uint8']]);
    for (const [sec, bpm] of samples) w.data(3, [hrStart + sec, bpm]);
  }

  w.data(1, [endF, 0, 4, 0]); // timer stop_all

  const total = tl.totalSec * 1000;
  w.define(4, MSG.lap, [[254, 'uint16'], [253, 'uint32'], [0, 'enum'], [1, 'enum'], [2, 'uint32'], [7, 'uint32'], [8, 'uint32'], [9, 'uint32'], [25, 'enum'], [39, 'enum']]);
  w.data(4, [0, endF, 9, 1, startF, total, total, km ? km * 100000 : null, sport, subSport]);

  w.define(5, MSG.session, [
    [254, 'uint16'], [253, 'uint32'], [0, 'enum'], [1, 'enum'], [2, 'uint32'], [5, 'enum'], [6, 'enum'],
    [7, 'uint32'], [8, 'uint32'], [9, 'uint32'], [11, 'uint16'], [16, 'uint8'], [17, 'uint8'], [25, 'uint16'], [26, 'uint16'],
  ]);
  w.data(5, [0, endF, 8, 1, startF, sport, subSport, total, total, km ? km * 100000 : null, hr.kcal ?? null, hr.avg ?? null, hr.max ?? null, 0, 1]);

  w.define(6, MSG.activity, [[253, 'uint32'], [0, 'uint32'], [1, 'uint16'], [2, 'enum'], [3, 'enum'], [4, 'enum'], [5, 'uint32']]);
  w.data(6, [endF, total, 1, 0, 26, 1, endF + tzOffsetSec]);

  return w.bytes();
}

// ---------- lezen ----------

const BASE_SIZE = { 0x00: 1, 0x01: 1, 0x02: 1, 0x0a: 1, 0x0d: 1, 0x07: 1, 0x83: 2, 0x84: 2, 0x8b: 2, 0x85: 4, 0x86: 4, 0x8c: 4, 0x88: 4, 0x89: 8, 0x8e: 8, 0x8f: 8, 0x90: 8 };

function readValue(dv, o, size, type, little) {
  const base = type & 0x9f;
  if (size === 1 || BASE_SIZE[base] === 1) {
    const v = dv.getUint8(o);
    return base === 0x01 ? (v === 0x7f ? null : (v << 24) >> 24) : v === 0xff && base !== 0x0a && base !== 0x0d ? null : v;
  }
  if (BASE_SIZE[base] === 2 && size >= 2) {
    if (base === 0x83) { const v = dv.getInt16(o, little); return v === 0x7fff ? null : v; }
    const v = dv.getUint16(o, little);
    return (base === 0x8b ? v === 0 : v === 0xffff) ? null : v;
  }
  if (BASE_SIZE[base] === 4 && size >= 4) {
    if (base === 0x85) { const v = dv.getInt32(o, little); return v === 0x7fffffff ? null : v; }
    if (base === 0x88) return dv.getFloat32(o, little);
    const v = dv.getUint32(o, little);
    return (base === 0x8c ? v === 0 : v === 0xffffffff) ? null : v;
  }
  return null;
}

/**
 * Leest een FIT-bestand en geeft de berichten die we nodig hebben:
 * { fileId, sessions: [...], records: [{ t, hr }], ... }.
 */
export function decodeFit(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 12) throw new Error('Bestand is te klein voor een FIT-bestand.');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = bytes[0];
  const sig = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (sig !== '.FIT') throw new Error('Dit is geen FIT-bestand.');
  const dataSize = dv.getUint32(4, true);
  const end = Math.min(bytes.length, headerSize + dataSize);

  const defs = new Map();
  const out = { fileId: null, sessions: [], records: [], laps: 0, sets: [] };
  let o = headerSize;
  let lastTs = 0;

  while (o < end) {
    const hdr = bytes[o++];
    let local;
    let compressedTs = null;
    if (hdr & 0x80) {
      local = (hdr >> 5) & 0x03;
      const off = hdr & 0x1f;
      let ts = (lastTs & ~0x1f) + off;
      if (off < (lastTs & 0x1f)) ts += 0x20;
      compressedTs = ts >>> 0;
      lastTs = compressedTs;
    } else if (hdr & 0x40) {
      local = hdr & 0x0f;
      const dev = hdr & 0x20;
      const little = bytes[o + 1] === 0;
      const global = little ? dv.getUint16(o + 2, true) : dv.getUint16(o + 2, false);
      const n = bytes[o + 4];
      o += 5;
      const fields = [];
      for (let i = 0; i < n; i++, o += 3) fields.push({ num: bytes[o], size: bytes[o + 1], type: bytes[o + 2] });
      let devSize = 0;
      if (dev) {
        const nd = bytes[o++];
        for (let i = 0; i < nd; i++, o += 3) devSize += bytes[o + 1];
      }
      defs.set(local, { global, little, fields, devSize });
      continue;
    } else {
      local = hdr & 0x0f;
    }

    const def = defs.get(local);
    if (!def) throw new Error('Kapot FIT-bestand (onbekend bericht).');
    const v = {};
    for (const f of def.fields) {
      v[f.num] = o + f.size <= bytes.length ? readValue(dv, o, f.size, f.type, def.little) : null;
      o += f.size;
    }
    o += def.devSize;
    if (v[253] != null) lastTs = v[253];
    const ts = v[253] ?? compressedTs;

    switch (def.global) {
      case MSG.fileId:
        out.fileId = { type: v[0], manufacturer: v[1], product: v[2], timeCreated: v[4] };
        break;
      case MSG.session:
        out.sessions.push({
          timestamp: ts, start: v[2], elapsed: v[7] != null ? v[7] / 1000 : null, timer: v[8] != null ? v[8] / 1000 : null,
          sport: v[5], subSport: v[6], kcal: v[11], avgHr: v[16], maxHr: v[17],
        });
        break;
      case MSG.record:
        if (ts != null && v[3] != null) out.records.push({ t: ts, hr: v[3] });
        break;
      case MSG.lap:
        out.laps++;
        break;
      case MSG.set:
        out.sets.push({ timestamp: v[254], duration: v[0] != null ? v[0] / 1000 : null, reps: v[3], weight: v[4] != null ? v[4] / 16 : null, type: v[5], category: v[7] });
        break;
      default:
    }
  }
  return out;
}

/**
 * Samenvatting van de hartslag uit een FIT-activiteit, klaar om bij een training op te slaan.
 * samples: [seconden na start, bpm], ongeveer elke 15 s (genoeg voor een grafiekje).
 */
export function heartRateSummary(fit, { step = 15 } = {}) {
  const s = fit.sessions[0] || {};
  const recs = fit.records;
  const startF = s.start ?? recs[0]?.t ?? fit.fileId?.timeCreated;
  if (startF == null) throw new Error('Geen starttijd gevonden in het bestand.');
  let durationSec = s.elapsed ?? s.timer ?? (recs.length ? recs[recs.length - 1].t - startF : null);
  const samples = [];
  let bucket = null;
  for (const r of recs) {
    const sec = r.t - startF;
    if (sec < 0) continue;
    const b = Math.floor(sec / step);
    if (!bucket || bucket.b !== b) {
      if (bucket) samples.push([bucket.b * step, Math.round(bucket.sum / bucket.n)]);
      bucket = { b, sum: 0, n: 0 };
    }
    bucket.sum += r.hr;
    bucket.n++;
  }
  if (bucket) samples.push([bucket.b * step, Math.round(bucket.sum / bucket.n)]);
  const hrs = recs.map((r) => r.hr);
  const avg = s.avgHr ?? (hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null);
  const max = s.maxHr ?? (hrs.length ? Math.max(...hrs) : null);
  if (avg == null && max == null) throw new Error('Er staat geen hartslag in dit bestand.');
  return {
    start: new Date(fromFitTime(startF)).toISOString(),
    durationSec: durationSec != null ? Math.round(durationSec) : null,
    avg,
    max,
    kcal: s.kcal ?? null,
    sport: s.sport ?? null,
    samples,
  };
}

// ---------- zip ----------

function isZip(bytes) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Deze browser kan geen zip uitpakken. Pak de .fit eerst zelf uit.');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Geeft de bytes van het (eerste) .fit-bestand; pakt een zip uit als dat nodig is. */
export async function unzipFit(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!isZip(bytes)) return bytes;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // Einde van de centrale map zoeken
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Kapotte zip.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.fit$/i.test(name)) continue;
    const dataStart = localOff + 30 + dv.getUint16(localOff + 26, true) + dv.getUint16(localOff + 28, true);
    const data = bytes.subarray(dataStart, dataStart + csize);
    if (method === 0) return data;
    if (method === 8) return inflateRaw(data);
    throw new Error('Onbekende zip-compressie.');
  }
  throw new Error('Geen .fit-bestand in de zip gevonden.');
}
