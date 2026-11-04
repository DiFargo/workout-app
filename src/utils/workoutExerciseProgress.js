const WARMUP_TYPES = new Set(["warmup", "warm-up", "warm_up", "warm up", "разминка", "разминочный", "разминочный подход"]);
const METRICS = {
  weight: { kind: "weight", label: "Максимальный рабочий вес", unit: "кг" },
  duration: { kind: "duration", label: "Максимальная длительность подхода", unit: "с" },
  reps: { kind: "reps", label: "Максимум повторений", unit: "повт." }
};
const text = value => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

function numeric(value) {
  const source = text(value).replace(",", ".");
  if (!source || !/^\d+(?:\.\d+)?$/.test(source)) return null;
  const number = Number(source);
  return Number.isFinite(number) ? number : null;
}

function dateValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (!["string", "number"].includes(typeof value) && !(value instanceof Date) && typeof value?.toDate !== "function") return null;
  try {
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    return Number.isFinite(date.getTime()) ? { date: date.toISOString(), time: date.getTime() } : null;
  } catch { return null; }
}

function workingSets(sets) {
  return sets.filter(set => set && typeof set === "object" && set.completed !== false &&
    !WARMUP_TYPES.has(text(set.setType || set.type).toLocaleLowerCase("ru-RU")))
    .map(set => ({
      weight: numeric(set.enteredWeight ?? set.actualWeight ?? set.completedWeight ?? set.weight),
      reps: numeric(set.enteredReps ?? set.actualReps ?? set.completedReps ?? set.reps),
      duration: numeric(set.enteredDurationSeconds ?? set.actualDurationSeconds ?? set.durationSeconds)
    }));
}

const richness = sets => sets.reduce((total, set) => total + [set.weight, set.reps, set.duration].filter(value => value > 0).length, 0);

/** Entries already belong to one exercise. No programme/assignment filter is
 * applied: pagination completeness is supplied by the caller, never inferred.
 * Missing values remain gaps; the function makes no training-quality verdict. */
export function buildWorkoutExerciseProgress(entries = [], { complete = false } = {}) {
  const source = Array.isArray(entries) ? entries : [];
  const reservedIds = new Set(source.map(entry => text(entry?.id)).filter(Boolean));
  const byId = new Map(), withoutId = [];
  for (const [index, entry] of source.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const date = dateValue(entry.date);
    if (!date) continue;
    const id = text(entry.id), sets = Array.isArray(entry.sets) ? entry.sets : [];
    const working = workingSets(sets);
    const record = { id, ...date, index, sets, working, score: richness(working), summary: text(entry.summary) };
    if (!id) {
      let fallback = `entry-${index}`;
      while (reservedIds.has(fallback)) fallback += "-";
      reservedIds.add(fallback);
      withoutId.push({ ...record, id: fallback });
      continue;
    }
    const previous = byId.get(id);
    // Overlapping pages repeat document IDs, not events. A newer valid date
    // wins; equal dates prefer richer facts, never the largest reported weight.
    if (!previous || record.time > previous.time || (record.time === previous.time && record.score > previous.score)) byId.set(id, record);
  }
  const records = [...byId.values(), ...withoutId].sort((a, b) => a.time - b.time || a.index - b.index);
  const measurements = records.flatMap(record => record.working).filter(set => set.weight > 0 || set.duration > 0 || set.reps > 0);
  const kind = measurements.some(set => set.weight > 0) ? "weight"
    : measurements.length && measurements.every(set => set.duration > 0) ? "duration"
      : measurements.some(set => !(set.duration > 0) && set.reps > 0) ? "reps" : null;
  const points = records.map(record => {
    const values = record.working.filter(set => kind !== "reps" || !(set.duration > 0))
      .map(set => kind ? set[kind] : null).filter(value => value > 0);
    return { id: record.id, date: record.date, value: values.length ? values.reduce((maximum, value) => Math.max(maximum, value)) : null,
      sets: record.sets, summary: record.summary };
  });
  const measured = points.map(point => point.value).filter(value => value !== null);
  const first = measured[0] ?? null, latest = measured.at(-1) ?? null;
  return {
    metric: kind ? { ...METRICS[kind] } : { kind: null, label: "Нет сопоставимых данных", unit: "" },
    points, first, latest, best: measured.length ? measured.reduce((maximum, value) => Math.max(maximum, value)) : null,
    delta: measured.length >= 2 ? Math.round((latest - first) * 1000000) / 1000000 : null,
    complete: complete === true,
    scopeLabel: complete === true ? "За всё время" : "По загруженным записям"
  };
}
