import assert from "node:assert/strict";
import test from "node:test";

import {
  BASIC_WORKOUT_TODAY_GENERATION_STORAGE_KEY,
  BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY,
  consumeBasicWorkoutTodayGeneration,
  getBasicWorkoutTodayGenerationAllowance,
  getBasicWorkoutTodayGenerationDateKey,
  getBasicWorkoutTodayGenerationStorageKey
} from "../src/utils/basicWorkoutTodayGenerationLimit.js";

test("today-workout generations are limited to three per local calendar day", () => {
  const dateKey = "2026-08-31";
  let record = null;

  assert.deepEqual(getBasicWorkoutTodayGenerationAllowance(record, dateKey), {
    dateKey,
    used: 0,
    remaining: BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY,
    isLimitReached: false
  });

  for (let index = 1; index <= BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY; index += 1) {
    const result = consumeBasicWorkoutTodayGeneration(record, dateKey);
    assert.equal(result.consumed, true);
    assert.equal(result.used, index);
    record = result.nextRecord;
  }

  const blocked = consumeBasicWorkoutTodayGeneration(record, dateKey);
  assert.equal(blocked.consumed, false);
  assert.equal(blocked.used, BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.isLimitReached, true);
});

test("today-workout generation availability resets on the next local day", () => {
  const exhaustedRecord = { dateKey: "2026-08-31", count: BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY };

  assert.equal(getBasicWorkoutTodayGenerationAllowance(exhaustedRecord, "2026-08-31").isLimitReached, true);
  assert.deepEqual(getBasicWorkoutTodayGenerationAllowance(exhaustedRecord, "2026-09-01"), {
    dateKey: "2026-09-01",
    used: 0,
    remaining: BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY,
    isLimitReached: false
  });
});

test("today-workout generation records stay isolated by account and use local calendar dates", () => {
  assert.equal(
    getBasicWorkoutTodayGenerationStorageKey("client-a"),
    `${BASIC_WORKOUT_TODAY_GENERATION_STORAGE_KEY}:client-a`
  );
  assert.equal(getBasicWorkoutTodayGenerationStorageKey(), BASIC_WORKOUT_TODAY_GENERATION_STORAGE_KEY);
  assert.equal(getBasicWorkoutTodayGenerationDateKey(new Date(2026, 7, 31, 0, 5)), "2026-08-31");
});
