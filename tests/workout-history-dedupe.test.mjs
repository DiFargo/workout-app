import test from "node:test";
import assert from "node:assert/strict";

import { dedupeWorkoutHistory } from "../src/features/client/workouts/workoutHistoryDedupe.js";

test("dedupeWorkoutHistory keeps one result for the same workout run", () => {
  const history = dedupeWorkoutHistory([
    {
      id: "first-save",
      workoutId: "workout-2",
      assignedProgramUpdatedAt: "assignment-1",
      startedAt: "2026-09-01T19:00:00.000Z",
      finishedAt: "2026-09-01T19:42:00.000Z"
    },
    {
      id: "second-save",
      workoutId: "workout-2",
      assignedProgramUpdatedAt: "assignment-1",
      startedAt: "2026-09-01T19:00:00.000Z",
      finishedAt: "2026-09-01T19:43:00.000Z"
    }
  ]);

  assert.equal(history.length, 1);
  assert.equal(history[0].id, "second-save");
});

test("dedupeWorkoutHistory preserves genuinely separate attempts", () => {
  const history = dedupeWorkoutHistory([
    { id: "morning", workoutId: "workout-2", startedAt: "2026-09-01T08:00:00.000Z" },
    { id: "evening", workoutId: "workout-2", startedAt: "2026-09-01T18:00:00.000Z" }
  ]);

  assert.equal(history.length, 2);
});
