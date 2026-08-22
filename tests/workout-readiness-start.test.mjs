import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const DIALOG_PATH = new URL("../src/components/workout/WorkoutDialogs.jsx", import.meta.url);
const OPEN_HANDLER_PATH = new URL("../src/features/client/workouts/workoutOpenHandlers.js", import.meta.url);

test("a new workout has a ready-to-continue default readiness option", async () => {
  const dialogSource = await readFile(DIALOG_PATH, "utf8");
  const openHandlerSource = await readFile(OPEN_HANDLER_PATH, "utf8");

  assert.match(dialogSource, /const selectedOption = pendingOption \|\| getWorkoutReadinessOption\("good"\)/);
  assert.match(dialogSource, /onClick=\{\(\) => onApply\(selectedOption\)\}/);
  assert.match(openHandlerSource, /:\s*getWorkoutReadinessOption\("good"\)/);
});
