import test from "node:test";
import assert from "node:assert/strict";
import { rescheduleClientWorkout } from "../src/features/client/workouts/workoutReschedule.js";

test("rescheduling replaces the old date with one active slot", async () => {
  let savedPayload = null;
  let localCalendar = null;
  const result = await rescheduleClientWorkout({
    auth: { currentUser: { uid: "client-1" } },
    user: null,
    db: {},
    doc: (_db, collection, uid) => ({ collection, uid }),
    setDoc: async (_ref, payload) => { savedPayload = payload; },
    plan: { workouts: [{ id: "workout-1", name: "Тренировка 1" }] },
    workoutCalendar: {
      scheduledDates: ["2026-09-01"],
      plannedWorkouts: [{ workoutId: "workout-1", order: 1, date: "2026-09-01", status: "planned" }]
    },
    workoutId: "workout-1",
    workoutIndex: 0,
    dateKey: "2026-09-03",
    setWorkoutCalendar: (calendar) => { localCalendar = calendar; },
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
    setDoc: async (_ref, payload) => { savedPayload = payload; },
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
