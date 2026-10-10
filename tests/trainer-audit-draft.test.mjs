import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createProgramDraft, isProgramDraftDirty, programDraftSnapshot, createKeyedSaveQueue } from "../src/utils/trainerProgramDraft.js";
import { getUniformSetValue, resizeTrainerSets } from "../src/utils/trainerQuickSets.js";
import { mergeWorkoutCalendarScope, syncWorkoutCalendarWithPlan } from "../src/utils/workoutSchedule.js";

test("an untouched, reverted or cancelled draft does not change its source", () => {
  const source = [{ id: "w1", exercises: [{ id: "e1", sets: [{ reps: 8, weight: 20 }] }] }];
  const draft = createProgramDraft(source);
  assert.equal(isProgramDraftDirty(draft), false);
  draft.plan.workouts[0].exercises[0].sets[0].weight = 25;
  assert.equal(isProgramDraftDirty(draft), true);
  assert.equal(source[0].exercises[0].sets[0].weight, 20);
  draft.plan.workouts[0].exercises[0].sets[0].weight = 20;
  assert.equal(isProgramDraftDirty(draft), false);
});

test("mixed sets are explicit and reducing then restoring retains individual values", () => {
  const sets = [{ reps: 12, weight: 30 }, { reps: 10, weight: 35 }, { reps: 8, weight: 40 }];
  assert.equal(getUniformSetValue(sets, "weight"), null);
  assert.equal(getUniformSetValue([{ weight: 20 }, { weight: "20" }], "weight"), "20");
  assert.deepEqual(resizeTrainerSets(resizeTrainerSets(sets, 1), 3, sets), sets);
});

test("saves for one client are ordered and a failure does not poison the queue", async () => {
  const enqueue = createKeyedSaveQueue();
  const events = [];
  let finish;
  const first = enqueue("a", () => new Promise((resolve) => { finish = () => { events.push(1); resolve(); }; }));
  const second = enqueue("a", () => { events.push(2); throw Error("offline"); });
  const third = enqueue("a", () => events.push(3));
  await enqueue("b", () => events.push("b"));
  assert.deepEqual(events, ["b"]);
  finish(); await first; await assert.rejects(second, /offline/); await third;
  assert.deepEqual(events, ["b", 1, 2, 3]);
});

async function persistenceFixture() {
  const raw = { id: "w1", name: "Workout", status: "planned", exercises: [{ id: "e1", name: "Press", sets: [{ reps: 8, weight: 20 }] }] };
  const profile = { assignedProgramUpdatedAt: "v1", assignedProgramId: "p1", workoutCalendar: { planRevision: 0 } };
  const documents = new Map([["users/u", profile], ["users/u/workouts/w1", raw], ["users/u/workouts/old", { id: "old", status: "completed" }]]);
  const writes = [];
  const context = { Date, Map, Set, JSON, Number, String, Boolean, Object, Error, programDraftSnapshot,
    doc: (_db, ...path) => path.join("/"), runTransaction: async (_db, callback) => callback({
      get: async (ref) => ({ exists: () => documents.has(ref), data: () => structuredClone(documents.get(ref)) }),
      set: (...args) => writes.push(["set", ...args]), delete: (...args) => writes.push(["delete", ...args])
    }), mergeWorkoutCalendarScope, syncWorkoutCalendarWithPlan };
  const source = await readFile(new URL("../src/features/client/workouts/trainerProgramDraftPersistence.js", import.meta.url), "utf8");
  vm.runInNewContext(source.replace(/^import .*;\r?\n/gm, "").replace(/export /g, ""), context);
  const draft = createProgramDraft([{ ...structuredClone(raw), _editorSnapshot: programDraftSnapshot(raw) }], profile);
  draft.plan.workouts[0].exercises[0].sets[0].weight = 25;
  return { draft, documents, writes, save: () => context.saveTrainerProgramDraft({ db: {}, userId: "u", authorId: "trainer", draft }) };
}

test("draft transaction saves only changed workout and calendar, preserving old assignments", async () => {
  const fixture = await persistenceFixture();
  const result = await fixture.save();
  assert.equal(fixture.writes.length, 2);
  assert.deepEqual(fixture.writes.map((entry) => entry[1]), ["users/u/workouts/w1", "users/u"]);
  assert.equal(result.workoutCalendar.planRevision, 1);
  assert.equal(result.plan.workouts[0].exercises[0].sets[0].weight, 25);
  assert.ok(result.plan.workouts[0]._editorSnapshot);
});

for (const change of ["revision", "assignment", "completed", "edited"]) test(`draft conflict (${change}) preserves all server data and retains draft`, async () => {
  const fixture = await persistenceFixture();
  if (change === "revision") fixture.documents.get("users/u").workoutCalendar.planRevision++;
  if (change === "assignment") fixture.documents.get("users/u").assignedProgramUpdatedAt = "v2";
  if (change === "completed") fixture.documents.get("users/u/workouts/w1").status = "completed";
  if (change === "edited") fixture.documents.get("users/u/workouts/w1").exercises[0].sets[0].weight = 30;
  await assert.rejects(fixture.save, { code: "program/conflict" });
  assert.equal(fixture.writes.length, 0);
  assert.equal(isProgramDraftDirty(fixture.draft), true);
});
