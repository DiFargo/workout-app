import assert from "node:assert/strict";
import test from "node:test";

import {
  BASIC_WORKOUT_COMPACT_LIBRARY_COUNT,
  BASIC_WORKOUT_EXERCISE_GROUPS,
  BASIC_WORKOUT_EXERCISE_LIBRARY,
  BASIC_WORKOUT_LIBRARY_SECTIONS,
  BASIC_WORKOUT_PLAN_LIBRARY_COUNT
} from "../src/data/basicWorkoutExerciseLibrary.js";

test("compact client exercise library contains the approved 96 exercises", () => {
  assert.equal(BASIC_WORKOUT_PLAN_LIBRARY_COUNT, 72);
  assert.equal(BASIC_WORKOUT_COMPACT_LIBRARY_COUNT, 96);
  assert.equal(BASIC_WORKOUT_EXERCISE_LIBRARY.length, 96);
  assert.equal(new Set(BASIC_WORKOUT_EXERCISE_LIBRARY.map((exercise) => exercise.id)).size, 96);

  const sectionCounts = Object.fromEntries(
    BASIC_WORKOUT_LIBRARY_SECTIONS.map((section) => [section.id, 0])
  );
  const validGroups = new Set(BASIC_WORKOUT_EXERCISE_GROUPS.map((group) => group.id));

  BASIC_WORKOUT_EXERCISE_LIBRARY.forEach((exercise) => {
    assert.ok(validGroups.has(exercise.groupId), `${exercise.id} needs a valid group`);
    assert.ok(exercise.sectionId in sectionCounts, `${exercise.id} needs a valid section`);
    sectionCounts[exercise.sectionId] += 1;
  });

  assert.deepEqual(sectionCounts, { strength: 72, mobility: 16, cardio: 8 });
});

test("only the compact strength core stays tagged for basic-plan use", () => {
  const automaticPlanExercises = BASIC_WORKOUT_EXERCISE_LIBRARY.filter((exercise) => exercise.planEligible);
  const manualOnlyExercises = BASIC_WORKOUT_EXERCISE_LIBRARY.filter((exercise) => !exercise.planEligible);

  assert.equal(automaticPlanExercises.length, 72);
  assert.ok(automaticPlanExercises.every((exercise) => exercise.sectionId === "strength"));
  assert.equal(manualOnlyExercises.length, 24);
  assert.ok(manualOnlyExercises.every((exercise) => (
    exercise.sectionId === "mobility" || exercise.sectionId === "cardio"
  )));
  assert.ok(manualOnlyExercises.every((exercise) => /^[A-Za-z0-9_-]+$/u.test(exercise.sourceId)));
});
