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
  completedWorkoutIds = [],
  now = new Date()
} = {}) {
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];
  const assignmentVersion = String(
    calendar?.assignedProgramUpdatedAt ||
    safeWorkouts.find((workout) => workout?.assignedProgramUpdatedAt)?.assignedProgramUpdatedAt ||
    ""
  ).trim();
  const relevantHistory = assignmentVersion
    ? (Array.isArray(history) ? history : []).filter((item) => (
      String(item?.assignedProgramUpdatedAt || item?.assignmentVersion || "").trim() === assignmentVersion
    ))
    : history;
  const todayKey = toWorkoutDateKey(now);
  const sortedDates = [...new Set([
    ...(Array.isArray(calendar.scheduledDates) ? calendar.scheduledDates : []),
    ...(Array.isArray(calendar.monthlyTrainingDates) ? calendar.monthlyTrainingDates : [])
  ].map(toWorkoutDateKey).filter(Boolean))].sort();
  const plannedWorkouts = Array.isArray(calendar.plannedWorkouts) ? calendar.plannedWorkouts : [];
  const completionMaps = buildCompletionMaps(relevantHistory);
  const allHistoryCompletionMaps = buildCompletionMaps(history);
  const forcedCompletedWorkoutIds = new Set(
    (Array.isArray(completedWorkoutIds) ? completedWorkoutIds : [])
      .map((workoutId) => getWorkoutKey(workoutId))
      .filter(Boolean)
  );
  const workoutNameCounts = safeWorkouts.reduce((counts, workout, index) => {
    const name = getWorkoutKey(workout?.name || `Тренировка ${index + 1}`);
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
    return counts;
  }, new Map());
  const lastPlannedDate = sortedDates[sortedDates.length - 1] || todayKey;
  let nextShiftDate = addDays(lastPlannedDate > todayKey ? lastPlannedDate : todayKey, 2);

  return safeWorkouts.map((workout, index) => {
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
    const workoutNameKey = getWorkoutKey(workoutName);
    const workoutIdKey = getWorkoutKey(workoutId);
    const forcedCompleted = forcedCompletedWorkoutIds.has(workoutIdKey);
    const fallbackCompletedDate = toWorkoutDateKey(
      workout?.completedAt || workout?.statusUpdatedAt || plannedDate
    );
    const completion = completionMaps.byId.get(workoutIdKey) ||
      (workoutNameCounts.get(workoutNameKey) === 1
        ? completionMaps.byName.get(workoutNameKey)
        : null) ||
      // The current trainer UI has already confirmed these IDs from the
      // client's immutable completed-history records. Keep the calendar in
      // sync if an older assignment marker would otherwise hide that fact.
      (forcedCompleted
        ? allHistoryCompletionMaps.byId.get(workoutIdKey) || { completedDate: fallbackCompletedDate }
        : null);
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
    if (slot.plannedDate && !slot.isCompletedOffDate) {
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

// A trainer can replace a client's program while older schedule slots are still
// stored on the profile. Scope the calendar to the workouts currently visible in
// the plan so trainer and client never render different program versions.
export function getWorkoutScheduleCalendarForWorkouts(calendar = {}, workouts = []) {
  const safeCalendar = calendar && typeof calendar === "object" ? calendar : {};
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];
  const workoutsById = new Map(
    safeWorkouts
      .map((workout) => [String(workout?.id || "").trim(), workout])
      .filter(([workoutId]) => Boolean(workoutId))
  );
  const assignmentVersions = new Set(
    safeWorkouts
      .map((workout) => String(workout?.assignedProgramUpdatedAt || "").trim())
      .filter(Boolean)
  );
  const allPlannedWorkouts = Array.isArray(safeCalendar.plannedWorkouts)
    ? safeCalendar.plannedWorkouts
    : [];
  const plannedWorkouts = allPlannedWorkouts.filter((item) => {
    const workoutId = String(item?.workoutId || "").trim();
    const workout = workoutsById.get(workoutId);
    if (!workout) return false;

    const assignmentId = String(
      workout?.assignedProgramAddedAt || workout?.programAssignmentId || ""
    ).trim();
    const calendarAssignmentId = String(
      item?.assignedProgramAddedAt || item?.programAssignmentId || ""
    ).trim();

    return !assignmentId || assignmentId === calendarAssignmentId;
  });
  const scopedPlannedWorkouts = plannedWorkouts.length
    ? plannedWorkouts
    : allPlannedWorkouts.filter((item) => {
        const workoutId = String(item?.workoutId || "").trim();
        const assignmentVersion = String(
          item?.assignedProgramUpdatedAt || item?.assignmentVersion || ""
        ).trim();
        return !workoutId && Boolean(assignmentVersion) && assignmentVersions.has(assignmentVersion);
      });
  const scheduledDates = scopedPlannedWorkouts
    .map((item) => item?.date)
    .filter(Boolean);
  const workoutDates = safeWorkouts
    .map((workout) => workout?.scheduledDate || workout?.plannedDate)
    .filter(Boolean);
  const assignmentVersion = [...assignmentVersions][0] || "";

  return {
    ...safeCalendar,
    assignedProgramUpdatedAt: assignmentVersion || safeCalendar.assignedProgramUpdatedAt || "",
    plannedWorkouts: scopedPlannedWorkouts,
    scheduledDates: scheduledDates.length ? scheduledDates : workoutDates,
    monthlyTrainingDates: scheduledDates.length ? scheduledDates : workoutDates
  };
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

function findMatchingPlannedWorkout(plannedWorkouts = [], workout = {}, index = 0) {
  const workoutId = String(workout?.id || workout?.workoutId || "").trim();
  return (Array.isArray(plannedWorkouts) ? plannedWorkouts : []).find((item) => (
    String(item?.workoutId || "").trim() === workoutId ||
    Number(item?.order) === index + 1 ||
    Number(item?.index) === index
  )) || {};
}

export function buildWorkoutScheduleDraftWithExistingStatuses(
  dates = [],
  workouts = [],
  plannedWorkouts = []
) {
  return buildWorkoutScheduleDraft(dates, workouts).map((item, index) => {
    const existing = findMatchingPlannedWorkout(plannedWorkouts, workouts[index], index);
    const status = String(existing.status || item.status || "planned").trim() || "planned";

    return {
      ...item,
      status,
      movedToDate: toWorkoutDateKey(existing.movedToDate || ""),
      statusUpdatedAt: existing.statusUpdatedAt || "",
      completedDate: toWorkoutDateKey(existing.completedDate || "")
    };
  });
}

export function syncWorkoutCalendarWithPlan(calendar = {}, workouts = [], updatedAt = "", updatedBy = "") {
  const existingPlannedWorkouts = Array.isArray(calendar.plannedWorkouts) ? calendar.plannedWorkouts : [];
  const safeWorkouts = Array.isArray(workouts) ? workouts : [];
  const workoutAssignment = safeWorkouts.find((workout) => workout?.assignedProgramUpdatedAt) || {};
  const workoutProgram = safeWorkouts.find((workout) => workout?.assignedProgramId || workout?.assignedProgramName) || {};
  const workoutProgramAssignment = safeWorkouts.find((workout) => workout?.assignedProgramAddedAt || workout?.programAssignmentId) || {};
  const assignedProgramId = String(workoutProgram.assignedProgramId || calendar.assignedProgramId || "").trim();
  const assignedProgramName = String(workoutProgram.assignedProgramName || calendar.assignedProgramName || "").trim();
  const assignedProgramUpdatedAt = String(
    workoutAssignment.assignedProgramUpdatedAt || calendar.assignedProgramUpdatedAt || ""
  ).trim();
  const assignedProgramAddedAt = String(
    workoutProgramAssignment.assignedProgramAddedAt || workoutProgramAssignment.programAssignmentId || ""
  ).trim();
  const scheduledDates = [...new Set([
    ...(Array.isArray(calendar.scheduledDates) ? calendar.scheduledDates : []),
    ...(Array.isArray(calendar.monthlyTrainingDates) ? calendar.monthlyTrainingDates : []),
    ...existingPlannedWorkouts.map((item) => item?.date),
    ...safeWorkouts.map((workout) => workout?.scheduledDate || workout?.plannedDate)
  ].map(toWorkoutDateKey).filter(Boolean))].sort();
  const plannedWorkouts = safeWorkouts.map((workout, index) => {
    const workoutId = String(workout?.id || "").trim();
    const existing = findMatchingPlannedWorkout(existingPlannedWorkouts, workout, index);
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
      assignedProgramUpdatedAt,
      assignedProgramAddedAt,
      movedToDate: toWorkoutDateKey(workout?.movedToDate || existing.movedToDate || ""),
      statusUpdatedAt: workout?.statusUpdatedAt || existing.statusUpdatedAt || (status !== "planned" ? updatedAt : "")
    };
  });

  return {
    ...calendar,
    scheduledDates,
    monthlyTrainingDates: scheduledDates,
    plannedWorkouts,
    assignedProgramId,
    assignedProgramName,
    assignedProgramUpdatedAt,
    updatedAt,
    updatedBy
  };
}
