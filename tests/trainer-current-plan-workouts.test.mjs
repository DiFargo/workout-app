import test from "node:test";
import assert from "node:assert/strict";

import { filterTrainerCurrentPlanWorkouts } from "../src/features/trainer/trainerCurrentPlanWorkouts.js";

const mixedWorkouts = [
  { id: "basic_1", source: "basic", assignedProgramId: "basic_beginner", assignedProgramUpdatedAt: "basic:2026-01-01" },
  { id: "old_personal_1", assignedProgramId: "personal_old", assignedProgramUpdatedAt: "2026-02-01T10:00:00.000Z" },
  { id: "current_personal_1", assignedProgramId: "personal_current", assignedProgramUpdatedAt: "2026-03-01T10:00:00.000Z" },
  { id: "current_personal_2", assignedProgramId: "personal_current", assignedProgramUpdatedAt: "2026-03-01T10:00:00.000Z" }
];

test("trainer plan keeps only workouts from the current individual assignment", () => {
  const result = filterTrainerCurrentPlanWorkouts(mixedWorkouts, {
    assignedProgramId: "personal_current",
    assignedProgramUpdatedAt: "2026-03-01T10:00:00.000Z"
  });
  assert.deepEqual(result.map((workout) => workout.id), ["current_personal_1", "current_personal_2"]);
});

test("trainer plan keeps the current basic assignment when it is active", () => {
  const result = filterTrainerCurrentPlanWorkouts(mixedWorkouts, {
    assignedProgramId: "basic_beginner",
    assignedProgramUpdatedAt: "basic:2026-01-01"
  });
  assert.deepEqual(result.map((workout) => workout.id), ["basic_1"]);
});

test("program id is used when legacy assignment has no version", () => {
  const result = filterTrainerCurrentPlanWorkouts(mixedWorkouts, { assignedProgramId: "personal_old" });
  assert.deepEqual(result.map((workout) => workout.id), ["old_personal_1"]);
});

test("program id without a client version keeps only its latest assignment", () => {
  const result = filterTrainerCurrentPlanWorkouts([
    { id: "old_completed", status: "completed", assignedProgramId: "same_program", assignedProgramUpdatedAt: "2026-04-01T10:00:00.000Z" },
    { id: "current_only", assignedProgramId: "same_program", assignedProgramUpdatedAt: "2026-05-01T10:00:00.000Z" }
  ], { assignedProgramId: "same_program" });

  assert.deepEqual(result.map((workout) => workout.id), ["current_only"]);
});

test("missing client assignment metadata does not merge historical program versions", () => {
  const result = filterTrainerCurrentPlanWorkouts([
    { id: "history_1", status: "completed", assignedProgramId: "program", assignedProgramUpdatedAt: "2026-05-01T10:00:00.000Z" },
    { id: "history_2", status: "completed", assignedProgramId: "program", assignedProgramUpdatedAt: "2026-06-01T10:00:00.000Z" },
    { id: "current_1", assignedProgramId: "program", assignedProgramUpdatedAt: "2026-07-01T10:00:00.000Z" }
  ]);

  assert.deepEqual(result.map((workout) => workout.id), ["current_1"]);
});

test("individual workouts win over onboarding basics when legacy metadata is absent", () => {
  const result = filterTrainerCurrentPlanWorkouts([mixedWorkouts[0], mixedWorkouts[1]]);
  assert.deepEqual(result.map((workout) => workout.id), ["old_personal_1"]);
});

test("a basic-only plan is preserved", () => {
  const result = filterTrainerCurrentPlanWorkouts([mixedWorkouts[0]]);
  assert.deepEqual(result.map((workout) => workout.id), ["basic_1"]);
});
