// Namma Metro service worker.
//
// Strategy: cache-first for the app shell and the network dataset (the
// files the planner needs to work with zero connectivity), network-first
// with a cache fallback for everything else (station/route pages, so a
// second visit still works offline once cached).
//
// Bump CACHE_VERSION whenever app-shell assets change so old caches are
// dropped on activate.
const CACHE_VERSION = "v1";
const SHELL_CACHE = `namma-metro-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `namma-metro-runtime-${CACHE_VERSION}`;

const SHELL_ASSETS = ["/", "/offline", "/manifest.webmanifest", "/data/network.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isShellRequest(url) {
  return SHELL_ASSETS.some((path) => url.pathname === path);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isShellRequest(url)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline"))),
  );
});
