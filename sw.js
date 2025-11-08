const CACHE_NAME = 'haoqing-cache-v4';
const URLS_TO_CACHE = [
  '/',
  'index.html',
  'index.js',
  'assets/sfx/nav_tasks.mp3',
  'assets/sfx/nav_timer.mp3',
  'assets/sfx/nav_backpack.mp3',
  'assets/sfx/nav_club.mp3',
  'assets/sfx/add.mp3',
  'assets/sfx/select.mp3',
  'assets/sfx/delete.mp3',
  'assets/sfx/timer_start.mp3',
  'assets/sfx/timer_pause.mp3',
  'assets/sfx/timer_stop.mp3',
  'assets/sfx/modal_open.mp3',
  'assets/sfx/modal_close.mp3',
  'assets/sfx/success.mp3',
  'assets/sfx/warn.mp3',
  'assets/sfx/click.mp3'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching app shell and assets.');
        // Use a new Request object to avoid "request has been consumed" error
        const requests = URLS_TO_CACHE.map(url => new Request(url, {cache: 'reload'}));
        return cache.addAll(requests).catch(err => {
          console.error('Failed to cache all resources:', err);
          // Even if some assets fail (e.g., 404), the core app should still be cached.
          // This makes the PWA more resilient.
        });
      })
  );
});

self.addEventListener('fetch', event => {
  // We only want to handle GET requests for http/https protocols.
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // For CloudBase API calls, always go to the network.
  if (event.request.url.includes('cloudbase')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return the cached response if it exists.
        if (cachedResponse) {
          return cachedResponse;
        }
        // If not in cache, fetch from the network.
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            // Clone the response and put it in the cache.
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return networkResponse;
          }
        );
      })
  );
});


self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});