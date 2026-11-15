/* Student PWA — scoped to /app */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open("pratham-student-v1").then((c) => c.addAll(["/app"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
  let payload = { title: "Pratham Tiffin", body: "You have an update", data: {} };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Pratham Tiffin", {
      body: payload.body || "",
      icon: "/icons/192",
      badge: "/icons/192",
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
