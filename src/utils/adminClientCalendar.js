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

const ADMIN_CALENDAR_DAY_IDS_BY_JS_DAY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function getAdminCalendarDayIdFromDate(date) {
  const parsed = date instanceof Date ? date : new Date(date);
  return ADMIN_CALENDAR_DAY_IDS_BY_JS_DAY[parsed.getDay()] || "";
}

export function getAdminCalendarTrainingDaysLabel(trainingDays = [], fallback = "не выбраны") {
  const selected = Array.isArray(trainingDays) ? trainingDays : [];
  const label = ADMIN_CALENDAR_DAYS
    .filter((day) => selected.includes(day.id))
    .map((day) => day.title)
    .join(", ");

  return label || fallback;
}

export function normalizeAdminProgressReminderInterval(value) {
  const interval = Number(value);
  return [7, 14, 30].includes(interval) ? interval : 14;
}

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
