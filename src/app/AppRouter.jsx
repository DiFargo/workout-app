import { APP_PAGES } from "./appPages";
import WorkoutModePage from "../features/client/workouts/WorkoutModePage";
import WorkoutListPage from "../features/client/workouts/WorkoutListPage";
import BasicWorkoutQuizPage from "../features/client/workouts/BasicWorkoutQuizPage";
import MeasurementWizardPage from "../features/client/measurements/MeasurementWizardPage";
import WorkoutHistoryPage from "../features/client/workouts/WorkoutHistoryPage";
import WorkoutPlanPage from "../features/client/workouts/WorkoutPlanPage";
import AiCoachPage from "../features/client/ai/AiCoachPage";
import AdminPanelHub from "../components/admin/AdminPanelHub";

export default function AppRouter({
  page,
  appVersion,
  renderClientMainBottomBar,
  workoutModeRemember,
  canUseAdminFeatures,
  canUseTrainerFeatures,
  renderNutritionPage,
  workoutListProps,
  basicWorkoutQuiz,
  onBackToMain,
  onOpenBasicWorkoutQuiz,
  onOpenIndividualWorkouts,
  onSetWorkoutModeRemember,
  onSetPage,
  onOpenTrainingEntry,
  onApplyBasicWorkoutPlan,
  onBasicWorkoutQuizChange,
  onOpenNutrition,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onOpenCabinet,
  openAdminProgramsOverview,
  history,
  historyLoading,
  openHistoryKey,
  historySwipeId,
  historyDeletingId,
  historyDeleteCandidate,
  loadHistory,
  handleHistoryTouchStart,
  handleHistoryTouchEnd,
  requestDeleteOwnHistoryWorkout,
  setOpenHistoryKey,
  closeHistoryDeleteConfirm,
  confirmDeleteOwnHistoryWorkout,
  aiNutritionProfile,
  aiNutritionProfileDraft,
  profileMeasurements,
  profileMeasurementWizardStep,
  profileMeasurementDraft,
  profileMeasurementStatus,
  profileMeasurementSaving,
  setProfileMeasurementDraft,
  setProfileMeasurementStatus,
  setProfileMeasurementWizardStep,
  setProfileMeasurementOpen,
  setProfileActiveTab,
  profileMeasurementReturnTab,
  saveProfileMeasurement,
  onProfileMeasurementCancel,
  selectedAiFeatureId,
  setSelectedAiFeatureId,
  aiNutritionSavedPlan,
  setAiNutritionProfileDraft,
  saveAiNutritionPlan,
  resetAiNutritionPlan,
  nutritionDateKey,
  aiNutritionAdaptedToday,
  setAiNutritionAdaptedToday,
  nutrition,
  plan,
  user,
  workoutPlanRouteHandlers,
  getCompletedWorkoutSet,
  isWorkoutCompletedByHistory
}) {
  if (page === APP_PAGES.ADMIN_PANEL) {
    return (
      <AdminPanelHub
        canUseAdminFeatures={canUseAdminFeatures}
        setPage={onSetPage}
        openAdminProgramsOverview={openAdminProgramsOverview}
      />
    );
  }

  if (page === APP_PAGES.NUTRITION) {
    return renderNutritionPage?.() || null;
  }

  if (page === APP_PAGES.WORKOUTS) {
    return <WorkoutListPage {...workoutListProps} />;
  }

  if (page === APP_PAGES.WORKOUT_MODE) {
    return (
      <WorkoutModePage
        appVersion={appVersion}
        renderClientMainBottomBar={renderClientMainBottomBar}
        workoutModeRemember={workoutModeRemember}
        canUseTrainerFeatures={canUseTrainerFeatures}
        onBackToMain={onBackToMain}
        onOpenBasicWorkoutQuiz={onOpenBasicWorkoutQuiz}
        onOpenIndividualWorkouts={onOpenIndividualWorkouts}
        onToggleWorkoutModeRemember={onSetWorkoutModeRemember}
        onOpenTraining={onOpenTrainingEntry}
        onOpenNutrition={onOpenNutrition}
        onOpenCabinet={onOpenCabinet}
        onOpenTrainerClients={onOpenTrainerClients}
        onOpenTrainerPrograms={onOpenTrainerPrograms}
        onLoadTrainerCabinet={onOpenCabinet}
      />
    );
  }

  if (page === APP_PAGES.BASIC_WORKOUT_QUIZ) {
    return (
      <BasicWorkoutQuizPage
        appVersion={appVersion}
        renderClientMainBottomBar={renderClientMainBottomBar}
        basicWorkoutQuiz={basicWorkoutQuiz}
        onBasicWorkoutQuizChange={onBasicWorkoutQuizChange}
        onGoBackToMode={() => onSetPage(APP_PAGES.WORKOUT_MODE)}
        onApplyBasicWorkoutPlan={onApplyBasicWorkoutPlan}
        canUseTrainerFeatures={canUseTrainerFeatures}
        onGoMain={onBackToMain}
        onOpenTraining={onOpenTrainingEntry}
        onOpenNutrition={onOpenNutrition}
        onOpenCabinet={onOpenCabinet}
        onOpenTrainerClients={onOpenTrainerClients}
        onOpenTrainerPrograms={onOpenTrainerPrograms}
        onLoadTrainerCabinet={onOpenCabinet}
      />
    );
  }

  if (page === APP_PAGES.HISTORY) {
    return (
      <WorkoutHistoryPage
        canUseTrainerFeatures={canUseTrainerFeatures}
        renderClientMainBottomBar={renderClientMainBottomBar}
        history={history}
        historyLoading={historyLoading}
        openHistoryKey={openHistoryKey}
        historySwipeId={historySwipeId}
        historyDeletingId={historyDeletingId}
        historyDeleteCandidate={historyDeleteCandidate}
        goBackToMain={onBackToMain}
        openTrainingEntry={onOpenTrainingEntry}
        onOpenNutrition={onOpenNutrition}
        openProfileCabinet={onOpenCabinet}
        onOpenTrainerClients={onOpenTrainerClients}
        onOpenTrainerPrograms={onOpenTrainerPrograms}
        loadHistory={loadHistory}
        handleHistoryTouchStart={handleHistoryTouchStart}
        handleHistoryTouchEnd={handleHistoryTouchEnd}
        requestDeleteOwnHistoryWorkout={requestDeleteOwnHistoryWorkout}
        setOpenHistoryKey={setOpenHistoryKey}
        closeHistoryDeleteConfirm={closeHistoryDeleteConfirm}
        confirmDeleteOwnHistoryWorkout={confirmDeleteOwnHistoryWorkout}
      />
    );
  }

  if (page === APP_PAGES.AI_COACH) {
    return (
      <AiCoachPage
        onGoBack={onBackToMain}
        onOpenProfile={() => onSetPage(APP_PAGES.PROFILE)}
        selectedAiFeatureId={selectedAiFeatureId}
        setSelectedAiFeatureId={setSelectedAiFeatureId}
        setAiNutritionProfileDraft={setAiNutritionProfileDraft}
        saveAiNutritionPlan={saveAiNutritionPlan}
        resetAiNutritionPlan={resetAiNutritionPlan}
        aiNutritionAdaptedToday={aiNutritionAdaptedToday}
        setAiNutritionAdaptedToday={setAiNutritionAdaptedToday}
        aiNutritionSavedPlan={aiNutritionSavedPlan}
        aiNutritionProfile={aiNutritionProfile}
        aiNutritionProfileDraft={aiNutritionProfileDraft}
        nutrition={nutrition}
        nutritionDateKey={nutritionDateKey}
        history={history}
        plan={plan}
      />
    );
  }

  if (page === APP_PAGES.WORKOUT_PLAN) {
    return (
      <WorkoutPlanPage
        plan={plan}
        history={history}
        user={user}
        onGoBackToMain={onBackToMain}
        onOpenWorkoutIndex={workoutPlanRouteHandlers?.onOpenWorkoutPlanWorkout}
        onOpenWorkouts={workoutPlanRouteHandlers?.onOpenWorkoutPlanWorkouts}
        onOpenPlan={workoutPlanRouteHandlers?.onOpenWorkoutPlan}
        onOpenHistory={workoutPlanRouteHandlers?.onOpenWorkoutPlanHistory}
        getCompletedWorkoutSet={getCompletedWorkoutSet}
        isWorkoutCompletedByHistory={isWorkoutCompletedByHistory}
      />
    );
  }

  if (page === APP_PAGES.MEASUREMENT_WIZARD) {
    return (
      <MeasurementWizardPage
        renderClientMainBottomBar={renderClientMainBottomBar}
        aiNutritionProfile={aiNutritionProfile}
        aiNutritionProfileDraft={aiNutritionProfileDraft}
        profileMeasurements={profileMeasurements}
        profileMeasurementWizardStep={profileMeasurementWizardStep}
        profileMeasurementDraft={profileMeasurementDraft}
        profileMeasurementStatus={profileMeasurementStatus}
        profileMeasurementSaving={profileMeasurementSaving}
        setProfileMeasurementDraft={setProfileMeasurementDraft}
        setProfileMeasurementStatus={setProfileMeasurementStatus}
        setProfileMeasurementWizardStep={setProfileMeasurementWizardStep}
        setProfileMeasurementOpen={setProfileMeasurementOpen}
        setProfileActiveTab={setProfileActiveTab}
        profileMeasurementReturnTab={profileMeasurementReturnTab}
        saveProfileMeasurement={saveProfileMeasurement}
        onNavigateProfilePage={() => {
          if (typeof onProfileMeasurementCancel === "function") {
            onProfileMeasurementCancel();
          }
          onSetPage(APP_PAGES.PROFILE);
        }}
      />
    );
  }

  return null;
}
