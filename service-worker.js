/* Weekly Time Planner PWA service worker.
   Bump CACHE_VERSION whenever a release changes app files. */
const CACHE_VERSION = "weekly-time-planner-v3.8.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/css/app.css",
  "./src/js/app.js",
  "./src/js/pwa-register.js",
  "./assets/icons/app-icon-192.png",
  "./assets/icons/app-icon-512.png",
  "./assets/icons/app-icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const requests = APP_SHELL.map((path) =>
      new Request(new URL(path, self.registration.scope), { cache: "reload" })
    );
    await cache.addAll(requests);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("weekly-time-planner-") && key !== CACHE_VERSION)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (!requestUrl.href.startsWith(self.registration.scope)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(request)) ||
          (await caches.match(new URL("./index.html", self.registration.scope)));
      }
    })());
    return;
  }

  const refreshPromise = fetch(request).then(async (response) => {
    if (response && response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE_VERSION);
      await cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  // Extend the fetch event synchronously while cached assets are returned immediately.
  event.waitUntil(refreshPromise.then(() => undefined));
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    return (await refreshPromise) || new Response("Offline: resource not cached.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  })());
});
