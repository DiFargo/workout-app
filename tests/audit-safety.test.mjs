import test from "node:test";
import assert from "node:assert/strict";
import {
  exerciseUsesExternalWeight,
  getWorkoutCompletion,
  isWorkoutSetCompleted,
  limitSimilarNutritionFoods,
  mergeNutritionDays,
  rankAndDedupeNutritionFoods
} from "../src/utils/auditSafety.js";

test("bodyweight exercises do not require a weight field", () => {
  assert.equal(exerciseUsesExternalWeight({ name: "Пресс" }), false);
  assert.equal(exerciseUsesExternalWeight({ name: "Планка" }), false);
  assert.equal(exerciseUsesExternalWeight({ name: "Жим гантелей" }), true);
  assert.equal(exerciseUsesExternalWeight({ name: "Пресс", requiresWeight: true }), true);
});

test("nutrition results are ranked and exact duplicates are removed", () => {
  const foods = [
    { name: "Молоко 2.5%", brand: "А", calories: 52, protein: 3 },
    { name: "Молоко 2.5%", brand: "А", calories: 52, protein: 3 },
    { name: "Коктейль молочный", brand: "Б", calories: 90, protein: 2 },
    { name: "Молоко", brand: "В", calories: 60, protein: 3 }
  ];

  const result = rankAndDedupeNutritionFoods(foods, "молоко");
  assert.equal(result.length, 3);
  assert.equal(result[0].name, "Молоко");
});

test("an explicitly checked workout set is completed without manual input", () => {
  assert.equal(isWorkoutSetCompleted({ completed: true }), true);
  assert.equal(isWorkoutSetCompleted({ enteredReps: "10" }), true);
  assert.equal(isWorkoutSetCompleted({ enteredWeight: "0", enteredReps: "" }), false);
});

test("a partly completed workout requires confirmation", () => {
  const completion = getWorkoutCompletion({
    exercises: [
      { sets: [{ completed: true }, { completed: false }] },
      { sets: [{ enteredReps: "" }] }
    ]
  });

  assert.deepEqual(completion, {
    completedSets: 1,
    totalSets: 3,
    isPartial: true
  });
});

test("similar nutrition results are limited by product family", () => {
  const foods = [
    { name: "Молоко 2.5%", brand: "А" },
    { name: "Молоко 3.2%", brand: "Б" },
    { name: "Молоко 1.5%", brand: "В" },
    { name: "Кефир 2.5%", brand: "А" }
  ];

  const result = limitSimilarNutritionFoods(foods, 8, 2);
  assert.equal(result.length, 3);
  assert.equal(result.filter((food) => food.name.startsWith("Молоко")).length, 2);
});

test("nutrition days merge independently by their own update time", () => {
  const localDays = {
    "2026-06-10": {
      foods: [{ id: "local-new" }],
      updatedAt: "2026-06-11T10:00:00.000Z"
    },
    "2026-06-11": {
      foods: [{ id: "local-old" }],
      updatedAt: "2026-06-11T08:00:00.000Z"
    }
  };
  const cloudDays = {
    "2026-06-10": {
      foods: [{ id: "cloud-old" }],
      updatedAt: "2026-06-11T09:00:00.000Z"
    },
    "2026-06-11": {
      foods: [{ id: "cloud-new" }],
      updatedAt: "2026-06-11T11:00:00.000Z"
    }
  };

  const merged = mergeNutritionDays(localDays, cloudDays);
  assert.equal(merged["2026-06-10"].foods[0].id, "local-new");
  assert.equal(merged["2026-06-11"].foods[0].id, "cloud-new");
});
