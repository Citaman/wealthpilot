/* Minimal offline-first baseline (v0.15.0-r3)
 * - Pre-caches offline fallback + manifest + icons
 * - Network-first for navigation and versioned application assets
 */

const CACHE_NAME = "wealthpilot-sw-v0.15.0-r3";

const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/maskable-icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first, fallback to offline page
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (!res.ok) return res;
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("/offline.html"))
        )
    );
    return;
  }

  // Static assets only: never cache arbitrary same-origin data responses.
  if (!["style", "script", "image", "font"].includes(req.destination)) return;

  // Application assets must stay in lockstep with the HTML returned by Next.
  // A cache-first script from an older deployment can hydrate fresh HTML with
  // obsolete labels or component trees. Prefer the network, retaining the
  // cached response only as an offline fallback.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (req.method === "GET" && res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
