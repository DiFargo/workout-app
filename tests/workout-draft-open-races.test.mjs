import test, { after } from "node:test";
import assert from "node:assert/strict";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { advanceAuthSession } from "../src/utils/authSession.js";

let activeStorage;
const cleanupImports = installRuntimeImports({
  "firebase/firestore": {
    doc: () => assert.fail("Открытие тренировки не должно вызывать Firestore"),
    writeBatch: () => assert.fail("Открытие тренировки не должно вызывать Firestore")
  },
  "/src/firebase.js": { auth: { currentUser: null } },
  "/utils/workoutDraftStorage.js": {
    readWorkoutDraft: (uid, workoutId) => activeStorage.read(uid, workoutId),
    clearWorkoutDraft: (uid, workoutId) => activeStorage.cleared.push({ uid, workoutId })
  }
});
after(cleanupImports);
const { createWorkoutOpenHandlers } = await import("../src/features/client/workouts/workoutOpenHandlers.js");

function fixture() {
  const auth = { currentUser: { uid: "draft-client" } };
  const plan = {
    assignedProgramUpdatedAt: "assignment-1",
    workouts: ["day-a", "day-b", "completed-day"].map(id => ({
      id, name: id, assignedProgramUpdatedAt: "assignment-1",
      status: id === "completed-day" ? "completed" : "planned",
      exercises: [{ id: `${id}-exercise`, sets: [{ reps: 12, weight: 30 }] }]
    }))
  };
  const workoutOpenContextRef = { current: { request: 0, plan, page: "workouts" } };
  const calls = { reads: [], cleared: [], setters: [], readErrors: 0, history: 0 };
  activeStorage = {
    cleared: calls.cleared,
    read(uid, workoutId) {
      return new Promise((resolve, reject) => calls.reads.push({ uid, workoutId, resolve, reject }));
    }
  };
  const setters = Object.fromEntries([
    "Plan", "SelectedWorkoutId", "OpenVideoId", "FullscreenVideo", "CurrentExerciseIndex",
    "WorkoutStarted", "WorkoutStartedAt", "WorkoutFinishedAt", "WorkoutReadiness",
    "WorkoutReadinessPending", "WarmupCompletedSteps", "WarmupTimerDuration", "WarmupTimerSeconds",
    "WarmupTimerRunning", "RestTimerDuration", "RestTimerSeconds", "RestTimerRunning",
    "ExerciseHistoryOpenId", "WorkoutHistorySyncState", "WorkoutExitPromptOpen", "PostWorkoutFeedback",
    "PostWorkoutFeedbackOpen", "WorkoutReadinessOpen", "IsWorkoutSaved", "WorkoutClientComment",
    "ShowWorkoutSavedCard", "WorkoutDraftRestorePrompt", "Page"
  ].map(name => [`set${name}`, value => calls.setters.push({ name, value })]));
  const createHandlers = () => createWorkoutOpenHandlers({
    ...setters, auth, user: auth.currentUser, plan: workoutOpenContextRef.current.plan,
    history: [], APP_PAGES: { HISTORY: "history" }, workoutOpenContextRef,
    onDraftReadError: () => { calls.readErrors += 1; },
    loadHistory: () => { calls.history += 1; }
  });
  const draft = (workoutId = "day-a") => ({
    uid: "draft-client", workoutId, assignmentVersion: "assignment-1",
    savedAt: "2026-10-31T10:00:00.000Z", workoutStartedAt: 1000,
    plan: { ...plan, workouts: [plan.workouts.find(workout => workout.id === workoutId)] }
  });
  return { auth, plan, calls, workoutOpenContextRef, createHandlers, draft };
}

function assertNoOpenEffects(env) {
  assert.deepEqual(env.calls.setters, []);
  assert.deepEqual(env.calls.cleared, []);
  assert.equal(env.calls.history, 0);
  assert.equal(env.calls.readErrors, 0);
}

test("открытие: поздний draft A не перекрывает открытие B через новую render-фабрику", async () => {
  const env = fixture();
  const first = env.createHandlers().openWorkout("day-a");
  const second = env.createHandlers().openWorkout("day-b");
  assert.deepEqual(env.calls.reads.map(({ uid, workoutId }) => ({ uid, workoutId })), [
    { uid: "draft-client", workoutId: "day-a" }, { uid: "draft-client", workoutId: "day-b" }
  ]);
  env.calls.reads[1].resolve(null);
  await second;
  const afterSecondOpen = structuredClone(env.calls.setters);

  env.calls.reads[0].resolve(env.draft());
  await first;

  assert.deepEqual(env.calls.setters, afterSecondOpen);
  assert.deepEqual(env.calls.setters.filter(call => call.name === "SelectedWorkoutId"), [{ name: "SelectedWorkoutId", value: "day-b" }]);
  assert.equal(env.calls.setters.some(call => call.name === "WorkoutDraftRestorePrompt"), false);
  assert.equal(env.calls.readErrors, 0);
});

test("открытие: поздняя ошибка A не публикуется после нового запроса B", async () => {
  const env = fixture();
  const first = env.createHandlers().openWorkout("day-a");
  const second = env.createHandlers().openWorkout("day-b");
  const savedDraft = env.draft("day-b");
  env.calls.reads[1].resolve(savedDraft);
  await second;
  env.calls.reads[0].reject(new Error("workout_draft_fallback_unavailable"));
  await first;

  assert.deepEqual(env.calls.setters, [{ name: "WorkoutDraftRestorePrompt", value: { workoutId: "day-b", savedDraft } }]);
  assert.equal(env.calls.readErrors, 0);
});

for (const change of ["plan", "page"]) {
  test(`открытие: смена ${change} отменяет отложенное восстановление без очистки черновика`, async () => {
    const env = fixture();
    const opening = env.createHandlers().openWorkout("day-a");
    if (change === "plan") {
      env.workoutOpenContextRef.current.plan = { ...env.plan, assignedProgramUpdatedAt: "assignment-2" };
    } else {
      env.workoutOpenContextRef.current.page = "nutrition";
    }
    env.createHandlers();
    env.calls.reads[0].resolve(env.draft());
    await opening;
    assertNoOpenEffects(env);
  });
}

for (const change of ["UID", "auth-сессии того же UID"]) {
  for (const outcome of ["успех", "ошибка"]) {
    test(`открытие: отложенный ответ (${outcome}) после смены ${change} не открывает тренировку и не сообщает старую ошибку`, async () => {
      const env = fixture();
      const opening = env.createHandlers().openWorkout("day-a");
      if (change === "UID") env.auth.currentUser = { uid: "other-client" };
      advanceAuthSession(env.auth);
      if (outcome === "успех") env.calls.reads[0].resolve(env.draft());
      else env.calls.reads[0].reject(new Error("workout_draft_fallback_unavailable"));
      await opening;
      assertNoOpenEffects(env);
    });
  }
}

test("открытие: недоступное чтение сообщает ошибку и не начинает новую или старую тренировку", async () => {
  const env = fixture();
  const opening = env.createHandlers().openWorkout("day-a");
  env.calls.reads[0].reject(new Error("workout_draft_fallback_unavailable"));
  await opening;

  assert.equal(env.calls.readErrors, 1);
  assert.deepEqual(env.calls.setters, []);
  assert.deepEqual(env.calls.cleared, []);
  assert.equal(env.calls.history, 0);

  const retry = env.createHandlers().openWorkout("day-a");
  const savedDraft = env.draft();
  env.calls.reads[1].resolve(savedDraft);
  await retry;
  assert.deepEqual(env.calls.setters, [{ name: "WorkoutDraftRestorePrompt", value: { workoutId: "day-a", savedDraft } }]);
  assert.equal(env.calls.readErrors, 1);
});

test("открытие: завершённый день синхронно открывает историю и отменяет предыдущий async-запрос", async () => {
  const env = fixture();
  const first = env.createHandlers().openWorkout("day-a");
  const completed = env.createHandlers().openWorkout("completed-day");
  // These effects must already exist before awaiting the returned promise.
  assert.deepEqual(env.calls.setters, [{ name: "Page", value: "history" }]);
  assert.deepEqual(env.calls.cleared, [{ uid: "draft-client", workoutId: "completed-day" }]);
  assert.equal(env.calls.history, 1);
  assert.equal(env.calls.reads.length, 1);

  env.calls.reads[0].resolve(env.draft());
  await Promise.all([first, completed]);
  assert.deepEqual(env.calls.setters, [{ name: "Page", value: "history" }]);
  assert.equal(env.calls.readErrors, 0);
});
