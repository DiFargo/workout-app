import { compactExistingBackupStorage, decodeBackupJson, encodeBackupJson, isCompressibleBackupKey } from "./backupStorageCodec.js";
export const DATA_SAFETY_MAX_BACKUPS = 25;

const QUOTA_ERROR_NAMES = new Set(["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"]);

function isQuotaExceeded(error) {
  return QUOTA_ERROR_NAMES.has(error?.name) || error?.code === 22 || error?.code === 1014;
}

function isDisposableBackupKey(key) {
  // Only reproducible search caches are disposable. Backups and pending
  // operations may be the only surviving copy of a user's work.
  return /^workout_(?:food_search_cache|nutrition_search_cache|barcode_cache)/i.test(String(key || ""));
}

function removeDisposableBackups(exceptKey) {
  try {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key !== exceptKey && isDisposableBackupKey(key)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
    return keys.length;
  } catch {
    return 0;
  }
}

function writeJsonStorage(key, value) {
  const raw = JSON.stringify(value);
  localStorage.setItem(key, isCompressibleBackupKey(key) ? encodeBackupJson(raw) : raw);
}

export function safeReadJsonStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return isCompressibleBackupKey(key) ? decodeBackupJson(value) : value;
  } catch {
    return fallback;
  }
}

export function safeWriteJsonStorage(key, value) {
  try {
    writeJsonStorage(key, value);
    return true;
  } catch (error) {
    if (isQuotaExceeded(error)) {
      const compacted = compactExistingBackupStorage(localStorage, String(key).split(":")[1]);
      if (removeDisposableBackups(key) || compacted) {
        try {
          writeJsonStorage(key, value);
          return true;
        } catch {
          // Fall through to the final warning below.
        }
      }
    }

    console.error(`Local backup write failed: ${key}`, error);
    return false;
  }
}

export function addLocalBackup(key, item, limit = DATA_SAFETY_MAX_BACKUPS) {
  const current = safeReadJsonStorage(key, []);
  // The plan persistence effect can run again without a content change.
  // Do not spend storage on another timestamp around an identical snapshot.
  if (isCompressibleBackupKey(key) && Array.isArray(current) && current.length &&
    item && Object.keys(item).length === 1 && Object.hasOwn(item, "plan")) {
    try { if (JSON.stringify(current[0]?.plan) === JSON.stringify(item.plan)) return current; }
    catch { /* The regular guarded write reports serialization failures. */ }
  }
  const next = [
    {
      id: item?.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      savedAt: new Date().toISOString(),
      ...item
    },
    ...(Array.isArray(current) ? current : [])
  ];
  const bounded = /pending|failed|queue/i.test(key) ? next : next.slice(0, limit);

  return safeWriteJsonStorage(key, bounded) ? bounded : null;
}

export function removeLocalBackup(key, backupId) {
  const current = safeReadJsonStorage(key, []);
  if (!Array.isArray(current)) return;
  safeWriteJsonStorage(key, current.filter((item) => item.id !== backupId));
}
