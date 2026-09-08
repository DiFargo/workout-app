import assert from "node:assert/strict";
import test from "node:test";

import { getFoodScale } from "../src/utils/nutritionPortions.js";

test("a selected product portion scales macros from the 100 gram base", () => {
  const food = {
    name: "Хлеб с отрубями",
    portion: "250 г",
    portionAmount: 250,
    calories: 230
  };

  assert.equal(getFoodScale(100, food, "grams"), 1);
  assert.equal(getFoodScale(250, food, "portion"), 2.5);
  assert.equal(Math.round(food.calories * getFoodScale(250, food, "portion")), 575);
});

test("dish portions keep their recipe total weight as the macro base", () => {
  const dish = { type: "dish", totalWeight: 500, portionAmount: 500 };

  assert.equal(getFoodScale(250, dish, "portion"), 0.5);
});
