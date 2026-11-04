import { resolveAssignedTrainerId } from "./trainerAssignment.js";
import { hasAdminSecurityKeyProof } from "./adminSecurityKeyAccess.js";
import {
  getTrainerClientProgramAssignmentKey,
  isTrainerClientBasicWorkout,
  isTrainerClientCurrentAssignmentWorkout
} from "./trainerClientProgramAssignments.js";

const MAX_WORKOUT_SCAN = 2000;
const MAX_HISTORY_SCAN = 10000;
const MAX_ASSIGNMENT_WRITES = 400;
const text = value => typeof value === "string" ? value.trim() : "";
const normalized = value => text(value).toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
const present = value => value !== undefined && value !== null && value !== false && value !== "" && value !== 0;
const timestampOf = item => text(item?.assignedProgramAddedAt || item?.programAssignmentId || item?.assignedAt);

function activeActor(actor = {}) {
  return ["trainer", "admin"].includes(text(actor.role).toLowerCase()) && actor.active !== false &&
    actor.archived !== true && actor.accessDisabled !== true &&
    !["revoked", "suspended"].includes(text(actor.membershipStatus).toLowerCase()) &&
    actor.accountAccessStatus !== "awaiting_trainer";
}

function authorize(context, actor, client) {
  if (!activeActor(actor) || text(client.role || "client").toLowerCase() !== "client") {
    fail(403, "program/access-denied", "Нет доступа к программам этого клиента.");
  }
  const admin = context.token?.admin === true && actor.role === "admin" && hasAdminSecurityKeyProof(context.token, actor) &&
    (Object.hasOwn(actor, "adminClaimVersion")
      ? typeof actor.adminClaimVersion === "string" && actor.adminClaimVersion === context.token.adminClaimVersion
      : !Object.hasOwn(context.token || {}, "adminClaimVersion"));
  if (!admin && !(text(actor.role).toLowerCase() === "trainer" && resolveAssignedTrainerId(client) === context.uid)) {
    fail(403, "program/access-denied", "Нет доступа к программам этого клиента.");
  }
}

/** Prescribed weights/repetitions/durations are not evidence of a session. */
export function hasClientProgramWorkoutActivity(workout = {}) {
  const status = text(workout.status).toLowerCase();
  if (!["", "planned", "scheduled", "not_started"].includes(status)) return true;
  if (["startedAt", "workoutStartedAt", "completedAt", "finishedAt", "performedAt", "lastPerformedAt",
    "completed", "done", "started", "inProgress", "clientComment", "clientNote", "feedback", "postWorkoutFeedback"]
    .some(key => present(workout[key]))) return true;
  if (["completedSets", "completedExercises", "completedSetsCount", "completedExercisesCount", "durationSeconds", "elapsedSeconds", "completionCount"]
    .some(key => Number(workout[key]) > 0 || (Array.isArray(workout[key]) && workout[key].length > 0))) return true;
  if (["progress", "runtime", "session", "workoutDraft", "exerciseLogs", "results"]
    .some(key => present(workout[key]) && (typeof workout[key] !== "object" || Object.keys(workout[key]).length > 0))) return true;
  function hasActualValues(value) {
    if (Array.isArray(value)) return value.some(hasActualValues);
    if (!value || typeof value !== "object") return false;
    return Object.entries(value).some(([key, child]) => (
      ["enteredReps", "enteredWeight", "enteredDurationSeconds", "actualReps", "actualWeight"].includes(key)
        ? child !== undefined && child !== null && child !== ""
        : ["completed", "done", "startedAt", "completedAt", "finishedAt", "clientNote"].includes(key)
        ? present(child)
        : child && typeof child === "object" && hasActualValues(child)
    ));
  }
  return hasActualValues(workout.exercises) || hasActualValues(workout.blocks);
}

function hasMatchingHistory(entry, assignmentKey, programIds, workoutIds, workoutNames) {
  if (getTrainerClientProgramAssignmentKey(entry) === assignmentKey) return true;
  const identifiers = [entry.workoutId, entry.plannedSnapshot?.workoutId].map(normalized).filter(Boolean);
  if (identifiers.some(id => workoutIds.has(id))) return true;
  const saveId = text(entry.clientSaveId || entry.id).toLowerCase();
  if ([...workoutIds].some(id => saveId.startsWith(`workout_${id}_`))) return true;
  const assignmentTime = timestampOf(entry);
  const programId = text(entry.assignedProgramId);
  // A historical record without a durable assignment id could belong to any
  // older copy of this template. Never assume that it proves zero activity.
  if (!assignmentTime && programId && programIds.has(programId)) return true;
  if (!assignmentTime && !programId) {
    const name = normalized(entry.workoutName || entry.workout);
    return !name || workoutNames.has(name);
  }
  return false;
}

function calendarPatch(client, matched, assignmentKey, allWorkouts, now) {
  const calendar = client.workoutCalendar;
  if (!calendar || !Array.isArray(calendar.plannedWorkouts)) return null;
  const ids = new Set(matched.map(workout => workout.id));
  const scoped = entry => ids.has(text(entry?.workoutId)) ||
    (!text(entry?.workoutId) && timestampOf(entry) && getTrainerClientProgramAssignmentKey(entry) === assignmentKey);
  const removed = calendar.plannedWorkouts.filter(scoped);
  if (!removed.length) return null;
  const remaining = calendar.plannedWorkouts.filter(entry => !scoped(entry));
  const removedDates = new Set(removed.map(entry => text(entry.date)).filter(Boolean));
  const retainedDates = new Set([
    ...remaining.map(entry => text(entry.date)),
    ...allWorkouts.filter(workout => !ids.has(workout.id)).flatMap(workout => [workout.scheduledDate, workout.plannedDate, workout.movedToDate].map(text))
  ].filter(Boolean));
  const next = { ...calendar, plannedWorkouts: remaining, updatedAt: now };
  for (const field of ["scheduledDates", "monthlyTrainingDates"]) {
    if (Array.isArray(calendar[field])) next[field] = calendar[field]
      .filter(date => !removedDates.has(date) || retainedDates.has(date));
  }
  return { workoutCalendar: next };
}

/**
 * HTTP authentication/App Check are owned by the wrapper. The transaction
 * re-reads membership and trainer ownership so a concurrent revocation cannot
 * authorize deletion. Only empty archived assignment documents are removed;
 * history, templates and subscription data are never written here.
 */
export async function deleteEmptyClientProgramAssignment({ db, context, body = {}, now = () => new Date().toISOString() }) {
  if (!context?.uid) fail(401, "program/auth-required", "Войдите в аккаунт.");
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    Object.keys(body).some(key => !["clientId", "assignmentKey"].includes(key))) {
    fail(400, "program/invalid-request", "Обновите историю программ и повторите попытку.");
  }
  const clientId = text(body.clientId);
  const assignmentKey = text(body.assignmentKey);
  if (!clientId || clientId.length > 128 || clientId.includes("/") ||
    !assignmentKey.startsWith("time:") || assignmentKey.length > 220 ||
    !Number.isFinite(Date.parse(assignmentKey.slice(5)))) {
    fail(400, "program/invalid-assignment", "Не удалось однозначно определить старое назначение. Удаление недоступно.");
  }
  const clientRef = db.collection("users").doc(clientId);
  const actorRef = db.collection("users").doc(context.uid);
  return db.runTransaction(async transaction => {
    const [actorSnapshot, clientSnapshot] = await Promise.all([transaction.get(actorRef), transaction.get(clientRef)]);
    if (!actorSnapshot.exists || !clientSnapshot.exists) fail(403, "program/access-denied", "Нет доступа к программам этого клиента.");
    const actor = actorSnapshot.data() || {};
    const client = clientSnapshot.data() || {};
    authorize(context, actor, client);
    const [workoutsSnapshot, historySnapshot] = await Promise.all([
      transaction.get(clientRef.collection("workouts").limit(MAX_WORKOUT_SCAN + 1)),
      transaction.get(clientRef.collection("history").limit(MAX_HISTORY_SCAN + 1))
    ]);
    if (workoutsSnapshot.docs.length > MAX_WORKOUT_SCAN || historySnapshot.docs.length > MAX_HISTORY_SCAN) {
      fail(409, "program/verification-limit", "История слишком большая для безопасного удаления. Программа сохранена.");
    }
    const allWorkouts = workoutsSnapshot.docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id }));
    const matched = allWorkouts.filter(workout => getTrainerClientProgramAssignmentKey(workout) === assignmentKey);
    if (!matched.length) fail(404, "program/not-found", "Программа уже удалена или изменилась. Обновите историю.");
    if (matched.length > MAX_ASSIGNMENT_WRITES) fail(409, "program/verification-limit", "В программе слишком много дней для безопасного удаления.");
    if (matched.some(workout => isTrainerClientBasicWorkout(workout) ||
      text(workout.assignedProgramLifecycleStatus).toLowerCase() !== "archived" ||
      text(workout.assignedProgramVisibility).toLowerCase() !== "trainer_archived" ||
      isTrainerClientCurrentAssignmentWorkout(workout, client))) {
      fail(409, "program/not-empty-archive", "Удалять можно только старые архивные программы. Сначала проверьте текущее назначение.");
    }
    const programIds = new Set(matched.map(workout => text(workout.assignedProgramId)).filter(Boolean));
    // A shared timestamp with incompatible program ids is corrupt/ambiguous.
    if (programIds.size !== 1) fail(409, "program/ambiguous-assignment", "Назначение неоднозначно. Удаление недоступно.");
    const ids = new Set(matched.map(workout => normalized(workout.id)));
    const names = new Set(matched.map(workout => normalized(workout.name)).filter(Boolean));
    if (matched.some(hasClientProgramWorkoutActivity) || historySnapshot.docs.some(snapshot =>
      hasMatchingHistory({ ...snapshot.data(), id: snapshot.id }, assignmentKey, programIds, ids, names))) {
      fail(409, "program/has-activity", "В этой программе есть тренировки или результаты. Удалить её нельзя — история сохранена.");
    }
    const clientPatch = calendarPatch(client, matched, assignmentKey, allWorkouts, now());
    for (const workout of matched) transaction.delete(clientRef.collection("workouts").doc(workout.id));
    if (clientPatch) transaction.update(clientRef, clientPatch);
    return { ok: true, assignmentKey, deletedWorkoutIds: matched.map(workout => workout.id), clientPatch: clientPatch || {} };
  });
}
