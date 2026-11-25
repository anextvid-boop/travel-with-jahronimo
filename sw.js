// Travel With Jahronimo — Lightweight Offline Cache Service Worker
const CACHE_NAME = "twj-cache-v2";
const CORE_ASSETS = [
  "./",
  "index.html",
  "styles.css?v=2",
  "sound.js?v=4",
  "i18n.js?v=2",
  "map.js?v=2",
  "app.js?v=2",
  "data/stops.json",
  "assets/hero.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith(".mp3")) return;

  // Network-first for HTML & JSON so route/content updates appear immediately
  if (event.request.mode === "navigate" || url.pathname.endsWith(".json") || url.pathname.endsWith(".html")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
