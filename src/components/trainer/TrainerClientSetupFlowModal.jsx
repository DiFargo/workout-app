import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronRight, CircleAlert, ClipboardList, LoaderCircle, X } from "lucide-react";

import { getTrainerProgramAssignmentExercises } from "../../utils/trainerProgramAssignmentAdjustment";
import { buildClientWorkoutsFromTemplate } from "../../utils/workoutPlanNormalization";
import { sanitizeExerciseWeightInput } from "../../utils/exerciseWeightInput";
import { canAssignTrainerProgram } from "../../utils/trainerProgramLifecycle.js";
import { getTrainerActionErrorStatus } from "../../utils/trainerActionStatus.js";
import { ADMIN_CALENDAR_DAYS } from "../../utils/adminClientCalendar.js";
import { getTrainerSetupScheduleSlots, getTrainerSetupScheduleWorkouts } from "../../utils/trainerSetupSchedule.js";
import { distributeAgendaWeekdays, getAgendaDateDraft, getAgendaWeekdayDefaults, isAgendaSlotEditable, validateAgendaDateDraft } from "../../utils/trainerScheduleAgenda.js";
import { formatRussianCount } from "../../utils/russianCount.js";
import styles from "./TrainerClientSetupFlowModal.module.css";

const STEPS = ["program", "schedule", "nutrition", "notifications"];

const PENDING_STEP_LABELS = {
  program: "программа тренировок",
  schedule: "даты тренировок и абонемент",
  nutrition: "план питания",
  notifications: "напоминания"
};

const STEP_COPY = {
  program: {
    eyebrow: "ПЕРВИЧНАЯ НАСТРОЙКА · ШАГ 1",
    title: "Назначьте программу",
    description: "Выберите готовую программу — её копия будет создана для клиента.",
    action: "Настроить программу"
  },
  programAdjustment: {
    eyebrow: "ПЕРВИЧНАЯ НАСТРОЙКА · ШАГ 1",
    title: "Настройте веса для клиента",
    description: "Это отдельная копия программы. Общий шаблон и история клиента не изменятся.",
    action: "Назначить и продолжить"
  },
  programProgress: {
    eyebrow: "ПЕРВИЧНАЯ НАСТРОЙКА · ШАГ 1",
    title: "Программа уже назначена",
    description: "Программа и корректировки нагрузки уже сохранены. Осталось сохранить отметку завершения шага.",
    action: "Сохранить отметку и продолжить"
  },
  schedule: {
    eyebrow: "ПЕРВИЧНАЯ НАСТРОЙКА · ШАГ 2",
    title: "Назначьте даты тренировок",
    description: "Выберите дни недели — даты заполнятся автоматически. Любую дату можно изменить ниже.",
    action: "Сохранить расписание"
  },
  nutrition: {
    eyebrow: "ПЕРВИЧНАЯ НАСТРОЙКА · ШАГ 3",
    title: "Настройте питание",
    description: "Сохраните дневные цели по калориям и БЖУ.",
    action: "Сохранить и продолжить"
  },
  notifications: {
    eyebrow: "ПЕРВИЧНАЯ НАСТРОЙКА · ШАГ 4",
    title: "Настройте напоминания",
    description: "Выберите, какие напоминания получит клиент.",
    action: "Завершить настройку"
  }
};

function getLocalDateKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatScheduleDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(date.getTime()) ? dateKey : date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short"
  });
}

function buildNutritionDraft(client, goals) {
  const plan = client?.nutritionPlan || {};
  return {
    name: plan.name || "Индивидуальный план",
    goal: plan.goal || client?.goalDescription || client?.goal || "",
    calories: Number(plan.calories || goals?.calories) || 2000,
    protein: Number(plan.protein || goals?.protein) || 150,
    fat: Number(plan.fat || goals?.fat) || 50,
    carbs: Number(plan.carbs || goals?.carbs) || 200,
    validFrom: plan.validFrom || "",
    validTo: plan.validTo || "",
    presetId: plan.presetId || plan.preset || "custom"
  };
}

function buildNotificationsDraft(client) {
  const calendar = client?.workoutCalendar || {};
  const progress = calendar.progressReminderSettings || client?.progressReminderSettings || {};
  return {
    enabled: calendar.reminderEnabled !== false && client?.telegramNotificationsEnabled !== false,
    offsets: Array.isArray(calendar.reminderOffsetsHours) && calendar.reminderOffsetsHours.length
      ? calendar.reminderOffsetsHours.map(Number)
      : [24],
    scheduledDates: Array.isArray(calendar.scheduledDates) ? calendar.scheduledDates : [],
    progressPhotoEnabled: progress.photoEnabled === true || calendar.progressPhotoReminderEnabled === true,
    measurementsEnabled: progress.measurementsEnabled === true || calendar.measurementsReminderEnabled === true,
    progressPhotoIntervalDays: Number(progress.photoIntervalDays || calendar.progressPhotoReminderIntervalDays || 14),
    measurementsIntervalDays: Number(progress.measurementsIntervalDays || calendar.measurementsReminderIntervalDays || 14)
  };
}

function NumberField({ label, value, suffix, onChange, min = 0, disabled = false, describedBy }) {
  return (
    <label className={styles.numberField}>
      <span>{label}</span>
      <div>
        <input
          type="number"
          min={min}
          value={value}
          disabled={disabled}
          aria-describedby={describedBy}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix ? <small>{suffix}</small> : null}
      </div>
    </label>
  );
}

function formatPlannedWeight(exercise, addition = 0) {
  if (!exercise?.usesWeight) {
    return "Без дополнительного веса";
  }
  if (exercise.plannedMinWeight == null) return "Рабочий вес не указан";
  if (exercise.plannedMinWeight === exercise.plannedMaxWeight) {
    return `${exercise.plannedMinWeight + addition} кг`;
  }
  return `${exercise.plannedMinWeight + addition}–${exercise.plannedMaxWeight + addition} кг`;
}

export default function TrainerClientSetupFlowModal(props) {
  const assignedWorkouts = getTrainerSetupScheduleWorkouts(props.workouts, props.client);
  const scheduleIdentity = props.checklist?.currentStep === "schedule" ? assignedWorkouts.map(workout => workout.id).join(":") : "";
  return <TrainerClientSetupFlowForm key={`${props.client?.id || ""}:${props.checklist?.currentStep || ""}:${scheduleIdentity}`} {...props} assignedWorkouts={assignedWorkouts} />;
}

function TrainerClientSetupFlowForm({
  client,
  clientName,
  checklist,
  assignedWorkouts = [],
  programTemplates = [],
  selectedProgramId = "",
  nutritionGoals = {},
  nutritionPlanOptions = [],
  pendingProgramProgress = false,
  onSelectProgram,
  onAssignProgram,
  onSaveWorkoutSchedule,
  onSaveNutritionPlan,
  onSaveNotifications,
  onClose
}) {
  const currentStep = checklist?.currentStep;
  const currentIndex = Math.max(0, STEPS.indexOf(currentStep));
  const closeButtonRef = useRef(null);
  const errorRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [closeWarningOpen, setCloseWarningOpen] = useState(false);
  const [programAdjustmentOpen, setProgramAdjustmentOpen] = useState(false);
  const [loadAdjustments, setLoadAdjustments] = useState({});
  const [viewStepIndex, setViewStepIndex] = useState(currentIndex);
  const scheduleSlots = getTrainerSetupScheduleSlots(assignedWorkouts, client?.workoutCalendar);
  const todayKey = getLocalDateKey();
  const [scheduleDraft, setScheduleDraft] = useState(() => {
    const draft = getAgendaDateDraft(scheduleSlots);
    const defaults = getAgendaWeekdayDefaults(scheduleSlots, todayKey, client?.workoutCalendar?.trainingDays || client?.trainingDays);
    if (Object.values(draft).some(Boolean) || !defaults.days.length) return draft;
    const result = distributeAgendaWeekdays(scheduleSlots, draft, defaults.days, defaults.startDate, todayKey);
    return result.ok ? result.draft : draft;
  });
  const [scheduleDays, setScheduleDays] = useState(() => getAgendaWeekdayDefaults(scheduleSlots, todayKey, client?.workoutCalendar?.trainingDays || client?.trainingDays).days);
  const [scheduleStart, setScheduleStart] = useState(() => getAgendaWeekdayDefaults(scheduleSlots, todayKey).startDate);
  const [manualDateIds, setManualDateIds] = useState([]);
  const [nutrition, setNutrition] = useState(() => buildNutritionDraft(client, nutritionGoals));
  const [notifications, setNotifications] = useState(() => buildNotificationsDraft(client));
  const assignablePrograms = useMemo(() => programTemplates.filter(canAssignTrainerProgram), [programTemplates]);
  const selectedProgram = useMemo(
    () => assignablePrograms.find((item) => item.id === selectedProgramId) || null,
    [assignablePrograms, selectedProgramId]
  );
  const nutritionPresetOptions = useMemo(
    () => (Array.isArray(nutritionPlanOptions) ? nutritionPlanOptions : []).filter((option) => (
      option?.id && option?.name
    )),
    [nutritionPlanOptions]
  );
  const selectedNutritionPreset = nutritionPresetOptions.find((option) => (
    String(option.id) === String(nutrition.presetId)
  )) || null;
  const isIndividualNutritionPreset = !selectedNutritionPreset;
  const programWorkouts = useMemo(
    () => buildClientWorkoutsFromTemplate(selectedProgram || {}),
    [selectedProgram]
  );
  const programExercises = useMemo(
    () => getTrainerProgramAssignmentExercises(programWorkouts),
    [programWorkouts]
  );
  const activeStep = STEPS[viewStepIndex] || currentStep;
  const reviewingSavedStep = viewStepIndex < currentIndex;
  const scheduleWorkoutCount = assignedWorkouts.length;
  const scheduleDates = Object.values(scheduleDraft).filter(Boolean).sort();
  const scheduleValidation = validateAgendaDateDraft(scheduleSlots, scheduleDraft, todayKey);
  const editableScheduleSlots = scheduleSlots.filter(slot => isAgendaSlotEditable(slot, todayKey));
  const pendingProgramStep = activeStep === "program" && pendingProgramProgress && !reviewingSavedStep;
  const viewStep = pendingProgramStep ? "programProgress" : activeStep === "program" && programAdjustmentOpen && !reviewingSavedStep ? "programAdjustment" : activeStep;
  const current = STEP_COPY[viewStep];
  const pendingSetupItems = STEPS
    .slice(currentIndex)
    .filter((step) => !pendingProgramProgress || step !== "program")
    .map((step) => PENDING_STEP_LABELS[step])
    .filter(Boolean);

  function requestClose() {
    if (!saving) setCloseWarningOpen(true);
  }

  function selectNutritionPreset(value) {
    const nextPreset = nutritionPresetOptions.find((option) => String(option.id) === String(value));
    if (!nextPreset) {
      setNutrition((current) => ({ ...current, presetId: "custom" }));
      return;
    }

    setNutrition((current) => ({
      ...current,
      name: nextPreset.name,
      goal: nextPreset.goal || current.goal,
      calories: nextPreset.calories,
      protein: nextPreset.protein,
      fat: nextPreset.fat,
      carbs: nextPreset.carbs,
      presetId: nextPreset.id
    }));
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || saving) return;
      event.preventDefault();
      setCloseWarningOpen((open) => !open);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saving]);

  useEffect(() => {
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.focus({ preventScroll: true });
    errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  if (!current) return null;

  function updateScheduleDays(days, start = scheduleStart) {
    setScheduleDays(days);
    setScheduleStart(start);
    setError("");
    if (!days.length || !start) return;
    const result = distributeAgendaWeekdays(scheduleSlots, scheduleDraft, days, start, todayKey);
    if (!result.ok) { setError(result.message); return; }
    setScheduleDraft(result.draft);
    setManualDateIds([]);
  }

  function updateScheduleDate(id, date) {
    setScheduleDraft(current => ({ ...current, [id]: date }));
    setManualDateIds(current => [...new Set([...current, id])]);
    setError("");
  }

  function goBack() {
    if (programAdjustmentOpen) {
      setProgramAdjustmentOpen(false);
      return;
    }
    if (viewStepIndex === 0 || saving) return;
    setError("");
    setViewStepIndex((index) => Math.max(0, index - 1));
  }

  async function submitCurrentStep() {
    if (saving) return;
    if (reviewingSavedStep) {
      setError("");
      setViewStepIndex((index) => Math.min(currentIndex, index + 1));
      return;
    }
    setSaving(true);
    setError("");
    try {
      let saved = false;
      if (currentStep === "program") {
        if (!pendingProgramProgress && !selectedProgram) {
          setError("Выберите программу из личной библиотеки тренера.");
          return;
        }
        if (!pendingProgramProgress && !programAdjustmentOpen) {
          setProgramAdjustmentOpen(true);
          return;
        }
        saved = await onAssignProgram?.({ loadAdjustments, skipConfirmation: true, throwOnError: true });
      } else if (currentStep === "schedule") {
        if (!scheduleWorkoutCount) {
          setError("Сначала назначьте программу с тренировками.");
          return;
        }
        if (editableScheduleSlots.length && !scheduleDays.length) {
          setError("Выберите хотя бы один день недели. Затем при необходимости измените отдельные даты.");
          return;
        }
        if (!scheduleValidation.ok) {
          setError(scheduleValidation.message);
          return;
        }
        saved = await onSaveWorkoutSchedule?.({
          workoutDates: scheduleValidation.workoutDates,
          ...(scheduleDays.length ? { trainingDays: scheduleDays.map(day => ADMIN_CALENDAR_DAYS[day - 1].id) } : {})
        }, assignedWorkouts, { throwOnError: true });
      } else if (currentStep === "nutrition") {
        saved = await onSaveNutritionPlan?.({
          ...nutrition,
          calories: Number(nutrition.calories) || 0,
          protein: Number(nutrition.protein) || 0,
          fat: Number(nutrition.fat) || 0,
          carbs: Number(nutrition.carbs) || 0
        });
      } else if (currentStep === "notifications") {
        saved = await onSaveNotifications?.(notifications);
      }
      if (saved === false) throw new Error("Setup step was not saved");
    } catch (saveError) {
      console.error("Trainer client setup step failed:", saveError);
      setError(saveError?.assignmentMessage || getTrainerActionErrorStatus(saveError, "Не удалось сохранить настройки. Проверьте данные и повторите попытку."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.backdrop} data-modal-backdrop="true" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="trainer-client-setup-flow-title">
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.icon}><ClipboardList size={22} aria-hidden="true" /></span>
            <div>
              <p>{current.eyebrow}</p>
              <h2 id="trainer-client-setup-flow-title">{current.title}</h2>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={requestClose} disabled={saving} aria-label="Закрыть настройку"><X size={21} /></button>
        </header>

        <div className={styles.progress} aria-label={`Шаг ${viewStepIndex + 1} из ${STEPS.length}`}>
          {STEPS.map((step, index) => <span key={step} className={index <= viewStepIndex ? styles.progressActive : ""} />)}
        </div>

        <div className={styles.content}>
          <p className={styles.clientName}>{clientName}</p>
          <p className={styles.description}>{current.description}</p>

          {reviewingSavedStep ? (
            <div className={styles.summary}>
              <strong>Шаг уже сохранён</strong>
              <span>Проверьте информацию и нажмите «Продолжить», чтобы вернуться к текущему шагу.</span>
            </div>
          ) : null}

          {pendingProgramStep ? <div className={styles.summary}><strong>{client?.assignedProgramName || selectedProgram?.name || "Персональная программа"}</strong><span>Повторного назначения не будет.</span></div> : null}

          {activeStep === "program" && !pendingProgramProgress && !programAdjustmentOpen && !reviewingSavedStep ? (
            <div className={styles.fields}>
              <label className={styles.selectField}>
                <span>Программа тренировок</span>
                <select value={selectedProgram?.id || ""} onChange={(event) => onSelectProgram?.(event.target.value)}>
                  <option value="">Выберите программу</option>
                  {assignablePrograms.map((program) => <option key={program.id} value={program.id}>{program.name || "Без названия"}</option>)}
                </select>
              </label>
              {selectedProgram ? <div className={styles.summary}><strong>{selectedProgram.name || "Без названия"}</strong><span>{formatRussianCount(programWorkouts.length, ["тренировка", "тренировки", "тренировок"])} · клиент получит отдельную копию</span></div> : <div className={styles.hint}>Можно выбрать только программу из личной библиотеки тренера.</div>}
            </div>
          ) : null}

          {activeStep === "program" && !pendingProgramProgress && programAdjustmentOpen && !reviewingSavedStep ? (
            <div className={styles.fields}>
              <div className={styles.summary}>
                <strong>{selectedProgram?.name || "Выбранная программа"}</strong>
                <span>{formatRussianCount(programWorkouts.length, ["тренировка", "тренировки", "тренировок"])} · {formatRussianCount(programExercises.length, ["упражнение", "упражнения", "упражнений"])}</span>
                <span>Добавьте вес только там, где нужно. При «0» вес останется как в шаблоне.</span>
              </div>
              {programExercises.length ? (
                <div className={styles.adjustments}>
                  {programExercises.map((exercise) => (
                    <div className={styles.adjustment} key={exercise.key}>
                      <div className={styles.adjustmentCopy}>
                        <strong>{exercise.name}</strong>
                        <small>{exercise.usesWeight && exercise.plannedMinWeight != null ? `В шаблоне: ${formatPlannedWeight(exercise)}` : formatPlannedWeight(exercise)}</small>
                      </div>
                      {exercise.usesWeight && exercise.plannedMinWeight != null ? (
                        <>
                        <label className={styles.adjustmentInput}>
                          <span className={styles.adjustmentInputLabel}>Добавить к весу</span>
                          <span className={styles.adjustmentInputControl}>
                            <span aria-hidden="true">+</span>
                            <input
                              type="number"
                              min="0"
                              inputMode="decimal"
                              step="0.5"
                              value={loadAdjustments[exercise.key] ?? ""}
                              placeholder="0"
                              aria-label={`Добавить к весу: ${exercise.name}`}
                              disabled={saving}
                              onFocus={(event) => event.currentTarget.select()}
                              onChange={(event) => setLoadAdjustments((items) => ({
                                ...items,
                                [exercise.key]: sanitizeExerciseWeightInput(event.target.value)
                              }))}
                            />
                            <small>кг</small>
                          </span>
                        </label>
                        <div className={styles.adjustmentResult}>
                          <span>У клиента</span>
                          <strong>{formatPlannedWeight(exercise, Number(loadAdjustments[exercise.key]) || 0)}</strong>
                        </div>
                        </>
                      ) : <em>{exercise.usesWeight ? "Без поправки" : "Без веса"}</em>}
                    </div>
                  ))}
                </div>
              ) : <div className={styles.hint}>В этой программе нет упражнений с указанным весом. Программа будет назначена без дополнительных корректировок.</div>}
            </div>
          ) : null}

          {activeStep === "schedule" && !reviewingSavedStep ? (
            <div className={styles.fields}>
              <div className={styles.scheduleSummary}>
                <div>
                  <strong>{client?.assignedProgramName || "Назначенная программа"}</strong>
                  <span>{formatRussianCount(scheduleWorkoutCount, ["тренировка", "тренировки", "тренировок"])} · даты закреплены за каждым занятием</span>
                </div>
                <b className={scheduleValidation.ok ? styles.scheduleReady : ""}>{scheduleDates.length}/{scheduleWorkoutCount || 0}<small>с датой</small></b>
              </div>

              {scheduleWorkoutCount ? <>
                <fieldset className={styles.weekdaysField} disabled={saving || !editableScheduleSlots.length}>
                  <legend>Дни недели</legend>
                  <div className={styles.weekdayGrid}>{["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, index) => (
                    <label key={day} className={`${styles.weekday} ${scheduleDays.includes(index + 1) ? styles.weekdaySelected : ""}`}>
                      <input type="checkbox" checked={scheduleDays.includes(index + 1)} onChange={event => updateScheduleDays(event.target.checked ? [...scheduleDays, index + 1].sort((a, b) => a - b) : scheduleDays.filter(value => value !== index + 1))} />
                      <span>{day}</span>
                    </label>
                  ))}</div>
                </fieldset>
                <div className={styles.startDateRow}>
                  <label className={styles.selectField}><span>Начиная с</span><input type="date" value={scheduleStart} min={todayKey} disabled={saving || !editableScheduleSlots.length} onChange={event => updateScheduleDays(scheduleDays, event.target.value)} /></label>
                  <p>{manualDateIds.length ? "Смена дней недели или даты начала заполнит даты заново." : scheduleValidation.ok ? "Даты готовы. При необходимости поправьте отдельное занятие ниже." : scheduleDays.length ? "Проверьте даты всех занятий ниже." : "Выберите хотя бы один день недели для автозаполнения."}</p>
                </div>
                <div className={styles.datePreview}>
                  <div className={styles.previewHeading}><h3>Даты занятий</h3><span>Можно изменить вручную</span></div>
                  <div className={styles.dateList}>{scheduleSlots.map(slot => (
                    <div className={styles.dateRow} key={slot.workoutId}>
                      <div><strong>{slot.workoutName}</strong>{!isAgendaSlotEditable(slot, todayKey) ? <small>Только просмотр</small> : manualDateIds.includes(slot.workoutId) ? <small>Изменено вручную</small> : null}</div>
                      <label><span className={styles.visuallyHidden}>Дата — {slot.workoutName}</span><input type="date" value={scheduleDraft[slot.workoutId] || ""} min={todayKey} disabled={saving || !isAgendaSlotEditable(slot, todayKey)} onChange={event => updateScheduleDate(slot.workoutId, event.target.value)} /></label>
                    </div>
                  ))}</div>
                </div>
              </> : <p className={styles.hint} role="status">Загружаем назначенные тренировки. Если список не появился, закройте мастер и откройте его снова — назначать программу повторно не нужно.</p>}

              <div className={styles.subscriptionPreview}>
                <span><CalendarDays size={20} aria-hidden="true" /></span>
                <div>
                  <strong>Расписание и абонемент — отдельно</strong>
                  {scheduleDates.length ? (
                    <p>Период занятий: {formatScheduleDate(scheduleDates[0])} — {formatScheduleDate(scheduleDates[scheduleDates.length - 1])}. Баланс абонемента не изменится.</p>
                  ) : <p>Выберите даты тренировок. Это не изменит количество проданных и выполненных занятий.</p>}
                </div>
              </div>
            </div>
          ) : null}

          {activeStep === "nutrition" && !reviewingSavedStep ? (
            <div className={styles.fields}>
              <div className={styles.planModeRow}>
                <label className={styles.selectField}>
                  <span>Вариант плана</span>
                  <select
                    aria-label="Вариант плана питания"
                    value={isIndividualNutritionPreset ? "custom" : nutrition.presetId}
                    onChange={(event) => selectNutritionPreset(event.target.value)}
                  >
                    <option value="custom">Индивидуальные значения</option>
                    {nutritionPresetOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </label>
                <div id="setup-nutrition-plan-mode" className={`${styles.planModeSummary}${isIndividualNutritionPreset ? ` ${styles.planModeSummaryIndividual}` : ""}`}>
                  <strong>{isIndividualNutritionPreset ? "Ручная настройка" : selectedNutritionPreset.name}</strong>
                  <span>{isIndividualNutritionPreset
                    ? "Введите название и дневные цели вручную."
                    : "Название и КБЖУ подставлены из шаблона; цель можно уточнить."}</span>
                </div>
              </div>
              <label className={!isIndividualNutritionPreset ? styles.lockedField : ""}>
                <span>Название плана</span>
                <input
                  value={nutrition.name}
                  disabled={!isIndividualNutritionPreset}
                  aria-describedby={!isIndividualNutritionPreset ? "setup-nutrition-plan-mode" : undefined}
                  onChange={(event) => setNutrition((item) => ({ ...item, name: event.target.value }))}
                />
              </label>
              <label><span>Цель клиента</span><input value={nutrition.goal} onChange={(event) => setNutrition((item) => ({ ...item, goal: event.target.value }))} /></label>
              <div className={styles.macros}>
                <NumberField label="Калории" value={nutrition.calories} suffix="ккал" disabled={!isIndividualNutritionPreset} describedBy={!isIndividualNutritionPreset ? "setup-nutrition-plan-mode" : undefined} onChange={(value) => setNutrition((item) => ({ ...item, calories: value }))} />
                <NumberField label="Белки" value={nutrition.protein} suffix="г" disabled={!isIndividualNutritionPreset} describedBy={!isIndividualNutritionPreset ? "setup-nutrition-plan-mode" : undefined} onChange={(value) => setNutrition((item) => ({ ...item, protein: value }))} />
                <NumberField label="Жиры" value={nutrition.fat} suffix="г" disabled={!isIndividualNutritionPreset} describedBy={!isIndividualNutritionPreset ? "setup-nutrition-plan-mode" : undefined} onChange={(value) => setNutrition((item) => ({ ...item, fat: value }))} />
                <NumberField label="Углеводы" value={nutrition.carbs} suffix="г" disabled={!isIndividualNutritionPreset} describedBy={!isIndividualNutritionPreset ? "setup-nutrition-plan-mode" : undefined} onChange={(value) => setNutrition((item) => ({ ...item, carbs: value }))} />
              </div>
            </div>
          ) : null}

          {activeStep === "notifications" && !reviewingSavedStep ? (
            <div className={styles.fields}>
              <label className={styles.checkbox}><input type="checkbox" checked={notifications.enabled} onChange={(event) => setNotifications((item) => ({ ...item, enabled: event.target.checked }))} /><span>Напоминать о тренировках</span></label>
              <label className={styles.selectField}><span>Когда напомнить</span><select value={notifications.offsets[0] || 24} onChange={(event) => setNotifications((item) => ({ ...item, offsets: [Number(event.target.value)] }))}><option value="48">За 48 часов</option><option value="24">За 24 часа</option><option value="3">За 3 часа</option></select></label>
              <label className={styles.checkbox}><input type="checkbox" checked={notifications.progressPhotoEnabled} onChange={(event) => setNotifications((item) => ({ ...item, progressPhotoEnabled: event.target.checked }))} /><span>Напоминать о фото прогресса</span></label>
              <label className={styles.checkbox}><input type="checkbox" checked={notifications.measurementsEnabled} onChange={(event) => setNotifications((item) => ({ ...item, measurementsEnabled: event.target.checked }))} /><span>Напоминать о замерах</span></label>
            </div>
          ) : null}
          {error ? <p ref={errorRef} className={styles.error} role="alert" tabIndex={-1}>{error}</p> : null}
        </div>

        <footer className={styles.footer}>
          <button className={styles.later} type="button" onClick={goBack} disabled={saving || pendingProgramStep || (!programAdjustmentOpen && viewStepIndex === 0)}>{programAdjustmentOpen && !pendingProgramStep ? "Назад к выбору" : "Назад"}</button>
          <button className={styles.primary} type="button" onClick={submitCurrentStep} disabled={saving}>
            {saving ? <LoaderCircle className={styles.spinner} size={18} /> : activeStep === "notifications" && !reviewingSavedStep ? <Check size={18} /> : <ChevronRight size={18} />}
            {saving ? "Сохраняю…" : reviewingSavedStep ? "Продолжить" : current.action}
          </button>
        </footer>
      </section>
      {closeWarningOpen ? (
        <div className={styles.closeWarning} role="presentation">
          <section className={styles.closeWarningCard} role="dialog" aria-modal="true" aria-labelledby="trainer-client-setup-close-title">
            <span className={styles.closeWarningIcon} aria-hidden="true"><CircleAlert size={25} /></span>
            <h3 id="trainer-client-setup-close-title">Закрыть первичную настройку?</h3>
            <p>{pendingProgramProgress ? "Программа уже назначена. Остальные шаги настройки можно завершить позже:" : "Несохранённые изменения на текущем шаге не сохранятся. Клиент пока не получит:"}</p>
            <ul>
              {pendingSetupItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
            {programAdjustmentOpen && !pendingProgramProgress ? <small>Выбранная программа и корректировки нагрузки на этом шаге тоже не сохранятся.</small> : null}
            <div className={styles.closeWarningActions}>
              <button type="button" className={styles.closeWarningContinue} onClick={() => setCloseWarningOpen(false)}>Продолжить настройку</button>
              <button type="button" className={styles.closeWarningDismiss} onClick={onClose}>Закрыть мастер</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
