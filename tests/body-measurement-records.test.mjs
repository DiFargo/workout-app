import test from "node:test";
import assert from "node:assert/strict";
import { isBodyMeasurementRecord } from "../src/utils/bodyMeasurementRecords.js";

test("weight check-ins never replace the last two body measurements", () => {
  const records = [
    { id: "weight", measurementType: "weight_checkin", weight: 92.5, chest: 100 },
    { id: "body", measurementType: "body_measurement", weight: 92, chest: 100 },
    { id: "old-weight", weight: 93 },
    { id: "old-body", values: { weight: 94, waist: "90,5" } }
  ];
  assert.deepEqual(records.filter(isBodyMeasurementRecord).map((item) => item.id), ["body", "old-body"]);
  assert.equal(isBodyMeasurementRecord({ weight: 90, neck: "", chest: 0 }), false);
  assert.equal(isBodyMeasurementRecord(null), false);
});
