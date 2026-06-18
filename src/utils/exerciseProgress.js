const STATUS_META = {
  progress: { label: "Прогресс", tone: "positive", priority: 3 },
  stable: { label: "Стабильность", tone: "neutral", priority: 1 },
  adaptation: { label: "Адаптация программы", tone: "warning", priority: 2 },
  regression: { label: "Возможный регресс", tone: "negative", priority: 4 }
};

function toNumber(value) {
  const number = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function round(value, precision = 1) {
  const factor = 10 ** precision;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function percentChange(previous, current) {
  if (!previous) return current > 0 ? 100 : 0;
  return round((current - previous) / previous * 100);
}

function parseRepRange(value) {
  if (Array.isArray(value) && value.length) {
    const numbers = value.map(toNumber).filter((number) => number > 0);
    if (numbers.length) return { min: Math.min(...numbers), max: Math.max(...numbers) };
  }

  if (value && typeof value === "object") {
    const min = toNumber(value.min ?? value.from ?? value.start);
    const max = toNumber(value.max ?? value.to ?? value.end);
    if (min || max) return { min: min || max, max: max || min };
  }

  const numbers = String(value ?? "").match(/\d+(?:[.,]\d+)?/g)?.map(toNumber).filter(Boolean) || [];
  if (!numbers.length) return null;
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

function getTargetRange(exercise, sets) {
  const direct = parseRepRange(
    exercise.targetReps
      ?? exercise.repRange
      ?? exercise.repsRange
      ?? (exercise.minReps || exercise.maxReps
        ? { min: exercise.minReps, max: exercise.maxReps }
        : null)
  );
  if (direct) return direct;

  const ranges = sets
    .map((set) => parseRepRange(set.targetReps ?? set.repRange ?? set.plannedReps))
    .filter(Boolean);
  if (!ranges.length) return null;
  return {
    min: Math.min(...ranges.map((range) => range.min)),
    max: Math.max(...ranges.map((range) => range.max))
  };
}

function rangesDiffer(previous, current) {
  if (!previous || !current) return false;
  const overlap = Math.min(previous.max, current.max) - Math.max(previous.min, current.min);
  const previousMidpoint = (previous.min + previous.max) / 2;
  const currentMidpoint = (current.min + current.max) / 2;
  return overlap < 0 || Math.abs(previousMidpoint - currentMidpoint) >= 2;
}

function formatRange(range) {
  if (!range) return "";
  return range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`;
}

function buildSession(workout, exercise, date) {
  const sets = (exercise.sets || [])
    .map((set) => ({
      reps: toNumber(set.reps ?? set.enteredReps),
      weight: toNumber(set.weight ?? set.enteredWeight ?? set.aiSuggestedWeight),
      completed: set.completed !== false
    }))
    .filter((set) => set.completed && set.reps > 0);
  if (!sets.length) return null;

  const weightedSets = sets.filter((set) => set.weight > 0);
  const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);
  const volume = weightedSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const e1rm = weightedSets.reduce(
    (best, set) => Math.max(best, set.weight * (1 + set.reps / 30)),
    0
  );

  return {
    date,
    programId: String(
      exercise.assignedProgramId
      || workout.assignedProgramId
      || workout.programId
      || ""
    ),
    programName: String(
      exercise.assignedProgramName
      || workout.assignedProgramName
      || workout.programName
      || ""
    ),
    targetRange: getTargetRange(exercise, exercise.sets || []),
    sets: sets.length,
    totalReps: round(totalReps),
    averageReps: round(totalReps / sets.length),
    bestWeight: round(Math.max(0, ...weightedSets.map((set) => set.weight))),
    volume: round(volume),
    e1rm: round(e1rm),
    bodyweightOnly: !weightedSets.length
  };
}

function classify(previous, current) {
  const changes = {
    weight: round(current.bestWeight - previous.bestWeight),
    weightPct: percentChange(previous.bestWeight, current.bestWeight),
    reps: round(current.totalReps - previous.totalReps),
    repsPct: percentChange(previous.totalReps, current.totalReps),
    sets: current.sets - previous.sets,
    volume: round(current.volume - previous.volume),
    volumePct: percentChange(previous.volume, current.volume),
    e1rm: round(current.e1rm - previous.e1rm),
    e1rmPct: percentChange(previous.e1rm, current.e1rm)
  };
  const programChanged = Boolean(
    previous.programId
    && current.programId
    && previous.programId !== current.programId
  );
  const rangeChanged = rangesDiffer(previous.targetRange, current.targetRange);
  const adapted = programChanged || rangeChanged;
  const weighted = previous.e1rm > 0 && current.e1rm > 0;
  const clearProgress = weighted
    ? changes.e1rmPct >= 2.5 || (changes.volumePct >= 7 && changes.e1rmPct > -5)
    : changes.repsPct >= 7 || changes.sets > 0;
  const clearRegression = weighted
    ? changes.e1rmPct <= -5 && changes.volumePct <= -8
    : changes.repsPct <= -12 && changes.sets <= 0;

  let status = "stable";
  if (clearProgress) status = "progress";
  else if (adapted) status = "adaptation";
  else if (clearRegression) status = "regression";

  let explanation;
  if (status === "progress") {
    if (changes.weight > 0 && changes.reps >= 0) {
      explanation = `Рабочий вес вырос на ${changes.weight} кг без снижения общего числа повторений.`;
    } else if (changes.e1rmPct >= 2.5) {
      explanation = `Расчётная сила выросла на ${Math.abs(changes.e1rmPct)}%, объём ${changes.volumePct >= 0 ? "не снизился критично" : "изменился умеренно"}.`;
    } else {
      explanation = `Тренировочный объём вырос на ${Math.abs(changes.volumePct)}%.`;
    }
  } else if (status === "adaptation") {
    const reasons = [];
    if (rangeChanged) {
      reasons.push(`диапазон повторений изменён с ${formatRange(previous.targetRange)} на ${formatRange(current.targetRange)}`);
    }
    if (programChanged) reasons.push("назначена другая программа");
    explanation = `Показатели не считаются регрессом: ${reasons.join(", ")}. Нужна ещё одна сопоставимая тренировка.`;
  } else if (status === "regression") {
    explanation = `Снизились и расчётная сила (${Math.abs(changes.e1rmPct)}%), и тренировочный объём (${Math.abs(changes.volumePct)}%) без изменения программы.`;
  } else {
    explanation = weighted
      ? `Изменения находятся в рабочем диапазоне: e1RM ${changes.e1rmPct >= 0 ? "+" : ""}${changes.e1rmPct}%, объём ${changes.volumePct >= 0 ? "+" : ""}${changes.volumePct}%.`
      : `Общее число повторений изменилось на ${changes.reps >= 0 ? "+" : ""}${changes.reps}; выраженной динамики пока нет.`;
  }

  return {
    status,
    ...STATUS_META[status],
    changes,
    comparable: !adapted,
    explanation
  };
}

export function analyzeExerciseProgress(history = []) {
  const exercises = new Map();

  history
    .map((workout) => ({
      workout,
      date: toDate(workout.date || workout.completedAt || workout.finishedAt || workout.createdAt)
    }))
    .filter((item) => item.date)
    .sort((a, b) => a.date - b.date)
    .forEach(({ workout, date }) => {
      (workout.exercises || []).forEach((exercise) => {
        const name = String(exercise.name || "").trim();
        if (!name) return;
        const session = buildSession(workout, exercise, date);
        if (!session) return;
        const key = name.toLocaleLowerCase("ru-RU");
        const item = exercises.get(key) || { name, sessions: [] };
        item.sessions.push(session);
        exercises.set(key, item);
      });
    });

  return [...exercises.values()]
    .filter((exercise) => exercise.sessions.length >= 2)
    .map((exercise) => {
      const current = exercise.sessions.at(-1);
      const previous = exercise.sessions.at(-2);
      return {
        name: exercise.name,
        previous,
        current,
        sessions: exercise.sessions,
        ...classify(previous, current)
      };
    })
    .sort((a, b) => (
      STATUS_META[b.status].priority - STATUS_META[a.status].priority
      || b.current.date - a.current.date
    ));
}
