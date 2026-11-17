/* Weekly Time Planner PWA service worker.
   Release rule: bump VERSION here AND the ?v= query on the CSS/JS links in index.html (npm-free check: node tests/check-release.js). */
const VERSION = "3.9.0";
const CACHE_VERSION = "weekly-time-planner-v" + VERSION;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./src/css/app.css?v=" + VERSION,
  "./src/js/app.js?v=" + VERSION,
  "./src/js/pwa-register.js?v=" + VERSION,
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

// Network-first: online visits always get a consistent, fresh set of files (HTML + CSS + JS from the same
// release). The cache is only the offline fallback, so a stale script can never run against a new page.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (!requestUrl.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: "no-cache" });
      if (response && response.ok && response.type === "basic") {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)));
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const shell = await caches.match(new URL("./index.html", self.registration.scope));
        if (shell) return shell;
      }
      return new Response("Offline: resource not cached.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});
