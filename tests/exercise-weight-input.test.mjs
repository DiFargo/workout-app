import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeExerciseSetPatch,
  sanitizeExerciseWeightInput
} from "../src/utils/exerciseWeightInput.js";

test("exercise weight input clears a negative weight", () => {
  assert.equal(sanitizeExerciseWeightInput("-5"), "");
  assert.equal(sanitizeExerciseWeightInput(" − 12.5"), "");
  assert.equal(sanitizeExerciseWeightInput(-20), "");
});

test("exercise weight input preserves valid planned-weight formats", () => {
  assert.equal(sanitizeExerciseWeightInput("60"), "60");
  assert.equal(sanitizeExerciseWeightInput("20-25"), "20-25");
  assert.equal(sanitizeExerciseWeightInput("12,5"), "12,5");
});

test("exercise set patch only sanitizes the planned weight", () => {
  assert.deepEqual(
    sanitizeExerciseSetPatch({ weight: "-40", reps: "8" }),
    { weight: "", reps: "8" }
  );
  assert.deepEqual(sanitizeExerciseSetPatch({ reps: "8" }), { reps: "8" });
});
