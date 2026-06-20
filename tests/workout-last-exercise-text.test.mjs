import test from "node:test";
import assert from "node:assert/strict";

import { getLastExerciseText } from "../src/utils/workoutHistoryPresentation.js";

test("workout history presentation formats previous exercise result text", () => {
  assert.equal(
    getLastExerciseText({ id: "bench" }, { "id:bench": "3×10 · 60 кг" }),
    "Прошлый раз: 3×10 · 60 кг"
  );
  assert.equal(
    getLastExerciseText({ name: "Жим  лёжа" }, { "name:жим лёжа": "2 подхода · 20 повторов" }),
    "Прошлый раз: 2 подхода · 20 повторов"
  );
  assert.equal(getLastExerciseText({ id: "missing" }, {}), "Прошлый раз: нет данных");
});
