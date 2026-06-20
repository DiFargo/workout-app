import { getAdminClientProfile } from "./adminClientProfile.js";

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
