import { onAuthStateChanged } from "firebase/auth";
import { app, auth } from "../firebase.js";
import { fetchAuthorizedWithTimeout } from "./apiClient.js";
import { normalizeExerciseVideoPosterTime } from "../../functions/exerciseVideoPoster.js";

export const VIDEO_ACCESS_REFRESH_MARGIN_MS = 30000;
const POSTER_CACHE_MAX_ENTRIES = 6;
const POSTER_CACHE_MAX_BYTES = 3 * 1024 * 1024;
const POSTER_MAX_BYTES = 512 * 1024;
const POSTER_PREFETCH_TIMEOUT_MS = 6000;

async function readPosterBlob(response, signal) {
  const type = response.headers?.get("content-type")?.split(";")[0].trim().toLowerCase();
  const length = Number(response.headers?.get("content-length"));
  if (!response.ok || type !== "image/webp" || length > POSTER_MAX_BYTES || !response.body?.getReader) {
    void response.body?.cancel?.().catch(() => {});
    return null;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) return size ? new Blob(chunks, { type: "image/webp" }) : null;
      size += value.byteLength;
      if (size > POSTER_MAX_BYTES) break;
      chunks.push(value);
    }
    void reader.cancel().catch(() => {});
    return null;
  } finally { reader.releaseLock(); }
}

export function isAppOwnedExerciseVideo(source, { bucket, origin = "http://localhost", development = false } = {}) {
  const value = String(source || "").trim();
  if (!value || /^(?:blob:|data:)/i.test(value)) return false;
  const buckets = new Set([bucket].filter(Boolean));
  if (value.startsWith("gs://")) return buckets.has(value.slice(5).split("/")[0]);
  try {
    const url = new URL(value, origin);
    if (url.origin === origin && /^\/videos\/[^/]+$/.test(url.pathname)) return !development;
    if (url.hostname === "firebasestorage.googleapis.com") return buckets.has(decodeURIComponent(url.pathname.match(/^\/v0\/b\/([^/]+)\/o\//)?.[1] || ""));
    if (url.hostname === "storage.googleapis.com") return buckets.has(decodeURIComponent(url.pathname.split("/")[1] || ""));
    return [...buckets].some((name) => url.hostname === `${name}.storage.googleapis.com`);
  } catch { return false; }
}

export function createProtectedExerciseVideoAccess({ getUser, observeAuth, request, bucket, origin, development = false, now = Date.now,
  fetchPoster = (...args) => globalThis.fetch(...args),
  createObjectURL = (blob) => URL.createObjectURL(blob), revokeObjectURL = (url) => URL.revokeObjectURL(url),
  setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout }) {
  const normalizedSource = (source) => {
    const value = String(source || "").trim();
    try {
      const url = new URL(value, origin);
      if (url.origin === origin && /^\/videos\/[^/]+$/.test(url.pathname)) return url.pathname;
    } catch { /* gs references are already canonical */ }
    return value;
  };
  let user = getUser();
  let session = 0;
  let disposed = false;
  const cache = new Map();
  const pending = new Map();
  const posterCache = new Map();
  const posterPending = new Map();
  let posterCacheBytes = 0;
  const schedule = (callback, delay) => {
    const timer = setTimer(callback, delay);
    timer?.unref?.();
    return timer;
  };
  const removePoster = (key) => {
    const cached = posterCache.get(key);
    if (!cached) return;
    posterCache.delete(key);
    posterCacheBytes -= cached.bytes;
    clearTimer(cached.timer);
    revokeObjectURL(cached.entry.url);
  };
  const abortPoster = (key) => {
    const job = posterPending.get(key);
    if (!job) return;
    posterPending.delete(key);
    job.controller.abort();
    clearTimer(job.timeout);
    clearTimer(job.expiryTimer);
  };
  const clearPosters = () => {
    for (const key of posterCache.keys()) removePoster(key);
    for (const key of posterPending.keys()) abortPoster(key);
  };
  const prunePosters = () => {
    for (const [key, value] of posterCache) if (value.entry.expiresAt <= now()) removePoster(key);
    for (const [key, value] of posterPending) if (value.expiresAt <= now()) abortPoster(key);
  };
  const posterKey = (source, previewTime) => JSON.stringify([normalizedSource(source), normalizeExerciseVideoPosterTime(previewTime)]);
  const listeners = new Set();
  const updateSession = (nextUser) => {
    if (nextUser === user) return;
    user = nextUser;
    session += 1;
    cache.clear();
    pending.clear();
    clearPosters();
    listeners.forEach((listener) => listener());
  };
  const stopAuth = observeAuth(updateSession);
  const isCurrent = (capturedSession, capturedUser) => {
    updateSession(getUser());
    return !disposed && capturedSession === session && capturedUser === user && Boolean(user);
  };
  const staleError = () => Object.assign(new Error("Сеанс изменился. Войдите снова для просмотра видео."), { code: "video/session-changed" });
  const service = {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    isProtected(source) { return isAppOwnedExerciseVideo(source, { bucket, origin, development }); },
    getSnapshot() { return session; },
    dispose() { disposed = true; stopAuth?.(); cache.clear(); pending.clear(); clearPosters(); listeners.clear(); },
    invalidate(source) {
      const value = normalizedSource(source);
      for (const key of cache.keys()) if (JSON.parse(key)[0] === value) cache.delete(key);
      for (const key of posterCache.keys()) if (JSON.parse(key)[0] === value) removePoster(key);
      for (const key of posterPending.keys()) if (JSON.parse(key)[0] === value) abortPoster(key);
    },
    getCachedPoster(source, { previewTime } = {}) {
      updateSession(getUser());
      prunePosters();
      if (disposed || !user) return null;
      const key = posterKey(source, previewTime);
      const cached = posterCache.get(key);
      if (!cached) return null;
      // Touch only in-memory recency; no React notification or disk cache.
      posterCache.delete(key);
      posterCache.set(key, cached);
      return cached.entry;
    },
    prefetchPoster(source, { previewTime } = {}) {
      const cached = service.getCachedPoster(source, { previewTime });
      if (cached) return Promise.resolve(cached);
      if (disposed || !user || !service.isProtected(source)) return Promise.resolve(null);
      const key = posterKey(source, previewTime);
      if (posterPending.has(key)) return posterPending.get(key).promise;
      while (posterPending.size >= POSTER_CACHE_MAX_ENTRIES) abortPoster(posterPending.keys().next().value);
      const capturedSession = session;
      const capturedUser = user;
      const controller = new AbortController();
      const job = { controller, promise: null, expiresAt: Infinity };
      const cancelled = new Promise((resolve) => controller.signal.addEventListener("abort", () => resolve(null), { once: true }));
      const isActive = () => !controller.signal.aborted && isCurrent(capturedSession, capturedUser) && posterPending.get(key) === job;
      posterPending.set(key, job);
      job.timeout = schedule(() => abortPoster(key), POSTER_PREFETCH_TIMEOUT_MS);
      const operation = (async () => {
        const signed = await service.resolve(source, { previewTime, posterOnly: true });
        if (!isActive() || !signed.posterUrl) return null;
        job.expiresAt = signed.expiresAt - VIDEO_ACCESS_REFRESH_MARGIN_MS;
        if (job.expiresAt <= now()) return null;
        job.expiryTimer = schedule(() => abortPoster(key), job.expiresAt - now());
        const response = await fetchPoster(signed.posterUrl, {
          mode: "cors", credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal
        });
        if (!isActive()) { void response.body?.cancel?.().catch(() => {}); return null; }
        const blob = await readPosterBlob(response, controller.signal);
        if (!blob || !isActive() || job.expiresAt <= now()) return null;
        prunePosters();
        while (posterCache.size >= POSTER_CACHE_MAX_ENTRIES || posterCacheBytes + blob.size > POSTER_CACHE_MAX_BYTES) {
          removePoster(posterCache.keys().next().value);
        }
        const entry = { url: createObjectURL(blob), expiresAt: job.expiresAt };
        const record = { entry, bytes: blob.size, timer: null };
        posterCache.set(key, record);
        posterCacheBytes += blob.size;
        record.timer = schedule(() => removePoster(key), Math.max(0, entry.expiresAt - now()));
        return entry;
      })();
      job.promise = Promise.race([operation, cancelled]).catch(() => null).finally(() => {
        clearTimer(job.timeout);
        clearTimer(job.expiryTimer);
        if (posterPending.get(key) === job) posterPending.delete(key);
      });
      return job.promise;
    },
    async resolve(source, { force = false, previewTime, posterOnly = false } = {}) {
      if (!isAppOwnedExerciseVideo(source, { bucket, origin, development })) return { url: source || "", expiresAt: null };
      const value = normalizedSource(source);
      const posterTime = normalizeExerciseVideoPosterTime(previewTime);
      const cacheKey = JSON.stringify([value, posterTime, posterOnly === true ? "poster" : "video"]);
      updateSession(getUser());
      if (!user) throw Object.assign(new Error("Войдите в аккаунт для просмотра видео."), { code: "video/auth-required" });
      const capturedSession = session;
      const capturedUser = user;
      const saved = cache.get(cacheKey);
      if (!force && saved && saved.expiresAt - VIDEO_ACCESS_REFRESH_MARGIN_MS > now()) return saved;
      if (!force && pending.has(cacheKey)) return pending.get(cacheKey);
      const operation = (async () => {
        const response = await request("/api/exercise-video-access", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: value, ...(posterTime !== null ? { previewTime: posterTime } : {}),
            ...(posterOnly === true ? { posterOnly: true } : {}) })
        }, 16000);
        if (!isCurrent(capturedSession, capturedUser)) throw staleError();
        const result = await response.json().catch(() => ({}));
        if (!isCurrent(capturedSession, capturedUser)) throw staleError();
        if (!response.ok) throw Object.assign(new Error(result.message || "Не удалось получить доступ к видео."), { code: result.error || result.code || "video/access-failed" });
        const expiresAt = Date.parse(result.expiresAt);
        let url;
        try { url = new URL(result.url); } catch { /* handled below */ }
        if ((posterOnly !== true && (!url || url.protocol !== "https:")) || !Number.isFinite(expiresAt) || expiresAt <= now() + VIDEO_ACCESS_REFRESH_MARGIN_MS) {
          throw new Error("Ссылка на видео недоступна. Повторите загрузку.");
        }
        let posterUrl;
        try {
          const candidate = new URL(result.posterUrl);
          if (candidate.protocol === "https:") posterUrl = candidate.href;
        } catch { /* Older clips have no prebuilt poster; retain the video fallback. */ }
        const entry = { ...(posterOnly === true ? { posterOnly: true } : { url: url.href }),
          expiresAt, ...(posterUrl ? { posterUrl } : {}) };
        cache.set(cacheKey, entry);
        return entry;
      })();
      pending.set(cacheKey, operation);
      try { return await operation; }
      finally { if (pending.get(cacheKey) === operation) pending.delete(cacheKey); }
    }
  };
  return service;
}

export const protectedExerciseVideoAccess = createProtectedExerciseVideoAccess({
  getUser: () => auth.currentUser,
  observeAuth: (listener) => onAuthStateChanged(auth, listener),
  request: fetchAuthorizedWithTimeout,
  bucket: app.options.storageBucket,
  origin: typeof window === "undefined" ? "http://localhost" : window.location.origin,
  development: Boolean(import.meta.env?.DEV)
});
