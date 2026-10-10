const OFFSETS = [24, 12, 3, 1];
export const PROGRESS_REMINDER_PERIODS = [7, 14, 30];
export const WORKOUT_REMINDER_OFFSETS = OFFSETS;

function period(value) {
  return PROGRESS_REMINDER_PERIODS.includes(Number(value)) ? Number(value) : 14;
}

export function getClientReminderSettings(calendar = {}) {
  const progress = calendar.progressReminderSettings || {};
  const savedOffsets = Array.isArray(calendar.reminderOffsetsHours) ? calendar.reminderOffsetsHours.map(Number) : [];
  const offsets = OFFSETS.filter(value => savedOffsets.includes(value));
  const time = progress.reminderTime || calendar.progressReminderTime || "10:00";
  return {
    workoutEnabled: calendar.reminderEnabled !== false,
    offsets: offsets.length ? offsets : [24],
    photoEnabled: progress.photoEnabled === true || calendar.progressPhotoReminderEnabled === true,
    measurementsEnabled: progress.measurementsEnabled === true || calendar.measurementsReminderEnabled === true,
    photoIntervalDays: period(progress.photoIntervalDays || calendar.progressPhotoReminderIntervalDays || progress.intervalDays || calendar.progressReminderIntervalDays),
    measurementsIntervalDays: period(progress.measurementsIntervalDays || calendar.measurementsReminderIntervalDays || progress.intervalDays || calendar.progressReminderIntervalDays),
    reminderTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "10:00"
  };
}

export function mergeReminderCalendarPatch(calendar = {}, patch = {}) {
  return {
    ...calendar,
    ...patch,
    progressReminderSettings: { ...calendar.progressReminderSettings, ...patch.progressReminderSettings }
  };
}
