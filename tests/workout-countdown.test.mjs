import test from "node:test";
import assert from "node:assert/strict";

import {
  createWorkoutCountdownDeadline,
  getWorkoutCountdownRemainingSeconds
} from "../src/features/client/workouts/workoutCountdownTimer.js";

test("workout countdown uses a wall-clock deadline when the app returns from the background", () => {
  const startedAt = 1_000_000;
  const deadline = createWorkoutCountdownDeadline(90, startedAt);

  assert.equal(deadline, startedAt + 90_000);
  assert.equal(getWorkoutCountdownRemainingSeconds(deadline, startedAt + 30_250), 60);
  assert.equal(getWorkoutCountdownRemainingSeconds(deadline, startedAt + 90_001), 0);
});

test("workout countdown ignores missing and expired deadlines", () => {
  assert.equal(createWorkoutCountdownDeadline(0, 1_000), 0);
  assert.equal(getWorkoutCountdownRemainingSeconds(0, 1_000), 0);
  assert.equal(getWorkoutCountdownRemainingSeconds(999, 1_000), 0);
});
