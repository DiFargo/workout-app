function normalizeExerciseName(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAdjustment(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatWeight(value) {
  const rounded = Math.round(value * 10) / 10;
  return String(Number.isInteger(rounded) ? rounded : rounded.toFixed(1));
}

function exerciseUsesWeight(exercise = {}) {
  if (exercise.requiresWeight === true || exercise.usesWeight === true) return true;
  return (exercise.sets || []).some((set) => parseAdjustment(set?.weight) > 0);
}

// A correction belongs to the assigned client copy only. The source program remains unchanged.
export function applyTrainerProgramAssignmentLoadAdjustments(workouts = [], adjustments = {}) {
  const safeAdjustments = adjustments && typeof adjustments === "object" ? adjustments : {};

  return (Array.isArray(workouts) ? workouts : []).map((workout) => ({
    ...workout,
    exercises: (workout.exercises || []).map((exercise) => {
      const delta = Math.max(0, parseAdjustment(safeAdjustments[normalizeExerciseName(exercise?.name)]));
      if (!delta || !exerciseUsesWeight(exercise)) return exercise;

      return {
        ...exercise,
        sets: (exercise.sets || []).map((set) => {
          const currentWeight = parseAdjustment(set?.weight);
          if (currentWeight <= 0) return set;
          return {
            ...set,
            weight: formatWeight(Math.max(0, currentWeight + delta))
          };
        })
      };
    })
  }));
}

export function getTrainerProgramAssignmentExercises(workouts = []) {
  const exercises = new Map();

  (Array.isArray(workouts) ? workouts : []).forEach((workout) => {
    (workout.exercises || []).forEach((exercise) => {
      const key = normalizeExerciseName(exercise?.name);
      if (!key) return;

      const weights = (exercise.sets || [])
        .map((set) => parseAdjustment(set?.weight))
        .filter((weight) => weight > 0);
      const existing = exercises.get(key);
      if (existing) {
        existing.occurrences += 1;
        existing.usesWeight ||= exerciseUsesWeight(exercise);
        if (weights.length) {
          existing.plannedMinWeight = Math.min(existing.plannedMinWeight ?? Infinity, ...weights);
          existing.plannedMaxWeight = Math.max(existing.plannedMaxWeight ?? 0, ...weights);
        }
        return;
      }
      exercises.set(key, {
        key,
        name: String(exercise?.name || "Упражнение").trim(),
        sourceExercise: exercise,
        usesWeight: exerciseUsesWeight(exercise),
        plannedMinWeight: weights.length ? Math.min(...weights) : null,
        plannedMaxWeight: weights.length ? Math.max(...weights) : null,
        occurrences: 1
      });
    });
  });

  return [...exercises.values()];
}
