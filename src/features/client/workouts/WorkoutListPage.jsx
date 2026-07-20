import { useEffect, useRef, useState } from "react";
import { Clock3, Paperclip, Settings } from "lucide-react";
import {
  getProgramHistoryItems,
  getWorkoutCover,
  getWorkoutPresentation,
  WORKOUT_MENU_ITEMS
} from "../../../domain/workoutPresentation";
import { sortWorkoutDays } from "../../../utils/workoutPlanNormalization";
import {
  buildCompletedWorkoutSet,
  getNextUncompletedWorkoutIndex,
  getWorkoutAssignmentVersion,
  isWorkoutCompletedWithSet
} from "../../../utils/workoutCompletion";
import { safeReadJsonStorage, safeWriteJsonStorage } from "../../../utils/storageSafety";
import { getWorkoutDraftKey } from "../../../utils/workoutDraftStorage";
import { INDIVIDUAL_WORKOUT_SWIPE_HINT_KEY } from "../../../constants/appConfig";
import { WorkoutDraftRestoreDialog } from "../../../components/workout/WorkoutDialogs";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import {
  IndividualWorkoutHistoryDialog,
  WorkoutModePickerDialog
} from "./WorkoutListDialogs";
import styles from "./WorkoutListPage.module.css";
import adaptiveShellStyles from "../../../shared/ui/ClientAdaptiveShell.module.css";

const versionedLocalAsset = (src, version) => {
  if (typeof src !== "string" || !src.startsWith("/")) return src;
  return `${src}${src.includes("?") ? "&" : "?"}v=${encodeURIComponent(version || "")}`;
};

export default function WorkoutListPage({
  appVersion,
  renderClientMainBottomBar,
  plan,
  history,
  workoutCalendar = {},
  currentUserId,
  workoutModePreference,
  workoutModeRemember,
  individualWorkoutIndex,
  individualWorkoutIndexInitialized,
  setIndividualWorkoutIndex,
  setIndividualWorkoutIndexInitialized,
  workoutModeModalOpen,
  setWorkoutModeModalOpen,
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
  onOpenIndividualWorkouts,
  onToggleWorkoutModeRemember,
  openCabinetWorkoutHistory,
  handleWorkoutDraftChoice
}) {
  const [swipeHintVisible, setSwipeHintVisible] = useState(
    () => safeReadJsonStorage(INDIVIDUAL_WORKOUT_SWIPE_HINT_KEY, true) !== false
  );
  const [swipeMotion, setSwipeMotion] = useState({ offset: 0, phase: "idle" });
  const basicQuizRedirectedRef = useRef(false);
  const swipeStartRef = useRef(null);
  const swipeSuppressClickRef = useRef(false);
  const swipeTimerRef = useRef(null);
  const swipeFrameRef = useRef(null);

  const isIndividualWorkoutMode = workoutModePreference.mode === "individual";
  const isBasicWorkoutMode = workoutModePreference.mode === "basic" || plan.source === "basic";
  const shouldOpenBasicQuiz = isBasicWorkoutMode && plan.source !== "basic";
  const planWorkouts = isBasicWorkoutMode && plan.source !== "basic" ? [] : plan.workouts || [];
  const sortedWorkouts = sortWorkoutDays(planWorkouts);
  const assignmentVersion = getWorkoutAssignmentVersion(plan);
  const completionHistory = isBasicWorkoutMode && assignmentVersion
    ? (Array.isArray(history) ? history : []).filter((item) => (
      String(item?.assignedProgramUpdatedAt || "").trim() === assignmentVersion
    ))
    : history;
  const completedWorkoutSet = buildCompletedWorkoutSet(
    completionHistory,
    assignmentVersion,
    isBasicWorkoutMode ? {} : workoutCalendar
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
  const isWorkoutCompleted = (workoutItem) => (
    isWorkoutCompletedWithSet(workoutItem, completedWorkoutSet, assignmentVersion)
  );
  const completedWorkoutCount = sortedWorkouts.filter(isWorkoutCompleted).length;
  const completedWorkoutProgressPercent = sortedWorkouts.length > 0
    ? Math.min(100, Math.max(0, Math.round((completedWorkoutCount / sortedWorkouts.length) * 100)))
    : 0;
  const activeIndividualWorkoutCompleted = isWorkoutCompleted(activeIndividualWorkout);
  const activeWorkoutDraft = currentUserId && activeIndividualWorkout?.id
    ? safeReadJsonStorage(getWorkoutDraftKey(currentUserId, activeIndividualWorkout.id), null)
    : null;
  const activeDraftAssignmentVersion =
    activeWorkoutDraft?.assignmentVersion ||
    activeWorkoutDraft?.assignedProgramUpdatedAt ||
    activeWorkoutDraft?.plan?.assignedProgramUpdatedAt ||
    "";

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
  const hasActiveWorkoutDraft = Boolean(
    activeWorkoutDraft?.workoutId === activeIndividualWorkout?.id &&
    (
      !plan.assignedProgramUpdatedAt ||
      activeDraftAssignmentVersion === plan.assignedProgramUpdatedAt
    )
  );
  const individualWorkoutProgramScope = {
    assignedProgramId: plan.assignedProgramId || activeIndividualWorkout?.assignedProgramId || "",
    assignedProgramName: plan.assignedProgramName || activeIndividualWorkout?.assignedProgramName || "История программы",
    assignedProgramUpdatedAt: plan.assignedProgramUpdatedAt || activeIndividualWorkout?.assignedProgramUpdatedAt || "",
    workoutIds: sortedWorkouts.map((workoutItem) => workoutItem.id)
  };
  const individualWorkoutHistoryItems = getProgramHistoryItems(history, individualWorkoutProgramScope).slice(0, 12);
  const activeWorkoutActionLabel = hasActiveWorkoutDraft
    ? "Продолжить тренировку"
    : activeIndividualWorkoutCompleted
      ? "Повторить тренировку"
      : "Начать тренировку";
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
      openWorkout(nextWorkout.id);
    }
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

  function dismissIndividualWorkoutSwipeHint() {
    if (!swipeHintVisible) return;
    setSwipeHintVisible(false);
    safeWriteJsonStorage(INDIVIDUAL_WORKOUT_SWIPE_HINT_KEY, false);
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
    event.currentTarget.setPointerCapture?.(event.pointerId);
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

    dismissIndividualWorkoutSwipeHint();
    animateIndividualWorkout(deltaX < 0 ? "next" : "previous");
  }

  if (shouldOpenBasicQuiz) {
    return null;
  }

  return (
    <div
      className={`${styles.page} ${isIndividualWorkoutMode ? styles.individualMode : styles.basicMode} ${isDeckWorkoutMode ? styles.deckMode : ""} ${adaptiveShellStyles.shell}`}
      data-client-adaptive-shell="true"
      data-css-module-scope="workout-list"
    >
      <ClientPageHeader
        className={styles.hero}
        title={isIndividualWorkoutMode ? "Мой план" : "Тренировки"}
        titleTestId="workout-list-title"
        testId="workout-list-header"
        scope="workout-list-header"
        actions={(
          <div className={styles.headerActions}>
          {isIndividualWorkoutMode && (
            <button
              type="button"
              className={styles.headerButton}
              data-testid="workout-history-button"
              aria-label="Открыть историю тренировок"
              onClick={() => {
                loadHistory();
                setWorkoutHistoryModalOpen(true);
              }}
            >
              <Clock3 aria-hidden="true" />
            </button>
          )}
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
          <button
            type="button"
            className={styles.headerButton}
            data-testid="workout-mode-button"
            aria-label="Выбрать режим запуска тренировки"
            onClick={() => setWorkoutModeModalOpen(true)}
          >
            <Paperclip aria-hidden="true" />
          </button>
          </div>
        )}
      >
        <p className={styles.heroSubtitle}>
          {isIndividualWorkoutMode
            ? "Листай тренировки и выбирай нужную"
            : "Выбери тренировку из подобранного плана"}
        </p>
      </ClientPageHeader>

      <div
        className={`${styles.workoutList} ${isDeckWorkoutMode ? styles.workoutDeck : ""}`}
        data-testid="workout-list-deck"
      >
        {sortedWorkouts.length === 0 ? (
          <div className={styles.emptyState} data-testid="workout-list-empty-state">
            <div className={styles.emptyIcon}>⏳</div>
            <h2>Тренировка ещё не назначена</h2>
            <p>Тренер пока не назначил тебе программу. Как только тренировка появится в твоём профиле, она отобразится здесь.</p>
            <button type="button" onClick={onGoMain}>Вернуться в меню</button>
          </div>
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
                  <span className={styles.cardTop}>
                    <span className={styles.badges}>
                      {completed ? (
                        <span className={`${styles.badge} ${styles.completedBadge}`}>✓ Выполнена</span>
                      ) : hasActiveWorkoutDraft ? (
                        <span className={`${styles.badge} ${styles.progressBadge}`}>В процессе</span>
                      ) : activeNext ? (
                        <span className={`${styles.badge} ${styles.nextBadge}`}>Следующая</span>
                      ) : null}
                      {activeWorkoutPendingSync && (
                        <span className={`${styles.badge} ${styles.syncBadge}`}>Ожидает синхронизации</span>
                      )}
                    </span>
                    <span className={styles.workoutWeek}>{item.day}</span>
                  </span>

                  <span className={styles.cardBody}>
                    <span className={styles.cardInfo}>
                      <span className={styles.workoutTitle}>{item.title}</span>
                      <span className={styles.accentLine} />

                      <span className={styles.workoutStats}>
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
                      className={styles.startButton}
                      data-testid="workout-start-button"
                      onClick={(event) => {
                        if (swipeSuppressClickRef.current) {
                          event.preventDefault();
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

                <span className={styles.listArrow}>›</span>
              </button>
            );
          })
        )}
      </div>

      {isDeckWorkoutMode && sortedWorkouts.length > 1 && (
        <div className={styles.workoutNav} data-testid="workout-list-nav">
          <button
            type="button"
            aria-label="Предыдущая тренировка"
            onClick={() => {
              dismissIndividualWorkoutSwipeHint();
              animateIndividualWorkout("previous");
            }}
          >
            ←
          </button>

          <div className={styles.centerNav}>
            {swipeHintVisible && (
              <small className={styles.swipeHint}>
                Свайпни, чтобы выбрать тренировку
              </small>
            )}
            <span className={styles.swipeAffordance} aria-hidden="true">
              ‹ свайп ›
            </span>
          </div>

          <button
            type="button"
            aria-label="Следующая тренировка"
            onClick={() => {
              dismissIndividualWorkoutSwipeHint();
              animateIndividualWorkout("next");
            }}
          >
            →
          </button>
        </div>
      )}

      <div className={styles.bottomPanel}>
        {isDeckWorkoutMode && sortedWorkouts.length > 0 && (
          <div
            className={styles.bottomProgress}
            data-testid="workout-list-progress"
            style={{ "--completed-workouts-progress": `${completedWorkoutProgressPercent}%` }}
          >
            <span>{activeWorkoutIndex + 1} из {sortedWorkouts.length}</span>
            <span>Выполнено {completedWorkoutCount} из {sortedWorkouts.length}</span>
          </div>
        )}
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

      <WorkoutModePickerDialog
        open={workoutModeModalOpen}
        workoutModePreference={workoutModePreference}
        rememberChoice={workoutModeRemember}
        onClose={() => setWorkoutModeModalOpen(false)}
        onOpenBasic={onOpenBasicMode}
        onOpenIndividual={() => {
          setWorkoutModeModalOpen(false);
          onOpenIndividualWorkouts();
        }}
        onRememberChoiceChange={onToggleWorkoutModeRemember}
      />

      <IndividualWorkoutHistoryDialog
        open={Boolean(isIndividualWorkoutMode && workoutHistoryModalOpen)}
        historyLoading={historyLoading}
        historyItems={individualWorkoutHistoryItems}
        onClose={() => setWorkoutHistoryModalOpen(false)}
        onOpenAll={() => openCabinetWorkoutHistory(null, individualWorkoutProgramScope)}
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
