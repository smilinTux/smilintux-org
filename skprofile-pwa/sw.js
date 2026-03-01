const CACHE_NAME = 'skprofile-v1';
const STATIC_ASSETS = [
  '/app/',
  '/app/index.html',
  '/app/css/style.css',
  '/app/js/app.js',
  '/app/js/api.js',
  '/app/js/views/profile.js',
  '/app/js/views/memories.js',
  '/app/js/views/trust.js',
  '/app/js/views/journal.js',
  '/app/js/views/storage.js',
  '/app/manifest.json',
  '/app/icons/icon-192.svg',
  '/app/icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful GET responses for offline fallback
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets: cache-first with network fallback and cache update
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return cached response immediately, but update cache in background
        fetch(event.request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response));
          }
        }).catch(() => {});
        return cached;
      }
      // Not in cache: fetch from network and cache the result
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
