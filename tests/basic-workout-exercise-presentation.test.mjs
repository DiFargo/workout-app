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

test("technique presentation handles the absent current exercise at workout completion", () => {
  for (const exercise of [null, undefined]) {
    assert.equal(getBasicWorkoutExerciseTechniqueHint(exercise), "");
    assert.equal(getBasicWorkoutExerciseTechniqueHint(exercise, "Fallback cue"), "Fallback cue");
  }
});

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

test("shared basic video preserves its crop through the cache without changing prescribed load", () => {
  const crop = { x: 0.5, y: 0.58, zoom: 1.2 };
  const source = { id: "saved-slot", basicExerciseId: "leg_press", name: "Жим ногами",
    video: "/old.mp4", videoCrop: { x: 0, y: 0, zoom: 2 }, rest: "90 сек",
    sets: Array.from({ length: 3 }, () => ({ reps: 12, weight: 110, completed: false })) };
  const before = structuredClone(source);
  const cached = normalizeBasicWorkoutExerciseOverrides({ leg_press: { videoUrl: "/approved.mp4", videoCrop: crop } });
  const resolved = applyBasicWorkoutExerciseOverride(source, cached);
  assert.equal(resolved.video, "/approved.mp4");
  assert.deepEqual(resolved.videoCrop, crop);
  assert.equal(resolved.sets, source.sets);
  assert.equal(resolved.rest, source.rest);
  assert.deepEqual(source, before);
  assert.deepEqual(applyBasicWorkoutExerciseOverride(source, { leg_press: { note: "Новая техника" } }).videoCrop, source.videoCrop);
  assert.equal(applyBasicWorkoutExerciseOverride(source, { leg_press: { videoUrl: "/other.mp4" } }).videoCrop, null);
  assert.equal(applyBasicWorkoutExerciseOverride(source, { leg_press: { videoCrop: null } }).videoCrop, null);
  assert.equal(applyBasicWorkoutExerciseOverride(source, { leg_press: { videoDisabled: true } }).videoCrop, null);
  assert.equal(applyBasicWorkoutExerciseOverride(source, { leg_press: { videoCrop: { x: 20, y: 0, zoom: 1 } } }).videoCrop, null);
});
