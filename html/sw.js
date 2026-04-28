const CACHE_NAME = 'ohh-see-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/assets/img/oc.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      }).catch(err => console.log('SW Cache error', err))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).catch(() => {
            console.log('Fetch failed; returning offline page instead.', event.request.url);
        });
      })
  );
});