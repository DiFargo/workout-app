import test from "node:test";
import assert from "node:assert/strict";
import { buildFamiliarNutritionPeriod } from "../src/utils/trainerFamiliarNutritionAnalytics.js";

const now = new Date(2026, 5, 18, 12);
const row = (date, calories, extra = {}) => ({ date, totals: { calories, ...extra } });

test("familiar nutrition only counts completed local days in selected calendar range", () => {
  const model = buildFamiliarNutritionPeriod([
    row("2026-06-10", 1900), row("2026-06-11", 2000), row("2026-06-17", 2500), row("2026-06-18", 3000), row("2026-06-19", 4000)
  ], { now });
  assert.equal(model.startKey, "2026-06-11");
  assert.equal(model.endKey, "2026-06-17");
  assert.equal(model.dayCount, 7);
  assert.equal(model.trackedDays.length, 2);
  assert.equal(model.averages.calories, 2250);
});

test("empty and malformed days do not imply zero calories or macros", () => {
  const model = buildFamiliarNutritionPeriod([row("2026-06-17", 0), row("2026-06-16", null), row("2026-02-31", 2000), row("bad", 2000)], { now });
  assert.equal(model.trackedDays.length, 0);
  assert.deepEqual(model.averages, { calories: null, protein: null, fat: null, carbs: null });
});

test("missing macros are not manufactured as zero and explicit zero remains valid", () => {
  const model = buildFamiliarNutritionPeriod([row("2026-06-17", 2000, { protein: 100, fat: 0 }), row("2026-06-16", 2200, { protein: "", fat: null, carbs: 200 })], { now });
  assert.deepEqual(model.averages, { calories: 2100, protein: 100, fat: 0, carbs: 200 });
  assert.deepEqual(model.recordedCounts, { calories: 2, protein: 1, fat: 1, carbs: 1 });
});

test("duplicate day snapshots cannot inflate coverage or averages", () => {
  const model = buildFamiliarNutritionPeriod([row("2026-06-17", 0), row("2026-06-17", 2000), row("2026-06-17", 2300)], { now });
  assert.equal(model.chartDays.length, 1);
  assert.equal(model.trackedDays.length, 1);
  assert.equal(model.averages.calories, 2000);
});

test("custom calendar span is inclusive and does not use record count as its denominator", () => {
  const model = buildFamiliarNutritionPeriod([row("2026-06-10", 1900), row("2026-06-12", 2100)], { now, period: "custom", customStart: "2026-06-10", customEnd: "2026-06-15" });
  assert.equal(model.dayCount, 6);
  assert.equal(model.trackedDays.length, 2);
  assert.equal(model.averages.calories, 2000);
});

test("invalid, reversed or unfinished custom ranges show validation instead of false empty data", () => {
  for (const [start, end] of [["2026-06-17", "2026-06-12"], ["2026-06-12", "2026-06-18"], ["2026-02-31", "2026-06-17"]]) {
    const model = buildFamiliarNutritionPeriod([row("2026-06-17", 2000)], { now, period: "custom", customStart: start, customEnd: end });
    assert.ok(model.validationError);
    assert.equal(model.trackedDays.length, 0);
  }
});

test("an end-only range before the first record is empty, not an inverted-date error", () => {
  const model = buildFamiliarNutritionPeriod([row("2026-06-17", 2000)], { now, period: "custom", customEnd: "2026-06-07" });
  assert.equal(model.validationError, "");
  assert.equal(model.trackedDays.length, 0);
});
