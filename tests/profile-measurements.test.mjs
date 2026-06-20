import test from "node:test";
import assert from "node:assert/strict";

import {
  formatProfileMeasurementDate,
  formatProfileProgressPhotoDate,
  getMeasurementTimestampValue,
  getProfileMeasurementFields,
  getProfileMeasurementGoalText,
  getProfileMeasurementValue
} from "../src/utils/profileMeasurements.js";

test("profile measurement fields include the full measurement wizard set", () => {
  const fields = getProfileMeasurementFields();

  assert.equal(fields.length, 12);
  assert.deepEqual(fields.map((field) => field.id), [
    "weight",
    "neck",
    "shoulders",
    "chest",
    "biceps",
    "forearm",
    "wrist",
    "belly",
    "pelvis",
    "thigh",
    "calf",
    "ankle"
  ]);
});

test("profile measurement goal text covers the main goals", () => {
  assert.match(getProfileMeasurementGoalText("mass"), /набора/);
  assert.match(getProfileMeasurementGoalText("cut"), /похудения/);
  assert.match(getProfileMeasurementGoalText("dry"), /похудения/);
  assert.match(getProfileMeasurementGoalText("maintain"), /поддержки/);
  assert.match(getProfileMeasurementGoalText("recomp"), /рекомпозиции/);
});

test("profile measurement timestamps prefer available saved dates", () => {
  assert.equal(getMeasurementTimestampValue({ date: "2026-06-18T10:00:00.000Z" }), Date.parse("2026-06-18T10:00:00.000Z"));
  assert.equal(getMeasurementTimestampValue({ savedAt: "2026-06-19T10:00:00.000Z" }), Date.parse("2026-06-19T10:00:00.000Z"));
  assert.equal(getMeasurementTimestampValue({ date: "bad-date" }), 0);
});

test("profile measurement date and values stay user friendly", () => {
  assert.equal(formatProfileMeasurementDate(null), "Замеров пока нет");
  assert.equal(formatProfileMeasurementDate({}), "Дата не указана");
  assert.equal(formatProfileMeasurementDate({ date: "bad-date" }), "Дата не указана");
  assert.equal(getProfileMeasurementValue({ weight: 0 }, { id: "weight" }), "0");
  assert.equal(getProfileMeasurementValue({ weight: " 89.5 " }, { id: "weight" }), "89.5");
  assert.equal(getProfileMeasurementValue({}, { id: "weight" }), "—");
});

test("profile progress photo date uses saved day fields", () => {
  assert.equal(formatProfileProgressPhotoDate(null), "Дата не указана");
  assert.equal(formatProfileProgressPhotoDate({ date: "bad-date" }), "Дата не указана");
  assert.equal(formatProfileProgressPhotoDate({ date: "2026-06-18" }), "18.06.2026");
  assert.equal(formatProfileProgressPhotoDate({ createdAt: "2026-06-19T10:30:00.000Z" }), "19.06.2026");
});
