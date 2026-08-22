import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlannedWorkoutSlots,
  buildWorkoutScheduleCalendarEntries,
  buildWorkoutScheduleDraft,
  buildWorkoutScheduleDraftWithExistingStatuses,
  syncWorkoutCalendarWithPlan
} from "../src/utils/workoutSchedule.js";

const workouts = [
  { id: "w1", name: "Тренировка 1" },
  { id: "w2", name: "Тренировка 2" },
  { id: "w3", name: "Тренировка 3" }
];

test("workout schedule draft binds selected dates to workout order", () => {
  const draft = buildWorkoutScheduleDraft(["2026-06-20", "2026-06-18", "2026-06-22"], workouts);

  assert.deepEqual(draft.map((item) => item.date), ["2026-06-18", "2026-06-20", "2026-06-22"]);
  assert.deepEqual(draft.map((item) => item.workoutId), ["w1", "w2", "w3"]);
});

test("completed workout on another day gets a distinct calendar status", () => {
  const slots = buildPlannedWorkoutSlots({
    workouts,
    calendar: {
      plannedWorkouts: buildWorkoutScheduleDraft(["2026-06-18", "2026-06-20", "2026-06-22"], workouts)
    },
    history: [{ workoutId: "w2", date: "2026-06-21T10:00:00.000Z" }],
    now: new Date("2026-06-21T12:00:00.000Z")
  });

  assert.equal(slots[1].status, "completed_off_date");
  assert.equal(slots[1].completedDate, "2026-06-21");

  const entries = buildWorkoutScheduleCalendarEntries(slots);
  assert.ok(entries.some((item) => item.date === "2026-06-21" && item.status === "completed_off_date"));
  assert.equal(entries.some((item) => item.date === "2026-06-20" && item.status === "planned"), false);
});

test("missed planned workout is marked and projected forward", () => {
  const slots = buildPlannedWorkoutSlots({
    workouts,
    calendar: {
      plannedWorkouts: buildWorkoutScheduleDraft(["2026-06-10", "2026-06-12", "2026-06-14"], workouts)
    },
    history: [{ workoutId: "w1", date: "2026-06-10T10:00:00.000Z" }],
    now: new Date("2026-06-16T12:00:00.000Z")
  });

  assert.equal(slots[0].status, "completed");
  assert.equal(slots[1].status, "missed");
  assert.equal(slots[1].shiftedDate, "2026-06-18");

  const entries = buildWorkoutScheduleCalendarEntries(slots);
  assert.ok(entries.some((item) => item.date === "2026-06-12" && item.status === "missed"));
  assert.ok(entries.some((item) => item.date === "2026-06-18" && item.status === "shifted"));
});

test("manual planned workout status is shown as completed in calendar", () => {
  const slots = buildPlannedWorkoutSlots({
    workouts,
    calendar: {
      scheduledDates: ["2026-06-15", "2026-06-17", "2026-06-20"],
      plannedWorkouts: [
        { workoutId: "w1", order: 1, date: "2026-06-15", status: "completed" },
        { workoutId: "w2", order: 2, date: "2026-06-17", status: "completed" },
        { workoutId: "w3", order: 3, date: "2026-06-20", status: "completed" }
      ]
    },
    history: [],
    now: new Date("2026-06-18T12:00:00.000Z")
  });
  const entries = buildWorkoutScheduleCalendarEntries(slots);

  assert.equal(slots.filter((slot) => slot.isCompleted).length, 3);
  assert.equal(entries.filter((entry) => entry.status === "completed").length, 3);
});

test("explicit completed workout ids make every completed plan date non-purple", () => {
  const slots = buildPlannedWorkoutSlots({
    workouts,
    calendar: {
      plannedWorkouts: buildWorkoutScheduleDraft(["2026-06-15", "2026-06-17", "2026-06-20"], workouts)
    },
    completedWorkoutIds: ["w1", "w2", "w3"],
    now: new Date("2026-06-20T12:00:00.000Z")
  });
  const entries = buildWorkoutScheduleCalendarEntries(slots);

  assert.equal(slots.every((slot) => slot.isCompleted), true);
  assert.equal(entries.some((entry) => entry.status === "planned"), false);
});

test("planned workout slots ignore history from an older assignment", () => {
  const slots = buildPlannedWorkoutSlots({
    workouts: [{ id: "w1", name: "Workout A", assignedProgramUpdatedAt: "new-assignment" }],
    calendar: {
      assignedProgramUpdatedAt: "new-assignment",
      plannedWorkouts: [
        { workoutId: "w1", order: 1, date: "2026-06-20", status: "planned" }
      ]
    },
    history: [{ workoutId: "w1", date: "2026-06-20", assignedProgramUpdatedAt: "old-assignment" }],
    now: new Date("2026-06-20T12:00:00.000Z")
  });

  assert.equal(slots[0].status, "planned");
  assert.equal(slots[0].isCompleted, false);
});

test("explicit completed workout ids keep the calendar aligned with immutable history", () => {
  const slots = buildPlannedWorkoutSlots({
    workouts: [{ id: "w1", name: "Workout A", assignedProgramUpdatedAt: "new-assignment" }],
    calendar: {
      assignedProgramUpdatedAt: "new-assignment",
      plannedWorkouts: [{ workoutId: "w1", order: 1, date: "2026-06-20", status: "planned" }]
    },
    history: [{ workoutId: "w1", date: "2026-06-20", assignedProgramUpdatedAt: "old-assignment" }],
    completedWorkoutIds: ["w1"],
    now: new Date("2026-06-20T12:00:00.000Z")
  });

  assert.equal(slots[0].status, "completed");
  assert.equal(slots[0].isCompleted, true);
});

test("a completed workout name does not complete another workout with the same name", () => {
  const slots = buildPlannedWorkoutSlots({
    workouts: [
      { id: "day_1", name: "Тренировка 1" },
      { id: "day_5", name: "Тренировка 1" }
    ],
    history: [{ workoutId: "day_1", workoutName: "Тренировка 1", date: "2026-07-15" }],
    now: new Date("2026-07-15T12:00:00.000Z")
  });

  assert.equal(slots[0].status, "completed");
  assert.equal(slots[1].status, "planned");
});

test("workout calendar sync preserves statuses and records updater", () => {
  const synced = syncWorkoutCalendarWithPlan({
    scheduledDates: ["2026-06-15"],
    monthlyTrainingDates: ["2026-06-17"],
    plannedWorkouts: [
      { workoutId: "w1", order: 1, date: "2026-06-15", status: "completed", statusUpdatedAt: "old" }
    ]
  }, [
    { id: "w1", name: "Workout A" },
    { id: "w2", name: "Workout B", plannedDate: "2026-06-20", status: "moved", movedToDate: "2026-06-22" }
  ], "2026-06-20T10:00:00.000Z", "trainer_1");

  assert.deepEqual(synced.scheduledDates, ["2026-06-15", "2026-06-17", "2026-06-20"]);
  assert.deepEqual(synced.monthlyTrainingDates, synced.scheduledDates);
  assert.equal(synced.updatedBy, "trainer_1");
  assert.equal(synced.plannedWorkouts[0].status, "completed");
  assert.equal(synced.plannedWorkouts[0].statusUpdatedAt, "old");
  assert.equal(synced.plannedWorkouts[1].status, "moved");
  assert.equal(synced.plannedWorkouts[1].movedToDate, "2026-06-22");
  assert.equal(synced.plannedWorkouts[1].statusUpdatedAt, "2026-06-20T10:00:00.000Z");
});

test("schedule draft keeps trainer completed statuses when dates are saved again", () => {
  const draft = buildWorkoutScheduleDraftWithExistingStatuses(
    ["2026-06-18", "2026-06-20", "2026-06-22"],
    workouts,
    [
      { workoutId: "w1", order: 1, date: "2026-06-18", status: "completed", statusUpdatedAt: "done" },
      { workoutId: "w2", order: 2, date: "2026-06-20", status: "missed", movedToDate: "2026-06-24" }
    ]
  );

  assert.equal(draft[0].status, "completed");
  assert.equal(draft[0].statusUpdatedAt, "done");
  assert.equal(draft[1].status, "missed");
  assert.equal(draft[1].movedToDate, "2026-06-24");
  assert.equal(draft[2].status, "planned");
});

test("workout calendar sync carries current assignment marker to planned workouts", () => {
  const synced = syncWorkoutCalendarWithPlan({}, [
    {
      id: "w1",
      name: "Workout A",
      assignedProgramId: "program_1",
      assignedProgramName: "Four week plan",
      assignedProgramUpdatedAt: "assignment_v2",
      status: "completed"
    }
  ], "2026-06-20T10:00:00.000Z", "trainer_1");

  assert.equal(synced.assignedProgramId, "program_1");
  assert.equal(synced.assignedProgramName, "Four week plan");
  assert.equal(synced.assignedProgramUpdatedAt, "assignment_v2");
  assert.equal(synced.plannedWorkouts[0].assignedProgramUpdatedAt, "assignment_v2");
  assert.equal(synced.plannedWorkouts[0].status, "completed");
});
