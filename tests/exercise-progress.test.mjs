import test from "node:test";
import assert from "node:assert/strict";
import { analyzeExerciseProgress } from "../src/utils/exerciseProgress.js";

function workout(date, weight, reps, targetReps = "8-10", programId = "program-a", sets = 1) {
  return {
    date,
    assignedProgramId: programId,
    exercises: [{
      name: "Жим лёжа",
      sets: Array.from({ length: sets }, () => ({
        weight,
        reps,
        targetReps,
        completed: true
      }))
    }]
  };
}

test("changed rep range is treated as program adaptation, not regression", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-01", 20, 10, "8-10"),
    workout("2026-06-08", 18, 12, "10-12")
  ])[0];

  assert.equal(result.status, "adaptation");
  assert.match(result.explanation, /диапазон повторений изменён/);
});

test("more reps at the same weight is progress", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-01", 20, 10),
    workout("2026-06-08", 20, 12)
  ])[0];

  assert.equal(result.status, "progress");
  assert.ok(result.changes.e1rmPct > 0);
});

test("more weight at the same reps is progress", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-01", 20, 10),
    workout("2026-06-08", 22.5, 10)
  ])[0];

  assert.equal(result.status, "progress");
  assert.equal(result.changes.weight, 2.5);
});

test("lower weight and reps without a program change is possible regression", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-01", 20, 10),
    workout("2026-06-08", 18, 8)
  ])[0];

  assert.equal(result.status, "regression");
});

test("additional completed set increases total training volume", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-01", 20, 10, "8-10", "program-a", 2),
    workout("2026-06-08", 20, 10, "8-10", "program-a", 3)
  ])[0];

  assert.equal(result.status, "progress");
  assert.equal(result.previous.volume, 400);
  assert.equal(result.current.volume, 600);
});
