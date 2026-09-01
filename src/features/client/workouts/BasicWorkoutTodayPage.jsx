import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Clock3, Dumbbell, MapPin, SlidersHorizontal, Sparkles } from "lucide-react";

import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import {
  BASIC_WORKOUT_TODAY_MAX_TARGETS,
  BASIC_WORKOUT_TODAY_TARGETS,
  buildBasicWorkoutTodayLocalFallback,
  getBasicWorkoutTodayTargets
} from "../../../utils/basicWorkoutTodayFallback";
import {
  BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY,
  consumeBasicWorkoutTodayGeneration,
  getBasicWorkoutTodayGenerationAllowance,
  getBasicWorkoutTodayGenerationStorageKey
} from "../../../utils/basicWorkoutTodayGenerationLimit";
import { safeReadJsonStorage, safeWriteJsonStorage } from "../../../utils/storageSafety";
import { requestBasicWorkoutTodayPlan } from "./basicWorkoutAi";
import styles from "./BasicWorkoutTodayPage.module.css";

const DEFAULT_PREFERENCES = {
  goal: "general_fitness",
  level: "beginner",
  location: "gym",
  duration: "45",
  restrictions: "none",
  restrictionDetails: "",
  planPreferences: "",
  readiness: "normal",
  todayTarget: "",
  todayTargets: []
};

const DURATION_OPTIONS = [
  { value: "30", label: "30 мин" },
  { value: "45", label: "45 мин" },
  { value: "60", label: "60 мин" },
  { value: "90", label: "90 мин" }
];

const READINESS_OPTIONS = [
  { value: "low", label: "Спокойно" },
  { value: "normal", label: "Обычно" },
  { value: "high", label: "Есть силы" }
];

const LEVEL_OPTIONS = [
  { value: "beginner", label: "Новичок" },
  { value: "returning", label: "Возвращаюсь" },
  { value: "experienced", label: "Есть опыт" }
];

const RESTRICTION_OPTIONS = [
  { value: "none", label: "Нет" },
  { value: "back", label: "Спина" },
  { value: "knees", label: "Колени" },
  { value: "shoulders", label: "Плечи" },
  { value: "other", label: "Другое" }
];

function getExerciseSetCount(exercises = []) {
  return (Array.isArray(exercises) ? exercises : []).reduce((total, exercise) => (
    total + (Array.isArray(exercise?.sets) ? exercise.sets.length : 0)
  ), 0);
}

function getInitialPreferences(basicWorkoutQuiz = {}) {
  const requestedTargets = Array.isArray(basicWorkoutQuiz.todayTargets) && basicWorkoutQuiz.todayTargets.length
    ? basicWorkoutQuiz.todayTargets
    : [basicWorkoutQuiz.todayTarget];
  const todayTargets = getBasicWorkoutTodayTargets(requestedTargets).map((target) => target.id);

  return {
    ...DEFAULT_PREFERENCES,
    ...basicWorkoutQuiz,
    todayTarget: todayTargets[0] || "",
    todayTargets
  };
}

export default function BasicWorkoutTodayPage({
  renderClientMainBottomBar,
  basicWorkoutQuiz,
  startingWeightProfile,
  onBasicWorkoutQuizChange,
  onApplyBasicWorkoutPlan,
  onOpenLongPlan,
  onOpenTraining,
  onGoBackToMode,
  userId,
  canUseTrainerFeatures,
  onGoMain,
  onOpenNutrition,
  onOpenCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  const [preferences, setPreferences] = useState(() => getInitialPreferences(basicWorkoutQuiz));
  const [generatedPlan, setGeneratedPlan] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [selectionNotice, setSelectionNotice] = useState("");
  const generationStorageKey = getBasicWorkoutTodayGenerationStorageKey(userId);
  const [generationRecord, setGenerationRecord] = useState(() => (
    safeReadJsonStorage(generationStorageKey, null)
  ));
  const selectedTargets = getBasicWorkoutTodayTargets(preferences.todayTargets);
  const selectedTargetIds = selectedTargets.map((target) => target.id);
  const selectedTargetLabel = selectedTargets.map((target) => target.label).join(" + ");
  const generatedWorkout = generatedPlan?.workouts?.[0] || null;
  const totalSets = useMemo(
    () => getExerciseSetCount(generatedWorkout?.exercises),
    [generatedWorkout?.exercises]
  );
  const generationAllowance = getBasicWorkoutTodayGenerationAllowance(generationRecord);
  const generationLimitMessage = generationAllowance.isLimitReached
    ? `Лимит подборок на сегодня исчерпан. Завтра снова будет ${BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY}.`
    : `Подборок на сегодня осталось: ${generationAllowance.remaining} из ${BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY}.`;

  useEffect(() => {
    setGenerationRecord(safeReadJsonStorage(generationStorageKey, null));
  }, [generationStorageKey]);

  function updatePreference(field, value) {
    const next = { ...preferences, [field]: value };
    setPreferences(next);
    setGeneratedPlan(null);
    setStatus("");
    setError("");
    setSelectionNotice("");
    onBasicWorkoutQuizChange((previous) => ({
      ...previous,
      [field]: value,
      generatedPlan: undefined
    }));
  }

  function updateTargets(nextTargetIds) {
    const nextTargets = getBasicWorkoutTodayTargets(nextTargetIds).map((target) => target.id);
    const next = {
      ...preferences,
      todayTarget: nextTargets[0] || "",
      todayTargets: nextTargets
    };

    setPreferences(next);
    setGeneratedPlan(null);
    setStatus("");
    setError("");
    setSelectionNotice("");
    onBasicWorkoutQuizChange((previous) => ({
      ...previous,
      todayTarget: next.todayTarget,
      todayTargets: next.todayTargets,
      generatedPlan: undefined
    }));
  }

  function toggleTarget(targetId) {
    const isFullBody = targetId === "full_body";
    const hasTarget = selectedTargetIds.includes(targetId);

    if (isFullBody) {
      updateTargets(hasTarget ? [] : ["full_body"]);
      return;
    }

    const withoutFullBody = selectedTargetIds.filter((id) => id !== "full_body");
    if (hasTarget) {
      updateTargets(withoutFullBody.filter((id) => id !== targetId));
      return;
    }
    if (withoutFullBody.length >= BASIC_WORKOUT_TODAY_MAX_TARGETS) {
      setSelectionNotice(`Можно выбрать до ${BASIC_WORKOUT_TODAY_MAX_TARGETS} зон за одну тренировку.`);
      return;
    }
    updateTargets([...withoutFullBody, targetId]);
  }

  function resetGeneratedWorkout() {
    setGeneratedPlan(null);
    setStatus("");
    setError("");
  }

  function handleBack() {
    if (generatedWorkout) {
      resetGeneratedWorkout();
      return;
    }
    onGoBackToMode?.();
  }

  function reserveGeneration() {
    const next = consumeBasicWorkoutTodayGeneration(generationRecord);
    if (!next.consumed) {
      setError(`На сегодня доступно только ${BASIC_WORKOUT_TODAY_MAX_GENERATIONS_PER_DAY} подборки. Новые варианты появятся завтра.`);
      return false;
    }

    setGenerationRecord(next.nextRecord);
    safeWriteJsonStorage(generationStorageKey, next.nextRecord);
    return true;
  }

  async function generateWorkout() {
    if (!selectedTargetIds.length || isGenerating) return;
    if (!reserveGeneration()) return;

    setIsGenerating(true);
    setStatus("");
    setError("");
    try {
      const plan = await requestBasicWorkoutTodayPlan(preferences, startingWeightProfile);
      setGeneratedPlan(plan);
      setStatus(
        plan?.generationFallback
          ? "Собрали надёжную тренировку из проверенной базы — её можно начать сразу."
          : "Тренировка готова. Проверь упражнения и начинай, когда будешь готов."
      );
    } catch (requestError) {
      console.warn("Today basic workout AI request failed; using local fallback.", requestError);
      try {
        const localPlan = buildBasicWorkoutTodayLocalFallback(preferences);
        setGeneratedPlan(localPlan);
        setStatus("Нет устойчивого соединения, поэтому собрали тренировку из локальной проверенной базы.");
      } catch (fallbackError) {
        console.error("Today basic workout local fallback failed:", fallbackError);
        setError(requestError?.message || "Не удалось подобрать тренировку. Попробуйте ещё раз.");
      }
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveAndStartWorkout() {
    if (!generatedPlan || isSaving) return;

    setIsSaving(true);
    setError("");
    const nextQuiz = {
      ...preferences,
      days: "1",
      generatedPlan
    };
    onBasicWorkoutQuizChange((previous) => ({ ...previous, ...nextQuiz }));

    try {
      const result = await onApplyBasicWorkoutPlan(nextQuiz);
      if (result?.cloudSaved === false) {
        setError(
          result.offline
            ? "Нет подключения к интернету. Тренировка осталась в черновике — подключитесь и повторите запуск."
            : "Не удалось сохранить тренировку в облаке. Попробуйте ещё раз."
        );
      }
    } catch (saveError) {
      console.error("Today basic workout save failed:", saveError);
      setError("Не удалось сохранить тренировку в облаке. Попробуйте ещё раз.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.page} data-testid="basic-workout-today-page" data-css-module-scope="basic-workout-today">
      <ClientPageHeader
        compact
        title="Тренировка на сегодня"
        eyebrow="Базовые тренировки"
        onBack={handleBack}
        backAriaLabel="Вернуться к тренировкам"
        className={styles.topBar}
        testId="basic-workout-today-header"
        scope="basic-workout-today-header"
      />

      {!generatedWorkout ? (
        <main className={styles.content}>
          <section className={styles.intro}>
            <span className={styles.eyebrow}>Выбери зоны</span>
            <h2>Что тренируем сегодня?</h2>
            <p>Выбери до трёх зон или Full body. ИИ подберёт упражнения под место, время и твоё состояние.</p>
          </section>

          <section className={styles.targetGrid} aria-label="Выбор зон тренировки" aria-describedby="basic-workout-target-help">
            {BASIC_WORKOUT_TODAY_TARGETS.map((target) => {
              const isSelected = selectedTargetIds.includes(target.id);
              return (
                <button
                  className={styles.targetCard}
                  data-selected={isSelected}
                  data-full-body={target.id === "full_body"}
                  key={target.id}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${target.label}. ${isSelected ? "Выбрано" : "Не выбрано"}.`}
                  onClick={() => toggleTarget(target.id)}
                >
                  <span className={styles.targetImage} aria-hidden="true">
                    <img src={target.image} alt="" loading="lazy" />
                  </span>
                  <span className={styles.targetCopy}>
                    <strong>{target.label}</strong>
                    <small>{target.description}</small>
                  </span>
                  {isSelected ? <span className={styles.selectedIcon}><Check aria-hidden="true" /></span> : null}
                </button>
              );
            })}
          </section>

          <section className={styles.settingsCard} aria-label="Параметры тренировки">
            <div className={styles.settingGroup}>
              <span><Clock3 aria-hidden="true" /> Сколько времени есть?</span>
              <div className={styles.chipRow}>
                {DURATION_OPTIONS.map((option) => (
                  <button
                    data-selected={preferences.duration === option.value}
                    key={option.value}
                    type="button"
                    aria-pressed={preferences.duration === option.value}
                    onClick={() => updatePreference("duration", option.value)}
                  >{option.label}</button>
                ))}
              </div>
            </div>
            <div className={styles.settingGroup}>
              <span><Sparkles aria-hidden="true" /> Как самочувствие?</span>
              <div className={styles.chipRow}>
                {READINESS_OPTIONS.map((option) => (
                  <button
                    data-selected={preferences.readiness === option.value}
                    key={option.value}
                    type="button"
                    aria-pressed={preferences.readiness === option.value}
                    onClick={() => updatePreference("readiness", option.value)}
                  >{option.label}</button>
                ))}
              </div>
            </div>
            <div className={styles.locationRow}>
              <span><MapPin aria-hidden="true" /> Где тренируешься?</span>
              <div className={styles.segmentedControl}>
                <button data-selected={preferences.location === "gym"} type="button" onClick={() => updatePreference("location", "gym")}>Зал</button>
                <button data-selected={preferences.location === "home"} type="button" onClick={() => updatePreference("location", "home")}>Дома</button>
              </div>
            </div>
          </section>

          <details className={styles.advancedSettings}>
            <summary><SlidersHorizontal aria-hidden="true" /> Настроить под себя</summary>
            <div className={styles.advancedFields}>
              <label>
                <span>Опыт</span>
                <select value={preferences.level} onChange={(event) => updatePreference("level", event.target.value)}>
                  {LEVEL_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span>Ограничения</span>
                <select value={preferences.restrictions} onChange={(event) => updatePreference("restrictions", event.target.value)}>
                  {RESTRICTION_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                </select>
              </label>
              {preferences.restrictions === "other" ? (
                <label className={styles.noteField}>
                  <span>Что важно учесть</span>
                  <textarea
                    value={preferences.restrictionDetails}
                    maxLength={180}
                    onChange={(event) => updatePreference("restrictionDetails", event.target.value)}
                    placeholder="Например: избегаю прыжков"
                  />
                </label>
              ) : null}
            </div>
          </details>

          <p id="basic-workout-target-help" className={styles.targetHelp} role="status">
            {selectionNotice || (selectedTargets.length
              ? `Выбрано: ${selectedTargetLabel}.`
              : `Можно выбрать от одной до ${BASIC_WORKOUT_TODAY_MAX_TARGETS} зон.`)}
          </p>
          <p
            className={styles.generationLimit}
            data-limit-reached={generationAllowance.isLimitReached}
            role="status"
          >
            {generationLimitMessage}
          </p>
          {selectedTargets.length ? (
            <aside className={styles.selectionHint} role="status">
              <strong>{selectedTargetLabel}</strong>
              <span>{selectedTargets[0]?.id === "full_body"
                ? "Сбалансированная тренировка на всё тело."
                : "ИИ включит движение для каждой выбранной зоны, если оно безопасно в текущих условиях."}</span>
            </aside>
          ) : null}
          {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
          <button
            className={styles.primaryButton}
            data-testid="basic-workout-today-generate"
            disabled={!selectedTargetIds.length || isGenerating || generationAllowance.isLimitReached}
            type="button"
            onClick={generateWorkout}
          >
            <Sparkles aria-hidden="true" /> {isGenerating ? "Составляем тренировку…" : "Составить тренировку"}
          </button>
          <button className={styles.longPlanLink} type="button" onClick={onOpenLongPlan}>
            Нужна программа на 4 недели <ChevronRight aria-hidden="true" />
          </button>
        </main>
      ) : (
        <main className={styles.resultContent}>
          <section className={styles.resultCard}>
            <div className={styles.resultHeading}>
              <span className={styles.resultIcon}><Dumbbell aria-hidden="true" /></span>
              <div>
                <span className={styles.eyebrow}>Тренировка готова</span>
                <h2>{generatedWorkout.name || selectedTargetLabel || "Тренировка"}</h2>
                <p>{generatedPlan.description}</p>
              </div>
            </div>
            <div className={styles.summaryStats} aria-label="Параметры тренировки">
              <span><strong>{generatedWorkout.exercises?.length || 0}</strong><small>упражнений</small></span>
              <span><strong>{totalSets}</strong><small>подходов</small></span>
              <span><strong>{preferences.duration}</strong><small>минут</small></span>
            </div>
            {status ? <p className={styles.statusMessage} role="status">{status}</p> : null}
            {generatedPlan.safetyNote ? <p className={styles.safetyNote}>{generatedPlan.safetyNote}</p> : null}
            <ol className={styles.exerciseList}>
              {(generatedWorkout.exercises || []).map((exercise, index) => (
                <li key={exercise.id || `${exercise.name}-${index}`}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{exercise.name}</strong>
                    <small>{exercise.sets?.length || 0} подхода · отдых {exercise.rest || "60 сек"}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
          <button className={styles.primaryButton} type="button" disabled={isSaving} onClick={saveAndStartWorkout}>
            <Dumbbell aria-hidden="true" /> {isSaving ? "Сохраняем…" : "Сохранить и начать"}
          </button>
          <p
            className={styles.generationLimit}
            data-limit-reached={generationAllowance.isLimitReached}
            role="status"
          >
            {generationLimitMessage}
          </p>
          <button className={styles.secondaryButton} type="button" onClick={resetGeneratedWorkout}>
            {generationAllowance.isLimitReached ? "Вернуться к настройке" : "Подобрать другой вариант"}
          </button>
        </main>
      )}

      {isGenerating ? (
        <div className={styles.loadingOverlay} role="presentation">
          <section className={styles.loadingCard} role="status" aria-live="polite">
            <span><Sparkles aria-hidden="true" /></span>
            <h2>Собираем тренировку</h2>
            <p>Учитываем выбранную зону, время, место и самочувствие.</p>
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
