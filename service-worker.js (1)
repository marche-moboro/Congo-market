// ================================================================
// SERVICE WORKER — Marché Moboro
// Cache pour fonctionnement hors ligne
// ================================================================

const CACHE_NAME = 'moboro-v2';

const ASSETS_TO_CACHE = [
  '/Congo-market/',
  '/Congo-market/index.html',
  '/Congo-market/style.css',
  '/Congo-market/supabase.js',
  '/Congo-market/app.js',
  '/Congo-market/auth_upload.js',
  '/Congo-market/sellers.js',
  '/Congo-market/search.js',
  '/Congo-market/cart.js',
  '/Congo-market/products_upload.js',
  '/Congo-market/upload_photo_imagekit.js',
  '/Congo-market/admin.js',
  '/Congo-market/icon-192.png',
  '/Congo-market/icon-512.png',
  '/Congo-market/manifest.json'
];

// ✅ Installation — mise en cache + skipWaiting dans le then()
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activation — nettoyage ancien cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache first, puis réseau
self.addEventListener('fetch', event => {
  // Ne pas cacher les requêtes Supabase/ImageKit/Google Fonts
  if (event.request.url.includes('supabase.co')    ||
      event.request.url.includes('imagekit.io')    ||
      event.request.url.includes('unsplash.com')   ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('jsdelivr.net')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Ne cacher que les réponses valides
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return response;
      });
    }).catch(() => caches.match('/Congo-market/index.html'))
  );
});
