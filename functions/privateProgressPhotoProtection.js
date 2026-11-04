export const PRIVATE_PROGRESS_PHOTO_CACHE = "private, no-store, max-age=0";
export const PRIVATE_PROGRESS_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPE = /^image\/(?:jpeg|png|webp|gif|avif)$/i;

function validPath(name) {
  if (typeof name !== "string" || name.length > 1024 || /[\\%]/.test(name) ||
    [...name].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return false;
  const parts = name.split("/");
  return parts.length === 4 && parts[0] === "progress-photos" &&
    parts.slice(1).every(part => part && part !== "." && part !== ".." && part.length <= 256);
}

function validImage(data) {
  const size = typeof data?.size === "string" && /^\d+$/.test(data.size) ? Number(data.size) : data?.size;
  return IMAGE_TYPE.test(String(data?.contentType || "")) && Number.isSafeInteger(size) &&
    size > 0 && size <= PRIVATE_PROGRESS_PHOTO_MAX_BYTES;
}

const skipped = reason => ({ protected: false, skipped: true, reason });
function unavailable() {
  // Never include provider errors, paths, custom metadata or token values.
  return Object.assign(new Error("Private photo protection is temporarily unavailable"), {
    code: "private-photo-protection-unavailable"
  });
}

// This helper only narrows the authority of the Storage-finalize trigger. It
// neither grants reads nor issues URLs; object ACL/IAM remain separate controls.
export async function protectPrivateProgressPhoto({ storage, event, bucketName }) {
  const data = event?.data;
  if (typeof bucketName !== "string" || !/^[a-z0-9][a-z0-9.-]{1,220}[a-z0-9]$/.test(bucketName) ||
    data?.bucket !== bucketName) return skipped("bucket-out-of-scope");
  if (!validPath(data.name)) return skipped("path-out-of-scope");
  if (!validImage(data)) return skipped("unsupported-image");
  const generation = Number.isSafeInteger(data.generation) && data.generation > 0 ? String(data.generation) : data.generation;
  // The installed Storage SDK converts generation strings to Number. Reject
  // unsafe values rather than accidentally addressing a different generation.
  if (typeof generation !== "string" || !/^[1-9]\d{0,19}$/.test(generation) ||
    !Number.isSafeInteger(Number(generation))) return skipped("invalid-generation");
  let file, metadata;
  try {
    file = storage.bucket(bucketName).file(data.name, { generation });
    [metadata] = await file.getMetadata();
  } catch (error) {
    // A delayed finalize may refer to an overwritten/deleted generation. Never
    // fall back to the current object, or retry a permanently absent version.
    if (Number(error?.code) === 404) return skipped("generation-not-found");
    throw unavailable();
  }
  if (String(metadata?.generation || "") !== generation) return skipped("generation-mismatch");
  if ((metadata.bucket && metadata.bucket !== bucketName) || (metadata.name && metadata.name !== data.name))
    return skipped("object-mismatch");
  if (!validImage(metadata)) return skipped("unsupported-image");
  const tokenPresent = Object.hasOwn(metadata.metadata || {}, "firebaseStorageDownloadTokens");
  if (!tokenPresent && metadata.cacheControl === PRIVATE_PROGRESS_PHOTO_CACHE)
    return { protected: true, changed: false };
  try {
    // Objects.patch merges custom metadata leaves. null removes only this key,
    // preserving sentinel/custom fields and avoiding a permanent bearer URL.
    await file.setMetadata({ cacheControl: PRIVATE_PROGRESS_PHOTO_CACHE,
      ...(tokenPresent ? { metadata: { firebaseStorageDownloadTokens: null } } : {}) });
  } catch (error) {
    if (Number(error?.code) === 404) return skipped("generation-not-found");
    throw unavailable();
  }
  return { protected: true, changed: true };
}
