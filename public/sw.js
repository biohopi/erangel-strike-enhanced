const CACHE = 'erangel-strike-shell-v1';
const CORE = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/game/index.html', '/game/engine.js', '/game/hud.css', '/images/erangel-lobby.jpg', '/images/m416.jpg', '/images/kar98k.jpg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const url = new URL(req.url);
  if (url.pathname === '/ws' || url.pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, {ignoreSearch:true});
    if (cached) {
      event.waitUntil(fetch(req).then(response => { if (response.ok) cache.put(req, response.clone()); }).catch(() => {}));
      return cached;
    }
    try {
      const response = await fetch(req);
      if (response.ok && (response.type === 'basic' || response.type === 'cors')) cache.put(req, response.clone());
      return response;
    } catch (error) {
      if (req.mode === 'navigate') return (await cache.match('/index.html')) || Response.error();
      return Response.error();
    }
  })());
});
