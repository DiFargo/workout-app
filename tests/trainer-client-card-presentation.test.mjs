import assert from "node:assert/strict";
import test from "node:test";
import {
  getLatestTrainerWeightMeasurement,
  getTrainerPhotoCompareSelection
} from "../src/utils/trainerClientCardPresentation.js";

test("latest weight is the actual newest weight record, not the newest body record", () => {
  const body = Object.freeze({ id: "body", date: "2026-10-29", values: Object.freeze({ chest: 109 }) });
  const weight = Object.freeze({ id: "quick", date: "2026-10-28", weight: "92,5", source: "quick-weight" });
  const older = Object.freeze({ id: "old", date: "2026-09-01", weight: 92 });
  const records = Object.freeze([older, body, weight]);
  assert.equal(getLatestTrainerWeightMeasurement(records), weight);
  assert.deepEqual(records, [older, body, weight]);
});

test("weight validity matches field fallback and never turns blank, zero or infinity into a measurement", () => {
  const valid = { id: "valid", date: "2026-10-01", weight: "", values: { weight: "91,25" } };
  const invalid = ["", " ", null, undefined, NaN, 0, "0", -1, Infinity, "bad"].map((weight, index) => ({
    id: `invalid-${index}`, date: "2026-10-29", weight
  }));
  assert.equal(getLatestTrainerWeightMeasurement([...invalid, valid]), valid);
  assert.equal(getLatestTrainerWeightMeasurement(invalid), null);
  assert.equal(getLatestTrainerWeightMeasurement(null), null);
});

test("latest weight supports existing timestamp forms and updatedAt without changing date precedence", () => {
  const rows = [
    { id: "saved", savedAt: "2026-10-01", weight: 90 },
    { id: "updated", updatedAt: "2026-10-10", weight: 91 },
    { id: "seconds", date: { seconds: Date.parse("2026-10-20") / 1000 }, weight: 92 },
    { id: "millis", createdAt: { toMillis: () => Date.parse("2026-10-25") }, weight: 93 },
    { id: "date", date: { toDate: () => new Date("2026-10-28") }, values: { weight: 94 } },
    { id: "precedence", date: "2026-09-01", createdAt: "2026-10-29", weight: 95 }
  ];
  assert.equal(getLatestTrainerWeightMeasurement(rows), rows[4]);
});

test("photo defaults use the latest two distinct dates, in chronological order", () => {
  const old = { id: "old", date: "2026-06-16" };
  const middle = { id: "middle", date: "2026-07-29" };
  const recent = { id: "recent", date: "2026-09-01" };
  const selection = getTrainerPhotoCompareSelection([recent, old, middle]);
  assert.deepEqual(selection.ids, ["middle", "recent"]);
  assert.deepEqual(selection.photos, [middle, recent]);
  assert.deepEqual(selection.options.map(item => item.id), ["old", "middle", "recent"]);
  assert.equal(selection.hasChronologicalPair, true);
});

test("changing a comparison side preserves the requested session when it has a chronological neighbour", () => {
  const photos = [1, 2, 3, 4].map(day => ({ id: `p${day}`, date: `2026-10-0${day}` }));
  assert.deepEqual(getTrainerPhotoCompareSelection(photos, ["p3", "p2"], 0).ids, ["p3", "p4"]);
  assert.deepEqual(getTrainerPhotoCompareSelection(photos, ["p3", "p2"], 1).ids, ["p1", "p2"]);
  assert.deepEqual(getTrainerPhotoCompareSelection(photos, ["p2", "p2"], 0).ids, ["p2", "p3"]);
  assert.deepEqual(getTrainerPhotoCompareSelection(photos, ["p3", "p3"], 1).ids, ["p2", "p3"]);
});

test("boundary and reversed choices resolve to a real strict pair, never a duplicate", () => {
  const photos = [1, 2, 3].map(day => ({ id: `p${day}`, date: `2026-10-0${day}` }));
  assert.deepEqual(getTrainerPhotoCompareSelection(photos, ["p3", "p1"]).ids, ["p1", "p3"]);
  assert.deepEqual(getTrainerPhotoCompareSelection(photos, ["p3", "p1"], 0).ids, ["p2", "p3"]);
  assert.deepEqual(getTrainerPhotoCompareSelection(photos, ["p3", "p1"], 1).ids, ["p1", "p2"]);
});

test("one photo and equal timestamps remain one neutral photo rather than a fabricated before/after", () => {
  const photo = { id: "only", date: "2026-10-01" };
  const one = getTrainerPhotoCompareSelection([photo], ["only", "only"]);
  assert.deepEqual(one.photos, [photo]);
  assert.equal(one.hasChronologicalPair, false);
  const equal = getTrainerPhotoCompareSelection([photo, { id: "same-time", date: "2026-10-01" }]);
  assert.equal(equal.photos.length, 1);
  assert.equal(equal.hasChronologicalPair, false);
});

test("invalid or missing dates cannot become a dated comparison option", () => {
  const valid = { id: "valid", date: "2026-10-01" };
  const invalid = { id: "invalid", date: "not-a-date", createdAt: "2026-10-29" };
  const overflow = { id: "overflow", date: "2026-02-30" };
  const selection = getTrainerPhotoCompareSelection([invalid, overflow, valid]);
  assert.deepEqual(selection.ids, ["valid"]);
  assert.deepEqual(selection.options.map(item => item.id), ["valid"]);
  assert.equal(selection.hasChronologicalPair, false);
  const fallback = getTrainerPhotoCompareSelection([invalid, overflow], ["overflow", ""]);
  assert.deepEqual(fallback.photos, [overflow]);
  assert.deepEqual(fallback.options, []);
  assert.equal(fallback.hasChronologicalPair, false);
  assert.deepEqual(getTrainerPhotoCompareSelection(null).ids, []);
});

test("photo IDs preserve saved/string identities and give Timestamp objects distinct stable fallbacks", () => {
  const stringDate = { date: "2026-09-01" };
  const seconds = { createdAt: { seconds: Date.parse("2026-10-01") / 1000 } };
  const millis = { date: { toMillis: () => Date.parse("2026-10-02") } };
  const selection = getTrainerPhotoCompareSelection([millis, stringDate, seconds]);
  assert.deepEqual(selection.options.map(item => item.id), ["2026-09-01", `photo-${Date.parse("2026-10-01")}`, `photo-${Date.parse("2026-10-02")}`]);
  assert.deepEqual(selection.ids, [`photo-${Date.parse("2026-10-01")}`, `photo-${Date.parse("2026-10-02")}`]);
  const datedUpload = { date: "2026-08-01", createdAt: { seconds: Date.parse("2026-10-03") / 1000 } };
  assert.equal(getTrainerPhotoCompareSelection([datedUpload]).ids[0], `photo-${Date.parse("2026-10-03")}`);
});

test("selection does not mutate frozen photos or request IDs and deduplicates a saved session", () => {
  const first = Object.freeze({ id: "p1", date: "2026-10-01" });
  const second = Object.freeze({ id: "p2", date: "2026-10-02" });
  const photos = Object.freeze([second, first, second]);
  const requested = Object.freeze(["p1", "p2"]);
  const selection = getTrainerPhotoCompareSelection(photos, requested);
  assert.deepEqual(selection.photos, [first, second]);
  assert.equal(selection.photos[0], first);
  assert.equal(selection.photos[1], second);
  assert.equal(selection.options.length, 2);
  assert.deepEqual(photos, [second, first, second]);
  assert.deepEqual(requested, ["p1", "p2"]);
});
