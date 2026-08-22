import test from "node:test";
import assert from "node:assert/strict";

import {
  formatProfileMeasurementDate,
  formatProfileProgressPhotoDate,
  getMeasurementTimestampValue,
  getProfileMeasurementDelta,
  getProfileMeasurementFields,
  getProfileMeasurementGoalText,
  getProfileMeasurementValue,
  getProfileMeasurementValueById,
  validateProfileMeasurementDraft,
  validateProfileMeasurementValue
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

test("profile measurement values can be selected by field id", () => {
  const fields = getProfileMeasurementFields();

  assert.equal(getProfileMeasurementValueById({ belly: " 88 " }, fields, "belly"), "88");
  assert.equal(getProfileMeasurementValueById({ belly: "88" }, fields, "unknown"), "");
  assert.equal(getProfileMeasurementValueById(null, fields, "belly"), "");
});

test("profile measurement delta handles decimals and invalid values", () => {
  assert.equal(getProfileMeasurementDelta("89,5", "88.2"), 1.3);
  assert.equal(getProfileMeasurementDelta("88.2", "89.5"), -1.3);
  assert.equal(getProfileMeasurementDelta("", "89.5"), null);
  assert.equal(getProfileMeasurementDelta("bad", "89.5"), null);
});

test("measurement values accept practical decimal values and normalize commas", () => {
  const weight = getProfileMeasurementFields().find((field) => field.id === "weight");
  const neck = getProfileMeasurementFields().find((field) => field.id === "neck");

  assert.deepEqual(validateProfileMeasurementValue(weight, "89,50"), {
    valid: true,
    empty: false,
    value: "89.5",
    numericValue: 89.5,
    error: ""
  });
  assert.equal(validateProfileMeasurementValue(neck, "").valid, true);
  assert.equal(validateProfileMeasurementValue(neck, "three").valid, false);
  assert.equal(validateProfileMeasurementValue(weight, "999").valid, false);
});

test("measurement draft blocks malformed or out-of-range values before saving", () => {
  const fields = getProfileMeasurementFields();
  const draft = validateProfileMeasurementDraft({
    weight: "82,4",
    chest: "120",
    wrist: "999"
  }, fields);

  assert.equal(draft.hasValue, true);
  assert.equal(draft.valid, false);
  assert.equal(draft.values.weight, "82.4");
  assert.equal(draft.values.chest, "120");
  assert.match(draft.errors.wrist, /от 8 до 50/);
  assert.match(draft.firstError, /Запястье/);
});

test("profile progress photo date uses saved day fields", () => {
  assert.equal(formatProfileProgressPhotoDate(null), "Дата не указана");
  assert.equal(formatProfileProgressPhotoDate({ date: "bad-date" }), "Дата не указана");
  assert.equal(formatProfileProgressPhotoDate({ date: "2026-06-18" }), "18.06.2026");
  assert.equal(formatProfileProgressPhotoDate({ createdAt: "2026-06-19T10:30:00.000Z" }), "19.06.2026");
});
