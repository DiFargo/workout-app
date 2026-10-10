import assert from "node:assert/strict";
import { after, test } from "node:test";
import { installRuntimeImports } from "./helpers/runtime-imports.mjs";

const cleanup = installRuntimeImports({
  "src/utils/nutritionPreferenceStorage.js": {
    loadNutritionPreferredUnit: () => "",
    loadRecentNutritionFoods: () => []
  }
});
after(cleanup);

const { createNutritionProductEditorHandlers } = await import(
  "../src/features/client/nutrition/nutritionProductEditorHandlers.js"
);
const { createNutritionFoodEntryHandlers } = await import(
  "../src/features/client/nutrition/nutritionFoodEntryHandlers.js"
);

function createContext(overrides = {}) {
  const state = {
    nutrition: { myFoods: {} },
    nutritionSearch: "макароны",
    nutritionSearchTab: "food",
    nutritionSearchResultLimit: { key: "макароны", limit: 16 },
    fatSecretFoods: [{ id: "pasta", name: "Макароны варёные" }],
    nutritionMeal: "lunch",
    nutritionPickerOpen: true,
    selectedNutritionFood: null,
    editingNutritionItemId: null,
    nutritionEditDetailsOpen: false,
    nutritionEditPageOpen: false,
    nutritionEditOriginalFood: null,
    nutritionEditOriginalNote: "",
    nutritionEditNote: "",
    nutritionAmount: "100",
    nutritionAmountMode: "grams",
    nutritionAmountError: "",
    nutritionProductErrors: {},
    nutritionCreateChoiceOpen: false,
    nutritionFallbackSuggestions: [],
    nutritionMealMenuOpen: false,
    recentNutritionFoods: [],
    showRecentNutritionFoods: false,
    ...overrides
  };
  const setters = Object.fromEntries(Object.keys(state).map((key) => [
    `set${key[0].toUpperCase()}${key.slice(1)}`,
    (value) => { state[key] = typeof value === "function" ? value(state[key]) : value; }
  ]));
  return { state, context: { ...state, ...setters, resetNutritionPhotoAiState() {} } };
}

for (const tab of ["food", "my", "recent"]) {
  test(`returning from a product retains ${tab} search context`, () => {
    const { state, context } = createContext({ nutritionSearchTab: tab, showRecentNutritionFoods: tab === "recent" });
    const before = structuredClone(state);
    const handlers = createNutritionProductEditorHandlers(context);
    handlers.addNutritionFoodFromPicker({ id: "pasta", name: "Макароны варёные", calories: 158 });
    assert.equal(state.selectedNutritionFood.id, "pasta");
    handlers.closeSelectedNutritionFood();
    assert.equal(state.selectedNutritionFood, null);
    assert.equal(state.nutritionPickerOpen, true);
    for (const key of ["nutritionSearch", "nutritionSearchTab", "nutritionSearchResultLimit", "fatSecretFoods", "nutritionMeal", "showRecentNutritionFoods"]) {
      assert.deepEqual(state[key], before[key], key);
    }
  });
}

test("a newly opened picker still starts a fresh search for the requested meal", () => {
  const { state, context } = createContext({ nutritionSearchTab: "my", selectedNutritionFood: { id: "pasta" } });
  createNutritionFoodEntryHandlers(context).openNutritionPicker("dinner");
  assert.equal(state.nutritionSearch, "");
  assert.equal(state.nutritionSearchTab, "food");
  assert.equal(state.nutritionMeal, "dinner");
  assert.equal(state.selectedNutritionFood, null);
  assert.equal(state.nutritionPickerOpen, true);
});
