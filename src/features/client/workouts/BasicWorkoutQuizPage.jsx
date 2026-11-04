import { toWorkoutDateKey } from "../../../utils/workoutSchedule.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Dumbbell, KeyRound, Sparkles } from "lucide-react";

import {
  createBasicWorkoutLongPlanAccessRecord,
  getBasicWorkoutLongPlanAccessStorageKey,
  hasBasicWorkoutLongPlanAccess,
  isBasicWorkoutLongPlanAccessCode
} from "../../../utils/basicWorkoutLongPlanAccess";
import { buildBasicWorkoutPlanFromQuiz } from "../../../utils/basicWorkoutPlanBuilder";
import { getBasicWorkoutQuizDraft, getBasicWorkoutQuizStepHint, resolveQuizWorkoutEmphasis } from "../../../utils/basicWorkoutQuizDraft";
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
import { getBasicWorkoutGenerationNotice } from "../../../utils/basicWorkoutGeneration.js";
import { buildBasicWorkoutClientContext } from "../../../utils/basicWorkoutClientContext.js";
import { QuizPreferences, QuizReviewAnswers } from "./BasicWorkoutQuizControls.jsx";
import BasicWorkoutFormatSwitcher from "./BasicWorkoutFormatSwitcher.jsx";
import styles from "./BasicWorkoutQuizPage.module.css";

const QUIZ_STEPS = [
  {
    key: "goal",
    eyebrow: "Цель",
    title: "Для чего тебе нужен план?",
    description: "Начнём с того, что важно именно тебе.",
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
      { value: "1", label: "1 тренировка", hint: "Один устойчивый день для всего тела" },
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
      { value: "60", label: "Около 60 минут", hint: "До 7 упражнений — в зависимости от формата" },
      { value: "90", label: "Около 90 минут", hint: "6–8 упражнений" }
    ]
  },
  {
    key: "restrictions",
    eyebrow: "Самочувствие",
    title: "Есть ли ограничения?",
    description: "При ограничениях автоматический подбор недоступен — нужен план с тренером.",
    options: [
      { value: "none", label: "Нет ограничений", hint: "Могу выполнять базовые упражнения" },
      { value: "back", label: "Спина", hint: "Нужен подбор с тренером" },
      { value: "knees", label: "Колени", hint: "Нужен подбор с тренером" },
      { value: "shoulders", label: "Плечи", hint: "Нужен подбор с тренером" },
      { value: "other", label: "Другое", hint: "Можно кратко описать ниже" }
    ]
  },
  {
    key: "planPreferences",
    eyebrow: "Пожелания",
    title: "На чём сделать акцент?",
    description: "Выбери фокус. Остальное мы учтём в плане."
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
    description: "Создаём два варианта недели с выбранным акцентом."
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

function getTwoDayStructureLabel(value) {
  return TWO_DAY_STRUCTURE_OPTIONS.find((option) => option.value === value)?.label
    || "Не выбрано";
}

function getPlanScheduleDates(plan = {}) {
  return normalizeBasicWorkoutScheduleDates(
    (Array.isArray(plan?.workouts) ? plan.workouts : []).map((workout) => (
      workout?.scheduledDate || workout?.plannedDate || ""
    ))
  );
}

export default function BasicWorkoutQuizPage(props) {
  return <BasicWorkoutQuizSession key={props.userId || "anonymous"} {...props} />;
}

function BasicWorkoutQuizSession({
  renderClientMainBottomBar,
  basicWorkoutQuiz,
  userId,
  startingWeightProfile,
  workoutHistory,
  profileMeasurements,
  workoutHistoryLoading,
  onLoadWorkoutHistory,
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
    initialScheduleDates[0] || toWorkoutDateKey(new Date())
  ));
  const quizDraft = getBasicWorkoutQuizDraft(basicWorkoutQuiz);
  const clientContext = useMemo(() => buildBasicWorkoutClientContext({ profile: startingWeightProfile,
    measurements: profileMeasurements, history: workoutHistory }), [startingWeightProfile, profileMeasurements, workoutHistory]);
  const quiz = { ...quizDraft, trainingEmphasis: generatedPlan?.trainingEmphasis || resolveQuizWorkoutEmphasis(quizDraft, clientContext.registration) };
  const historyRequested = useRef("");
  useEffect(() => {
    if (userId && onLoadWorkoutHistory && historyRequested.current !== userId) {
      historyRequested.current = userId;
      onLoadWorkoutHistory();
    }
  }, [userId, onLoadWorkoutHistory]);
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
        ...(field === "trainingEmphasis" ? { trainingEmphasisChosen: true } : {}),
        ...(field === "restrictions" && value !== "other" ? { restrictionDetails: "" } : {})
      },
      generatedPlan: undefined
    }));
  }

  async function generatePlan(startedAt) {
    if (firstIncompleteStep !== -1) {
      setStepIndex(firstIncompleteStep);
      return;
    }
    if (isGenerating || workoutHistoryLoading) return;
    setGenerationError("");
    setPlanSaveError("");
    setOwnPlanNotice("");
    setIsGenerating(true);
    setGenerationPhase("creating");
    const updateGenerationProgress = () => {
      setGenerationProgress(getGenerationProgressStage(performance.now() - startedAt));
    };
    updateGenerationProgress();
    const progressTimer = window.setInterval(updateGenerationProgress, 650);

    try {
      const plan = await requestBasicWorkoutAiPlan(quiz, clientContext.registration, clientContext.trainingHistory);
      window.clearInterval(progressTimer);
      setGenerationProgress({ percent: 100, title: "План готов", description: "Открываем обзор программы.", index: GENERATION_PROGRESS_STAGES.length });
      setGenerationPhase("ready");
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const defaultScheduleDates = buildDefaultBasicWorkoutSchedule(plan.workouts?.length, quiz.days);
      setGeneratedPlan(plan);
      setOwnPlanNotice(getBasicWorkoutGenerationNotice(plan) || (plan?.requiresReview
        ? "Вы выбрали ограничение, поэтому мы собрали временный базовый план из проверенных упражнений. Это не медицинская реабилитация: выполняйте только движения без боли и согласуйте нагрузку со специалистом."
        : plan?.generationFallback
          ? "Приложение автоматически собрало надёжный план из проверенных упражнений."
          : ""));
      setPlanScheduleDates(defaultScheduleDates);
      setScheduleDraftDates(defaultScheduleDates);
      setScheduleEditing(false);
      setScheduleStatus("");
      setScheduleMonth(getBasicWorkoutScheduleMonthKey(defaultScheduleDates));
      setScheduleSelectedDate(defaultScheduleDates[0] || toWorkoutDateKey(new Date()));
    } catch (error) {
      if (error?.noLocalFallback) {
        setGenerationError(error.message);
        return;
      }
      console.warn("Basic workout AI request failed; using local fallback plan.", error);
      try {
        await createSafeFallbackPlan(
          "Gemini недоступен. План собран локально по тем же базовым шаблонам и проверкам."
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

  async function createSafeFallbackPlan(notice = "План собран по базовому шаблону без Gemini.") {
    const { buildLocalHybridWorkoutPlan } = await import("../../../../functions/basicWorkoutHybridPlan.js");
    const resolvedFallbackPlan = buildLocalHybridWorkoutPlan({ ...quiz, mode: "plan", ...clientContext });
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
    setScheduleSelectedDate(defaultScheduleDates[0] || toWorkoutDateKey(new Date()));
    setGenerationError("");
    setPlanSaveError("");
    setOwnPlanNotice(getBasicWorkoutGenerationNotice(resolvedFallbackPlan) || notice);
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
    <div className={`${styles.page} ${!isLongPlanUnlocked ? styles.accessPage : ""} ${isReviewStep && !generatedPlan ? styles.reviewPage : ""} ${isLongPlanUnlocked && !isReviewStep && !generatedPlan ? styles.wizardPage : ""} ${generatedPlan && planPreview ? styles.resultPage : ""}`} data-testid="basic-quiz-page" data-css-module-scope="basic-quiz">
      <ClientPageHeader
        compact
        className={styles.topBar}
        title="Программа на месяц"
        titleTestId="basic-quiz-title"
        eyebrow="Базовые тренировки"
        onBack={isLongPlanUnlocked && !generatedPlan && stepIndex > 0 ? () => { setStepIndex(editingFromReview ? QUIZ_STEPS.length : stepIndex - 1); setEditingFromReview(false); } : onBackToWorkouts || onOpenTraining}
        backAriaLabel={isLongPlanUnlocked && !generatedPlan && stepIndex > 0 ? "Назад" : "Вернуться к тренировкам"}
        testId="basic-quiz-header"
        scope="basic-quiz-header"
      />

      <BasicWorkoutFormatSwitcher mode="month" onToday={onOpenToday} />

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
          {generatedPlan.weeklySetDistribution ? (
            <p className={styles.emphasisSummary} data-testid="basic-quiz-emphasis-summary">
              Подходы за первую неделю: ноги и ягодицы — {generatedPlan.weeklySetDistribution.lower}, верх — {generatedPlan.weeklySetDistribution.upper}, кор — {generatedPlan.weeklySetDistribution.core}.
              <small>Считаем по основной зоне упражнения, без повторного учёта косвенной нагрузки.</small>
            </p>
          ) : null}
          {ownPlanNotice ? <p className={styles.placeholderNotice} role="status">{ownPlanNotice}</p> : null}

          <div className={styles.resultStats}>
            <span><b>{planPreview.durationWeeks || 4}</b><small>недели</small></span>
            <span><b>{planPreview.workouts.length}</b><small>тренировок</small></span>
            <span><b>{quiz.duration}</b><small>минут</small></span>
          </div>

          {planPreview.safetyNote ? <p className={styles.safetyNote}>{planPreview.safetyNote}</p> : null}
          {planPreview.startingWeightPolicy !== "manual" ? <p className={styles.progressionNote}>Стартовые веса будут рассчитаны по анкете и уточнятся после первого подхода.</p> : null}
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
            <Dumbbell aria-hidden="true" /> {isSavingPlan ? "Сохраняем план…" : "Сохранить программу"}
          </button>
        </section>
        </>
      ) : isReviewStep ? (
        <section className={styles.reviewCard} data-testid="basic-quiz-review">
          <div className={styles.reviewHeading}>
            <span className={styles.eyebrow}>Проверка ответов</span>
            <h2 ref={questionRef} tabIndex={-1}>Всё верно?</h2>
            <p>Нажми на ответ, если хочешь его изменить.</p>
          </div>

          <div className={styles.answerList} ref={reviewAnswersRef}>
            <QuizReviewAnswers quiz={quiz} steps={QUIZ_STEPS} editAnswer={editAnswer}
              context={clientContext} loading={workoutHistoryLoading} onEditProfile={onOpenCabinet}
              updateQuiz={updateQuiz} structureLabel={getTwoDayStructureLabel(quiz.twoDayStructure)} />
          </div>

          <div className={styles.reviewActions} data-testid="basic-quiz-review-actions">
            {quiz.restrictions !== "none" ? (
              <p className={styles.safetyNote}>При боли, недавней травме или ограничениях врача сначала согласуй нагрузки со специалистом.</p>
            ) : null}
            {generationError ? <p className={styles.errorMessage} role="alert">{generationError}</p> : null}

            <button className={styles.primaryButton} data-testid="basic-quiz-generate" type="button" onClick={() => void generatePlan(performance.now())} disabled={isGenerating || workoutHistoryLoading || firstIncompleteStep !== -1}>
              <Sparkles aria-hidden="true" /> {isGenerating ? "ИИ составляет план…" : "Составить план с ИИ"}
            </button>
            {generationError ? (
              <button className={styles.secondaryButton} type="button" onClick={() => {
                createSafeFallbackPlan().catch((error) => setGenerationError(error.message));
              }}>
                Использовать готовый базовый план
              </button>
            ) : null}
            {ownPlanNotice ? <p className={styles.placeholderNotice} role="status">{ownPlanNotice}</p> : null}
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
                  aria-label={option.label}
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

          {currentStep.key === "planPreferences" ? <QuizPreferences quiz={quiz} updateQuiz={updateQuiz} structureOptions={TWO_DAY_STRUCTURE_OPTIONS} /> : null}

          {stepHint ? <p className={styles.stepHint} id="basic-quiz-step-hint" role="status">{stepHint}</p> : null}
          </div>
          <div className={styles.wizardActions}>
            <button className={styles.nextButton} type="button" onClick={nextStep} disabled={Boolean(stepHint)} aria-describedby={stepHint ? "basic-quiz-step-hint" : undefined}>
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
