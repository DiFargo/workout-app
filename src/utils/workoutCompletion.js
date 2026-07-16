export function getCompletedWorkoutKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function getWorkoutAssignmentVersion(plan = {}) {
  return String(plan?.assignedProgramUpdatedAt || "").trim();
}

function getCompletedWorkoutOrderKeys(item = {}) {
  return [
    item?.order,
    item?.scheduleOrder,
    item?.sortOrder
  ]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => `order:${value}`);
}

function addCompletedWorkoutKeys(completed, item = {}) {
  const workoutName = item?.workoutName || item?.workout || item?.name;

  if (item?.workoutId) completed.add(`id:${getCompletedWorkoutKey(item.workoutId)}`);
  if (item?.id) completed.add(`id:${getCompletedWorkoutKey(item.id)}`);
  if (workoutName) completed.add(`name:${getCompletedWorkoutKey(workoutName)}`);
  getCompletedWorkoutOrderKeys(item).forEach((key) => completed.add(key));

  if (Number.isFinite(Number(item?.index)) && Number(item.index) >= 0) {
    completed.add(`index:${Number(item.index)}`);
  }
}

function addCalendarCompletedWorkouts(completed, workoutCalendar = {}, currentAssignmentVersion = "") {
  const assignmentVersion = String(currentAssignmentVersion || "").trim();
  const calendarAssignmentVersion = String(workoutCalendar?.assignedProgramUpdatedAt || "").trim();

  if (assignmentVersion && calendarAssignmentVersion && calendarAssignmentVersion !== assignmentVersion) {
    return;
  }

  (Array.isArray(workoutCalendar?.plannedWorkouts) ? workoutCalendar.plannedWorkouts : []).forEach((item) => {
    const status = String(item?.status || "").trim().toLowerCase();
    if (!["completed", "completed_off_date"].includes(status)) return;

    addCompletedWorkoutKeys(completed, item);
  });
}

export function buildCompletedWorkoutSet(
  historyItems = [],
  currentAssignmentVersion = "",
  workoutCalendar = {}
) {
  const completed = new Set();
  const assignmentVersion = String(currentAssignmentVersion || "").trim();

  (Array.isArray(historyItems) ? historyItems : []).forEach((item) => {
    if (assignmentVersion) {
      if (
        String(item?.assignedProgramUpdatedAt || "").trim() === assignmentVersion &&
        item?.workoutId
      ) {
        addCompletedWorkoutKeys(completed, item);
      }
      return;
    }

    addCompletedWorkoutKeys(completed, item);
  });

  addCalendarCompletedWorkouts(completed, workoutCalendar, assignmentVersion);

  return completed;
}

export function isWorkoutCompletedWithSet(workoutItem, completedSet = new Set(), currentAssignmentVersion = "") {
  if (!workoutItem) return false;

  const manualStatus = String(workoutItem.status || "").trim().toLowerCase();
  if (manualStatus === "completed") return true;
  if (["not_completed", "missed"].includes(manualStatus)) return false;

  const assignmentVersion = String(
    workoutItem.assignedProgramUpdatedAt || currentAssignmentVersion || ""
  ).trim();
  const workoutIdKey = `id:${getCompletedWorkoutKey(workoutItem.id)}`;
  const workoutOrderKeys = getCompletedWorkoutOrderKeys(workoutItem);

  if (assignmentVersion) {
    return completedSet.has(workoutIdKey) ||
      workoutOrderKeys.some((key) => completedSet.has(key));
  }

  return completedSet.has(workoutIdKey) ||
    completedSet.has(`name:${getCompletedWorkoutKey(workoutItem.name)}`) ||
    workoutOrderKeys.some((key) => completedSet.has(key));
}

export function getNextUncompletedWorkoutIndex(
  workouts = [],
  completedSet = new Set(),
  currentAssignmentVersion = ""
) {
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];
  const index = safeWorkouts.findIndex((workoutItem) => (
    !isWorkoutCompletedWithSet(workoutItem, completedSet, currentAssignmentVersion)
  ));

  return index >= 0 ? index : 0;
}
