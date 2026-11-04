const CACHE_NAME = "workout-app-v__APP_VERSION__";
const RUNTIME_CACHE = "workout-runtime-v__APP_VERSION__";
const NUTRITION_CATALOG_CACHE = "workout-nutrition-catalog-v__APP_VERSION__";
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

// Entry limits and a maximum response size keep offline support from growing
// indefinitely on a mobile device. Large files still work online; they simply
// are not retained by the service worker.
const RUNTIME_CACHE_MAX_ENTRIES = 32;
const NUTRITION_CATALOG_CACHE_MAX_ENTRIES = 8;
const MAX_CACHEABLE_RUNTIME_BYTES = 2 * 1024 * 1024;
const MAX_CACHEABLE_NUTRITION_BYTES = 4 * 1024 * 1024;
const MANAGED_CACHE_PREFIXES = [
  "workout-app-",
  "workout-videos-",
  "workout-runtime-",
  "workout-nutrition-catalog-"
];

function responseHasSafeContentLength(response, maximumBytes) {
  const contentLength = response?.headers?.get("content-length");
  const bytes = Number(contentLength);
  return Boolean(contentLength) && Number.isFinite(bytes) && bytes > 0 && bytes <= maximumBytes;
}

function canCacheRuntimeResponse(response, maximumBytes) {
  return response?.status === 200
    && response.type === "basic"
    && responseHasSafeContentLength(response, maximumBytes);
}

async function enforceCacheEntryLimit(cacheName, maximumEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = Math.max(0, keys.length - maximumEntries);
  if (!excess) return;

  await Promise.all(keys.slice(0, excess).map((request) => cache.delete(request)));
}

async function cacheResponse(cacheName, request, response, maximumEntries) {
  const cacheableResponse = response.clone();
  const cache = await caches.open(cacheName);
  await cache.put(request, cacheableResponse);
  await enforceCacheEntryLimit(cacheName, maximumEntries);
}

function cacheInBackground(event, cacheName, request, response, maximumEntries) {
  event.waitUntil(
    cacheResponse(cacheName, request, response, maximumEntries)
      .catch((error) => console.warn("Service worker cache write failed:", error))
  );
}

function isManagedCache(key) {
  return MANAGED_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function getRuntimeCacheConfig(url) {
  if (url.pathname.startsWith("/nutrition-catalog/")) {
    return {
      name: NUTRITION_CATALOG_CACHE,
      maximumEntries: NUTRITION_CATALOG_CACHE_MAX_ENTRIES,
      maximumBytes: MAX_CACHEABLE_NUTRITION_BYTES
    };
  }

  return {
    name: RUNTIME_CACHE,
    maximumEntries: RUNTIME_CACHE_MAX_ENTRIES,
    maximumBytes: MAX_CACHEABLE_RUNTIME_BYTES
  };
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => isManagedCache(key) && ![
            CACHE_NAME,
            RUNTIME_CACHE,
            NUTRITION_CATALOG_CACHE
          ].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Protected exercise media must not survive logout/URL expiry in CacheStorage.
  // Also bypass same-origin legacy paths even when fetched via JS/prefetch.
  if (request.destination === "video" || url.pathname.startsWith("/videos/") ||
      url.searchParams.has("X-Goog-Signature")) {
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname === "/sw.js") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (canCacheRuntimeResponse(response, MAX_CACHEABLE_RUNTIME_BYTES)) {
            cacheInBackground(event, CACHE_NAME, "/index.html", response, APP_SHELL.length);
          }
          return response;
        })
        .catch(async () => (
          await caches.match(request) ||
          await caches.match("/index.html")
        ))
    );
    return;
  }

  const cacheConfig = getRuntimeCacheConfig(url);
  event.respondWith(
    caches.open(cacheConfig.name).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (canCacheRuntimeResponse(response, cacheConfig.maximumBytes)) {
        cacheInBackground(event, cacheConfig.name, request, response, cacheConfig.maximumEntries);
      }
      return response;
    })
  );
});
