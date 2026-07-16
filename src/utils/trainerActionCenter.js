import { getClientTrainerTaskDestination } from "../domain/clientInsights.js";
import { getClientAttentionState } from "./trainerAttention.js";
import {
  getClientActivityStatus,
  getClientAttentionReasons,
  getTrainerClientSummaryFromMap
} from "./trainerClientSummary.js";
import {
  getTrainerSummaryDateKey,
  getTrainerSummaryDayStart,
  getTrainerSummaryTimestamp
} from "./trainerSummaryDates.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const ATTENTION_PRIORITY = {
  workout: 10,
  feedback: 20,
  programEnding: 30,
  task: 40,
  nutrition: 50,
  measure: 60,
  activity: 70,
  noProgram: 80,
  active: 100
};

const STATUS_PRIORITY = {
  lost: 0,
  noProgram: 1,
  attention: 2,
  active: 3
};

const TASK_PRESETS = {
  measurements: {
    title: "\u0421\u0434\u0435\u043b\u0430\u0442\u044c \u0437\u0430\u043c\u0435\u0440\u044b \u0442\u0435\u043b\u0430",
    target: "measurements",
    type: "measurements"
  },
  progressPhotos: {
    title: "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0444\u043e\u0442\u043e \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441\u0430",
    target: "progressPhotos",
    type: "progressPhotos"
  },
  nutrition: {
    title: "\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u043f\u0438\u0442\u0430\u043d\u0438\u0435",
    target: "nutrition",
    type: "nutrition"
  },
  workouts: {
    title: "\u0412\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0443",
    target: "workouts",
    type: "workouts"
  },
  custom: {
    title: "\u0417\u0430\u0434\u0430\u0447\u0430 \u043a\u043b\u0438\u0435\u043d\u0442\u0443",
    target: "",
    type: "custom"
  }
};

function getClientName(client = {}) {
  return client.name || client.displayName || client.email || "\u041a\u043b\u0438\u0435\u043d\u0442";
}

function getLastActivityTimestamp(summary = {}) {
  return Math.max(
    getTrainerSummaryTimestamp(summary.lastWorkoutAt),
    getTrainerSummaryTimestamp(summary.lastNutritionAt),
    getTrainerSummaryTimestamp(summary.lastMeasurementAt),
    ...(Array.isArray(summary.recentEvents)
      ? summary.recentEvents.map((event) => getTrainerSummaryTimestamp(event.date || event.createdAt))
      : [0])
  );
}

function getDaysUntil(value, now = Date.now()) {
  const timestamp = getTrainerSummaryTimestamp(value);
  if (!timestamp) return null;
  return Math.floor((getTrainerSummaryDayStart(timestamp) - getTrainerSummaryDayStart(now)) / DAY_MS);
}

function getPlannedWorkoutDate(item = {}) {
  return item.date || item.plannedDate || item.scheduledDate || item.startDate || item.day || "";
}

function isCompletedWorkoutSlot(item = {}) {
  const status = String(item.status || item.state || "").toLowerCase();
  return ["completed", "completed_off_date", "done"].includes(status) || item.completed === true || Boolean(item.completedAt);
}

function getTodayWorkoutSlots(client = {}, now = Date.now()) {
  const todayKey = getTrainerSummaryDateKey(now);
  const calendar = client.workoutCalendar || {};
  const plannedWorkouts = [
    ...(Array.isArray(calendar.plannedWorkouts) ? calendar.plannedWorkouts : []),
    ...(Array.isArray(client.plannedWorkouts) ? client.plannedWorkouts : [])
  ];
  const scheduledDates = Array.isArray(calendar.scheduledDates)
    ? calendar.scheduledDates
    : Array.isArray(client.scheduledWorkoutDates)
      ? client.scheduledWorkoutDates
      : [];

  return [
    ...plannedWorkouts.filter((item) => (
      getTrainerSummaryDateKey(getPlannedWorkoutDate(item)) === todayKey &&
      !isCompletedWorkoutSlot(item)
    )),
    ...scheduledDates
      .filter((date) => getTrainerSummaryDateKey(date) === todayKey)
      .map((date) => ({ date, status: "planned" }))
  ];
}

function getNextWorkoutLabel(client = {}, now = Date.now()) {
  const plannedWorkouts = [
    ...(Array.isArray(client.workoutCalendar?.plannedWorkouts) ? client.workoutCalendar.plannedWorkouts : []),
    ...(Array.isArray(client.plannedWorkouts) ? client.plannedWorkouts : [])
  ];
  const nextSlot = plannedWorkouts
    .map((item) => ({ item, days: getDaysUntil(getPlannedWorkoutDate(item), now) }))
    .filter(({ item, days }) => days !== null && days >= 0 && !isCompletedWorkoutSlot(item))
    .sort((first, second) => first.days - second.days)[0];

  if (!nextSlot) return "";
  if (nextSlot.days === 0) return "\u0421\u0435\u0433\u043e\u0434\u043d\u044f";
  if (nextSlot.days === 1) return "\u0417\u0430\u0432\u0442\u0440\u0430";
  return `\u0427\u0435\u0440\u0435\u0437 ${nextSlot.days} \u0434\u043d.`;
}

function buildActionItem(client = {}, summary = {}, attention = null, now = Date.now()) {
  const status = getClientActivityStatus(summary);
  const type = attention?.type || status.id || "active";
  return {
    id: `${client.id || "client"}_${type}`,
    client,
    clientId: client.id || "",
    clientName: getClientName(client),
    summary,
    status,
    attention,
    type,
    reason: attention?.reason || getClientAttentionReasons(summary)[0] || "",
    priority: ATTENTION_PRIORITY[type] ?? 90,
    lastActivityTimestamp: getLastActivityTimestamp(summary),
    nextWorkoutLabel: getNextWorkoutLabel(client, now)
  };
}

function sortActionItems(first, second) {
  return first.priority - second.priority ||
    (STATUS_PRIORITY[first.status.id] ?? 9) - (STATUS_PRIORITY[second.status.id] ?? 9) ||
    second.lastActivityTimestamp - first.lastActivityTimestamp ||
    String(first.clientName).localeCompare(String(second.clientName));
}

function getUniqueActionItems(items = []) {
  const uniqueItems = new Map();

  items.forEach((item) => {
    const key = item.clientId || item.client?.id || item.id;
    if (!key || uniqueItems.has(key)) return;
    uniqueItems.set(key, item);
  });

  return [...uniqueItems.values()].sort(sortActionItems);
}

export function buildTrainerActionCenter(clients = [], summaries = {}, now = Date.now()) {
  const items = (Array.isArray(clients) ? clients : []).map((client) => {
    const summary = getTrainerClientSummaryFromMap(client, summaries);
    return buildActionItem(client, summary, getClientAttentionState(client, summary, now), now);
  });

  const todayWorkouts = items
    .map((item) => ({ ...item, todayWorkoutSlots: getTodayWorkoutSlots(item.client, now) }))
    .filter((item) => item.todayWorkoutSlots.length > 0)
    .sort(sortActionItems);
  const missedWorkouts = items.filter((item) => item.attention?.type === "workout").sort(sortActionItems);
  const feedbackItems = items.filter((item) => item.summary.workoutFeedbackAttention?.id).sort(sortActionItems);
  const programEndingItems = items.filter((item) => item.summary.programEndingAttention?.id).sort(sortActionItems);
  const taskItems = items.filter((item) => Number(item.summary.activeTrainerTasksCount) > 0).sort(sortActionItems);
  const measurementItems = items.filter((item) => (
    item.attention?.type === "measure" ||
    (Array.isArray(item.summary.recentEvents) && item.summary.recentEvents.some((event) => event.type === "measurement"))
  )).sort(sortActionItems);
  const inactiveClients = items.filter((item) => item.status.id === "lost" || item.attention?.type === "activity").sort(sortActionItems);
  const attentionItems = items.filter((item) => item.status.id !== "active" || item.attention).sort(sortActionItems);
  const priorityItems = getUniqueActionItems([
    ...todayWorkouts,
    ...missedWorkouts,
    ...feedbackItems,
    ...programEndingItems,
    ...taskItems,
    ...attentionItems
  ]);

  return {
    items,
    attentionItems,
    priorityItems,
    todayWorkouts,
    missedWorkouts,
    feedbackItems,
    programEndingItems,
    taskItems,
    measurementItems,
    inactiveClients,
    quickActions: [
      { id: "addClient", label: "\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430" },
      { id: "createProgram", label: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443" },
      { id: "assignWorkout", label: "\u041d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0443" },
      { id: "createTask", label: "\u0414\u0430\u0442\u044c \u0437\u0430\u0434\u0430\u0447\u0443" }
    ]
  };
}

export function getTrainerActionItemTargetTab(item = {}, groupId = "") {
  if (groupId === "feedbackItems") return "messages";
  if (groupId === "taskItems") return "notifications";
  if (groupId === "programEndingItems") return "workouts";
  if (groupId === "todayWorkouts" || groupId === "missedWorkouts") return "workouts";

  if (item.summary?.workoutFeedbackAttention?.id) return "messages";
  if (Number(item.summary?.activeTrainerTasksCount) > 0) return "notifications";
  if (item.summary?.programEndingAttention?.id) return "workouts";

  const type = item.attention?.type || item.type || "";
  if (type === "workout" || type === "program" || type === "programEnding" || type === "noProgram") return "workouts";
  if (type === "nutrition") return "nutrition";
  if (type === "measure") return "bodyProgress";
  if (type === "feedback") return "messages";
  if (type === "task") return "notifications";
  return "overview";
}

export function buildTrainerClientListItems(clients = [], summaries = {}, {
  search = "",
  filter = "all",
  now = Date.now()
} = {}) {
  const searchText = String(search || "").trim().toLowerCase();

  return (Array.isArray(clients) ? clients : [])
    .map((client) => {
      const summary = getTrainerClientSummaryFromMap(client, summaries);
      const status = getClientActivityStatus(summary);
      const attention = getClientAttentionState(client, summary, now);
      const reasons = getClientAttentionReasons(summary);
      return {
        client,
        summary,
        status,
        attention,
        reasons,
        clientName: getClientName(client),
        lastActivityTimestamp: getLastActivityTimestamp(summary),
        programLabel: summary.assignedProgramId
          ? `${summary.programCompletionPercent ?? 0}%`
          : "\u041d\u0435\u0442 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b",
        nextWorkoutLabel: getNextWorkoutLabel(client, now)
      };
    })
    .filter((item) => {
      const haystack = [
        item.clientName,
        item.client.email,
        item.client.login,
        item.status.label,
        item.programLabel,
        ...item.reasons
      ].filter(Boolean).join(" ").toLowerCase();
      if (searchText && !haystack.includes(searchText)) return false;
      if (filter === "all") return true;
      if (filter === "active") return item.status.id === "active";
      if (filter === "attention") return item.status.id !== "active" || Boolean(item.attention);
      if (filter === "inactive") return item.status.id === "lost";
      if (filter === "noProgram") return item.status.id === "noProgram";
      if (filter === "ending") return Boolean(item.summary.programEndingAttention?.id);
      const goal = String(item.client.goal || item.client.profile?.goal || "").toLowerCase();
      return goal === String(filter || "").toLowerCase();
    })
    .sort((first, second) => {
      const firstPriority = ATTENTION_PRIORITY[first.attention?.type || first.status.id] ?? 90;
      const secondPriority = ATTENTION_PRIORITY[second.attention?.type || second.status.id] ?? 90;
      return firstPriority - secondPriority ||
        (STATUS_PRIORITY[first.status.id] ?? 9) - (STATUS_PRIORITY[second.status.id] ?? 9) ||
        second.lastActivityTimestamp - first.lastActivityTimestamp ||
        String(first.clientName).localeCompare(String(second.clientName));
    });
}

export function buildTrainerClientSnapshot(client = {}, summary = {}, tasks = [], history = []) {
  const sortedHistory = [...(Array.isArray(history) ? history : [])].sort((a, b) => (
    getTrainerSummaryTimestamp(b.date || b.completedAt || b.createdAt) -
    getTrainerSummaryTimestamp(a.date || a.completedAt || a.createdAt)
  ));
  const activeTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => String(task.status || "").toLowerCase() !== "completed");
  const lastWorkout = sortedHistory[0] || null;

  return {
    clientId: client.id || "",
    clientName: getClientName(client),
    goal: client.goal || client.profile?.goal || "",
    level: client.level || client.experience || client.profile?.experience || "",
    limitations: client.limitations || client.injuries || client.profile?.limitations || "",
    equipment: client.equipment || client.profile?.equipment || "",
    workoutsPerWeek: client.workoutsPerWeek || client.trainingDaysPerWeek || client.profile?.workoutsPerWeek || "",
    currentProgramId: summary.assignedProgramId || client.assignedProgramId || "",
    programCompletionPercent: Number.isFinite(summary.programCompletionPercent) ? summary.programCompletionPercent : null,
    completedWorkoutCount: Number(summary.completedWorkoutCount) || 0,
    assignedWorkoutCount: Number(summary.assignedWorkoutCount) || 0,
    lastWorkoutAt: summary.lastWorkoutAt || lastWorkout?.date || lastWorkout?.completedAt || "",
    lastNutritionAt: summary.lastNutritionAt || "",
    lastMeasurementAt: summary.lastMeasurementAt || "",
    activeTasksCount: activeTasks.length,
    lastClientComment: String(lastWorkout?.clientComment || summary.workoutFeedbackAttention?.comment || "").trim(),
    primaryAttention: getClientAttentionState(client, summary),
    status: getClientActivityStatus(summary)
  };
}

function getExerciseName(exercise = {}) {
  return String(exercise.name || exercise.title || exercise.exerciseName || exercise.id || "").trim();
}

function getExerciseSets(exercise = {}) {
  return Array.isArray(exercise.sets)
    ? exercise.sets
    : Array.isArray(exercise.plannedSets)
      ? exercise.plannedSets
      : [];
}

function isCompletedSet(set = {}) {
  return set.completed === true ||
    Number(set.reps || set.completedReps) > 0 ||
    Number(set.weight || set.enteredWeight || set.completedWeight) > 0;
}

function getSetVolume(set = {}) {
  const reps = Number(set.reps || set.completedReps) || 0;
  const weight = Number(set.enteredWeight || set.completedWeight || set.weight) || 0;
  return reps > 0 && weight > 0 ? reps * weight : 0;
}

export function buildTrainerWorkoutReview(historyItem = {}, plannedWorkout = {}) {
  const plannedExercises = Array.isArray(plannedWorkout.exercises)
    ? plannedWorkout.exercises
    : Array.isArray(historyItem.plannedExercises)
      ? historyItem.plannedExercises
      : [];
  const actualExercises = Array.isArray(historyItem.exercises) ? historyItem.exercises : [];
  const completedExerciseNames = new Set(actualExercises
    .filter((exercise) => exercise.completed === true || getExerciseSets(exercise).some(isCompletedSet))
    .map(getExerciseName)
    .filter(Boolean));
  const plannedNames = plannedExercises.map(getExerciseName).filter(Boolean);
  const completedSetsCount = actualExercises.reduce((count, exercise) => (
    count + getExerciseSets(exercise).filter(isCompletedSet).length
  ), 0);
  const plannedSetsCount = plannedExercises.reduce((count, exercise) => (
    count + Math.max(1, getExerciseSets(exercise).length || Number(exercise.setCount) || Number(exercise.setsCount) || 0)
  ), 0);
  const clientComment = String(historyItem.clientComment || historyItem.comment || "").trim();
  const feedbackId = String(historyItem.postWorkoutFeedback?.id || historyItem.readiness?.id || "").trim();
  const flags = [
    clientComment ? "clientComment" : "",
    /pain|hurt|ache|Ð±Ð¾Ð»|Ñ‚Ñ€Ð°Ð²Ð¼|ÑÑƒÑÑ‚Ð°Ð²/i.test(clientComment) ? "pain" : "",
    plannedNames.some((name) => !completedExerciseNames.has(name)) ? "skipped" : ""
  ].filter(Boolean);

  return {
    historyId: historyItem.id || historyItem.clientSaveId || "",
    sourceWorkoutId: historyItem.workoutId || "",
    plannedWorkoutId: plannedWorkout.id || "",
    workoutId: historyItem.workoutId || plannedWorkout.id || historyItem.id || historyItem.clientSaveId || "",
    workoutName: historyItem.workoutName || historyItem.name || plannedWorkout.name || plannedWorkout.title || "",
    workoutDate: historyItem.completedAt || historyItem.finishedAt || historyItem.date || historyItem.createdAt || "",
    assignmentVersion: historyItem.assignedProgramUpdatedAt || historyItem.assignmentVersion || plannedWorkout.assignedProgramUpdatedAt || "",
    plannedExercisesCount: plannedExercises.length,
    completedExercisesCount: completedExerciseNames.size || actualExercises.filter((exercise) => getExerciseSets(exercise).some(isCompletedSet)).length,
    plannedSetsCount,
    completedSetsCount,
    skippedExercises: plannedNames.filter((name) => !completedExerciseNames.has(name)),
    volumeKg: Math.round(actualExercises.reduce((sum, exercise) => (
      sum + getExerciseSets(exercise).reduce((setSum, set) => setSum + getSetVolume(set), 0)
    ), 0)),
    clientComment,
    feedbackId,
    feedbackTitle: historyItem.postWorkoutFeedback?.title || historyItem.readiness?.title || "",
    hasPainComment: flags.includes("pain"),
    flags,
    needsTrainerReply: Boolean(clientComment || flags.includes("pain") || flags.includes("skipped"))
  };
}

export function buildTrainerTaskDraft(kind = "custom", {
  title = "",
  dueDate = "",
  description = ""
} = {}) {
  const preset = TASK_PRESETS[kind] || TASK_PRESETS.custom;
  const target = preset.target || getClientTrainerTaskDestination({ title, description, type: kind });
  return {
    title: String(title || preset.title).trim(),
    target,
    type: target || preset.type || "custom",
    dueDate: dueDate || "",
    description: String(description || "").trim(),
    status: "progress",
    completedAt: ""
  };
}
