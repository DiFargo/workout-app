import test from "node:test";
import assert from "node:assert/strict";
import { rescheduleClientWorkout } from "../src/features/client/workouts/workoutReschedule.js";

const transactionFor = calendar => async (_db, callback) => callback({
  get: async () => ({ exists: () => true, data: () => ({ workoutCalendar: calendar }) }),
  set: (_ref, payload) => { transactionFor.saved = payload; }
});

test("rescheduling replaces the old date with one active slot", async () => {
  let savedPayload = null;
  let localCalendar = null;
  const result = await rescheduleClientWorkout({
    auth: { currentUser: { uid: "client-1" } },
    user: null,
    db: {},
    doc: (_db, collection, uid) => ({ collection, uid }),
    run: async (db, callback) => {
      const result = await transactionFor({ scheduledDates: ["2026-09-01"], plannedWorkouts: [{ workoutId: "workout-1", order: 1, date: "2026-09-01", status: "planned" }] })(db, callback);
      savedPayload = transactionFor.saved;
      return result;
    },
    plan: { workouts: [{ id: "workout-1", name: "Тренировка 1" }] },
    workoutCalendar: {
      scheduledDates: ["2026-09-01"],
      plannedWorkouts: [{ workoutId: "workout-1", order: 1, date: "2026-09-01", status: "planned" }]
    },
    workoutId: "workout-1",
    workoutIndex: 0,
    dateKey: "2026-09-03",
    setWorkoutCalendar: (update) => { localCalendar = update(localCalendar); },
    setScheduledDates: () => {},
    setDraftDates: () => {},
    persistCalendar: () => {},
    showError: () => {}
  });

  assert.equal(result, true);
  assert.equal(savedPayload.workoutCalendar.plannedWorkouts[0].date, "2026-09-03");
  assert.equal(savedPayload.workoutCalendar.plannedWorkouts[0].movedToDate, "");
  assert.equal(savedPayload.workoutCalendar.plannedWorkouts[0].rescheduledFromDate, "2026-09-01");
  assert.deepEqual(localCalendar.scheduledDates, ["2026-09-03"]);
});

test("rescheduling into an occupied day automatically shifts following workouts", async () => {
  let savedPayload = null;
  const result = await rescheduleClientWorkout({
    auth: { currentUser: { uid: "client-1" } },
    db: {},
    doc: (_db, collection, uid) => ({ collection, uid }),
    run: async (db, callback) => {
      const result = await transactionFor({ scheduledDates: ["2026-09-01", "2026-09-03", "2026-09-05"], plannedWorkouts: [
        { workoutId: "workout-1", order: 1, date: "2026-09-01", status: "planned" },
        { workoutId: "workout-2", order: 2, date: "2026-09-03", status: "planned" },
        { workoutId: "workout-3", order: 3, date: "2026-09-05", status: "planned" }
      ] })(db, callback);
      savedPayload = transactionFor.saved;
      return result;
    },
    plan: {
      workouts: [
        { id: "workout-1", name: "Тренировка 1" },
        { id: "workout-2", name: "Тренировка 2" },
        { id: "workout-3", name: "Тренировка 3" }
      ]
    },
    workoutCalendar: {
      scheduledDates: ["2026-09-01", "2026-09-03", "2026-09-05"],
      plannedWorkouts: [
        { workoutId: "workout-1", order: 1, date: "2026-09-01", status: "planned" },
        { workoutId: "workout-2", order: 2, date: "2026-09-03", status: "planned" },
        { workoutId: "workout-3", order: 3, date: "2026-09-05", status: "planned" }
      ]
    },
    workoutId: "workout-1",
    workoutIndex: 0,
    dateKey: "2026-09-03",
    setWorkoutCalendar: () => {},
    setScheduledDates: () => {},
    setDraftDates: () => {},
    persistCalendar: () => {},
    showError: () => {}
  });

  assert.equal(result, true);
  assert.deepEqual(
    savedPayload.workoutCalendar.plannedWorkouts.map((item) => item.date),
    ["2026-09-03", "2026-09-05", "2026-09-07"]
  );
  assert.deepEqual(savedPayload.workoutCalendar.scheduledDates, ["2026-09-03", "2026-09-05", "2026-09-07"]);
});

test("explicit reschedule clears only own reorder pins and retains chronological cascade and foreign slots", async () => {
  const ownWorkouts = ["a", "b", "c"].map(id => ({ id, assignedProgramUpdatedAt: "current", assignedProgramAddedAt: "own" }));
  const ownSlots = ["2026-11-10", "2026-11-14", "2026-11-12"].map((date, index) => ({
    workoutId: ownWorkouts[index].id, date, status: "planned", assignedProgramUpdatedAt: "current",
    assignedProgramAddedAt: "own", dateOrderPolicy: "workout_identity"
  }));
  const foreign = { workoutId: "other", date: "2026-12-01", assignedProgramUpdatedAt: "old", assignedProgramAddedAt: "foreign", dateOrderPolicy: "workout_identity", status: "completed" };
  const calendar = { planRevision: 4, plannedWorkouts: [...ownSlots, foreign], scheduledDates: [...ownSlots.map(slot => slot.date), foreign.date] };
  const original = structuredClone(calendar);
  const result = await rescheduleClientWorkout({
    auth: { currentUser: { uid: "synthetic-client" } }, db: {}, doc: () => "own-profile", plan: { workouts: ownWorkouts }, workoutId: "a", dateKey: "2026-11-14",
    run: transactionFor(calendar), setWorkoutCalendar: () => {}, setScheduledDates: () => {}, setDraftDates: () => {}, persistCalendar: () => {}, showError: () => {}
  });
  assert.equal(result, true);
  const saved = transactionFor.saved.workoutCalendar;
  const own = saved.plannedWorkouts.filter(slot => slot.assignedProgramAddedAt === "own");
  assert.deepEqual(own.map(slot => slot.date), ["2026-11-14", "2026-11-16", "2026-11-18"]);
  assert.equal(own.some(slot => Object.hasOwn(slot, "dateOrderPolicy")), false);
  assert.deepEqual(saved.plannedWorkouts.find(slot => slot.workoutId === "other"), foreign);
  assert.equal(saved.planRevision, 5);
  assert.deepEqual(calendar, original);
});
