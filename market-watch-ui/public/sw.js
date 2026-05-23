// Simple service worker for PWA
const CACHE = "market-watch-v1";
const OFFLINE = ["/"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("/api/")) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// ── Notifications triggered via postMessage from main thread ──
self.addEventListener("message", (e) => {
  if (e.data?.type !== "SHOW_NOTIFICATION") return;
  const { title, body } = e.data;
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/favicon.svg",
      tag: "market-watch-alert",
      renotify: true,
    }),
  );
});

// ── Focus app window on notification click ────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        if (list.length > 0) return list[0].focus();
        return clients.openWindow("/watchers");
      }),
  );
});
