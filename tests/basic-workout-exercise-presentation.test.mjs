import assert from "node:assert/strict";
import test from "node:test";

import { BASIC_WORKOUT_PLANS } from "../src/data/basicWorkoutPlans.js";
import {
  applyBasicWorkoutExerciseOverride,
  getBasicWorkoutExerciseOverrideId,
  getBasicWorkoutExercisePresentation,
  getBasicWorkoutExerciseTechniqueHint,
  getBasicWorkoutLibraryExercise,
  normalizeBasicWorkoutExerciseOverrides
} from "../src/utils/basicWorkoutExercisePresentation.js";

test("basic workout presentation describes the target muscles and equipment", () => {
  const presentation = getBasicWorkoutExercisePresentation({
    name: "Жим штанги лёжа",
    equipment: "Штанга"
  });

  assert.equal(presentation.title, "Грудь");
  assert.equal(presentation.bodyZone, "chest");
  assert.equal(presentation.equipmentType, "barbell");
});

test("basic workout presentation keeps bodyweight exercises clear", () => {
  const presentation = getBasicWorkoutExercisePresentation({
    name: "Подъём на носки стоя",
    equipment: "Собственный вес"
  });

  assert.equal(presentation.title, "Икры");
  assert.equal(presentation.bodyZone, "calves");
  assert.equal(presentation.equipmentType, "bodyweight");
});

test("basic workout presentation restores equipment from the library for saved plan exercises", () => {
  const presentation = getBasicWorkoutExercisePresentation({ id: "db_curl", name: "Сгибание рук с гантелями" });

  assert.equal(presentation.equipment, "Гантели");
  assert.equal(presentation.equipmentType, "dumbbells");
});

test("legacy bench press names restore the correct barbell presentation", () => {
  const exercise = { id: "bm2_bench", name: "Жим лёжа" };
  const presentation = getBasicWorkoutExercisePresentation(exercise);

  assert.equal(presentation.equipment, "Скамья и штанга");
  assert.equal(presentation.equipmentType, "barbell");
  assert.equal(presentation.groupId, "chest_press");
});

test("common AI names keep their own equipment instead of a neighbouring movement's equipment", () => {
  const pullUp = getBasicWorkoutExercisePresentation({ name: "Подтягивания" });
  const deadlift = getBasicWorkoutExercisePresentation({ name: "Становая тяга" });
  const pushup = getBasicWorkoutExercisePresentation({ name: "Отжимания" });

  assert.equal(pullUp.equipment, "Перекладина");
  assert.equal(pullUp.equipmentType, "bar");
  assert.equal(deadlift.equipment, "Штанга");
  assert.equal(deadlift.equipmentType, "barbell");
  assert.equal(pushup.equipment, "Собственный вес");
  assert.equal(pushup.equipmentType, "bodyweight");
});

test("every exercise in built-in basic plans resolves to its library equipment", () => {
  Object.values(BASIC_WORKOUT_PLANS).forEach((plan) => {
    plan.workouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        const libraryExercise = getBasicWorkoutLibraryExercise(exercise);
        const presentation = getBasicWorkoutExercisePresentation(exercise);

        assert.ok(libraryExercise, `${exercise.name} should resolve to a library exercise`);
        assert.equal(presentation.equipment, libraryExercise.equipment, `${exercise.name} should keep its equipment`);
      });
    });
  });
});

test("every basic exercise group has a complete illustration presentation", () => {
  const groupIds = [
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
    "core"
  ];

  groupIds.forEach((basicExerciseGroupId) => {
    const presentation = getBasicWorkoutExercisePresentation({ basicExerciseGroupId });

    assert.equal(presentation.groupId, basicExerciseGroupId);
    assert.ok(["front", "back"].includes(presentation.view));
    assert.ok(presentation.primaryMuscles.length > 0);
    assert.ok(presentation.primaryAreas.length > 0);
  });
});

test("catalogue overrides replace only the presentation of a basic workout exercise", () => {
  const source = {
    id: "leg_press",
    name: "Saved plan name",
    equipment: "Saved equipment",
    note: "Saved cue",
    video: "/saved-plan-video.mp4",
    sets: [{ reps: 12, weight: 20, completed: true }]
  };
  const overrides = {
    leg_press: {
      name: "Updated catalogue name",
      equipment: "Updated catalogue equipment",
      note: "Updated catalogue cue",
      imageUrl: "https://cdn.example/leg-press.webp",
      videoUrl: "https://cdn.example/leg-press.mp4"
    }
  };

  const resolved = applyBasicWorkoutExerciseOverride(source, overrides);
  const presentation = getBasicWorkoutExercisePresentation(resolved);

  assert.equal(resolved.id, source.id);
  assert.equal(resolved.sets, source.sets);
  assert.equal(resolved.name, "Updated catalogue name");
  assert.equal(resolved.equipment, "Updated catalogue equipment");
  assert.equal(resolved.note, "Updated catalogue cue");
  assert.equal(resolved.video, "https://cdn.example/leg-press.mp4");
  assert.equal(resolved.basicExerciseId, "leg_press");
  assert.equal(getBasicWorkoutExerciseOverrideId(resolved), "leg_press");
  assert.equal(getBasicWorkoutExerciseTechniqueHint(resolved, "Fallback cue"), "Updated catalogue cue");
  assert.equal(presentation.imageUrl, "https://cdn.example/leg-press.webp");
  assert.equal(presentation.groupId, "quads");
});

test("partial overrides and disabled video keep the saved-plan data safe", () => {
  const source = {
    id: "leg_press",
    name: "Saved plan name",
    note: "Saved cue",
    video: "/saved-plan-video.mp4"
  };
  const normalized = normalizeBasicWorkoutExerciseOverrides({
    leg_press: { name: "Catalogue name" }
  });
  const partial = applyBasicWorkoutExerciseOverride(source, normalized);
  const hiddenVideo = applyBasicWorkoutExerciseOverride(source, {
    leg_press: { videoDisabled: true }
  });

  assert.equal(partial.name, "Catalogue name");
  assert.equal(partial.note, "Saved cue");
  assert.equal(partial.video, "/saved-plan-video.mp4");
  assert.equal(hiddenVideo.video, "");
  assert.equal(hiddenVideo.basicExerciseVideoDisabled, true);
  assert.equal(source.video, "/saved-plan-video.mp4");
});
