import assert from "node:assert/strict";
import test from "node:test";

import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../src/data/basicWorkoutExerciseLibrary.js";
import {
  getBasicWorkoutExercisePresentation,
  getBasicWorkoutLibraryExercise
} from "../src/utils/basicWorkoutExercisePresentation.js";

test("every basic exercise retains a resolvable equipment presentation", () => {
  for (const exercise of BASIC_WORKOUT_EXERCISE_LIBRARY) {
    const libraryExercise = getBasicWorkoutLibraryExercise(exercise);
    const presentation = getBasicWorkoutExercisePresentation(exercise);

    assert.equal(libraryExercise?.id, exercise.id, `${exercise.id} should resolve to its library record`);
    assert.ok(presentation.equipment, `${exercise.id} should retain equipment`);
    assert.ok(presentation.equipmentType, `${exercise.id} should resolve an equipment type`);
  }
});

test("lying leg curl keeps its own equipment and movement group", () => {
  const exercise = BASIC_WORKOUT_EXERCISE_LIBRARY.find((item) => item.id === "leg_curl");
  const presentation = getBasicWorkoutExercisePresentation(exercise);

  assert.equal(presentation.equipmentType, "machine");
  assert.equal(presentation.groupId, "posterior_chain");
});
