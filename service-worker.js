const CACHE_NAME = 'habitos-v3';
const BASE = '/Habitos/';

// Archivos estáticos a cachear al instalar
const STATIC_ASSETS = [
  BASE + 'habitos.html',
  BASE + 'manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// Dominios que NUNCA se cachean (Firebase siempre en red)
const NETWORK_ONLY = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseapp.com',
  'googleapis.com/identitytoolkit'
];

// ── INSTALL: cachear archivos estáticos ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpiar caches viejos ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estrategia híbrida ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase y autenticación: siempre red, nunca caché
  if (NETWORK_ONLY.some(domain => url.includes(domain))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Archivos estáticos propios: cache-first, red como fallback
  if (url.includes(BASE) || url.includes('fonts.googleapis') || url.includes('chart.umd')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        }).catch(() => caches.match(BASE + 'habitos.html'));
      })
    );
    return;
  }

  // Todo lo demás: red primero, cache como fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
