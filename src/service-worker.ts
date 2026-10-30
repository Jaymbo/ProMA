// Service Worker: minimal — App-Shell cachen, API immer vom Netz.
/// <reference lib="webworker" />

const self = globalThis as unknown as ServiceWorkerGlobalScope;

// Bei jedem Deployment die Version erhöhen, damit Clients die neue Shell laden!
const CACHE = 'proma-v2';
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
  // Navigationen (Seiten): network-first, Cache nur als Offline-Fallback
  // -> nach Deployments sehen Clients sofort die neue Version
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request).then((r) => r ?? new Response('', { status: 504 })))
    );
    return;
  }
  // Statische Assets: cache-first
  event.respondWith(caches.match(event.request).then((cached) => cached ?? fetch(event.request)));
});
