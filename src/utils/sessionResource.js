import { captureAuthSession } from "./authSession.js";

// Memory only. A same-UID re-login receives a new bucket, never the previous
// session's result. Private payloads and signed URLs are not persisted here.
const buckets = new WeakMap();
const MAX_SETTLED_RESOURCES = 80;

function getBucket(auth) {
  let bucket = buckets.get(auth);
  if (!bucket?.session.isUnchanged()) {
    bucket = { session: captureAuthSession(auth), entries: new Map() };
    buckets.set(auth, bucket);
  }
  return bucket;
}

function trimSettled(bucket) {
  if (bucket.entries.size <= MAX_SETTLED_RESOURCES) return;
  for (const [key, entry] of bucket.entries) {
    if (!entry.promise) bucket.entries.delete(key);
    if (bucket.entries.size <= MAX_SETTLED_RESOURCES) break;
  }
}

export function invalidateSessionResource(auth, keyOrPredicate = () => true) {
  const bucket = auth && buckets.get(auth);
  if (!bucket) return;
  const matches = typeof keyOrPredicate === "function"
    ? keyOrPredicate : (key) => key === keyOrPredicate;
  for (const key of bucket.entries.keys()) {
    if (matches(key)) bucket.entries.delete(key);
  }
}

/**
 * Coalesce identical in-flight reads. Callers own access checks and completeness;
 * a recent result is reused only when explicitly permitted by maxAgeMs.
 * force starts a new generation; non-cancellable older I/O may finish but cannot
 * be applied when the loader respects isCurrent().
 */
export function runSessionResource(auth, key, loader, { force = false, maxAgeMs = 0 } = {}) {
  if (!auth || typeof key !== "string" || !key || typeof loader !== "function") {
    return Promise.reject(new TypeError("A session resource requires auth, key and loader"));
  }
  const bucket = getBucket(auth);
  if (!bucket.session.isCurrent()) return Promise.resolve(null);
  const previous = bucket.entries.get(key);
  if (!force && previous?.promise) return previous.promise;
  if (!force && maxAgeMs > 0 && previous?.hasValue
    && Date.now() - previous.at < maxAgeMs) return Promise.resolve(previous.value);

  const entry = { promise: null, hasValue: false, value: undefined, at: 0 };
  bucket.entries.set(key, entry);
  const isCurrent = () => bucket.session.isCurrent()
    && buckets.get(auth) === bucket && bucket.entries.get(key) === entry;
  entry.promise = Promise.resolve()
    .then(() => isCurrent() ? loader({ session: bucket.session, isCurrent }) : null)
    .then((value) => {
      if (!isCurrent()) return null;
      entry.value = value;
      entry.hasValue = true;
      entry.at = Date.now();
      return value;
    }, (error) => {
      if (!isCurrent()) return null;
      // Keep this generation current until a retry replaces it. Its caller must
      // still be able to publish the current failure/fallback; errors themselves
      // are never cached (hasValue remains false).
      throw error;
    })
    .finally(() => {
      entry.promise = null;
      if (isCurrent()) trimSettled(bucket);
    });
  return entry.promise;
}
