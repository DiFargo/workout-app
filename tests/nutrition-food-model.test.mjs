import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomNutritionDishDraft,
  buildCustomNutritionFoodDraft
} from "../src/utils/nutritionFoodModel.js";

test("custom nutrition food draft keeps editable defaults", () => {
  const draft = buildCustomNutritionFoodDraft({ id: "custom_1", foodId: "custom_1" });

  assert.equal(draft.id, "custom_1");
  assert.equal(draft.name, "");
  assert.equal(draft.portionAmount, 100);
  assert.equal(draft.lastAmount, 100);
  assert.equal(draft.amountMode, "grams");
  assert.equal(draft.type, "");
  assert.deepEqual(draft.ingredients, []);
});

test("custom nutrition dish draft starts with dish defaults", () => {
  const draft = buildCustomNutritionDishDraft({ id: "dish_1", foodId: "dish_1" });

  assert.equal(draft.id, "dish_1");
  assert.equal(draft.name, "");
  assert.equal(draft.type, "dish");
  assert.equal(draft.totalWeight, 100);
  assert.deepEqual(draft.ingredients, []);
});
