      const CACHE_NAME = 'add-physical-products-v2';
      const CRITICAL_RESOURCES = [
        '/',
        '/shared/auth-utils.js',
        '/public/images/logo.png',
        '/api/products?limit=12',
        '/api/categories'
      ];
      // Install event - cache critical resources
      self.addEventListener('install', event => {
        event.waitUntil(
          caches.open(CACHE_NAME)
            .then(cache => {
              console.log('Caching critical resources');
              return cache.addAll(CRITICAL_RESOURCES);
            })
            .then(() => self.skipWaiting())
        );
      });
      // Activate event - clean up old caches
      self.addEventListener('activate', event => {
        event.waitUntil(
          caches.keys().then(cacheNames => {
            return Promise.all(
              cacheNames.map(cacheName => {
                if (cacheName !== CACHE_NAME) {
                  console.log('Deleting old cache:', cacheName);
                  return caches.delete(cacheName);
                }
              })
            );
          }).then(() => self.clients.claim())
        );
      });
      // Fetch event - serve from cache with network fallback
      self.addEventListener('fetch', event => {
        if (event.request.method !== 'GET') return;
        // Cache strategy for different resource types
        if (event.request.url.includes('/api/')) {
          // Network first for API calls
          event.respondWith(
            fetch(event.request)
              .then(response => {
                if (response.ok) {
                  const responseClone = response.clone();
                  caches.open(CACHE_NAME)
                    .then(cache => cache.put(event.request, responseClone));
                }
                return response;
              })
              .catch(() => caches.match(event.request))
          );
        } else {
          // Cache first for static resources
          event.respondWith(
            caches.match(event.request)
              .then(response => {
                if (response) return response;
                return fetch(event.request).then(response => {
                  if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                  }
                  const responseToCache = response.clone();
                  caches.open(CACHE_NAME)
                    .then(cache => cache.put(event.request, responseToCache));
                  return response;
                });
              })
          );
        }
      });
    