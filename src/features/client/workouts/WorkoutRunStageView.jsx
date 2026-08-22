import { useState } from "react";

import { formatCompactTimer, getExerciseTechniqueHint } from "../../../domain/workoutPresentation";
import { exerciseUsesExternalWeight } from "../../../utils/auditSafety";
import { getBasicWorkoutAlternatives } from "../../../utils/basicWorkoutAlternatives";
import { getTrainerExerciseAlternatives } from "../../../utils/trainerExerciseAlternatives";
import {
  applyBasicWorkoutExerciseOverride,
  getBasicWorkoutExerciseTechniqueHint
} from "../../../utils/basicWorkoutExercisePresentation";
import BasicWorkoutExerciseExplainer from "./BasicWorkoutExerciseExplainer";
import WorkoutExerciseModals from "./WorkoutExerciseModals";
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
  handleExerciseTouchEnd,
  handleExerciseTouchMove,
  handleExerciseTouchStart,
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
    getExerciseTechniqueHint(exercise?.name)
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
  const shouldShowGroupRest = !exercise?.runtimeGroup || (
    groupExercisePosition >= (groupExerciseCount || 1)
  );
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
      onOpenTechnique={(event) => openWorkoutExerciseModal(
        setExerciseTechniqueOpenId,
        exercise.id,
        event.currentTarget
      )}
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
      onTouchStart={handleExerciseTouchStart}
      onTouchMove={handleExerciseTouchMove}
      onTouchEnd={handleExerciseTouchEnd}
    >
      <WorkoutStageHeading
        exercise={exercise}
        isFinishSlide={isFinishSlide}
        isStartSlide={isStartSlide}
        isWorkoutSaved={isWorkoutSaved}
        onOpenTechnique={(event) => openWorkoutExerciseModal(
          setExerciseTechniqueOpenId,
          exercise.id,
          event.currentTarget
        )}
      />

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
          {!isWarmup && (
            <div className={styles.exerciseProgressSlot}>
              <div className={`${styles.exerciseMeta}${groupProgressLabel ? ` ${styles.groupExerciseMeta}` : ""}`} data-testid="workout-exercise-progress">
                <span className={styles.exerciseProgressText}>{groupProgressLabel || `${currentExerciseIndex} из ${executionSteps.length}`}</span>
              </div>
            </div>
          )}

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
                exercise={exercise}
                onOpenSwap={exerciseAlternatives.length ? () => setExerciseSwapOpenId(exercise.id) : undefined}
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
              <section className={styles.planSection} data-testid="workout-plan-section">
                <h2>План на сегодня</h2>
                <div className={styles.planCard} data-testid="workout-plan-card">
                  <WorkoutExerciseSets
                    exercise={exercise}
                    hasExternalWeight={exerciseUsesExternalWeight(exercise)}
                    onToggleSetCompleted={toggleWorkoutSetCompleted}
                    onUpdateSet={updateSet}
                    sharedExerciseAiWeightAdjustment={sharedExerciseAiWeightAdjustment}
                    showTitle={false}
                    visibleSetIndexes={Number.isInteger(exercise.runtimeSetIndex) ? [exercise.runtimeSetIndex] : null}
                  />

                  <WorkoutExerciseSupport
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
                  />

                  <WorkoutExerciseModals
                    alternatives={exerciseAlternatives}
                    exercise={exercise}
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

            {!isWarmup && shouldShowGroupRest && (
              <WorkoutRestTimer
                duration={restTimerDuration}
                running={restTimerRunning}
                seconds={restTimerSeconds}
                onStart={startRestTimer}
                onSecondsChange={setRestTimerSeconds}
                onRunningChange={setRestTimerRunning}
              />
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
          />
        </>
      )}
    </div>
  );
}
