import assert from "node:assert/strict";
import test from "node:test";

import {
  BASIC_WORKOUT_LONG_PLAN_ACCESS_STORAGE_KEY,
  createBasicWorkoutLongPlanAccessRecord,
  getBasicWorkoutLongPlanAccessStorageKey,
  hasBasicWorkoutLongPlanAccess,
  isBasicWorkoutLongPlanAccessCode
} from "../src/utils/basicWorkoutLongPlanAccess.js";

test("the four-week basic workout access code accepts only the configured one-time code", () => {
  assert.equal(isBasicWorkoutLongPlanAccessCode("1111"), true);
  assert.equal(isBasicWorkoutLongPlanAccessCode(" 1111 "), true);
  assert.equal(isBasicWorkoutLongPlanAccessCode("1112"), false);
  assert.equal(isBasicWorkoutLongPlanAccessCode(""), false);
});

test("the four-week basic workout unlock is stored independently for each user", () => {
  assert.equal(
    getBasicWorkoutLongPlanAccessStorageKey("client-a"),
    `${BASIC_WORKOUT_LONG_PLAN_ACCESS_STORAGE_KEY}:client-a`
  );
  assert.equal(
    getBasicWorkoutLongPlanAccessStorageKey(),
    BASIC_WORKOUT_LONG_PLAN_ACCESS_STORAGE_KEY
  );

  const record = createBasicWorkoutLongPlanAccessRecord("2026-08-31T12:00:00.000Z");
  assert.deepEqual(record, { activated: true, activatedAt: "2026-08-31T12:00:00.000Z" });
  assert.equal(hasBasicWorkoutLongPlanAccess(record), true);
  assert.equal(hasBasicWorkoutLongPlanAccess({ activated: false }), false);
  assert.equal(hasBasicWorkoutLongPlanAccess(null), false);
});
