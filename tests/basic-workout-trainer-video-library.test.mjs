import assert from "node:assert/strict";
import test from "node:test";
import { BASIC_WORKOUT_TRAINER_VIDEO_ADDITIONS } from "../src/data/basicWorkoutTrainerVideoAdditions.js";
import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../src/data/basicWorkoutExerciseLibrary.js";
import { BASIC_WORKOUT_PLANS } from "../src/data/basicWorkoutPlans.js";
import { applyBasicWorkoutExerciseOverride, getBasicWorkoutLibraryExercise } from "../src/utils/basicWorkoutExercisePresentation.js";

test("18 approved video variants have distinct identities and are available for plans", () => {
  assert.equal(BASIC_WORKOUT_TRAINER_VIDEO_ADDITIONS.length, 18);
  assert.equal(new Set(BASIC_WORKOUT_TRAINER_VIDEO_ADDITIONS.map(item => item.id)).size, 18);
  for (const item of BASIC_WORKOUT_TRAINER_VIDEO_ADDITIONS) {
    assert.equal(BASIC_WORKOUT_EXERCISE_LIBRARY.filter(entry => entry.id === item.id).length, 1);
    assert.equal(item.planEligible, true);
    assert.equal(getBasicWorkoutLibraryExercise({ name: item.name }).id, item.id);
    assert.ok(!["sets", "reps", "weight"].some(field => Object.hasOwn(item, field)));
  }
});

test("adding manual variants keeps old plan identities and loads separate from video", () => {
  assert.equal(getBasicWorkoutLibraryExercise({ name: "Выпады с гантелями" }).id, "reverse_lunge");
  assert.equal(getBasicWorkoutLibraryExercise({ basicExerciseId: "reverse_lunge", name: "Выпады с гантелями" }).id, "reverse_lunge");
  const originalPlans = JSON.stringify(BASIC_WORKOUT_PLANS);
  for (const item of BASIC_WORKOUT_TRAINER_VIDEO_ADDITIONS) {
    const original = { id: "saved-slot", basicExerciseId: item.id, name: item.name, rest: "100 сек",
      sets: Array.from({ length: 3 }, () => ({ reps: 12, weight: 110, completed: false })) };
    const saved = structuredClone(original);
    const shown = applyBasicWorkoutExerciseOverride(original, { [item.id]: { videoUrl: "/approved.mp4", videoCrop: { x: .4, y: .7, zoom: 1.1 } } });
    assert.equal(shown.video, "/approved.mp4");
    assert.equal(shown.sets, original.sets);
    assert.equal(shown.rest, "100 сек");
    assert.deepEqual(original, saved);
  }
  assert.equal(JSON.stringify(BASIC_WORKOUT_PLANS), originalPlans);
});
