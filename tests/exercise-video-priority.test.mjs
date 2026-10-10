import assert from "node:assert/strict";
import test from "node:test";
import { exerciseVideoPriorityTime, selectLatestExerciseVideo } from "../functions/exerciseVideoPriority.js";
import { buildTrainerExerciseLibraryItems } from "../src/utils/trainerExerciseLibrary.js";
import { exerciseCardDatabase } from "./helpers/exercise-card-database.mjs";
import { manageTrainerExerciseCards } from "../functions/trainerExerciseCards.js";
import { exerciseCardLegacyKey } from "../functions/exerciseCards.js";

const oldTime = "2026-09-12T10:00:00.000Z";
const newTime = "2026-09-19T10:00:00.000Z";
const card = { id: "card", ownerUid: "trainer", name: "Тяга гантели с опорой на скамью", video: "/new.mp4", technique: "", revision: 2, updatedAt: newTime };

test("new shared video wins over old template copies of the same movement", () => {
  const templates = [{ id: "template", ownerUid: "trainer", updatedAt: "2099-01-01", workouts: [{ exercises: [
    { id: "old", name: card.name, video: "/old.mp4" },
    { id: "blank", name: card.name, video: "" }
  ] }] }];
  const before = structuredClone(templates);
  const items = buildTrainerExerciseLibraryItems({}, templates, { cards: [card] });
  assert.equal(items.length, 1);
  assert.equal(items[0].video, "/new.mp4");
  assert.equal(items[0].exerciseCardId, card.id);
  assert.deepEqual(templates, before);
});

test("priority uses video timestamp, never an unrelated note or template edit", () => {
  const old = { ...card, id: "old", video: "/old.mp4", videoUpdatedAt: oldTime, updatedAt: "2099-01-01" };
  const latest = { ...card, videoUpdatedAt: newTime };
  for (const input of [[old, latest], [latest, old]]) assert.equal(selectLatestExerciseVideo(input), latest);
  assert.equal(exerciseVideoPriorityTime({ video: "/old.mp4", updatedAt: "2099-01-01" }), 0);
  assert.equal(exerciseVideoPriorityTime({ video: "/old.mp4", videoUpdatedAt: "not-a-date" }), 0);
});

test("unknown dates and conflicting simultaneous videos do not invent a winner", () => {
  assert.equal(selectLatestExerciseVideo([{ video: "/one.mp4" }, { video: "/two.mp4" }]), null);
  assert.equal(selectLatestExerciseVideo([{ ...card }, { ...card, id: "other", video: "/two.mp4" }]), null);
  assert.equal(selectLatestExerciseVideo([{ video: "/one.mp4", videoUpdatedAt: oldTime }, { video: "/two.mp4", videoUpdatedAt: newTime }]).video, "/two.mp4");
});

test("new video never crosses technique, trainer, posture or equipment boundaries", () => {
  const variants = [card,
    { ...card, id: "different-technique", technique: "Иная техника", video: "/technique.mp4" },
    { ...card, id: "other-owner", ownerUid: "other", video: "/other-owner.mp4" },
    { ...card, id: "standing", name: "Тяга гантелей стоя в наклоне", video: "/standing.mp4" }];
  assert.equal(buildTrainerExerciseLibraryItems({}, [], { cards: variants }).length, variants.length);
});

test("deleting one video variant does not hide another active variant or remove the restore entry", () => {
  const older = { ...card, id: "older", video: "/older.mp4", updatedAt: oldTime };
  const removed = { ...card, deletedAt: newTime };
  const active = buildTrainerExerciseLibraryItems({}, [], { cards: [older, removed] });
  assert.deepEqual(active.map(item => item.id), [older.id]);
  const all = buildTrainerExerciseLibraryItems({}, [], { cards: [older, removed], includeDeleted: true });
  assert.equal(all.length, 2);
  assert.equal(all.find(item => item.id === removed.id).libraryDeletedAt, newTime);
});

test("saving only technique, framing or visibility never makes an old video newer", async () => {
  const db = exerciseCardDatabase({ "trainerExerciseCards/card": { ...card, updatedAt: oldTime } });
  const context = { uid: "trainer", role: "trainer" };
  let revision = card.revision;
  for (const body of [
    { action: "save", patch: { technique: "Уточнение техники" } },
    { action: "save", patch: { videoCrop: { x: 0.2, y: 0.5, zoom: 1.2 } } },
    { action: "delete" }, { action: "restore" }
  ]) {
    const result = await manageTrainerExerciseCards({ db, context, now: () => newTime,
      body: { cardId: card.id, revision, ...body } });
    revision = result.card.revision;
    assert.equal(result.card.videoUpdatedAt, oldTime);
  }
  const { card: replaced } = await manageTrainerExerciseCards({ db, context, now: () => newTime,
    body: { action: "save", cardId: card.id, revision, patch: { video: "/replacement.mp4" } } });
  assert.equal(replaced.videoUpdatedAt, newTime);
  assert.equal(replaced.video, "/replacement.mp4");
  assert.ok(db.writes.every(path => path === "trainerExerciseCards/card"));
});

test("migrating a legacy exercise preserves the known video date unless its video changes", async () => {
  const source = { id: "legacy", name: card.name, video: "/old.mp4", videoUpdatedAt: oldTime };
  for (const changeVideo of [false, true]) {
    const db = exerciseCardDatabase({ "trainingTemplates/template": { ownerUid: "trainer", workouts: [{ exercises: [source] }] } });
    const { card: saved } = await manageTrainerExerciseCards({ db, context: { uid: "trainer", role: "trainer" }, now: () => newTime,
      body: { action: "save", templateId: "template", exerciseId: source.id, legacyKey: exerciseCardLegacyKey(source),
        patch: { technique: "Уточнение", ...(changeVideo ? { video: "/replacement.mp4" } : {}) } } });
    assert.equal(saved.videoUpdatedAt, changeVideo ? newTime : oldTime);
  }
});
