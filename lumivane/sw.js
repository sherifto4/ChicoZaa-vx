/* Lumivane service worker. Lives in lumivane/ so its scope is /lumivane/ only. */
const VERSION = '1.1.1';            /* keep equal to APP_VERSION in index.html; bump on every release */
const CACHE = 'lumivane-v' + VERSION;
const PREFIX = 'lumivane-';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* one missing file must not block installation of the rest */
    await Promise.all(CORE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;                 /* never touch other origins */
  if (!u.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;

  if (r.mode === 'navigate') {            /* page: network first (fast timeout) so updates arrive, cache when offline */
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(r), new Promise((_, rej) => setTimeout(rej, 3500))]);
        if (res && res.ok) c.put('./index.html', res.clone());
        return res;
      } catch (_) {
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }
  e.respondWith((async () => {            /* assets: cache first, fill cache on first online use */
    const c = await caches.open(CACHE), hit = await c.match(r, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(r);
      if (res && res.ok) c.put(r, res.clone());
      return res;
    } catch (_) { return Response.error(); }
  })());
});
