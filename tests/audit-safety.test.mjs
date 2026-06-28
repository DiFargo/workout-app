import test from "node:test";
import assert from "node:assert/strict";
import {
  applyExerciseLibraryDefaults,
  calculateNutritionFoodStreak,
  createFourWeekWorkoutProgramBlocks,
  distributeMicrocycleWorkouts,
  exerciseUsesExternalWeight,
  findExerciseLibraryMatch,
  findExistingPhotoFood,
  getMicrocycleWeekNumbers,
  getWorkoutCompletion,
  hasWorkoutSetEntry,
  isWorkoutSetCompleted,
  isReliablePhotoFood,
  limitSimilarNutritionFoods,
  mergeNutritionDays,
  rankAndDedupeNutritionFoods
} from "../src/utils/auditSafety.js";

test("new workout programs contain two microcycles and eight ordered workouts", () => {
  const blocks = createFourWeekWorkoutProgramBlocks("test");
  const weeks = blocks.flatMap((block) => block.weeks);
  const workouts = weeks.flatMap((week) => week.workouts);

  assert.equal(blocks.length, 2);
  assert.deepEqual(weeks.map((week) => week.name), [
    "Неделя 1",
    "Неделя 2",
    "Неделя 3",
    "Неделя 4"
  ]);
  assert.deepEqual(workouts.map((workout) => workout.name), [
    "Тренировка 1",
    "Тренировка 2",
    "Тренировка 3",
    "Тренировка 4",
    "Тренировка 5",
    "Тренировка 6",
    "Тренировка 7",
    "Тренировка 8"
  ]);
});

test("Excel microcycle days are split into two global weeks", () => {
  assert.deepEqual(getMicrocycleWeekNumbers(1, 1, 2), [1, 2]);
  assert.deepEqual(getMicrocycleWeekNumbers(2, 1, 2), [3, 4]);
  assert.deepEqual(
    distributeMicrocycleWorkouts(
      [{ dayNumber: 1 }, { dayNumber: 2 }, { dayNumber: 3 }, { dayNumber: 4 }],
      2
    ).map((week) => week.map((workout) => workout.dayNumber)),
    [[1, 2], [3, 4]]
  );
});

test("photo analysis rejects non-food and low-confidence drafts", () => {
  assert.equal(isReliablePhotoFood(
    { name: "Стул", calories: 200, protein: 8, fat: 8, carbs: 22, confidence: "low" },
    {}
  ), false);
  assert.equal(isReliablePhotoFood(
    { name: "Сырники", calories: 220, protein: 14, fat: 9, carbs: 20, confidence: "medium", isFood: true },
    { found: true, isFood: true }
  ), true);
  assert.equal(isReliablePhotoFood(
    { name: "Йогурт", calories: 90, protein: 7, fat: 3, carbs: 8, confidence: "high" },
    { found: false }
  ), false);
});

test("photo analysis reuses an exact database product", () => {
  const foods = [
    { id: "rice", name: "Рис варёный", calories: 130 },
    { id: "teos", name: "Греческий йогурт", brand: "TEOS", barcode: "4811234567890" }
  ];

  assert.equal(
    findExistingPhotoFood(foods, { name: "Греческий йогурт", brand: "TEOS" })?.id,
    "teos"
  );
  assert.equal(
    findExistingPhotoFood(foods, { name: "Другой йогурт", barcode: "4811234567890" })?.id,
    "teos"
  );
  assert.equal(findExistingPhotoFood(foods, { name: "Йогурт с клубникой" }), null);
});

test("bodyweight exercises do not require a weight field", () => {
  assert.equal(exerciseUsesExternalWeight({ name: "Пресс" }), false);
  assert.equal(exerciseUsesExternalWeight({ name: "Планка" }), false);
  assert.equal(exerciseUsesExternalWeight({ name: "Жим гантелей" }), true);
  assert.equal(exerciseUsesExternalWeight({ name: "Пресс", requiresWeight: true }), true);
});

test("exercise library prefers an exact match with video", () => {
  const match = findExerciseLibraryMatch([
    { id: "current", name: "Тяга верхнего блока", video: "" },
    { id: "saved", name: "  ТЯГА верхнего блока ", video: "/videos/pulldown.mp4", requiresWeight: true }
  ], "Тяга верхнего блока", "current");

  assert.equal(match?.id, "saved");
  assert.equal(findExerciseLibraryMatch([{ id: "press", name: "Пресс", video: "/press.mp4" }], "Планка"), null);
});

test("imported exercises receive existing library videos without overwriting their own", () => {
  const library = [
    {
      id: "library-row",
      name: "Тяга нижнего блока",
      video: "/videos/row.mp4",
      requiresWeight: true
    }
  ];
  const imported = applyExerciseLibraryDefaults(
    { name: " ТЯГА нижнего блока ", sets: [{ reps: 12, weight: "35" }] },
    library
  );
  const withOwnVideo = applyExerciseLibraryDefaults(
    { name: "Тяга нижнего блока", video: "/videos/custom.mp4" },
    library
  );

  assert.equal(imported.video, "/videos/row.mp4");
  assert.equal(imported.videoAutoFilledFrom, "Тяга нижнего блока");
  assert.equal(imported.requiresWeight, true);
  assert.equal(withOwnVideo.video, "/videos/custom.mp4");
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
  assert.equal(isWorkoutSetCompleted({ enteredReps: "10" }), false);
  assert.equal(isWorkoutSetCompleted({ enteredWeight: "0", enteredReps: "" }), false);
  assert.equal(isWorkoutSetCompleted({ enteredWeight: "", enteredReps: "0" }), false);
  assert.equal(hasWorkoutSetEntry(""), false);
  assert.equal(hasWorkoutSetEntry("0"), true);
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

test("nutrition streak is counted from the selected day", () => {
  const days = {
    "2026-06-15": { foods: [{ id: "a" }] },
    "2026-06-16": { foods: [{ id: "b" }] },
    "2026-06-17": { foods: [{ id: "c" }] },
    "2026-06-19": { foods: [{ id: "d" }] }
  };

  assert.equal(calculateNutritionFoodStreak(days, "2026-06-17"), 3);
  assert.equal(calculateNutritionFoodStreak(days, "2026-06-19"), 1);
  assert.equal(calculateNutritionFoodStreak(days, "2026-06-18"), 0);
});
