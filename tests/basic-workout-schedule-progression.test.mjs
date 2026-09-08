import test from "node:test";
import assert from "node:assert/strict";

import { shiftBasicWorkoutScheduleAfterCompletion } from "../src/utils/basicWorkoutSchedule.js";
import { syncWorkoutCalendarWithPlan } from "../src/utils/workoutSchedule.js";

function createBasicPlan() {
  return {
    source: "basic",
    workouts: [
      { id: "week_1_day_1", source: "basic", scheduledDate: "2026-09-01", plannedDate: "2026-09-01" },
      { id: "week_1_day_2", source: "basic", scheduledDate: "2026-09-03", plannedDate: "2026-09-03" },
      { id: "week_1_day_3", source: "basic", scheduledDate: "2026-09-05", plannedDate: "2026-09-05" },
      { id: "week_2_day_1", source: "basic", scheduledDate: "2026-09-08", plannedDate: "2026-09-08" }
    ]
  };
}

test("a late basic workout shifts the rest of the sequence without dropping workouts", () => {
  const shiftedPlan = shiftBasicWorkoutScheduleAfterCompletion(
    createBasicPlan(),
    "week_1_day_1",
    "2026-09-12T10:00:00.000Z"
  );

  assert.deepEqual(
    shiftedPlan.workouts.map((workout) => workout.scheduledDate),
    ["2026-09-01", "2026-09-14", "2026-09-16", "2026-09-19"]
  );
  assert.equal(shiftedPlan.workouts[0].scheduleShiftedAt, undefined);
  assert.ok(shiftedPlan.workouts.slice(1).every((workout) => workout.scheduleShiftedAt));
});

test("an on-time basic workout leaves future schedule dates unchanged", () => {
  const plan = createBasicPlan();
  const result = shiftBasicWorkoutScheduleAfterCompletion(plan, "week_1_day_1", "2026-09-01");

  assert.equal(result, plan);
});

test("the saved basic calendar adopts shifted program dates instead of restoring stale dates", () => {
  const shiftedPlan = shiftBasicWorkoutScheduleAfterCompletion(
    createBasicPlan(),
    "week_1_day_1",
    "2026-09-12"
  );
  const calendar = syncWorkoutCalendarWithPlan({
    scheduledDates: ["2026-09-01", "2026-09-03", "2026-09-05", "2026-09-08"],
    plannedWorkouts: shiftedPlan.workouts.map((workout, index) => ({
      workoutId: workout.id,
      order: index + 1,
      date: ["2026-09-01", "2026-09-03", "2026-09-05", "2026-09-08"][index],
      status: "planned"
    }))
  }, shiftedPlan.workouts, "2026-09-12T10:00:00.000Z", "client_1");

  assert.deepEqual(
    calendar.plannedWorkouts.map((workout) => workout.date),
    ["2026-09-01", "2026-09-14", "2026-09-16", "2026-09-19"]
  );
  assert.deepEqual(calendar.scheduledDates, ["2026-09-01", "2026-09-14", "2026-09-16", "2026-09-19"]);
});
