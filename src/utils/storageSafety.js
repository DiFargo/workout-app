export const DATA_SAFETY_MAX_BACKUPS = 25;

export function safeReadJsonStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

export function safeWriteJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
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
