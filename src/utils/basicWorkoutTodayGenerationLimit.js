export const BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY = 3;
export const BASIC_WORKOUT_TODAY_GENERATION_STORAGE_KEY = "basic-workout-today-generation-limit";

function normalizeDateKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return getBasicWorkoutTodayGenerationDateKey();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeUsedGenerations(record, dateKey) {
  if (!record || typeof record !== "object" || record.dateKey !== dateKey) return 0;

  const count = Number(record.count);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY, Math.floor(count)));
}

export function getBasicWorkoutTodayGenerationDateKey(date = new Date()) {
  return normalizeDateKey(date);
}

export function getBasicWorkoutTodayGenerationStorageKey(userId = "") {
  const normalizedUserId = String(userId || "").trim();
  return normalizedUserId
    ? `${BASIC_WORKOUT_TODAY_GENERATION_STORAGE_KEY}:${normalizedUserId}`
    : BASIC_WORKOUT_TODAY_GENERATION_STORAGE_KEY;
}

export function getBasicWorkoutTodayGenerationAllowance(record, date = new Date()) {
  const dateKey = normalizeDateKey(date);
  const used = normalizeUsedGenerations(record, dateKey);
  const remaining = BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY - used;

  return {
    dateKey,
    used,
    remaining,
    isLimitReached: remaining === 0
  };
}

export function consumeBasicWorkoutTodayGeneration(record, date = new Date()) {
  const allowance = getBasicWorkoutTodayGenerationAllowance(record, date);
  if (allowance.isLimitReached) {
    return {
      ...allowance,
      consumed: false,
      nextRecord: record
    };
  }

  const nextRecord = {
    dateKey: allowance.dateKey,
    count: allowance.used + 1
  };
  const nextAllowance = getBasicWorkoutTodayGenerationAllowance(nextRecord, allowance.dateKey);

  return {
    ...nextAllowance,
    consumed: true,
    nextRecord
  };
}
