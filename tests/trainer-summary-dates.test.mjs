import test from "node:test";
import assert from "node:assert/strict";

import {
  formatTrainerSummaryDate,
  getTrainerAssignmentVersionKey,
  getTrainerSummaryDateKey,
  getTrainerSummaryTimestamp,
  getTrainerSummaryWeekStart
} from "../src/utils/trainerSummaryDates.js";

test("trainer summary timestamp reads date keys at midday", () => {
  const timestamp = getTrainerSummaryTimestamp("2026-06-17");
  const date = new Date(timestamp);

  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 5);
  assert.equal(date.getDate(), 17);
  assert.equal(date.getHours(), 12);
});

test("trainer summary date helpers format stable keys and labels", () => {
  assert.equal(getTrainerSummaryDateKey("2026-06-17T08:30:00"), "2026-06-17");
  assert.equal(formatTrainerSummaryDate("2026-06-17"), "17.06");
});

test("trainer summary week start returns monday", () => {
  assert.equal(getTrainerSummaryDateKey(getTrainerSummaryWeekStart("2026-06-18")), "2026-06-15");
});

test("trainer assignment version key preserves raw fallback values", () => {
  assert.equal(getTrainerAssignmentVersionKey("manual-version"), "manual-version");
  assert.equal(getTrainerAssignmentVersionKey({ seconds: 10 }), "10000");
});
