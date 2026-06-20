import { getAdminClientProfile } from "./adminClientProfile.js";

export const ADMIN_CALENDAR_DAYS = [
  { id: "mon", title: "Пн", full: "Понедельник" },
  { id: "tue", title: "Вт", full: "Вторник" },
  { id: "wed", title: "Ср", full: "Среда" },
  { id: "thu", title: "Чт", full: "Четверг" },
  { id: "fri", title: "Пт", full: "Пятница" },
  { id: "sat", title: "Сб", full: "Суббота" },
  { id: "sun", title: "Вс", full: "Воскресенье" }
];

export function getDefaultAdminCalendar(client = {}) {
  const source = client.workoutCalendar || client.calendar || {};
  const profile = getAdminClientProfile(client);

  return {
    enabled: source.enabled !== false,
    reminderEnabled: source.reminderEnabled !== false,
    reminderOffsetsHours: Array.isArray(source.reminderOffsetsHours) && source.reminderOffsetsHours.length
      ? source.reminderOffsetsHours
      : [24],
    reminderTime: source.reminderTime || "19:00",
    workoutTime: source.workoutTime || client.workoutTime || profile?.workoutTime || "13:00",
    hourReminderEnabled: source.hourReminderEnabled === true,
    trainingDays: Array.isArray(source.trainingDays) && source.trainingDays.length
      ? source.trainingDays
      : Array.isArray(profile?.trainingDays) ? profile.trainingDays : [],
    daySettings: source.daySettings || source.scheduleByDay || {}
  };
}
