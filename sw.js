// Service worker: makes the app installable and gives it an offline app shell.
// Strategy: network-first (so an online device always gets the latest code), falling back to the cache when offline or slow.
// Only same-origin files and the pinned Firebase SDK modules are cached. Live data (Firestore/Auth/Storage) is never intercepted.
const CACHE = 'azpawn-shell-v1', TIMEOUT_MS = 4000;
const SHELL = ['./', 'index.html', 'css/theme.css', 'img/logo.webp', 'icons/icon-192.png', 'manifest.webmanifest', 'js/firebase.js', 'js/config.js', 'js/settings-logic.js', 'js/pin-gate.js', 'js/pin.js', 'js/pin-crypto.js', 'js/dates.js'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

const cacheable = (url) => url.origin === location.origin || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) || url.hostname === 'cdn.jsdelivr.net';
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || !cacheable(url)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
    try { return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), TIMEOUT_MS))]); }
    catch { const hit = await cache.match(req, { ignoreSearch: false }) || (req.mode === 'navigate' ? await cache.match('index.html') : null); return hit || net.catch(() => new Response('Offline', { status: 503 })); }
  })());
});
