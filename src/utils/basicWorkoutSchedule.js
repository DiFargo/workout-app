import { formatProfileWorkoutDateKey, formatProfileWorkoutMonthKey } from "./profileWorkoutSchedule.js";

const DEFAULT_TRAINING_WEEKDAYS = {
  2: [1, 4],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4]
};

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
