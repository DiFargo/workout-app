import test from "node:test";
import assert from "node:assert/strict";
import { getTrainerProgramAssignmentExercises, applyTrainerProgramAssignmentLoadAdjustments } from "../src/utils/trainerProgramAssignmentAdjustment.js";

test("assignment summary spans all program days without changing their individual prescriptions", () => {
  const workouts = [30, 35, 32.5].map((weight, index) => ({ id: `day-${index}`, exercises: [{ id: "press", name: "Жим лёжа", sets: [{ weight, reps: 12 }] }] }));
  const original = structuredClone(workouts);
  const [summary] = getTrainerProgramAssignmentExercises(workouts);
  assert.equal(summary.plannedMinWeight, 30);
  assert.equal(summary.plannedMaxWeight, 35);
  assert.equal(summary.occurrences, 3);
  assert.equal(summary.sourceExercise, workouts[0].exercises[0]);
  const adjusted = applyTrainerProgramAssignmentLoadAdjustments(workouts, { "жим лёжа": "2.5" });
  assert.deepEqual(adjusted.map(day => day.exercises[0].sets[0].weight), ["32.5", "37.5", "35"]);
  assert.deepEqual(workouts, original);
});

test("a later day with actual prescribed weight is not hidden by an empty first occurrence", () => {
  const result = getTrainerProgramAssignmentExercises([{ exercises: [{ name: "Жим", sets: [{ weight: "" }] }] }, { exercises: [{ name: "Жим", sets: [{ weight: 20 }] }] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].usesWeight, true);
  assert.equal(result[0].plannedMinWeight, 20);
  assert.equal(result[0].plannedMaxWeight, 20);
});
