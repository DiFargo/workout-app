import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = (path) => new URL(`../${path}`, import.meta.url);

test("tap-driven page navigation stays urgent", async () => {
  const source = await readFile(sourceUrl("src/AppCore.jsx"), "utf8");

  assert.doesNotMatch(source, /startTransition/);
  assert.match(source, /const setPage = useCallback\(\(nextPage\) => \{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*setPageState\(nextPage\);/);
});

test("closed nutrition picker avoids personal catalog work", async () => {
  const source = await readFile(sourceUrl("src/utils/nutritionSearchResults.js"), "utf8");
  const earlyExitIndex = source.indexOf('if (!query && !["my", "recent", "favorites"].includes(nutritionSearchTab))');
  const personalCatalogIndex = source.indexOf("const myFoods = buildMyNutritionFoods");

  assert.ok(earlyExitIndex >= 0);
  assert.ok(personalCatalogIndex > earlyExitIndex);
});

test("food commits queue compact My Database changes", async () => {
  const source = await readFile(sourceUrl("src/features/client/nutrition/nutritionFoodCommitHandlers.js"), "utf8");
  const persistence = await readFile(sourceUrl("src/features/client/nutrition/nutritionMyFoodsHandlers.js"), "utf8");

  assert.match(source, /savePersonalMyFoodsToFirebase\(nextMyFoods, \{\s*id: myFoodId,\s*food: personalFood\s*\}\)/);
  assert.doesNotMatch(source, /const updatedFood = normalizeMyFoodRecord\(foodToAdd/);
  assert.match(persistence, /myFoods: \{ \[change\.id\]: change\.food \}/);
  assert.match(persistence, /setTimeout\(flushPersonalMyFoodsSaveQueue, MY_FOODS_SAVE_DELAY_MS\)/);
});
