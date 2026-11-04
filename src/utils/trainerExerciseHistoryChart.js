export const TRAINER_EXERCISE_CHART_METRICS = [
  { key: "weight", field: "bestWeight", label: "Рабочий вес", unit: "кг" },
  { key: "e1rm", field: "e1rm", label: "Оценочный 1ПМ", unit: "кг" },
  { key: "volume", field: "volume", label: "Объём", unit: "кг·повт." },
  { key: "reps", field: "totalReps", label: "Повторы", unit: "повт." }
];

function numeric(value, allowZero = false) {
  const source = typeof value === "string" ? value.trim().replace(",", ".") : value;
  if (typeof source !== "number" && (typeof source !== "string" || !/^\d+(?:\.\d+)?$/.test(source))) return null;
  const result = Number(source);
  return Number.isFinite(result) && (allowZero ? result >= 0 : result > 0) ? result : null;
}

function timestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function conventionKey(session) {
  const convention = typeof session.weightConvention === "string" ? session.weightConvention.trim() : "";
  return `${convention || "unknown"}:${numeric(session.weightMultiplier) ?? "unknown"}`;
}

// These are already analysed sessions, not prescriptions. Keep every supplied
// record, never fill missing measurements or convert between load conventions.
export function buildTrainerExerciseHistoryChart(sessions = [], metricKey = null) {
  const source = (Array.isArray(sessions) ? sessions : []).filter(session => session && typeof session === "object" && !Array.isArray(session));
  const defaultMetric = source.some(session => session.bodyweightOnly !== true && numeric(session.bestWeight) !== null) ? "weight" : "reps";
  const metric = TRAINER_EXERCISE_CHART_METRICS.find(item => item.key === (metricKey || defaultMetric))
    || TRAINER_EXERCISE_CHART_METRICS.find(item => item.key === defaultMetric);
  const occurrences = new Map();
  const records = source.map((session, index) => {
    const time = timestamp(session.date);
    const occurrence = occurrences.get(time) || 0;
    occurrences.set(time, occurrence + 1);
    const value = metric.key !== "reps" && session.bodyweightOnly === true ? null : numeric(session[metric.field], metric.key === "reps");
    return { key: `${time ?? "undated"}:${occurrence}`, session, time, value, index, convention: conventionKey(session) };
  }).sort((a, b) => a.time === null ? b.time === null ? a.index - b.index : 1
    : b.time === null ? -1 : a.time - b.time || a.index - b.index);
  const dated = records.filter(record => record.time !== null);
  const measured = dated.filter(record => record.value !== null);
  const segments = [];
  let previous = null;
  for (const record of records) {
    if (record.time === null || record.value === null) { previous = null; continue; }
    if (!previous || previous.convention !== record.convention) segments.push([]);
    segments.at(-1).push(record);
    previous = record;
  }
  return {
    metric, defaultMetric, records, segments,
    measuredCount: measured.length,
    undatedCount: records.length - dated.length,
    firstTime: dated[0]?.time ?? null,
    lastTime: dated.at(-1)?.time ?? null,
    minimum: measured.length ? measured.reduce((value, record) => Math.min(value, record.value), Infinity) : null,
    maximum: measured.length ? measured.reduce((value, record) => Math.max(value, record.value), -Infinity) : null,
    hasConventionChanges: new Set(dated.map(record => record.convention)).size > 1
  };
}
