import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronLeft, Dumbbell, KeyRound, Sparkles } from "lucide-react";

import {
  createBasicWorkoutLongPlanAccessRecord,
  getBasicWorkoutLongPlanAccessStorageKey,
  hasBasicWorkoutLongPlanAccess,
  isBasicWorkoutLongPlanAccessCode
} from "../../../utils/basicWorkoutLongPlanAccess";
import { buildBasicWorkoutPlanFromQuiz } from "../../../utils/basicWorkoutPlanBuilder";
import { getBasicWorkoutQuizDraft, getBasicWorkoutQuizStepHint } from "../../../utils/basicWorkoutQuizDraft";
import {
  applyBasicWorkoutSchedule,
  buildBasicWorkoutScheduleCalendar,
  buildDefaultBasicWorkoutSchedule,
  getBasicWorkoutScheduleMonthKey,
  hasCompleteBasicWorkoutSchedule,
  normalizeBasicWorkoutScheduleDates
} from "../../../utils/basicWorkoutSchedule";
import { shiftProfileWorkoutMonthKey } from "../../../utils/profileWorkoutSchedule";
import { safeReadJsonStorage, safeWriteJsonStorage } from "../../../utils/storageSafety";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import { ProfileWorkoutCalendarContent } from "../profile/ProfileWorkoutCalendarModal";
import { requestBasicWorkoutAiPlan } from "./basicWorkoutAi";
import styles from "./BasicWorkoutQuizPage.module.css";

const QUIZ_STEPS = [
  {
    key: "goal",
    eyebrow: "Цель",
    title: "Для чего тебе нужен план?",
    description: "Подберём нагрузку и упражнения под твой основной фокус.",
    options: [
      { value: "general_fitness", label: "Хорошая форма", hint: "Сила, выносливость и самочувствие" },
      { value: "fat_loss", label: "Снижение веса", hint: "Больше движения и умеренная нагрузка" },
      { value: "muscle", label: "Набор мышц", hint: "Постепенное увеличение тренировочного объёма" },
      { value: "strength", label: "Стать сильнее", hint: "Базовые движения и контроль техники" }
    ]
  },
  {
    key: "level",
    eyebrow: "Опыт",
    title: "Какой у тебя опыт?",
    description: "План начнётся с комфортного и понятного уровня нагрузки.",
    options: [
      { value: "beginner", label: "Я новичок", hint: "Только начинаю или тренировался давно" },
      { value: "returning", label: "Возвращаюсь", hint: "Раньше тренировался, сейчас начинаю заново" },
      { value: "experienced", label: "Есть опыт", hint: "Регулярно тренировался последние месяцы" }
    ]
  },
  {
    key: "location",
    eyebrow: "Место",
    title: "Где будешь тренироваться?",
    description: "Покажем упражнения только с доступным оборудованием.",
    options: [
      { value: "gym", label: "В тренажёрном зале", hint: "Тренажёры, гантели и штанги доступны" },
      { value: "home", label: "Дома", hint: "Вес тела, гантели или минимальное оборудование" }
    ]
  },
  {
    key: "days",
    eyebrow: "Расписание",
    title: "Сколько раз в неделю?",
    description: "Оставим достаточно времени для восстановления.",
    options: [
      { value: "2", label: "2 тренировки", hint: "Мягкий и устойчивый старт" },
      { value: "3", label: "3 тренировки", hint: "Оптимальный базовый ритм" },
      { value: "4", label: "4 тренировки", hint: "Больше тренировочного объёма" },
      { value: "5", label: "5 тренировок", hint: "Короткие и распределённые занятия" }
    ]
  },
  {
    key: "duration",
    eyebrow: "Время",
    title: "Сколько времени есть на тренировку?",
    description: "Количество упражнений и отдыха будет соответствовать твоему графику.",
    options: [
      { value: "30", label: "Около 30 минут", hint: "3–4 упражнения" },
      { value: "45", label: "Около 45 минут", hint: "4–5 упражнений" },
      { value: "60", label: "Около 60 минут", hint: "5–6 упражнений" },
      { value: "90", label: "Около 90 минут", hint: "6–8 упражнений" }
    ]
  },
  {
    key: "restrictions",
    eyebrow: "Самочувствие",
    title: "Есть ли ограничения?",
    description: "Это поможет исключить неподходящие движения из плана.",
    options: [
      { value: "none", label: "Нет ограничений", hint: "Могу выполнять базовые упражнения" },
      { value: "back", label: "Спина", hint: "Учтём дискомфорт или рекомендации специалиста" },
      { value: "knees", label: "Колени", hint: "Снизим ударную и глубокую нагрузку" },
      { value: "shoulders", label: "Плечи", hint: "Подберём более щадящие варианты жимов" },
      { value: "other", label: "Другое", hint: "Можно кратко описать ниже" }
    ]
  },
  {
    key: "planPreferences",
    eyebrow: "Пожелания",
    title: "Есть пожелания к плану?",
    description: "Напиши, что важно учесть: любимые упражнения, желаемый акцент или то, чего хочется избегать. Это необязательно."
  }
];

const TWO_DAY_STRUCTURE_OPTIONS = [
  {
    value: "recovery_split",
    label: "Больше восстановления",
    hint: "Грудь и спина — в разные дни."
  },
  {
    value: "balanced_full_body",
    label: "Равномерная нагрузка",
    hint: "Всё тело в обе тренировки, но с разным акцентом."
  }
];

const GENERATION_PROGRESS_STAGES = [
  {
    afterMs: 0,
    percent: 8,
    title: "Проверяем анкету",
    description: "Учитываем цель, опыт и ограничения."
  },
  {
    afterMs: 900,
    percent: 21,
    title: "Настраиваем нагрузку",
    description: "Определяем объём, отдых и формат тренировок."
  },
  {
    afterMs: 3200,
    percent: 43,
    title: "Подбираем упражнения",
    description: "Оставляем только подходящие варианты."
  },
  {
    afterMs: 8200,
    percent: 64,
    title: "Собираем план на 4 недели",
    description: "Создаём два варианта недели и прогрессию."
  },
  {
    afterMs: 15000,
    percent: 81,
    title: "Проверяем восстановление",
    description: "Сверяем порядок упражнений и нагрузку."
  },
  {
    afterMs: 25000,
    percent: 92,
    title: "Завершаем план",
    description: "Почти готово — ещё немного."
  }
];

function getGenerationProgressStage(elapsedMs = 0) {
  return GENERATION_PROGRESS_STAGES.reduce((current, stage, index) => (
    elapsedMs >= stage.afterMs ? { ...stage, index } : current
  ), { ...GENERATION_PROGRESS_STAGES[0], index: 0 });
}

function getOptionLabel(stepKey, value) {
  return QUIZ_STEPS
    .find((step) => step.key === stepKey)
    ?.options.find((option) => option.value === value)
    ?.label || "Не выбрано";
}

function getTwoDayStructureLabel(value) {
  return TWO_DAY_STRUCTURE_OPTIONS.find((option) => option.value === value)?.label
    || "Не выбрано";
}

function getReviewAnswer(step, quiz) {
  if (step.key === "planPreferences") {
    return String(quiz.planPreferences || "").trim() || "Нет пожеланий";
  }
  return getOptionLabel(step.key, quiz[step.key]);
}

function getPlanScheduleDates(plan = {}) {
  return normalizeBasicWorkoutScheduleDates(
    (Array.isArray(plan?.workouts) ? plan.workouts : []).map((workout) => (
      workout?.scheduledDate || workout?.plannedDate || ""
    ))
  );
}

export default function BasicWorkoutQuizPage({
  renderClientMainBottomBar,
  basicWorkoutQuiz,
  userId,
  startingWeightProfile,
  workoutHistory,
  onBasicWorkoutQuizChange,
  onApplyBasicWorkoutPlan,
  onOpenToday,
  onBackToWorkouts,
  canUseTrainerFeatures,
  onGoMain,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [editingFromReview, setEditingFromReview] = useState(false);
  const questionRef = useRef(null);
  const reviewAnswersRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState("idle");
  const [generationProgress, setGenerationProgress] = useState(() => getGenerationProgressStage());
  const [generationError, setGenerationError] = useState("");
  const [planSaveError, setPlanSaveError] = useState("");
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [ownPlanNotice, setOwnPlanNotice] = useState("");
  const accessStorageKey = getBasicWorkoutLongPlanAccessStorageKey(userId);
  const [isLongPlanUnlocked, setIsLongPlanUnlocked] = useState(() => (
    hasBasicWorkoutLongPlanAccess(safeReadJsonStorage(accessStorageKey, null))
  ));
  const [accessCode, setAccessCode] = useState("");
  const [accessCodeError, setAccessCodeError] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState(() => (
    Array.isArray(basicWorkoutQuiz?.generatedPlan?.workouts)
      ? basicWorkoutQuiz.generatedPlan
      : null
  ));
  const initialScheduleDates = getPlanScheduleDates(basicWorkoutQuiz?.generatedPlan);
  const [planScheduleDates, setPlanScheduleDates] = useState(initialScheduleDates);
  const [scheduleDraftDates, setScheduleDraftDates] = useState(initialScheduleDates);
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState("");
  const [scheduleMonth, setScheduleMonth] = useState(() => getBasicWorkoutScheduleMonthKey(initialScheduleDates));
  const [scheduleSelectedDate, setScheduleSelectedDate] = useState(() => (
    initialScheduleDates[0] || new Date().toISOString().slice(0, 10)
  ));
  const quiz = getBasicWorkoutQuizDraft(basicWorkoutQuiz);
  const isReviewStep = stepIndex === QUIZ_STEPS.length;
  const currentStep = QUIZ_STEPS[stepIndex];
  const stepHint = currentStep ? getBasicWorkoutQuizStepHint(currentStep.key, quiz) : "";
  const firstIncompleteStep = QUIZ_STEPS.findIndex((step) => getBasicWorkoutQuizStepHint(step.key, quiz));
  const planPreview = generatedPlan
    ? buildBasicWorkoutPlanFromQuiz({ ...quiz, generatedPlan }, undefined, {
      profile: startingWeightProfile,
      history: workoutHistory
    })
    : null;
  const previewSchedule = buildBasicWorkoutScheduleCalendar({
    monthKey: scheduleMonth,
    scheduledDates: planScheduleDates,
    draftDates: scheduleDraftDates,
    editing: scheduleEditing
  });

  useEffect(() => {
    setIsLongPlanUnlocked(hasBasicWorkoutLongPlanAccess(safeReadJsonStorage(accessStorageKey, null)));
    setAccessCode("");
    setAccessCodeError("");
  }, [accessStorageKey]);

  useEffect(() => {
    questionRef.current?.parentElement?.scrollTo({ top: 0, behavior: "instant" });
    reviewAnswersRef.current?.scrollTo({ top: 0, behavior: "instant" });
    questionRef.current?.focus({ preventScroll: true });
  }, [stepIndex, isLongPlanUnlocked]);

  function editAnswer(index) {
    setEditingFromReview(true);
    setStepIndex(index);
  }

  function nextStep() {
    if (stepHint) return;
    if (editingFromReview) {
      setStepIndex(firstIncompleteStep === -1 ? QUIZ_STEPS.length : firstIncompleteStep);
      if (firstIncompleteStep === -1) setEditingFromReview(false);
    } else {
      setStepIndex((current) => Math.min(current + 1, QUIZ_STEPS.length));
    }
  }

  function unlockLongPlan(event) {
    event.preventDefault();
    if (!isBasicWorkoutLongPlanAccessCode(accessCode)) {
      setAccessCodeError("Неверный код. Проверь цифры и попробуй ещё раз.");
      return;
    }

    const isStored = safeWriteJsonStorage(
      accessStorageKey,
      createBasicWorkoutLongPlanAccessRecord()
    );
    if (!isStored) {
      setAccessCodeError("Не удалось сохранить активацию. Проверь настройки браузера и попробуй ещё раз.");
      return;
    }
    setAccessCodeError("");
    setIsLongPlanUnlocked(true);
  }

  function updateQuiz(field, value) {
    setGenerationError("");
    setPlanSaveError("");
    setOwnPlanNotice("");
    setGeneratedPlan(null);
    setPlanScheduleDates([]);
    setScheduleDraftDates([]);
    setScheduleEditing(false);
    setScheduleStatus("");
    onBasicWorkoutQuizChange((previous) => ({
      ...previous,
      [field]: value,
      longPlanAnswers: {
        ...getBasicWorkoutQuizDraft(previous),
        [field]: value,
        ...(field === "restrictions" && value !== "other" ? { restrictionDetails: "" } : {})
      },
      generatedPlan: undefined
    }));
  }

  async function generatePlan() {
    if (firstIncompleteStep !== -1) {
      setStepIndex(firstIncompleteStep);
      return;
    }
    if (isGenerating) return;
    setGenerationError("");
    setPlanSaveError("");
    setOwnPlanNotice("");
    setIsGenerating(true);
    setGenerationPhase("creating");
    const startedAt = performance.now();
    const updateGenerationProgress = () => {
      setGenerationProgress(getGenerationProgressStage(performance.now() - startedAt));
    };
    updateGenerationProgress();
    const progressTimer = window.setInterval(updateGenerationProgress, 650);

    try {
      const plan = await requestBasicWorkoutAiPlan(quiz, startingWeightProfile);
      window.clearInterval(progressTimer);
      setGenerationProgress({ percent: 100, title: "План готов", description: "Открываем обзор программы.", index: GENERATION_PROGRESS_STAGES.length });
      setGenerationPhase("ready");
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const defaultScheduleDates = buildDefaultBasicWorkoutSchedule(plan.workouts?.length, quiz.days);
      setGeneratedPlan(plan);
      setOwnPlanNotice(plan?.requiresReview
        ? "Вы выбрали ограничение, поэтому мы собрали временный базовый план из проверенных упражнений. Это не медицинская реабилитация: выполняйте только движения без боли и согласуйте нагрузку со специалистом."
        : plan?.generationFallback
          ? "Приложение автоматически собрало надёжный план из проверенных упражнений."
          : "");
      setPlanScheduleDates(defaultScheduleDates);
      setScheduleDraftDates(defaultScheduleDates);
      setScheduleEditing(false);
      setScheduleStatus("");
      setScheduleMonth(getBasicWorkoutScheduleMonthKey(defaultScheduleDates));
      setScheduleSelectedDate(defaultScheduleDates[0] || new Date().toISOString().slice(0, 10));
    } catch (error) {
      console.warn("Basic workout AI request failed; using local fallback plan.", error);
      try {
        createSafeFallbackPlan(
          "ИИ временно недоступен, поэтому мы подготовили безопасный базовый план по вашим ответам."
        );
      } catch (fallbackError) {
        console.error("Basic workout local fallback failed:", fallbackError);
        setGenerationError(error?.message || "Не удалось составить план. Попробуйте ещё раз.");
      }
    } finally {
      window.clearInterval(progressTimer);
      setGenerationPhase("idle");
      setIsGenerating(false);
    }
  }

  async function saveGeneratedPlan() {
    if (!generatedPlan) return;

    const workoutCount = planPreview?.workouts?.length || 0;
    const normalizedScheduleDates = normalizeBasicWorkoutScheduleDates(planScheduleDates);

    if (!hasCompleteBasicWorkoutSchedule(normalizedScheduleDates, workoutCount)) {
      setScheduleDraftDates(normalizedScheduleDates);
      setScheduleEditing(true);
      setScheduleStatus(
        `Выберите дату для каждой из ${workoutCount || "всех"} тренировок, прежде чем сохранить план.`
      );
      return;
    }

    const scheduledPlan = applyBasicWorkoutSchedule(generatedPlan, normalizedScheduleDates);
    const nextQuiz = { ...quiz, generatedPlan: scheduledPlan };
    setPlanSaveError("");
    onBasicWorkoutQuizChange((previous) => ({ ...previous, generatedPlan: scheduledPlan }));
    setIsSavingPlan(true);

    try {
      const result = await onApplyBasicWorkoutPlan(nextQuiz);

      if (result?.cloudSaved === false) {
        setPlanSaveError(
          result.offline
            ? "Нет подключения к интернету. План не сохранён в облаке — подключитесь и повторите сохранение."
            : "Не удалось сохранить план в облаке. Данные не потеряны — повторите сохранение."
        );
        return;
      }

      onBasicWorkoutQuizChange((previous) => ({ ...previous, generatedPlan: undefined }));
    } catch (error) {
      console.error("Basic workout plan save failed:", error);
      setPlanSaveError("Не удалось сохранить план в облаке. Данные не потеряны — повторите сохранение.");
    } finally {
      setIsSavingPlan(false);
    }
  }

  function createSafeFallbackPlan(notice = "ИИ сейчас недоступен, поэтому мы подготовили безопасный базовый план по вашим ответам.") {
    const fallbackPlan = buildBasicWorkoutPlanFromQuiz(
      { ...quiz, generatedPlan: undefined },
      undefined,
      { profile: startingWeightProfile, history: workoutHistory }
    );
    const resolvedFallbackPlan = {
      ...fallbackPlan,
      generatedBy: "fallback",
      generationFallback: true
    };
    const defaultScheduleDates = buildDefaultBasicWorkoutSchedule(
      resolvedFallbackPlan.workouts?.length,
      quiz.days
    );

    setGeneratedPlan(resolvedFallbackPlan);
    setPlanScheduleDates(defaultScheduleDates);
    setScheduleDraftDates(defaultScheduleDates);
    setScheduleEditing(false);
    setScheduleStatus("");
    setScheduleMonth(getBasicWorkoutScheduleMonthKey(defaultScheduleDates));
    setScheduleSelectedDate(defaultScheduleDates[0] || new Date().toISOString().slice(0, 10));
    setGenerationError("");
    setPlanSaveError("");
    setOwnPlanNotice(notice);
  }

  function toggleScheduleDate(dateKey) {
    const maximumDates = planPreview?.workouts?.length || 0;

    setScheduleDraftDates((current) => {
      if (current.includes(dateKey)) {
        setScheduleStatus("");
        return current.filter((date) => date !== dateKey);
      }
      if (maximumDates && current.length >= maximumDates) {
        setScheduleStatus(`В плане ${maximumDates} тренировок — сначала перенесите одну из выбранных дат.`);
        return current;
      }
      setScheduleStatus("");
      return normalizeBasicWorkoutScheduleDates([...current, dateKey]);
    });
  }

  return (
    <div className={`${styles.page} ${isReviewStep && !generatedPlan ? styles.reviewPage : ""} ${isLongPlanUnlocked && !isReviewStep && !generatedPlan ? styles.wizardPage : ""} ${generatedPlan && planPreview ? styles.resultPage : ""}`} data-testid="basic-quiz-page" data-css-module-scope="basic-quiz">
      <ClientPageHeader
        compact
        className={styles.topBar}
        title="План на 4 недели"
        titleTestId="basic-quiz-title"
        eyebrow="Базовые тренировки"
        onBack={onBackToWorkouts || onOpenTraining}
        backAriaLabel="Вернуться к тренировкам"
        testId="basic-quiz-header"
        scope="basic-quiz-header"
      />

      <nav className={styles.planSwitcher} aria-label="Формат базовой тренировки" data-testid="basic-workout-plan-switcher">
        <button type="button" onClick={onOpenToday}>
          <Dumbbell aria-hidden="true" />
          <span><strong>На сегодня</strong><small>Быстрая тренировка</small></span>
        </button>
        <button type="button" aria-current="page">
          <CalendarDays aria-hidden="true" />
          <span><strong>На 4 недели</strong><small>Полная программа</small></span>
        </button>
      </nav>

      {!isLongPlanUnlocked ? (
        <main className={styles.accessGate}>
          <section className={styles.accessCard} aria-labelledby="basic-quiz-access-title">
            <span className={styles.accessIcon} aria-hidden="true"><KeyRound /></span>
            <span className={styles.eyebrow}>Программа на 4 недели</span>
            <h2 id="basic-quiz-access-title">Введи код доступа</h2>
            <p>Код нужен только один раз, чтобы перейти к подбору базовой программы.</p>
            <form className={styles.accessForm} onSubmit={unlockLongPlan} noValidate>
              <label className={styles.accessField}>
                <span>Код доступа</span>
                <input
                  aria-describedby="basic-quiz-access-help"
                  aria-invalid={Boolean(accessCodeError)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={4}
                  onChange={(event) => {
                    setAccessCode(event.target.value.replace(/\D/g, "").slice(0, 4));
                    setAccessCodeError("");
                  }}
                  pattern="[0-9]*"
                  placeholder="••••"
                  type="text"
                  value={accessCode}
                />
              </label>
              <p className={styles.accessHelp} id="basic-quiz-access-help">После активации код больше не понадобится на этом устройстве.</p>
              {accessCodeError ? <p className={styles.accessError} role="alert">{accessCodeError}</p> : null}
              <button className={styles.accessButton} type="submit" disabled={accessCode.length !== 4}>
                Продолжить
              </button>
            </form>
          </section>
        </main>
      ) : generatedPlan && planPreview ? (
        <>
        <section className={styles.resultCard} data-testid="basic-quiz-result">
          <div className={styles.resultIcon} aria-hidden="true"><Sparkles /></div>
          <span className={styles.eyebrow}>План готов</span>
          <h2>{planPreview.name}</h2>
          <p>{planPreview.description}</p>
          {ownPlanNotice ? <p className={styles.placeholderNotice} role="status">{ownPlanNotice}</p> : null}

          <div className={styles.resultStats}>
            <span><b>{planPreview.durationWeeks || 4}</b><small>недели</small></span>
            <span><b>{planPreview.workouts.length}</b><small>тренировок</small></span>
            <span><b>{quiz.duration}</b><small>минут</small></span>
          </div>

          {planPreview.safetyNote ? <p className={styles.safetyNote}>{planPreview.safetyNote}</p> : null}
          <p className={styles.progressionNote}>Стартовые веса будут рассчитаны по анкете и уточнятся после первого подхода.</p>
          {planPreview.progressionNote ? <p className={styles.progressionNote}>{planPreview.progressionNote}</p> : null}

          <section className={styles.scheduleSection} aria-label="Расписание тренировок">
            <div className={styles.scheduleHeading}>
              <strong>Расписание тренировок</strong>
              <span>Даты расставлены автоматически. Их можно изменить до сохранения плана.</span>
            </div>
            <ProfileWorkoutCalendarContent
              monthDate={previewSchedule.monthDate}
              monthKey={scheduleMonth}
              calendarDays={previewSchedule.calendarDays}
              selectedDate={scheduleSelectedDate}
              selectedItems={[]}
              scheduledDates={planScheduleDates}
              draftDates={scheduleDraftDates}
              editing={scheduleEditing}
              saving={false}
              status={scheduleStatus}
              getTimestampValue={(value) => new Date(value).getTime()}
              onShiftMonth={(direction) => {
                const nextMonth = shiftProfileWorkoutMonthKey(scheduleMonth, direction);
                setScheduleMonth(nextMonth);
                setScheduleSelectedDate(`${nextMonth}-01`);
              }}
              onStartEdit={() => {
                setScheduleDraftDates(planScheduleDates);
                setScheduleEditing(true);
                setScheduleStatus("");
              }}
              onCancelEdit={() => {
                setScheduleDraftDates(planScheduleDates);
                setScheduleEditing(false);
                setScheduleStatus("");
              }}
              onSave={() => {
                const nextDates = normalizeBasicWorkoutScheduleDates(scheduleDraftDates);
                const workoutCount = planPreview?.workouts?.length || 0;

                if (!hasCompleteBasicWorkoutSchedule(nextDates, workoutCount)) {
                  setScheduleStatus(
                    `Выберите дату для каждой из ${workoutCount || "всех"} тренировок, прежде чем сохранить расписание.`
                  );
                  return;
                }

                setPlanScheduleDates(nextDates);
                setScheduleDraftDates(nextDates);
                setScheduleEditing(false);
                setScheduleStatus("Даты тренировок сохранены.");
              }}
              onDayClick={(day) => {
                setScheduleSelectedDate(day.key);
                if (scheduleEditing && day.isCurrentMonth) toggleScheduleDate(day.key);
              }}
              onOpenHistory={() => {}}
            />
          </section>

          <button className={styles.secondaryButton} type="button" onClick={() => {
            setGeneratedPlan(null);
            setGenerationError("");
            setPlanSaveError("");
            setOwnPlanNotice("");
            setPlanScheduleDates([]);
            setScheduleDraftDates([]);
            setScheduleEditing(false);
            setScheduleStatus("");
            setStepIndex(0);
          }}>
            Изменить ответы
          </button>
        </section>
        <section className={styles.resultActionBar} aria-label="Сохранение плана">
          {planSaveError ? <p className={styles.errorMessage} role="alert">{planSaveError}</p> : null}
          <button className={styles.primaryButton} data-testid="basic-quiz-save-plan" type="button" onClick={saveGeneratedPlan} disabled={isSavingPlan}>
            <Dumbbell aria-hidden="true" /> {isSavingPlan ? "Сохраняем план…" : "Сохранить план и начать"}
          </button>
        </section>
        </>
      ) : isReviewStep ? (
        <section className={styles.reviewCard} data-testid="basic-quiz-review">
          <div className={styles.reviewHeading}>
            <span className={styles.eyebrow}>Проверь ответы</span>
            <h2 ref={questionRef} tabIndex={-1}>Составим твой стартовый план</h2>
            <p>ИИ подготовит программу на 4 недели, которую можно сразу запустить в приложении.</p>
          </div>

          <div className={styles.answerList} ref={reviewAnswersRef}>
            {QUIZ_STEPS.map((step) => (
              <button className={styles.answerRow} data-answer-key={step.key} key={step.key} type="button" onClick={() => editAnswer(QUIZ_STEPS.indexOf(step))}>
                <span>{step.eyebrow}</span>
                <strong>{getReviewAnswer(step, quiz)}</strong>
                {step.key === "restrictions" && quiz.restrictions === "other" ? <small>{quiz.restrictionDetails}</small> : null}
              </button>
            ))}
            {quiz.days === "2" ? (
              <button className={styles.answerRow} data-answer-key="twoDayStructure" type="button" onClick={() => editAnswer(QUIZ_STEPS.length - 1)}>
                <span>Формат нагрузки</span>
                <strong>{getTwoDayStructureLabel(quiz.twoDayStructure)}</strong>
              </button>
            ) : null}
          </div>

          <div className={styles.reviewActions} data-testid="basic-quiz-review-actions">
            {quiz.restrictions !== "none" ? (
              <p className={styles.safetyNote}>При боли, недавней травме или ограничениях врача сначала согласуй нагрузки со специалистом.</p>
            ) : null}
            {generationError ? <p className={styles.errorMessage} role="alert">{generationError}</p> : null}

            <button className={styles.primaryButton} data-testid="basic-quiz-generate" type="button" onClick={generatePlan} disabled={isGenerating || firstIncompleteStep !== -1}>
              <Sparkles aria-hidden="true" /> {isGenerating ? "ИИ составляет план…" : "Составить план с ИИ"}
            </button>
            {generationError ? (
              <button className={styles.secondaryButton} type="button" onClick={createSafeFallbackPlan}>
                Использовать готовый базовый план
              </button>
            ) : null}
            {ownPlanNotice ? <p className={styles.placeholderNotice} role="status">{ownPlanNotice}</p> : null}
            <button className={styles.backButton} type="button" onClick={() => setStepIndex(QUIZ_STEPS.length - 1)} disabled={isGenerating}>
              <ChevronLeft aria-hidden="true" /> Назад к вопросам
            </button>
          </div>
        </section>
      ) : (
        <section className={styles.wizardCard} data-testid="basic-quiz-card">
          <div className={styles.wizardProgress} aria-label={`Шаг ${stepIndex + 1} из ${QUIZ_STEPS.length}`}>
            <span>Шаг {stepIndex + 1} из {QUIZ_STEPS.length}</span>
            <div className={styles.progressTrack}><i style={{ width: `${((stepIndex + 1) / QUIZ_STEPS.length) * 100}%` }} /></div>
          </div>

          <div className={styles.questionBody} data-testid="basic-quiz-question-body">
          <span className={styles.eyebrow}>{currentStep.eyebrow}</span>
          <h2 ref={questionRef} tabIndex={-1}>{currentStep.title}</h2>
          <p>{currentStep.description}</p>

          {currentStep.options?.length ? (
            <div className={styles.optionGrid} role="group" aria-label={currentStep.title}>
              {currentStep.options.map((option) => (
                <button
                  className={styles.optionButton}
                  data-selected={quiz[currentStep.key] === option.value}
                  aria-pressed={quiz[currentStep.key] === option.value}
                  key={option.value}
                  type="button"
                  onClick={() => updateQuiz(currentStep.key, option.value)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                  {quiz[currentStep.key] === option.value ? <Check className={styles.optionCheck} aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          ) : null}

          {currentStep.key === "restrictions" && quiz.restrictions === "other" ? (
            <label className={styles.detailsField}>
              <span>Кратко опиши ограничение (обязательно)</span>
              <textarea
                required
                aria-describedby="basic-quiz-step-hint"
                value={quiz.restrictionDetails}
                maxLength={180}
                onChange={(event) => updateQuiz("restrictionDetails", event.target.value)}
                placeholder="Например: избегаю прыжков по рекомендации врача"
              />
            </label>
          ) : null}

          {currentStep.key === "planPreferences" ? (
            <>
              {quiz.days === "2" ? (
                <section className={styles.twoDayStructure} data-testid="basic-quiz-two-day-structure" aria-labelledby="basic-quiz-two-day-structure-title">
                  <span className={styles.twoDayStructureLabel} id="basic-quiz-two-day-structure-title">Формат двух тренировок</span>
                  <div className={styles.optionGrid} role="group" aria-label="Формат двух тренировок">
                    {TWO_DAY_STRUCTURE_OPTIONS.map((option) => (
                      <button
                        className={styles.optionButton}
                        data-selected={quiz.twoDayStructure === option.value}
                        aria-pressed={quiz.twoDayStructure === option.value}
                        key={option.value}
                        type="button"
                        onClick={() => updateQuiz("twoDayStructure", option.value)}
                      >
                        <strong>{option.label}</strong>
                        <small>{option.hint}</small>
                        {quiz.twoDayStructure === option.value ? <Check className={styles.optionCheck} aria-hidden="true" /> : null}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <label className={styles.detailsField}>
                <span>Твоё пожелание к плану (необязательно)</span>
                <textarea
                  data-testid="basic-quiz-plan-preferences"
                  value={quiz.planPreferences}
                  maxLength={280}
                  onChange={(event) => updateQuiz("planPreferences", event.target.value)}
                  placeholder="Например: хочу больше упражнений на спину и без бега"
                />
              </label>
            </>
          ) : null}

          <p className={styles.stepHint} id="basic-quiz-step-hint" role="status">{stepHint || (currentStep.key === "planPreferences" ? "Пожелание необязательно — можно продолжить без него." : "Ответ выбран. Можно продолжить.")}</p>
          </div>
          <div className={styles.wizardActions}>
            {stepIndex > 0 ? (
              <button className={styles.backButton} type="button" onClick={() => setStepIndex((current) => current - 1)}>
                <ChevronLeft aria-hidden="true" /> Назад
              </button>
            ) : <span />}
            <button className={styles.nextButton} type="button" onClick={nextStep} disabled={Boolean(stepHint)} aria-describedby="basic-quiz-step-hint">
              {editingFromReview ? "Сохранить ответ" : stepIndex === QUIZ_STEPS.length - 1 ? "Проверить ответы" : "Далее"}
            </button>
          </div>
        </section>
      )}

      {generationPhase !== "idle" ? (
        <div className={styles.generationOverlay} role="presentation" data-testid="basic-quiz-generation-modal">
          <section
            className={styles.generationModal}
            role="status"
            aria-live="polite"
            aria-label={generationPhase === "ready" ? "План готов" : "Создание плана"}
          >
            <div className={`${styles.generationIcon} ${generationPhase === "ready" ? styles.generationReadyIcon : ""}`} aria-hidden="true">
              {generationPhase === "ready" ? <Check /> : <Sparkles />}
            </div>
            {generationPhase === "ready" ? (
              <>
                <span className={styles.generationReadyLabel}>Готово</span>
                <h2>Программа составлена</h2>
                <p>Открываем обзор твоего плана.</p>
              </>
            ) : (
              <>
                <span className={styles.eyebrow}>Создаём программу</span>
                <h2>ИИ составляет твой план</h2>
                <div className={styles.generationProgressSummary}>
                  <div>
                    <strong>{generationProgress.percent}%</strong>
                    <span>готово</span>
                  </div>
                  <p><b>{generationProgress.title}</b>{generationProgress.description}</p>
                </div>
                <div
                  className={styles.generationProgressTrack}
                  role="progressbar"
                  aria-label={`Создание плана: ${generationProgress.percent}%`}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={generationProgress.percent}
                >
                  <i style={{ width: `${generationProgress.percent}%` }} />
                </div>
                <ol className={styles.generationSteps}>
                  {GENERATION_PROGRESS_STAGES.map((stage, index) => {
                    const isComplete = index < generationProgress.index;
                    const isActive = index === generationProgress.index;
                    return (
                      <li
                        className={isComplete ? styles.generationStepComplete : isActive ? styles.generationStepActive : ""}
                        key={stage.title}
                      >
                        <i>{isComplete ? <Check aria-hidden="true" /> : isActive ? <span /> : index + 1}</i>
                        <span>{stage.title}</span>
                        <b>{stage.percent}%</b>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </section>
        </div>
      ) : null}

      {renderClientMainBottomBar?.(
        "workouts",
        {
          className: "mainMenuBottomBar profileBottomTabBar workoutModeBottomBar",
          isTrainerMode: canUseTrainerFeatures,
          onGoMain,
          onOpenTraining,
          onOpenNutrition,
          onOpenCabinet,
          onOpenTrainerClients,
          onOpenTrainerPrograms,
          onLoadTrainerCabinet
        }
      )}

    </div>
  );
}
