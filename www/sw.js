// Fonctionnement hors-ligne : réseau d'abord (toujours la dernière version),
// puis copie en cache si le téléphone n'a pas de connexion.
const CACHE = 'dossier5-v2';
const FILES = ['./', 'index.html', 'app.js', 'style.css', 'cloud.js', 'pdf.js', 'remediation-data.js'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  const net = new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error('timeout')), 5000);
    fetch(r).then(res => { clearTimeout(t); ok(res); }, err => { clearTimeout(t); ko(err); });
  });
  e.respondWith(net.then(res => {
    if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(r, c)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
});
