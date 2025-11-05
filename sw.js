const CACHE_NAME = 'haoqing-cache-v3';
const URLS_TO_CACHE = [
  '/',
  'index.html',
  'assets/tasks-audio.mp3',
  'assets/timer-audio.mp3',
  'assets/backpack-audio.mp3',
  'assets/club-audio.mp3',
  'assets/sfx_add.mp3',
  'assets/sfx_select.mp3',
  'assets/sfx_delete.mp3',
  'assets/sfx_timer_start.mp3',
  'assets/sfx_timer_pause.mp3',
  'assets/sfx_timer_stop.mp3',
  'assets/sfx_modal_open.mp3',
  'assets/sfx_modal_close.mp3',
  'assets/sfx_success.mp3',
  'assets/sfx_warn.mp3',
  'assets/sfx_click.mp3'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching app shell and assets.');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

self.addEventListener('fetch', event => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            // Do not cache firebase requests
            if (!response.url.includes('firebase')) {
                cache.put(event.request, response.clone());
            }
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        });
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
