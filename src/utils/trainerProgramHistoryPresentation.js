const list = value => Array.isArray(value) ? value : [];
const text = value => String(value ?? "").trim();
const number = value => Math.max(0, Number(value) || 0);

export function getProgramHistoryTimestamp(assignment = {}) {
  const value = assignment.timestamp || assignment.assignedAt;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value?.seconds !== undefined) return number(value.seconds) * 1000;
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortProgramHistoryAssignments(assignments = []) {
  return [...list(assignments)].sort((left, right) => (
    getProgramHistoryTimestamp(right) - getProgramHistoryTimestamp(left) ||
    number(right.order) - number(left.order) || text(left.key).localeCompare(text(right.key))
  ));
}

export function getCurrentProgramHistoryAssignment(assignments = [], currentAssignmentKey = "") {
  const active = list(assignments).filter(item => !item.isBasic && !item.archived &&
    ["current", "future"].includes(item.status));
  const selected = active.find(item => item.key === currentAssignmentKey);
  if (selected) return selected;
  // Keep the application's execution queue: an already started assignment,
  // then the oldest unstarted one. Display ordering must not change execution.
  const oldestFirst = sortProgramHistoryAssignments(active).reverse();
  return oldestFirst.find(item => item.status === "current") || oldestFirst[0] || null;
}

export function getProgramHistoryStatus(assignment = {}) {
  if (assignment.isBasic) return "Самостоятельный план";
  if (["archived", "legacy"].includes(getProgramHistoryArchiveState(assignment))) return "В архиве";
  if (assignment.archived || assignment.status === "archived") return "Прошлая программа";
  if (assignment.status === "current") return "Текущая";
  if (assignment.status === "future") return "Ещё не начата";
  return number(assignment.completion) === 100 ? "Пройдена" : "Завершена";
}

// `plan.archivedWorkouts` also contains older read-only assignments. Being in
// that array is not proof that archive metadata was persisted to Firestore.
export function getProgramHistoryArchiveState(assignment = {}) {
  const workouts = list(assignment.workouts);
  const metadata = workouts.map(workout => ({
    lifecycle: text(workout?.assignedProgramLifecycleStatus).toLowerCase(),
    visibility: text(workout?.assignedProgramVisibility).toLowerCase()
  }));
  if (metadata.length && metadata.every(item => item.lifecycle === "archived" && item.visibility === "trainer_archived")) return "archived";
  if (metadata.length && metadata.every(item =>
    (item.lifecycle === "archived" && !item.visibility) ||
    (!item.lifecycle && item.visibility === "trainer_archived") ||
    (item.lifecycle === "archived" && item.visibility === "trainer_archived")
  )) return "legacy";
  return assignment.archived || assignment.status === "archived" ? "historical" : "active";
}

export function getProgramHistorySections(assignments = [], currentAssignmentKey = "") {
  const current = getCurrentProgramHistoryAssignment(assignments, currentAssignmentKey);
  const others = [], archived = [];
  for (const assignment of sortProgramHistoryAssignments(assignments)) {
    if (assignment.key === current?.key) continue;
    const state = getProgramHistoryArchiveState(assignment);
    if (["archived", "legacy"].includes(state)) archived.push(assignment);
    else others.push(assignment);
  }
  return { current, others, archived };
}

function hasProgress(workout = {}) {
  if (workout.completed === true || workout.started === true || workout.inProgress === true) return true;
  if (["completed", "completed_off_date", "in_progress", "started", "active", "not_completed", "missed"]
    .includes(text(workout.status).toLowerCase())) return true;
  if (["startedAt", "completedAt", "finishedAt", "lastCompletedAt"].some(key => Boolean(workout[key]))) return true;
  if (number(workout.completedSetsCount) || number(workout.completedExercisesCount)) return true;
  const exercises = [...list(workout.exercises), ...list(workout.blocks).flatMap(block => list(block?.exercises))];
  return exercises.some(exercise => exercise?.completed === true ||
    list(exercise?.sets).some(set => set?.completed === true || set?.done === true ||
      set?.actualReps !== undefined || set?.actualWeight !== undefined));
}

// Presentation hint only. The server rechecks all records transactionally;
// neither this predicate nor a zero-percent badge authorizes deletion.
function isKnownEmptyHistoricalAssignment(assignment = {}) {
  if (["current", "future"].includes(assignment.status)) return false;
  if (assignment.isBasic || !(assignment.archived || assignment.status === "archived")) return false;
  if (!text(assignment.key).startsWith("time:")) return false;
  if (number(assignment.completedCount) || number(assignment.missedCount) || number(assignment.completion)) return false;
  if (!Array.isArray(assignment.completedWorkoutIds) || assignment.completedWorkoutIds.length) return false;
  if (!Array.isArray(assignment.history) || assignment.history.length) return false;
  return list(assignment.workouts).length > 0 && !assignment.workouts.some(hasProgress);
}

export function canDeleteEmptyProgramHistoryAssignment(assignment = {}) {
  return getProgramHistoryArchiveState(assignment) === "archived" && isKnownEmptyHistoricalAssignment(assignment);
}

export function canArchiveEmptyHistoricalAssignment(assignment = {}) {
  return getProgramHistoryArchiveState(assignment) !== "archived" && isKnownEmptyHistoricalAssignment(assignment);
}

export function getProgramHistoryWorkoutRows(assignment = {}) {
  const completed = new Set(list(assignment.completedWorkoutIds).map(text));
  return list(assignment.workouts).map((workout, index) => {
    const exercises = list(workout.exercises).length ? workout.exercises :
      list(workout.blocks).flatMap(block => list(block?.exercises));
    return {
      workout,
      key: text(workout.id) || `workout-${index}`,
      name: text(workout.name || workout.title) || `Тренировка ${index + 1}`,
      completed: completed.has(text(workout.id)) || workout.completed === true ||
        ["completed", "completed_off_date"].includes(text(workout.status).toLowerCase()),
      missed: ["not_completed", "missed"].includes(text(workout.status).toLowerCase()),
      exercises,
      setsCount: exercises.reduce((sum, exercise) => sum + list(exercise?.sets).length, 0)
    };
  });
}
