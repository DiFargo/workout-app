import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_TRAINER_LINKED_PROFILE_CONCURRENCY,
  MAX_TRAINER_SUMMARY_CONCURRENCY,
  mapWithConcurrency
} from "../src/utils/trainerDataReadLimits.js";

test("trainer summary and linked-profile reads have explicit bounded concurrency", () => {
  assert.equal(MAX_TRAINER_SUMMARY_CONCURRENCY, 4);
  assert.equal(MAX_TRAINER_LINKED_PROFILE_CONCURRENCY, 6);
});

test("linked profile reader never exceeds its configured worker count", async () => {
  let active = 0;
  let peak = 0;
  const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 2;
  });

  assert.ok(peak <= 3);
  assert.deepEqual(results.map((result) => result.value), [2, 4, 6, 8, 10, 12, 14, 16]);
});
