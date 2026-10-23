// Service Worker for Hajra Medical Complex PWA
// Provides 100% offline capability on mobile & desktop

const CACHE_NAME = 'hmc-cache-v4';
const STATIC_ASSETS = [
  './',
  './index.html',
  './print-rx.html',
  './print-receipt.html',
  './css/app.css',
  './css/print.css',
  './js/app.js',
  './js/db.js',
  './js/templates-data.js',
  './assets/images-base64.js',
  './Logo.jpeg',
  './Prescription Header.png',
  './Whatsapp contact.png',
  './assets/logo.jpg',
  './assets/prescription-header.png',
  './assets/whatsapp-qr.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Some static assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Do not intercept Google Apps Script or external API requests
  if (url.origin.includes('google.com') || url.origin.includes('googleapis.com')) {
    return;
  }

  // Network-first for HTML pages with cache fallback
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match('./index.html')))
    );
    return;
  }

  // Stale-while-revalidate for local scripts and styles
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
