import test from "node:test";
import assert from "node:assert/strict";
import { getTrainerLibraryMuscle } from "../src/utils/trainerLibraryMuscleGroups.js";

test("personal library groups known exercises and preserves unclassified ones", () => {
  for (const [name, group] of [["Жим ногами", "legs"], ["Тяга верхнего блока", "back"], ["Жим лёжа с гантелями", "chest"], ["Пресс", "core"], ["Моё новое упражнение", "other"]]) {
    assert.equal(getTrainerLibraryMuscle({ name }), group);
  }
  assert.equal(getTrainerLibraryMuscle({ name: "Своё движение", muscleGroup: "biceps" }), "biceps");
});
