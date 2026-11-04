import { createHash } from "node:crypto";
import { normalizeExerciseVideoPosterTime } from "./exerciseVideoPoster.js";

export const EXERCISE_VIDEO_PREVIEW_MAX_BYTES = 512 * 1024;
export const EXERCISE_VIDEO_PREVIEW_PRIVATE_CACHE = "private, no-store, max-age=0";

// Public request/card times are seconds; asset identity uses integer milliseconds.
export function normalizeExerciseVideoPreviewTimeMs(previewTime) {
  const seconds = normalizeExerciseVideoPosterTime(previewTime);
  return seconds === null ? null : Math.round(seconds * 1000);
}

// Callers supply the canonical source resolved by protectedExerciseVideo.js,
// never a user-supplied poster path or a temporary video URL.
export function resolveExerciseVideoPreviewAssetPath({ bucket, objectPath, previewTime }) {
  const timeMs = normalizeExerciseVideoPreviewTimeMs(previewTime);
  if (timeMs === null || typeof bucket !== "string" || !bucket ||
    typeof objectPath !== "string" || !objectPath) return null;
  const hash = createHash("sha256")
    .update(JSON.stringify(["v1", bucket, objectPath, timeMs])).digest("hex");
  return `protected-exercise-previews/v1/${hash}.webp`;
}

export async function createProtectedExerciseVideoPreviewUrl({ storage, bucket, objectPath, previewTime, expires }) {
  try {
    const path = resolveExerciseVideoPreviewAssetPath({ bucket, objectPath, previewTime });
    if (!path) return "";
    const file = storage.bucket(bucket).file(path);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (metadata.contentType !== "image/webp" ||
      metadata.cacheControl !== EXERCISE_VIDEO_PREVIEW_PRIVATE_CACHE ||
      metadata.metadata?.firebaseStorageDownloadTokens ||
      !Number.isSafeInteger(size) || size <= 0 || size > EXERCISE_VIDEO_PREVIEW_MAX_BYTES ||
      (metadata.name !== undefined && metadata.name !== path) ||
      (metadata.bucket !== undefined && metadata.bucket !== bucket)) return "";
    const [url] = await file.getSignedUrl({ version: "v4", action: "read", expires,
      responseDisposition: "inline", responseType: "image/webp" });
    return typeof url === "string" ? url : "";
  } catch {
    // A missing, stale, inaccessible or unsignable optional image must never
    // prevent the existing protected video/paused-frame fallback from opening.
    return "";
  }
}
