import assert from "node:assert/strict";
import test from "node:test";

import { searchBundledNutritionFallbackFoods } from "../src/utils/localNutritionCatalog.js";

test("bundled nutrition fallback returns common products without loading the lazy catalog", () => {
  const foods = searchBundledNutritionFallbackFoods("сыр");

  assert.ok(foods.length > 0);
  assert.equal(foods[0].name, "Сыр твёрдый");
  assert.equal(foods[0].sourceType, "local_catalog");
});
