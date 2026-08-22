export const ADMIN_BASIC_PROGRAM_STATUSES = Object.freeze({
  DRAFT: "draft",
  REVIEW: "review",
  PUBLISHED: "published",
  ARCHIVED: "archived"
});

const STATUS_LABELS = Object.freeze({
  [ADMIN_BASIC_PROGRAM_STATUSES.DRAFT]: "Черновик",
  [ADMIN_BASIC_PROGRAM_STATUSES.REVIEW]: "На проверке",
  [ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED]: "Опубликована",
  [ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED]: "В архиве"
});

const VALID_STATUSES = new Set(Object.values(ADMIN_BASIC_PROGRAM_STATUSES));

function text(value) {
  return String(value ?? "").trim();
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function toTitleCase(value) {
  const normalized = text(value).replace(/\s+/g, " ");
  return normalized || "Новая тренировка";
}

function makeWorkoutId(index) {
  return `day-${index + 1}`;
}

function makeExerciseId(dayIndex, exerciseIndex) {
  return `exercise-${dayIndex + 1}-${exerciseIndex + 1}`;
}

function normalizeExercise(exercise, dayIndex, exerciseIndex) {
  if (typeof exercise === "string") {
    return {
      id: makeExerciseId(dayIndex, exerciseIndex),
      name: toTitleCase(exercise)
    };
  }

  const source = exercise && typeof exercise === "object" ? exercise : {};
  return {
    ...source,
    id: text(source.id || source.uid) || makeExerciseId(dayIndex, exerciseIndex),
    name: toTitleCase(source.name || source.title || source.exerciseName)
  };
}

function normalizeWorkout(workout, index) {
  const source = workout && typeof workout === "object" ? workout : {};
  return {
    ...source,
    id: text(source.id || source.uid) || makeWorkoutId(index),
    order: Number(source.order || source.sortOrder || index + 1),
    sortOrder: Number(source.sortOrder || source.order || index + 1),
    name: toTitleCase(source.name || source.title || source.workoutName || `День ${index + 1}`),
    exercises: list(source.exercises).map((exercise, exerciseIndex) => (
      normalizeExercise(exercise, index, exerciseIndex)
    ))
  };
}

export function normalizeBasicProgramWorkouts(workouts) {
  return list(workouts).map(normalizeWorkout);
}

export function parseBasicProgramWorkouts(sourceText) {
  const rows = text(sourceText)
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  return rows.map((row, index) => {
    const separatorIndex = row.indexOf(":");
    const title = separatorIndex >= 0 ? row.slice(0, separatorIndex) : `День ${index + 1}`;
    const exercisesRaw = separatorIndex >= 0 ? row.slice(separatorIndex + 1) : row;
    const exercises = exercisesRaw
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((name, exerciseIndex) => ({
        id: makeExerciseId(index, exerciseIndex),
        name
      }));

    return {
      id: makeWorkoutId(index),
      order: index + 1,
      sortOrder: index + 1,
      name: toTitleCase(title),
      exercises
    };
  });
}

export function formatBasicProgramWorkouts(workouts) {
  return normalizeBasicProgramWorkouts(workouts)
    .map((workout) => `${workout.name}: ${workout.exercises.map((exercise) => exercise.name).join("; ")}`)
    .join("\n");
}

export function getAdminBasicProgramStatus(value) {
  return VALID_STATUSES.has(value) ? value : ADMIN_BASIC_PROGRAM_STATUSES.DRAFT;
}

export function getAdminBasicProgramStatusLabel(value) {
  return STATUS_LABELS[getAdminBasicProgramStatus(value)];
}

export function isAdminManagedBasicProgram(program) {
  return Boolean(program && typeof program === "object" && program.managedBy === "admin-basic-catalog");
}

export function createBasicProgramPlan(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const workouts = normalizeBasicProgramWorkouts(source.workouts);

  return {
    title: toTitleCase(source.title || source.name),
    description: text(source.description),
    goal: text(source.goal),
    workouts
  };
}

export function createBasicProgramMutation({
  current = null,
  draft = {},
  action = "created",
  actor = {},
  reason = "",
  status
} = {}) {
  const previous = current && typeof current === "object" ? current : {};
  const plan = createBasicProgramPlan(draft);
  const nextVersion = Math.max(0, Number(previous.version) || 0) + 1;
  const nextStatus = getAdminBasicProgramStatus(status || previous.status);
  const previousPublished = previous.publishedSnapshot && typeof previous.publishedSnapshot === "object"
    ? previous.publishedSnapshot
    : null;
  const shouldPublish = nextStatus === ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED;
  const actorSnapshot = {
    uid: text(actor.uid),
    name: text(actor.name),
    email: text(actor.email)
  };
  const snapshot = {
    version: nextVersion,
    action: text(action) || "updated",
    reason: text(reason) || "Без комментария",
    status: nextStatus,
    actor: actorSnapshot,
    plan
  };
  const record = {
    ...previous,
    ...plan,
    managedBy: "admin-basic-catalog",
    status: nextStatus,
    version: nextVersion,
    lastAction: snapshot.action,
    lastReason: snapshot.reason,
    lastActor: actorSnapshot,
    publishedVersion: shouldPublish ? nextVersion : Number(previous.publishedVersion) || 0,
    publishedSnapshot: shouldPublish ? plan : previousPublished,
    sourceProgramId: text(draft.sourceProgramId || previous.sourceProgramId)
  };

  return { record, snapshot };
}

export function getBasicProgramTransition(currentStatus, targetStatus) {
  const current = getAdminBasicProgramStatus(currentStatus);
  const target = getAdminBasicProgramStatus(targetStatus);
  if (current === target) return { allowed: false, action: "" };

  const actionByTransition = {
    [`${ADMIN_BASIC_PROGRAM_STATUSES.DRAFT}:${ADMIN_BASIC_PROGRAM_STATUSES.REVIEW}`]: "sent_to_review",
    [`${ADMIN_BASIC_PROGRAM_STATUSES.REVIEW}:${ADMIN_BASIC_PROGRAM_STATUSES.DRAFT}`]: "returned_to_draft",
    [`${ADMIN_BASIC_PROGRAM_STATUSES.REVIEW}:${ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED}`]: "published",
    [`${ADMIN_BASIC_PROGRAM_STATUSES.DRAFT}:${ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED}`]: "archived",
    [`${ADMIN_BASIC_PROGRAM_STATUSES.REVIEW}:${ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED}`]: "archived",
    [`${ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED}:${ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED}`]: "archived",
    [`${ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED}:${ADMIN_BASIC_PROGRAM_STATUSES.DRAFT}`]: "restored_to_draft"
  };
  const action = actionByTransition[`${current}:${target}`] || "";

  return { allowed: Boolean(action), action };
}

export function countAdminBasicProgramsByStatus(programs) {
  return list(programs).reduce((counts, program) => {
    const status = getAdminBasicProgramStatus(program?.status);
    counts[status] += 1;
    return counts;
  }, {
    [ADMIN_BASIC_PROGRAM_STATUSES.DRAFT]: 0,
    [ADMIN_BASIC_PROGRAM_STATUSES.REVIEW]: 0,
    [ADMIN_BASIC_PROGRAM_STATUSES.PUBLISHED]: 0,
    [ADMIN_BASIC_PROGRAM_STATUSES.ARCHIVED]: 0
  });
}
