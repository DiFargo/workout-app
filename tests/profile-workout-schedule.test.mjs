import test from "node:test";
import assert from "node:assert/strict";

import {
  formatProfileWorkoutDate,
  getProfileNextTrainingText
} from "../src/utils/profileWorkoutSchedule.js";

function dateKeyOffset(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

test("profile workout date label handles valid and invalid values", () => {
  assert.match(formatProfileWorkoutDate("2026-06-17"), /17\s+июн/);
  assert.equal(formatProfileWorkoutDate("bad-date"), "Нет данных");
  assert.equal(formatProfileWorkoutDate(""), "Нет данных");
});

test("profile next training prefers explicit scheduled dates", () => {
  assert.equal(getProfileNextTrainingText({}, {}, [dateKeyOffset(0)]), "Сегодня");
  assert.equal(getProfileNextTrainingText({}, {}, [dateKeyOffset(1)]), "Завтра");
});

test("profile next training falls back to weekly pattern and workout time", () => {
  assert.equal(getProfileNextTrainingText({}, {}, []), "Не выбрано");
  assert.match(
    getProfileNextTrainingText({ trainingDays: ["mon"], workoutTime: "10:30" }, {}, []),
    /(?:Пн|mon) · 10:30/
  );
});
