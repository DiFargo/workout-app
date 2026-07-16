export async function saveTrainerNextPlanWithDeps({
  plan,
  nextWorkouts,
  options = {},
  saveWorkoutsToFirebase,
  setPlan
}) {
  const nextPlan = {
    ...(plan || {}),
    workouts: nextWorkouts
  };

  setPlan(nextPlan);
  await saveWorkoutsToFirebase(nextPlan, { silent: true, ...options });
}

function normalizeProgressionExerciseName(name = "") {
  return String(name)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function parseProgressionWeight(value) {
  const number = Number(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(number) && number > 0 ? number : null;
}

function getCompletedSetWeight(set = {}) {
  if (!set.completed) return null;

  return parseProgressionWeight(
    set.enteredWeight !== undefined && String(set.enteredWeight).trim() !== ""
      ? set.enteredWeight
      : set.weight
  );
}

function buildWorkoutProgressionMap(workout = {}) {
  const weightsByExercise = new Map();

  (workout.exercises || []).forEach((exercise) => {
    const exerciseKey = normalizeProgressionExerciseName(exercise.name);
    if (!exerciseKey) return;

    (exercise.sets || []).forEach((set, setIndex) => {
      const weight = getCompletedSetWeight(set);
      if (weight === null) return;

      const key = `${exerciseKey}:${setIndex}`;
      weightsByExercise.set(key, String(weight));
    });
  });

  return weightsByExercise;
}

export function applyWorkoutProgressionToFuturePlan(plan = {}, completedWorkout = {}, options = {}) {
  const workouts = Array.isArray(plan.workouts) ? plan.workouts : [];
  const completedWorkoutIndex = workouts.findIndex((workout) => workout.id === completedWorkout.id);
  const progressionWeights = buildWorkoutProgressionMap(completedWorkout);

  if (completedWorkoutIndex < 0 || progressionWeights.size === 0) {
    return { plan, changed: false };
  }

  let changed = false;
  const updatedAt = options.updatedAt || new Date().toISOString();
  const nextWorkouts = workouts.map((workout, workoutIndex) => {
    if (workoutIndex <= completedWorkoutIndex) return workout;

    let workoutChanged = false;
    const nextExercises = (workout.exercises || []).map((exercise) => {
      const exerciseKey = normalizeProgressionExerciseName(exercise.name);
      if (!exerciseKey || !Array.isArray(exercise.sets)) return exercise;

      let exerciseChanged = false;
      const nextSets = exercise.sets.map((set, setIndex) => {
        const nextWeight = progressionWeights.get(`${exerciseKey}:${setIndex}`);
        if (!nextWeight || String(set.weight ?? "") === nextWeight) return set;

        exerciseChanged = true;
        return {
          ...set,
          weight: nextWeight,
          progressionSourceWorkoutId: completedWorkout.id || "",
          progressionUpdatedAt: updatedAt
        };
      });

      if (!exerciseChanged) return exercise;
      workoutChanged = true;
      return { ...exercise, sets: nextSets };
    });

    if (!workoutChanged) return workout;
    changed = true;
    return { ...workout, exercises: nextExercises };
  });

  if (!changed) return { plan, changed: false };

  return {
    plan: {
      ...plan,
      workouts: nextWorkouts
    },
    changed: true
  };
}
