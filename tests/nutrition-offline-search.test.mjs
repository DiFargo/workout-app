import assert from "node:assert/strict";
import test from "node:test";

import { searchBundledNutritionFallbackFoods } from "../src/utils/localNutritionCatalog.js";

test("bundled nutrition fallback returns common products without loading the lazy catalog", () => {
  const foods = searchBundledNutritionFallbackFoods("сыр");

  assert.ok(foods.length > 0);
  assert.ok(foods.every(food => food.sourceType === "basic_reference"));
  assert.ok(foods.every(food => food.sources.some(source => source.url.startsWith("https://fdc.nal.usda.gov/"))));
  assert.ok(foods.some(food => /сыр/i.test(food.name)));
});
