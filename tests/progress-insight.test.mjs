import test from "node:test";
import assert from "node:assert/strict";
import { buildProgressInsight, buildProgressScore } from "../src/utils/progressInsight.js";

const now = new Date("2026-06-13T12:00:00.000Z");

test("progress insight celebrates a higher working weight", () => {
  const result = buildProgressInsight({
    now,
    history: [
      {
        date: "2026-06-13T09:00:00.000Z",
        exercises: [{ name: "Bench press", sets: [{ weight: 55, completed: true }] }]
      },
      {
        date: "2026-06-10T09:00:00.000Z",
        exercises: [{ name: "Bench press", sets: [{ weight: 50, completed: true }] }]
      }
    ]
  });

  assert.equal(result.tone, "positive");
  assert.match(result.title, /Рабочий вес вырос/);
  assert.equal(result.statuses[0].text, "+5 кг");
});

test("progress insight reacts to a fresh measurement", () => {
  const result = buildProgressInsight({
    now,
    measurements: [{ date: "2026-06-13T08:00:00.000Z", weight: 89 }]
  });

  assert.match(result.title, /Новый замер добавлен/);
  assert.equal(result.statuses[1].text, "сегодня");
});

test("progress insight supports the user after exceeding calories", () => {
  const result = buildProgressInsight({
    now,
    calorieGoal: 2000,
    proteinGoal: 150,
    nutrition: {
      days: {
        "2026-06-13": {
          foods: [{ calories: 2300, protein: 120 }]
        }
      }
    }
  });

  assert.equal(result.tone, "supportive");
  assert.match(result.description, /Ничего страшного/);
  assert.equal(result.statuses[2].text, "+300 ккал");
});

test("progress insight recognizes a day close to the nutrition plan", () => {
  const result = buildProgressInsight({
    now,
    calorieGoal: 2000,
    proteinGoal: 150,
    nutrition: {
      days: {
        "2026-06-13": {
          foods: [{ calories: 1850, protein: 125 }]
        }
      }
    }
  });

  assert.match(result.title, /Питание по плану/);
  assert.equal(result.statuses[2].text, "по плану");
});

test("progress score combines workouts, nutrition, measurements and consistency", () => {
  const result = buildProgressScore({
    now,
    goal: "recomp",
    calorieGoal: 2000,
    proteinGoal: 150,
    scheduledDates: ["2026-06-06", "2026-06-10", "2026-06-13"],
    history: [
      { date: "2026-06-13T09:00:00.000Z", exercises: [] },
      { date: "2026-06-10T09:00:00.000Z", exercises: [] },
      { date: "2026-06-06T09:00:00.000Z", exercises: [] }
    ],
    measurements: [
      { date: "2026-06-12T08:00:00.000Z", weight: 89, belly: 82 },
      { date: "2026-06-01T08:00:00.000Z", weight: 89.4, belly: 84 }
    ],
    nutrition: {
      days: Object.fromEntries(
        ["07", "08", "09", "10", "11", "12", "13"].map((day) => [
          `2026-06-${day}`,
          { foods: [{ calories: 1900, protein: 140 }] }
        ])
      )
    }
  });

  assert.ok(result.score >= 85);
  assert.equal(result.components.length, 4);
  assert.equal(result.label, "Отличный темп");
});

test("progress score does not punish a new user for missing categories", () => {
  const result = buildProgressScore({
    now,
    history: [{ date: "2026-06-13T09:00:00.000Z", exercises: [] }]
  });

  assert.ok(result.score >= 60);
  assert.ok(result.components.some((component) => component.id === "workouts"));
  assert.ok(!result.components.some((component) => component.id === "nutrition"));
});

test("progress score remains empty without tracked data", () => {
  const result = buildProgressScore({ now });

  assert.equal(result.score, null);
  assert.equal(result.confidence, 0);
});
