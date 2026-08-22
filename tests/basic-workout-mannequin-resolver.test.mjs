import assert from "node:assert/strict";
import test from "node:test";

import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../src/data/basicWorkoutExerciseLibrary.js";
import {
  getBasicWorkoutExercisePresentation,
  getBasicWorkoutLibraryExercise
} from "../src/utils/basicWorkoutExercisePresentation.js";
import {
  getBasicWorkoutGroupIllustrationSource,
  getBasicWorkoutMannequinIllustrationSource
} from "../src/utils/basicWorkoutMannequinIllustration.js";

function getExpectedIllustrationSource(exercise) {
  if (exercise.sourceId) {
    return `/basic-workout/exercises/catalogue/v1/${exercise.sourceId}.webp`;
  }

  return `/basic-workout/exercises/mannequin/${exercise.illustrationId || exercise.id}.png`;
}

test("every compact-library exercise resolves to its individual illustration", () => {
  for (const exercise of BASIC_WORKOUT_EXERCISE_LIBRARY) {
    assert.equal(
      getBasicWorkoutMannequinIllustrationSource(exercise, getBasicWorkoutExercisePresentation(exercise)),
      getExpectedIllustrationSource(exercise)
    );
  }
});

test("full catalogue records resolve to their individual, cacheable WebP illustration", () => {
  assert.equal(
    getBasicWorkoutMannequinIllustrationSource({ sourceId: "Ab_Crunch_Machine" }),
    "/basic-workout/exercises/catalogue/v1/Ab_Crunch_Machine.webp"
  );
});

test("saved exercises without a library id keep the mannequin from their muscle group", () => {
  const exercise = { id: "saved-basic-exercise", name: "Неизвестное упражнение", groupId: "biceps" };
  const source = getBasicWorkoutMannequinIllustrationSource(exercise, { groupId: "biceps" });

  assert.match(source, /^\/basic-workout\/exercises\/mannequin\/.+\.png$/);
  assert.doesNotMatch(source, /\/illustrations\/|\.webp$/);
});

test("trainer snapshots resolve their exact library illustration through libraryExerciseId", () => {
  const trainerExercise = {
    id: "trainer-assigned-exercise",
    libraryExerciseId: "machine_chest_press",
    name: "Авторский жим для клиента"
  };

  assert.equal(getBasicWorkoutLibraryExercise(trainerExercise)?.id, "machine_chest_press");
  assert.equal(
    getBasicWorkoutMannequinIllustrationSource(trainerExercise),
    "/basic-workout/exercises/mannequin/machine_chest_press.png"
  );
  assert.equal(
    getBasicWorkoutGroupIllustrationSource(trainerExercise),
    "/basic-workout/illustrations/chest-press.webp"
  );
});

test("custom trainer exercises use their stored muscle group for the muscle illustration", () => {
  const trainerExercise = {
    id: "trainer-custom-chest-exercise",
    name: "Авторское упражнение тренера",
    muscleGroup: "Грудные мышцы"
  };

  assert.equal(
    getBasicWorkoutGroupIllustrationSource(trainerExercise),
    "/basic-workout/illustrations/chest-press.webp"
  );
});

test("an unknown trainer exercise never receives another movement's illustration", () => {
  const trainerExercise = {
    id: "trainer-unknown-exercise",
    name: "Уникальное движение без указанной группы"
  };

  assert.equal(getBasicWorkoutGroupIllustrationSource(trainerExercise), "");
  assert.equal(getBasicWorkoutMannequinIllustrationSource(trainerExercise), "");
});

test("legacy bench press names use the barbell bench press mannequin", () => {
  assert.equal(
    getBasicWorkoutMannequinIllustrationSource({ id: "bm2_bench", name: "Жим лёжа" }),
    "/basic-workout/exercises/mannequin/barbell_bench_press.png"
  );
});

test("saved replacements override stale exercise ids and illustration sources", () => {
  const replacedExercise = {
    id: "leg_press",
    basicExerciseId: "leg_press",
    basicExerciseLibraryId: "leg_press",
    sourceId: "Leg_Press",
    replacementId: "goblet_squat",
    name: "Гоблет-присед с гантелью"
  };

  assert.equal(getBasicWorkoutLibraryExercise(replacedExercise)?.id, "goblet_squat");
  assert.equal(
    getBasicWorkoutMannequinIllustrationSource(replacedExercise),
    "/basic-workout/exercises/mannequin/goblet_squat.png"
  );
});

test("common saved AI exercise names never fall back to another movement's mannequin", () => {
  const cases = [
    ["Подтягивания", "pull_up.png"],
    ["Подтягивания широким хватом", "pull_up.png"],
    ["Становая тяга", "deadlift.png"],
    ["Классическая становая тяга", "deadlift.png"],
    ["Отжимания", "pushup.png"]
  ];

  cases.forEach(([name, asset]) => {
    assert.equal(
      getBasicWorkoutMannequinIllustrationSource({ id: `saved_${name}`, name }),
      `/basic-workout/exercises/mannequin/${asset}`
    );
  });
});

test("every catalogue name and alias resolves to its own individual mannequin", () => {
  BASIC_WORKOUT_EXERCISE_LIBRARY.forEach((libraryExercise) => {
    [libraryExercise.name, ...(libraryExercise.aliases || [])].forEach((name) => {
      const savedExercise = { id: `saved_${libraryExercise.id}`, name };

      assert.equal(
        getBasicWorkoutLibraryExercise(savedExercise)?.id,
        libraryExercise.id,
        `${name} should resolve to ${libraryExercise.id}`
      );
      assert.equal(
        getBasicWorkoutMannequinIllustrationSource(savedExercise),
        getExpectedIllustrationSource(libraryExercise),
        `${name} should use its own mannequin illustration`
      );
    });
  });
});

test("all names allowed for new AI basic plans resolve to the intended individual illustration", () => {
  const catalogue = [
    ["Жим ногами", "leg_press"],
    ["Гоблет-присед с гантелью", "goblet_squat"],
    ["Румынская тяга", "romanian_deadlift"],
    ["Сгибание ног лёжа в тренажёре", "leg_curl"],
    ["Тяга верхнего блока", "lat_pulldown"],
    ["Горизонтальная тяга блока", "seated_cable_row"],
    ["Тяга гантели с опорой", "one_arm_db_row"],
    ["Подтягивания", "pull_up"],
    ["Жим гантелей лёжа", "db_bench_press"],
    ["Жим от груди в тренажёре", "machine_chest_press"],
    ["Жим гантелей сидя", "seated_db_press"],
    ["Отведение рук с гантелями в стороны", "db_lateral_raise"],
    ["Сгибание рук с гантелями", "db_curl"],
    ["Разгибание рук с канатом", "rope_pushdown"],
    ["Скручивания лёжа", "floor_crunch"],
    ["Планка", "plank"],
    ["Отжимания", "pushup"],
    ["Ягодичный мост", "glute_bridge"]
  ];

  catalogue.forEach(([name, expectedId]) => {
    const exercise = { id: `ai_${expectedId}`, name };
    assert.equal(getBasicWorkoutLibraryExercise(exercise)?.id, expectedId, name);
    assert.equal(
      getBasicWorkoutMannequinIllustrationSource(exercise),
      `/basic-workout/exercises/mannequin/${expectedId}.png`,
      name
    );
  });
});
