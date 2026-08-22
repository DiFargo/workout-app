export function isBasicWorkoutPlanItem(workout = {}) {
  return workout?.source === "basic" ||
    String(workout?.assignedProgramUpdatedAt || "").startsWith("basic:");
}

export function isWorkoutPlanForMode(plan = {}, mode = "individual") {
  const workouts = Array.isArray(plan?.workouts) ? plan.workouts : [];
  const isBasicPlan = isBasicWorkoutPlanItem(plan) || (
    workouts.length > 0 && workouts.every((workout) => isBasicWorkoutPlanItem(workout))
  );

  return mode === "basic" ? isBasicPlan : !isBasicPlan;
}

export function resolveWorkoutPlanMode({
  options = {},
  workoutModePreference = null
} = {}) {
  if (options?.mode === "basic" || options?.mode === "individual") {
    return options.mode;
  }

  return workoutModePreference?.mode === "basic"
    ? "basic"
    : "individual";
}
