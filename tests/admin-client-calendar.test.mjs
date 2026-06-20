import test from "node:test";
import assert from "node:assert/strict";

import { getDefaultAdminCalendar } from "../src/utils/adminClientCalendar.js";

test("admin calendar defaults to profile training days and standard reminders", () => {
  assert.deepEqual(
    getDefaultAdminCalendar({
      profile: {
        trainingDays: ["mon", "thu"],
        workoutTime: "18:30"
      }
    }),
    {
      enabled: true,
      reminderEnabled: true,
      reminderOffsetsHours: [24],
      reminderTime: "19:00",
      workoutTime: "18:30",
      hourReminderEnabled: false,
      trainingDays: ["mon", "thu"],
      daySettings: {}
    }
  );
});

test("admin calendar preserves explicit workout calendar settings", () => {
  assert.deepEqual(
    getDefaultAdminCalendar({
      workoutTime: "10:00",
      calendar: {
        trainingDays: ["tue"]
      },
      workoutCalendar: {
        enabled: false,
        reminderEnabled: false,
        reminderOffsetsHours: [12, 3],
        reminderTime: "08:00",
        workoutTime: "17:15",
        hourReminderEnabled: true,
        trainingDays: ["wed", "sat"],
        scheduleByDay: {
          wed: { workoutTime: "17:15" }
        }
      }
    }),
    {
      enabled: false,
      reminderEnabled: false,
      reminderOffsetsHours: [12, 3],
      reminderTime: "08:00",
      workoutTime: "17:15",
      hourReminderEnabled: true,
      trainingDays: ["wed", "sat"],
      daySettings: {
        wed: { workoutTime: "17:15" }
      }
    }
  );
});
