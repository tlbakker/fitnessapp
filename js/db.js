// Lokale opslag in IndexedDB. Er is geen server: alles staat op het toestel.
//
// Stores:
//   exercises  eigen oefeningen (de vaste lijst zit in exercises.js)
//   sessions   trainingen: { id, userId, date 'YYYY-MM-DD', startedAt, finishedAt,
//              exerciseIds: [], note, templateId }
//   sets       { id, userId, sessionId, exerciseId, idx, reps, weight, createdAt }
//   templates  (stap 2) vaste workouts: { id, userId, name, items: [{ exerciseId, sets, reps, weight }] }
//   plans      (stap 2) agenda: { id, userId, date, templateId, overrides }
//   meta       instellingen en profielen: { key, value }
//
// Elk record heeft een userId, zodat later een tweede gebruiker kan worden toegevoegd.

const DB_NAME = 'fitnessapp';
const DB_VERSION = 1;
export const USER_ID = 'me';

let dbPromise;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('exercises')) {
        db.createObjectStore('exercises', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('sets')) {
        const s = db.createObjectStore('sets', { keyPath: 'id' });
        s.createIndex('sessionId', 'sessionId');
        s.createIndex('exerciseId', 'exerciseId');
      }
      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('plans')) {
        const s = db.createObjectStore('plans', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export async function getAll(name) {
  return promisify((await store(name)).getAll());
}

export async function get(name, id) {
  return promisify((await store(name)).get(id));
}

export async function put(name, value) {
  return promisify((await store(name, 'readwrite')).put(value));
}

export async function del(name, id) {
  return promisify((await store(name, 'readwrite')).delete(id));
}

export async function getByIndex(name, index, key) {
  return promisify((await store(name)).index(index).getAll(key));
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ---- Domeinfuncties ----

export async function deleteSession(id) {
  const sets = await getByIndex('sets', 'sessionId', id);
  const db = await openDB();
  const tx = db.transaction(['sets', 'sessions'], 'readwrite');
  for (const s of sets) tx.objectStore('sets').delete(s.id);
  tx.objectStore('sessions').delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

/** Alle stores als één JSON-object (voor back-up). */
export async function exportAll() {
  const names = ['exercises', 'sessions', 'sets', 'templates', 'plans', 'meta'];
  const out = { app: 'fitnessapp', version: DB_VERSION, exportedAt: new Date().toISOString() };
  for (const n of names) out[n] = await getAll(n);
  return out;
}

/** Zet een back-up terug. Bestaande records met hetzelfde id worden overschreven. */
export async function importAll(data) {
  if (!data || data.app !== 'fitnessapp') throw new Error('Dit is geen back-up van deze app.');
  const names = ['exercises', 'sessions', 'sets', 'templates', 'plans', 'meta'];
  const db = await openDB();
  const tx = db.transaction(names, 'readwrite');
  let count = 0;
  for (const n of names) {
    for (const rec of data[n] || []) {
      tx.objectStore(n).put(rec);
      count++;
    }
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  return count;
}
