import { onAuthStateChanged } from "firebase/auth";
import { app as defaultApp, auth as defaultAuth } from "../firebase";
import { captureAuthSession } from "./authSession.js";

export const PRIVATE_PROGRESS_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export async function normalizePrivateProgressPhotoBlob(blob) {
  if (!(blob instanceof Blob) || blob.size === 0 || blob.size > PRIVATE_PROGRESS_PHOTO_MAX_BYTES) throw new Error("private-photo-blob-invalid");
  const bytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const matches = (offset, signature) => signature.every((byte, index) => bytes[offset + index] === byte);
  const ascii = (offset, value) => matches(offset, [...value].map(char => char.charCodeAt(0)));
  let type = "";
  if (matches(0, [137, 80, 78, 71, 13, 10, 26, 10])) type = "image/png";
  else if (matches(0, [255, 216, 255])) type = "image/jpeg";
  else if (ascii(0, "GIF87a") || ascii(0, "GIF89a")) type = "image/gif";
  else if (ascii(0, "RIFF") && ascii(8, "WEBP")) type = "image/webp";
  else if (bytes.length >= 16 && ascii(4, "ftyp")) {
    const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    const brandOffsets = [8, ...[16, 20, 24, 28].filter(offset => offset + 4 <= Math.min(boxSize, bytes.length))];
    if (boxSize >= 16 && boxSize <= blob.size && boxSize % 4 === 0
      && brandOffsets.some(offset => ascii(offset, "avif") || ascii(offset, "avis"))) type = "image/avif";
  }
  if (!type || blob.type && blob.type !== type) throw new Error("private-photo-blob-invalid");
  // Firebase getBlob(ref, maxBytes) slices without a contentType argument,
  // dropping MIME even for a valid typed HTTP response. Restore only sniffed images.
  return blob.type ? blob : new Blob([blob], { type });
}

// A persisted value is an object identity, never an HTTP image source. Even
// historical token URLs are reduced to an own-bucket path before SDK access.
export function resolvePrivateProgressPhotoPath(source, expectedBucket) {
  if (typeof source !== "string" || !source || !expectedBucket) return "";
  let path;
  if (source.startsWith("gs://")) {
    const prefix = `gs://${expectedBucket}/`;
    if (!source.startsWith(prefix)) return "";
    path = source.slice(prefix.length);
  } else if (source.startsWith("progress-photos/")) {
    path = source;
  } else {
    try {
      const url = new URL(source);
      if (url.origin !== "https://firebasestorage.googleapis.com" || url.username || url.password || url.hash) return "";
      const match = /^\/v0\/b\/([^/]+)\/o\/([^/]+)$/.exec(url.pathname);
      if (!match || decodeURIComponent(match[1]) !== expectedBucket) return "";
      path = decodeURIComponent(match[2]);
    } catch { return ""; }
  }
  const parts = path.split("/");
  const unsafe = part => /[\\?#%]/.test(part) || [...part].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
  if (parts.length < 4 || parts[0] !== "progress-photos" || parts.some(part => !part || part === "." || part === ".." || unsafe(part))) return "";
  return path;
}

let storageServices;
async function loadStorageServices(app) {
  storageServices ||= import("firebase/storage");
  const sdk = await storageServices;
  return { storage: sdk.getStorage(app), ref: sdk.ref, getBlob: sdk.getBlob };
}

function waitForActive(promise, signal) {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

// getBlob has no transport-cancellation API. Abort marks the request obsolete
// immediately; an already-dispatched SDK response is discarded, never exposed.
export function startPrivateProgressPhotoLoad({
  source,
  onState,
  auth = defaultAuth,
  app = defaultApp,
  services = loadStorageServices,
  observeAuth = onAuthStateChanged,
  urlApi = URL
}) {
  const session = captureAuthSession(auth);
  const controller = new AbortController();
  let objectUrl = "";
  let unsubscribe = () => {};
  const current = () => !controller.signal.aborted && session.isCurrent();
  const clearUrl = () => {
    if (objectUrl) urlApi.revokeObjectURL(objectUrl);
    objectUrl = "";
  };
  function dispose(notify = false) {
    if (controller.signal.aborted) return;
    controller.abort();
    unsubscribe();
    clearUrl();
    if (notify) onState({ url: "", status: "idle" });
  }
  onState({ url: "", status: "loading" });
  unsubscribe = observeAuth(auth, () => {
    if (!session.isUnchanged()) dispose(true);
  });
  if (controller.signal.aborted) unsubscribe();

  const completion = (async () => {
    try {
      if (!current()) return;
      const path = resolvePrivateProgressPhotoPath(source, app?.options?.storageBucket);
      if (!path) throw new Error("private-photo-source-invalid");
      const { storage, ref, getBlob } = await waitForActive(services(app), controller.signal);
      if (!current()) return;
      const downloaded = await waitForActive(getBlob(ref(storage, path), PRIVATE_PROGRESS_PHOTO_MAX_BYTES), controller.signal);
      if (!current()) return;
      const blob = await waitForActive(normalizePrivateProgressPhotoBlob(downloaded), controller.signal);
      if (!current()) return;
      objectUrl = urlApi.createObjectURL(blob);
      if (!current()) { clearUrl(); return; }
      onState({ url: objectUrl, status: "ready", session, signal: controller.signal });
    } catch (error) {
      const accessDenied = ["storage/unauthorized", "storage/unauthenticated"].includes(error?.code);
      if (current()) onState({ url: "", status: "error", accessDenied });
    }
  })();
  return { dispose, completion, signal: controller.signal };
}
