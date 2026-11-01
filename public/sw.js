// The Kidney Centre - Progressive Web App Service Worker v3
// Provides offline capability, asset caching, and offline screen fallback for installed mobile & desktop PWA.

const CACHE_NAME = 'kidney-centre-v3';
const DATA_CACHE_NAME = 'kidney-centre-data-v3';
const DRAFT_CACHE_NAME = 'kidney-centre-drafts-v3';

// Essential App Shell resources to precache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/icon-maskable.svg',
  '/index.css',
  '/print.css'
];

// 1. Installation Phase
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing MediLog Clinical Service Worker v3...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static app shell & offline assets...');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Pre-cache partial warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activation Phase - Clean up outdated caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating MediLog Service Worker v3...');
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

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // CRITICAL: NEVER intercept cross-origin requests.
  // All external services (Firebase Firestore, Firebase Auth, Google APIs, CDNs)
  // MUST stream directly over native network and never go through Service Worker cache.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Safeguard against any Google / Firebase URLs
  if (
    url.hostname.includes('firebase') || 
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic') ||
    url.pathname.includes('/google.firestore')
  ) {
    return;
  }

  // Skip chrome-extension
  if (url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // Bypass Vite dev-server internal endpoints only (do not block built .js or .css bundles)
  if (
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@id/') ||
    url.pathname.startsWith('/@fs/') ||
    url.search.includes('import') ||
    url.search.includes('t=')
  ) {
    return;
  }

  // A. Handle API requests (Health / Cloud functions / Data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
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

  // B. Handle SPA Navigation (HTML Pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Device is offline: Serve cached app shell or dedicated offline fallback
          const cachedIndex = (await caches.match('/index.html')) || (await caches.match('/'));
          if (cachedIndex) {
            return cachedIndex;
          }
          const cachedOffline = await caches.match('/offline.html');
          if (cachedOffline) {
            return cachedOffline;
          }
          return new Response('You are offline. Please connect to internet.', {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // C. Handle Static Assets (JS, CSS, Images, SVGs, Fonts) with Stale-While-Revalidate and safe offline fallback
  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      if (cachedResponse) {
        // Return cached version immediately, background revalidate
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      } catch (err) {
        // If offline and request is for a script or module, return index.html or empty JS fallback
        if (event.request.destination === 'script' || event.request.url.includes('.js') || event.request.url.includes('.tsx') || event.request.url.includes('.ts')) {
          const cachedIndex = await caches.match('/index.html');
          if (cachedIndex) return cachedIndex;
          return new Response('/* Offline fallback script */', { status: 200, headers: { 'Content-Type': 'application/javascript' } });
        }
        const cachedOffline = await caches.match('/offline.html');
        if (cachedOffline) return cachedOffline;
        return new Response('Offline', { status: 200 });
      }
    })
  );
});

// 4. Message Communication Handler with Main Application Thread
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data || {};

  if (type === 'CACHE_PATIENT_DATA') {
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
