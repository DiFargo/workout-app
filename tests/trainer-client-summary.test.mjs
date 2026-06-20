import test from "node:test";
import assert from "node:assert/strict";

import {
  getClientActivityStatus,
  getClientAttentionReasons,
  getTrainerDayWord,
  getTrainerNutritionSummary
} from "../src/utils/trainerClientSummary.js";
import { getTrainerSummaryDateKey } from "../src/utils/trainerSummaryDates.js";

function dateKeyOffset(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return getTrainerSummaryDateKey(date.getTime());
}

test("trainer nutrition summary excludes today from seven day average", () => {
  const today = dateKeyOffset(0);
  const yesterday = dateKeyOffset(-1);
  const twoDaysAgo = dateKeyOffset(-2);
  const eightDaysAgo = dateKeyOffset(-8);
  const summary = getTrainerNutritionSummary({
    days: {
      [today]: { foods: [{ calories: 5000 }] },
      [yesterday]: { foods: [{ calories: 2000 }] },
      [twoDaysAgo]: { foods: [{ calories: 1000 }] },
      [eightDaysAgo]: { foods: [{ calories: 3000 }] }
    }
  });

  assert.equal(summary.lastNutritionAt, today);
  assert.equal(summary.nutritionDays7, 2);
  assert.equal(summary.averageCalories7, 1500);
});

test("trainer client activity status detects missing program, lost and active states", () => {
  assert.deepEqual(getClientActivityStatus({}), { id: "noProgram", label: "Без программы" });
  assert.deepEqual(
    getClientActivityStatus({ assignedProgramId: "p1", lastWorkoutAt: dateKeyOffset(-15) }),
    { id: "lost", label: "Пропал" }
  );
  assert.deepEqual(
    getClientActivityStatus({
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-1),
      lastNutritionAt: dateKeyOffset(-1),
      lastMeasurementAt: dateKeyOffset(-7)
    }),
    { id: "active", label: "Активный" }
  );
});

test("trainer client attention reasons stay compact and readable", () => {
  assert.deepEqual(getClientAttentionReasons({}), ["нет программы"]);
  assert.deepEqual(
    getClientAttentionReasons({
      assignedProgramId: "p1",
      lastWorkoutAt: dateKeyOffset(-8),
      lastNutritionAt: dateKeyOffset(-6),
      lastMeasurementAt: dateKeyOffset(-31)
    }),
    [
      `нет тренировок 8 ${getTrainerDayWord(8)}`,
      `нет питания 6 ${getTrainerDayWord(6)}`,
      `нет замера 31 ${getTrainerDayWord(31)}`
    ]
  );
});
