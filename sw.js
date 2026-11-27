// Service worker: maakt de app offline bruikbaar. Verhoog VERSION bij elke release,
// dan halen telefoons de nieuwe bestanden op.
const VERSION = 'v5';
const CACHE = `fitness-${VERSION}`;
const FILES = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/db.js',
  './js/calc.js',
  './js/exercises.js',
  './js/ui.js',
  './js/chart.js',
  './js/progress.js',
  './js/workouts.js',
  './js/agenda.js',
  './js/schemes.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Eerst uit de cache (snel, ook bij slecht bereik in de sportschool), en op de
// achtergrond de nieuwste versie ophalen voor de volgende keer.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached || cache.match('./index.html'));
      return cached || network;
    }),
  );
});
