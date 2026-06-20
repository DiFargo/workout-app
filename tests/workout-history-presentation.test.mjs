import test from "node:test";
import assert from "node:assert/strict";

import {
  formatHistoryCardDate,
  formatHistoryTime,
  getHistorySetCount,
  getHistoryTopExercise,
  getHistoryVolume,
  getHistoryWorkoutParts
} from "../src/utils/workoutHistoryPresentation.js";

test("history presentation formats workout date and time", () => {
  assert.match(formatHistoryCardDate("2026-06-17T08:30:00"), /17\s+июн/);
  assert.match(formatHistoryCardDate("2026-06-17T08:30:00", true), /2026/);
  assert.match(formatHistoryTime("2026-06-17T08:30:00"), /08:30/);
  assert.equal(formatHistoryCardDate("bad-date"), "без даты");
  assert.equal(formatHistoryTime("bad-date"), "");
});

test("history presentation splits workout day and title", () => {
  assert.deepEqual(getHistoryWorkoutParts("Неделя 1 — Спина — День силы"), {
    day: "Неделя 1",
    title: "Спина • День силы"
  });
  assert.deepEqual(getHistoryWorkoutParts(""), {
    day: "Тренировка",
    title: "Без названия"
  });
});

test("history presentation summarizes sets, volume and top exercise", () => {
  const item = {
    exercises: [
      {
        name: "Жим лежа",
        sets: [
          { reps: 10, weight: "50" },
          { reps: 8, weight: "52,5" }
        ]
      },
      {
        name: "Пресс",
        sets: [{ reps: 12, weight: "" }]
      }
    ]
  };

  assert.equal(getHistorySetCount(item), 3);
  assert.equal(getHistoryVolume(item), 920);
  assert.equal(getHistoryTopExercise(item), "Жим лежа");
  assert.equal(getHistoryTopExercise({ exercises: [] }), "Без упражнений");
});
