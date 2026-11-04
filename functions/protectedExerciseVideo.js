import { createProtectedExerciseVideoPreviewUrl, normalizeExerciseVideoPreviewTimeMs } from "./exerciseVideoPreviewAsset.js";

export const EXERCISE_VIDEO_URL_TTL_MS = 15 * 60 * 1000;
export const EXERCISE_VIDEO_PRIVATE_CACHE = "private, no-store, max-age=0";
const DEFAULT_BUCKET = "tren-85720.firebasestorage.app";

function fail(status, code, message) {
  throw Object.assign(new Error(message), { status, code });
}

function decode(value) {
  try { return decodeURIComponent(value); }
  catch { fail(400, "video-source-invalid", "Некорректный адрес видео."); }
}

function hasUnsafeCharacters(value) {
  return value.includes("\\") || [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

function safePath(path) {
  if (!path || path.length > 2048 || hasUnsafeCharacters(path) ||
    path.split("/").some(part => !part || part === "." || part === "..") || /%[\da-f]{2}/i.test(path)) {
    fail(400, "video-source-invalid", "Некорректный путь видео.");
  }
  return path;
}

export function resolveProtectedExerciseVideoSource(source, bucketName = DEFAULT_BUCKET) {
  if (typeof source !== "string" || !source.trim() || source.length > 8192 ||
    hasUnsafeCharacters(source)) {
    fail(400, "video-source-invalid", "Укажите корректный адрес видео.");
  }
  const input = source.trim();
  // Check the original spelling before URL normalizes dot segments away.
  const rawPath = input.replace(/^[a-z]+:\/\/[^/]+/i, "").split(/[?#]/)[0];
  const decodedRawPath = decode(rawPath);
  if (decodedRawPath.split("/").some(part => part === "." || part === "..")) {
    fail(400, "video-source-invalid", "Некорректный путь видео.");
  }
  let bucket, objectPath;
  if (input.startsWith("/videos/")) {
    const filename = safePath(decode(rawPath.slice("/videos/".length)));
    if (filename.includes("/")) fail(400, "video-source-invalid", "Некорректное имя видео.");
    bucket = bucketName;
    objectPath = `protected-workout-videos/public/${filename}`;
  } else {
    let url;
    try { url = new URL(input); }
    catch { fail(400, "video-source-invalid", "Некорректный адрес видео."); }
    if (url.username || url.password || url.port) fail(400, "video-source-invalid", "Некорректный адрес видео.");
    if (url.protocol === "gs:") {
      bucket = url.hostname;
      objectPath = decode(url.pathname.slice(1));
    } else if (url.protocol === "https:" && url.hostname === "firebasestorage.googleapis.com") {
      const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!match) fail(400, "video-source-invalid", "Некорректный адрес Storage.");
      bucket = decode(match[1]);
      objectPath = decode(match[2]);
    } else if (url.protocol === "https:" && url.hostname === "storage.googleapis.com") {
      const match = url.pathname.match(/^\/([^/]+)\/(.+)$/);
      if (!match) fail(400, "video-source-invalid", "Некорректный адрес Storage.");
      bucket = decode(match[1]);
      objectPath = decode(match[2]);
    } else if (url.protocol === "https:" && url.hostname === `${bucketName}.storage.googleapis.com`) {
      bucket = bucketName;
      objectPath = decode(url.pathname.slice(1));
    } else {
      fail(403, "video-source-forbidden", "Разрешены только видео из хранилища приложения.");
    }
  }
  if (bucket !== bucketName) fail(403, "video-bucket-forbidden", "Это хранилище видео недоступно.");
  safePath(objectPath);
  const allowed = /^(?:workout-videos|exercise-videos|template-exercise-videos)\/.+/.test(objectPath) ||
    /^basic-exercise-assets\/[^/]+\/videos\/[^/]+$/.test(objectPath) ||
    /^protected-workout-videos\/public\/[^/]+$/.test(objectPath);
  if (!allowed) fail(403, "video-path-forbidden", "Этот файл недоступен как видео упражнения.");
  return { bucket, objectPath };
}

export async function createProtectedExerciseVideoAccess({ storage, context, source, previewTime, posterOnly = false,
  bucketName = DEFAULT_BUCKET, now = Date.now() }) {
  const profile = context?.userData || {};
  if (!context?.uid) fail(401, "authentication-required", "Войдите в аккаунт.");
  if (!["client", "trainer", "admin"].includes(profile.role) || profile.active === false ||
    profile.archived === true || profile.accessDisabled === true ||
    profile.accountAccessStatus === "awaiting_trainer" || ["revoked", "suspended"].includes(profile.membershipStatus)) {
    fail(403, "active-membership-required", "Для просмотра видео нужен активный аккаунт.");
  }
  const { bucket, objectPath } = resolveProtectedExerciseVideoSource(source, bucketName);
  const file = storage.bucket(bucket).file(objectPath);
  let metadata;
  try { [metadata] = await file.getMetadata(); }
  catch (error) {
    if (Number(error?.code) === 404) fail(404, "video-not-found", "Видео ещё не загружено в защищённое хранилище.");
    fail(503, "video-storage-unavailable", "Не удалось проверить видео. Повторите позже.");
  }
  if (!/^video\/(?:mp4|webm|quicktime|x-m4v)$/i.test(String(metadata.contentType || ""))) {
    fail(403, "video-content-forbidden", "Файл не является поддерживаемым видео.");
  }
  const hasPermanentToken = Boolean(metadata.metadata?.firebaseStorageDownloadTokens);
  if (hasPermanentToken || metadata.cacheControl !== EXERCISE_VIDEO_PRIVATE_CACHE) {
    try {
      // A null custom-metadata value deletes the token, preserving other keys.
      // Repeated requests skip this write once the object's policy is current.
      await file.setMetadata({ cacheControl: EXERCISE_VIDEO_PRIVATE_CACHE,
        ...(hasPermanentToken ? { metadata: { firebaseStorageDownloadTokens: null } } : {}) });
    } catch {
      fail(503, "video-protection-unavailable", "Не удалось включить защищённый доступ к видео. Повторите позже.");
    }
  }
  const expires = Number(now) + EXERCISE_VIDEO_URL_TTL_MS;
  const posterUrlPromise = normalizeExerciseVideoPreviewTimeMs(previewTime) !== null
    ? createProtectedExerciseVideoPreviewUrl({ storage, bucket, objectPath, previewTime, expires }) : null;
  if (posterOnly === true) {
    // Same membership/source/content/policy checks, but never sign the MP4 just
    // to display an optional image. A missing poster does not grant video access.
    return { ok: true, posterOnly: true, expiresAt: new Date(expires).toISOString(),
      posterUrl: posterUrlPromise ? await posterUrlPromise : "" };
  }
  let url;
  try {
    [url] = await file.getSignedUrl({ version: "v4", action: "read", expires,
      responseDisposition: "inline", responseType: metadata.contentType });
  } catch {
    fail(503, "video-signing-unavailable", "Не удалось создать временную ссылку на видео. Повторите позже.");
  }
  const result = { ok: true, url, expiresAt: new Date(expires).toISOString() };
  if (posterUrlPromise) result.posterUrl = await posterUrlPromise;
  return result;
}
