import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canResumeWorkoutDraft } from "../src/utils/workoutDraftState.js";

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
