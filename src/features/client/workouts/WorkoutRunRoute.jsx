import { POST_WORKOUT_FEEDBACK_OPTIONS } from "../../../domain/workoutPresentation";
import { getWorkoutCompletion } from "../../../utils/auditSafety";
import FirstSetupOnboarding from "../../auth/FirstSetupOnboarding";
import {
  PostWorkoutFeedbackDialog,
  WorkoutExitDialog,
  WorkoutIncompleteDialog,
  WorkoutReadinessDialog
} from "../../../components/workout/WorkoutDialogs";
import {
  WorkoutFullscreenVideoOverlay,
  WorkoutNotFoundPage,
  WorkoutRunTopControls
} from "./WorkoutRunOverlays";
import WorkoutRunStageView from "./WorkoutRunStageView";

export default function WorkoutRunRoute({
  aiNutritionProfileDraft,
  applyWorkoutReadiness,
  closeWorkoutExerciseModal,
  currentExerciseIndex,
  deckRef,
  endPerformanceCheck,
  exerciseHistoryOpenId,
  exerciseNoteOpenId,
  exerciseTechniqueOpenId,
  exerciseValidationMessage,
  firstSetupSaveStatus,
  fullscreenVideo,
  getLastExerciseText,
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
  lastExerciseResults,
  leaveWorkoutToPlan,
  logout,
  normalizeExercise,
  onboardingStep,
  openVideoId,
  openWorkoutExerciseModal,
  pendingWorkoutFeedback,
  plan,
  postWorkoutFeedback,
  postWorkoutFeedbackOpen,
  requestLeaveWorkout,
  restTimerDuration,
  restTimerSeconds,
  saveWorkoutToFirebase,
  selectedWorkoutId,
  setCurrentExerciseIndex,
  setExerciseHistoryOpenId,
  setExerciseNoteOpenId,
  setExerciseTechniqueOpenId,
  setFullscreenVideo,
  setInlinePlayingVideoId,
  setInlineVideoControlsVisible,
  setIsWorkoutSaved,
  setOnboardingStep,
  setOpenVideoId,
  setPendingWorkoutFeedback,
  setPostWorkoutFeedback,
  setPostWorkoutFeedbackOpen,
  setRestTimerRunning,
  setRestTimerSeconds,
  setWorkoutReadinessPending,
  setSelectedWorkoutId,
  setShowWorkoutSavedCard,
  setVideoLoadingId,
  setVideoRetryToken,
  setWarmupTimerRunning,
  setWarmupTimerSeconds,
  setWarmupTimerPreset,
  setWorkoutClientComment,
  setWorkoutExitPromptOpen,
  setWorkoutFinishedAt,
  setWorkoutIncompleteConfirmOpen,
  setWorkoutStarted,
  setWorkoutStartedAt,
  setProfileDraft,
  showAppError,
  showFirstSetupOnboarding,
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
  workoutDraftRestorePrompt,
  workoutDurationText,
  workoutExitPromptOpen,
  workoutFinishedAt,
  workoutHistorySyncState,
  workoutIncompleteConfirmOpen,
  workoutReadiness,
  workoutReadinessOpen,
  workoutReadinessPending,
  workoutStarted,
  onFirstSetupSubmit
}) {
  if (!workout) {
    return <WorkoutNotFoundPage onBackToMenu={() => setSelectedWorkoutId(null)} />;
  }

  const isFinishSlideActive =
    workoutStarted && currentExerciseIndex === workout.exercises.length + 1;
  const shouldShowTopBackButton = isWorkoutSaved === true && !isFinishSlideActive;
  const returnFromSavedWorkout = () => {
    setSelectedWorkoutId(null);
    setOpenVideoId(null);
    setCurrentExerciseIndex(0);
    setWorkoutStarted(false);
    setWorkoutStartedAt(null);
    setWorkoutFinishedAt(null);
    setIsWorkoutSaved(false);
    setShowWorkoutSavedCard(false);
  };

  return (
    <div className={`app workoutRunPage ${workoutStarted && !isWorkoutSaved ? "workoutRunPageNoHeader" : ""}`}>
      <WorkoutRunTopControls
        isSaving={isSaving}
        showBackButton={shouldShowTopBackButton && isWorkoutSaved}
        onExit={requestLeaveWorkout}
        onBack={returnFromSavedWorkout}
      />

      <WorkoutRunStageView
        closeWorkoutExerciseModal={closeWorkoutExerciseModal}
        currentExerciseIndex={currentExerciseIndex}
        deckRef={deckRef}
        exerciseHistoryOpenId={exerciseHistoryOpenId}
        exerciseNoteOpenId={exerciseNoteOpenId}
        exerciseTechniqueOpenId={exerciseTechniqueOpenId}
        endPerformanceCheck={endPerformanceCheck}
        getLastExerciseText={getLastExerciseText}
        goBackToMain={goBackToMain}
        goToNextExercise={goToNextExercise}
        goToPreviousExercise={goToPreviousExercise}
        handleExerciseTouchEnd={handleExerciseTouchEnd}
        handleExerciseTouchMove={handleExerciseTouchMove}
        handleExerciseTouchStart={handleExerciseTouchStart}
        history={history}
        inlinePlayingVideoId={inlinePlayingVideoId}
        inlineVideoControlsTimerRef={inlineVideoControlsTimerRef}
        inlineVideoControlsVisible={inlineVideoControlsVisible}
        isSaving={isSaving}
        isWorkoutSaved={isWorkoutSaved}
        lastExerciseResults={lastExerciseResults}
        normalizeExercise={normalizeExercise}
        openVideoId={openVideoId}
        openWorkoutExerciseModal={openWorkoutExerciseModal}
        plan={plan}
        postWorkoutFeedback={postWorkoutFeedback}
        requestLeaveWorkout={requestLeaveWorkout}
        restTimerDuration={restTimerDuration}
        restTimerSeconds={restTimerSeconds}
        saveWorkoutToFirebase={saveWorkoutToFirebase}
        setExerciseHistoryOpenId={setExerciseHistoryOpenId}
        setExerciseNoteOpenId={setExerciseNoteOpenId}
        setExerciseTechniqueOpenId={setExerciseTechniqueOpenId}
        setFullscreenVideo={setFullscreenVideo}
        setInlinePlayingVideoId={setInlinePlayingVideoId}
        setInlineVideoControlsVisible={setInlineVideoControlsVisible}
        setIsWorkoutSaved={setIsWorkoutSaved}
        setOpenVideoId={setOpenVideoId}
        setPostWorkoutFeedbackOpen={setPostWorkoutFeedbackOpen}
        setRestTimerRunning={setRestTimerRunning}
        setRestTimerSeconds={setRestTimerSeconds}
        setShowWorkoutSavedCard={setShowWorkoutSavedCard}
        setVideoLoadingId={setVideoLoadingId}
        setVideoRetryToken={setVideoRetryToken}
        setWarmupTimerRunning={setWarmupTimerRunning}
        setWarmupTimerSeconds={setWarmupTimerSeconds}
        setWarmupTimerPreset={setWarmupTimerPreset}
        setWorkoutClientComment={setWorkoutClientComment}
        showAppError={showAppError}
        showInlineVideoControlsTemporarily={showInlineVideoControlsTemporarily}
        showWorkoutSavedCard={showWorkoutSavedCard}
        startPerformanceCheck={startPerformanceCheck}
        startRestTimer={startRestTimer}
        swipeDirection={swipeDirection}
        swipeOffset={swipeOffset}
        toggleWarmupStep={toggleWarmupStep}
        toggleWorkoutSetCompleted={toggleWorkoutSetCompleted}
        updateExerciseNote={updateExerciseNote}
        updateSet={updateSet}
        videoLoadingId={videoLoadingId}
        videoRetryToken={videoRetryToken}
        warmupCompletedSteps={warmupCompletedSteps}
        warmupTimerDuration={warmupTimerDuration}
        warmupTimerRunning={warmupTimerRunning}
        warmupTimerSeconds={warmupTimerSeconds}
        workout={workout}
        workoutClientComment={workoutClientComment}
        workoutDurationText={workoutDurationText}
        workoutFinishedAt={workoutFinishedAt}
        workoutHistorySyncState={workoutHistorySyncState}
        workoutReadiness={workoutReadiness}
        workoutStarted={workoutStarted}
      />

      {exerciseValidationMessage && (
        <div className="workoutExerciseValidationToast" role="alert">
          <span aria-hidden="true">!</span>
          <strong>{exerciseValidationMessage}</strong>
        </div>
      )}

      <WorkoutReadinessDialog
        open={workoutReadinessOpen}
        selectedWorkoutId={selectedWorkoutId}
        workoutStarted={workoutStarted}
        pendingOption={workoutReadinessPending}
        onSelectOption={setWorkoutReadinessPending}
        onBack={leaveWorkoutToPlan}
        onApply={applyWorkoutReadiness}
      />

      <WorkoutExitDialog
        open={Boolean(workoutExitPromptOpen && !workoutDraftRestorePrompt && !fullscreenVideo)}
        onStay={() => setWorkoutExitPromptOpen(false)}
        onLeave={() => {
          setWorkoutExitPromptOpen(false);
          leaveWorkoutToPlan();
        }}
      />

      <WorkoutIncompleteDialog
        open={Boolean(workoutIncompleteConfirmOpen && !fullscreenVideo)}
        completion={getWorkoutCompletion(workout)}
        onContinue={() => {
          setWorkoutIncompleteConfirmOpen(false);
          setPendingWorkoutFeedback(null);
        }}
        onSave={() => {
          const feedback = pendingWorkoutFeedback;
          setWorkoutIncompleteConfirmOpen(false);
          setPendingWorkoutFeedback(null);
          saveWorkoutToFirebase(feedback, true);
        }}
      />

      <PostWorkoutFeedbackDialog
        open={postWorkoutFeedbackOpen}
        options={POST_WORKOUT_FEEDBACK_OPTIONS}
        isSaving={isSaving}
        onSelect={(option) => {
          setPostWorkoutFeedback(option);
          setPostWorkoutFeedbackOpen(false);
          setCurrentExerciseIndex(workout.exercises.length + 1);
        }}
      />

      <FirstSetupOnboarding
        open={showFirstSetupOnboarding}
        onboardingStep={onboardingStep}
        profileDraft={aiNutritionProfileDraft}
        saveStatus={firstSetupSaveStatus}
        setOnboardingStep={setOnboardingStep}
        setProfileDraft={setProfileDraft}
        onSubmit={onFirstSetupSubmit}
        onExit={logout}
      />

      <WorkoutFullscreenVideoOverlay
        videoSrc={fullscreenVideo}
        onClose={() => setFullscreenVideo(null)}
        onVideoError={() => {
          setFullscreenVideo(null);
          showAppError("load", "Видео упражнения не поддерживается или временно недоступно.");
        }}
      />
    </div>
  );
}
