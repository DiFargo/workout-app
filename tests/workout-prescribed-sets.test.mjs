import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClientWorkoutsFromTemplate,
  makeThreeSets,
  normalizeExercise,
  normalizePlan
} from "../src/utils/workoutPlanNormalization.js";
import { replaceTrainerAssignedExerciseInWorkout } from "../src/utils/trainerExerciseAlternatives.js";

for (const count of [1, 2, 3, 5]) {
  test(`a ready trainer programme keeps its ${count} prescribed sets after loading, editing and replacement`, () => {
    const sets = Array.from({ length: count }, (_, index) => ({
      id: `set-${index}`,
      reps: 12 - index,
      weight: String(220 + index * 5),
      rest: "90 сек",
      tempo: "3-1-1"
    }));
    const alternative = { id: "squat", name: "Приседания с гантелью", requiresWeight: true };
    const template = {
      id: "ready-programme",
      status: "ready",
      workouts: [{ id: "day-1", exercises: [{
        id: "leg-press",
        name: "Жим ногами",
        requiresWeight: true,
        sets,
        trainerAlternatives: [alternative]
      }] }]
    };
    const original = structuredClone(template);
    const loaded = normalizePlan({ workouts: buildClientWorkoutsFromTemplate(template) });
    const exercise = loaded.workouts[0].exercises[0];
    const prescription = (value) => value.sets.map(({ id, reps, weight, rest, tempo }) => ({ id, reps, weight, rest, tempo }));
    assert.equal(exercise.sets.length, count);
    assert.deepEqual(prescription(exercise), sets);

    const edited = normalizeExercise({ ...exercise, video: "updated-video.mp4", note: "Уточнение техники" });
    const replaced = replaceTrainerAssignedExerciseInWorkout(
      { ...loaded.workouts[0], exercises: [edited] }, exercise.id, alternative
    );
    assert.ok(replaced.replacement);
    const reopened = normalizeExercise(replaced.replacement);
    assert.deepEqual(prescription(reopened), sets);
    // Legacy copy/save paths use this same normalizer, not a separate minimum.
    assert.equal(makeThreeSets(reopened.sets).length, count);
    assert.deepEqual(template, original, "The ready source programme must remain unchanged");
  });
}

test("three default sets are initialized only when no prescription exists", () => {
  for (const source of [undefined, null, []]) {
    const sets = makeThreeSets(source, 10);
    assert.equal(sets.length, 3);
    assert.ok(sets.every((set) => set.reps === 10 && set.weight === ""));
  }
});

test("two prescribed timed sets stay timed without an extra repetition set", () => {
  const exercise = normalizeExercise({ name: "Планка", sets: [
    { id: "first", durationSeconds: 30 },
    { id: "second", durationSeconds: 45 }
  ] });
  assert.equal(exercise.sets.length, 2);
  assert.deepEqual(exercise.sets.map((set) => [set.id, set.durationSeconds, set.reps]), [
    ["first", 30, ""], ["second", 45, ""]
  ]);
});
