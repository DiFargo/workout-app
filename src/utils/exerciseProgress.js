const STATUS_META = {
  progress: { label: "Показатели выросли", tone: "positive", priority: 3 },
  mixed: { label: "Смешанная динамика", tone: "warning", priority: 3 },
  stable: { label: "Стабильность", tone: "neutral", priority: 1 },
  adaptation: { label: "Адаптация программы", tone: "warning", priority: 2 },
  regression: { label: "Возможный регресс", tone: "negative", priority: 4 }
};

const NON_WORK_SET_TYPES = new Set(["warmup", "warm-up", "разминка", "разминочный"]);

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

function getWeightMultiplier(exercise = {}) {
  const explicit = toNumber(exercise.weightMultiplier);
  if (explicit > 0) return explicit;
  const mode = String(exercise.weightMode || exercise.loadMode || "").toLowerCase();
  return ["per_hand", "per_dumbbell", "each_dumbbell"].includes(mode) ? 2 : 1;
}

function getExerciseName(exercise = {}) {
  return String(
    exercise?.name ||
    exercise?.title ||
    exercise?.exerciseName ||
    exercise?.exercise?.name ||
    ""
  ).trim();
}

function getTrainerAlternativeExercises(exercise = {}) {
  return Array.isArray(exercise?.trainerAlternatives)
    ? exercise.trainerAlternatives.filter((item) => item && typeof item === "object")
    : [];
}

function getWorkoutExercises(workout = {}) {
  // Completed workouts created by older app versions used different field
  // names. Some transitional entries keep the prescription in `exercises`
  // and the actual completed sets in a second collection. Prefer the most
  // complete recording for each exercise instead of stopping at the first
  // non-empty array, otherwise real history is shown as empty to the trainer.
  const sources = [
    workout?.exercises,
    workout?.actualExercises,
    workout?.completedExercises,
    workout?.exerciseResults,
    workout?.results,
    workout?.workout?.exercises,
    workout?.workoutSnapshot?.exercises,
    workout?.data?.exercises
  ];
  const byIdentity = new Map();

  sources.forEach((exercises, sourceIndex) => {
    if (!Array.isArray(exercises)) return;
    exercises.forEach((exercise, exerciseIndex) => {
      if (!exercise || typeof exercise !== "object") return;
      const identity = [...getExerciseIdentityKeys(exercise)][0]
        || getExerciseProgressKey(getExerciseName(exercise))
        || `source-${sourceIndex}-exercise-${exerciseIndex}`;
      const sets = getExerciseSets(exercise);
      const score = sets.reduce((total, set) => {
        const hasActualValue = Number(set?.enteredReps ?? set?.actualReps ?? set?.completedReps ?? set?.resultReps ?? set?.enteredWeight ?? set?.actualWeight ?? set?.completedWeight ?? set?.resultWeight) > 0;
        return total + (set?.completed === true ? 4 : 0) + (hasActualValue ? 2 : 0) + 1;
      }, 0);
      const existing = byIdentity.get(identity);
      if (!existing || score > existing.score) {
        byIdentity.set(identity, { exercise, score });
      }
    });
  });

  if (byIdentity.size) {
    return [...byIdentity.values()].map(({ exercise }) => exercise);
  }
  return [];
}

function getExerciseSets(exercise = {}) {
  if (Array.isArray(exercise?.sets)) return exercise.sets;
  if (Array.isArray(exercise?.actualSets)) return exercise.actualSets;
  if (Array.isArray(exercise?.completedSets)) return exercise.completedSets;
  if (Array.isArray(exercise?.plannedSets)) return exercise.plannedSets;
  return [];
}

function getExerciseIdentityKeys(exercise = {}) {
  return new Set([
    exercise?.id,
    exercise?.exerciseId,
    exercise?.basicExerciseId,
    exercise?.basicExerciseLibraryId,
    exercise?.libraryExerciseId,
    exercise?.catalogueId,
    exercise?.sourceId,
    exercise?.sourceExerciseId,
    exercise?.originalExerciseId
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean));
}

function isWorkingSet(set = {}) {
  const type = String(set.setType || set.type || "work").trim().toLowerCase();
  return !NON_WORK_SET_TYPES.has(type) && set.excludeFromVolume !== true;
}

function buildSession(workout, exercise, date, plannedExercise = null) {
  const weightMultiplier = getWeightMultiplier(exercise);
  const sourceSets = getExerciseSets(exercise);
  const sets = sourceSets
    .map((set, index) => ({
      index,
      reps: toNumber(set.enteredReps ?? set.actualReps ?? set.completedReps ?? set.resultReps ?? set.reps),
      weight: toNumber(set.enteredWeight ?? set.actualWeight ?? set.completedWeight ?? set.resultWeight ?? set.weight ?? set.aiSuggestedWeight),
      rpe: toNumber(set.enteredRpe ?? set.actualRpe ?? set.rpe),
      rir: toNumber(set.enteredRir ?? set.actualRir ?? set.rir),
      completed: set.completed !== false,
      working: isWorkingSet(set),
      note: String(set.enteredNote ?? set.actualNote ?? set.note ?? "").trim(),
      setType: String(set.setType || set.type || "work")
    }))
    .filter((set) => set.completed && set.working && set.reps > 0);
  if (!sets.length) return null;

  const weightedSets = sets.filter((set) => set.weight > 0);
  const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);
  const volume = weightedSets.reduce((sum, set) => sum + set.weight * weightMultiplier * set.reps, 0);
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
    targetRange: getTargetRange(exercise, sourceSets),
    sets: sets.length,
    actualSets: sets.map((set) => ({ ...set, volume: round(set.weight * weightMultiplier * set.reps) })),
    plannedSets: (plannedExercise?.sets || []).map((set, index) => ({
      index,
      reps: set.targetReps ?? set.reps ?? "",
      weight: set.targetWeight ?? set.weight ?? "",
      rpe: set.rpe ?? "",
      rir: set.rir ?? "",
      setType: set.setType || set.type || "work"
    })),
    totalReps: round(totalReps),
    averageReps: round(totalReps / sets.length),
    bestWeight: round(Math.max(0, ...weightedSets.map((set) => set.weight))),
    volume: round(volume),
    e1rm: round(e1rm),
    bodyweightOnly: !weightedSets.length,
    weightMultiplier,
    weightConvention: weightMultiplier === 2 ? "per_hand" : "total_external_load",
    weightConventionLabel: weightMultiplier === 2 ? "Вес указан на одну руку/гантель" : "Вес указан как общий внешний вес",
    e1rmFormula: "Формула Эпли: вес × (1 + повторения / 30), по лучшему рабочему подходу",
    e1rmLowConfidence: weightedSets.some((set) => set.reps > 12),
    clientComment: String(exercise.clientNote || workout.clientComment || "").trim(),
    painReported: Boolean(exercise.painReported || workout.painReported || /бол|травм/i.test(String(exercise.clientNote || workout.clientComment || ""))),
    loadChangedByClient: (plannedExercise?.sets || []).some((plannedSet, index) => {
      const actualSet = sets.find((set) => set.index === index);
      return actualSet && toNumber(plannedSet.weight) > 0 && actualSet.weight !== toNumber(plannedSet.weight);
    })
  };
}

function getExerciseProgressKey(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/[ёЁ]/g, "е")
    .replace(/[«»'`".,:;!?()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ru-RU");
}

function exercisesMatch(targetExercise, historyExercise) {
  const targetVariants = [targetExercise, ...getTrainerAlternativeExercises(targetExercise)];
  const historyVariants = [historyExercise, ...getTrainerAlternativeExercises(historyExercise)];

  const targetNames = new Set(targetVariants
    .map((exercise) => getExerciseProgressKey(getExerciseName(exercise)))
    .filter(Boolean));
  const historyNames = historyVariants
    .map((exercise) => getExerciseProgressKey(getExerciseName(exercise)))
    .filter(Boolean);
  if (historyNames.some((name) => targetNames.has(name))) return true;

  const targetIdentityKeys = new Set(targetVariants.flatMap((exercise) => [
    ...getExerciseIdentityKeys(exercise)
  ]));
  return historyVariants.some((exercise) => (
    [...getExerciseIdentityKeys(exercise)].some((key) => targetIdentityKeys.has(key))
  ));
}

function buildActualSessionComparison(previous, current) {
  const hasEnoughHistory = Boolean(previous && current);
  const hasComparableLoad = hasEnoughHistory
    && previous.volume > 0
    && current.volume > 0
    && previous.bestWeight > 0
    && current.bestWeight > 0;

  return {
    available: hasEnoughHistory,
    volumeDelta: hasComparableLoad ? round(current.volume - previous.volume) : null,
    volumePercent: hasComparableLoad ? percentChange(previous.volume, current.volume) : null,
    weightDelta: hasComparableLoad ? round(current.bestWeight - previous.bestWeight) : null,
    repsDelta: hasEnoughHistory ? round(current.totalReps - previous.totalReps) : null,
    setsDelta: hasEnoughHistory ? current.sets - previous.sets : null
  };
}

/**
 * Returns only facts recorded in completed working sets for one exercise.
 *
 * Unlike analyzeExerciseProgress, this intentionally includes zero and one
 * completed instances so editor UIs can render an honest empty-history state.
 * The returned sessions are ordered from oldest to newest; dates remain Date
 * objects for callers that need locale-specific formatting.
 */
export function getExerciseActualProgress(history = [], exerciseName = "") {
  const targetExercise = typeof exerciseName === "object" ? exerciseName : { name: exerciseName };
  const requestedName = getExerciseName(targetExercise);
  const key = getExerciseProgressKey(requestedName);
  const sessions = [];
  let matchedHistoryCount = 0;
  let discardedSessionCount = 0;

  if (key || getExerciseIdentityKeys(targetExercise).size) {
    (Array.isArray(history) ? history : [])
      .map((workout) => ({
        workout,
        date: toDate(workout?.date || workout?.completedAt || workout?.finishedAt || workout?.createdAt)
      }))
      .filter((item) => item.date)
      .sort((a, b) => a.date - b.date)
      .forEach(({ workout, date }) => {
        getWorkoutExercises(workout).forEach((exercise) => {
          if (!exercisesMatch(targetExercise, exercise)) return;
          matchedHistoryCount += 1;

          const plannedExercise = (workout?.plannedSnapshot?.exercises || []).find((planned) => (
            exercisesMatch(exercise, planned)
          ));
          const session = buildSession(workout, exercise, date, plannedExercise);
          if (session) sessions.push(session);
          else discardedSessionCount += 1;
        });
      });
  }

  const lastSession = sessions.at(-1) || null;
  const previousSession = sessions.length >= 2 ? sessions.at(-2) : null;

  return {
    name: requestedName,
    key,
    sessions,
    sessionCount: sessions.length,
    matchedHistoryCount,
    discardedSessionCount,
    lastSession,
    previousSession,
    comparison: buildActualSessionComparison(previousSession, lastSession)
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
  const mixedDynamics = weighted && (
    (changes.volumePct > 0 && changes.e1rmPct < 0) ||
    (changes.reps > 0 && changes.weight < 0)
  );
  const clearProgress = weighted
    ? changes.e1rmPct >= 2.5 || (changes.volumePct >= 7 && changes.e1rmPct > -5)
    : changes.repsPct >= 7 || changes.sets > 0;
  const clearRegression = weighted
    ? changes.e1rmPct <= -5 && changes.volumePct <= -8
    : changes.repsPct <= -12 && changes.sets <= 0;

  let status = "stable";
  if (adapted) status = "adaptation";
  else if (mixedDynamics) status = "mixed";
  else if (clearProgress) status = "progress";
  else if (clearRegression) status = "regression";

  let explanation;
  if (status === "mixed") {
    explanation = `Силовая выносливость изменилась: повторения ${changes.reps >= 0 ? "+" : ""}${changes.reps}, объём ${changes.volumePct >= 0 ? "+" : ""}${changes.volumePct}%, рабочий вес ${changes.weight >= 0 ? "+" : ""}${changes.weight} кг, оценочный 1ПМ ${changes.e1rmPct >= 0 ? "+" : ""}${changes.e1rmPct}%. Повышать вес автоматически не следует.`;
  } else if (status === "progress") {
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
        const plannedExercises = workout.plannedSnapshot?.exercises || [];
        const plannedExercise = plannedExercises.find((planned) => (
          (exercise.id && planned.id === exercise.id) ||
          String(planned.name || "").trim().toLocaleLowerCase("ru-RU") === name.toLocaleLowerCase("ru-RU")
        ));
        const session = buildSession(workout, exercise, date, plannedExercise);
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
