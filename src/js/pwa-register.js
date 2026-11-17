/* Register the PWA service worker on HTTPS hosts (GitHub Pages) and localhost. */
(() => {
  const secureOrigin =
    location.protocol === "https:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  if (!secureOrigin || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" })
      .then((registration) => {
        console.info("[Weekly Planner] Offline support is registered.", registration.scope);
      })
      .catch((error) => {
        console.error("[Weekly Planner] Service worker registration failed:", error);
      });
  });
})();
