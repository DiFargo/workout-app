import test from "node:test";
import assert from "node:assert/strict";

import {
  getAdminWeightPoints,
  getAdminWorkoutProgressList
} from "../src/utils/adminClientProgress.js";

test("admin workout progress keeps best set weight per exercise and limits entries", () => {
  const progress = getAdminWorkoutProgressList([
    {
      date: "2026-06-17",
      exercises: [
        { name: "Жим лежа", sets: [{ weight: "40" }, { weight: "42,5" }] },
        { name: "Пресс", sets: [{ weight: "" }] }
      ]
    },
    {
      date: "2026-06-19",
      exercises: [
        { name: "Жим лежа", sets: [{ weight: "45" }] },
        { name: "Тяга", sets: [{ aiSuggestedWeight: "50" }] }
      ]
    }
  ]);

  assert.equal(progress[0].name, "Тяга");
  assert.equal(progress[0].max, 50);
  assert.deepEqual(progress.find((item) => item.name === "Жим лежа").points, [
    { date: "2026-06-19", weight: 45 },
    { date: "2026-06-17", weight: 42.5 }
  ]);
});

test("admin weight points prefer valid history and fall back to current profile weight", () => {
  assert.deepEqual(getAdminWeightPoints({
    weightHistory: [
      { date: "bad", weight: 0 },
      { date: "2026-06-17", weight: "89.5" }
    ],
    profile: { weight: 88 }
  }), [{ date: "2026-06-17", weight: 89.5 }]);

  assert.deepEqual(getAdminWeightPoints({ profile: { weight: 88 } }), [
    { date: "сейчас", weight: 88 }
  ]);
});
