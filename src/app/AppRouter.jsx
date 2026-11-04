import { lazy, Suspense } from "react";
import { APP_PAGES } from "./appPages";
import {
  loadAdminLibraryRoute,
  loadAdminPanelHub,
  loadAiCoachPage,
  loadBasicWorkoutQuizPage,
  loadBasicWorkoutTodayPage,
  loadMeasurementWizardPage,
  loadWorkoutHistoryPage,
  loadWorkoutListPage,
  loadWorkoutModePage,
  loadWorkoutPlanPage
} from "./appRouteLoaders";
import AccessDeniedScreen from "../components/common/AccessDeniedScreen";
import RouteFallback from "./RouteFallback";
import RouteContentReady from "./RouteContentReady.jsx";

const AdminLibraryRoute = lazy(loadAdminLibraryRoute);
const AdminPanelHub = lazy(loadAdminPanelHub);
const AiCoachPage = lazy(loadAiCoachPage);
const BasicWorkoutQuizPage = lazy(loadBasicWorkoutQuizPage);
const BasicWorkoutTodayPage = lazy(loadBasicWorkoutTodayPage);
const MeasurementWizardPage = lazy(loadMeasurementWizardPage);
const WorkoutHistoryPage = lazy(loadWorkoutHistoryPage);
const WorkoutListPage = lazy(loadWorkoutListPage);
const WorkoutModePage = lazy(loadWorkoutModePage);
const WorkoutPlanPage = lazy(loadWorkoutPlanPage);

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
  workoutModePreference,
  onBackToMain,
  onOpenSavedBasicWorkoutsOrQuiz,
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
  onAdminLogout,
  onAdminProfileClick,
  openAdminClientsWithFilter,
  openAdminBaseLibrary,
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
  nutritionHistoryReady = true,
  nutritionLoadError,
  loadNutritionHistory,
  plan,
  adminBaseLibraryTab,
  adminAllUsersList,
  adminTrainingTemplates,
  loadAdminTrainingTemplates,
  user,
  workoutPlanRouteHandlers,
  getCompletedWorkoutSet,
  isWorkoutCompletedByHistory
}) {
  function renderLazyRoute(route) {
    const titles = {
      [APP_PAGES.WORKOUTS]: "Тренировки", [APP_PAGES.WORKOUT_MODE]: "Тренировки",
      [APP_PAGES.BASIC_WORKOUT_QUIZ]: "Настройка тренировок", [APP_PAGES.BASIC_WORKOUT_TODAY]: "Тренировка",
      [APP_PAGES.HISTORY]: "История тренировок", [APP_PAGES.WORKOUT_PLAN]: "План тренировок",
      [APP_PAGES.MEASUREMENT_WIZARD]: "Замеры", [APP_PAGES.AI_COACH]: "Помощник",
      [APP_PAGES.ADMIN_PANEL]: "Обзор", [APP_PAGES.ADMIN_LIBRARY]: "Библиотека"
    };
    const activeTab = page === APP_PAGES.MEASUREMENT_WIZARD ? "progress" : page === APP_PAGES.AI_COACH ? "cabinet" : "workouts";
    return <Suspense fallback={<RouteFallback title={titles[page] || "Загрузка раздела"} activeTab={activeTab}
      renderBottomBar={!canUseTrainerFeatures ? renderClientMainBottomBar : undefined} />}>
      <RouteContentReady route={page}>{route}</RouteContentReady>
    </Suspense>;
  }
  if (page === APP_PAGES.ADMIN_LIBRARY) {
    if (!canUseAdminFeatures()) {
      return (
        <AccessDeniedScreen
          message="Базовая библиотека доступна только администратору."
          onBack={() => onSetPage(APP_PAGES.MAIN)}
        />
      );
    }

    return renderLazyRoute(
      <AdminLibraryRoute {...{ adminTrainingTemplates, loadAdminTrainingTemplates, adminBaseLibraryTab, user,
        onSetPage, openAdminClientsWithFilter, openAdminBaseLibrary, onAdminLogout, onAdminProfileClick }} />
    );
  }

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
        openAdminClientsWithFilter={openAdminClientsWithFilter}
        openAdminBaseLibrary={openAdminBaseLibrary}
        openAdminProgramsOverview={openAdminProgramsOverview}
        onLogout={onAdminLogout}
        onProfileClick={onAdminProfileClick}
        user={user}
        adminAllUsersList={adminAllUsersList}
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
        renderClientMainBottomBar={renderClientMainBottomBar}
        workoutModePreference={workoutModePreference}
        workoutModeRemember={workoutModeRemember}
        canUseTrainerFeatures={canUseTrainerFeatures}
        onBackToMain={onBackToMain}
        onOpenBasicWorkouts={onOpenSavedBasicWorkoutsOrQuiz}
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
    return renderLazyRoute(
      <BasicWorkoutQuizPage
        appVersion={appVersion}
        renderClientMainBottomBar={renderClientMainBottomBar}
        workoutModePreference={workoutModePreference}
        workoutModeRemember={workoutModeRemember}
        basicWorkoutQuiz={basicWorkoutQuiz}
        userId={user?.uid || ""}
        startingWeightProfile={aiNutritionProfile || aiNutritionProfileDraft}
        workoutHistory={history}
        profileMeasurements={profileMeasurements}
        workoutHistoryLoading={historyLoading}
        onLoadWorkoutHistory={loadHistory}
        onBasicWorkoutQuizChange={onBasicWorkoutQuizChange}
        onOpenToday={() => onSetPage(APP_PAGES.BASIC_WORKOUT_TODAY)}
        onBackToWorkouts={() => onSetPage(APP_PAGES.WORKOUTS)}
        onOpenIndividualWorkouts={onOpenIndividualWorkouts}
        onOpenBasicWorkouts={onOpenSavedBasicWorkoutsOrQuiz}
        onApplyBasicWorkoutPlan={onApplyBasicWorkoutPlan}
        onToggleWorkoutModeRemember={onSetWorkoutModeRemember}
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

  if (page === APP_PAGES.BASIC_WORKOUT_TODAY) {
    return renderLazyRoute(
      <BasicWorkoutTodayPage
        renderClientMainBottomBar={renderClientMainBottomBar}
        basicWorkoutQuiz={basicWorkoutQuiz}
        startingWeightProfile={aiNutritionProfile || aiNutritionProfileDraft}
        workoutHistory={history}
        profileMeasurements={profileMeasurements}
        workoutHistoryLoading={historyLoading}
        onLoadWorkoutHistory={loadHistory}
        onBasicWorkoutQuizChange={onBasicWorkoutQuizChange}
        onApplyBasicWorkoutPlan={onApplyBasicWorkoutPlan}
        onOpenLongPlan={() => onSetPage(APP_PAGES.BASIC_WORKOUT_QUIZ)}
        onBackToWorkouts={() => onSetPage(APP_PAGES.WORKOUTS)}
        onOpenTraining={onOpenTrainingEntry}
        userId={user?.uid || ""}
        canUseTrainerFeatures={canUseTrainerFeatures}
        onGoMain={onBackToMain}
        onOpenNutrition={onOpenNutrition}
        onOpenCabinet={onOpenCabinet}
        onOpenTrainerClients={onOpenTrainerClients}
        onOpenTrainerPrograms={onOpenTrainerPrograms}
        onLoadTrainerCabinet={onOpenCabinet}
      />
    );
  }

  if (page === APP_PAGES.HISTORY) {
    return renderLazyRoute(
      <WorkoutHistoryPage
        onOpenPlan={workoutPlanRouteHandlers?.onOpenWorkoutPlan}
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
    if (!nutritionHistoryReady || historyLoading) return <RouteFallback title="Помощник" activeTab="cabinet"
      renderBottomBar={renderClientMainBottomBar} error={nutritionLoadError} onRetry={loadNutritionHistory} />;
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
        renderClientMainBottomBar={renderClientMainBottomBar}
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
