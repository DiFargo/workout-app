import test from "node:test";
import assert from "node:assert/strict";

import { buildNutritionAdvice } from "../src/utils/nutritionAdvice.js";

test("nutrition advice starts with first meal guidance", () => {
  assert.match(
    buildNutritionAdvice({
      goals: { calories: 2500, protein: 190, water: 2500 },
      totals: { calories: 0, protein: 0 },
      water: 0
    }),
    /первый приём пищи/
  );
});

test("nutrition advice highlights low protein first", () => {
  assert.match(
    buildNutritionAdvice({
      goals: { calories: 2500, protein: 190, water: 2500 },
      totals: { calories: 1200, protein: 100 },
      water: 2200
    }),
    /Белка пока маловато/
  );
});

test("nutrition advice suggests light protein when calories are nearly closed", () => {
  assert.match(
    buildNutritionAdvice({
      goals: { calories: 2500, protein: 190, water: 2500 },
      totals: { calories: 2300, protein: 170 },
      water: 2200
    }),
    /Калории почти закрыты/
  );
});

test("nutrition advice can call out water without overriding food issues", () => {
  assert.match(
    buildNutritionAdvice({
      goals: { calories: 2500, protein: 190, water: 2500 },
      totals: { calories: 1900, protein: 180 },
      water: 1200
    }),
    /Воды сегодня маловато/
  );
});

test("nutrition advice stays positive when targets are fine", () => {
  assert.match(
    buildNutritionAdvice({
      goals: { calories: 2500, protein: 190, water: 2500 },
      totals: { calories: 2200, protein: 190 },
      water: 2200
    }),
    /Отличный день/
  );
});
