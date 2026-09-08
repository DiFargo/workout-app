import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = (await readFile(new URL("../src/features/client/workouts/workoutOpenHandlers.js", import.meta.url), "utf8"))
  .replace(/^import[\s\S]*?;\r?\n/gm, "")
  .replace("export function createWorkoutOpenHandlers", "function createWorkoutOpenHandlers");

function setup({ rejected = false, offline = false } = {}) {
  const events = [];
  const nextPlan = { id: "new-plan", workouts: [{ id: "new-workout", exercises: [] }] };
  const factory = vm.runInNewContext(`${source}\ncreateWorkoutOpenHandlers`, {
    buildBasicWorkoutPlanFromQuiz: () => nextPlan,
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
    setIndividualWorkoutIndex: (value) => events.push(["setIndividualWorkoutIndex", value]),
    setIndividualWorkoutIndexInitialized() {},
    loadHistory: () => events.push(["loadHistory"])
  });
  return { handlers, events, nextPlan };
}

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
