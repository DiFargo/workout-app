import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildAssignmentWorkoutDocumentPlan,
  isCompletedAssignedWorkoutDoc
} from "../src/utils/trainerProgramAssignment.js";

test("completed assigned workout documents are protected during reassignment", () => {
  assert.equal(isCompletedAssignedWorkoutDoc({ status: "completed" }), true);
  assert.equal(isCompletedAssignedWorkoutDoc({ status: "completed_off_date" }), true);
  assert.equal(isCompletedAssignedWorkoutDoc({ completedAt: "2026-07-10T12:00:00.000Z" }), true);
  assert.equal(isCompletedAssignedWorkoutDoc({ status: "planned" }), false);
});

test("new assignment keeps completed workout facts and avoids id collisions", () => {
  const replacement = buildAssignmentWorkoutDocumentPlan([
    { id: "day-1", data: () => ({ status: "completed", assignedProgramUpdatedAt: "old-version" }) },
    { id: "day-2", data: () => ({ status: "planned", assignedProgramUpdatedAt: "old-version" }) },
    { id: "legacy-day", data: () => ({ status: "missed", assignedProgramUpdatedAt: "old-version" }) }
  ], [
    { id: "day-1", name: "Push" },
    { id: "day-3", name: "Pull" }
  ], "2026-07-11T10:00:00.000Z");

  assert.equal(replacement.protectedCount, 1);
  assert.deepEqual(replacement.protectedWorkoutIds, ["day-1"]);
  assert.deepEqual(replacement.staleWorkoutDocs.map((item) => item.id), ["day-2", "legacy-day"]);
  assert.equal(replacement.assignedWorkouts[0].originalWorkoutId, "day-1");
  assert.notEqual(replacement.assignedWorkouts[0].id, "day-1");
  assert.equal(replacement.assignedWorkouts[1].id, "day-3");
});

test("client workout loader filters documents from older assignment versions", async () => {
  const source = await readFile("src/features/client/workouts/workoutFirebaseLoadHandlers.js", "utf8");

  assert.match(source, /const workoutAssignmentVersion = String\(data\.assignedProgramUpdatedAt \|\| assignedProgramUpdatedAt \|\| ""\)\.trim\(\);/);
  assert.match(source, /isTrainerProgramClientVisible/);
  assert.match(source, /if \(!isClientVisibleLifecycle\) return;/);
  assert.match(source, /const isCurrentAssignment = !assignedProgramUpdatedAt/);
  assert.match(source, /if \(!isCurrentAssignment\) return;/);
});

test("trainer assignment confirmation explains that completed history is preserved", async () => {
  const source = await readFile("src/features/trainer/trainerProgramTemplateHandlers.js", "utf8");

  assert.match(source, /buildProgramAssignmentConfirmText/);
  assert.match(source, /История выполненных тренировок сохранится/);
  assert.match(source, /Старые плановые удалены/);
  assert.doesNotMatch(source, /полностью\s+удалены/);
});
