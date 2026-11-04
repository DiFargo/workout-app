const lockedStatuses = new Set(["completed", "completed_off_date", "missed"]);

export function isTrainerWorkoutDayLocked(workout, lockedIds = []) {
  return new Set(Array.from(lockedIds, String)).has(String(workout?.id || "")) || workout?.completed === true
    || Boolean(workout?.completedAt)
    || lockedStatuses.has(String(workout?.status || "").trim().toLowerCase());
}

export function getTrainerWorkoutDayMoveTarget(workouts, workoutId, direction, lockedIds = []) {
  if (!Array.isArray(workouts) || ![-1, 1].includes(direction) || !workoutId) return -1;
  const ids = workouts.map(workout => String(workout?.id || ""));
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) return -1;
  const index = ids.indexOf(String(workoutId));
  if (index < 0 || isTrainerWorkoutDayLocked(workouts[index], lockedIds)) return -1;
  for (let target = index + direction; target >= 0 && target < workouts.length; target += direction) {
    if (!isTrainerWorkoutDayLocked(workouts[target], lockedIds)) return target;
  }
  return -1;
}

export function moveTrainerWorkoutDay(workouts, workoutId, direction, lockedIds = []) {
  const target = getTrainerWorkoutDayMoveTarget(workouts, workoutId, direction, lockedIds);
  if (target < 0) return workouts;
  const index = workouts.findIndex(workout => String(workout.id) === String(workoutId));
  const next = [...workouts];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
