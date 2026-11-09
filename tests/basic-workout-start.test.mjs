import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { getClientWorkoutReadModel } from "../src/utils/clientWorkoutEvidence.js";

const source = (await readFile(new URL("../src/features/client/workouts/workoutOpenHandlers.js", import.meta.url), "utf8"))
  .replace(/^import[\s\S]*?;\r?\n/gm, "")
  .replace("export function createWorkoutOpenHandlers", "function createWorkoutOpenHandlers");

function setup({ rejected = false, offline = false, accessDenied = false, workoutDraftRestorePrompt = null } = {}) {
  const events = [];
  const nextPlan = { id: "new-plan", workouts: [{ id: "new-workout", exercises: [] }] };
  const factory = vm.runInNewContext(`${source}\ncreateWorkoutOpenHandlers`, {
    buildBasicWorkoutPlanFromQuiz: () => nextPlan,
    verifyBasicWorkoutAccess: async () => {
      if (accessDenied) throw new Error("basic_workout_access_required");
      return true;
    },
    syncWorkoutCalendarWithPlan: () => ({}),
    doc: (...parts) => parts,
    writeBatch: () => ({
      set() {}, delete() {},
      async commit() {
        events.push(["commit"]);
        if (rejected) throw new Error("save rejected");
      }
    }),
    safeWriteUserJsonStorage() {},
    getWorkoutReadinessOption: (id) => ({ id }),
    getClientWorkoutReadModel,
    navigator: { onLine: !offline },
    console: { warn() {} }
  });
  const setters = Object.fromEntries([...source.matchAll(/\b(set[A-Z]\w*)\(/g)].map(([, name]) => [
    name, (value) => events.push([name, value])
  ]));
  const handlers = factory({
    ...setters,
    APP_PAGES: { WORKOUTS: "workouts" },
    auth: { currentUser: { uid: "test-user" } }, db: {}, user: {},
    plan: { workouts: [{ id: "old-workout" }] }, history: [],
    workoutDraftRestorePrompt,
    setIndividualWorkoutIndex: (value) => events.push(["setIndividualWorkoutIndex", value]),
    setIndividualWorkoutIndexInitialized() {},
    loadHistory: () => events.push(["loadHistory"])
  });
  return { handlers, events, nextPlan };
}

test("cancelling draft restoration only closes the prompt, without restarting, saving or navigating", async () => {
  const savedDraft = { workoutId: "old-workout", exercises: [{ sets: [{ weight: 110, reps: 12, completed: true }] }] };
  const snapshot = structuredClone(savedDraft);
  const { handlers, events } = setup({ workoutDraftRestorePrompt: { workoutId: "old-workout", savedDraft } });
  await handlers.handleWorkoutDraftChoice(null);
  assert.deepEqual(events, [["setWorkoutDraftRestorePrompt", null]]);
  assert.deepEqual(savedDraft, snapshot);
});

test("save and start opens the newly saved workout in readiness without starting its timer", async () => {
  const { handlers, events, nextPlan } = setup();
  const result = await handlers.applyBasicWorkoutPlan({}, { startWorkout: true });
  assert.equal(result.cloudSaved, true);
  assert.deepEqual(events[0], ["commit"]);
  assert.ok(events.some(([key, value]) => key === "setPlan" && value.workouts === nextPlan.workouts));
  assert.equal(events.findLast(([key]) => key === "setSelectedWorkoutId")[1], "new-workout");
  assert.ok(events.some(([key, value]) => key === "setWorkoutReadinessOpen" && value === true));
  assert.ok(events.some(([key, value]) => key === "setWorkoutStarted" && value === false));
  assert.ok(events.some(([key, value]) => key === "setWorkoutStartedAt" && value === null));
  assert.ok(events.some(([key, value]) => key === "setCurrentExerciseIndex" && value === 0));
});

test("save for later and legacy plan saving do not open readiness or start a timer", async () => {
  for (const options of [undefined, { startWorkout: false }]) {
    const { handlers, events } = setup();
    assert.equal((await handlers.applyBasicWorkoutPlan({}, options)).cloudSaved, true);
    assert.ok(events.some(([key, value]) => key === "setPage" && value === "workouts"));
    assert.equal(events.findLast(([key]) => key === "setSelectedWorkoutId")[1], null);
    assert.equal(events.some(([key]) => key === "setWorkoutReadinessOpen" || key === "setWorkoutStartedAt"), false);
  }
});

test("failed or offline saves never navigate or open a workout", async () => {
  for (const failure of [{ rejected: true }, { offline: true }]) {
    for (const startWorkout of [true, false]) {
      const { handlers, events } = setup(failure);
      assert.equal((await handlers.applyBasicWorkoutPlan({}, { startWorkout })).cloudSaved, false);
      assert.equal(events.some(([key]) => key.startsWith("set")), false);
    }
  }
});

test("missing admin grant prevents basic plan saving and start without changing the assigned plan", async () => {
  for (const startWorkout of [false, true]) {
    const { handlers, events } = setup({ accessDenied: true });
    const result = await handlers.applyBasicWorkoutPlan({}, { startWorkout });
    assert.equal(result.cloudSaved, false);
    assert.equal(result.error.message, "basic_workout_access_required");
    assert.deepEqual(events, []);
  }
});
