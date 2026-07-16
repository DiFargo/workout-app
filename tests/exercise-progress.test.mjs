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

test("volume and percentage use the same actual completed working sets", () => {
  const result = analyzeExerciseProgress([
    workout("2026-06-12", 20, 12, "8-12", "program-a", 3),
    workout("2026-06-27", 18, 15, "8-12", "program-a", 3)
  ])[0];

  assert.equal(result.previous.volume, 720);
  assert.equal(result.current.volume, 810);
  assert.equal(result.changes.volume, 90);
  assert.equal(result.changes.volumePct, 12.5);
  assert.equal(result.changes.reps, 9);
  assert.equal(result.status, "mixed");
});

test("actual entered values win over the trainer plan", () => {
  const first = workout("2026-06-01", 20, 10);
  const second = workout("2026-06-08", 20, 10);
  second.exercises[0].sets[0] = {
    weight: 20,
    reps: 10,
    enteredWeight: 18,
    enteredReps: 15,
    completed: true
  };

  const result = analyzeExerciseProgress([first, second])[0];
  assert.equal(result.current.bestWeight, 18);
  assert.equal(result.current.totalReps, 15);
  assert.equal(result.current.volume, 270);
});

test("warmup and incomplete sets are excluded from progress volume", () => {
  const first = workout("2026-06-01", 20, 10);
  const second = workout("2026-06-08", 20, 10);
  second.exercises[0].sets.push(
    { weight: 50, reps: 10, completed: true, setType: "warmup" },
    { weight: 50, reps: 10, completed: false, setType: "work" }
  );

  const result = analyzeExerciseProgress([first, second])[0];
  assert.equal(result.current.volume, 200);
  assert.equal(result.current.sets, 1);
});

test("per hand weight convention applies one multiplier consistently", () => {
  const first = workout("2026-06-01", 20, 10);
  const second = workout("2026-06-08", 20, 12);
  first.exercises[0].weightMode = "per_hand";
  second.exercises[0].weightMode = "per_hand";

  const result = analyzeExerciseProgress([first, second])[0];
  assert.equal(result.previous.volume, 400);
  assert.equal(result.current.volume, 480);
  assert.equal(result.current.weightConvention, "per_hand");
});
