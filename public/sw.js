// Hält die App-Dateien im Cache, damit die Kasse auch ohne Internet startet.
// Daten (Bestellungen) laufen nicht hierüber, sondern über den Firestore-Cache.
const CACHE = 'bar-kasse-v1';
const FILES = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Erst Netz (damit Updates ankommen), bei Ausfall oder nach 3 s aus dem Cache.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const fromCache = () => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'));
  const fromNet = fetch(e.request).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
    }
    return res;
  });
  const slow = new Promise((resolve) => setTimeout(resolve, 3000)).then(fromCache);
  e.respondWith(
    Promise.race([fromNet, slow.then((r) => r || fromNet)]).catch(() => fromCache())
  );
});
