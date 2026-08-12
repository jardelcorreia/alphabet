// Service worker básico apenas para permitir instalação PWA (standalone)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Não faremos cache agressivo para manter a simplicidade e garantir dados sempre frescos,
  // mas respondemos ao fetch para passar na checagem de PWA.
  event.respondWith(fetch(event.request));
});
