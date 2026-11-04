import assert from "node:assert/strict";
import { after, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const cleanup = installRuntimeImports();
after(cleanup);
const { buildNutritionSearchResults } = await import("../src/utils/nutritionSearchResults.js");

test("distinct manufacturer products are not hidden by the generic family cap", () => {
  const foods = ["сливочный", "с авокадо", "с трюфелем", "с паприкой"].map((variant, index) => ({
    id: `manufacturer-${index}`, name: `Сыр творожный ${variant}`, brand: "SVEŽA",
    sourceType: "manufacturer_catalog", source: "Производитель", portion: "100 г",
    calories: 216, protein: 6, fat: 20, carbs: 3
  }));
  const result = buildNutritionSearchResults({ nutritionSearch: "сыр", nutritionSearchTab: "food", fatSecretFoods: foods });
  assert.deepEqual(result.map(food => food.id), foods.map(food => food.id));
  assert.ok(result.every(food => food.sourceType === "manufacturer_catalog"));
});
