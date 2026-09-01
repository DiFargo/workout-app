import assert from "node:assert/strict";
import test from "node:test";

import { awaitNutritionSearchResult } from "../src/utils/nutritionSearchDeadline.js";

test("nutrition search deadline keeps an immediate local result responsive", async () => {
  const result = await awaitNutritionSearchResult(Promise.resolve(["локально"]), 20);
  assert.deepEqual(result, ["локально"]);
});

test("nutrition search deadline stops waiting for a stalled source", async () => {
  await assert.rejects(
    awaitNutritionSearchResult(new Promise(() => {}), 15, "source timed out"),
    /source timed out/
  );
});
