import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createProgramDraft, isProgramDraftDirty, programDraftSnapshot, createKeyedSaveQueue } from "../src/utils/trainerProgramDraft.js";
import { getUniformSetValue, resizeTrainerSets } from "../src/utils/trainerQuickSets.js";
import { buildPlannedWorkoutSlots, getWorkoutScheduleCalendarForWorkouts, mergeWorkoutCalendarScope, syncWorkoutCalendarWithPlan } from "../src/utils/workoutSchedule.js";

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

async function persistenceFixture({ rawWorkouts, profile: customProfile } = {}) {
  const raw = { id: "w1", name: "Workout", status: "planned", exercises: [{ id: "e1", name: "Press", sets: [{ reps: 8, weight: 20 }] }] };
  const sourceWorkouts = rawWorkouts || [raw];
  const profile = customProfile || { assignedProgramUpdatedAt: "v1", assignedProgramId: "p1", workoutCalendar: { planRevision: 0 } };
  const documents = new Map([["users/u", profile], ...sourceWorkouts.map(workout => [`users/u/workouts/${workout.id}`, structuredClone(workout)]), ["users/u/workouts/old", { id: "old", status: "completed" }]]);
  const writes = [];
  const context = { Date, Map, Set, JSON, Number, String, Boolean, Object, Error, programDraftSnapshot,
    doc: (_db, ...path) => path.join("/"), runTransaction: async (_db, callback) => callback({
      get: async (ref) => ({ exists: () => documents.has(ref), data: () => structuredClone(documents.get(ref)) }),
      set: (...args) => writes.push(["set", ...args]), delete: (...args) => writes.push(["delete", ...args])
    }), mergeWorkoutCalendarScope, syncWorkoutCalendarWithPlan };
  const source = await readFile(new URL("../src/features/client/workouts/trainerProgramDraftPersistence.js", import.meta.url), "utf8");
  vm.runInNewContext(source.replace(/^import .*;\r?\n/gm, "").replace(/export /g, ""), context);
  const draft = createProgramDraft(sourceWorkouts.map(workout => ({ ...structuredClone(workout), _editorSnapshot: programDraftSnapshot(workout) })), profile);
  if (!rawWorkouts) draft.plan.workouts[0].exercises[0].sets[0].weight = 25;
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

test("editing a future prescription retains global order after completed days", async () => {
  const rawWorkouts = Array.from({ length: 4 }, (_, index) => ({
    id: `global-${index + 1}`, name: `Тренировка ${index + 1}`, order: 33 + index, sortOrder: 33 + index,
    status: index < 3 ? "completed" : "planned", assignedProgramId: "p1", assignedProgramUpdatedAt: "v1", assignedProgramAddedAt: "assignment-a",
    exercises: [{ id: `e-${index}`, sets: [{ reps: 12, weight: 20 }] }]
  }));
  const fixture = await persistenceFixture({ rawWorkouts });
  fixture.draft.completedWorkoutIds = rawWorkouts.slice(0, 3).map(workout => workout.id);
  fixture.draft.plan.workouts[3].exercises[0].sets[0].weight = 25;
  const result = await fixture.save();
  assert.deepEqual(Array.from(result.plan.workouts, workout => workout.order), [33, 34, 35, 36]);
  assert.deepEqual(fixture.writes.filter(write => write[1].includes("/workouts/")).map(write => write[1]), ["users/u/workouts/global-4"]);
  assert.equal(fixture.writes.find(write => write[1].endsWith("/global-4"))[2].order, 36);
});

test("explicit future-day reordering preserves the queue-wide order scale", async () => {
  const fixture = await reorderedFixture();
  for (const workout of fixture.rawWorkouts) {
    workout.order += 32;
    workout.sortOrder += 32;
    fixture.documents.set(`users/u/workouts/${workout.id}`, structuredClone(workout));
    const updated = { ...structuredClone(workout), _editorSnapshot: programDraftSnapshot(workout) };
    fixture.draft.baseline.workouts[fixture.draft.baseline.workouts.findIndex(item => item.id === workout.id)] = structuredClone(updated);
    fixture.draft.plan.workouts[fixture.draft.plan.workouts.findIndex(item => item.id === workout.id)] = structuredClone(updated);
  }
  const result = await fixture.save();
  assert.deepEqual(Array.from(result.plan.workouts, workout => workout.id), ["done", "b", "a"]);
  assert.deepEqual(Array.from(result.plan.workouts, workout => workout.order), [33, 34, 35]);
  assert.deepEqual(fixture.writes.filter(write => write[1].includes("/workouts/")).map(write => write[2].order), [34, 35]);
  assert.ok(!fixture.writes.some(write => write[1] === "users/u/workouts/done"));
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

async function reorderedFixture({ legacy = false, datesOnly = false, bareLegacy = false } = {}) {
  const rawWorkouts = ["done", "a", "b"].map((id, index) => ({
    id, name: id, order: index + 1, sortOrder: index + 1,
    status: id === "done" ? "completed" : "planned",
    ...(bareLegacy ? {} : { assignedProgramId: "p1", assignedProgramUpdatedAt: "v1", assignedProgramAddedAt: "assignment-a" }),
    exercises: [{ id: `${id}-exercise`, name: "Press", sets: [{ id: `${id}-set`, reps: 8, weight: 20 }] }]
  }));
  const ownSlots = rawWorkouts.map((workout, index) => ({
    ...(legacy ? {} : { workoutId: workout.id }), order: index + 1, index,
    date: `2026-11-${String(10 + index * 2).padStart(2, "0")}`,
    status: workout.status, ...(workout.id === "done" ? { completedDate: "2026-11-10" } : {}),
    coachNote: `keep-${workout.id}`,
    ...(bareLegacy ? {} : { assignedProgramUpdatedAt: "v1", assignedProgramAddedAt: "assignment-a" })
  }));
  const unrelated = { workoutId: "other", assignedProgramUpdatedAt: "v2", assignedProgramAddedAt: "other-assignment", order: 1, date: "2026-12-01", status: "missed", coachNote: "untouched" };
  const calendar = { planRevision: 8, ...(bareLegacy ? {} : { assignedProgramUpdatedAt: "v1" }),
    scheduledDates: ownSlots.map(slot => slot.date), plannedWorkouts: datesOnly ? [] : [...ownSlots, unrelated], purchasedTrainings: 12 };
  const profile = { ...(bareLegacy ? {} : { assignedProgramUpdatedAt: "v1", assignedProgramId: "p1" }), workoutCalendar: calendar };
  const fixture = await persistenceFixture({ rawWorkouts, profile });
  fixture.draft.completedWorkoutIds = ["done"];
  fixture.documents.set("users/u/history/immutable", { workoutId: "done", date: "2026-11-10", exercises: rawWorkouts[0].exercises });
  fixture.draft.plan.workouts = [fixture.draft.plan.workouts[0], fixture.draft.plan.workouts[2], fixture.draft.plan.workouts[1]];
  return { ...fixture, rawWorkouts, ownSlots, unrelated, profile };
}

for (const options of [{}, { legacy: true }, { legacy: true, bareLegacy: true }, { datesOnly: true }]) {
  test(`reordering only future days preserves ID/date/status mapping and scoped data (${JSON.stringify(options)})`, async () => {
    const fixture = await reorderedFixture(options);
    const original = programDraftSnapshot([...fixture.documents]);
    const result = await fixture.save();
    assert.equal(programDraftSnapshot([...fixture.documents]), original);
    assert.deepEqual([...result.plan.workouts].map(workout => workout.id), ["done", "b", "a"]);
    const workoutWrites = fixture.writes.filter(write => write[1].includes("/workouts/"));
    assert.deepEqual(workoutWrites.map(write => write[1]), ["users/u/workouts/b", "users/u/workouts/a"]);
    workoutWrites.forEach((write, index) => {
      assert.deepEqual(Object.keys(write[2]).sort(), ["order", "scheduleOrder", "sortOrder", "updatedAt"]);
      assert.equal(write[2].order, index + 2);
      assert.equal(write[2].sortOrder, index + 2);
      assert.equal(write[2].scheduleOrder, index + 2);
      assert.equal(write[3].merge, true);
    });
    assert.equal(result.workoutCalendar.planRevision, 9);
    assert.equal(result.workoutCalendar.purchasedTrainings, 12);
    fixture.ownSlots.forEach(originalSlot => {
      const id = fixture.rawWorkouts[originalSlot.index].id;
      const savedSlot = result.workoutCalendar.plannedWorkouts.find(slot => slot.workoutId === id);
      assert.equal(savedSlot.date, originalSlot.date);
      assert.equal(savedSlot.status, originalSlot.status);
      if (!options.datesOnly) assert.equal(savedSlot.coachNote, originalSlot.coachNote);
    });
    const reloadedCalendar = getWorkoutScheduleCalendarForWorkouts(result.workoutCalendar, result.plan.workouts);
    const displayedSlots = buildPlannedWorkoutSlots({ workouts: result.plan.workouts, calendar: result.workoutCalendar, now: new Date("2026-11-09T12:00:00Z") });
    fixture.ownSlots.forEach(originalSlot => {
      const id = fixture.rawWorkouts[originalSlot.index].id;
      assert.equal(reloadedCalendar.plannedWorkouts.find(slot => slot.workoutId === id).date, originalSlot.date);
      assert.equal(displayedSlots.find(slot => slot.workoutId === id).plannedDate, originalSlot.date);
    });
    if (!options.datesOnly) assert.equal(programDraftSnapshot(result.workoutCalendar.plannedWorkouts.find(slot => slot.workoutId === "other")), programDraftSnapshot(fixture.unrelated));
    assert.equal(fixture.writes.length, 3);
  });
}

test("reordering anchors mixed legacy/keyed slots even when only the profile carries the assignment version", async () => {
  const fixture = await reorderedFixture({ legacy: true });
  const calendar = fixture.profile.workoutCalendar;
  delete calendar.assignedProgramUpdatedAt;
  calendar.plannedWorkouts.slice(0, 3).forEach(slot => {
    delete slot.assignedProgramUpdatedAt;
    delete slot.assignedProgramAddedAt;
  });
  calendar.plannedWorkouts[0].workoutId = "done";
  const result = await fixture.save();
  assert.equal(result.workoutCalendar.plannedWorkouts.length, 4);
  fixture.ownSlots.forEach((slot, index) => {
    const saved = result.workoutCalendar.plannedWorkouts.find(item => item.workoutId === fixture.rawWorkouts[index].id);
    assert.equal(saved.date, slot.date);
    assert.equal(saved.status, slot.status);
  });
  assert.equal(programDraftSnapshot(result.workoutCalendar.plannedWorkouts.find(slot => slot.workoutId === "other")), programDraftSnapshot(fixture.unrelated));
});

test("ambiguous legacy slot indices reject reorder before any writes", async () => {
  const fixture = await reorderedFixture({ legacy: true });
  fixture.profile.workoutCalendar.plannedWorkouts[1].index = 2;
  await assert.rejects(fixture.save, { code: "program/conflict" });
  assert.deepEqual(fixture.writes, []);
});

test("reorder plus a prescription edit still saves the actual edit", async () => {
  const fixture = await reorderedFixture();
  fixture.draft.plan.workouts.find(workout => workout.id === "a").exercises[0].sets[0].weight = 35;
  const result = await fixture.save();
  const changed = fixture.writes.find(write => write[1] === "users/u/workouts/a")[2];
  assert.equal(changed.exercises[0].sets[0].weight, 35);
  assert.equal(changed.order, 3);
  assert.equal(result.plan.workouts.find(workout => workout.id === "a").exercises[0].sets[0].weight, 35);
});

test("a pure reorder retains the original and moved calendar dates and manual status", async () => {
  const fixture = await reorderedFixture();
  const original = fixture.profile.workoutCalendar.plannedWorkouts.find(slot => slot.workoutId === "a");
  original.status = "moved";
  original.movedToDate = "2026-11-20";
  original.statusUpdatedAt = "2026-11-09T10:00:00Z";
  const result = await fixture.save();
  const saved = result.workoutCalendar.plannedWorkouts.find(slot => slot.workoutId === "a");
  assert.equal(saved.date, original.date);
  assert.equal(saved.movedToDate, original.movedToDate);
  assert.equal(saved.status, original.status);
  assert.equal(saved.statusUpdatedAt, original.statusUpdatedAt);
  const reloaded = getWorkoutScheduleCalendarForWorkouts(result.workoutCalendar, result.plan.workouts);
  assert.equal(reloaded.plannedWorkouts.find(slot => slot.workoutId === "a").date, original.movedToDate);
});

test("reorder does not undo an explicit status or moved-date edit in the same draft", async () => {
  const fixture = await reorderedFixture();
  const next = fixture.draft.plan.workouts.find(workout => workout.id === "a");
  next.status = "moved";
  next.movedToDate = "2026-11-20";
  next.statusUpdatedAt = "2026-11-09T10:00:00Z";
  const result = await fixture.save();
  const saved = result.workoutCalendar.plannedWorkouts.find(slot => slot.workoutId === "a");
  assert.equal(saved.status, "moved");
  assert.equal(saved.movedToDate, "2026-11-20");
  assert.equal(saved.statusUpdatedAt, next.statusUpdatedAt);
});

for (const status of ["completed", "completed_off_date", "missed"]) test(`an unchanged locked ${status} day cannot change index`, async () => {
  const fixture = await reorderedFixture();
  fixture.draft.completedWorkoutIds = [];
  const raw = fixture.documents.get("users/u/workouts/done");
  raw.status = status;
  fixture.draft.baseline.workouts[0].status = status;
  fixture.draft.baseline.workouts[0]._editorSnapshot = programDraftSnapshot(raw);
  fixture.draft.plan.workouts.find(workout => workout.id === "done").status = status;
  fixture.draft.plan.workouts.reverse();
  await assert.rejects(fixture.save, { code: "program/conflict" });
  assert.deepEqual(fixture.writes, []);
});

test("a concurrent completion blocks reorder without writes and retains the dirty draft", async () => {
  const fixture = await reorderedFixture();
  fixture.documents.get("users/u/workouts/a").completedAt = "2026-11-12T10:00:00Z";
  await assert.rejects(fixture.save, { code: "program/conflict" });
  assert.deepEqual(fixture.writes, []);
  assert.equal(isProgramDraftDirty(fixture.draft), true);
});

test("reorder-only legacy workouts retain raw fields while the returned editor keeps normalized identities", async () => {
  const fixture = await reorderedFixture();
  for (const id of ["a", "b"]) {
    const raw = fixture.documents.get(`users/u/workouts/${id}`);
    delete raw.exercises[0].id;
    delete raw.exercises[0].sets[0].id;
    raw.legacyMetadata = { retain: true };
    const normalized = { ...structuredClone(raw), _editorSnapshot: programDraftSnapshot(raw), normalizedOnly: "must not persist" };
    const single = createProgramDraft([normalized], fixture.profile).plan.workouts[0];
    fixture.draft.baseline.workouts[fixture.draft.baseline.workouts.findIndex(workout => workout.id === id)] = structuredClone(single);
    fixture.draft.plan.workouts[fixture.draft.plan.workouts.findIndex(workout => workout.id === id)] = structuredClone(single);
  }
  const result = await fixture.save();
  fixture.writes.filter(write => write[1].includes("/workouts/")).forEach(write => {
    const raw = fixture.documents.get(write[1]);
    const merged = { ...raw, ...write[2] };
    assert.equal(merged.normalizedOnly, undefined);
    assert.equal(merged.exercises[0].id, undefined);
    assert.equal(merged.exercises[0].sets[0].id, undefined);
    assert.deepEqual(merged.legacyMetadata, { retain: true });
  });
  assert.ok(result.plan.workouts.find(workout => workout.id === "a").exercises[0].id);
});
