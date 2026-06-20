import { exerciseUsesExternalWeight } from "./auditSafety";

export function makeThreeSets(sets = [], defaultReps = 8) {
  const cleanSets = Array.isArray(sets) ? sets : [];

  const buildSet = (set) => ({
    ...set,
    reps: set?.reps || defaultReps,
    weight: set?.weight || "",
    enteredReps: set?.enteredReps || "",
    enteredWeight: set?.enteredWeight || ""
  });

  return Array.from(
    { length: Math.max(cleanSets.length, 3) },
    (_, index) => buildSet(cleanSets[index])
  );
}

export function normalizeExercise(exercise) {
  const defaultReps = exercise?.name?.includes("Пресс") ? 15 : 8;

  return {
    ...exercise,
    usesWeight: exerciseUsesExternalWeight(exercise),
    video: exercise?.video || exercise?.videoUrl || exercise?.videoURL || "",
    sets: makeThreeSets(exercise?.sets, defaultReps)
  };
}

export function normalizePlan(plan) {
  return {
    workouts: (plan.workouts || []).map((workout) => ({
      ...workout,
      exercises: (workout.exercises || []).map(normalizeExercise)
    }))
  };
}
