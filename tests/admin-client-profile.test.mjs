import test from "node:test";
import assert from "node:assert/strict";

import {
  getAdminClientGoalLabel,
  getAdminClientProfile,
  getAdminClientTrainingDaysText
} from "../src/utils/adminClientProfile.js";

test("admin client profile prefers nested profile sources", () => {
  assert.deepEqual(
    getAdminClientProfile({
      profile: { weight: 90 },
      aiNutritionProfile: { weight: 88 },
      bodyMetrics: { weight: 87 }
    }),
    { weight: 90 }
  );
  assert.deepEqual(getAdminClientProfile({ bodyMetrics: { weight: 87 } }), { weight: 87 });
});

test("admin client labels keep goal and training day text compact", () => {
  assert.equal(getAdminClientGoalLabel("mass"), "Набор массы");
  assert.equal(getAdminClientGoalLabel(""), "Рекомпозиция");
  assert.equal(getAdminClientTrainingDaysText({ trainingDays: ["mon", "wed", "sun"] }), "Пн, Ср, Вс");
  assert.equal(getAdminClientTrainingDaysText({ trainingDays: [] }), "—");
});
