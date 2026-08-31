import assert from "node:assert/strict";
import test from "node:test";
import { getFoodIcon } from "../src/utils/nutritionFoodPresentation.js";

test("tomatoes receive a tomato icon instead of the generic vegetable icon", () => {
  assert.equal(getFoodIcon({ name: "Помидоры" }), "🍅");
  assert.equal(getFoodIcon({ name: "Томаты черри" }), "🍅");
  assert.equal(getFoodIcon({ name: "Tomato" }), "🍅");
});

test("generic vegetable icon remains assigned to broccoli", () => {
  assert.equal(getFoodIcon({ name: "Брокколи" }), "🥦");
});
