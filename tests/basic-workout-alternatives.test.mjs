import test from "node:test";
import assert from "node:assert/strict";

import {
  getBasicWorkoutAlternatives,
  getBasicWorkoutExerciseGroup,
  replaceBasicWorkoutExerciseInPlan
} from "../src/utils/basicWorkoutAlternatives.js";
import {
  BASIC_WORKOUT_EXERCISE_GROUPS,
  BASIC_WORKOUT_EXERCISE_LIBRARY
} from "../src/data/basicWorkoutExerciseLibrary.js";
import { getBasicWorkoutLibraryExercise } from "../src/utils/basicWorkoutExercisePresentation.js";
import { getBasicWorkoutMannequinIllustrationSource } from "../src/utils/basicWorkoutMannequinIllustration.js";

test("basic workout exercise library covers the main movement groups", () => {
  assert.equal(BASIC_WORKOUT_EXERCISE_LIBRARY.length, 96);
  assert.deepEqual(
    BASIC_WORKOUT_EXERCISE_GROUPS.map((group) => group.id),
    [
      "quads",
      "posterior_chain",
      "calves",
      "vertical_pull",
      "horizontal_pull",
      "chest_press",
      "chest_incline",
      "chest_fly",
      "shoulder_press",
      "side_delts",
      "rear_delts",
      "biceps",
      "triceps",
      "core",
      "mobility",
      "cardio"
    ]
  );
});

test("basic workout alternatives match the movement and exclude duplicate exercises", () => {
  const exercise = { id: "leg_press", name: "Жим ногами" };
  const alternatives = getBasicWorkoutAlternatives(exercise, {
    exercises: [
      exercise,
      { id: "goblet", name: "Гоблет-присед с гантелью" }
    ]
  });

  assert.ok(alternatives.length > 0);
  assert.equal(alternatives.some((item) => item.name === "Жим ногами"), false);
  assert.equal(alternatives.some((item) => item.name === "Гоблет-присед с гантелью"), false);
  assert.ok(alternatives.every((item) => item.groupId === "quads"));
  assert.ok(alternatives.every((item) => item.groupTitle === "Ноги · передняя поверхность"));
});

test("basic workout alternatives preserve the movement group for AI exercise names", () => {
  const exercise = { id: "ai_bench", name: "Жим штанги от груди лёжа" };
  const group = getBasicWorkoutExerciseGroup(exercise);
  const alternatives = getBasicWorkoutAlternatives(exercise, { exercises: [exercise] });

  assert.equal(group?.id, "chest_press");
  assert.equal(alternatives.length, 3);
  assert.ok(alternatives.every((item) => item.groupId === "chest_press"));
  assert.ok(alternatives.every((item) => item.name !== "Жим штанги лёжа"));
});

test("trainer exercise snapshots infer a basic movement group from muscleGroup", () => {
  assert.equal(
    getBasicWorkoutExerciseGroup({
      id: "trainer-custom-back-exercise",
      name: "Авторская тяга тренера",
      muscleGroup: "Широчайшие мышцы спины"
    })?.id,
    "vertical_pull"
  );
  assert.equal(
    getBasicWorkoutExerciseGroup({
      id: "trainer-custom-triceps-exercise",
      name: "Авторское разгибание тренера",
      muscleGroup: "Трицепс"
    })?.id,
    "triceps"
  );
});

test("basic workout alternatives prioritise familiar beginner-friendly movements", () => {
  const bench = { id: "bench", name: "Жим штанги лёжа" };
  const posteriorChain = { id: "rdl", name: "Румынская тяга" };

  assert.deepEqual(
    getBasicWorkoutAlternatives(bench, { exercises: [bench] }).map((item) => item.name),
    ["Жим от груди в тренажёре", "Жим гантелей лёжа", "Отжимания от высокой опоры"]
  );
  assert.deepEqual(
    getBasicWorkoutAlternatives(posteriorChain, { exercises: [posteriorChain] }).map((item) => item.name),
    ["Ягодичный мост", "Сгибание ног лёжа в тренажёре", "Гиперэкстензия"]
  );
});

test("basic workout alternatives keep the original exercise available after a replacement", () => {
  const replacement = {
    id: "bm2_bench",
    name: "Жим от груди в тренажёре",
    replacementOf: "Жим лёжа",
    basicExerciseGroupId: "chest_press"
  };

  const alternatives = getBasicWorkoutAlternatives(replacement, { exercises: [replacement] });

  assert.equal(alternatives[0]?.id, "barbell_bench_press");
  assert.equal(alternatives[0]?.name, "Жим штанги лёжа");
});

test("basic workout alternatives safely ignore an empty workout stage", () => {
  assert.equal(getBasicWorkoutExerciseGroup(null), null);
  assert.deepEqual(getBasicWorkoutAlternatives(null, { exercises: [] }), []);
});

test("basic exercise replacement keeps the plan structure and resets completed sets", () => {
  const plan = {
    source: "basic",
    workouts: [{
      id: "basic_day_1",
      exercises: [{
        id: "leg_press",
        name: "Жим ногами",
        basicExerciseId: "leg_press",
        basicExerciseLibraryId: "leg_press",
        sourceId: "Leg_Press",
        sets: [{ reps: 12, weight: "60", completed: true, enteredWeight: "65", enteredReps: "12" }]
      }]
    }]
  };
  const { plan: nextPlan, replacement } = replaceBasicWorkoutExerciseInPlan(
    plan,
    "basic_day_1",
    "leg_press",
    {
      id: "goblet_squat",
      name: "Гоблет-присед с гантелью",
      rest: "90 сек",
      requiresWeight: true,
      equipment: "Гантель",
      groupId: "quads",
      groupTitle: "Ноги · передняя поверхность"
    }
  );

  assert.equal(replacement.id, "leg_press");
  assert.equal(replacement.name, "Гоблет-присед с гантелью");
  assert.equal(replacement.replacementOf, "Жим ногами");
  assert.equal(replacement.basicExerciseId, "goblet_squat");
  assert.equal(replacement.basicExerciseLibraryId, "goblet_squat");
  assert.equal(replacement.sourceId, "");
  assert.equal(getBasicWorkoutLibraryExercise(replacement)?.id, "goblet_squat");
  assert.equal(
    getBasicWorkoutMannequinIllustrationSource(replacement),
    "/basic-workout/exercises/mannequin/goblet_squat.png"
  );
  assert.equal(replacement.basicExerciseGroupId, "quads");
  assert.equal(replacement.equipment, "Гантель");
  assert.deepEqual(replacement.sets, [{ reps: 12, weight: "60", completed: false, enteredReps: "", enteredWeight: "" }]);
  assert.equal(nextPlan.workouts[0].exercises[0].id, "leg_press");
});
