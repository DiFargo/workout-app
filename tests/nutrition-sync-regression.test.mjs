import { test, after } from "node:test";
import assert from "node:assert/strict";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";
import { stampNutritionDayChange, mergeNutritionDay } from "../src/utils/nutritionSyncModel.js";

const cleanup = installRuntimeImports();
after(cleanup);
const { mergeNutritionStates } = await import("../src/utils/nutritionStateMerge.js");
const { createNutritionDishIngredientHandlers } = await import("../src/features/client/nutrition/nutritionDishIngredientHandlers.js");
const t1 = "2026-09-09T10:00:00.000Z", t2 = "2026-09-09T10:01:00.000Z", t3 = "2026-09-09T10:02:00.000Z";

test("two devices adding different foods on one day preserve both portions and a separate water edit", () => {
  const initial = { foods: [], water: 0, updatedAt: t1 };
  const a = stampNutritionDayChange(initial, { ...initial, foods: [{ id: "a", calories: 100 }] }, t2);
  const b = stampNutritionDayChange(initial, { ...initial, water: 200, foods: [{ id: "b", calories: 200 }] }, t3);
  const merged = mergeNutritionDay(a, b);
  assert.deepEqual(merged.foods.map((food) => food.id).sort(), ["a", "b"]);
  assert.equal(merged.water, 200);
  assert.equal(merged.foods.reduce((sum, food) => sum + food.calories, 0), 300);
});

test("deletion survives stale reload and undo explicitly restores the same diary entry", () => {
  const initial = { foods: [{ id: "a", calories: 100, addedAt: t1 }], updatedAt: t1 };
  const removed = stampNutritionDayChange(initial, { ...initial, foods: [] }, t2);
  assert.equal(mergeNutritionDay(removed, initial).foods.length, 0);
  const restored = stampNutritionDayChange(removed, { ...removed, foods: initial.foods }, t3);
  assert.equal(mergeNutritionDay(restored, removed).foods.length, 1);
});

test("removed library foods and favorites stay removed without touching recorded portions", () => {
  const old = { myFoods: { a: { name: "Meal", updatedAt: t1 } }, favorites: ["a"], days: { today: { foods: [{ id: "diary", foodId: "a", calories: 123 }] } } };
  const next = { deletedMyFoods: { a: t2 }, favoriteChanges: { a: { present: false, updatedAt: t2 } }, updatedAt: t2 };
  const merged = mergeNutritionStates(next, old, old.myFoods);
  assert.deepEqual(merged.myFoods, {});
  assert.deepEqual(merged.favorites, []);
  assert.equal(merged.days.today.foods[0].calories, 123);
});

test("actual ingredient handler rejects invalid grams and preserves a positive fractional amount", () => {
  let selected = { ingredients: [] }, errors = {};
  const handlers = createNutritionDishIngredientHandlers({ setSelectedNutritionFood: (fn) => { selected = fn(selected); }, setNutritionProductErrors: (fn) => { errors = fn(errors); }, setDishIngredientPickerOpen() {}, setDishIngredientSearch() {} });
  for (const grams of ["", "-50", "0", "foo", "Infinity"]) assert.equal(handlers.addSelectedDishIngredientFromFood({ id: "food", name: "Food", calories: 100 }, grams), false);
  assert.equal(selected.ingredients.length, 0);
  assert.ok(errors.ingredientAmount);
  assert.equal(handlers.addSelectedDishIngredientFromFood({ id: "food", name: "Food", calories: 100 }, "25,5"), true);
  assert.equal(selected.ingredients[0].grams, 25.5);
});
