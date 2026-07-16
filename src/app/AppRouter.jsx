import { lazy, Suspense } from "react";
import { APP_PAGES } from "./appPages";
import {
  loadAdminPanelHub,
  loadAiCoachPage,
  loadBasicWorkoutQuizPage,
  loadMeasurementWizardPage,
  loadWorkoutHistoryPage,
  loadWorkoutListPage,
  loadWorkoutModePage,
  loadWorkoutPlanPage
} from "./appRouteLoaders";
import AccessDeniedScreen from "../components/common/AccessDeniedScreen";
import RouteFallback from "./RouteFallback";

const AdminPanelHub = lazy(loadAdminPanelHub);
const AiCoachPage = lazy(loadAiCoachPage);
const BasicWorkoutQuizPage = lazy(loadBasicWorkoutQuizPage);
const MeasurementWizardPage = lazy(loadMeasurementWizardPage);
const WorkoutHistoryPage = lazy(loadWorkoutHistoryPage);
const WorkoutListPage = lazy(loadWorkoutListPage);
const WorkoutModePage = lazy(loadWorkoutModePage);
const WorkoutPlanPage = lazy(loadWorkoutPlanPage);

function renderLazyRoute(route) {
  return <Suspense fallback={<RouteFallback />}>{route}</Suspense>;
}

export default function AppRouter({
  page,
  appVersion,
  workoutModeRemember,
  canUseAdminFeatures,
  renderNutritionPage,
  workoutListProps,
  basicWorkoutQuiz,
  workoutModePreference,
  onBackToMain,
  onOpenSavedBasicWorkoutsOrQuiz,
  onOpenIndividualWorkouts,
  onSetWorkoutModeRemember,
  onSetPage,
  onApplyBasicWorkoutPlan,
  onBasicWorkoutQuizChange,
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
    if (!canUseAdminFeatures()) {
      return (
        <AccessDeniedScreen
          message="Админ-панель доступна только главному администратору."
          onBack={() => onSetPage(APP_PAGES.MAIN)}
        />
      );
    }

    return renderLazyRoute(
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
    return renderLazyRoute(<WorkoutListPage {...workoutListProps} />);
  }

  if (page === APP_PAGES.WORKOUT_MODE) {
    return renderLazyRoute(
      <WorkoutModePage
        appVersion={appVersion}
        workoutModePreference={workoutModePreference}
        workoutModeRemember={workoutModeRemember}
        onBackToMain={onBackToMain}
        onOpenBasicWorkouts={onOpenSavedBasicWorkoutsOrQuiz}
        onOpenIndividualWorkouts={onOpenIndividualWorkouts}
        onToggleWorkoutModeRemember={onSetWorkoutModeRemember}
      />
    );
  }

  if (page === APP_PAGES.BASIC_WORKOUT_QUIZ) {
    return renderLazyRoute(
      <BasicWorkoutQuizPage
        appVersion={appVersion}
        workoutModePreference={workoutModePreference}
        workoutModeRemember={workoutModeRemember}
        basicWorkoutQuiz={basicWorkoutQuiz}
        onBasicWorkoutQuizChange={onBasicWorkoutQuizChange}
        onGoBackToMode={() => onSetPage(APP_PAGES.WORKOUT_MODE)}
        onOpenIndividualWorkouts={onOpenIndividualWorkouts}
        onOpenBasicWorkouts={onOpenSavedBasicWorkoutsOrQuiz}
        onApplyBasicWorkoutPlan={onApplyBasicWorkoutPlan}
        onToggleWorkoutModeRemember={onSetWorkoutModeRemember}
      />
    );
  }

  if (page === APP_PAGES.HISTORY) {
    return renderLazyRoute(
      <WorkoutHistoryPage
        history={history}
        historyLoading={historyLoading}
        openHistoryKey={openHistoryKey}
        historySwipeId={historySwipeId}
        historyDeletingId={historyDeletingId}
        historyDeleteCandidate={historyDeleteCandidate}
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
    return renderLazyRoute(
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
    return renderLazyRoute(
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
    return renderLazyRoute(
      <MeasurementWizardPage
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
