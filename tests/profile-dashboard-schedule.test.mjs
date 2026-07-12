import test from "node:test";
import assert from "node:assert/strict";

import { getProfileDashboardScheduleDates } from "../src/features/client/profile/profileDashboardModel.js";

test("profile dashboard schedule prefers saved calendar dates", () => {
  assert.deepEqual(
    getProfileDashboardScheduleDates(
      ["2026-07-08"],
      [{ scheduledDate: "2026-07-06" }]
    ),
    ["2026-07-08"]
  );
});

test("profile dashboard schedule falls back to assigned workout dates", () => {
  assert.deepEqual(
    getProfileDashboardScheduleDates(
      [],
      [
        { scheduledDate: "2026-07-08" },
        { plannedDate: "2026-07-06" },
        { scheduledDate: "bad-date" }
      ]
    ),
    ["2026-07-06", "2026-07-08"]
  );
});
