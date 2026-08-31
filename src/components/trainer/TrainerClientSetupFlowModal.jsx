import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, LoaderCircle, X } from "lucide-react";

import { getTrainerProgramAssignmentExercises } from "../../utils/trainerProgramAssignmentAdjustment";
import { buildClientWorkoutsFromTemplate } from "../../utils/workoutPlanNormalization";
import { sanitizeExerciseWeightInput } from "../../utils/exerciseWeightInput";
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
    title: "Настройте тренировку под клиента",
    description: "При необходимости скорректируйте стартовые рабочие веса. Изменения применятся только к копии программы этого клиента.",
    action: "Назначить и продолжить"
  },
  schedule: {
    eyebrow: "ПЕРВИЧНАЯ НАСТРОЙКА · ШАГ 2",
    title: "Назначьте даты тренировок",
    description: "Выберите даты всех тренировок программы. По ним автоматически сформируется абонемент клиента.",
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

function getCalendarMonthDays(monthKey) {
  const [year, month] = String(monthKey || getLocalDateKey().slice(0, 7)).split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: getLocalDateKey(date),
      label: date.getDate(),
      currentMonth: date.getMonth() === month - 1
    };
  });
}

function getSavedScheduleDates(client = {}) {
  const calendar = client?.workoutCalendar || {};
  const plannedDates = Array.isArray(calendar.plannedWorkouts)
    ? calendar.plannedWorkouts.map((item) => item?.date)
    : [];
  const scheduledDates = Array.isArray(calendar.scheduledDates)
    ? calendar.scheduledDates
    : Array.isArray(calendar.monthlyTrainingDates)
      ? calendar.monthlyTrainingDates
      : [];

  return [...new Set([...plannedDates, ...scheduledDates]
    .map((date) => String(date || "").slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
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

function formatPlannedWeight(exercise) {
  if (!exercise?.usesWeight || exercise.plannedMinWeight == null) {
    return "Без дополнительного веса";
  }
  if (exercise.plannedMinWeight === exercise.plannedMaxWeight) {
    return `В программе: ${exercise.plannedMinWeight} кг`;
  }
  return `В программе: ${exercise.plannedMinWeight}–${exercise.plannedMaxWeight} кг`;
}

export default function TrainerClientSetupFlowModal({
  client,
  clientName,
  checklist,
  programTemplates = [],
  selectedProgramId = "",
  nutritionGoals = {},
  nutritionPlanOptions = [],
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [closeWarningOpen, setCloseWarningOpen] = useState(false);
  const [programAdjustmentOpen, setProgramAdjustmentOpen] = useState(false);
  const [loadAdjustments, setLoadAdjustments] = useState({});
  const [viewStepIndex, setViewStepIndex] = useState(currentIndex);
  const [scheduleDates, setScheduleDates] = useState(() => getSavedScheduleDates(client));
  const [scheduleMonth, setScheduleMonth] = useState(() => getLocalDateKey().slice(0, 7));
  const [assignedProgramKey, setAssignedProgramKey] = useState(() => String(
    client?.assignedProgramAddedAt || client?.assignedProgramAt || ""
  ).trim());
  const [nutrition, setNutrition] = useState(() => buildNutritionDraft(client, nutritionGoals));
  const [notifications, setNotifications] = useState(() => buildNotificationsDraft(client));
  const selectedProgram = useMemo(
    () => programTemplates.find((item) => item.id === selectedProgramId) || null,
    [programTemplates, selectedProgramId]
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
  const scheduleWorkoutCount = programWorkouts.length || Math.max(0, Number(client?.assignedWorkoutCount) || 0);
  const scheduleDatesComplete = scheduleWorkoutCount > 0 && scheduleDates.length === scheduleWorkoutCount;
  const scheduleDateSet = useMemo(() => new Set(scheduleDates), [scheduleDates]);
  const scheduleMonthDays = useMemo(() => getCalendarMonthDays(scheduleMonth), [scheduleMonth]);
  const todayKey = getLocalDateKey();
  const viewStep = activeStep === "program" && programAdjustmentOpen && !reviewingSavedStep ? "programAdjustment" : activeStep;
  const current = STEP_COPY[viewStep];
  const pendingSetupItems = STEPS
    .slice(currentIndex)
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
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saving]);

  useEffect(() => {
    setError("");
    setProgramAdjustmentOpen(false);
    setLoadAdjustments({});
    setCloseWarningOpen(false);
    setViewStepIndex(currentIndex);
    if (currentStep === "schedule") {
      setAssignedProgramKey((current) => current || String(
        client?.assignedProgramAddedAt || client?.assignedProgramAt || ""
      ).trim());
    }
  }, [client, currentIndex, currentStep]);

  if (!current) return null;

  function shiftScheduleMonth(delta) {
    const [year, month] = scheduleMonth.split("-").map(Number);
    setScheduleMonth(getLocalDateKey(new Date(year, month - 1 + delta, 1)).slice(0, 7));
  }

  function toggleScheduleDate(dateKey) {
    setScheduleDates((dates) => {
      if (dates.includes(dateKey)) return dates.filter((date) => date !== dateKey);
      if (dateKey < todayKey || dates.length >= scheduleWorkoutCount) return dates;
      return [...dates, dateKey].sort();
    });
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
        if (!selectedProgram) {
          setError("Выберите программу из личной библиотеки тренера.");
          return;
        }
        if (!programAdjustmentOpen) {
          setProgramAdjustmentOpen(true);
          return;
        }
        saved = await onAssignProgram?.({ loadAdjustments, skipConfirmation: true });
        const assignmentKey = String(
          saved?.assignment?.assignedAt || saved?.assignment?.assignmentKey || saved?.assignedAt || ""
        ).trim();
        if (saved !== false) {
          setScheduleDates([]);
          setScheduleMonth(getLocalDateKey().slice(0, 7));
          if (assignmentKey) setAssignedProgramKey(assignmentKey);
        }
      } else if (currentStep === "schedule") {
        if (!scheduleWorkoutCount) {
          setError("Сначала назначьте программу с тренировками.");
          return;
        }
        if (!scheduleDatesComplete) {
          setError(`Выберите ${scheduleWorkoutCount} дат тренировок — по одной для каждой тренировки программы.`);
          return;
        }
        saved = await onSaveWorkoutSchedule?.(scheduleDates, { assignmentKey: assignedProgramKey });
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
      setError("Не удалось сохранить настройки. Проверьте соединение и повторите попытку.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="trainer-client-setup-flow-title">
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.icon}><ClipboardList size={22} /></span>
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

          {activeStep === "program" && !programAdjustmentOpen && !reviewingSavedStep ? (
            <div className={styles.fields}>
              <label className={styles.selectField}>
                <span>Программа тренировок</span>
                <select value={selectedProgramId} onChange={(event) => onSelectProgram?.(event.target.value)}>
                  <option value="">Выберите программу</option>
                  {programTemplates.map((program) => <option key={program.id} value={program.id}>{program.name || "Без названия"}</option>)}
                </select>
              </label>
              {selectedProgram ? <div className={styles.summary}><strong>{selectedProgram.name || "Без названия"}</strong><span>{programWorkouts.length} тренировок · клиент получит отдельную копию</span></div> : <div className={styles.hint}>Можно выбрать только программу из личной библиотеки тренера.</div>}
            </div>
          ) : null}

          {activeStep === "program" && programAdjustmentOpen && !reviewingSavedStep ? (
            <div className={styles.fields}>
              <div className={styles.summary}>
                <strong>{selectedProgram?.name || "Выбранная программа"}</strong>
                <span>Оставьте «0», чтобы сохранить веса из программы. Укажите, на сколько увеличить вес для клиента.</span>
              </div>
              {programExercises.length ? (
                <div className={styles.adjustments}>
                  {programExercises.map((exercise) => (
                    <label className={styles.adjustment} key={exercise.key}>
                      <span className={styles.adjustmentCopy}>
                        <strong title={exercise.name}>{exercise.name}</strong>
                        <small>{formatPlannedWeight(exercise)}</small>
                      </span>
                      {exercise.usesWeight ? (
                        <span className={styles.adjustmentInput}>
                          <span className={styles.adjustmentInputLabel}>Прибавить</span>
                          <span className={styles.adjustmentInputControl}>
                            <span aria-hidden="true">+</span>
                            <input
                              type="number"
                              min="0"
                              inputMode="decimal"
                              step="0.5"
                              value={loadAdjustments[exercise.key] ?? ""}
                              placeholder="0"
                              aria-label={`Прибавить к весу: ${exercise.name}`}
                              onFocus={(event) => event.currentTarget.select()}
                              onChange={(event) => setLoadAdjustments((items) => ({
                                ...items,
                                [exercise.key]: sanitizeExerciseWeightInput(event.target.value)
                              }))}
                            />
                            <small>кг</small>
                          </span>
                        </span>
                      ) : <em>Без веса</em>}
                    </label>
                  ))}
                </div>
              ) : <div className={styles.hint}>В этой программе нет упражнений с указанным весом. Программа будет назначена без дополнительных корректировок.</div>}
            </div>
          ) : null}

          {activeStep === "schedule" && !reviewingSavedStep ? (
            <div className={styles.fields}>
              <div className={styles.scheduleSummary}>
                <div>
                  <strong>{selectedProgram?.name || client?.assignedProgramName || "Назначенная программа"}</strong>
                  <span>Выберите ровно {scheduleWorkoutCount} дат — тренировки получат этот порядок автоматически.</span>
                </div>
                <b className={scheduleDatesComplete ? styles.scheduleReady : ""}>{scheduleDates.length}/{scheduleWorkoutCount || 0}<small>выбрано</small></b>
              </div>

              <div className={styles.scheduleCalendar}>
                <div className={styles.scheduleMonth}>
                  <button type="button" onClick={() => shiftScheduleMonth(-1)} aria-label="Предыдущий месяц"><ChevronLeft size={18} /></button>
                  <strong>{new Date(`${scheduleMonth}-01T12:00:00`).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</strong>
                  <button type="button" onClick={() => shiftScheduleMonth(1)} aria-label="Следующий месяц"><ChevronRight size={18} /></button>
                </div>
                <div className={styles.scheduleWeekdays} aria-hidden="true">
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className={styles.scheduleGrid} aria-label="Календарь назначения тренировок">
                  {scheduleMonthDays.map((day) => {
                    const selected = scheduleDateSet.has(day.key);
                    const unavailable = !selected && (day.key < todayKey || scheduleDates.length >= scheduleWorkoutCount);
                    const order = scheduleDates.indexOf(day.key) + 1;
                    return (
                      <button
                        type="button"
                        key={day.key}
                        className={`${!day.currentMonth ? styles.scheduleMuted : ""}${selected ? ` ${styles.scheduleSelected}` : ""}${day.key === todayKey ? ` ${styles.scheduleToday}` : ""}`}
                        aria-pressed={selected}
                        aria-label={`${day.key}${selected ? `, тренировка ${order}` : ""}`}
                        disabled={unavailable || !scheduleWorkoutCount}
                        onClick={() => toggleScheduleDate(day.key)}
                      >
                        <span>{day.label}</span>
                        {selected ? <small>№{order}</small> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.subscriptionPreview}>
                <span><CalendarDays size={20} /></span>
                <div>
                  <strong>Абонемент сформируется автоматически</strong>
                  {scheduleDates.length ? (
                    <p>Период: {formatScheduleDate(scheduleDates[0])} — {formatScheduleDate(scheduleDates[scheduleDates.length - 1])} · куплено занятий: {scheduleDates.length}</p>
                  ) : <p>Выберите даты в календаре — период и количество занятий подставятся сами.</p>}
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
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>

        <footer className={styles.footer}>
          <button className={styles.later} type="button" onClick={goBack} disabled={saving || (!programAdjustmentOpen && viewStepIndex === 0)}>{programAdjustmentOpen ? "Назад к выбору" : "Назад"}</button>
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
            <p>Несохранённые изменения на текущем шаге не сохранятся. Клиент пока не получит:</p>
            <ul>
              {pendingSetupItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
            {programAdjustmentOpen ? <small>Выбранная программа и корректировки нагрузки на этом шаге тоже не сохранятся.</small> : null}
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
