import { buildPlannedWorkoutSlots, toWorkoutDateKey } from "./workoutSchedule.js";

const REVIEW_EVENT_TYPES = new Set([
  "exercise_progress_review",
  "exerciseprogressreview"
]);
const RESOLVED_REVIEW_STATES = new Set(["accepted", "adjusted"]);

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/\s+/g, " ")
    .trim();
}

function toStableNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : String(value).trim();
}

function toStableDate(value) {
  if (!value) return "";
  const candidate = typeof value?.toDate === "function" ? value.toDate() : value;
  return toWorkoutDateKey(candidate);
}

function getSessionMetrics(session = {}) {
  return {
    e1rm: toStableNumber(session.e1rm),
    volume: toStableNumber(session.volume),
    totalReps: toStableNumber(session.totalReps),
    bestWeight: toStableNumber(session.bestWeight),
    sets: toStableNumber(session.sets)
  };
}

function hashReviewPayload(value = "") {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function parseEventDetails(details) {
  if (details && typeof details === "object" && !Array.isArray(details)) return details;
  if (typeof details !== "string" || !details.trim()) return {};

  try {
    const parsed = JSON.parse(details);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getAssignmentVersion(workouts = [], workoutCalendar = {}, item = {}) {
  return String(
    workoutCalendar?.assignedProgramUpdatedAt
      || item?.current?.assignedProgramUpdatedAt
      || item?.current?.assignmentVersion
      || (Array.isArray(workouts)
        ? workouts.find((workout) => workout?.assignedProgramUpdatedAt || workout?.assignmentVersion)
        : null)?.assignedProgramUpdatedAt
      || (Array.isArray(workouts)
        ? workouts.find((workout) => workout?.assignmentVersion)
        : null)?.assignmentVersion
      || ""
  ).trim();
}

function workoutBelongsToAssignment(workout = {}, assignmentVersion = "") {
  if (!assignmentVersion) return true;
  const workoutVersion = String(
    workout?.assignedProgramUpdatedAt || workout?.assignmentVersion || ""
  ).trim();
  return !workoutVersion || workoutVersion === assignmentVersion;
}

function findMatchingExercise(workout = {}, exerciseName = "") {
  const normalizedName = normalizeText(exerciseName);
  if (!normalizedName) return null;
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
  const exerciseIndex = exercises.findIndex((exercise) => normalizeText(exercise?.name) === normalizedName);
  if (exerciseIndex < 0) return null;
  return { exercise: exercises[exerciseIndex], exerciseIndex };
}

export function getTrainerExerciseProgressReviewKey(item = {}) {
  const payload = {
    name: normalizeText(item?.name),
    status: normalizeText(item?.status),
    previousDate: toStableDate(item?.previous?.date),
    currentDate: toStableDate(item?.current?.date),
    program: normalizeText(
      item?.current?.programId
        || item?.current?.programName
        || item?.previous?.programId
        || item?.previous?.programName
    ),
    previous: getSessionMetrics(item?.previous),
    current: getSessionMetrics(item?.current)
  };
  const serialized = JSON.stringify(payload);
  return `exercise-progress:${hashReviewPayload(serialized)}`;
}

export function getTrainerExerciseProgressReviewedKeys(events = []) {
  const keys = new Set();

  (Array.isArray(events) ? events : []).forEach((event) => {
    const eventType = normalizeText(event?.type).replace(/[^a-z0-9_]/g, "");
    if (!REVIEW_EVENT_TYPES.has(eventType)) return;

    const details = parseEventDetails(event?.details);
    const resolution = normalizeText(event?.decision || event?.resolution || details?.decision || details?.resolution);
    const reviewKey = String(event?.reviewKey || details?.reviewKey || "").trim();
    if (reviewKey && RESOLVED_REVIEW_STATES.has(resolution)) keys.add(reviewKey);
  });

  return keys;
}

export function findTrainerExerciseProgressTarget({
  workouts = [],
  history = [],
  workoutCalendar = {},
  item = {},
  now = new Date()
} = {}) {
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];
  const exerciseName = String(item?.name || "").trim();
  if (!safeWorkouts.length || !exerciseName) return null;

  const assignmentVersion = getAssignmentVersion(safeWorkouts, workoutCalendar, item);
  const todayKey = toWorkoutDateKey(now);
  const slots = buildPlannedWorkoutSlots({
    workouts: safeWorkouts,
    calendar: workoutCalendar,
    history,
    now
  });
  const candidates = [];

  slots.forEach((slot, workoutIndex) => {
    const workout = safeWorkouts[workoutIndex];
    if (!workout || !workoutBelongsToAssignment(workout, assignmentVersion)) return;
    if (slot?.isCompleted || slot?.isMissed) return;
    if (!["planned", "moved"].includes(String(slot?.status || "planned"))) return;

    const match = findMatchingExercise(workout, exerciseName);
    if (!match) return;

    const date = toWorkoutDateKey(
      slot?.status === "moved"
        ? slot?.shiftedDate || slot?.plannedDate
        : slot?.plannedDate
    );
    if (date && todayKey && date < todayKey) return;

    candidates.push({
      workout,
      exercise: match.exercise,
      workoutIndex,
      exerciseIndex: match.exerciseIndex,
      workoutId: String(workout?.id || slot?.workoutId || "").trim(),
      exerciseId: String(match.exercise?.id || "").trim(),
      date,
      slot
    });
  });

  candidates.sort((left, right) => {
    if (left.date && right.date) return left.date.localeCompare(right.date) || left.workoutIndex - right.workoutIndex;
    if (left.date) return -1;
    if (right.date) return 1;
    return left.workoutIndex - right.workoutIndex;
  });

  return candidates[0] || null;
}

export function patchTrainerExerciseProgressTarget(workouts = [], target = {}, patch = {}) {
  if (!Array.isArray(workouts) || !target || typeof patch !== "object" || patch === null) return workouts;

  const targetWorkoutId = String(target?.workoutId || target?.workout?.id || "").trim();
  const targetExerciseId = String(target?.exerciseId || target?.exercise?.id || "").trim();
  let workoutIndex = Number.isInteger(target?.workoutIndex) ? target.workoutIndex : -1;
  if (workoutIndex < 0 || workoutIndex >= workouts.length) {
    workoutIndex = targetWorkoutId
      ? workouts.findIndex((workout) => String(workout?.id || "").trim() === targetWorkoutId)
      : -1;
  }
  if (workoutIndex < 0) return workouts;

  const workout = workouts[workoutIndex];
  const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
  let exerciseIndex = Number.isInteger(target?.exerciseIndex) ? target.exerciseIndex : -1;
  if (exerciseIndex < 0 || exerciseIndex >= exercises.length) {
    exerciseIndex = targetExerciseId
      ? exercises.findIndex((exercise) => String(exercise?.id || "").trim() === targetExerciseId)
      : -1;
  }
  if (exerciseIndex < 0) return workouts;

  const exercise = exercises[exerciseIndex];
  const nextExercise = { ...exercise };
  if (Object.hasOwn(patch, "sets")) {
    nextExercise.sets = Array.isArray(patch.sets)
      ? patch.sets.map((set) => (set && typeof set === "object" ? { ...set } : set))
      : [];
  }
  if (Object.hasOwn(patch, "rest")) nextExercise.rest = patch.rest;

  const nextExercises = [...exercises];
  nextExercises[exerciseIndex] = nextExercise;
  const nextWorkouts = [...workouts];
  nextWorkouts[workoutIndex] = { ...workout, exercises: nextExercises };
  return nextWorkouts;
}
