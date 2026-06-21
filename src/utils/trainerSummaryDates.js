export function getTrainerSummaryTimestamp(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") {
    const timestamp = value.toDate().getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(String(value))
    ? `${value}T12:00:00`
    : value;
  const timestamp = new Date(normalizedValue).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getTrainerSummaryDayStart(value = Date.now()) {
  const timestamp = getTrainerSummaryTimestamp(value) || Date.now();
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getTrainerSummaryWeekStart(value = Date.now()) {
  const date = new Date(getTrainerSummaryDayStart(value));
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date.getTime();
}

export function getTrainerSummaryPeriodBounds(value = Date.now()) {
  const dayMs = 24 * 60 * 60 * 1000;
  const todayStart = getTrainerSummaryDayStart(value);

  return {
    todayStart,
    weekStart: getTrainerSummaryWeekStart(value),
    sevenDayStart: todayStart - 6 * dayMs,
    thirtyDayStart: todayStart - 29 * dayMs
  };
}

export function getTrainerSummaryDateKey(value) {
  const timestamp = getTrainerSummaryTimestamp(value);
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getTrainerSummaryDaysSince(value) {
  const timestamp = getTrainerSummaryTimestamp(value);
  if (!timestamp) return null;
  return Math.max(0, Math.floor(
    (getTrainerSummaryDayStart() - getTrainerSummaryDayStart(timestamp)) / (24 * 60 * 60 * 1000)
  ));
}

export function getTrainerAssignmentVersionKey(value) {
  const timestamp = getTrainerSummaryTimestamp(value);
  return timestamp ? String(timestamp) : String(value || "").trim();
}

export function formatTrainerSummaryDate(value) {
  const timestamp = getTrainerSummaryTimestamp(value);
  if (!timestamp) return "нет данных";
  return new Date(timestamp).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit"
  });
}
