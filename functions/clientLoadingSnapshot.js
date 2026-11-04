import { createHash } from "node:crypto";
import { dedupeWorkoutHistory } from "./workoutHistoryDedupe.js";
import { buildLatestExerciseResults } from "./workoutExerciseResults.js";
import { selectLatestMeasurementSnapshot } from "./measurementSnapshot.js";

const completionFields = ["id", "clientSaveId", "workoutId", "workoutName", "workout", "name",
  "order", "scheduleOrder", "sortOrder", "index", "assignedProgramUpdatedAt", "assignmentVersion",
  "assignedProgramId", "assignedProgramAddedAt", "programAssignmentId", "assignedAt", "startedAt",
  "date", "completedAt", "finishedAt", "createdAt"];
const profileFields = ["role", "active", "archived", "accessDisabled", "membershipStatus", "accountAccessStatus",
  "assignedProgramId", "assignedProgramName", "assignedProgramAt", "assignedProgramUpdatedAt",
  "assignedProgramAddedAt", "assignedProgramLifecycleStatus", "assignedAt", "basicWorkoutPlan", "workoutCalendar",
  "workoutModePreference", "trainerAssignmentState", "assignedTrainerId", "trainerId", "coachId", "createdByUid", "updatedAt"];
const fail = (status, code, message) => { throw Object.assign(new Error(message), { status, code }); };
const pick = (value, fields) => Object.fromEntries(fields.filter(field => Object.hasOwn(value, field)).map(field => [field, value[field]]));

// The wire format has no SDK objects. ISO strings preserve the existing date
// consumers and avoid Timestamp's private _seconds JSON representation.
export function loadingSnapshotJsonValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(loadingSnapshotJsonValue);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== undefined).map(([key, child]) => [key, loadingSnapshotJsonValue(child)]));
  return value;
}

function requireFreshActiveProfile(snapshot) {
  if (!snapshot.exists) fail(404, "loading-profile-not-found", "Профиль не найден.");
  const profile = snapshot.data() || {};
  if (!["client", "trainer", "admin"].includes(profile.role) || profile.active === false || profile.archived === true ||
    profile.accessDisabled === true || profile.accountAccessStatus === "awaiting_trainer" ||
    (profile.role === "client" && profile.trainerAssignmentState === "unassigned") ||
    ["revoked", "suspended"].includes(profile.membershipStatus)) {
    fail(403, "active-membership-required", "Для загрузки нужен активный аккаунт.");
  }
  return profile;
}

function assertServerSnapshot(snapshot) {
  if (!snapshot || snapshot.metadata?.fromCache === true || snapshot.metadata?.hasPendingWrites === true) {
    fail(503, "loading-snapshot-unverified", "Не удалось подтвердить данные на сервере.");
  }
}

function revisionOf(snapshot) {
  const records = snapshot.docs || [snapshot];
  return records.map(doc => [doc.id, loadingSnapshotJsonValue(doc.updateTime || doc.data())]);
}

export function compactWorkoutLoadingData(profile, workoutSnapshot, historySnapshot) {
  const workouts = workoutSnapshot.docs.map(doc => ({ id: doc.id, data: loadingSnapshotJsonValue(doc.data() || {}) }));
  const history = historySnapshot.docs.map(doc => loadingSnapshotJsonValue({ id: doc.id, ...(doc.data() || {}) }));
  const basicId = profile.basicWorkoutPlan?.basicPlanId || profile.basicWorkoutPlan?.id || "";
  const basicVersion = String(profile.basicWorkoutPlan?.assignedProgramUpdatedAt || (basicId ? `basic:${basicId}` : "")).trim();
  const versions = new Set(["", basicVersion, String(profile.assignedProgramUpdatedAt || profile.assignedProgramAt || "").trim(),
    ...(profile.basicWorkoutPlan?.workouts || []).map(workout => String(workout.assignedProgramUpdatedAt || basicVersion).trim()),
    ...workouts.map(doc => String(doc.data.assignedProgramUpdatedAt || profile.assignedProgramUpdatedAt || profile.assignedProgramAt || "").trim())]);
  const deduped = dedupeWorkoutHistory(history);
  const latestExerciseResultDatesByAssignment = {};
  const latestExerciseResultsByAssignment = Object.fromEntries([...versions].map(version => {
    const resultDates = {};
    const result = buildLatestExerciseResults(deduped, version, { resultDates });
    latestExerciseResultDatesByAssignment[version] = resultDates;
    return [version, result];
  }));
  return {
    profile: loadingSnapshotJsonValue(pick(profile, profileFields)), workouts,
    completionHistory: history.map(item => pick(item, completionFields)),
    latestExerciseResultsByAssignment, latestExerciseResultDatesByAssignment
  };
}

// Auth verification/App Check/rate limiting remain in the existing HTTP caller.
// This service rechecks membership from the same read-only transaction as its
// sources. No permanent cache, trigger-written authority or partial completion.
export async function readClientLoadingSnapshot({ db, context, clientId = context?.uid, kind = "workouts" }) {
  const uid = context?.uid;
  if (typeof uid !== "string" || !uid || uid.length > 128 || uid.includes("/")) fail(401, "authentication-required", "Войдите в аккаунт.");
  if (clientId !== uid) fail(403, "loading-owner-required", "Разрешена загрузка только своих данных.");
  if (!["workouts", "measurements"].includes(kind)) fail(400, "loading-kind-invalid", "Неизвестный раздел загрузки.");
  try {
    return await db.runTransaction(async transaction => {
      const userRef = db.collection("users").doc(uid);
      const profileSnapshot = await transaction.get(userRef);
      assertServerSnapshot(profileSnapshot);
      const profile = requireFreshActiveProfile(profileSnapshot);
      const names = kind === "workouts" ? ["workouts", "history"] : ["measurements"];
      const snapshots = await Promise.all(names.map(name => transaction.get(userRef.collection(name))));
      snapshots.forEach(assertServerSnapshot);
      const sourceRevision = createHash("sha256").update(JSON.stringify([kind, revisionOf(profileSnapshot), ...snapshots.map(revisionOf)])).digest("hex");
      const coverage = { profile: "complete", ...Object.fromEntries(names.map(name => [name, "complete"])) };
      const sourceCounts = Object.fromEntries(names.map((name, index) => [name, snapshots[index].docs.length]));
      const data = kind === "workouts" ? compactWorkoutLoadingData(profile, snapshots[0], snapshots[1])
        : { measurements: selectLatestMeasurementSnapshot(snapshots[0].docs.map(doc => loadingSnapshotJsonValue({ id: doc.id, ...(doc.data() || {}) }))) };
      return { schemaVersion: 1, kind, uid, sourceRevision, coverage, sourceCounts,
        verifiedAt: loadingSnapshotJsonValue(profileSnapshot.readTime || new Date()), ...data };
    }, { readOnly: true });
  } catch (error) {
    if (error?.status) throw error;
    fail(503, "loading-snapshot-unavailable", "Не удалось подтвердить данные. Повторите загрузку.");
  }
}
