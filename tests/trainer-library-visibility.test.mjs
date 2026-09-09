import test from "node:test";
import assert from "node:assert/strict";
import { buildTrainerExerciseLibraryItems, setTrainerLibraryVariantDeleted } from "../src/utils/trainerExerciseLibrary.js";
import { persistTrainerLibraryVisibility } from "../src/utils/trainerLibraryVisibility.js";

const filmed = { id: "press", name: "Жим лёжа с гантелями", video: "old.mp4", sets: [{ reps: 12, weight: 22 }] };
const correct = { ...filmed, video: "correct.mp4" };
const template = (id, ownerUid = "trainer") => ({ id, ownerUid, ownerRole: "trainer", createdByUid: ownerUid,
  updatedByUid: "admin", name: "Программа", workouts: [{ id: "day", notes: "Сохранить заметку", exercises: [filmed, correct] }],
  blocks: [{ weeks: [{ workouts: [{ id: "copy-day", exercises: [{ ...filmed, id: "copy", name: "Жим гантелей лёжа" }] }] }] }] });
const source = { ...filmed, librarySource: { type: "template", templateId: "one" } };

test("deletion hides only the selected video, retains full workouts, and supports restoration", () => {
  const original = template("one");
  const before = structuredClone(original);
  const deleted = setTrainerLibraryVariantDeleted(original, source, "2026-09-09");
  assert.deepEqual(original, before);
  assert.deepEqual(deleted.workouts[0].exercises[0].sets, filmed.sets);
  assert.equal(deleted.workouts[0].exercises.length, 2);
  assert.equal(deleted.blocks[0].weeks[0].workouts[0].exercises.length, 1);
  assert.equal(deleted.workouts[0].notes, original.workouts[0].notes);
  assert.deepEqual(buildTrainerExerciseLibraryItems({}, [deleted]).map(ex => ex.video), ["correct.mp4"]);
  assert.equal(buildTrainerExerciseLibraryItems({}, [deleted], { includeDeleted: true }).length, 2);
  const restored = setTrainerLibraryVariantDeleted(deleted, source, "");
  assert.equal(buildTrainerExerciseLibraryItems({}, [restored]).length, 2);
});

test("deleting the only filmed copy does not resurrect a blank duplicate", () => {
  const data = { workouts: [{ exercises: [{ ...filmed, video: "" }, { ...filmed, libraryDeletedAt: "today" }] }] };
  assert.equal(buildTrainerExerciseLibraryItems({}, [data]).length, 0);
});

function fakePersistence(current, { fail = false } = {}) {
  const writes = [], reads = [];
  return { writes, reads, transactionRunner: async (_, callback) => {
    const pending = [];
    const result = await callback({
      get: async ref => { reads.push(ref); return { id: ref.id, exists: () => Boolean(current[ref.id]), data: () => current[ref.id] }; },
      set: (ref, data) => pending.push({ ref, data })
    });
    if (fail) throw new Error("offline");
    writes.push(...pending);
    return result;
  }, documentRef: (_, collection, id) => ({ collection, id }) };
}

test("delete transaction touches only this owner's matching templates and retains concurrent changes", async () => {
  const templates = [template("one"), template("two"), template("foreign", "other")];
  const current = Object.fromEntries(templates.map(t => [t.id, structuredClone(t)]));
  current.one.workouts[0].notes = "Изменено в другом окне";
  const io = fakePersistence(current);
  const updates = await persistTrainerLibraryVisibility({ templates, exercise: source, uid: "trainer", canManage: t => t.ownerUid === "trainer", ...io });
  assert.equal(updates.length, 2);
  assert.deepEqual(io.writes.map(w => w.ref), [{ collection: "trainingTemplates", id: "one" }, { collection: "trainingTemplates", id: "two" }]);
  assert.equal(updates[0].updatedByUid, "trainer");
  assert.equal(updates[0].createdByUid, "trainer");
  assert.equal(updates[0].workouts[0].notes, "Изменено в другом окне");
  assert.equal(updates[0].workouts[0].exercises.length, 2);
  assert.equal(current.one.workouts[0].exercises[0].libraryDeletedAt, undefined);
});

test("other owners, client plan sources and failed commits cannot delete anything", async () => {
  const templates = [template("one")];
  for (const exercise of [source, { ...source, librarySource: { type: "plan", workoutId: "client-day" } }]) {
    const io = fakePersistence({ one: templates[0] });
    await assert.rejects(persistTrainerLibraryVisibility({ templates, exercise, uid: "other", canManage: () => false, ...io }));
    assert.equal(io.reads.length, 0);
    assert.equal(io.writes.length, 0);
  }
  const io = fakePersistence({ one: templates[0] }, { fail: true });
  await assert.rejects(persistTrainerLibraryVisibility({ templates, exercise: source, uid: "trainer", canManage: () => true, ...io }), /offline/);
  assert.equal(io.writes.length, 0);
});

test("a changed video is not archived using a stale editor", async () => {
  const original = template("one");
  const fresh = { ...original, blocks: [], workouts: [{ id: "day", exercises: [correct] }] };
  const io = fakePersistence({ one: fresh });
  await assert.rejects(persistTrainerLibraryVisibility({ templates: [original], exercise: source, uid: "trainer", canManage: () => true, ...io }), /уже изменено/);
  assert.equal(io.writes.length, 0);
});
