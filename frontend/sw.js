/* =========================================================
   Service Worker de Enlace.
   Estrategia: "cache-first" para el shell de la app (HTML/CSS/JS/íconos),
   y "network-first" para todo lo que empiece con /api, porque esos datos
   deben ser siempre reales y frescos (perfiles, mensajes, feed...).
   ========================================================= */
const CACHE_NAME = 'enlace-shell-v1';
const ARCHIVOS_SHELL = [
  '/',
  '/index.html',
  '/css/app.css',
  '/css/call.css',
  '/js/api.js',
  '/js/app.js',
  '/js/chat.js',
  '/js/call.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear el API ni las conexiones de socket.io: siempre red real.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'Sin conexión.' }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cacheado) => {
      const red = fetch(event.request).then((respuesta) => {
        if (respuesta && respuesta.status === 200 && event.request.method === 'GET') {
          const copia = respuesta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        }
        return respuesta;
      }).catch(() => cacheado);
      return cacheado || red;
    })
  );
});
