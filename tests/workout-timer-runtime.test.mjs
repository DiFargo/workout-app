import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("workout elapsed timer synchronizes to wall-clock time after the app returns to foreground", async () => {
  const source = await readFile(new URL("../src/features/client/workouts/useWorkoutRuntimeEffects.js", import.meta.url), "utf8");
  const derivedState = await readFile(new URL("../src/utils/workoutPageDerivedState.js", import.meta.url), "utf8");

  assert.match(source, /const syncElapsedTimer = \(\) => \{/);
  assert.match(source, /if \(document\.visibilityState === "hidden"\) return;/);
  assert.match(source, /document\.addEventListener\("visibilitychange", syncElapsedTimer\)/);
  assert.match(source, /window\.addEventListener\("focus", syncElapsedTimer\)/);
  assert.match(source, /window\.addEventListener\("pageshow", syncElapsedTimer\)/);
  assert.match(source, /document\.removeEventListener\("visibilitychange", syncElapsedTimer\)/);
  assert.match(derivedState, /formatWorkoutElapsedDuration\(workoutStartedAt, workoutFinishedAt \|\| timerTick\)/);
});
