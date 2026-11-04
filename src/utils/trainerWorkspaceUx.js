export const DEFAULT_CABINET_EVENTS = Object.freeze({ missedWorkout: true, noNutrition: true, staleMeasurements: true });

export function getTrainerUiStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function cabinetEventsStorageKey(uid) {
  return uid ? `trainer:cabinet-events:v1:${uid}` : null;
}

export function readCabinetEvents(storage, uid) {
  try {
    const key = cabinetEventsStorageKey(uid);
    const saved = key ? JSON.parse(storage?.getItem(key) || "null") : null;
    return Object.fromEntries(Object.entries(DEFAULT_CABINET_EVENTS).map(([key, value]) => [key, typeof saved?.[key] === "boolean" ? saved[key] : value]));
  } catch { return { ...DEFAULT_CABINET_EVENTS }; }
}

export function saveCabinetEvents(storage, uid, settings) {
  try {
    const key = cabinetEventsStorageKey(uid);
    if (!key || !storage) return false;
    storage.setItem(key, JSON.stringify(settings));
    return true;
  } catch { return false; }
}

export function isCabinetEventEnabled(type, settings) {
  const key = { workout: "missedWorkout", nutrition: "noNutrition", measure: "staleMeasurements" }[type];
  return !key || settings[key] !== false;
}

// Dates already in the past are historical; do not allow an irreversible draft removal.
export function toggleTrainerScheduleDate(current, dateKey, todayKey, requiredCount = 0) {
  if (dateKey < todayKey) return current;
  if (current.includes(dateKey)) return current.filter((date) => date !== dateKey);
  if (requiredCount && current.length >= requiredCount) return current;
  return [...current, dateKey].sort();
}

export function getTrainerHistoryCoverage(client = {}) {
  if (client.trainerHistoryLoadError) return "error";
  return client.trainerHistoryHasMore ? "partial" : "complete";
}
