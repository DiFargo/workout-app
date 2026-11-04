import test, { after } from "node:test";
import assert from "node:assert/strict";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

let activeHooks;
const cleanupImports = installRuntimeImports({
  react: {
    useState: (...args) => activeHooks.useState(...args),
    useRef: (...args) => activeHooks.useRef(...args),
    useEffect: (...args) => activeHooks.useEffect(...args)
  },
  "/src/firebase.js": { auth: { currentUser: null } }
});
after(cleanupImports);
const { useWorkoutRuntimeEffects } = await import("../src/features/client/workouts/useWorkoutRuntimeEffects.js");

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatch(type) { [...(listeners.get(type) || [])].forEach(callback => callback()); },
    count(type) { return listeners.get(type)?.size || 0; }
  };
}

// A deterministic hook lifecycle exercises the production effect and its real
// storage imports without a DOM, a Firebase session or running timer processes.
function hookDriver(props) {
  const slots = [];
  let cursor = 0;
  let pending = [];
  let dirty = false;
  let value;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = {
        value: initial,
        setter(next) {
          const slot = slots[index];
          const resolved = typeof next === "function" ? next(slot.value) : next;
          if (!Object.is(resolved, slot.value)) { slot.value = resolved; dirty = true; }
        }
      };
      return [slots[index].value, slots[index].setter];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (previous && dependencies?.length === previous.dependencies?.length &&
          dependencies.every((entry, i) => Object.is(entry, previous.dependencies[i]))) return;
      pending.push(() => {
        previous?.cleanup?.();
        slots[index] = { dependencies, cleanup: effect() };
      });
    }
  };
  const renderOnce = () => {
    activeHooks = hooks;
    cursor = 0;
    dirty = false;
    value = useWorkoutRuntimeEffects(props);
    return value;
  };
  const settle = () => {
    for (let count = 0; count < 20; count += 1) {
      const effects = pending;
      pending = [];
      effects.forEach(effect => effect());
      if (!dirty) return value;
      renderOnce();
    }
    throw new Error("Hook did not settle");
  };
  return {
    props,
    renderOnce,
    render() { renderOnce(); return settle(); },
    settle() { if (dirty) renderOnce(); return settle(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
    get value() { return value; }
  };
}

function fixture(run) {
  const originals = new Map(["window", "document", "navigator", "localStorage"].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const originalConsoleError = console.error;
  const storage = new Map();
  const window = eventTarget();
  const document = { ...eventTarget(), visibilityState: "visible" };
  const calls = { writes: 0, intervals: new Set(), errors: [] };
  let nextTimer = 1;
  let writeFailure = null;
  window.setInterval = () => { const id = nextTimer++; calls.intervals.add(id); return id; };
  window.clearInterval = id => calls.intervals.delete(id);
  window.setTimeout = () => nextTimer++;
  window.clearTimeout = () => {};
  const localStorage = {
    get length() { return storage.size; },
    key: index => [...storage.keys()][index] ?? null,
    getItem: key => storage.get(key) ?? null,
    setItem(key, value) {
      calls.writes += 1;
      if (writeFailure) throw Object.assign(new Error("Synthetic storage failure"), { name: writeFailure });
      storage.set(key, String(value));
    },
    removeItem: key => storage.delete(key)
  };
  for (const [key, value] of Object.entries({ window, document, navigator: {}, localStorage })) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  console.error = (...args) => calls.errors.push(args);
  const workout = { id: "day-a", assignedProgramUpdatedAt: "assignment-1", exercises: [{
    id: "exercise-a", clientNote: "Проверить технику", video: "video.mp4", videoPoster: "poster.webp",
    groupId: "superset-a", sets: [{ reps: 12, weight: 30, enteredWeight: "35", enteredReps: "12", completed: true }]
  }] };
  const env = { window, document, storage, calls, validation: "", fail: name => { writeFailure = name; } };
  const noop = () => {};
  const user = { uid: "test-client-a" };
  const props = {
    auth: { currentUser: user }, user, selectedWorkoutId: "day-a", workout,
    plan: { assignedProgramUpdatedAt: "assignment-1", workouts: [workout, { id: "day-b", exercises: [] }] },
    currentExerciseIndex: 0, inlineVideoControlsTimerRef: { current: null }, timerTickRef: { current: 0 },
    workoutStarted: true, isWorkoutSaved: false, workoutStartedAt: 1000, workoutFinishedAt: null,
    workoutReadiness: { id: "good" }, postWorkoutFeedback: null, workoutClientComment: "Комментарий",
    warmupCompletedSteps: [0, 1], warmupTimerDuration: 300, warmupTimerSeconds: 180,
    warmupTimerRunning: false, restTimerDuration: 90, restTimerSeconds: 35, restTimerRunning: false,
    workoutVideoCacheKey: "",
    ...Object.fromEntries(["ExerciseHistoryOpenId", "ExerciseNoteOpenId", "ExerciseTechniqueOpenId",
      "CurrentExerciseIndex", "InlinePlayingVideoId", "InlineVideoControlsVisible", "RestTimerRunning",
      "RestTimerSeconds", "TimerTick", "VideoLoadingId", "WarmupTimerRunning", "WarmupTimerSeconds"]
      .map(name => [`set${name}`, noop])),
    setExerciseValidationMessage: message => { env.validation = message; }
  };
  const driver = hookDriver(props);
  try { run(Object.assign(env, { props, driver })); }
  finally {
    driver.unmount();
    console.error = originalConsoleError;
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test("a successful retry removes the draft warning without clearing a set-input error", () => fixture(env => {
  env.fail("QuotaExceededError");
  assert.match(env.driver.render().workoutDraftSaveWarning, /Не удалось сохранить тренировку/);
  env.props.setExerciseValidationMessage("Укажите число повторов");
  env.fail(null);
  env.window.dispatch("focus");
  assert.equal(env.driver.settle().workoutDraftSaveWarning, "");
  assert.equal(env.validation, "Укажите число повторов");
  assert.ok(env.storage.has("workout_active_draft_v1:test-client-a:day-a"));
}));

test("a real storage failure stays visible when switching exercises or clearing validation", () => fixture(env => {
  env.fail("SecurityError");
  env.driver.render();
  env.props.setExerciseValidationMessage("");
  env.props.currentExerciseIndex = 1;
  assert.match(env.driver.render().workoutDraftSaveWarning, /Не закрывайте приложение/);
  env.props.setExerciseValidationMessage("");
  env.window.dispatch("pageshow");
  assert.match(env.driver.settle().workoutDraftSaveWarning, /Не удалось сохранить/);
}));

test("warning ownership is scoped to the user, workout and started session", () => fixture(env => {
  env.fail("QuotaExceededError");
  env.driver.render();
  env.props.user = { uid: "test-client-b" };
  env.props.auth.currentUser = env.props.user;
  assert.equal(env.driver.renderOnce().workoutDraftSaveWarning, "");
  env.fail(null);
  assert.equal(env.driver.settle().workoutDraftSaveWarning, "");
  env.fail("QuotaExceededError");
  env.props.restTimerSeconds -= 1;
  env.driver.render();
  env.props.selectedWorkoutId = "day-b";
  assert.equal(env.driver.renderOnce().workoutDraftSaveWarning, "");
  env.driver.settle();
  env.props.workoutStartedAt = 2000;
  assert.equal(env.driver.renderOnce().workoutDraftSaveWarning, "");
  assert.match(env.driver.settle().workoutDraftSaveWarning, /Не удалось сохранить/);
}));

test("saved workouts remove the draft, hide the warning and stop autosave listeners", () => fixture(env => {
  env.driver.render();
  env.fail("QuotaExceededError");
  env.window.dispatch("focus");
  assert.match(env.driver.settle().workoutDraftSaveWarning, /Не удалось сохранить/);
  env.props.isWorkoutSaved = true;
  assert.equal(env.driver.renderOnce().workoutDraftSaveWarning, "");
  env.driver.settle();
  assert.equal(env.storage.has("workout_active_draft_v1:test-client-a:day-a"), false);
  const writes = env.calls.writes;
  env.window.dispatch("focus");
  env.window.dispatch("pageshow");
  env.document.dispatch("visibilitychange");
  assert.equal(env.calls.writes, writes);
}));

test("focus/pageshow retry succeeds and unmount removes every autosave listener", () => fixture(env => {
  env.fail("QuotaExceededError");
  env.driver.render();
  const writes = env.calls.writes;
  env.window.dispatch("focus");
  assert.ok(env.calls.writes > writes);
  env.fail(null);
  env.window.dispatch("pageshow");
  assert.equal(env.driver.settle().workoutDraftSaveWarning, "");
  env.driver.unmount();
  const afterUnmount = env.calls.writes;
  env.window.dispatch("focus"); env.window.dispatch("pagehide"); env.window.dispatch("pageshow");
  env.document.dispatch("visibilitychange");
  assert.equal(env.calls.writes, afterUnmount);
  assert.equal(env.window.count("pagehide"), 0);
  assert.equal(env.document.count("visibilitychange"), 0);
  assert.equal(env.calls.intervals.size, 0);
}));

test("the real saved draft excludes even a cyclic read model while preserving entered progress", () => fixture(env => {
  const readModel = { history: "x".repeat(100000) };
  readModel.self = readModel;
  env.props.plan.readModel = readModel;
  assert.equal(env.driver.render().workoutDraftSaveWarning, "");
  const saved = JSON.parse(env.storage.get("workout_active_draft_v1:test-client-a:day-a"));
  assert.equal("readModel" in saved.plan, false);
  assert.equal(saved.plan.workouts.length, 1);
  assert.deepEqual(saved.plan.workouts[0].exercises, env.props.workout.exercises);
  assert.deepEqual(saved.warmupCompletedSteps, [0, 1]);
  assert.equal(saved.workoutStartedAt, 1000);
  assert.equal(saved.restTimerSeconds, 35);
  assert.equal(saved.workoutClientComment, "Комментарий");
  assert.equal(saved.assignmentVersion, "assignment-1");
  assert.equal(env.props.plan.readModel, readModel);
}));

test("a failed write preserves the last good draft rather than replacing it with unsaved state", () => fixture(env => {
  env.driver.render();
  const key = "workout_active_draft_v1:test-client-a:day-a";
  const previous = env.storage.get(key);
  env.fail("SecurityError");
  env.props.currentExerciseIndex = 1;
  assert.match(env.driver.render().workoutDraftSaveWarning, /Не удалось сохранить/);
  assert.equal(env.storage.get(key), previous);
}));
