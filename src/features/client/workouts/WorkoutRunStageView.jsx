import { formatCompactTimer, getExerciseTechniqueHint } from "../../../domain/workoutPresentation";
import { exerciseUsesExternalWeight } from "../../../utils/auditSafety";
import WorkoutExerciseModals from "./WorkoutExerciseModals";
import WorkoutExerciseSets from "./WorkoutExerciseSets";
import WorkoutExerciseSupport from "./WorkoutExerciseSupport";
import WorkoutExerciseVideoFrame from "./WorkoutExerciseVideoFrame";
import WorkoutFinishStage from "./WorkoutFinishStage";
import WorkoutRestTimer from "./WorkoutRestTimer";
import WorkoutStageActionPanel from "./WorkoutStageActionPanel";
import { WorkoutStageHeading } from "./WorkoutRunOverlays";
import { WorkoutWarmupBody, WorkoutWarmupHeader } from "./WorkoutWarmupStage";
import { buildWorkoutRunStageModel } from "./workoutRunStageModel";

export default function WorkoutRunStageView({
  closeWorkoutExerciseModal,
  currentExerciseIndex,
  deckRef,
  exerciseHistoryOpenId,
  exerciseNoteOpenId,
  exerciseTechniqueOpenId,
  exerciseValidationMessage,
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
  repsInputRefs,
  requestLeaveWorkout,
  restTimerDuration,
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
  weightInputRefs,
  workout,
  workoutClientComment,
  workoutDurationText,
  workoutFinishedAt,
  workoutHistorySyncState,
  workoutReadiness,
  workoutStarted,
  setWorkoutClientComment
}) {
  const {
    completedExercisesCount,
    exercise,
    exerciseAiWeightAdjustments,
    exerciseVideoFailed,
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

  if (!exercise && !isFinishSlide && !isStartSlide) {
    return (
      <div className="exercise">
        <h3>Упражнение не найдено</h3>
      </div>
    );
  }

  return (
    <div
      ref={deckRef}
      className="exerciseDeck workoutStageDeck"
      onTouchStart={handleExerciseTouchStart}
      onTouchMove={handleExerciseTouchMove}
      onTouchEnd={handleExerciseTouchEnd}
    >
      <WorkoutStageHeading
        currentExerciseIndex={currentExerciseIndex}
        exercise={exercise}
        exerciseCount={workout.exercises.length}
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

            saveWorkoutToFirebase(null);
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
            className={`exercise exerciseSlideCard workoutStageCard ${
              exercise.id === "warmup" ? "warmupExerciseCard" : ""
            } ${
              exercise.id !== "warmup" ? "workoutExerciseCard" : ""
            } ${
              openVideoId === exercise.id ? "videoOpenCard" : ""
            } ${
              swipeDirection === "up"
                ? "slideFromBottom"
                : swipeDirection === "down"
                  ? "slideFromTop"
                  : ""
            }`}
            style={{
              transform: swipeOffset
                ? `translateY(${swipeOffset}px)`
                : undefined
            }}
          >
            {exercise.id === "warmup" ? (
              <WorkoutWarmupHeader
                completedStepsCount={warmupCompletedSteps.length}
                dayLabel={finishPresentation.day}
                stepCount={warmupSteps.length}
              />
            ) : (
              <>
                <div className="workoutExerciseMeta">
                  <span>{finishPresentation.day} · Упражнение {currentExerciseIndex} из {workout.exercises.length}</span>
                  <b>{String(currentExerciseIndex).padStart(2, "0")}</b>
                </div>

                <WorkoutExerciseVideoFrame
                  exercise={exercise}
                  exerciseVideoFailed={exerciseVideoFailed}
                  fallbackHint={getExerciseTechniqueHint(exercise.name)}
                  inlinePlayingVideoId={inlinePlayingVideoId}
                  inlineVideoControlsVisible={inlineVideoControlsVisible}
                  onFullscreenVideo={setFullscreenVideo}
                  onInlineVideoPlayFailed={() => {
                    showAppError("load", "Не получилось запустить видео упражнения.");
                  }}
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
              </>
            )}

            {exercise.id === "warmup" ? (
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
              <WorkoutExerciseSets
                exercise={exercise}
                exerciseValidationMessage={exerciseValidationMessage}
                hasExternalWeight={exerciseUsesExternalWeight(exercise)}
                onToggleSetCompleted={toggleWorkoutSetCompleted}
                onUpdateSet={updateSet}
                repsInputRefs={repsInputRefs}
                sharedExerciseAiWeightAdjustment={sharedExerciseAiWeightAdjustment}
                weightInputRefs={weightInputRefs}
              />
            )}

            {exercise.id !== "warmup" && (
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
                onToggleHistory={() => setExerciseHistoryOpenId((current) => current === exercise.id ? "" : exercise.id)}
                readinessVolumeText={workoutReadiness?.volumeText}
              />
            )}

            <WorkoutExerciseModals
              exercise={exercise}
              noteOpen={exerciseNoteOpenId === exercise.id}
              onCloseNote={() => closeWorkoutExerciseModal(setExerciseNoteOpenId)}
              onCloseTechnique={() => closeWorkoutExerciseModal(setExerciseTechniqueOpenId)}
              onUpdateNote={updateExerciseNote}
              techniqueHint={getExerciseTechniqueHint(exercise.name)}
              techniqueOpen={exerciseTechniqueOpenId === exercise.id}
            />

            {exercise.id !== "warmup" && restTimerSeconds > 0 && (
              <WorkoutRestTimer
                activeDuration={restTimerDuration}
                onAddTime={() => setRestTimerSeconds((current) => current + 30)}
                onSkip={() => {
                  setRestTimerRunning(false);
                  setRestTimerSeconds(0);
                }}
                onStart={startRestTimer}
                timerText={formatCompactTimer(restTimerSeconds)}
              />
            )}
          </div>

          <WorkoutStageActionPanel
            isLastExercise={currentExerciseIndex >= workout.exercises.length}
            isWarmup={exercise.id === "warmup"}
            onNext={goToNextExercise}
            onPrevious={goToPreviousExercise}
            onWarmupBack={requestLeaveWorkout}
          />
        </>
      )}
    </div>
  );
}
