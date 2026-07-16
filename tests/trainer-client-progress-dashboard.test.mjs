import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildTrainerClientProgressDashboard,
  getTrainerClientAutoProgressPeriod
} from "../src/utils/trainerClientProgressDashboard.js";

const measurements = [
  { id: "m2", date: "2026-06-16", weight: 88.8, values: { weight: 88.8, belly: 88, chest: 104 } },
  { id: "m1", date: "2026-06-01", weight: 89.5, values: { weight: 89.5, belly: 90, chest: 103 } }
];

const history = [
  {
    date: "2026-06-15T18:00:00.000Z",
    exercises: [{ name: "Жим ногами", sets: [{ weight: 100, reps: 10, completed: true }] }]
  },
  {
    date: "2026-07-07T18:00:00.000Z",
    exercises: [{ name: "Жим ногами", sets: [{ weight: 110, reps: 10, completed: true }] }]
  }
];

const nutritionDays = [
  { date: "2026-06-17", totals: { calories: 2210, protein: 172 } },
  { date: "2026-06-16", totals: { calories: 2290, protein: 181 } }
];

test("builds four independent client progress series from real records", () => {
  const result = buildTrainerClientProgressDashboard({
    measurements,
    history,
    nutritionDays,
    nutritionGoals: { calories: 2300, protein: 180 },
    days: 90,
    now: new Date("2026-07-16T12:00:00.000Z")
  });

  assert.equal(result.weight.points.length, 2);
  assert.equal(result.weight.current, 88.8);
  assert.equal(result.weight.delta, -0.7);

  assert.equal(result.body.points.length, 2);
  assert.equal(result.body.contributorCount, 2);
  assert.equal(result.body.current, 1.6);

  assert.equal(result.strength.points.length, 2);
  assert.equal(result.strength.exerciseCount, 1);
  assert.equal(result.strength.current, 10.1);

  assert.equal(result.nutrition.points.length, 2);
  assert.equal(result.nutrition.trackedDays, 2);
  assert.equal(result.nutrition.average, 97.8);
});

test("does not invent progress when comparable records or nutrition targets are missing", () => {
  const result = buildTrainerClientProgressDashboard({
    measurements: measurements.slice(0, 1),
    history: history.slice(0, 1),
    nutritionDays,
    nutritionGoals: {},
    days: 90,
    now: new Date("2026-07-16T12:00:00.000Z")
  });

  assert.equal(result.weight.current, 88.8);
  assert.equal(result.weight.delta, null);
  assert.equal(result.body.current, null);
  assert.equal(result.strength.current, null);
  assert.equal(result.nutrition.current, null);
});

test("overview renders four clearly separated progress diagrams", async () => {
  const component = await readFile(new URL("../src/components/trainer/TrainerClientProgressDashboard.jsx", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");

  assert.match(component, /title: "Вес"/);
  assert.match(component, /title: "Индекс замеров"/);
  assert.match(component, /title: "Силовые показатели"/);
  assert.match(component, /title: "Питание"/);
  assert.match(component, /Это контекст, а не причина прогресса/);
  assert.match(workspace, /<TrainerClientProgressDashboard/);
  assert.match(workspace, /nutritionGoals=\{nutritionGoals\}/);
  assert.doesNotMatch(workspace, /workouts30 \|\| 0\) \* 0\.2/);
});

test("automatically selects the longest accumulated data period and keeps week for sparse data", () => {
  assert.equal(getTrainerClientAutoProgressPeriod({}), "1w");
  assert.equal(getTrainerClientAutoProgressPeriod({ measurements: [{ date: "2026-07-01" }] }), "1w");
  assert.equal(getTrainerClientAutoProgressPeriod({
    measurements: [{ date: "2026-06-01" }, { date: "2026-07-01" }],
    now: new Date("2026-07-01T12:00:00.000Z")
  }), "1m");
  assert.equal(getTrainerClientAutoProgressPeriod({
    history: [{ date: "2026-04-15" }, { date: "2026-07-01" }],
    now: new Date("2026-07-01T12:00:00.000Z")
  }), "3m");
  assert.equal(getTrainerClientAutoProgressPeriod({
    nutritionDays: [{ date: "2026-02-01" }, { date: "2026-07-01" }],
    now: new Date("2026-07-01T12:00:00.000Z")
  }), "6m");
});
