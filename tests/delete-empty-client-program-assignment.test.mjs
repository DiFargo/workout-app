import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deleteEmptyClientProgramAssignment, hasClientProgramWorkoutActivity } from "../functions/deleteEmptyClientProgramAssignment.js";

const assignedAt = "2026-10-10T12:00:00.000Z";
const assignmentKey = `time:${assignedAt}`;
const context = { uid: "trainer", role: "trainer", token: {} };
const body = { clientId: "client", assignmentKey };
const workout = (id, patch = {}) => ({ id, name: `Тренировка ${id}`, status: "planned", assignedProgramId: "template",
  assignedProgramAddedAt: assignedAt, assignedProgramLifecycleStatus: "archived", assignedProgramVisibility: "trainer_archived",
  exercises: [{ sets: [{ weight: 50, reps: 12, durationSeconds: 30, completed: false, enteredWeight: "", enteredReps: "" }] }], ...patch });
const initial = () => ({
  "users/trainer": { role: "trainer", active: true },
  "users/client": { role: "client", trainerAssignmentState: "assigned", assignedTrainerId: "trainer", assignedProgramId: "new-template", assignedProgramAddedAt: "2026-10-17T12:00:00.000Z" },
  "users/client/workouts/day-1": workout("day-1"),
  "users/client/workouts/day-2": workout("day-2"),
  "users/client/workouts/other": workout("other", { assignedProgramAddedAt: "2026-09-01T12:00:00.000Z" })
});

test("удаление администратором с включённой защитой требует proof текущей ключевой сессии", async () => {
  const seed = initial();
  seed["users/trainer"] = { role: "admin", active: true, adminClaimVersion: "role",
    adminSecurityKeyRequired: true, adminSecurityKeyVersion: "key-policy" };
  const token = { admin: true, adminClaimVersion: "role" };
  for (const extra of [{}, { adminSecurityKeyVersion: "key-policy", adminSecurityKeyRoleVersion: "old", adminSecurityKeyUntil: Date.now() + 60000 }]) {
    const db = database(seed);
    await assert.rejects(deleteEmptyClientProgramAssignment({ db, context: { uid: "trainer", role: "admin", token: { ...token, ...extra } }, body }), { status: 403 });
    assert.deepEqual(db.writes, []);
  }
  const db = database(seed);
  await deleteEmptyClientProgramAssignment({ db, context: { uid: "trainer", role: "admin", token: { ...token,
    adminSecurityKeyVersion: "key-policy", adminSecurityKeyRoleVersion: "role", adminSecurityKeyUntil: Date.now() + 60000 } }, body });
  assert.equal(db.documents.has("users/client/workouts/day-1"), false);
});

function database(seed = initial()) {
  const documents = new Map(Object.entries(structuredClone(seed)));
  const writes = [];
  const reads = [];
  const ref = path => ({ path, id: path.split("/").at(-1), collection: name => query(`${path}/${name}`) });
  const query = (path, maximum = Infinity) => ({ path, query: true, maximum, doc: id => ref(`${path}/${id}`), limit: maximum => query(path, maximum) });
  function snapshot(reference) {
    reads.push(reference.path);
    if (reference.query) return { docs: [...documents].filter(([key]) => key.startsWith(`${reference.path}/`) && !key.slice(reference.path.length + 1).includes("/"))
      .slice(0, reference.maximum).map(([path, value]) => ({ id: path.split("/").at(-1), data: () => structuredClone(value) })) };
    return { exists: documents.has(reference.path), data: () => structuredClone(documents.get(reference.path)) };
  }
  return { documents, writes, reads, collection: query,
    async runTransaction(callback) {
      const pending = [];
      const result = await callback({
        get: async reference => { assert.equal(pending.length, 0, "Все чтения выполняются до записи"); return snapshot(reference); },
        delete: reference => pending.push({ action: "delete", path: reference.path }),
        update: (reference, patch) => pending.push({ action: "update", path: reference.path, patch: structuredClone(patch) })
      });
      for (const change of pending) {
        writes.push(change);
        if (change.action === "delete") documents.delete(change.path);
        else documents.set(change.path, { ...documents.get(change.path), ...change.patch });
      }
      return result;
    }
  };
}

async function reject(seed, patch = {}, expected = { status: 409 }) {
  const db = database(seed);
  await assert.rejects(deleteEmptyClientProgramAssignment({ db, context, body, ...patch }), expected);
  assert.deepEqual(db.writes, []);
  return db;
}

test("удаление затрагивает только выбранное пустое архивное назначение", async () => {
  const seed = initial();
  seed["users/client/history/unrelated"] = { workoutId: "foreign", assignedProgramId: "foreign", date: "2026-10-25" };
  seed["trainingTemplates/template"] = { name: "Общий шаблон" };
  seed["users/client/nutrition/state"] = { days: { today: ["еда"] } };
  seed["users/client"].subscription = { total: 8, used: 3 };
  const db = database(seed);
  const response = await deleteEmptyClientProgramAssignment({ db, context, body });
  assert.deepEqual(response, { ok: true, assignmentKey, deletedWorkoutIds: ["day-1", "day-2"], clientPatch: {} });
  assert.equal(db.documents.has("users/client/workouts/day-1"), false);
  assert.equal(db.documents.has("users/client/workouts/day-2"), false);
  for (const path of ["users/client/workouts/other", "users/client/history/unrelated", "trainingTemplates/template", "users/client/nutrition/state", "users/client"]) {
    assert.deepEqual(db.documents.get(path), seed[path]);
  }
});

test("сервер перечитывает роль и назначенного тренера, не доверяя старому контексту", async () => {
  for (const actorPatch of [{ role: "client" }, { active: false }, { archived: true }, { accessDisabled: true }, { membershipStatus: "revoked" }]) {
    const seed = initial(); Object.assign(seed["users/trainer"], actorPatch);
    const db = await reject(seed, {}, { status: 403 });
    assert.equal(db.reads.some(path => path.endsWith("/history") || path.endsWith("/workouts")), false);
  }
  for (const clientPatch of [{ assignedTrainerId: "other" }, { trainerAssignmentState: "revoked" }, { role: "trainer" }]) {
    const seed = initial(); Object.assign(seed["users/client"], clientPatch);
    await reject(seed, {}, { status: 403 });
  }
  await reject(initial(), { context: {} }, { status: 401 });
  await reject(initial(), { context: { uid: "client", role: "client", token: {} } }, { status: 403 });
});

test("доступ администратора требует актуальной роли и версии claim", async () => {
  const seed = initial(); seed["users/admin"] = { role: "admin", adminClaimVersion: "v2" };
  const adminContext = { uid: "admin", role: "admin", token: { admin: true, adminClaimVersion: "v2" } };
  assert.equal((await deleteEmptyClientProgramAssignment({ db: database(seed), context: adminContext, body })).ok, true);
  await reject(seed, { context: { ...adminContext, token: { admin: true, adminClaimVersion: "v1" } } }, { status: 403 });
  seed["users/admin"].role = "client";
  await reject(seed, { context: adminContext }, { status: 403 });
});

test("некорректные и неоднозначные ключи запрещены до чтения данных", async () => {
  for (const request of [{ clientId: "bad/path", assignmentKey }, { ...body, assignmentKey: "program:template" },
    { ...body, assignmentKey: "legacy:0" }, { ...body, assignmentKey: "time:unknown" }, { ...body, workoutIds: ["day-1"] }]) {
    const db = await reject(initial(), { body: request }, { status: 400 });
    assert.deepEqual(db.reads, []);
  }
  const seed = initial(); seed["users/client/workouts/day-2"].assignedProgramId = "another";
  await reject(seed, {}, { code: "program/ambiguous-assignment" });
});

test("текущие, базовые, частично архивные и клиентские архивы не удаляются", async () => {
  for (const patch of [{ assignedProgramLifecycleStatus: "active" }, { assignedProgramVisibility: "client_archived" },
    { source: "basic" }, { assignedProgramId: "basic_test" }, { assignedProgramUpdatedAt: "basic:v1" }]) {
    const seed = initial(); Object.assign(seed["users/client/workouts/day-2"], patch);
    await reject(seed, {}, { code: "program/not-empty-archive" });
  }
  const seed = initial(); Object.assign(seed["users/client"], { assignedProgramId: "template", assignedProgramAddedAt: assignedAt });
  await reject(seed, {}, { code: "program/not-empty-archive" });
});

test("плановые вес, повторы и длительность не считаются результатом", () => {
  assert.equal(hasClientProgramWorkoutActivity(workout("planned")), false);
  assert.equal(hasClientProgramWorkoutActivity(workout("missed", { status: "missed" })), true);
  assert.equal(hasClientProgramWorkoutActivity(workout("incomplete", { status: "not_completed" })), true);
});

test("любой след выполнения или начала блокирует удаление без истории", async () => {
  const signals = [{ status: "completed" }, { status: "in_progress" }, { status: "unknown" }, { status: "missed" }, { status: "not_completed" }, { started: true }, { inProgress: true }, { startedAt: "2026-10-10" },
    { completedAt: "2026-10-10" }, { finishedAt: "2026-10-10" }, { completed: true }, { durationSeconds: 1 },
    { completedSets: [1] }, { completedSetsCount: 1 }, { completedExercisesCount: 1 }, { progress: { activeSet: 0 } }, { exercises: [{ sets: [{ completed: true }] }] },
    { exercises: [{ sets: [{ enteredWeight: "0" }] }] }, { exercises: [{ sets: [{ enteredReps: 12 }] }] },
    { blocks: [{ exercises: [{ sets: [{ actualReps: 12 }] }] }] }, { exercises: [{ sets: [{ actualWeight: 0 }] }] }];
  for (const patch of signals) {
    const seed = initial(); Object.assign(seed["users/client/workouts/day-1"], patch);
    await reject(seed, {}, { code: "program/has-activity" });
  }
});

test("любая связанная запись истории запрещает удаление, даже если статус planned", async () => {
  const records = [{ workoutId: "day-1" }, { workoutId: "DAY-1", assignedProgramAddedAt: "other" },
    { assignedProgramAddedAt: assignedAt }, { programAssignmentId: assignedAt }, { assignedAt },
    { plannedSnapshot: { workoutId: "day-2" } }, { clientSaveId: "workout_day-1_123" },
    { assignedProgramId: "template" }, { workoutName: "Тренировка day-1" }, { date: "2026-10-10" }];
  for (const entry of records) {
    const seed = initial(); seed["users/client/history/session"] = entry;
    await reject(seed, {}, { code: "program/has-activity" });
  }
});

test("история другой идентифицированной программы не блокирует пустой архив", async () => {
  const seed = initial(); seed["users/client/history/session"] = { workoutId: "other", assignedProgramId: "template", assignedProgramAddedAt: "2026-09-01T12:00:00.000Z" };
  const db = database(seed);
  assert.equal((await deleteEmptyClientProgramAssignment({ db, context, body })).ok, true);
  assert.deepEqual(db.documents.get("users/client/history/session"), seed["users/client/history/session"]);
});

test("точные ссылки календаря очищаются без чужих дат и изменения абонемента", async () => {
  const seed = initial();
  seed["users/client"].subscription = { total: 8, used: 3 };
  seed["users/client"].workoutCalendar = {
    scheduledDates: ["2026-10-10", "2026-10-11", "2026-10-12"], monthlyTrainingDates: ["2026-10-10", "2026-10-11", "2026-10-12"],
    plannedWorkouts: [{ workoutId: "day-1", date: "2026-10-10" }, { workoutId: "day-2", date: "2026-10-11" },
      { workoutId: "other", date: "2026-10-11" }], note: "сохранить"
  };
  const db = database(seed);
  const result = await deleteEmptyClientProgramAssignment({ db, context, body, now: () => "NOW" });
  const profile = db.documents.get("users/client");
  assert.deepEqual(profile.workoutCalendar.scheduledDates, ["2026-10-11", "2026-10-12"]);
  assert.deepEqual(profile.workoutCalendar.monthlyTrainingDates, ["2026-10-11", "2026-10-12"]);
  assert.deepEqual(profile.workoutCalendar.plannedWorkouts, [{ workoutId: "other", date: "2026-10-11" }]);
  assert.equal(profile.workoutCalendar.note, "сохранить");
  assert.equal(profile.workoutCalendar.updatedAt, "NOW");
  assert.deepEqual(profile.subscription, { total: 8, used: 3 });
  assert.deepEqual(result.clientPatch, { workoutCalendar: profile.workoutCalendar });
});

test("слишком большая проверка и отсутствующая программа не превращаются в частичное удаление", async () => {
  const missing = initial(); delete missing["users/client/workouts/day-1"]; delete missing["users/client/workouts/day-2"];
  await reject(missing, {}, { status: 404 });
  const large = initial();
  for (let index = 0; index <= 400; index++) large[`users/client/workouts/new-${index}`] = workout(`new-${index}`);
  await reject(large, {}, { code: "program/verification-limit" });
  const manyHistory = initial();
  for (let index = 0; index <= 10000; index++) manyHistory[`users/client/history/h-${index}`] = { workoutId: "other", assignedProgramId: "other" };
  await reject(manyHistory, {}, { code: "program/verification-limit" });
});

test("HTTP-вход сохраняет проверку сессии/App Check, rate limit и безопасные ошибки", async () => {
  const source = await readFile("functions/index.js", "utf8");
  const handler = source.slice(source.indexOf("export const deleteEmptyClientProgramAssignment ="), source.indexOf("export const setAdminClaim ="));
  assert.match(handler, /requireActiveMember\(req\)/);
  assert.match(handler, /enforceRateLimit\(context\.uid/);
  assert.match(handler, /private, no-store/);
  assert.match(handler, /req\.method !== "POST"/);
  assert.match(handler, /deleteEmptyProgramAssignment\(/);
});
