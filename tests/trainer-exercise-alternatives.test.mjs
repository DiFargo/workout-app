import test from "node:test";
import assert from "node:assert/strict";

import {
  createTrainerExerciseAlternative,
  getTrainerExerciseAlternatives,
  MAX_TRAINER_EXERCISE_ALTERNATIVES,
  replaceTrainerAssignedExerciseInWorkout
} from "../src/utils/trainerExerciseAlternatives.js";

test("trainer alternatives keep a self-contained library snapshot", () => {
  const alternative = createTrainerExerciseAlternative({
    id: "machine_chest_press",
    name: "Жим от груди в тренажёре",
    video: "https://cdn.example.com/chest-press.mp4",
    imageUrl: "https://cdn.example.com/chest-press.webp",
    basicExerciseImageUrl: "/basic-workout/illustrations/chest-press.webp",
    basicExerciseLibraryId: "machine_chest_press",
    muscleGroup: "Грудные",
    requiresWeight: true,
    equipment: "Тренажёр"
  });

  assert.deepEqual(alternative, {
    id: "machine_chest_press",
    libraryExerciseId: "machine_chest_press",
    name: "Жим от груди в тренажёре",
    video: "https://cdn.example.com/chest-press.mp4",
    imageUrl: "https://cdn.example.com/chest-press.webp",
    basicExerciseImageUrl: "/basic-workout/illustrations/chest-press.webp",
    basicExerciseLibraryId: "machine_chest_press",
    muscleGroup: "Грудные",
    requiresWeight: true,
    equipment: "Тренажёр",
    assignedByTrainer: true
  });
});

test("trainer alternative replacement changes only the current assigned exercise", () => {
  const originalExercise = {
    id: "assigned_exercise_1",
    name: "Жим штанги лёжа",
    rest: "90 сек",
    sets: [{ reps: 10, weight: "60", completed: false, enteredWeight: "" }],
    trainerAlternatives: [
      {
        id: "machine_chest_press",
        libraryExerciseId: "machine_chest_press",
        name: "Жим от груди в тренажёре",
        video: "https://cdn.example.com/chest-press.mp4",
        equipment: "Тренажёр",
        requiresWeight: true
      }
    ]
  };
  const workout = {
    id: "assigned_day_1",
    exercises: [originalExercise, { id: "other", name: "Планка", sets: [] }]
  };

  const { workout: nextWorkout, replacement } = replaceTrainerAssignedExerciseInWorkout(
    workout,
    "assigned_exercise_1",
    getTrainerExerciseAlternatives(originalExercise)[0]
  );

  assert.equal(replacement.id, "assigned_exercise_1");
  assert.equal(replacement.name, "Жим от груди в тренажёре");
  assert.equal(replacement.trainerReplacementOf, "Жим штанги лёжа");
  assert.equal(replacement.equipment, "Тренажёр");
  assert.deepEqual(replacement.sets, originalExercise.sets);
  assert.equal(nextWorkout.exercises[1].name, "Планка");
  assert.equal(nextWorkout.exercises[0].trainerAlternatives.length, 1);
});

test("an assigned exercise exposes no more than two trainer alternatives", () => {
  const alternatives = getTrainerExerciseAlternatives({
    trainerAlternatives: [
      { id: "first", name: "Первый вариант" },
      { id: "second", name: "Второй вариант" },
      { id: "third", name: "Третий вариант" }
    ]
  });

  assert.equal(MAX_TRAINER_EXERCISE_ALTERNATIVES, 2);
  assert.deepEqual(alternatives.map((item) => item.name), ["Первый вариант", "Второй вариант"]);
});

test("trainer alternative replacement refuses an option that was not assigned", () => {
  const workout = {
    id: "assigned_day_1",
    exercises: [{
      id: "assigned_exercise_1",
      name: "Жим штанги лёжа",
      trainerAlternatives: [{ id: "machine_chest_press", name: "Жим от груди в тренажёре" }]
    }]
  };

  const result = replaceTrainerAssignedExerciseInWorkout(workout, "assigned_exercise_1", {
    id: "pushups",
    name: "Отжимания"
  });

  assert.equal(result.replacement, null);
  assert.equal(result.workout.exercises[0].name, "Жим штанги лёжа");
});
