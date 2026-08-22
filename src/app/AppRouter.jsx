import { lazy, Suspense } from "react";
import { APP_PAGES } from "./appPages";
import {
  loadAdminBaseLibrary,
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
import AdminWorkspace from "../components/admin/AdminWorkspace";
import RouteFallback from "./RouteFallback";
import { BASIC_WORKOUT_EXERCISE_LIBRARY } from "../data/basicWorkoutExerciseLibrary";
import { BASIC_WORKOUT_PLANS } from "../data/basicWorkoutPlans";

const AdminBaseLibrary = lazy(loadAdminBaseLibrary);
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
  plan,
  adminBaseLibraryTab,
  adminAllUsersList,
  adminTrainingTemplates,
  user,
  workoutPlanRouteHandlers,
  getCompletedWorkoutSet,
  isWorkoutCompletedByHistory
}) {
  if (page === APP_PAGES.ADMIN_LIBRARY) {
    if (!canUseAdminFeatures()) {
      return (
        <AccessDeniedScreen
          message="Базовая библиотека доступна только администратору."
          onBack={() => onSetPage(APP_PAGES.MAIN)}
        />
      );
    }

    const adminBaseProgramTemplates = Array.isArray(adminTrainingTemplates)
      ? adminTrainingTemplates.filter((template) => template?.ownerRole === "admin")
      : [];
    const baseProgramTemplates = [
      ...Object.values(BASIC_WORKOUT_PLANS),
      ...adminBaseProgramTemplates
    ];
    const activeAdminSection = adminBaseLibraryTab === "exercises" ? "exercises" : "programs";
    const openAdminSection = (sectionId) => {
      if (sectionId === "overview") {
        onSetPage(APP_PAGES.ADMIN_PANEL);
        return;
      }

      if (sectionId === "users") {
        if (typeof openAdminClientsWithFilter === "function") {
          openAdminClientsWithFilter("all");
        } else {
          onSetPage(APP_PAGES.ADMIN_USERS);
        }
        return;
      }

      if (sectionId === "programs" || sectionId === "exercises") {
        if (typeof openAdminBaseLibrary === "function") {
          openAdminBaseLibrary(sectionId);
        }
      }
    };

    return renderLazyRoute(
      <AdminWorkspace
        activeSection={activeAdminSection}
        adminMeta="Системное управление"
        adminName={user?.displayName || user?.name || user?.email?.split("@")[0] || ""}
        adminEmail={user?.email || ""}
        headerTitle="Базовые программы и упражнения"
        onLogout={onAdminLogout}
        onProfileClick={onAdminProfileClick}
        onSectionChange={openAdminSection}
        subtitle="Общие программы и упражнения приложения"
        title="Админка"
      >
        <AdminBaseLibrary
          key={adminBaseLibraryTab}
          embedded
          programTemplates={baseProgramTemplates}
          exercises={BASIC_WORKOUT_EXERCISE_LIBRARY}
          initialTab={adminBaseLibraryTab}
          onBack={() => onSetPage(APP_PAGES.ADMIN_PANEL)}
        />
      </AdminWorkspace>
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
        startingWeightProfile={aiNutritionProfile || aiNutritionProfileDraft}
        workoutHistory={history}
        onBasicWorkoutQuizChange={onBasicWorkoutQuizChange}
        onGoBackToMode={() => onSetPage(APP_PAGES.WORKOUT_MODE)}
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

  if (page === APP_PAGES.HISTORY) {
    return renderLazyRoute(
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
