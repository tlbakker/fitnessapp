// Service worker: maakt de app offline bruikbaar. Verhoog VERSION bij elke release,
// dan halen telefoons de nieuwe bestanden op.
const VERSION = 'v8';
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
  './js/greeting.js',
  './js/estimate.js',
  './js/fit.js',
  './js/garmin.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' slaat de HTTP-cache van de browser over. Anders kan een nieuwe versie
  // half oude bestanden bevatten (GitHub Pages laat ze 10 minuten cachen), en dan passen
  // de modules niet meer op elkaar.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Eerst het netwerk, zodat je altijd de nieuwste versie hebt. Duurt dat langer dan 3
// seconden of is er geen bereik (sportschool), dan de versie uit de cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const network = fetch(e.request, { cache: 'no-cache' }).then((res) => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      });
      const cached = () => cache.match(e.request, { ignoreSearch: true });
      const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const res = await Promise.race([network, timeout.then(cached)]);
        if (res) return res;
        return await network;
      } catch {
        return (await cached()) || (await cache.match('./index.html')) || Response.error();
      }
    }),
  );
});
