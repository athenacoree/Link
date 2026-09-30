/* =========================================================
   Service Worker de Enlace.
   Estrategia: "Network-First" para el shell de la app (HTML/CSS/JS)
   para garantizar que los usuarios siempre obtengan la última versión,
   con fallback a cache cuando no hay conexión.
   "Network-Only" para llamadas API y WebSockets.
   ========================================================= */
const CACHE_NAME = 'enlace-shell-v5';
const ARCHIVOS_SHELL = [
  '/',
  '/index.html',
  '/css/app.css',
  '/css/call.css',
  '/js/api.js',
  '/js/app.js',
  '/js/chat.js',
  '/js/call.js',
  '/js/features.js',
  '/js/i18n.js',
  '/js/linkvideo.js',
  '/js/ailab.js',
  '/js/monetization.js',
  '/js/paises.js',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca cachear la API ni WebSockets: siempre red real.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'Sin conexión.' }), { headers: { 'Content-Type': 'application/json' } }))
    );
    return;
  }

  // Estrategia Network-First con fallback a cache para HTML, CSS, JS e imágenes
  event.respondWith(
    fetch(event.request)
      .then((respuesta) => {
        if (respuesta && respuesta.status === 200 && event.request.method === 'GET') {
          const copia = respuesta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(event.request))
  );
});

// Manejo de Notificaciones Web Push y Notificaciones de Aplicación Cerrada
self.addEventListener('push', (event) => {
  let data = { title: 'Link App', body: 'Tienes una nueva notificación', url: '/' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }

  const options = {
    body: data.body || 'Tienes una nueva notificación en Link.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || 'enlace-notification',
    renotify: true,
    data: { url: data.url || '/' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Link', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
