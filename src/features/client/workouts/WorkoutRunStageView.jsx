import { useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import { auth, db } from "../../../firebase.js";

import { formatCompactTimer, getExerciseTechniqueHint } from "../../../domain/workoutPresentation";
import { getTrainerExerciseTechniqueGuide } from "../../../utils/trainerExerciseTechnique";
import { exerciseUsesExternalWeight } from "../../../utils/auditSafety";
import { getBasicWorkoutAlternatives } from "../../../utils/basicWorkoutAlternatives";
import { getTrainerExerciseAlternatives } from "../../../utils/trainerExerciseAlternatives";
import { getWorkoutPrimaryAction } from "../../../utils/workoutPrimaryAction";
import { buildWorkoutExercisePickerItems } from "../../../utils/workoutExerciseNavigation.js";
import {
  applyBasicWorkoutExerciseOverride,
  getBasicWorkoutExerciseTechniqueHint
} from "../../../utils/basicWorkoutExercisePresentation";
import BasicWorkoutExerciseExplainer from "./BasicWorkoutExerciseExplainer";
import WorkoutExerciseModals from "./WorkoutExerciseModals";
import WorkoutExercisePicker from "./WorkoutExercisePicker";
import WorkoutExerciseSets from "./WorkoutExerciseSets";
import WorkoutExerciseSupport from "./WorkoutExerciseSupport";
import WorkoutExerciseVideoFrame from "./WorkoutExerciseVideoFrame";
import WorkoutFinishStage from "./WorkoutFinishStage";
import WorkoutStageActionPanel from "./WorkoutStageActionPanel";
import WorkoutRestTimer from "./WorkoutRestTimer";
import { WorkoutStageHeading } from "./WorkoutRunOverlays";
import { WorkoutWarmupBody, WorkoutWarmupHeader } from "./WorkoutWarmupStage";
import { buildWorkoutRunStageModel } from "./workoutRunStageModel";
import { useBasicWorkoutExerciseOverrides } from "./useBasicWorkoutExerciseOverrides";
import { protectedExerciseVideoAccess } from "../../../utils/protectedExerciseVideo.js";
import { upcomingWorkoutVideoPreviews } from "./workoutVideoPrefetch.js";
import styles from "./WorkoutRunStageView.module.css";

export function WorkoutRunExercisePreview({
  children,
  exercise,
  currentExerciseIndex = 1,
  exerciseCount = 4,
  isFinishSlide = false,
  isWorkoutSaved = false,
  hasVideo = false,
  videoOpen = false,
  onOpenTechnique = () => {}
}) {
  return (
      <div
      className={`${styles.deck} ${styles.exerciseDeck}`}
      data-testid="workout-run-stage"
      data-css-module-scope="workout-run-stage"
      data-workout-stage="exercise"
    >
      <WorkoutStageHeading
        exercise={exercise}
        isFinishSlide={isFinishSlide}
        isStartSlide={false}
        isWorkoutSaved={isWorkoutSaved}
        onOpenTechnique={onOpenTechnique}
      />

      <div
        className={`${styles.card} ${styles.exerciseCard} ${hasVideo ? styles.hasVideo : ""} ${videoOpen ? styles.videoOpenCard : ""}`}
        data-testid="workout-stage-card"
        data-workout-stage-card="exercise"
      >
        <div className={styles.exerciseMeta}>
          <span>День 1 · Упражнение {currentExerciseIndex} из {exerciseCount}</span>
          <b>{String(currentExerciseIndex).padStart(2, "0")}</b>
        </div>
        {children}
      </div>
      </div>
  );
}

export default function WorkoutRunStageView({
  closeWorkoutExerciseModal,
  currentExerciseIndex,
  deckRef,
  exerciseHistoryOpenId,
  exerciseNoteOpenId,
  exerciseTechniqueOpenId,
  endPerformanceCheck,
  goBackToMain,
  goToNextExercise,
  goToPreviousExercise,
  history,
  inlinePlayingVideoId,
  inlineVideoControlsTimerRef,
  inlineVideoControlsVisible,
  isSaving,
  isWorkoutSaved,
  getLastExerciseText,
  lastExerciseResults,
  normalizeExercise,
  openVideoId,
  openWorkoutExerciseModal,
  plan,
  postWorkoutFeedback,
  requestLeaveWorkout,
  confirmBasicStartingWeightFeedback,
  replaceBasicWorkoutExercise,
  replaceTrainerAssignedWorkoutExercise,
  restTimerDuration,
  restTimerRunning,
  restTimerSeconds,
  saveWorkoutToFirebase,
  setExerciseHistoryOpenId,
  setExerciseNoteOpenId,
  setExerciseTechniqueOpenId,
  setCurrentExerciseIndex,
  setFullscreenVideo,
  setInlinePlayingVideoId,
  setInlineVideoControlsVisible,
  setIsWorkoutSaved,
  setOpenVideoId,
  setPostWorkoutFeedbackOpen,
  setRestTimerRunning,
  setRestTimerSeconds,
  setShowWorkoutSavedCard,
  setVideoLoadingId,
  setVideoRetryToken,
  setWarmupTimerRunning,
  setWarmupTimerSeconds,
  setWarmupTimerPreset,
  showAppError,
  showInlineVideoControlsTemporarily,
  showWorkoutSavedCard,
  startPerformanceCheck,
  startRestTimer,
  swipeDirection,
  swipeOffset,
  toggleWarmupStep,
  toggleWorkoutSetCompleted,
  updateExerciseNote,
  updateSet,
  videoLoadingId,
  videoRetryToken,
  warmupCompletedSteps,
  warmupTimerDuration,
  warmupTimerRunning,
  warmupTimerSeconds,
  workout,
  workoutClientComment,
  workoutDurationText,
  workoutFinishedAt,
  workoutHistorySyncState,
  workoutReadiness,
  workoutStarted,
  setWorkoutClientComment
}) {
  const [exerciseSwapOpenId, setExerciseSwapOpenId] = useState("");
  const [restTimerExpanded, setRestTimerExpanded] = useState(false);
  const [restSessionKey, setRestSessionKey] = useState("");
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [exerciseHistoryState, setExerciseHistoryState] = useState(null);
  const [historyPage, setHistoryPage] = useState(null);
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [selectedStepSet, setSelectedStepSet] = useState(null);
  const completionControlRef = useRef(null);
  const primaryActionAtRef = useRef(-Infinity);
  const {
    completedExercisesCount,
    exercise: unresolvedExercise,
    exerciseAiWeightAdjustments,
    exerciseVideoFailed,
    executionSteps,
    finishAdviceText,
    finishPresentation,
    finishProgressText,
    finishStats,
    finishSyncText,
    incompleteExerciseNames,
    isFinishSlide,
    isStartSlide,
    sharedExerciseAiWeightAdjustment,
    warmupSteps
  } = buildWorkoutRunStageModel({
    currentExerciseIndex,
    history,
    isWorkoutSaved,
    normalizeExercise,
    openVideoId,
    plan,
    workout,
    workoutDurationText,
    workoutFinishedAt,
    workoutHistorySyncState,
    workoutStarted
  });

  const isBasicWorkout = workout?.source === "basic" || plan?.source === "basic";
  const basicExerciseOverrides = useBasicWorkoutExerciseOverrides(isBasicWorkout);
  const exercise = isBasicWorkout && unresolvedExercise
    ? applyBasicWorkoutExerciseOverride(unresolvedExercise, basicExerciseOverrides)
    : unresolvedExercise;
  const previewQueueKey = JSON.stringify(upcomingWorkoutVideoPreviews({
    workout, currentExerciseIndex, workoutStarted, isWorkoutSaved,
    resolveExercise: item => {
      const normalized = normalizeExercise(item);
      return isBasicWorkout ? applyBasicWorkoutExerciseOverride(normalized, basicExerciseOverrides) : normalized;
    }
  }));
  useEffect(() => {
    let active = true;
    const session = protectedExerciseVideoAccess.getSnapshot();
    void (async () => {
      for (const preview of JSON.parse(previewQueueKey)) {
        if (!active || protectedExerciseVideoAccess.getSnapshot() !== session) break;
        await protectedExerciseVideoAccess.prefetchPoster(preview.source, { previewTime: preview.previewTime });
      }
    })();
    return () => { active = false; };
  }, [previewQueueKey]);

  const historyExercise = JSON.stringify({ id: exercise?.id, name: exercise?.name,
    exerciseCardId: exercise?.exerciseCardId, exerciseCardOwnerUid: exercise?.exerciseCardOwnerUid,
    libraryExerciseId: exercise?.libraryExerciseId, basicExerciseId: exercise?.basicExerciseId,
    basicExerciseLibraryId: exercise?.basicExerciseLibraryId, exerciseId: exercise?.exerciseId,
    sourceExerciseId: exercise?.sourceExerciseId, originalExerciseId: exercise?.originalExerciseId,
    catalogueId: exercise?.catalogueId, exerciseCardNames: exercise?.exerciseCardNames,
    previousNames: exercise?.previousNames, video: exercise?.video || exercise?.videoUrl || exercise?.videoURL });
  const historyRequestKey = `${auth.currentUser?.uid || ""}:${workout?.id}:${historyExercise}`;
  const historyCursor = historyPage?.key === historyRequestKey ? historyPage.cursor : null;
  const appendHistoryPage = historyPage?.key === historyRequestKey && historyPage.append;
  const forceHistoryPage = historyPage?.key === historyRequestKey && historyPage.force === true;
  useEffect(() => {
    const item = JSON.parse(historyExercise);
    if (!item.id || item.id === "warmup" || exerciseHistoryOpenId !== item.id) return undefined;
    let active = true;
    void import("../../../utils/workoutExerciseHistory.js").then(({ loadRecentWorkoutExerciseHistory }) =>
      loadRecentWorkoutExerciseHistory({ auth, db, exercise: item, scope: "all" }, { cursor: historyCursor, force: forceHistoryPage })
    ).then(result => {
      if (active) setExerciseHistoryState(previous => {
        if (!result.isCurrent()) return appendHistoryPage && previous?.key === historyRequestKey
          ? { ...previous, status: "ready", loadingMore: false, loadMoreError: true, needsHistoryRefresh: true }
          : { key: historyRequestKey, status: "error", entries: [], needsHistoryRefresh: true };
        const append = appendHistoryPage && previous?.key === historyRequestKey;
        const entries = [...(append ? previous.entries || [] : []), ...result.entries];
        const byId = new Map();
        for (const entry of entries) {
          const previousEntry = byId.get(entry.id);
          if (!previousEntry || entry.date > previousEntry.date) byId.set(entry.id, entry);
        }
        return { ...result, key: historyRequestKey, status: "ready", loadingMore: false,
          entries: [...byId.values()].sort((a, b) => b.date.localeCompare(a.date)),
          searchedWorkouts: (append ? previous.searchedWorkouts || 0 : 0) + result.searchedWorkouts };
      });
    }).catch(error => {
      if (active) setExerciseHistoryState(previous => appendHistoryPage && previous?.key === historyRequestKey
        ? { ...previous, status: "ready", loadingMore: false, loadMoreError: true,
          needsHistoryRefresh: error?.code === "exercise-history/cursor-invalid" }
        : { key: historyRequestKey, status: "error", entries: [] });
    });
    return () => { active = false; };
  }, [exerciseHistoryOpenId, historyExercise, historyRequestKey, historyAttempt, historyCursor, appendHistoryPage, forceHistoryPage]);

  if (!exercise && !isFinishSlide && !isStartSlide) {
    return (
      <div className={styles.missingExercise}>
        <h3>Упражнение не найдено</h3>
      </div>
    );
  }

  const isWarmup = exercise?.id === "warmup";
  const exerciseTechniqueHint = getBasicWorkoutExerciseTechniqueHint(
    exercise,
    getTrainerExerciseTechniqueGuide(exercise) || getExerciseTechniqueHint(exercise?.name)
  );
  const exerciseAlternatives = exercise && !isWarmup
    ? isBasicWorkout
      ? getBasicWorkoutAlternatives(exercise, workout, plan)
      : getTrainerExerciseAlternatives(exercise)
    : [];
  const firstExerciseSet = exercise?.sets?.[0];
  const startingWeightCheck = exercise && isBasicWorkout && !isWarmup && exerciseUsesExternalWeight(exercise)
    && firstExerciseSet?.startingWeightSource === "estimate"
    && !firstExerciseSet.startingWeightConfirmed
    ? { awaitingFeedback: Boolean(firstExerciseSet.completed) }
    : null;
  const hasExerciseVideo = Boolean(!isWarmup && exercise?.video && !exerciseVideoFailed);
  const groupBlock = exercise?.taskBlockType === "group"
    ? exercise.taskBlockConfig
    : exercise?.runtimeGroup || null;
  const groupExerciseCount = Math.max(
    Number(exercise?.taskBlockExerciseCount) || 0,
    Array.isArray(groupBlock?.exerciseIds) ? groupBlock.exerciseIds.length : 0
  );
  const groupExercisePosition = Math.min(
    groupExerciseCount || 1,
    Math.max(1, Number(exercise?.taskBlockExerciseIndex || 0) + 1)
  );
  const groupRound = Number(exercise?.runtimeGroup?.roundIndex);
  const groupRounds = Math.max(1, Number(groupBlock?.rounds) || 1);
  const groupProgressLabel = groupBlock
    ? `${groupBlock.groupMode === "triset" ? "Трисет" : "Суперсет"} · круг ${Number.isFinite(groupRound) ? groupRound + 1 : 1}/${groupRounds} · ${groupExercisePosition}/${groupExerciseCount || 1}`
    : "";
  const exerciseCount = Math.max(1, executionSteps.length);
  const stepKey = `${workout?.id}:${currentExerciseIndex}:${exercise?.id}`;
  // A completed rest belongs to this step, not to a later visit or workout.
  if (restSessionKey && restSessionKey !== stepKey) {
    setRestSessionKey("");
    if (restTimerExpanded) setRestTimerExpanded(false);
  }
  const restCompleted = Boolean(restSessionKey === stepKey && restTimerSeconds <= 0 && !restTimerRunning);
  const visibleSetIndexes = Number.isInteger(exercise?.runtimeSetIndex) ? [exercise.runtimeSetIndex] : null;
  const primaryAction = getWorkoutPrimaryAction({
    sets: exercise?.sets,
    visibleSetIndexes,
    selectedSetIndex: selectedStepSet?.key === stepKey ? selectedStepSet.index : undefined,
    isLastExercise: currentExerciseIndex >= executionSteps.length
  });
  const selectExerciseSet = (index) => setSelectedStepSet({ key: stepKey, index });
  const stopRest = () => {
    setRestTimerExpanded(false);
    setRestSessionKey("");
    setRestTimerRunning(false);
    setRestTimerSeconds(0);
  };
  const startExerciseRest = (duration) => {
    setRestSessionKey(stepKey);
    startRestTimer(duration);
  };
  const selectExerciseStep = (index) => {
    if (!Number.isInteger(index) || index < 1 || index > executionSteps.length || isSaving || isWorkoutSaved) return;
    if (index === currentExerciseIndex) { setExercisePickerOpen(false); return; }
    if (deckRef.current?.querySelector('[data-testid="workout-timed-set-timer"][data-running="true"]')) {
      showAppError("validation", "Сначала останови таймер текущего подхода. Выполненные подходы сохранятся.");
      return;
    }
    deckRef.current?.querySelector("video")?.pause();
    stopRest();
    setInlinePlayingVideoId("");
    setVideoLoadingId("");
    setOpenVideoId(null);
    setSelectedStepSet(null);
    setExerciseHistoryOpenId("");
    setExercisePickerOpen(false);
    setCurrentExerciseIndex?.(index);
    deckRef.current?.scrollTo({ top: 0, behavior: "instant" });
  };
  const handlePrimaryAction = (event) => {
    const now = event.timeStamp;
    if (now - primaryActionAtRef.current < 400 || primaryAction.disabled || isSaving) return;
    primaryActionAtRef.current = now;
    if (primaryAction.kind === "complete") {
      selectExerciseSet(primaryAction.selectedIndex);
      completionControlRef.current?.toggleSetCompleted(primaryAction.selectedIndex);
    } else if (primaryAction.kind === "select" || primaryAction.kind === "next-set") {
      if (primaryAction.kind === "next-set") stopRest();
      selectExerciseSet(primaryAction.targetIndex);
    } else {
      stopRest();
      goToNextExercise();
    }
  };
  const exerciseProgressLabel =
    groupProgressLabel || `Упражнение ${currentExerciseIndex} из ${exerciseCount}`;
  const shouldShowGroupRest = !exercise?.runtimeGroup || (
    groupExercisePosition >= (groupExerciseCount || 1)
  );
  const canAdvanceFromRest = !isWarmup && shouldShowGroupRest
    && (primaryAction.kind === "next-set" || primaryAction.kind === "next-exercise");
  const openExerciseTechnique = (event) => {
    openWorkoutExerciseModal(
      setExerciseTechniqueOpenId,
      exercise.id,
      event?.currentTarget
    );
  };
  const openExerciseHistory = (event) => {
    setExerciseHistoryState({ key: historyRequestKey, status: "loading", entries: [] });
    setHistoryPage({ key: historyRequestKey, cursor: null, append: false, force: false });
    openWorkoutExerciseModal(setExerciseHistoryOpenId, exercise.id, event?.currentTarget);
  };
  const handleToggleWorkoutSetCompleted = (exerciseId, setIndex) => {
    selectExerciseSet(setIndex);
    if (exercise?.sets?.[setIndex]?.completed) stopRest();
    const didStartRestTimer = toggleWorkoutSetCompleted(exerciseId, setIndex);
    if (didStartRestTimer) {
      setRestSessionKey(stepKey);
      setRestTimerExpanded(true);
    }
  };
  const exerciseVideoFrame = exercise && !isWarmup ? (
    <WorkoutExerciseVideoFrame
      exercise={exercise}
      exerciseVideoFailed={exerciseVideoFailed}
      fallbackHint={exerciseTechniqueHint}
      inlinePlayingVideoId={inlinePlayingVideoId}
      inlineVideoControlsVisible={inlineVideoControlsVisible}
      onFullscreenVideo={setFullscreenVideo}
      onInlineVideoPlayFailed={() => {
        showAppError("load", "Не получилось запустить видео упражнения.");
      }}
      onOpenTechnique={openExerciseTechnique}
      showTechniqueButton={false}
      onRetryVideo={() => {
        setOpenVideoId(null);
        setVideoRetryToken((current) => current + 1);
      }}
      onVideoCanPlay={() => setVideoLoadingId("")}
      onVideoEnded={() => {
        if (inlineVideoControlsTimerRef.current) {
          window.clearTimeout(inlineVideoControlsTimerRef.current);
          inlineVideoControlsTimerRef.current = null;
        }
        setInlinePlayingVideoId("");
        setInlineVideoControlsVisible(true);
      }}
      onVideoError={() => {
        endPerformanceCheck(`Video · ${exercise.name}`, { src: exercise.video, error: true });
        if (inlineVideoControlsTimerRef.current) {
          window.clearTimeout(inlineVideoControlsTimerRef.current);
          inlineVideoControlsTimerRef.current = null;
        }
        setInlinePlayingVideoId("");
        setInlineVideoControlsVisible(true);
        setVideoLoadingId("");
        setOpenVideoId(`error:${exercise.id}`);
      }}
      onVideoLoadedMetadata={(event) => {
        setVideoLoadingId("");
        endPerformanceCheck(`Video · ${exercise.name}`, {
          src: exercise.video,
          duration: Math.round(Number(event.currentTarget.duration) || 0)
        });
      }}
      onVideoLoadStart={() => {
        setVideoLoadingId(exercise.id);
        startPerformanceCheck(`Video · ${exercise.name}`, { src: exercise.video });
      }}
      onVideoPause={() => {
        setInlinePlayingVideoId("");
        showInlineVideoControlsTemporarily();
      }}
      onVideoPlay={() => {
        setInlinePlayingVideoId(exercise.id);
        showInlineVideoControlsTemporarily();
      }}
      videoLoadingId={videoLoadingId}
      videoRetryToken={videoRetryToken}
    />
  ) : null;

  return (
    <>
      <WorkoutStageHeading
        exercise={exercise}
        isFinishSlide={isFinishSlide}
        isStartSlide={isStartSlide}
        isWorkoutSaved={isWorkoutSaved}
        inFlow={!isWarmup && !isFinishSlide}
        progressLabel={exerciseProgressLabel}
        onPrevious={!isWarmup && !isFinishSlide ? goToPreviousExercise : undefined}
        onOpenExercisePicker={!isWarmup && !isFinishSlide && !isSaving && !isWorkoutSaved && setCurrentExerciseIndex
          ? () => setExercisePickerOpen(true) : undefined}
        exercisePickerOpen={exercisePickerOpen}
      />
      <div
      ref={deckRef}
      className={`${styles.deck} ${
        isWarmup
          ? styles.warmupDeck
          : isFinishSlide
            ? styles.finishDeck
            : styles.exerciseDeck
      }`}
      data-testid="workout-run-stage"
      data-css-module-scope="workout-run-stage"
      data-workout-stage={isWarmup ? "warmup" : isFinishSlide ? "finish" : "exercise"}
    >
      {isStartSlide ? null : isFinishSlide ? (
        <WorkoutFinishStage
          completedExercisesCount={completedExercisesCount}
          exerciseCount={workout.exercises.length}
          finishAdviceText={finishAdviceText}
          finishPresentation={finishPresentation}
          finishProgressText={finishProgressText}
          finishStats={finishStats}
          finishSyncText={finishSyncText}
          goToPreviousExercise={goToPreviousExercise}
          incompleteExerciseNames={incompleteExerciseNames}
          isBasicWorkout={isBasicWorkout}
          isSaving={isSaving}
          isWorkoutSaved={isWorkoutSaved}
          onClientCommentChange={(event) => setWorkoutClientComment(event.target.value)}
          onFinishWorkout={() => {
            if (isWorkoutSaved) {
              setIsWorkoutSaved(false);
              setShowWorkoutSavedCard(false);
              goBackToMain();
              return;
            }

            if (postWorkoutFeedback) {
              saveWorkoutToFirebase(postWorkoutFeedback);
              return;
            }

            setPostWorkoutFeedbackOpen(true);
          }}
          postWorkoutFeedback={postWorkoutFeedback}
          showWorkoutSavedCard={showWorkoutSavedCard}
          swipeDirection={swipeDirection}
          swipeOffset={swipeOffset}
          workoutClientComment={workoutClientComment}
          workoutHistorySyncState={workoutHistorySyncState}
        />
      ) : (
        <>
          <div
            key={exercise.id}
            className={`${styles.card} ${
              isWarmup ? styles.warmupCard : styles.exerciseCard
            } ${hasExerciseVideo ? styles.hasVideo : ""} ${
              openVideoId === exercise.id ? styles.videoOpenCard : ""
            } ${
              swipeDirection === "up"
                ? styles.slideFromBottom
                : swipeDirection === "down"
                  ? styles.slideFromTop
                  : ""
            }`}
            data-testid="workout-stage-card"
            data-workout-stage-card={isWarmup ? "warmup" : "exercise"}
            style={{
              transform: swipeOffset
                ? `translateY(${swipeOffset}px)`
                : undefined
            }}
          >
            {isWarmup ? (
              <WorkoutWarmupHeader
                completedStepsCount={warmupCompletedSteps.length}
                dayLabel={finishPresentation.day}
                stepCount={warmupSteps.length}
              />
            ) : (
              <BasicWorkoutExerciseExplainer
                compactControls
                swapUnavailableReason={isBasicWorkout
                  ? "Для этого упражнения пока нет вариантов замены"
                  : "Тренер пока не назначил варианты замены"}
                onOpenTechnique={openExerciseTechnique}
                onOpenSwap={exerciseAlternatives.length ? () => setExerciseSwapOpenId(exercise.id) : undefined}
                onOpenNote={(event) => openWorkoutExerciseModal(
                  setExerciseNoteOpenId,
                  exercise.id,
                  event.currentTarget
                )}
                isNoteOpen={exerciseNoteOpenId === exercise.id}
              >
                {exerciseVideoFrame}
              </BasicWorkoutExerciseExplainer>
            )}

            {isWarmup ? (
              <WorkoutWarmupBody
                completedSteps={warmupCompletedSteps}
                onSetTimerPreset={setWarmupTimerPreset}
                onToggleStep={toggleWarmupStep}
                onToggleTimer={() => {
                  if (warmupTimerSeconds <= 0) {
                    setWarmupTimerSeconds(warmupTimerDuration);
                  }
                  setWarmupTimerRunning((current) => !current);
                }}
                timerDuration={warmupTimerDuration}
                timerRunning={warmupTimerRunning}
                timerSeconds={warmupTimerSeconds}
                timerText={formatCompactTimer(warmupTimerSeconds)}
                warmupSteps={warmupSteps}
              />
            ) : (
              <section className={styles.planSection} data-testid="workout-plan-section" aria-label="Подходы упражнения">
                <div className={styles.planCard} data-testid="workout-plan-card">
                  <WorkoutExerciseSets
                    exercise={exercise}
                    hasExternalWeight={exerciseUsesExternalWeight(exercise)}
                    onToggleSetCompleted={handleToggleWorkoutSetCompleted}
                    onUpdateSet={updateSet}
                    sharedExerciseAiWeightAdjustment={sharedExerciseAiWeightAdjustment}
                    showTitle={false}
                    singleSet
                    visibleSetIndexes={visibleSetIndexes}
                    primaryAction
                    planLabel={isBasicWorkout ? "План подхода" : "План тренера"}
                    selectedSetIndex={primaryAction.selectedIndex}
                    onSelectSet={selectExerciseSet}
                    completionControlRef={completionControlRef}
                    headerAccessory={<button type="button" className={styles.historyButton} data-workout-set-accessory="true"
                      aria-label="История упражнения" title="История упражнения" onClick={openExerciseHistory}>
                      <History size={20} aria-hidden="true" />
                    </button>}
                  />

                  {startingWeightCheck?.awaitingFeedback && <WorkoutExerciseSupport
                    exercise={exercise}
                    exerciseAiWeightAdjustments={exerciseAiWeightAdjustments}
                    exerciseHistoryOpenId={exerciseHistoryOpenId}
                    lastExerciseText={getLastExerciseText(exercise, lastExerciseResults)}
                    onOpenNote={(event) => openWorkoutExerciseModal(
                      setExerciseNoteOpenId,
                      exercise.id,
                      event.currentTarget
                    )}
                    onStartingWeightFeedback={(feedback) => {
                      confirmBasicStartingWeightFeedback?.(exercise.id, feedback);
                    }}
                    onToggleHistory={() => setExerciseHistoryOpenId((current) => current === exercise.id ? "" : exercise.id)}
                    readinessVolumeText={workoutReadiness?.volumeText}
                    startingWeightCheck={startingWeightCheck}
                    showNoteButton={false}
                    showPreviousInfo={false}
                  />}

                  <WorkoutExerciseModals
                    alternatives={exerciseAlternatives}
                    exercise={exercise}
                    lastExerciseText={getLastExerciseText(exercise, lastExerciseResults)}
                    progressOpen={exerciseHistoryOpenId === exercise.id}
                    progressState={exerciseHistoryState?.key === historyRequestKey ? exerciseHistoryState : { status: "loading", entries: [] }}
                    onCloseProgress={() => closeWorkoutExerciseModal(setExerciseHistoryOpenId)}
                    onRetryProgress={() => {
                      setExerciseHistoryState({ key: historyRequestKey, status: "loading", entries: [] });
                      setHistoryPage({ key: historyRequestKey, cursor: null, append: false, force: true });
                      setHistoryAttempt(value => value + 1);
                    }}
                    onLoadMoreProgress={() => {
                      if (exerciseHistoryState?.key !== historyRequestKey || exerciseHistoryState.loadingMore || !exerciseHistoryState.nextCursor) return;
                      setExerciseHistoryState(previous => ({ ...previous, loadingMore: true, loadMoreError: false }));
                      setHistoryPage({ key: historyRequestKey, cursor: exerciseHistoryState.nextCursor, append: true, force: false });
                      setHistoryAttempt(value => value + 1);
                    }}
                    noteOpen={exerciseNoteOpenId === exercise.id}
                    onCloseNote={() => closeWorkoutExerciseModal(setExerciseNoteOpenId)}
                    onCloseSwap={() => setExerciseSwapOpenId("")}
                    onCloseTechnique={() => closeWorkoutExerciseModal(setExerciseTechniqueOpenId)}
                    onSelectAlternative={(alternative) => {
                      const didReplace = isBasicWorkout
                        ? replaceBasicWorkoutExercise?.(exercise.id, alternative)
                        : replaceTrainerAssignedWorkoutExercise?.(exercise.id, alternative);
                      if (didReplace) {
                        setExerciseSwapOpenId("");
                      }
                    }}
                    alternativeSource={isBasicWorkout ? "basic" : "trainer"}
                    onUpdateNote={updateExerciseNote}
                    swapOpen={exerciseSwapOpenId === exercise.id}
                    techniqueHint={exerciseTechniqueHint}
                    techniqueOpen={exerciseTechniqueOpenId === exercise.id}
                  />
                </div>
              </section>
            )}

            {isWarmup && (
              <WorkoutExerciseModals
                exercise={exercise}
                noteOpen={false}
                onCloseNote={() => {}}
                onCloseTechnique={() => closeWorkoutExerciseModal(setExerciseTechniqueOpenId)}
                onUpdateNote={updateExerciseNote}
                techniqueHint={exerciseTechniqueHint}
                techniqueOpen={exerciseTechniqueOpenId === exercise.id}
              />
            )}

          </div>

          <WorkoutStageActionPanel
            isLastExercise={currentExerciseIndex >= executionSteps.length}
            isWarmup={isWarmup}
            onNext={goToNextExercise}
            onPrevious={goToPreviousExercise}
            onWarmupBack={requestLeaveWorkout}
            primaryAction={!isWarmup ? primaryAction : null}
            onPrimaryAction={handlePrimaryAction}
            primaryActionDisabled={isSaving}
            skippingRest={!isWarmup && restTimerSeconds > 0 && (primaryAction.kind === "next-set" || primaryAction.kind === "next-exercise")}
          >
            {!isWarmup && shouldShowGroupRest && (
              <WorkoutRestTimer
                docked
                restCompleted={restCompleted}
                duration={restTimerDuration}
                running={restTimerRunning}
                seconds={restTimerSeconds}
                onStart={startExerciseRest}
                onSecondsChange={setRestTimerSeconds}
                onRunningChange={setRestTimerRunning}
                onExpand={() => {
                  if (restTimerSeconds <= 0 && !restCompleted) startExerciseRest(restTimerDuration);
                  else setRestSessionKey(stepKey);
                  setRestTimerExpanded(true);
                }}
              />
            )}
          </WorkoutStageActionPanel>
        </>
      )}
      </div>
      <WorkoutExercisePicker
        open={exercisePickerOpen && !isWarmup && !isFinishSlide}
        items={buildWorkoutExercisePickerItems(workout, executionSteps, currentExerciseIndex)}
        onClose={() => setExercisePickerOpen(false)}
        onSelectStep={selectExerciseStep}
      />
      {restTimerExpanded && restSessionKey === stepKey && !isWarmup && !isFinishSlide ? (
        <WorkoutRestTimer
          expanded
          duration={restTimerDuration}
          running={restTimerRunning}
          seconds={restTimerSeconds}
          restCompleted={restCompleted}
          onMinimize={() => setRestTimerExpanded(false)}
          onStart={startExerciseRest}
          onSecondsChange={setRestTimerSeconds}
          onRunningChange={setRestTimerRunning}
          showCompletionAction={canAdvanceFromRest}
          completionActionLabel={primaryAction.label}
          completionActionHint="Пропустить остаток отдыха"
          completionActionDisabled={primaryAction.disabled || isSaving}
          onCompletionAction={handlePrimaryAction}
        />
      ) : null}
    </>
  );
}
