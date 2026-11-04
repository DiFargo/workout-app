import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { canResumeWorkoutDraft, createWorkoutDraftPlan, restoreWorkoutDraftPlan } from "../src/utils/workoutDraftState.js";

const workout = { id: "basic-1", assignedProgramUpdatedAt: "program-1" };
const draft = { workoutId: "basic-1", plan: { workouts: [workout] }, assignmentVersion: "program-1" };

test("a completed workout cannot be resumed from a stale device draft", () => {
  assert.equal(canResumeWorkoutDraft(draft, workout, "program-1", true), false);
  assert.equal(canResumeWorkoutDraft(draft, workout, "program-1", false), true);
});

test("draft restoration requires a matching workout, plan and assignment", () => {
  assert.equal(canResumeWorkoutDraft({ ...draft, assignmentVersion: "old" }, workout), false);
  assert.equal(canResumeWorkoutDraft({ ...draft, workoutId: "another" }, workout), false);
  assert.equal(canResumeWorkoutDraft({ ...draft, plan: null }, workout), false);
  assert.equal(canResumeWorkoutDraft(null, workout), false);
  assert.equal(canResumeWorkoutDraft({ workoutId: "legacy", plan: {} }, { id: "legacy" }), true);
});

test("a workout draft stores only the active workout without the editor snapshot", () => {
  const active = { ...workout, _editorSnapshot: "large editor-only snapshot", exercises: [{ id: "exercise", sets: [{ completed: true, enteredWeight: "35", enteredReps: "12" }] }] };
  const plan = { assignedProgramUpdatedAt: "program-1", workouts: [active, { id: "next" }] };
  const saved = createWorkoutDraftPlan(plan, active.id);
  assert.equal(saved.workouts.length, 1);
  assert.equal("_editorSnapshot" in saved.workouts[0], false);
  assert.deepEqual(saved.workouts[0].exercises, active.exercises);
  assert.equal(createWorkoutDraftPlan(plan, "missing"), null);
  assert.equal(plan.workouts.length, 2);
});

test("restoration keeps the current program and restores only the active workout entries", () => {
  const other = { id: "next", name: "Fresh trainer changes", exercises: [{ id: "new" }] };
  const plan = { name: "Current program", workouts: [{ ...workout, name: "Current title", exercises: [] }, other] };
  const saved = { ...draft, plan: { name: "Old title", workouts: [{ ...workout, exercises: [{ sets: [{ completed: true, enteredWeight: "35" }] }] }, { id: "next", name: "Old version" }] } };
  const restored = restoreWorkoutDraftPlan(plan, saved);
  assert.equal(restored.name, "Current program");
  assert.equal(restored.workouts[0].name, "Current title");
  assert.equal(restored.workouts[0].exercises[0].sets[0].enteredWeight, "35");
  assert.equal(restored.workouts[1], other);
  assert.equal(restoreWorkoutDraftPlan(plan, { workoutId: "missing", plan: {} }), plan);
});

test("reassigning a workout while its restoration prompt is open rejects the stale entries", () => {
  const reassignedPlan = { assignedProgramUpdatedAt: "program-2", workouts: [{ ...workout, assignedProgramUpdatedAt: "program-2", exercises: [] }] };
  assert.equal(restoreWorkoutDraftPlan(reassignedPlan, draft), reassignedPlan);
});

test("assignment cache cleanup preserves matching and basic drafts on a cold start", async () => {
  const source = (await readFile(new URL("../src/utils/workoutDraftStorage.js", import.meta.url), "utf8"))
    .replace(/^import[\s\S]*?;\r?\n/gm, "").replaceAll("export function", "function").replaceAll("export async function", "async function");
  for (const previousVersion of [null, "old-program"]) {
    const storage = new Map();
    const key = id => `workout_active_draft_v1:user:${id}`;
    const current = { id: "today", assignedProgramUpdatedAt: "program-1" };
    const matching = { workoutId: "today", assignmentVersion: "program-1", plan: { workouts: [current] } };
    const basic = { workoutId: "basic", assignmentVersion: "basic:123", plan: { source: "basic", workouts: [] } };
    storage.set(key("today"), JSON.stringify(matching));
    storage.set(key("basic"), JSON.stringify(basic));
    storage.set(key("old"), JSON.stringify({ workoutId: "old", assignmentVersion: "old-program", plan: { workouts: [{ id: "old", assignedProgramUpdatedAt: "old-program" }] } }));
    storage.set("workout_active_draft_v1:other:today", "keep another user");
    const clear = vm.runInNewContext(`${source}\nclearStaleWorkoutCaches`, {
      localStorage: { get length() { return storage.size; }, key: index => [...storage.keys()][index], removeItem: key => storage.delete(key) },
      getUserScopedStorageKey: (base, uid) => `${base}:${uid}`,
      safeReadUserJsonStorage: () => previousVersion,
      safeWriteUserJsonStorage() {},
      safeReadJsonStorage: key => JSON.parse(storage.get(key) || "null"),
      canResumeWorkoutDraft
    });
    clear("user", "program-1", { workouts: [current] });
    assert.deepEqual(JSON.parse(storage.get(key("today"))), matching);
    assert.deepEqual(JSON.parse(storage.get(key("basic"))), basic);
    assert.equal(storage.has(key("old")), false);
    assert.equal(storage.get("workout_active_draft_v1:other:today"), "keep another user");
  }
});

test("saving stops draft autosave and clears the phone's persisted draft", async () => {
  const source = await readFile(new URL("../src/features/client/workouts/useWorkoutRuntimeEffects.js", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/AppCore.jsx", import.meta.url), "utf8");
  assert.match(source, /if \(isWorkoutSaved\) \{\s*clearWorkoutDraft\(currentUser.uid, selectedWorkoutId\);\s*return;/);
  assert.match(source, /selectedWorkoutId,\s*isWorkoutSaved,\s*currentExerciseIndex/);
  assert.match(source, /window.removeEventListener\("pagehide", writeDraft\)/);
  assert.match(app, /useWorkoutRuntimeEffects\(\{[\s\S]*?isWorkoutSaved,/);
});

test("saved workout navigation cannot reset the completion state", async () => {
  const source = await readFile(new URL("../src/features/client/workouts/workoutRunNavigationHandlers.js", import.meta.url), "utf8");
  assert.match(source, /function goToPreviousExercise\(\) \{\s*if \(!workout \|\| isWorkoutSaved\) return;/);
  assert.match(source, /function goToNextExercise\(\) \{\s*if \(!workout \|\| isWorkoutSaved\) return;/);
});
