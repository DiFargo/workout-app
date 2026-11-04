const FIELDS = ["workoutEnabled", "offsets", "photoEnabled", "weightEnabled", "measurementsEnabled", "photoIntervalDays", "weightIntervalDays", "measurementsIntervalDays", "reminderTime"];

// A strict allowlist: clients can change reminders, never training dates or access fields.
export function buildClientReminderCalendarPatch(settings, calendar = {}, now = new Date().toISOString()) {
  const valid = settings && typeof settings === "object" && !Array.isArray(settings)
    && Object.keys(settings).every(key => FIELDS.includes(key))
    && ["workoutEnabled", "photoEnabled", "weightEnabled", "measurementsEnabled"].every(key => typeof settings[key] === "boolean")
    && Array.isArray(settings.offsets) && settings.offsets.length >= 1 && settings.offsets.length <= 4
    && settings.offsets.every(value => [24, 12, 3, 1].includes(value))
    && [7, 14, 30].includes(settings.photoIntervalDays)
    && [7, 14, 30].includes(settings.weightIntervalDays)
    && [7, 14, 30].includes(settings.measurementsIntervalDays)
    && typeof settings.reminderTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.reminderTime);
  if (!valid) {
    const error = new Error("Invalid reminder settings");
    error.status = 400;
    throw error;
  }
  const progress = calendar.progressReminderSettings || {};
  return {
    reminderEnabled: settings.workoutEnabled,
    reminderOffsetsHours: [...new Set(settings.offsets)].sort((a, b) => b - a),
    progressReminderSettings: {
      photoEnabled: settings.photoEnabled,
      weightEnabled: settings.weightEnabled,
      measurementsEnabled: settings.measurementsEnabled,
      photoIntervalDays: settings.photoIntervalDays,
      weightIntervalDays: settings.weightIntervalDays,
      measurementsIntervalDays: settings.measurementsIntervalDays,
      reminderTime: settings.reminderTime,
      // Editing a preference must not restart an existing progress reminder cycle.
      startedAt: progress.startedAt || progress.updatedAt || calendar.updatedAt || now,
      updatedAt: now
    },
    progressPhotoReminderEnabled: settings.photoEnabled,
    weightReminderEnabled: settings.weightEnabled,
    measurementsReminderEnabled: settings.measurementsEnabled,
    progressPhotoReminderIntervalDays: settings.photoIntervalDays,
    weightReminderIntervalDays: settings.weightIntervalDays,
    measurementsReminderIntervalDays: settings.measurementsIntervalDays,
    progressReminderTime: settings.reminderTime
  };
}
