const NUTRIENTS = ["calories", "protein", "fat", "carbs"];
const DAY_MS = 86400000;

function localDateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? value : "";
  }
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function ordinal(key) {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function numeric(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Presentation model only; never rewrites a client's diary or goals. */
export function buildFamiliarNutritionPeriod(nutritionDays = [], {
  period = "7", customStart = "", customEnd = "", now = new Date()
} = {}) {
  const today = now instanceof Date ? new Date(now) : new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayKey = localDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday);
  const rows = new Map();
  for (const source of Array.isArray(nutritionDays) ? nutritionDays : []) {
    const dateKey = localDateKey(source?.date);
    if (!dateKey || dateKey >= todayKey) continue;
    const values = Object.fromEntries(NUTRIENTS.map(key => [key, numeric(source?.totals?.[key])]));
    // A duplicate calendar day is one day, not another denominator entry.
    // Prefer a populated diary over its empty placeholder, otherwise keep the
    // first source row (the loader already supplies its current snapshot).
    if (!rows.has(dateKey) || !(rows.get(dateKey).values.calories > 0) && values.calories > 0) {
      rows.set(dateKey, { ...source, dateKey, values });
    }
  }
  const completed = [...rows.values()].sort((first, second) => first.dateKey.localeCompare(second.dateKey));
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - (["7", "14", "30"].includes(period) ? Number(period) : 7));
  let startKey = period === "custom" ? customStart || (customEnd ? "" : completed[0]?.dateKey || "") : localDateKey(cutoff);
  let endKey = period === "custom" ? customEnd || yesterdayKey : yesterdayKey;
  let validationError = "";
  if (period === "custom") {
    if ((customStart && !localDateKey(customStart)) || (customEnd && !localDateKey(customEnd))) validationError = "Укажите корректные даты периода.";
    else if (startKey && endKey && startKey > endKey) validationError = "Дата начала должна быть не позже даты окончания.";
    else if ((startKey && startKey >= todayKey) || endKey >= todayKey) validationError = "Выберите завершённые дни: не позже вчерашнего дня.";
  }
  if (validationError) {
    startKey = "";
    endKey = "";
  }
  const chartDays = validationError ? [] : completed.filter(day => (!startKey || day.dateKey >= startKey) && day.dateKey <= endKey);
  const trackedDays = chartDays.filter(day => day.values.calories > 0);
  const averages = {};
  const recordedCounts = {};
  for (const key of NUTRIENTS) {
    const values = trackedDays.map(day => day.values[key]).filter(value => value !== null);
    recordedCounts[key] = values.length;
    averages[key] = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  }
  return {
    startKey, endKey, yesterdayKey, validationError,
    dayCount: startKey && endKey ? Math.max(0, ordinal(endKey) - ordinal(startKey) + 1) : 0,
    chartDays, trackedDays, averages, recordedCounts
  };
}
