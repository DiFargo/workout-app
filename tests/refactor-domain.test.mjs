import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  formatCompactTimer,
  getDefaultWorkoutModePreference,
  getEstimatedWorkoutDuration
} from "../src/domain/workoutPresentation.js";
import {
  getClientPlateauInfo,
  getMeasurementWeightValue
} from "../src/domain/clientInsights.js";
import { searchLazyNutritionCatalog } from "../src/data/nutrition-catalog/lazyCatalog.js";

test("compact workout timer handles invalid and long values", () => {
  assert.equal(formatCompactTimer(-10), "0:00");
  assert.equal(formatCompactTimer(65), "1:05");
  assert.equal(formatCompactTimer(3605), "60:05");
});

test("explicit workout duration remains the preferred estimate", () => {
  assert.match(getEstimatedWorkoutDuration({ durationMinutes: 47.6 }), /48/);
});

test("default workout mode preference returns a fresh object", () => {
  const first = getDefaultWorkoutModePreference();
  const second = getDefaultWorkoutModePreference();

  assert.deepEqual(first, { mode: "", remember: false });
  assert.notEqual(first, second);
});

test("measurement weight accepts comma decimals and rejects invalid values", () => {
  assert.equal(getMeasurementWeightValue({ weight: "89,5" }), 89.5);
  assert.equal(getMeasurementWeightValue({ values: { weight: "75.2" } }), 75.2);
  assert.equal(getMeasurementWeightValue({ weight: "0" }), null);
  assert.equal(getMeasurementWeightValue({ weight: "unknown" }), null);
});

test("plateau detection compares measurements at least two weeks apart", () => {
  const plateau = getClientPlateauInfo([
    { weight: "80.2", date: "2026-06-11" },
    { weight: "80.0", date: "2026-05-25" }
  ]);

  assert.equal(plateau.isPlateau, true);
  assert.equal(plateau.days, 17);
  assert.equal(plateau.delta, 0.2);
});

test("lazy nutrition catalog loads once and returns local matches", async () => {
  const originalFetch = globalThis.fetch;
  const files = {
    "/nutrition-catalog/foods.compact.json": "public/nutrition-catalog/foods.compact.json",
    "/nutrition-catalog/alias-prefix-index.json": "public/nutrition-catalog/alias-prefix-index.json",
    "/nutrition-catalog/alias-exact-index.json": "public/nutrition-catalog/alias-exact-index.json"
  };
  let fetchCount = 0;

  globalThis.fetch = async (url) => {
    fetchCount += 1;
    const filePath = files[url];
    assert.ok(filePath, `Unexpected catalog URL: ${url}`);
    const data = JSON.parse(await fs.readFile(filePath, "utf8"));
    return { ok: true, json: async () => data };
  };

  try {
    const first = await searchLazyNutritionCatalog("\u043c\u043e\u043b\u043e\u043a\u043e", 8);
    const second = await searchLazyNutritionCatalog("\u043a\u0435\u0444\u0438\u0440", 8);

    assert.equal(first.length, 8);
    assert.match(first[0].name, /\u041c\u043e\u043b\u043e\u043a\u043e/i);
    assert.ok(second.length > 0);
    assert.equal(fetchCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
