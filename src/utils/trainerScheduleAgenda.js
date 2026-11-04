import { ADMIN_CALENDAR_DAYS } from "./adminClientCalendar.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const text = value => String(value ?? "").trim();
const safeList = value => Array.isArray(value) ? value : [];
const workoutId = value => text(value?.workoutId || value?.id);
const assignmentId = value => text(value?.assignedProgramAddedAt || value?.programAssignmentId);

function validDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const failure = message => ({ ok: false, message, workoutDates: [] });

/** Only upcoming ordinary plan slots are editable; historical facts are not. */
export function isAgendaSlotEditable(slot = {}, today = localToday()) {
  const status = text(slot.status || "planned").toLowerCase();
  const date = text(slot.plannedDate);
  return !slot.isCompleted && !slot.isMissed && !slot.isShifted &&
    !slot.completedDate && !slot.shiftedDate && status === "planned" &&
    (!date || validDate(date) && date >= today);
}

export function getAgendaDateDraft(slots = []) {
  return Object.fromEntries(safeList(slots).map(slot => [workoutId(slot), text(slot.plannedDate)]).filter(([id]) => id));
}

/** Reuse the existing upcoming rhythm without changing any saved date. */
export function getAgendaWeekdayDefaults(slots = [], today = localToday(), trainingDays = []) {
  const dates = safeList(slots).filter(slot => isAgendaSlotEditable(slot, today))
    .map(slot => text(slot.plannedDate)).filter(validDate).sort();
  const configuredDays = safeList(trainingDays).map(day => ADMIN_CALENDAR_DAYS.findIndex(item => item.id === day) + 1).filter(Boolean);
  return {
    days: [...new Set(configuredDays.length ? configuredDays : dates.map(date => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7 + 1))].sort((a, b) => a - b),
    startDate: dates[0] || today
  };
}

/** Explain the existing save-button guards without changing schedule data. */
export function getAgendaScheduleSaveHint({ saving = false, canSave = true, days = [], startDate = "", today = localToday(), dateDirty = false } = {}) {
  if (saving) return "Сохраняю даты. Дождитесь завершения.";
  if (!canSave) return "Сохранение сейчас недоступно. Откройте карточку клиента заново.";
  if (!days.length) return "Выберите хотя бы один день недели.";
  if (!startDate) return "Укажите дату начала расписания.";
  if (startDate < today) return "Выберите сегодняшнюю или будущую дату начала.";
  if (!dateDirty) return "Даты не изменены. Измените дату занятия или выберите другие дни недели.";
  return "";
}

/** Validate one complete assignment, keeping each date attached to its ID. */
export function validateAgendaDateDraft(slots = [], draft = {}, today = localToday()) {
  const items = safeList(slots);
  if (!items.length) return failure("Сначала назначьте клиенту программу тренировок.");
  const ids = items.map(workoutId);
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) return failure("Не удалось определить занятия программы. Обновите карточку клиента.");
  if (!draft || typeof draft !== "object" || Array.isArray(draft) || Object.keys(draft).some(id => !ids.includes(id))) {
    return failure("Расписание содержит занятие из другой программы. Обновите карточку клиента.");
  }
  const workoutDates = [];
  for (const slot of items) {
    const id = workoutId(slot), date = text(draft[id]), original = text(slot.plannedDate);
    if (!validDate(date)) return failure("Укажите корректную дату для каждого занятия. Если у выполненной тренировки нет плановой даты, обновите карточку клиента.");
    if (!isAgendaSlotEditable(slot, today) && date !== original) {
      return failure("Даты выполненных, пропущенных и перенесённых занятий менять здесь нельзя.");
    }
    if (isAgendaSlotEditable(slot, today) && date < today) return failure("Выберите сегодняшнюю или будущую дату.");
    workoutDates.push({ workoutId: id, date });
  }
  if (new Set(workoutDates.map(item => item.date)).size !== workoutDates.length) {
    return failure("Каждая тренировка программы должна быть назначена на отдельную дату.");
  }
  return { ok: true, message: "", workoutDates };
}

/** ISO weekdays: Monday=1, Sunday=7. Preserve every read-only slot verbatim. */
export function distributeAgendaWeekdays(slots = [], draft = {}, days = [], startDate = "", today = localToday()) {
  const selectedDays = new Set(safeList(days).map(Number).filter(day => Number.isInteger(day) && day >= 1 && day <= 7));
  const start = text(startDate);
  if (!selectedDays.size) return { ok: false, message: "Выберите хотя бы один день недели.", draft };
  if (!validDate(start) || start < today) return { ok: false, message: "Выберите сегодняшнюю или будущую дату начала.", draft };
  const items = safeList(slots), editable = items.filter(slot => isAgendaSlotEditable(slot, today));
  if (!editable.length) return { ok: false, message: "В этой программе нет будущих занятий для изменения.", draft };
  const result = { ...getAgendaDateDraft(items), ...draft };
  const reserved = new Set(items.filter(slot => !isAgendaSlotEditable(slot, today)).map(slot => text(slot.plannedDate)).filter(Boolean));
  const date = new Date(`${start}T12:00:00Z`);
  let index = 0;
  for (let offset = 0; offset < 37000 && index < editable.length; offset++) {
    const key = date.toISOString().slice(0, 10), weekday = (date.getUTCDay() + 6) % 7 + 1;
    if (selectedDays.has(weekday) && !reserved.has(key)) {
      result[workoutId(editable[index++])] = key;
      reserved.add(key);
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }
  if (index !== editable.length) return { ok: false, message: "Не удалось распределить занятия. Укажите более близкую дату начала.", draft };
  return { ok: true, message: "", draft: result };
}

function findSavedSlot(entries, workout, index) {
  const assignment = assignmentId(workout), id = workoutId(workout);
  const scoped = safeList(entries).filter(entry => !assignment || !assignmentId(entry) || assignmentId(entry) === assignment);
  return scoped.find(entry => text(entry.workoutId) === id) ||
    scoped.find(entry => !text(entry.workoutId) && (Number(entry.order) === index + 1 || Number(entry.index) === index)) || {};
}

/** Keep the UI and keyed-save guard on the same saved identity/status source. */
export function getAgendaDisplaySlots(slots = [], workouts = [], savedEntries = []) {
  const byId = new Map(safeList(workouts).map(workout => [workoutId(workout), workout]));
  return safeList(slots).map((slot, index) => {
    const workout = byId.get(workoutId(slot));
    if (!workout) return slot;
    const existing = findSavedSlot(savedEntries, workout, index);
    const savedStatus = text(existing.status).toLowerCase();
    const status = slot.isCompleted ? slot.status : savedStatus && savedStatus !== "planned" ? savedStatus : slot.status;
    const completedDate = slot.completedDate || text(existing.completedDate);
    const isCompleted = slot.isCompleted || ["completed", "completed_off_date"].includes(status) || Boolean(completedDate);
    const isMissed = !isCompleted && ["missed", "not_completed"].includes(status);
    const isShifted = slot.isShifted || ["moved", "shifted"].includes(status) || Boolean(existing.movedToDate || workout.movedToDate);
    return { ...slot, plannedDate: text(existing.date || workout.scheduledDate || workout.plannedDate || slot.plannedDate), status, completedDate, isCompleted, isMissed, isShifted };
  });
}

/**
 * Adapter for the new keyed UI only. The legacy string[] branch stays in the
 * existing handler. It deliberately does not sort dates: source identity and
 * immutable historical status win over chronological position.
 */
export function resolveAgendaScheduleInput(input, workouts = [], savedEntries = [], { todayDate = localToday() } = {}) {
  if (input?.trainingDays !== undefined && (!Array.isArray(input.trainingDays) || !input.trainingDays.length ||
    input.trainingDays.some(day => !ADMIN_CALENDAR_DAYS.some(item => item.id === day)) ||
    new Set(input.trainingDays).size !== input.trainingDays.length)) return failure("Выберите корректные дни недели.");
  const rows = input?.workoutDates, source = safeList(workouts);
  if (!Array.isArray(rows) || !source.length) return failure("Сначала назначьте клиенту программу тренировок.");
  const sourceIds = source.map(workoutId), ids = rows.map(row => text(row?.workoutId));
  if (sourceIds.some(id => !id) || new Set(sourceIds).size !== sourceIds.length || rows.length !== source.length ||
    ids.some(id => !id || !sourceIds.includes(id)) || new Set(ids).size !== ids.length) {
    return failure("Набор занятий изменился. Обновите карточку клиента и повторите настройку расписания.");
  }
  const assignments = new Set(source.map(assignmentId).filter(Boolean));
  const programs = new Set(source.map(item => text(item.assignedProgramId)).filter(Boolean));
  if (assignments.size > 1 || programs.size > 1) return failure("Настраивайте расписание одной программы за раз.");
  const byId = new Map(source.map(item => [workoutId(item), item]));
  const orderedWorkouts = ids.map(id => byId.get(id));
  const saved = orderedWorkouts.map((workout, index) => findSavedSlot(savedEntries, workout, source.indexOf(workout) >= 0 ? source.indexOf(workout) : index));
  const slots = orderedWorkouts.map((workout, index) => {
    const existing = saved[index];
    const existingStatus = text(existing.status).toLowerCase(), ownStatus = text(workout.status || "planned").toLowerCase();
    const status = existingStatus && existingStatus !== "planned" ? existingStatus : ownStatus;
    const plannedDate = text(existing.date || workout.scheduledDate || workout.plannedDate);
    const completedDate = text(existing.completedDate || workout.completedAt);
    return {
      workoutId: workoutId(workout), plannedDate, status,
      completedDate,
      isCompleted: ["completed", "completed_off_date"].includes(status) || Boolean(completedDate),
      isMissed: ["missed", "not_completed"].includes(status),
      isShifted: ["moved", "shifted"].includes(status) || Boolean(existing.movedToDate || workout.movedToDate)
    };
  });
  const draft = Object.fromEntries(rows.map(row => [text(row.workoutId), text(row.date)]));
  const result = validateAgendaDateDraft(slots, draft, todayDate);
  if (!result.ok) return result;
  const cleanDates = result.workoutDates.map(row => row.date);
  const plannedWorkouts = orderedWorkouts.map((workout, index) => {
    const existing = saved[index];
    return {
      ...existing,
      order: index + 1,
      index,
      workoutId: workoutId(workout),
      workoutName: text(workout.name || existing.workoutName || `Тренировка ${index + 1}`),
      assignedProgramAddedAt: assignmentId(workout) || assignmentId(existing),
      assignedProgramUpdatedAt: text(workout.assignedProgramUpdatedAt || existing.assignedProgramUpdatedAt),
      assignedProgramId: text(workout.assignedProgramId || existing.assignedProgramId),
      assignedProgramName: text(workout.assignedProgramName || existing.assignedProgramName),
      date: cleanDates[index],
      status: slots[index].status,
      movedToDate: text(existing.movedToDate || workout.movedToDate),
      statusUpdatedAt: existing.statusUpdatedAt || workout.statusUpdatedAt || "",
      completedDate: text(existing.completedDate),
      dateOrderPolicy: "workout_identity"
    };
  });
  return { ...result, cleanDates, plannedWorkouts, workouts: orderedWorkouts };
}
