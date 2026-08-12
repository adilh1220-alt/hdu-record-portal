// MediLog Clinical Systems - Progressive Web App Service Worker
// Enables offline viewing of critical patient records & draft persistence under unstable network conditions.

const CACHE_NAME = 'medilog-clinical-v1';
const DATA_CACHE_NAME = 'medilog-patient-data-v1';
const DRAFT_CACHE_NAME = 'medilog-drafts-v1';

// Essential App Shell resources to precache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/print.css',
  '/manifest.json'
];

// 1. Installation Phase
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing MediLog Clinical Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static app shell assets...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Pre-cache partial warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activation Phase - Clean up outdated caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating MediLog Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== DATA_CACHE_NAME && cache !== DRAFT_CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event Interception Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip chrome-extension and non-GET requests
  if (event.request.method !== 'GET' || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // A. Handle API requests (Health / Cloud functions / Data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // If network succeeds, clone and cache good GET responses
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Network failed/unstable - serve cached API response if available
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            console.log(`[Service Worker] Serving cached API response for: ${url.pathname}`);
            return cachedResponse;
          }
          // Health check offline fallback
          if (url.pathname === '/api/health') {
            return new Response(JSON.stringify({ status: 'offline_cached', timestamp: new Date().toISOString() }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify({ error: 'Network unstable', offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // B. Handle Static Assets & SPA Navigation (Stale-While-Revalidate with Offline Fallback)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Return cached response if network fails
          if (cachedResponse) return cachedResponse;
          // Fallback to root index.html for SPA client navigation when offline
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Message Communication Handler with Main Application Thread
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data || {};

  if (type === 'CACHE_PATIENT_DATA') {
    // Cache snapshot of critical patient data in Service Worker Cache
    try {
      const cache = await caches.open(DATA_CACHE_NAME);
      const dataResponse = new Response(JSON.stringify(payload.data), {
        headers: { 'Content-Type': 'application/json', 'X-Updated-At': new Date().toISOString() }
      });
      await cache.put(`/api/offline-cache/${payload.key}`, dataResponse);
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, key: payload.key });
      }
    } catch (err) {
      console.error('[Service Worker] Error caching patient data:', err);
    }
  } else if (type === 'GET_CACHED_PATIENT_DATA') {
    try {
      const cache = await caches.open(DATA_CACHE_NAME);
      const response = await cache.match(`/api/offline-cache/${payload.key}`);
      if (response) {
        const data = await response.json();
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true, data });
        }
      } else {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: false, data: null });
        }
      }
    } catch (err) {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, error: err.message });
      }
    }
  } else if (type === 'CHECK_STATUS') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ status: 'active', version: CACHE_NAME });
    }
  }
});
