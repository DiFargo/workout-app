import test from "node:test";
import assert from "node:assert/strict";
import { inventory } from "../scripts/exercise-preview-batch.mjs";
import { assertPreviewTransactionReads, planPreviewWrites } from "../scripts/apply-exercise-preview-selection.mjs";

const video = "gs://tren-85720.firebasestorage.app/exercise-videos/preview-test.mp4";
const updated = "2026-10-25T10:00:00.000Z";
function catalog() {
  return { trainerExerciseCards: [{ id: "card", name: "Жим ногами", ownerUid: "trainer", video,
    revision: 4, updatedAt: "2026-10-01T00:00:00Z", videoUpdatedAt: "2026-09-01T00:00:00Z", deletedAt: "",
    _updateTime: updated, _document: "projects/tren-85720/databases/(default)/documents/trainerExerciseCards/card" }], trainingTemplates: [],
    basicExerciseOverrides: [{ id: "leg_press", videoUrl: video, _updateTime: updated,
      _document: "projects/tren-85720/databases/(default)/documents/basicExerciseOverrides/leg_press" }] };
}
const candidates = [{ label: "V001", videos: ["V001"], duration: 10, times: [1, 2, 3, 4, 5, 6] }];
const decisions = { V001: { choice: 2, reason: "Видна ключевая фаза движения" } };
const now = "2026-10-25T11:00:00.000Z";

test("preview batch patches only selected frames and necessary card concurrency metadata", () => {
  const current = catalog(), before = structuredClone(current);
  const plan = planPreviewWrites(inventory(current), current, candidates, decisions, now);
  assert.equal(plan.changes.length, 2);
  const card = plan.changes.find(change => change.type === "card");
  assert.equal(card.write.update.fields.videoPosterTime.integerValue, "2");
  assert.equal(card.write.update.fields.revision.integerValue, "5");
  assert.equal(card.write.update.fields.videoUpdatedAt.stringValue, "2026-09-01T00:00:00Z");
  assert.equal(card.write.currentDocument.updateTime, updated);
  assert.deepEqual(plan.changes.find(change => change.type === "basic").write.updateMask.fieldPaths, ["videoPosterTime"]);
  assert.ok(plan.changes.every(change => !change.write.updateMask.fieldPaths.some(field => ["video", "videoUrl", "ownerUid", "name", "videoCrop", "sets"].includes(field))));
  assert.deepEqual(current, before);
});

test("manual zero-second frames and custom posters are never overwritten", () => {
  for (const manual of [{ videoPosterTime: 0 }, { videoPoster: "/manual.webp" }, { videoThumbnail: "/manual.webp" }]) {
    const current = catalog();
    Object.assign(current.trainerExerciseCards[0], manual);
    current.basicExerciseOverrides = [];
    assert.equal(planPreviewWrites(inventory(current), current, candidates, decisions, now).changes.length, 0);
  }
});

test("a changed revision, source, crop or newly selected frame invalidates the frozen selection", () => {
  for (const patch of [{ _updateTime: "new-time" }, { video: video.replace("preview-test", "replacement") },
    { videoCrop: { x: .3, y: .4, zoom: 1.2 } }, { videoPosterTime: 0 }]) {
    const before = catalog(); before.basicExerciseOverrides = [];
    const frozen = inventory(before), current = structuredClone(before);
    Object.assign(current.trainerExerciseCards[0], patch);
    const plan = planPreviewWrites(frozen, current, candidates, decisions, now);
    assert.equal(plan.changes.length, 0);
    assert.equal(plan.skipped[0].reason, "changed_since_review");
  }
});

test("unreviewed and out-of-range choices fail before any cloud write", () => {
  const current = catalog(), frozen = inventory(current);
  assert.throws(() => planPreviewWrites(frozen, current, candidates, {}, now), /Missing visual review/);
  assert.throws(() => planPreviewWrites(frozen, current, candidates, { V001: { choice: 7, reason: "invalid" } }, now), /Missing visual review/);
  assert.throws(() => planPreviewWrites(frozen, current, [{ ...candidates[0], duration: 1 }], decisions, now));
  assert.throws(() => planPreviewWrites(frozen, current, [{ ...candidates[0], crop: { x: .3, y: .4, zoom: 1.2 } }], decisions, now), /Unreviewed crop/);
  assert.equal(planPreviewWrites(frozen, current, candidates, { V001: { skip: true, reason: "Video does not match exercise" } }, now).changes.length, 0);
});

test("legacy transaction requires unchanged source reads and absent target cards", () => {
  const prefix = "projects/tren-85720/databases/(default)/documents/";
  const name = prefix + "trainingTemplates/source", target = prefix + "trainerExerciseCards/new";
  const plan = { verifications: [{ name, updateTime: updated }], changes: [{ type: "legacy_card", write: { update: { name: target } } }] };
  const valid = [{ found: { name, updateTime: updated } }, { missing: target }];
  assert.doesNotThrow(() => assertPreviewTransactionReads(plan, valid));
  assert.throws(() => assertPreviewTransactionReads(plan, [{ found: { name, updateTime: "changed" } }, { missing: target }]), /Source template changed/);
  assert.throws(() => assertPreviewTransactionReads(plan, [{ found: { name, updateTime: updated } }, { found: { name: target } }]), /already exists/);
  assert.throws(() => assertPreviewTransactionReads(plan, [{ missing: target }]), /Source template changed/);
});
