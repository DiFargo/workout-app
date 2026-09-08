import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Dumbbell, Settings } from "lucide-react";
import {
  getProgramHistoryItems,
  getWorkoutCover,
  getWorkoutPresentation,
  WORKOUT_MENU_ITEMS
} from "../../../domain/workoutPresentation";
import { sortWorkoutDays } from "../../../utils/workoutPlanNormalization";
import { getBasicWorkoutExpectedWorkoutCount } from "../../../utils/basicWorkoutPlanBuilder";
import { getWorkoutScheduleCalendarForWorkouts, toWorkoutDateKey } from "../../../utils/workoutSchedule";
import {
  buildCompletedWorkoutSet,
  getCurrentAssignmentHistoryItems,
  getNextUncompletedWorkoutIndex,
  getWorkoutAssignmentVersion,
  isWorkoutCompletedWithSet
} from "../../../utils/workoutCompletion";
import { safeReadJsonStorage } from "../../../utils/storageSafety";
import { getWorkoutDraftKey } from "../../../utils/workoutDraftStorage";
import { canResumeWorkoutDraft } from "../../../utils/workoutDraftState";
import { WorkoutDraftRestoreDialog } from "../../../components/workout/WorkoutDialogs";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import { IndividualWorkoutHistoryDialog, WorkoutPlanDialog, WorkoutProgramDialog } from "./WorkoutListDialogs";
import WorkoutRenderOverview from "./WorkoutRenderOverview";
import styles from "./WorkoutListPage.module.css";
import adaptiveShellStyles from "../../../shared/ui/ClientAdaptiveShell.module.css";

const versionedLocalAsset = (src, version) => {
  if (typeof src !== "string" || !src.startsWith("/")) return src;
  return `${src}${src.includes("?") ? "&" : "?"}v=${encodeURIComponent(version || "")}`;
};

function getScheduledWorkoutDate(workout, index, calendar = {}) {
  const plannedWorkouts = Array.isArray(calendar.plannedWorkouts) ? calendar.plannedWorkouts : [];
  const workoutId = String(workout?.id || "").trim();
  const plannedWorkout = plannedWorkouts.find((item) => (
    String(item?.workoutId || "").trim() === workoutId ||
    Number(item?.order) === index + 1 ||
    Number(item?.index) === index
  ));
  const scheduledDates = [
    ...(Array.isArray(calendar.scheduledDates) ? calendar.scheduledDates : []),
    ...(Array.isArray(calendar.monthlyTrainingDates) ? calendar.monthlyTrainingDates : [])
  ].map(toWorkoutDateKey).filter(Boolean).sort();

  return toWorkoutDateKey(
    plannedWorkout?.movedToDate ||
    workout?.movedToDate ||
    plannedWorkout?.date ||
    workout?.scheduledDate ||
    workout?.plannedDate ||
    scheduledDates[index]
  );
}

function getExercisePlanDetail(exercise = {}) {
  const sets = Array.isArray(exercise.sets)
    ? exercise.sets.length
    : Number(exercise.sets || exercise.approaches) || 0;
  const firstSet = Array.isArray(exercise.sets) ? exercise.sets[0] : null;
  const repetitions = firstSet?.reps || firstSet?.repetitions || exercise.reps || exercise.repetitions || "";
  const parts = [];
  if (sets) parts.push(`${sets} подх.`);
  if (repetitions) parts.push(`${repetitions} повт.`);
  return parts.join(" · ") || "Параметры уточнит тренер";
}

export default function WorkoutListPage({
  appVersion,
  renderClientMainBottomBar,
  plan,
  history,
  workoutCalendar = {},
  currentUserId,
  workoutModePreference,
  individualWorkoutIndex,
  individualWorkoutIndexInitialized,
  setIndividualWorkoutIndex,
  setIndividualWorkoutIndexInitialized,
  workoutHistoryModalOpen,
  setWorkoutHistoryModalOpen,
  workoutDraftRestorePrompt,
  workoutReadinessOpen,
  postWorkoutFeedbackOpen,
  fullscreenVideo,
  showFirstSetupOnboarding,
  historyLoading,
  isTrainerMode,
  onGoMain,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  loadHistory,
  openWorkout,
  onOpenBasicMode,
  onOpenBasicSettings,
  onOpenBasicToday,
  onRescheduleWorkout,
  handleWorkoutDraftChoice
}) {
  const [swipeMotion, setSwipeMotion] = useState({ offset: 0, phase: "idle" });
  const [workoutPlanModalOpen, setWorkoutPlanModalOpen] = useState(false);
  const [workoutProgramModalOpen, setWorkoutProgramModalOpen] = useState(false);
  const basicQuizRedirectedRef = useRef(false);
  const swipeStartRef = useRef(null);
  const swipeSuppressClickRef = useRef(false);
  const swipeTimerRef = useRef(null);
  const swipeFrameRef = useRef(null);

  const isIndividualWorkoutMode = workoutModePreference.mode === "individual";
  const isBasicWorkoutMode = workoutModePreference.mode === "basic";
  const shouldOpenBasicQuiz = isBasicWorkoutMode && plan.source !== "basic";
  const planWorkouts = isBasicWorkoutMode && plan.source !== "basic" ? [] : plan.workouts || [];
  const sortedWorkouts = sortWorkoutDays(planWorkouts);
  const scopedWorkoutCalendar = getWorkoutScheduleCalendarForWorkouts(workoutCalendar, sortedWorkouts);
  const assignmentVersion = getWorkoutAssignmentVersion(plan);
  const completionHistory = history;
  const completedWorkoutSet = buildCompletedWorkoutSet(
    completionHistory,
    assignmentVersion,
    isBasicWorkoutMode ? {} : workoutCalendar,
    sortedWorkouts
  );
  const isDeckWorkoutMode = isIndividualWorkoutMode || isBasicWorkoutMode;
  const nextUncompletedWorkoutIndex = isDeckWorkoutMode
    ? getNextUncompletedWorkoutIndex(sortedWorkouts, completedWorkoutSet, assignmentVersion)
    : 0;
  const activeWorkoutIndex = isDeckWorkoutMode
    ? Math.min(
        Math.max(
          individualWorkoutIndexInitialized
            ? (Number.isFinite(Number(individualWorkoutIndex)) ? Number(individualWorkoutIndex) : nextUncompletedWorkoutIndex)
            : nextUncompletedWorkoutIndex,
          0
        ),
        Math.max(sortedWorkouts.length - 1, 0)
      )
    : 0;
  const activeIndividualWorkout = sortedWorkouts[activeWorkoutIndex];
  const workoutScheduleDates = sortedWorkouts
    .map((workoutItem, workoutIndex) => getScheduledWorkoutDate(workoutItem, workoutIndex, scopedWorkoutCalendar))
    .filter(Boolean);
  const workoutProgramName = String(
    plan?.assignedProgramName ||
    plan?.basicPlanName ||
    plan?.name ||
    plan?.title ||
    activeIndividualWorkout?.assignedProgramName ||
    "Программа тренировок"
  ).trim();
  const isWorkoutCompleted = (workoutItem) => (
    isWorkoutCompletedWithSet(workoutItem, completedWorkoutSet, assignmentVersion)
  );
  const completedWorkoutCount = sortedWorkouts.filter(isWorkoutCompleted).length;
  const workoutPlanItems = sortedWorkouts.map((workoutItem, workoutIndex) => ({
    id: workoutItem?.id || `workout-${workoutIndex}`,
    index: workoutIndex,
    name: workoutItem?.name || `Тренировка ${workoutIndex + 1}`,
    exerciseCount: Array.isArray(workoutItem?.exercises) ? workoutItem.exercises.length : 0,
    exercises: (Array.isArray(workoutItem?.exercises) ? workoutItem.exercises : []).map((exercise, exerciseIndex) => ({
      name: exercise?.name || `Упражнение ${exerciseIndex + 1}`,
      detail: getExercisePlanDetail(exercise)
    })),
    date: getScheduledWorkoutDate(workoutItem, workoutIndex, scopedWorkoutCalendar),
    completed: isWorkoutCompleted(workoutItem),
    active: workoutIndex === activeWorkoutIndex
  }));
  const expectedBasicWorkoutCount = isBasicWorkoutMode
    ? getBasicWorkoutExpectedWorkoutCount(plan)
    : 0;
  const hasPartialBasicPlanSnapshot = Boolean(
    expectedBasicWorkoutCount > 0 &&
    sortedWorkouts.length < expectedBasicWorkoutCount
  );
  const completedWorkoutProgressPercent = sortedWorkouts.length > 0
    ? Math.min(100, Math.max(0, Math.round((completedWorkoutCount / sortedWorkouts.length) * 100)))
    : 0;
  const isCurrentPlanCompleted = Boolean(
    isDeckWorkoutMode &&
    sortedWorkouts.length > 0 &&
    completedWorkoutCount === sortedWorkouts.length &&
    !hasPartialBasicPlanSnapshot
  );
  const hasLocalOnlyPlanSave = plan?.cloudSyncState === "local_only";
  const todayKey = toWorkoutDateKey(new Date());
  const currentAssignmentHistoryItems = getCurrentAssignmentHistoryItems(history, assignmentVersion, sortedWorkouts);
  const getWorkoutDraft = (workoutItem) => currentUserId && workoutItem?.id
    ? safeReadJsonStorage(getWorkoutDraftKey(currentUserId, workoutItem.id), null)
    : null;
  const draftWorkoutIndex = sortedWorkouts.findIndex((workoutItem) => {
    const draft = getWorkoutDraft(workoutItem);
    return canResumeWorkoutDraft(draft, workoutItem, assignmentVersion, isWorkoutCompleted(workoutItem));
  });
  const incompleteWorkoutIndexes = sortedWorkouts
    .map((workoutItem, workoutIndex) => ({ workoutItem, workoutIndex, date: getScheduledWorkoutDate(workoutItem, workoutIndex, scopedWorkoutCalendar) }))
    .filter(({ workoutItem }) => !isWorkoutCompleted(workoutItem));
  const todayWorkoutIndex = incompleteWorkoutIndexes.find(({ date }) => date === todayKey)?.workoutIndex ?? -1;
  const missedWorkoutIndexes = incompleteWorkoutIndexes.filter(({ date }) => date && date < todayKey);
  const nextFutureWorkoutIndex = incompleteWorkoutIndexes.find(({ date }) => date && date > todayKey)?.workoutIndex ?? -1;
  const unscheduledWorkoutIndex = incompleteWorkoutIndexes.find(({ date }) => !date)?.workoutIndex ?? -1;
  const overviewWorkoutIndex = draftWorkoutIndex >= 0
    ? draftWorkoutIndex
    : todayWorkoutIndex >= 0
      ? todayWorkoutIndex
      : missedWorkoutIndexes[0]?.workoutIndex ?? (
          individualWorkoutIndexInitialized && unscheduledWorkoutIndex >= 0
            ? activeWorkoutIndex
            : nextFutureWorkoutIndex >= 0
              ? nextFutureWorkoutIndex
              : unscheduledWorkoutIndex >= 0
                ? unscheduledWorkoutIndex
                : activeWorkoutIndex
        );
  const overviewWorkout = sortedWorkouts[overviewWorkoutIndex];
  const overviewWorkoutDate = getScheduledWorkoutDate(overviewWorkout, overviewWorkoutIndex, scopedWorkoutCalendar);
  const shouldShiftBasicWorkoutToToday = Boolean(
    isBasicWorkoutMode &&
    overviewWorkoutDate &&
    overviewWorkoutDate < todayKey &&
    !isWorkoutCompleted(overviewWorkout)
  );
  const displayedOverviewWorkoutDate = shouldShiftBasicWorkoutToToday ? todayKey : overviewWorkoutDate;
  const displayedWorkoutScheduleDates = shouldShiftBasicWorkoutToToday
    ? [...new Set([todayKey, ...workoutScheduleDates.filter((dateKey) => dateKey >= todayKey)])].sort()
    : workoutScheduleDates;
  const activeIndividualWorkoutCompleted = isWorkoutCompleted(overviewWorkout);
  const activeWorkoutDraft = getWorkoutDraft(overviewWorkout);

  useEffect(() => {
    if (!shouldOpenBasicQuiz) {
      basicQuizRedirectedRef.current = false;
      return;
    }
    if (basicQuizRedirectedRef.current) return;
    basicQuizRedirectedRef.current = true;
    onOpenBasicMode();
  }, [onOpenBasicMode, shouldOpenBasicQuiz]);

  useEffect(() => () => {
    window.clearTimeout(swipeTimerRef.current);
    window.cancelAnimationFrame(swipeFrameRef.current);
  }, []);
  const hasActiveWorkoutDraft = canResumeWorkoutDraft(
    activeWorkoutDraft, overviewWorkout, assignmentVersion, activeIndividualWorkoutCompleted
  );
  const activeWorkoutActionLabel = isWorkoutCompleted(activeIndividualWorkout)
    ? "Посмотреть результат"
    : activeWorkoutDraft?.workoutId === activeIndividualWorkout?.id
      ? "Продолжить тренировку"
      : "Начать тренировку";
  const individualWorkoutHistoryItems = getProgramHistoryItems(currentAssignmentHistoryItems).slice(0, 12);
  const todayCardState = hasActiveWorkoutDraft
    ? "draft"
    : isCurrentPlanCompleted
      ? "program-complete"
      : shouldShiftBasicWorkoutToToday
        ? "shifted"
        : overviewWorkoutDate === todayKey
          ? "today"
          : overviewWorkoutDate && overviewWorkoutDate < todayKey
            ? "missed"
            : overviewWorkoutDate && overviewWorkoutDate > todayKey
              ? "recovery"
              : "unscheduled";
  const activeWorkoutPendingSync = history.some((item) => (
    item?.pendingSync &&
    item?.workoutId === activeIndividualWorkout?.id &&
    (
      !plan.assignedProgramUpdatedAt ||
      item?.assignedProgramUpdatedAt === plan.assignedProgramUpdatedAt
    )
  ));

  function openWorkoutByIndex(index) {
    const nextWorkout = sortedWorkouts[index];

    if (nextWorkout) {
      if (isWorkoutCompleted(nextWorkout)) {
        loadHistory();
        setWorkoutHistoryModalOpen(true);
        return;
      }
      openWorkout(nextWorkout.id);
    }
  }

  function selectWorkoutFromPlan(index) {
    setIndividualWorkoutIndex(index);
    setIndividualWorkoutIndexInitialized(true);
    setWorkoutPlanModalOpen(false);
  }

  function moveIndividualWorkout(direction) {
    if (!sortedWorkouts.length) return;

    const currentIndex = Math.max(0, activeWorkoutIndex);
    const nextIndex =
      direction === "previous"
        ? (currentIndex - 1 + sortedWorkouts.length) % sortedWorkouts.length
        : (currentIndex + 1) % sortedWorkouts.length;

    setIndividualWorkoutIndex(nextIndex);
    setIndividualWorkoutIndexInitialized(true);
  }

  function settleIndividualWorkoutSwipe() {
    setSwipeMotion((current) => ({ ...current, offset: 0, phase: "settling" }));
    window.clearTimeout(swipeTimerRef.current);
    swipeTimerRef.current = window.setTimeout(() => {
      setSwipeMotion({ offset: 0, phase: "idle" });
    }, 420);
  }

  function animateIndividualWorkout(direction) {
    if (!sortedWorkouts.length || swipeMotion.phase === "exiting") return;

    const exitsLeft = direction === "next";
    swipeSuppressClickRef.current = true;
    setSwipeMotion({ offset: exitsLeft ? -430 : 430, phase: "exiting" });
    window.clearTimeout(swipeTimerRef.current);
    swipeTimerRef.current = window.setTimeout(() => {
      moveIndividualWorkout(direction);
      setSwipeMotion({ offset: exitsLeft ? 82 : -82, phase: "entering" });
      window.cancelAnimationFrame(swipeFrameRef.current);
      swipeFrameRef.current = window.requestAnimationFrame(() => {
        swipeFrameRef.current = window.requestAnimationFrame(() => {
          settleIndividualWorkoutSwipe();
        });
      });
      window.setTimeout(() => {
        swipeSuppressClickRef.current = false;
      }, 260);
    }, 190);
  }

  function handleIndividualWorkoutSwipeStart(event) {
    if (
      sortedWorkouts.length < 2 ||
      swipeMotion.phase === "exiting" ||
      event.target.closest("button")
    ) return;

    swipeStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      axis: ""
    };
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic and already-ended pointers can reach this handler in WebKit.
    }
    setSwipeMotion({ offset: 0, phase: "dragging" });
  }

  function handleIndividualWorkoutSwipeMove(event) {
    const start = swipeStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (!start.axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 7) {
      start.axis = Math.abs(deltaX) > Math.abs(deltaY) * 1.15 ? "x" : "y";
    }

    if (start.axis === "y") {
      swipeStartRef.current = null;
      settleIndividualWorkoutSwipe();
      return;
    }

    if (start.axis !== "x") return;
    event.preventDefault();
    const resistedOffset = Math.sign(deltaX) * Math.min(138, Math.abs(deltaX) * 0.82);
    setSwipeMotion({ offset: resistedOffset, phase: "dragging" });
  }

  function handleIndividualWorkoutSwipeEnd(event) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) {
      settleIndividualWorkoutSwipe();
      return;
    }

    animateIndividualWorkout(deltaX < 0 ? "next" : "previous");
  }

  if (shouldOpenBasicQuiz) {
    return null;
  }

  if (isDeckWorkoutMode && overviewWorkout) {
    return <>
      <WorkoutRenderOverview
        workout={overviewWorkout}
        workoutDate={displayedOverviewWorkoutDate}
        scheduledDates={displayedWorkoutScheduleDates}
        programName={workoutProgramName}
        programType={isBasicWorkoutMode ? "basic" : "individual"}
        index={overviewWorkoutIndex}
        total={sortedWorkouts.length}
        completedCount={completedWorkoutCount}
        todayState={todayCardState}
        missedCount={isBasicWorkoutMode ? 0 : missedWorkoutIndexes.length}
        isTrainerMode={isTrainerMode}
        renderBottomBar={renderClientMainBottomBar}
        onOpen={() => openWorkoutByIndex(overviewWorkoutIndex)}
        onViewResult={() => { loadHistory(); setWorkoutHistoryModalOpen(true); }}
        onReschedule={(dateKey) => onRescheduleWorkout?.({
          workoutId: overviewWorkout?.id,
          workoutIndex: overviewWorkoutIndex,
          dateKey
        })}
        onHistory={() => { loadHistory(); setWorkoutHistoryModalOpen(true); }}
        onPlan={() => setWorkoutPlanModalOpen(true)}
        onProgram={() => setWorkoutProgramModalOpen(true)}
        onCreateBasicWorkout={onOpenBasicToday}
        navigation={{ onGoMain, onOpenTraining, onOpenNutrition, onOpenCabinet, onOpenTrainerClients, onOpenTrainerPrograms, onLoadTrainerCabinet:onOpenCabinet }}
      />
      <WorkoutPlanDialog
        open={workoutPlanModalOpen}
        programName={workoutProgramName}
        completedCount={completedWorkoutCount}
        workouts={workoutPlanItems}
        onClose={() => setWorkoutPlanModalOpen(false)}
        onSelectWorkout={selectWorkoutFromPlan}
      />
      <WorkoutProgramDialog
        open={workoutProgramModalOpen}
        programName={workoutProgramName}
        completedCount={completedWorkoutCount}
        workouts={workoutPlanItems}
        onClose={() => setWorkoutProgramModalOpen(false)}
      />
      <IndividualWorkoutHistoryDialog open={Boolean(workoutHistoryModalOpen)} historyLoading={historyLoading} historyItems={individualWorkoutHistoryItems} onClose={() => setWorkoutHistoryModalOpen(false)} />
      <WorkoutDraftRestoreDialog open={Boolean(workoutDraftRestorePrompt)} blocked={Boolean(workoutReadinessOpen || postWorkoutFeedbackOpen || fullscreenVideo || showFirstSetupOnboarding)} onRestart={() => handleWorkoutDraftChoice(false)} onRestore={() => handleWorkoutDraftChoice(true)} />
    </>;
  }

  return (
    <div
      className={`${styles.page} ${isIndividualWorkoutMode ? styles.individualMode : styles.basicMode} ${isDeckWorkoutMode ? styles.deckMode : ""} ${adaptiveShellStyles.shell}`}
      data-client-adaptive-shell="true"
      data-css-module-scope="workout-list"
    >
      <ClientPageHeader
        className={styles.hero}
        frameClassName={styles.headerFrame}
        title="Тренировки"
        titleAlign="start"
        primary
        titleTestId="workout-list-title"
        testId="workout-list-header"
        scope="workout-list-header"
        actions={isBasicWorkoutMode ? (
          <div className={styles.headerActions}>
          {!isIndividualWorkoutMode && isBasicWorkoutMode && (
            <button
              type="button"
              className={`${styles.headerButton} ${styles.settingsButton}`}
              aria-label="Изменить базовый план"
              onClick={onOpenBasicSettings}
            >
              <Settings aria-hidden="true" />
            </button>
          )}
          </div>
        ) : null}
      >
      </ClientPageHeader>

      {hasLocalOnlyPlanSave ? (
        <aside className={styles.cloudSaveNotice} role="status" data-testid="workout-plan-cloud-save-notice">
          <strong>План сохранён на устройстве</strong>
          <span>Не удалось синхронизировать его с облаком. Проверьте подключение к интернету — тренировки доступны и не потеряются.</span>
        </aside>
      ) : null}

      {isDeckWorkoutMode && sortedWorkouts.length > 0 && !isCurrentPlanCompleted && (
        <p className={styles.heroSubtitle} data-testid="workout-list-swipe-hint">
          ‹ Свайпни влево или вправо ›
        </p>
      )}

      <div
        className={`${styles.workoutList} ${isDeckWorkoutMode ? styles.workoutDeck : ""} ${isCurrentPlanCompleted ? styles.completedDeck : ""}`}
        data-testid="workout-list-deck"
      >
        {sortedWorkouts.length === 0 ? (
          <div className={styles.emptyState} data-testid="workout-list-empty-state">
            <div className={styles.emptyIcon} aria-hidden="true"><Dumbbell /></div>
            <h2>{isIndividualWorkoutMode ? "Плана от тренера пока нет" : "Тренировка ещё не назначена"}</h2>
            <p>
              {isIndividualWorkoutMode
                ? "Тренер ещё не назначил программу. Когда она появится, вы увидите её здесь. Базовые тренировки можно выбрать в кабинете."
                : "Как только тренировка появится в вашем профиле, она отобразится здесь."}
            </p>
            <button type="button" onClick={isIndividualWorkoutMode ? onOpenCabinet : onGoMain}>
              {isIndividualWorkoutMode ? "Открыть кабинет" : "Вернуться в меню"}
            </button>
          </div>
        ) : isCurrentPlanCompleted ? (
          <section className={styles.completionState} data-testid="workout-plan-completed-state">
            <span className={styles.completionEyebrow}>ПЛАН ЗАВЕРШЁН</span>
            <div className={styles.completionIcon} aria-hidden="true"><Check /></div>
            <div className={styles.completionCopy}>
              <h2>{isBasicWorkoutMode ? "Базовый план завершён" : "План завершён"}</h2>
              <p>
                {isBasicWorkoutMode
                  ? "Все тренировки выполнены. Новый план можно подготовить, когда будете готовы продолжить."
                  : "Все тренировки из текущей программы выполнены. История сохранена в приложении."}
              </p>
            </div>
            <div className={styles.completionSummary} aria-label={`Выполнено ${completedWorkoutCount} из ${sortedWorkouts.length} тренировок`}>
              <span>Выполнено</span>
              <strong>{completedWorkoutCount} из {sortedWorkouts.length}</strong>
              <small>тренировок</small>
            </div>
            <div className={styles.completionActions}>
              {isBasicWorkoutMode ? (
                <button type="button" onClick={onOpenBasicSettings}>Создать следующий план</button>
              ) : (
                <button type="button" onClick={() => {
                  loadHistory();
                  setWorkoutHistoryModalOpen(true);
                }}>
                  Открыть историю
                </button>
              )}
              {!isBasicWorkoutMode ? (
                <button type="button" className={styles.secondaryCompletionAction} onClick={onOpenCabinet}>
                  Режим тренировок
                </button>
              ) : null}
            </div>
          </section>
        ) : isDeckWorkoutMode && activeIndividualWorkout ? (
          (() => {
            const w = activeIndividualWorkout;
            const index = activeWorkoutIndex;
            const completed = activeIndividualWorkoutCompleted;
            const activeNext = index === nextUncompletedWorkoutIndex;
            const item = getWorkoutPresentation(w, index);
            const fallbackImage = versionedLocalAsset(
              item.image ||
                WORKOUT_MENU_ITEMS[index % WORKOUT_MENU_ITEMS.length]?.image ||
                WORKOUT_MENU_ITEMS[0]?.image ||
                "",
              appVersion
            );
            const coverImage = versionedLocalAsset(getWorkoutCover(w), appVersion);
            const adjacentCoverImages = [...new Set(
              [-1, 1]
                .map((offset) => sortedWorkouts[
                  (index + offset + sortedWorkouts.length) % sortedWorkouts.length
                ])
                .map(getWorkoutCover)
                .map((image) => versionedLocalAsset(image, appVersion))
                .filter((image) => image && image !== coverImage)
            )];

            return (
              <>
                <article
                  className={`${styles.workoutCard} ${styles.featuredCard} ${completed ? styles.completed : ""} ${activeNext ? styles.activeNext : ""}`}
                  aria-current={activeNext ? "step" : undefined}
                  key={w.id}
                  data-workout-card-id={w.id}
                  data-testid="workout-list-card"
                  data-swipe-phase={swipeMotion.phase}
                  style={{
                    "--workout-swipe-x": `${swipeMotion.offset}px`,
                    "--workout-swipe-rotation": `${swipeMotion.offset * 0.012}deg`
                  }}
                  onPointerDown={handleIndividualWorkoutSwipeStart}
                  onPointerMove={handleIndividualWorkoutSwipeMove}
                  onPointerUp={handleIndividualWorkoutSwipeEnd}
                  onPointerCancel={() => {
                    swipeStartRef.current = null;
                    settleIndividualWorkoutSwipe();
                  }}
                >
                  <span className={styles.cardTop} data-testid="workout-card-top">
                    <span className={styles.badges} data-testid="workout-card-badges">
                      {!completed && (
                        hasActiveWorkoutDraft ? (
                          <span className={`${styles.badge} ${styles.progressBadge}`} data-testid="workout-card-status">В процессе</span>
                        ) : activeNext ? (
                          <span className={`${styles.badge} ${styles.nextBadge}`} data-testid="workout-card-status">Следующая</span>
                        ) : null
                      )}
                      {activeWorkoutPendingSync && (
                        <span className={`${styles.badge} ${styles.syncBadge}`}>Ожидает синхронизации</span>
                      )}
                    </span>
                    <span className={styles.workoutWeek} data-testid="workout-card-day">{item.day}</span>
                  </span>

                  <span className={styles.cardBody} data-testid="workout-card-body">
                    {completed && (
                      <span className={styles.completedRibbon} data-testid="workout-card-status">Выполнена</span>
                  )}
                  <span className={styles.cardInfo} data-testid="workout-card-info">
                      <span
                        className={styles.cardProgress}
                        data-testid="workout-list-progress"
                        style={{ "--completed-workouts-progress": `${completedWorkoutProgressPercent}%` }}
                      >
                        <span className={styles.workoutTitle} data-testid="workout-card-title">{item.title}</span>
                        <span className={styles.cardProgressPosition}>{activeWorkoutIndex + 1} из {sortedWorkouts.length}</span>
                      </span>

                      <span className={styles.workoutStats} data-testid="workout-card-stats">
                        <span><b>🏋️</b>{item.exerciseCount} упражнений</span>
                        <span><b>▰</b>{item.setCount} подходов</span>
                        <span><b>⏱</b>{item.duration}</span>
                      </span>
                    </span>

                    <span className={styles.workoutImage}>
                      {coverImage || fallbackImage ? (
                        <img
                          src={coverImage || fallbackImage}
                          alt=""
                          width="512"
                          height="910"
                          loading="eager"
                          decoding="async"
                          fetchPriority="high"
                          onError={(event) => {
                            if (!fallbackImage || event.currentTarget.dataset.fallbackApplied === "true") return;
                            event.currentTarget.dataset.fallbackApplied = "true";
                            event.currentTarget.src = fallbackImage;
                          }}
                        />
                      ) : (
                        <span className={styles.imageFallback}>
                          <b>{item.title}</b>
                          <small>{w.exercises?.[0]?.name || "Персональная тренировка"}</small>
                        </span>
                      )}
                    </span>

                    <button
                      type="button"
                      className={`${styles.startButton} ${completed ? styles.completedStartButton : ""}`}
                      data-testid="workout-start-button"
                      onClick={(event) => {
                        if (swipeSuppressClickRef.current) {
                          event.preventDefault();
                          return;
                        }
                        if (completed) {
                          loadHistory();
                          setWorkoutHistoryModalOpen(true);
                          return;
                        }
                        openWorkoutByIndex(index);
                      }}
                    >
                      {activeWorkoutActionLabel}
                    </button>
                  </span>
                </article>
                {adjacentCoverImages.map((image) => (
                  <img
                    className={styles.coverPreload}
                    src={image}
                    alt=""
                    width="1"
                    height="1"
                    loading="eager"
                    decoding="async"
                    aria-hidden="true"
                    key={image}
                  />
                ))}
              </>
            );
          })()
        ) : (
          sortedWorkouts.map((w, index) => {
            const weekNumber =
              String(w.name || "").match(/неделя\s*(\d+)/i)?.[1] ||
              String(w.weekName || "").match(/неделя\s*(\d+)/i)?.[1] ||
              String(w.id || "").match(/week[_-]?(\d+)/i)?.[1];

            const workoutDayNumber =
              String(w.name || "").match(/день\s*(\d+)/i)?.[1] ||
              String(w.id || "").match(/day[_-]?(\d+)/i)?.[1] ||
              index + 1;

            const fallbackItem = WORKOUT_MENU_ITEMS[index % WORKOUT_MENU_ITEMS.length] || WORKOUT_MENU_ITEMS[0];

            const item = {
              day: weekNumber ? `Неделя ${weekNumber} · День ${workoutDayNumber}` : `День ${workoutDayNumber}`,
              title: String(w.name || `День ${workoutDayNumber}`)
                .replace(/^Неделя\s*\d+\s*[—-]\s*/i, "")
                .replace(/^День\s*\d+\s*[—-]\s*/i, ""),
              image: versionedLocalAsset(fallbackItem?.image || WORKOUT_MENU_ITEMS[0].image, appVersion)
            };

            return (
              <button
                className={styles.workoutCard}
                type="button"
                key={w.id}
                onClick={() => openWorkout(w.id)}
              >
                <span className={styles.listImageWrap}>
                  <img src={item.image} alt="" className={styles.listImage} />
                </span>

                <span className={styles.listText}>
                  <span className={styles.listDay}>{item.day}</span>
                  <span className={styles.listName}>{item.title}</span>
                </span>

                <span className={styles.listArrow} aria-hidden="true"><ChevronRight /></span>
              </button>
            );
          })
        )}
      </div>

      <div className={styles.bottomPanel}>
        {(renderClientMainBottomBar || (() => null))({
          activeTab: "workouts",
          className: styles.menuBar,
          isTrainerMode,
          onGoMain,
          onOpenTraining,
          onOpenNutrition,
          onOpenCabinet,
          onOpenTrainerClients,
          onOpenTrainerPrograms,
          onLoadTrainerCabinet: onOpenCabinet
        })}
      </div>

      <IndividualWorkoutHistoryDialog
        open={Boolean(isIndividualWorkoutMode && workoutHistoryModalOpen)}
        historyLoading={historyLoading}
        historyItems={individualWorkoutHistoryItems}
        onClose={() => setWorkoutHistoryModalOpen(false)}
      />

      <WorkoutDraftRestoreDialog
        open={Boolean(workoutDraftRestorePrompt)}
        blocked={Boolean(
          workoutReadinessOpen ||
          postWorkoutFeedbackOpen ||
          fullscreenVideo ||
          showFirstSetupOnboarding
        )}
        onRestart={() => handleWorkoutDraftChoice(false)}
        onRestore={() => handleWorkoutDraftChoice(true)}
      />
    </div>
  );
}
