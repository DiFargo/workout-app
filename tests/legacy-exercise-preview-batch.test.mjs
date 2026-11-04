import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { planLegacyPreviewWrites, encodeLegacyPreviewValue } from "../scripts/plan-legacy-exercise-preview-selection.mjs";
import { exerciseCardLegacyKey } from "../functions/exerciseCards.js";
import { exerciseVideoPriorityTime } from "../functions/exerciseVideoPriority.js";

const video = "gs://tren-85720.firebasestorage.app/exercise-videos/legacy-preview.mp4";
const now = "2026-10-25T15:00:00.000Z", updateTime = "2026-10-25T10:00:00.000Z";
const candidates = [{ label: "V074", videos: ["V074"], duration: 10, times: [1, 2, 3, 4, 5, 6], crop: null }];
const decisions = { V074: { choice: 2, reason: "Видна рабочая позиция" } };
function fixture(sourcePatch = {}) {
  const source = { id: "press", name: "Пресс", video, technique: "Техника", muscleGroup: "Кор", sourceId: "catalog-id",
    sets: [{ reps: 15, weight: 10 }], ...sourcePatch };
  const template = { id: "template", ownerUid: "trainer", updatedAt: "2026-09-01T00:00:00.000Z",
    _document: "projects/tren-85720/databases/(default)/documents/trainingTemplates/template", _updateTime: updateTime,
    blocks: [{ weeks: [{ workouts: [{ exercises: [source] }] }] }] };
  return { source, current: { trainingTemplates: [template], trainerExerciseCards: [], basicExerciseOverrides: [] },
    frozen: { entries: [{ type: "legacy", status: "needs_selection", id: source.id, name: source.name, templateId: template.id,
      ownerUid: template.ownerUid, updateTime, videoRef: video, videoLabel: "V074", crop: source.videoCrop ?? null,
      posterTime: source.videoPosterTime ?? null,
      legacyHash: createHash("sha256").update(exerciseCardLegacyKey(source)).digest("hex") }] } };
}

test("legacy plan uses backend card identity and preserves metadata without writing source or load", async () => {
  const { source, current, frozen } = fixture(), before = structuredClone(current);
  const result = await planLegacyPreviewWrites(frozen, current, candidates, decisions, now);
  assert.equal(result.changes.length, 1);
  const change = result.changes[0], card = change.expectedCard;
  assert.equal(card.id, createHash("sha256").update(JSON.stringify(["trainer", exerciseCardLegacyKey(source)])).digest("hex"));
  assert.equal(card.videoPosterTime, 2);
  assert.equal(card.revision, 1);
  assert.equal(card.ownerUid, "trainer");
  assert.equal(card.technique, source.technique);
  assert.equal(card.sourceId, source.sourceId);
  assert.equal(card.video, video);
  assert.equal(card.sets, undefined);
  assert.deepEqual(card.legacyKeys, [exerciseCardLegacyKey(source)]);
  assert.deepEqual(change.write.currentDocument, { exists: false });
  assert.equal(change.write.updateMask, undefined);
  assert.deepEqual(result.verifications, [{ name: current.trainingTemplates[0]._document, updateTime }]);
  assert.equal(result.verifications[0].verify, undefined);
  assert.deepEqual(current, before);
});

test("creation does not make legacy video newer, including unknown age despite fresh createdAt", async () => {
  for (const patch of [{}, { videoUpdatedAt: "2026-08-01T00:00:00.000Z" }]) {
    const { source, current, frozen } = fixture(patch);
    const { changes: [change] } = await planLegacyPreviewWrites(frozen, current, candidates, decisions, now);
    assert.equal(change.expectedCard.createdAt, now);
    assert.equal(exerciseVideoPriorityTime(change.expectedCard), exerciseVideoPriorityTime(source));
    if (!source.videoUpdatedAt) assert.equal(change.expectedCard.videoUpdatedAt, "1970-01-01T00:00:00.000Z");
  }
});

test("concurrent source edits and manual zero/custom frames are skipped", async () => {
  for (const patch of [{ videoPosterTime: 0 }, { videoPoster: "/manual.webp" }, { videoThumbnail: "/manual.webp" },
    { video: video.replace("legacy-preview", "new") }, { videoCrop: { x: .3, y: .4, zoom: 1.2 } }, { libraryDeletedAt: now }]) {
    const { current, frozen } = fixture();
    Object.assign(current.trainingTemplates[0].blocks[0].weeks[0].workouts[0].exercises[0], patch);
    assert.equal((await planLegacyPreviewWrites(frozen, current, candidates, decisions, now)).changes.length, 0);
  }
  const { current, frozen } = fixture(); current.trainingTemplates[0]._updateTime = now;
  assert.equal((await planLegacyPreviewWrites(frozen, current, candidates, decisions, now)).changes.length, 0);
});

test("existing shared cards are never overwritten even with missing revision or different legacy keys", async () => {
  const { source, current, frozen } = fixture();
  const first = await planLegacyPreviewWrites(frozen, current, candidates, decisions, now);
  current.trainerExerciseCards.push({ id: first.changes[0].id, ownerUid: "trainer" });
  const before = structuredClone(current);
  const result = await planLegacyPreviewWrites(frozen, current, candidates, decisions, now);
  assert.equal(result.changes.length, 0);
  assert.equal(result.skipped[0].reason, "existing_card");
  assert.deepEqual(current, before);
  current.trainerExerciseCards = [{ id: "other", ownerUid: "trainer", legacyKeys: [exerciseCardLegacyKey(source)] }];
  assert.equal((await planLegacyPreviewWrites(frozen, current, candidates, decisions, now)).changes.length, 0);
});

test("unreviewed crop, unknown source label and out-of-range selection fail closed", async () => {
  const { current, frozen } = fixture();
  await assert.rejects(planLegacyPreviewWrites(frozen, current, [{ ...candidates[0], crop: { x: .5, y: .5, zoom: 2 } }], decisions, now), /Unreviewed crop/);
  await assert.rejects(planLegacyPreviewWrites(frozen, current, candidates, {}, now), /Missing visual review/);
  await assert.rejects(planLegacyPreviewWrites(frozen, current, [{ ...candidates[0], duration: 1 }], decisions, now));
  frozen.entries[0].videoLabel = "V076";
  await assert.rejects(planLegacyPreviewWrites(frozen, current, candidates, decisions, now), /Only reviewed/);
});

test("recursive REST encoding retains arrays, null, booleans and numeric values", () => {
  assert.deepEqual(encodeLegacyPreviewValue({ a: [null, true, 2, 1.5, "text"], b: { x: false } }), { mapValue: { fields: {
    a: { arrayValue: { values: [{ nullValue: null }, { booleanValue: true }, { integerValue: "2" }, { doubleValue: 1.5 }, { stringValue: "text" }] } },
    b: { mapValue: { fields: { x: { booleanValue: false } } } }
  } } });
});
