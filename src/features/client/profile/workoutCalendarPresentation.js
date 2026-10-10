export const WORKOUT_CALENDAR_STATUSES = {
  planned: { label: "План", description: "Тренировка запланирована", symbol: "•", className: "planned" },
  completed: { label: "В срок", description: "Выполнена в запланированный день", symbol: "✓", className: "completed" },
  historyCompleted: { label: "Из истории", description: "Выполненная тренировка из истории", symbol: "✓", className: "historyCompleted" },
  completed_off_date: { label: "Другой день", description: "Выполнена не в запланированный день", symbol: "✓", className: "completedOffDate" },
  missed: { label: "Пропущена", description: "Плановая дата прошла, выполнение не отмечено", symbol: "×", className: "missed" },
  shifted: { label: "Предложен перенос", description: "Предложенная дата переноса — ещё не сохранена в расписании", symbol: "→", className: "shifted" }
};

const STATUS_PRIORITY = ["missed", "completed_off_date", "completed", "historyCompleted", "shifted", "planned"];

export function getWorkoutCalendarDayStatuses(day = {}, editing = false) {
  const entries = Array.isArray(day.scheduleEntries) ? day.scheduleEntries : [];
  const statuses = new Set(entries.map((entry) => entry.status).filter((status) => WORKOUT_CALENDAR_STATUSES[status]));
  // History is an independent fact; never mark a different planned workout as
  // completed just because some workout happened on the same date.
  if (!editing && day.workouts?.length && !statuses.has("completed") && !statuses.has("completed_off_date")) {
    statuses.add("historyCompleted");
  }
  if (editing && day.isScheduled && !statuses.size) statuses.add("planned");
  return STATUS_PRIORITY.filter((status) => statuses.has(status));
}
