import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNutritionCalendarDays,
  buildNutritionCurrentStreak,
  buildNutritionWeekDates,
  formatNutritionCalendarMonthLabel,
  shiftNutritionCalendarMonthKey
} from "../src/utils/nutritionCalendar.js";

test("nutrition week dates start on monday around selected date", () => {
  const week = buildNutritionWeekDates("2026-06-18");

  assert.deepEqual(week.map((day) => day.key), [
    "2026-06-15",
    "2026-06-16",
    "2026-06-17",
    "2026-06-18",
    "2026-06-19",
    "2026-06-20",
    "2026-06-21"
  ]);
  assert.deepEqual(week.map((day) => day.label), ["П", "В", "С", "Ч", "П", "С", "В"]);
});

test("nutrition current streak counts consecutive days with food", () => {
  const days = {
    "2026-06-16": { foods: [{ name: "breakfast" }] },
    "2026-06-17": { foods: [{ name: "lunch" }] },
    "2026-06-18": { foods: [{ name: "dinner" }] }
  };

  assert.equal(buildNutritionCurrentStreak(days, "2026-06-18"), 3);
  assert.equal(buildNutritionCurrentStreak(days, "2026-06-19"), 0);
});

test("nutrition calendar days include food totals and selected flags", () => {
  const days = buildNutritionCalendarDays({
    monthKey: "2026-06",
    selectedDateKey: "2026-06-18",
    todayKey: "2026-06-20",
    nutrition: {
      goals: { calories: 200 },
      days: {
        "2026-06-18": {
          foods: [
            { calories: 120, protein: 10 },
            { calories: 130, protein: 15 }
          ]
        }
      }
    }
  });
  const selected = days.find((day) => day.key === "2026-06-18");

  assert.equal(days.length, 42);
  assert.equal(days[0].key, "2026-06-01");
  assert.equal(selected.isSelected, true);
  assert.equal(selected.isToday, false);
  assert.equal(selected.hasFood, true);
  assert.equal(selected.foodCount, 2);
  assert.equal(selected.calories, 250);
  assert.equal(selected.protein, 25);
  assert.equal(selected.isOverGoal, true);
  assert.equal(days.find((day) => day.key === "2026-06-20").isToday, true);
});

test("nutrition calendar month label is formatted from month key", () => {
  assert.equal(formatNutritionCalendarMonthLabel("2026-06", "ru-RU"), "июнь 2026 г.");
});

test("nutrition calendar month shift keeps stable yyyy-mm keys", () => {
  assert.equal(shiftNutritionCalendarMonthKey("2026-06", -1), "2026-05");
  assert.equal(shiftNutritionCalendarMonthKey("2026-12", 1), "2027-01");
  assert.equal(shiftNutritionCalendarMonthKey("2026-01", -1), "2025-12");
});
