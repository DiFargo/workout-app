const DAY_MS = 24 * 60 * 60 * 1000;

export function toWorkoutDateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return toWorkoutDateKey(date);
}

function getWorkoutKey(value = "") {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getHistoryDate(item = {}) {
  return toWorkoutDateKey(item.date || item.completedAt || item.finishedAt || item.createdAt);
}

function buildCompletionMaps(history = []) {
  const byId = new Map();
  const byName = new Map();

  (Array.isArray(history) ? history : []).forEach((item) => {
    const completedDate = getHistoryDate(item);
    if (!completedDate) return;

    const entry = { item, completedDate };
    const workoutId = getWorkoutKey(item.workoutId);
    const workoutName = getWorkoutKey(item.workoutName || item.workout || item.name);

    if (workoutId && !byId.has(workoutId)) byId.set(workoutId, entry);
    if (workoutName && !byName.has(workoutName)) byName.set(workoutName, entry);
  });

  return { byId, byName };
}

export function buildPlannedWorkoutSlots({
  workouts = [],
  calendar = {},
  history = [],
  now = new Date()
} = {}) {
  const todayKey = toWorkoutDateKey(now);
  const sortedDates = [...new Set([
    ...(Array.isArray(calendar.scheduledDates) ? calendar.scheduledDates : []),
    ...(Array.isArray(calendar.monthlyTrainingDates) ? calendar.monthlyTrainingDates : [])
  ].map(toWorkoutDateKey).filter(Boolean))].sort();
  const plannedWorkouts = Array.isArray(calendar.plannedWorkouts) ? calendar.plannedWorkouts : [];
  const completionMaps = buildCompletionMaps(history);
  const lastPlannedDate = sortedDates[sortedDates.length - 1] || todayKey;
  let nextShiftDate = addDays(lastPlannedDate > todayKey ? lastPlannedDate : todayKey, 2);

  return (Array.isArray(workouts) ? workouts : []).map((workout, index) => {
    const workoutId = String(workout?.id || "").trim();
    const workoutName = String(workout?.name || `Тренировка ${index + 1}`).trim();
    const planned = plannedWorkouts.find((item) => (
      String(item?.workoutId || "").trim() === workoutId ||
      Number(item?.order) === index + 1 ||
      Number(item?.index) === index
    ));
    const plannedDate = toWorkoutDateKey(
      planned?.date ||
      workout?.scheduledDate ||
      workout?.plannedDate ||
      sortedDates[index]
    );
    const completion = completionMaps.byId.get(getWorkoutKey(workoutId)) ||
      completionMaps.byName.get(getWorkoutKey(workoutName));
    const manualStatus = String(workout?.status || planned?.status || "planned").trim().toLowerCase();
    const completedDate = completion?.completedDate ||
      (manualStatus === "completed" ? toWorkoutDateKey(plannedDate || workout?.completedAt || workout?.statusUpdatedAt) : "");
    let status = "planned";
    let shiftedDate = "";

    if (completedDate) {
      status = plannedDate && completedDate !== plannedDate ? "completed_off_date" : "completed";
    } else if (["missed", "not_completed"].includes(manualStatus)) {
      status = "missed";
    } else if (manualStatus === "moved") {
      status = "moved";
      shiftedDate = toWorkoutDateKey(workout?.movedToDate || planned?.movedToDate);
    } else if (plannedDate && todayKey && plannedDate < todayKey) {
      status = "missed";
    }

    if (status === "missed") {
      shiftedDate = toWorkoutDateKey(workout?.movedToDate || planned?.movedToDate) || nextShiftDate;
      nextShiftDate = addDays(shiftedDate, 2);
    }

    return {
      index,
      order: index + 1,
      workoutId,
      workoutName,
      plannedDate,
      completedDate,
      shiftedDate,
      status,
      isCompleted: status === "completed" || status === "completed_off_date",
      isCompletedOffDate: status === "completed_off_date",
      isMissed: status === "missed",
      isShifted: Boolean(shiftedDate) && ["missed", "moved"].includes(status)
    };
  });
}

export function buildWorkoutScheduleCalendarEntries(slots = []) {
  const entries = [];

  (Array.isArray(slots) ? slots : []).forEach((slot) => {
    if (slot.plannedDate) {
      entries.push({
        id: `${slot.workoutId || slot.order}-planned`,
        date: slot.plannedDate,
        order: slot.order,
        workoutId: slot.workoutId,
        label: `T${slot.order}`,
        status: slot.isMissed ? "missed" : slot.isCompleted && !slot.isCompletedOffDate ? "completed" : "planned",
        title: `Тренировка №${slot.order}`
      });
    }

    if (slot.isCompletedOffDate && slot.completedDate) {
      entries.push({
        id: `${slot.workoutId || slot.order}-completed-off-date`,
        date: slot.completedDate,
        order: slot.order,
        workoutId: slot.workoutId,
        label: `T${slot.order}`,
        status: "completed_off_date",
        title: `Тренировка №${slot.order} выполнена в другой день`
      });
    }

    if (slot.isShifted && slot.shiftedDate && slot.shiftedDate !== slot.plannedDate) {
      entries.push({
        id: `${slot.workoutId || slot.order}-shifted`,
        date: slot.shiftedDate,
        order: slot.order,
        workoutId: slot.workoutId,
        label: `T${slot.order}`,
        status: "shifted",
        title: `Тренировка №${slot.order} смещена дальше`
      });
    }
  });

  return entries;
}

export function buildWorkoutScheduleDraft(dates = [], workouts = []) {
  const cleanDates = [...new Set((Array.isArray(dates) ? dates : []).map(toWorkoutDateKey).filter(Boolean))].sort();
  return (Array.isArray(workouts) ? workouts : []).map((workout, index) => ({
    order: index + 1,
    workoutId: String(workout?.id || "").trim(),
    workoutName: String(workout?.name || `Тренировка ${index + 1}`).trim(),
    date: cleanDates[index] || "",
    status: "planned"
  }));
}

export function syncWorkoutCalendarWithPlan(calendar = {}, workouts = [], updatedAt = "", updatedBy = "") {
  const existingPlannedWorkouts = Array.isArray(calendar.plannedWorkouts) ? calendar.plannedWorkouts : [];
  const scheduledDates = [...new Set([
    ...(Array.isArray(calendar.scheduledDates) ? calendar.scheduledDates : []),
    ...(Array.isArray(calendar.monthlyTrainingDates) ? calendar.monthlyTrainingDates : []),
    ...existingPlannedWorkouts.map((item) => item?.date),
    ...(Array.isArray(workouts) ? workouts : []).map((workout) => workout?.scheduledDate || workout?.plannedDate)
  ].map(toWorkoutDateKey).filter(Boolean))].sort();
  const plannedWorkouts = (Array.isArray(workouts) ? workouts : []).map((workout, index) => {
    const workoutId = String(workout?.id || "").trim();
    const existing = existingPlannedWorkouts.find((item) => (
      String(item?.workoutId || "").trim() === workoutId ||
      Number(item?.order) === index + 1 ||
      Number(item?.index) === index
    )) || {};
    const workoutStatus = String(workout?.status || "").trim();
    const existingStatus = String(existing.status || "").trim();
    const status = (
      workoutStatus && (workoutStatus !== "planned" || workout?.statusUpdatedAt || !existingStatus)
        ? workoutStatus
        : existingStatus || workoutStatus || "planned"
    );

    return {
      ...existing,
      order: index + 1,
      index,
      workoutId,
      workoutName: String(workout?.name || existing.workoutName || `Workout ${index + 1}`).trim(),
      date: toWorkoutDateKey(existing.date || workout?.scheduledDate || workout?.plannedDate || scheduledDates[index] || ""),
      status,
      movedToDate: toWorkoutDateKey(workout?.movedToDate || existing.movedToDate || ""),
      statusUpdatedAt: workout?.statusUpdatedAt || existing.statusUpdatedAt || (status !== "planned" ? updatedAt : "")
    };
  });

  return {
    ...calendar,
    scheduledDates,
    monthlyTrainingDates: scheduledDates,
    plannedWorkouts,
    updatedAt,
    updatedBy
  };
}
