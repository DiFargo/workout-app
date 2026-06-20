import { exerciseUsesExternalWeight } from "./auditSafety.js";

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

export function getWorkoutOrderIndex(workoutItem = {}, fallbackIndex = 0) {
  // For monthly programs order/sortOrder is the source of truth:
  // Week 1 Day 1, Week 1 Day 2... Week 4 Day 4.
  // Do not sort by "День 1" first, otherwise all Day 1 workouts from different weeks group together.
  if (Number.isFinite(Number(workoutItem.order))) return Number(workoutItem.order);
  if (Number.isFinite(Number(workoutItem.sortOrder))) return Number(workoutItem.sortOrder);

  const idMatch = String(workoutItem.id || "").match(/week[_-]?(\d+).*day[_-]?(\d+)|w[_-]?(\d+).*d[_-]?(\d+)/i);
  const weekFromId = Number(idMatch?.[1] || idMatch?.[3]);
  const dayFromId = Number(idMatch?.[2] || idMatch?.[4]);

  if (Number.isFinite(weekFromId) && weekFromId > 0 && Number.isFinite(dayFromId) && dayFromId > 0) {
    return weekFromId * 100 + dayFromId;
  }

  const nameMatch = String(workoutItem.name || "").match(/неделя\s*(\d+).*день\s*(\d+)|день\s*(\d+)/i);
  const weekFromName = Number(nameMatch?.[1]);
  const dayFromName = Number(nameMatch?.[2] || nameMatch?.[3]);

  if (Number.isFinite(weekFromName) && weekFromName > 0 && Number.isFinite(dayFromName) && dayFromName > 0) {
    return weekFromName * 100 + dayFromName;
  }

  if (Number.isFinite(dayFromName) && dayFromName > 0) return dayFromName;

  return fallbackIndex + 1;
}

export function sortWorkoutDays(workouts = []) {
  return [...workouts].sort((a, b) => {
    const orderA = getWorkoutOrderIndex(a);
    const orderB = getWorkoutOrderIndex(b);

    if (orderA !== orderB) return orderA - orderB;

    return String(a.name || a.id || "").localeCompare(String(b.name || b.id || ""), "ru");
  });
}

export function buildClientWorkoutsFromTemplate(template = {}) {
  const structuredMicrocycles = Array.isArray(template.blocks) && template.blocks.length
    ? template.blocks
    : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);
  const structuredWorkouts = structuredMicrocycles.flatMap((microcycle) =>
    (microcycle.weeks || []).flatMap((week) => week.workouts || [])
  );
  const sourceWorkouts = structuredWorkouts.length ? structuredWorkouts : (template.workouts || []);

  return sourceWorkouts.map((workoutItem, workoutIndex) => ({
    id: workoutItem.id || `assigned_workout_${workoutIndex + 1}_${Date.now()}`,
    name: workoutItem.name || `Тренировка ${workoutIndex + 1}`,
    blockId: workoutItem.blockId || "",
    blockName: workoutItem.blockName || "",
    weekId: workoutItem.weekId || "",
    weekName: workoutItem.weekName || "",
    order: Number(workoutItem.order || workoutItem.sortOrder || workoutIndex + 1),
    sortOrder: Number(workoutItem.sortOrder || workoutItem.order || workoutIndex + 1),
    exercises: (workoutItem.exercises || []).map((exercise, exerciseIndex) => ({
      id: exercise.id || `exercise_${workoutIndex + 1}_${exerciseIndex + 1}`,
      name: exercise.name || "Упражнение",
      video: exercise.video || exercise.videoUrl || exercise.videoURL || "",
      requiresWeight: exerciseUsesExternalWeight(exercise),
      sets: Array.isArray(exercise.sets) && exercise.sets.length
        ? exercise.sets.map((set) => ({
            reps: Number(set.reps) || 8,
            weight: String(set.weight ?? "")
          }))
        : [{ reps: exercise.name?.includes("Пресс") ? 15 : 8, weight: "" }]
    }))
  }));
}
