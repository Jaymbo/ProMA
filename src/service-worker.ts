// Service Worker: minimal — App-Shell cachen, API immer vom Netz.
/// <reference lib="webworker" />

const self = globalThis as unknown as ServiceWorkerGlobalScope;

const CACHE = 'proma-v1';
const SHELL = ['/', '/report', '/map', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // API und Uploads: immer live (frische Daten)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
