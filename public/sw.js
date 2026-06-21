const CACHE_NAME = "workout-app-v733";
const WORKOUT_VIDEO_CACHE = "workout-videos-v2";
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => (
            (key.startsWith("workout-app-") && key !== CACHE_NAME) ||
            (key.startsWith("workout-videos-") && key !== WORKOUT_VIDEO_CACHE)
          ))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

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
        if (response.status === 200 || response.type === "opaque") {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(async () => (
          await caches.match(request) ||
          await caches.match("/index.html")
        ))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PREFETCH_WORKOUT_VIDEOS") return;

  const urls = [...new Set(
    (Array.isArray(event.data.urls) ? event.data.urls : [])
      .filter((url) => typeof url === "string" && url.trim())
  )];

  event.waitUntil(
    caches.open(WORKOUT_VIDEO_CACHE).then(async (cache) => {
      for (const url of urls) {
        const request = new Request(url, { mode: "cors", credentials: "omit" });
        if (await cache.match(request)) continue;

        try {
          const response = await fetch(request);
          if (response.status === 200 || response.type === "opaque") {
            await cache.put(request, response.clone());
          }
        } catch (error) {
          console.warn("Workout video prefetch failed:", url, error);
        }
      }
    })
  );
});
