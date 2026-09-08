import { formatProfileWorkoutDateKey, formatProfileWorkoutMonthKey } from "./profileWorkoutSchedule.js";

const DEFAULT_TRAINING_WEEKDAYS = {
  2: [1, 4],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4]
};

function toBasicWorkoutDateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return formatProfileWorkoutDateKey(date);
}

function addDaysToBasicWorkoutDate(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return formatProfileWorkoutDateKey(date);
}

function getDaysBetweenBasicWorkoutDates(fromDateKey, toDateKey) {
  const from = new Date(`${fromDateKey}T12:00:00`);
  const to = new Date(`${toDateKey}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function normalizeBasicWorkoutScheduleDates(dates = [], limit = Infinity) {
  return [...new Set((Array.isArray(dates) ? dates : [])
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date || "")))
  )].sort().slice(0, Math.max(0, Number(limit) || 0));
}

export function hasCompleteBasicWorkoutSchedule(dates = [], workoutCount = 0) {
  const safeWorkoutCount = Math.max(0, Number(workoutCount) || 0);
  if (!safeWorkoutCount) return false;

  return normalizeBasicWorkoutScheduleDates(dates).length === safeWorkoutCount;
}

export function buildDefaultBasicWorkoutSchedule(workoutCount = 0, workoutsPerWeek = 3, startDate = new Date()) {
  const targetCount = Math.max(0, Number(workoutCount) || 0);
  const weekdays = DEFAULT_TRAINING_WEEKDAYS[Number(workoutsPerWeek)] || DEFAULT_TRAINING_WEEKDAYS[3];
  const cursor = new Date(startDate);
  const dates = [];

  cursor.setHours(0, 0, 0, 0);

  while (dates.length < targetCount) {
    const weekday = (cursor.getDay() + 6) % 7;
    if (weekdays.includes(weekday)) {
      dates.push(formatProfileWorkoutDateKey(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

export function getBasicWorkoutScheduleMonthKey(dates = [], fallbackDate = new Date()) {
  const firstDate = normalizeBasicWorkoutScheduleDates(dates, 1)[0];
  return formatProfileWorkoutMonthKey(firstDate ? new Date(`${firstDate}T12:00:00`) : fallbackDate);
}

export function buildBasicWorkoutScheduleCalendar({
  monthKey = formatProfileWorkoutMonthKey(),
  scheduledDates = [],
  draftDates = [],
  editing = false
} = {}) {
  const [year, month] = String(monthKey).split("-").map(Number);
  const monthDate = new Date(year || new Date().getFullYear(), Math.max(0, (month || 1) - 1), 1);
  const gridStart = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1 - ((monthDate.getDay() + 6) % 7)
  );
  const visibleDates = editing ? draftDates : scheduledDates;
  const normalizedDates = normalizeBasicWorkoutScheduleDates(visibleDates);
  const entriesByDate = normalizedDates.reduce((result, date, index) => {
    result[date] = [{
      id: `basic-schedule-${index + 1}`,
      date,
      order: index + 1,
      status: "planned",
      title: `Тренировка №${index + 1}`
    }];
    return result;
  }, {});

  return {
    monthDate,
    calendarDays: Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
      const key = formatProfileWorkoutDateKey(date);

      return {
        date,
        key,
        isCurrentMonth: date.getMonth() === monthDate.getMonth(),
        isToday: key === formatProfileWorkoutDateKey(new Date()),
        isScheduled: normalizedDates.includes(key),
        scheduleEntries: entriesByDate[key] || [],
        workouts: []
      };
    })
  };
}

export function applyBasicWorkoutSchedule(plan = {}, dates = []) {
  const scheduledDates = normalizeBasicWorkoutScheduleDates(dates);

  return {
    ...plan,
    workouts: (Array.isArray(plan?.workouts) ? plan.workouts : []).map((workout, index) => ({
      ...workout,
      scheduledDate: scheduledDates[index] || "",
      plannedDate: scheduledDates[index] || ""
    }))
  };
}

// The four-week plan is a sequence, not an expiry calendar. When a person
// completes a workout later than scheduled, keep the completed workout intact
// and move only the remaining workouts forward by the original day gaps.
export function shiftBasicWorkoutScheduleAfterCompletion(
  plan = {},
  completedWorkoutId = "",
  completedAt = new Date()
) {
  const workouts = Array.isArray(plan?.workouts) ? plan.workouts : [];
  const completedIndex = workouts.findIndex((workout) => (
    String(workout?.id || "").trim() === String(completedWorkoutId || "").trim()
  ));
  const completionDate = toBasicWorkoutDateKey(completedAt);

  if (plan?.source !== "basic" || completedIndex < 0 || !completionDate) return plan;

  let previousScheduledDate = toBasicWorkoutDateKey(
    workouts[completedIndex]?.scheduledDate || workouts[completedIndex]?.plannedDate
  );
  let previousEffectiveDate = completionDate;
  let changed = false;
  const updatedAt = new Date().toISOString();
  const nextWorkouts = workouts.map((workout, index) => {
    if (index <= completedIndex) return workout;

    const scheduledDate = toBasicWorkoutDateKey(workout?.scheduledDate || workout?.plannedDate);
    const originalGap = previousScheduledDate && scheduledDate
      ? Math.max(1, getDaysBetweenBasicWorkoutDates(previousScheduledDate, scheduledDate))
      : 2;
    const earliestNextDate = addDaysToBasicWorkoutDate(previousEffectiveDate, originalGap);
    const nextDate = scheduledDate && scheduledDate > earliestNextDate
      ? scheduledDate
      : earliestNextDate;

    previousScheduledDate = scheduledDate || nextDate;
    previousEffectiveDate = nextDate;

    if (scheduledDate === nextDate && toBasicWorkoutDateKey(workout?.plannedDate) === nextDate) {
      return workout;
    }

    changed = true;
    return {
      ...workout,
      scheduledDate: nextDate,
      plannedDate: nextDate,
      scheduleShiftedAt: updatedAt
    };
  });

  return changed ? { ...plan, workouts: nextWorkouts } : plan;
}
