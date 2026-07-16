export const DATA_SAFETY_MAX_BACKUPS = 25;

const QUOTA_ERROR_NAMES = new Set(["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"]);

function isQuotaExceeded(error) {
  return QUOTA_ERROR_NAMES.has(error?.name) || error?.code === 22 || error?.code === 1014;
}

function isDisposableBackupKey(key) {
  return /backup|failed_sync|pending/i.test(String(key || ""));
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
  localStorage.setItem(key, JSON.stringify(value));
}

export function safeReadJsonStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
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
      if (Array.isArray(value)) {
        const compactLimits = [12, 6, 3, 1, 0].filter((limit) => limit < value.length);
        for (const limit of compactLimits) {
          try {
            writeJsonStorage(key, value.slice(0, limit));
            return true;
          } catch {
            // Try a smaller backup snapshot before dropping unrelated backups.
          }
        }
      }

      if (removeDisposableBackups(key)) {
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
  const next = [
    {
      id: item?.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      savedAt: new Date().toISOString(),
      ...item
    },
    ...(Array.isArray(current) ? current : [])
  ].slice(0, limit);

  safeWriteJsonStorage(key, next);
  return next;
}

export function removeLocalBackup(key, backupId) {
  const current = safeReadJsonStorage(key, []);
  if (!Array.isArray(current)) return;
  safeWriteJsonStorage(key, current.filter((item) => item.id !== backupId));
}
