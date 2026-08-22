import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, ClipboardList, LoaderCircle, X } from "lucide-react";

import { getTrainerProgramAssignmentExercises } from "../../utils/trainerProgramAssignmentAdjustment";
import { buildClientWorkoutsFromTemplate } from "../../utils/workoutPlanNormalization";
import styles from "./TrainerClientSetupFlowModal.module.css";

const STEPS = ["subscription", "program", "nutrition", "notifications"];

const STEP_COPY = {
  subscription: {
    eyebrow: "ПЕРВИЧНАЯ НАСТРОЙКА · ШАГ 1",
    title: "Настройте абонемент",
    description: "Укажите срок действия и количество тренировок для клиента.",
    action: "Сохранить и продолжить"
  },
  program: {
    eyebrow: "ПЕРВИЧНАЯ НАСТРОЙКА · ШАГ 2",
    title: "Назначьте программу",
    description: "Выберите готовую программу — её копия будет создана для клиента.",
    action: "Настроить программу"
  },
  programAdjustment: {
    eyebrow: "ПЕРВИЧНАЯ НАСТРОЙКА · ШАГ 2",
    title: "Настройте тренировку под клиента",
    description: "При необходимости скорректируйте стартовые рабочие веса. Изменения применятся только к копии программы этого клиента.",
    action: "Назначить и продолжить"
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

function formatDateForInput(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

function buildSubscriptionDraft(client) {
  const subscription = client?.subscription || client?.subscriptionSettings || {};
  return {
    startDate: formatDateForInput(subscription.startDate || subscription.validFrom),
    endDate: formatDateForInput(subscription.endDate || subscription.validTo),
    purchasedSessions: Number(subscription.purchasedSessions ?? subscription.sessionsTotal ?? 0),
    usedSessions: Number(subscription.usedSessions ?? subscription.sessionsUsed ?? 0),
    frozen: Boolean(subscription.frozen)
  };
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

function NumberField({ label, value, suffix, onChange, min = 0 }) {
  return (
    <label className={styles.numberField}>
      <span>{label}</span>
      <div>
        <input
          type="number"
          min={min}
          value={value}
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
    return `Стартовый вес: ${exercise.plannedMinWeight} кг`;
  }
  return `Стартовый вес: ${exercise.plannedMinWeight}–${exercise.plannedMaxWeight} кг`;
}

export default function TrainerClientSetupFlowModal({
  client,
  clientName,
  checklist,
  programTemplates = [],
  selectedProgramId = "",
  nutritionGoals = {},
  onSelectProgram,
  onSaveSubscription,
  onAssignProgram,
  onSaveNutritionPlan,
  onSaveNotifications,
  onClose
}) {
  const currentStep = checklist?.currentStep;
  const currentIndex = Math.max(0, STEPS.indexOf(currentStep));
  const closeButtonRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [programAdjustmentOpen, setProgramAdjustmentOpen] = useState(false);
  const [loadAdjustments, setLoadAdjustments] = useState({});
  const [subscription, setSubscription] = useState(() => buildSubscriptionDraft(client));
  const [nutrition, setNutrition] = useState(() => buildNutritionDraft(client, nutritionGoals));
  const [notifications, setNotifications] = useState(() => buildNotificationsDraft(client));
  const selectedProgram = useMemo(
    () => programTemplates.find((item) => item.id === selectedProgramId) || null,
    [programTemplates, selectedProgramId]
  );
  const programWorkouts = useMemo(
    () => buildClientWorkoutsFromTemplate(selectedProgram || {}),
    [selectedProgram]
  );
  const programExercises = useMemo(
    () => getTrainerProgramAssignmentExercises(programWorkouts),
    [programWorkouts]
  );
  const viewStep = currentStep === "program" && programAdjustmentOpen ? "programAdjustment" : currentStep;
  const current = STEP_COPY[viewStep];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose?.();
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
  }, [currentStep]);

  if (!current) return null;

  async function submitCurrentStep() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      let saved = false;
      if (currentStep === "subscription") {
        saved = await onSaveSubscription?.({ subscriptionOnly: true, subscription: {
          ...subscription,
          purchasedSessions: Number(subscription.purchasedSessions) || 0,
          usedSessions: Number(subscription.usedSessions) || 0
        } });
      } else if (currentStep === "program") {
        if (!selectedProgram) {
          setError("Выберите программу из личной библиотеки тренера.");
          return;
        }
        if (!programAdjustmentOpen) {
          setProgramAdjustmentOpen(true);
          return;
        }
        saved = await onAssignProgram?.({ loadAdjustments, skipConfirmation: true });
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
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose?.()}>
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="trainer-client-setup-flow-title">
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.icon}><ClipboardList size={22} /></span>
            <div>
              <p>{current.eyebrow}</p>
              <h2 id="trainer-client-setup-flow-title">{current.title}</h2>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} disabled={saving} aria-label="Настроить позже"><X size={21} /></button>
        </header>

        <div className={styles.progress} aria-label={`Шаг ${currentIndex + 1} из ${STEPS.length}`}>
          {STEPS.map((step, index) => <span key={step} className={index <= currentIndex ? styles.progressActive : ""} />)}
        </div>

        <div className={styles.content}>
          <p className={styles.clientName}>{clientName}</p>
          <p className={styles.description}>{current.description}</p>

          {currentStep === "subscription" ? (
            <div className={styles.fields}>
              <div className={styles.row}>
                <label><span>Действует с</span><input type="date" value={subscription.startDate} onChange={(event) => setSubscription((item) => ({ ...item, startDate: event.target.value }))} /></label>
                <label><span>Действует по</span><input type="date" value={subscription.endDate} min={subscription.startDate || undefined} onChange={(event) => setSubscription((item) => ({ ...item, endDate: event.target.value }))} /></label>
              </div>
              <div className={styles.row}>
                <NumberField label="Куплено тренировок" value={subscription.purchasedSessions} onChange={(value) => setSubscription((item) => ({ ...item, purchasedSessions: value }))} />
                <NumberField label="Уже использовано" value={subscription.usedSessions} onChange={(value) => setSubscription((item) => ({ ...item, usedSessions: value }))} />
              </div>
              <label className={styles.checkbox}><input type="checkbox" checked={subscription.frozen} onChange={(event) => setSubscription((item) => ({ ...item, frozen: event.target.checked }))} /><span>Абонемент приостановлен</span></label>
            </div>
          ) : null}

          {currentStep === "program" && !programAdjustmentOpen ? (
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

          {currentStep === "program" && programAdjustmentOpen ? (
            <div className={styles.fields}>
              <div className={styles.summary}>
                <strong>{selectedProgram?.name || "Выбранная программа"}</strong>
                <span>Стартовые веса можно оставить без изменений — тогда клиент получит значения из программы.</span>
              </div>
              {programExercises.length ? (
                <div className={styles.adjustments}>
                  {programExercises.map((exercise) => (
                    <label className={styles.adjustment} key={exercise.key}>
                      <span className={styles.adjustmentCopy}>
                        <strong>{exercise.name}</strong>
                        <small>{formatPlannedWeight(exercise)}</small>
                      </span>
                      {exercise.usesWeight ? (
                        <span className={styles.adjustmentInput}>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            value={loadAdjustments[exercise.key] ?? ""}
                            placeholder="0"
                            aria-label={`Корректировка веса: ${exercise.name}`}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) => setLoadAdjustments((items) => ({ ...items, [exercise.key]: event.target.value }))}
                          />
                          <small>кг</small>
                        </span>
                      ) : <em>Без веса</em>}
                    </label>
                  ))}
                </div>
              ) : <div className={styles.hint}>В этой программе нет упражнений с указанным весом. Программа будет назначена без дополнительных корректировок.</div>}
            </div>
          ) : null}

          {currentStep === "nutrition" ? (
            <div className={styles.fields}>
              <label><span>Название плана</span><input value={nutrition.name} onChange={(event) => setNutrition((item) => ({ ...item, name: event.target.value }))} /></label>
              <label><span>Цель клиента</span><input value={nutrition.goal} onChange={(event) => setNutrition((item) => ({ ...item, goal: event.target.value }))} /></label>
              <div className={styles.macros}>
                <NumberField label="Калории" value={nutrition.calories} suffix="ккал" onChange={(value) => setNutrition((item) => ({ ...item, calories: value }))} />
                <NumberField label="Белки" value={nutrition.protein} suffix="г" onChange={(value) => setNutrition((item) => ({ ...item, protein: value }))} />
                <NumberField label="Жиры" value={nutrition.fat} suffix="г" onChange={(value) => setNutrition((item) => ({ ...item, fat: value }))} />
                <NumberField label="Углеводы" value={nutrition.carbs} suffix="г" onChange={(value) => setNutrition((item) => ({ ...item, carbs: value }))} />
              </div>
            </div>
          ) : null}

          {currentStep === "notifications" ? (
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
          <button className={styles.later} type="button" onClick={programAdjustmentOpen ? () => setProgramAdjustmentOpen(false) : onClose} disabled={saving}>{programAdjustmentOpen ? "Назад к выбору" : "Настроить позже"}</button>
          <button className={styles.primary} type="button" onClick={submitCurrentStep} disabled={saving}>
            {saving ? <LoaderCircle className={styles.spinner} size={18} /> : currentStep === "notifications" ? <Check size={18} /> : <ChevronRight size={18} />}
            {saving ? "Сохраняю…" : current.action}
          </button>
        </footer>
      </section>
    </div>
  );
}
