import { dedupeWorkoutHistory } from "../workouts/workoutHistoryDedupe.js";

const INCOMPLETE_STATUSES = new Set([
  "cancelled", "canceled", "aborted", "incomplete", "in_progress", "active",
  "planned", "scheduled", "started", "not_started", "draft"
]);
const MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

function asDate(value) {
  try {
    if (value === null || value === undefined || value === "") return null;
    const source = typeof value?.toDate === "function" ? value.toDate()
      : typeof value === "object" && !(value instanceof Date) && Number.isFinite(value.seconds)
        ? value.seconds * 1000 : value;
    const date = source instanceof Date ? new Date(source.getTime()) : new Date(source);
    return Number.isFinite(date.getTime()) ? date : null;
  } catch { return null; }
}

function localDateKey(date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getProfileAchievementHistoryTimestamp(entry) {
  // createdAt is the import/save time, not evidence of when training happened.
  for (const field of ["finishedAt", "completedAt", "date", "startedAt"]) {
    const value = entry[field];
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = asDate(`${value}T12:00:00`);
      if (date && localDateKey(date) === value) return date.getTime();
      continue;
    }
    const date = asDate(value);
    if (date && date.getFullYear() >= 1 && date.getFullYear() <= 9999) return date.getTime();
  }
  return null;
}

function historyDateKey(entry) {
  const timestamp = getProfileAchievementHistoryTimestamp(entry);
  return timestamp === null ? null : localDateKey(new Date(timestamp));
}

function shiftDateKey(key, days) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekStartKey(key) {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return shiftDateKey(key, -(day + 6) % 7);
}

function isFinishedHistory(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry) || !Object.keys(entry).length) return false;
  if (entry.completed === false || entry.isCompleted === false || entry.cancelled === true ||
    entry.canceled === true || entry.aborted === true || entry.deleted === true) return false;
  const status = String(entry.status || entry.completionStatus || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  // Legacy history documents have no status: the collection is written on finish.
  return !INCOMPLETE_STATUSES.has(status);
}

function historyWithIdentity(history) {
  return (Array.isArray(history) ? history : []).filter(isFinishedHistory).map((entry, index) => {
    const hasRun = (entry.workoutId || entry.workoutName || entry.workout) && entry.startedAt;
    // Server records have IDs. Do not silently merge unrelated imported rows
    // when a caller supplies a legacy record without either ID or run identity.
    return entry.id || entry.clientSaveId || hasRun ? entry : { ...entry, id: `achievement-legacy-${index}` };
  });
}

export function getConfirmedProfileAchievementItems(history = []) {
  return dedupeWorkoutHistory(historyWithIdentity(history).filter(entry => entry.pendingSync !== true));
}

function monthlySeries(dateKeys) {
  if (!dateKeys.length) return [];
  const counts = new Map();
  for (const key of dateKeys) counts.set(key.slice(0, 7), (counts.get(key.slice(0, 7)) || 0) + 1);
  const first = dateKeys[0].slice(0, 7), last = dateKeys.at(-1).slice(0, 7);
  const months = [];
  let key = first, total = 0;
  while (key <= last) {
    const count = counts.get(key) || 0;
    total += count;
    months.push({ key, count, total });
    const [year, month] = key.split("-").map(Number);
    key = month === 12 ? `${String(year + 1).padStart(4, "0")}-01`
      : `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}`;
  }
  return months;
}

// The caller must supply complete history for the current user. This function
// makes no network reads and never treats planned loads as strength progress.
export function buildProfileAchievements(history = [], { now = new Date() } = {}) {
  const today = localDateKey(asDate(now) || new Date());
  const records = historyWithIdentity(history);
  const confirmed = getConfirmedProfileAchievementItems(records);
  const pending = records.filter(entry => entry.pendingSync === true);
  const pendingCount = dedupeWorkoutHistory([...confirmed, ...pending]).length - confirmed.length;
  const dateKeys = confirmed.map(historyDateKey).filter(key => key && key <= today).sort();
  const weeks = new Map();
  for (const key of dateKeys) {
    const start = weekStartKey(key);
    weeks.set(start, (weeks.get(start) || 0) + 1);
  }
  const bestWeek = [...weeks].reduce((best, [start, count]) => !best || count > best.count ||
    count === best.count && start > best.start ? { start, count } : best, null);
  const recentStart = shiftDateKey(today, -29);
  const completedCount = confirmed.length;
  return {
    completedCount,
    pendingCount,
    datedCount: dateKeys.length,
    // Invalid/future dates remain in the verified total but are not plotted.
    undatedCount: completedCount - dateKeys.length,
    firstDate: dateKeys[0] || null,
    lastDate: dateKeys.at(-1) || null,
    activeWeeks: weeks.size,
    bestWeek,
    recent30Count: dateKeys.filter(key => key >= recentStart).length,
    milestone: MILESTONES.filter(value => value <= completedCount).at(-1) || 0,
    monthSeries: monthlySeries(dateKeys)
  };
}
