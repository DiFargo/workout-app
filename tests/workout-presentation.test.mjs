import test from "node:test";
import assert from "node:assert/strict";

import { getWorkoutPresentationTitle } from "../src/domain/workoutPresentation.js";

test("workout presentation title prefers explicit workout name segment", () => {
  assert.equal(
    getWorkoutPresentationTitle({ name: "Неделя 1 · День 2 · Спина + плечи" }, 2),
    "Спина и плечи"
  );
});

test("workout presentation title falls back to detected exercise groups", () => {
  assert.equal(
    getWorkoutPresentationTitle({
      exercises: [
        { name: "Жим лежа" },
        { name: "Разгибание рук" }
      ]
    }, 1),
    "Грудь и руки"
  );
});
