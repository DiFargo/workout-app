import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlannedWorkoutSlots,
  buildWorkoutScheduleCalendarEntries,
  buildWorkoutScheduleDraft,
  buildWorkoutScheduleDraftWithExistingStatuses,
  clearWorkoutCalendarDateOrderPolicy,
  getWorkoutScheduleCalendarForWorkouts,
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

test("calendar keeps only slots for the active assigned workout program", () => {
  const calendar = getWorkoutScheduleCalendarForWorkouts({
    plannedWorkouts: [
      { workoutId: "old_1", date: "2026-06-10", assignedProgramAddedAt: "old", status: "missed" },
      { workoutId: "new_1", date: "2026-06-20", assignedProgramAddedAt: "current", status: "completed" },
      { workoutId: "new_2", date: "2026-06-22", assignedProgramAddedAt: "current", status: "moved", movedToDate: "2026-06-24" }
    ]
  }, [
    { id: "new_1", assignedProgramUpdatedAt: "assignment_v2", assignedProgramAddedAt: "current" },
    { id: "new_2", assignedProgramUpdatedAt: "assignment_v2", assignedProgramAddedAt: "current" }
  ]);

  assert.deepEqual(calendar.plannedWorkouts.map((item) => item.workoutId), ["new_1", "new_2"]);
  assert.deepEqual(calendar.scheduledDates, ["2026-06-20", "2026-06-24"]);
  assert.equal(calendar.assignedProgramUpdatedAt, "assignment_v2");
});

test("calendar repairs duplicate planned dates without changing workout order", () => {
  const calendar = getWorkoutScheduleCalendarForWorkouts({
    scheduledDates: ["2026-09-01", "2026-09-03", "2026-09-06", "2026-09-08"],
    plannedWorkouts: [
      { workoutId: "w1", order: 1, date: "2026-09-01", status: "planned" },
      { workoutId: "w2", order: 2, date: "2026-09-03", status: "planned" },
      { workoutId: "w3", order: 3, date: "2026-09-06", status: "planned" },
      { workoutId: "w4", order: 4, date: "2026-09-06", status: "planned" }
    ]
  }, [
    { id: "w1", name: "Тренировка 1" },
    { id: "w2", name: "Тренировка 2" },
    { id: "w3", name: "Тренировка 3" },
    { id: "w4", name: "Тренировка 4" }
  ]);

  assert.deepEqual(calendar.plannedWorkouts.map((item) => item.date), [
    "2026-09-01", "2026-09-03", "2026-09-06", "2026-09-08"
  ]);
  assert.deepEqual(calendar.scheduledDates, ["2026-09-01", "2026-09-03", "2026-09-06", "2026-09-08"]);
});


test("a new assignment never inherits dates from unrelated old workout ids", () => {
  const calendar = getWorkoutScheduleCalendarForWorkouts({ scheduledDates: ["2026-06-15"], plannedWorkouts: [{ workoutId: "old", date: "2026-06-15" }] }, [{ id: "new", assignedProgramUpdatedAt: "v2" }]);
  assert.equal(calendar.plannedWorkouts[0]?.date || "", "");
  assert.deepEqual(calendar.scheduledDates, []);
});

test("new program slots ignore four past dates from an older assignment", () => {
  const oldWorkouts = Array.from({ length: 4 }, (_, i) => ({ id: `old-${i}` }));
  const newWorkouts = Array.from({ length: 8 }, (_, i) => ({ id: `new-${i}`, assignedProgramUpdatedAt: "new", assignedProgramAddedAt: "new", status: "planned" }));
  const calendar = { assignedProgramUpdatedAt: "old", scheduledDates: ["2026-08-26", "2026-08-29", "2026-09-01", "2026-09-07"], plannedWorkouts: buildWorkoutScheduleDraft(["2026-08-26", "2026-08-29", "2026-09-01", "2026-09-07"], oldWorkouts) };
  const original = structuredClone(calendar);
  const slots = buildPlannedWorkoutSlots({ workouts: newWorkouts, calendar, now: new Date("2026-09-10T12:00:00") });
  assert.equal(slots.filter(slot => slot.isMissed).length, 0);
  assert.ok(slots.every(slot => !slot.plannedDate));
  const synced = syncWorkoutCalendarWithPlan(calendar, newWorkouts);
  assert.deepEqual(synced.scheduledDates, []);
  assert.ok(synced.plannedWorkouts.every(slot => slot.status === "planned" && !slot.date));
  assert.deepEqual(calendar, original);
});

test("same day order across assignments cannot shadow the new program's exact slots", () => {
  const current = [{ id: "new-1", assignedProgramUpdatedAt: "new", assignedProgramAddedAt: "new" }];
  const calendar = { assignedProgramUpdatedAt: "new", plannedWorkouts: [
    { workoutId: "old-1", order: 1, date: "2026-08-26", status: "missed", assignedProgramAddedAt: "old" },
    { workoutId: "new-1", order: 1, date: "2026-09-25", status: "planned", assignedProgramAddedAt: "new" }
  ] };
  const slots = buildPlannedWorkoutSlots({ workouts: current, calendar, now: new Date("2026-09-10T12:00:00") });
  assert.equal(slots[0].plannedDate, "2026-09-25");
  assert.equal(slots[0].status, "planned");
  const draft = buildWorkoutScheduleDraftWithExistingStatuses(["2026-09-25"], current, calendar.plannedWorkouts);
  assert.equal(draft[0].status, "planned");
  const synced = syncWorkoutCalendarWithPlan(calendar, current);
  assert.equal(synced.plannedWorkouts[0].date, "2026-09-25");
  assert.equal(synced.plannedWorkouts[0].status, "planned");
});

test("unmarked legacy positional slots remain usable only without a conflicting assignment", () => {
  const slots = buildPlannedWorkoutSlots({ workouts: [{ id: "w1" }], calendar: { plannedWorkouts: [{ order: 1, date: "2026-09-12", status: "planned" }] }, now: new Date("2026-09-10T12:00:00") });
  assert.equal(slots[0].plannedDate, "2026-09-12");
});

test("identity-pinned reordered days retain their dates through real readers and reloads", () => {
  const rows = ["done", "b", "a"].map(id => ({ id, assignedProgramUpdatedAt: "v1", assignedProgramAddedAt: "assignment" }));
  const calendar = { plannedWorkouts: [
    { workoutId: "done", date: "2026-11-10", status: "completed" },
    { workoutId: "b", date: "2026-11-14", status: "planned" },
    { workoutId: "a", date: "2026-11-12", status: "planned" }
  ].map(slot => ({ ...slot, assignedProgramUpdatedAt: "v1", assignedProgramAddedAt: "assignment", dateOrderPolicy: "workout_identity" })) };
  const original = structuredClone(calendar);
  const first = getWorkoutScheduleCalendarForWorkouts(calendar, rows);
  const reloaded = getWorkoutScheduleCalendarForWorkouts(JSON.parse(JSON.stringify(first)), rows);
  assert.deepEqual(first.plannedWorkouts.map(slot => slot.date), ["2026-11-10", "2026-11-14", "2026-11-12"]);
  assert.deepEqual(reloaded.plannedWorkouts.map(slot => slot.date), first.plannedWorkouts.map(slot => slot.date));
  assert.deepEqual(first.scheduledDates, ["2026-11-10", "2026-11-12", "2026-11-14"]);
  const slots = buildPlannedWorkoutSlots({ workouts: rows, calendar, now: new Date("2026-11-09T12:00:00") });
  assert.deepEqual(slots.map(slot => slot.plannedDate), first.plannedWorkouts.map(slot => slot.date));
  assert.equal(slots[0].isCompleted, true);
  assert.deepEqual(calendar, original);
  const legacy = clearWorkoutCalendarDateOrderPolicy(calendar, rows);
  assert.deepEqual(getWorkoutScheduleCalendarForWorkouts(legacy, rows).plannedWorkouts.map(slot => slot.date), ["2026-11-10", "2026-11-14", "2026-11-16"]);
});

test("new unpinned days cannot consume dates reserved by later identity-pinned days", () => {
  for (const plannedDate of [undefined, "2026-11-10"]) {
    const rows = [{ id: "new", plannedDate }, { id: "b" }, { id: "a" }];
    const calendar = { plannedWorkouts: [
      { workoutId: "a", date: "2026-11-10", dateOrderPolicy: "workout_identity" },
      { workoutId: "b", date: "2026-11-12", dateOrderPolicy: "workout_identity" }
    ] };
    const saved = getWorkoutScheduleCalendarForWorkouts(calendar, rows);
    assert.deepEqual(saved.plannedWorkouts.slice(1).map(slot => slot.date), ["2026-11-12", "2026-11-10"]);
    assert.equal(["2026-11-10", "2026-11-12"].includes(saved.plannedWorkouts[0].date), false);
    assert.equal(new Set(saved.scheduledDates).size, saved.scheduledDates.length);
  }
});

test("a foreign-version or positional marker cannot opt a day into identity date order", () => {
  const rows = [{ id: "a", assignedProgramUpdatedAt: "current" }, { id: "b", assignedProgramUpdatedAt: "current" }];
  for (const foreign of [
    { workoutId: "b", assignedProgramUpdatedAt: "old" },
    { order: 2, assignedProgramUpdatedAt: "current" }
  ]) {
    const calendar = { plannedWorkouts: [
      { workoutId: "a", date: "2026-11-12" },
      { ...foreign, date: "2026-11-10", dateOrderPolicy: "workout_identity" }
    ] };
    const saved = getWorkoutScheduleCalendarForWorkouts(calendar, rows);
    const legacy = getWorkoutScheduleCalendarForWorkouts({ plannedWorkouts: calendar.plannedWorkouts.map(slot => ({ ...slot, dateOrderPolicy: undefined })) }, rows);
    assert.deepEqual(saved.plannedWorkouts.map(slot => slot.date), legacy.plannedWorkouts.map(slot => slot.date));
  }
  const calendar = { plannedWorkouts: [
    { workoutId: "a", assignedProgramUpdatedAt: "current", dateOrderPolicy: "workout_identity" },
    { workoutId: "a", assignedProgramUpdatedAt: "old", dateOrderPolicy: "workout_identity" },
    { workoutId: "other", assignedProgramUpdatedAt: "current", dateOrderPolicy: "workout_identity" }
  ] };
  const cleared = clearWorkoutCalendarDateOrderPolicy(calendar, rows);
  assert.equal(Object.hasOwn(cleared.plannedWorkouts[0], "dateOrderPolicy"), false);
  assert.deepEqual(cleared.plannedWorkouts.slice(1), calendar.plannedWorkouts.slice(1));
  assert.equal(calendar.plannedWorkouts[0].dateOrderPolicy, "workout_identity");
});

test("identity-pinned moved days use their effective date without mutating raw movement metadata", () => {
  const rows = [{ id: "a" }, { id: "b" }];
  const calendar = { plannedWorkouts: [
    { workoutId: "a", date: "2026-11-14", dateOrderPolicy: "workout_identity" },
    { workoutId: "b", date: "2026-11-10", movedToDate: "2026-11-12", status: "moved", dateOrderPolicy: "workout_identity" }
  ] };
  const original = structuredClone(calendar);
  const saved = getWorkoutScheduleCalendarForWorkouts(calendar, rows);
  assert.deepEqual(saved.plannedWorkouts.map(slot => slot.date), ["2026-11-14", "2026-11-12"]);
  assert.equal(saved.plannedWorkouts[1].status, "planned");
  assert.deepEqual(calendar, original);
});
