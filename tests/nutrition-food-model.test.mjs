import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomNutritionDishDraft,
  buildCustomNutritionFoodDraft,
  makePersonalFoodKey
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

test("personal food keys preserve a GTIN or catalog ID before falling back to the name", () => {
  assert.equal(
    makePersonalFoodKey({ name: "Same product name", barcode: "4812345678900" }),
    "my_gtin_4812345678900"
  );
  assert.equal(
    makePersonalFoodKey({ name: "Same product name", id: "ref-usda-173944" }),
    "my_catalog_ref-usda-173944"
  );
  assert.equal(makePersonalFoodKey({ name: "Manual food" }), "my_manual_food");
});
