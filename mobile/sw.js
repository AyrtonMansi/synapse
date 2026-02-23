const CACHE_NAME = 'synapse-v1';
const urlsToCache = [
  '/mobile/',
  '/mobile/index.html',
  '/mobile/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Push notifications for earnings
self.addEventListener('push', event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification('Synapse Node', {
      body: data.message,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png'
    })
  );
});
