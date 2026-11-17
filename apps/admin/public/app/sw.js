/* Ahariva student PWA — /app scope (localhost + shared host) */
const CACHE = "ahariva-student-v2";
const OFFLINE = ["/app", "/app/login"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(OFFLINE).catch(() => undefined))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.pathname.startsWith("/api")) return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((r) => r || caches.match("/app"))
    )
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Ahariva", body: "You have an update", data: {} };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Ahariva", {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: payload.data || {},
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate("/app");
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow("/app");
    })
  );
});
