const CACHE_NAME = "workout-app-v__APP_VERSION__";
const WORKOUT_VIDEO_CACHE = "workout-videos-v__APP_VERSION__";
const RUNTIME_CACHE = "workout-runtime-v__APP_VERSION__";
const NUTRITION_CATALOG_CACHE = "workout-nutrition-catalog-v__APP_VERSION__";
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

// Entry limits and a maximum response size keep offline support from growing
// indefinitely on a mobile device. Large files still work online; they simply
// are not retained by the service worker.
const RUNTIME_CACHE_MAX_ENTRIES = 32;
const NUTRITION_CATALOG_CACHE_MAX_ENTRIES = 8;
const WORKOUT_VIDEO_CACHE_MAX_ENTRIES = 4;
const MAX_CACHEABLE_RUNTIME_BYTES = 2 * 1024 * 1024;
const MAX_CACHEABLE_NUTRITION_BYTES = 4 * 1024 * 1024;
const MAX_CACHEABLE_VIDEO_BYTES = 20 * 1024 * 1024;
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

function canCacheVideoResponse(response) {
  return response?.status === 200
    && response.type !== "opaque"
    && responseHasSafeContentLength(response, MAX_CACHEABLE_VIDEO_BYTES);
}

async function enforceCacheEntryLimit(cacheName, maximumEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = Math.max(0, keys.length - maximumEntries);
  if (!excess) return;

  await Promise.all(keys.slice(0, excess).map((request) => cache.delete(request)));
}

async function cacheResponse(cacheName, request, response, maximumEntries) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  await enforceCacheEntryLimit(cacheName, maximumEntries);
}

function cacheInBackground(event, cacheName, request, response, maximumEntries) {
  event.waitUntil(
    cacheResponse(cacheName, request, response, maximumEntries)
      .catch((error) => console.warn("Service worker cache write failed:", error))
  );
}

async function createCachedVideoRangeResponse(response, rangeHeader) {
  if (!response || response.status !== 200 || response.type === "opaque") {
    return response;
  }

  const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader || "");
  if (!match) return response;

  const buffer = await response.arrayBuffer();
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : buffer.byteLength - 1;
  const end = Math.min(requestedEnd, buffer.byteLength - 1);
  if (!Number.isFinite(start) || start < 0 || start > end) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${buffer.byteLength}` }
    });
  }

  const headers = new Headers(response.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(end - start + 1));
  headers.set("Content-Range", `bytes ${start}-${end}/${buffer.byteLength}`);

  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    statusText: "Partial Content",
    headers
  });
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
            WORKOUT_VIDEO_CACHE,
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

  if (request.destination === "video") {
    event.respondWith(
      caches.open(WORKOUT_VIDEO_CACHE).then(async (cache) => {
        const rangeHeader = request.headers.get("range");
        if (rangeHeader) {
          try {
            return await fetch(request);
          } catch (error) {
            const cachedFullVideo = await cache.match(request.url, { ignoreVary: true });
            if (!cachedFullVideo) throw error;
            return createCachedVideoRangeResponse(cachedFullVideo, rangeHeader);
          }
        }

        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (canCacheVideoResponse(response)) {
          cacheInBackground(event, WORKOUT_VIDEO_CACHE, request, response, WORKOUT_VIDEO_CACHE_MAX_ENTRIES);
        }
        return response;
      })
    );
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

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PREFETCH_WORKOUT_VIDEOS") return;

  const urls = [...new Set(
    (Array.isArray(event.data.urls) ? event.data.urls : [])
      .filter((url) => typeof url === "string" && url.trim())
  )].slice(0, WORKOUT_VIDEO_CACHE_MAX_ENTRIES);

  event.waitUntil(
    caches.open(WORKOUT_VIDEO_CACHE).then(async (cache) => {
      for (const url of urls) {
        const request = new Request(url, { mode: "cors", credentials: "omit" });
        if (await cache.match(request)) continue;

        try {
          const response = await fetch(request);
          if (canCacheVideoResponse(response)) {
            await cacheResponse(WORKOUT_VIDEO_CACHE, request, response, WORKOUT_VIDEO_CACHE_MAX_ENTRIES);
          }
        } catch (error) {
          console.warn("Workout video prefetch failed:", url, error);
        }
      }
    })
  );
});
