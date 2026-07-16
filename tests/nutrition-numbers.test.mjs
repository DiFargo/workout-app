import test from "node:test";
import assert from "node:assert/strict";

import {
  getPositiveNutritionNumber,
  parseNutritionNumber,
  roundMacro
} from "../src/utils/nutritionNumbers.js";

test("nutrition number helpers parse and round user values", () => {
  assert.equal(parseNutritionNumber("12,5"), 12.5);
  assert.equal(parseNutritionNumber("bad", 7), 7);
  assert.equal(roundMacro(12.34), 12.3);
});

test("positive nutrition number prefers primary, then fallback, then default", () => {
  assert.equal(getPositiveNutritionNumber(10, 20), 10);
  assert.equal(getPositiveNutritionNumber(0, 20), 20);
  assert.equal(getPositiveNutritionNumber(-1, "15"), 15);
  assert.equal(getPositiveNutritionNumber("bad", 0, 100), 100);
});
