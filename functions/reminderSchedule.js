function getTimeMinutes(time = "") {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function getMinskDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

export function getMinskDateKey(date = new Date()) {
  const parts = getMinskDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

function getDateKeyDiffDays(startDateKey, endDateKey) {
  const [startYear, startMonth, startDay] = String(startDateKey).split("-").map(Number);
  const [endYear, endMonth, endDay] = String(endDateKey).split("-").map(Number);
  if (![startYear, startMonth, startDay, endYear, endMonth, endDay].every(Number.isFinite)) return 0;

  const start = Date.UTC(startYear, startMonth - 1, startDay, 12);
  const end = Date.UTC(endYear, endMonth - 1, endDay, 12);
  return Math.floor((end - start) / 86400000);
}

function getDayIdForDateKey(dateKey) {
  const day = new Date(`${dateKey}T12:00:00+03:00`).getUTCDay();
  return ({ 0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" })[day];
}

export function normalizeReminderOffsets(value) {
  const source = Array.isArray(value) && value.length ? value : [24];
  return [...new Set(source.map(Number).filter((hours) => [24, 12, 3, 1].includes(hours)))].sort((a, b) => b - a);
}

export function getNextScheduledWorkout(calendar = {}, now = new Date()) {
  const todayKey = getMinskDateKey(now);
  const scheduledDates = [...new Set([
    ...(Array.isArray(calendar.scheduledDates) ? calendar.scheduledDates : []),
    ...(Array.isArray(calendar.monthlyTrainingDates) ? calendar.monthlyTrainingDates : [])
  ])].filter((dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(dateKey)).sort();
  const futureScheduledDates = scheduledDates.filter((dateKey) => dateKey >= todayKey);
  const trainingDays = Array.isArray(calendar.trainingDays) ? calendar.trainingDays : [];

  for (let dayOffset = 0; dayOffset <= 8; dayOffset += 1) {
    const dateKey = addDaysToDateKey(todayKey, dayOffset);
    const dayId = getDayIdForDateKey(dateKey);
    const isScheduled = futureScheduledDates.includes(dateKey) || (!futureScheduledDates.length && trainingDays.includes(dayId));
    if (!isScheduled) continue;

    const workoutTime = calendar.daySettings?.[dayId]?.workoutTime || calendar.workoutTime || "13:00";
    if (getTimeMinutes(workoutTime) === null) continue;
    const startsAt = new Date(`${dateKey}T${workoutTime}:00+03:00`);
    if (startsAt.getTime() <= now.getTime()) continue;

    return {
      dayId,
      key: dateKey,
      workoutTime,
      startsAt,
      text: startsAt.toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        timeZone: "Europe/Minsk"
      })
    };
  }

  return null;
}

export function getDueReminderOffsets(calendar = {}, event, now = new Date()) {
  if (!event) return [];
  const minutesUntil = Math.floor((event.startsAt.getTime() - now.getTime()) / 60000);
  return normalizeReminderOffsets(calendar.reminderOffsetsHours).filter((hours) => {
    const target = hours * 60;
    return minutesUntil <= target && minutesUntil > target - 5;
  });
}

// When the calendar stores explicit workout slots, a date alone is not enough
// to justify a reminder: that date must still point at a planned workout.
// Returning undefined means the calendar is legacy and can use its weekly
// schedule; returning null means an explicit plan exists but has no workout on
// that date.
export function getPlannedWorkoutForReminder(calendar = {}, event) {
  const plannedWorkouts = Array.isArray(calendar.plannedWorkouts) ? calendar.plannedWorkouts : [];
  if (!plannedWorkouts.length) return undefined;
  if (!event?.key) return null;

  return plannedWorkouts.find((workout) => {
    const date = workout?.movedToDate || workout?.date || workout?.scheduledDate || workout?.plannedDate;
    const status = String(workout?.status || "planned").trim().toLowerCase();
    return date === event.key && !["completed", "missed", "skipped", "cancelled", "canceled"].includes(status);
  }) || null;
}

export function getActivePlanWorkouts(workouts = [], userData = {}, calendar = {}) {
  if (Number(userData.assignedWorkoutCount) === 0) return [];

  const basicPlanWorkouts = Array.isArray(userData.basicWorkoutPlan?.workouts)
    ? userData.basicWorkoutPlan.workouts
    : [];
  if (basicPlanWorkouts.length) {
    const basicWorkoutIds = new Set(basicPlanWorkouts.map((workout) => String(workout?.id || "").trim()).filter(Boolean));
    return workouts.filter((workout) => basicWorkoutIds.has(String(workout?.id || "").trim()));
  }

  const assignmentVersion = String(calendar.assignedProgramUpdatedAt || userData.assignedProgramUpdatedAt || "").trim();
  return assignmentVersion
    ? workouts.filter((workout) => String(workout?.assignedProgramUpdatedAt || workout?.assignmentVersion || "").trim() === assignmentVersion)
    : workouts;
}

export function getDueProgressReminderTypes(calendar = {}, lastActivity = {}, now = new Date()) {
  const settings = calendar.progressReminderSettings || {};
  const todayKey = getMinskDateKey(now);
  const parts = getMinskDateParts(now);
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const reminderTime = settings.reminderTime || calendar.progressReminderTime || "10:00";
  const targetMinutes = getTimeMinutes(reminderTime);

  if (targetMinutes === null || currentMinutes < targetMinutes || currentMinutes >= targetMinutes + 5) {
    return [];
  }

  const defaultIntervalDays = Math.max(1, Number(settings.intervalDays || calendar.progressReminderIntervalDays || 14) || 14);
  const startedAt = String(settings.startedAt || settings.updatedAt || calendar.updatedAt || todayKey).slice(0, 10);

  return [
    {
      type: "photo",
      enabled: settings.photoEnabled === true || calendar.progressPhotoReminderEnabled === true,
      title: "Фото прогресса",
      intervalDays: Math.max(1, Number(settings.photoIntervalDays || calendar.progressPhotoReminderIntervalDays || defaultIntervalDays) || defaultIntervalDays),
      lastDateKey: lastActivity.photoDateKey
    },
    {
      type: "measurements",
      enabled: settings.measurementsEnabled === true || calendar.measurementsReminderEnabled === true,
      title: "Замеры",
      intervalDays: Math.max(1, Number(settings.measurementsIntervalDays || calendar.measurementsReminderIntervalDays || defaultIntervalDays) || defaultIntervalDays),
      lastDateKey: lastActivity.measurementDateKey
    }
  ].flatMap((item) => {
    if (!item.enabled) return [];

    const baseDateKey = item.lastDateKey || startedAt || todayKey;
    const daysSinceBase = getDateKeyDiffDays(baseDateKey, todayKey);
    if (daysSinceBase < item.intervalDays) return [];

    const cycle = Math.floor(daysSinceBase / item.intervalDays);
    const dueDateKey = addDaysToDateKey(baseDateKey, cycle * item.intervalDays);
    return [{ ...item, dueDateKey }];
  });
}
