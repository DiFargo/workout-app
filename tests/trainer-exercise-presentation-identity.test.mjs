import test from "node:test";
import assert from "node:assert/strict";

import {
  getTrainerExercisePresentationIdentity,
  normalizeTrainerNextExerciseDefaults
} from "../src/features/trainer/trainerWorkoutEditHelpers.js";

const chestPressLibraryExercise = {
  id: "machine_chest_press",
  sourceId: "Machine_Chest_Press",
  name: "Жим от груди в тренажёре",
  groupId: "chest_press",
  basicExerciseGroupTitle: "Грудь",
  basicExerciseImageUrl: "/basic-workout/illustrations/chest-press.webp",
  imageUrl: "https://cdn.example.com/chest-press.webp",
  image: "https://cdn.example.com/chest-press-card.webp",
  thumbnail: "https://cdn.example.com/chest-press-thumb.webp",
  muscleGroup: "Грудные",
  equipment: "Тренажёр",
  requiresWeight: true
};

test("trainer library exercise keeps its visual identity in a client-plan snapshot", () => {
  assert.deepEqual(getTrainerExercisePresentationIdentity(chestPressLibraryExercise), {
    libraryExerciseId: "machine_chest_press",
    sourceId: "Machine_Chest_Press",
    basicExerciseGroupId: "chest_press",
    basicExerciseGroupTitle: "Грудь",
    basicExerciseImageUrl: "/basic-workout/illustrations/chest-press.webp",
    imageUrl: "https://cdn.example.com/chest-press.webp",
    image: "https://cdn.example.com/chest-press-card.webp",
    thumbnail: "https://cdn.example.com/chest-press-thumb.webp",
    muscleGroup: "Грудные",
    equipment: "Тренажёр"
  });
});

test("new trainer-plan exercise preserves illustration fields from the selected library item", () => {
  const created = normalizeTrainerNextExerciseDefaults(
    chestPressLibraryExercise.name,
    [chestPressLibraryExercise]
  );

  assert.equal(created.libraryExerciseId, "machine_chest_press");
  assert.equal(created.sourceId, "Machine_Chest_Press");
  assert.equal(created.basicExerciseGroupId, "chest_press");
  assert.equal(created.basicExerciseImageUrl, "/basic-workout/illustrations/chest-press.webp");
  assert.equal(created.imageUrl, "https://cdn.example.com/chest-press.webp");
  assert.equal(created.thumbnail, "https://cdn.example.com/chest-press-thumb.webp");
  assert.equal(created.muscleGroup, "Грудные");
  assert.equal(created.equipment, "Тренажёр");
});
