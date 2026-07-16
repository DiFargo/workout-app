import TrainerWorkspace from "../../components/trainer/TrainerWorkspace";
import TrainerClientOverviewModals from "./TrainerClientOverviewModals";

export default function TrainerDashboardWorkspaceRoute({
  APP_VERSION,
  adminClientEvents,
  adminClientHistory,
  adminClientMeasurements,
  adminNewTaskDueDate,
  adminNewTaskTitle,
  adminClientProgressPhotos,
  adminClientStatus,
  adminClientTasks,
  adminClientTelegramMessages,
  adminTaskComposerOpen,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  adminTrainerNote,
  adminUsersSelectedTab,
  assignSavedProgramToClient,
  attentionCount,
  canUseAdminFeatures,
  clientNutritionDays,
  createAdminClientTask,
  getAdminClientGoalLabel,
  getClientActivityStatus,
  getTrainerNextCreateClientState,
  handleTrainerClientAction,
  logout,
  navigateTrainerNext,
  openClientTelegramConnection,
  openTrainerNextClient,
  refreshPage,
  saveTrainerClientNutritionPlan,
  saveTrainerClientNotificationSettings,
  loadTrainerSubscriptionNotificationSettings,
  saveTrainerSubscriptionNotificationSettings,
  saveTrainerClientWorkoutSchedule,
  saveWorkoutsToFirebase,
  selectedClient,
  selectedEffectiveNutritionGoals,
  selectedProfile,
  sendAdminTestWorkoutReminder,
  sendTrainerClientMessage,
  setAdminClientPageOpen,
  setAdminClientStatus,
  setAdminNewTaskDueDate,
  setAdminNewTaskTitle,
  setAdminSelectedTemplateId,
  setAdminTaskComposerOpen,
  setAdminUsersSelectedTab,
  setTrainerNextSection,
  sortWorkoutDays,
  plan,
  telegramProfile,
  trainerActionCenter,
  trainerClientSummariesLoading,
  trainerSubscriptionNotificationSettings,
  trainerExerciseLibraryItems,
  trainerName,
  trainerNextActiveSection,
  trainerNextMode,
  trainerNextSelectedSummary,
  selectedClientSnapshot,
  selectedLastWorkoutReview,
  trainerNextSummaries,
  trainerNextWorkspaceHandlers,
  trainerNutritionPlanOptions,
  trainerStatusCounts,
  usersList,
  adminExerciseVideoUploadingId
}) {
  return (
    <>
      <TrainerWorkspace
      appVersion={APP_VERSION}
      mode={trainerNextMode}
      activeSection={trainerNextActiveSection}
      onNavigate={navigateTrainerNext}
      onRefresh={refreshPage}
      trainerName={trainerName}
      trainerAvatar={telegramProfile.avatarUrl}
      clients={usersList}
      clientSummaries={trainerNextSummaries}
      actionCenter={trainerActionCenter}
      summariesLoading={trainerClientSummariesLoading}
      counts={{
        active: trainerStatusCounts.active,
        attention: attentionCount
      }}
      selectedClient={selectedClient}
      selectedProfile={{
        ...selectedProfile,
        goalLabel: getAdminClientGoalLabel(selectedProfile?.goal)
      }}
      selectedSummary={{
        ...trainerNextSelectedSummary,
        status: getClientActivityStatus(trainerNextSelectedSummary)
      }}
      selectedClientSnapshot={selectedClientSnapshot}
      selectedLastWorkoutReview={selectedLastWorkoutReview}
      activeClientTab={adminUsersSelectedTab}
      onClientTabChange={(tab) => {
        setAdminUsersSelectedTab(tab);
        setTrainerNextSection("client");
      }}
      onOpenClient={openTrainerNextClient}
      onCloseClient={() => {
        setAdminClientPageOpen(false);
        setTrainerNextSection("clients");
      }}
      onCreateClient={getTrainerNextCreateClientState().onOpen}
      createClientState={getTrainerNextCreateClientState()}
      measurements={adminClientMeasurements}
      history={adminClientHistory}
      exerciseProgressReviews={adminClientEvents}
      nutritionDays={clientNutritionDays}
      nutritionGoals={selectedEffectiveNutritionGoals}
      nutritionPlanOptions={trainerNutritionPlanOptions}
      photos={adminClientProgressPhotos}
      tasks={adminClientTasks}
      trainerNote={adminTrainerNote}
      onGenerateNutritionPlan={() => setAdminClientStatus("Параметры AI-плана открыты в разделе питания.")}
      onSaveNutritionPlan={saveTrainerClientNutritionPlan}
      onSaveNotifications={saveTrainerClientNotificationSettings}
      trainerSubscriptionNotificationSettings={trainerSubscriptionNotificationSettings}
      onLoadTrainerSubscriptionNotifications={loadTrainerSubscriptionNotificationSettings}
      onSaveTrainerSubscriptionNotifications={saveTrainerSubscriptionNotificationSettings}
      onTestNotification={() => sendAdminTestWorkoutReminder(selectedClient)}
      onConnectTelegram={openClientTelegramConnection}
      onSendMessage={sendTrainerClientMessage}
      telegramMessages={adminClientTelegramMessages}
      onCreateTask={() => setAdminTaskComposerOpen(true)}
      onClientAction={handleTrainerClientAction}
      canDeleteClients={canUseAdminFeatures()}
      onResolveExerciseProgress={(payload) => handleTrainerClientAction("resolve_exercise_progress", selectedClient, payload)}
      workouts={sortWorkoutDays(plan.workouts || [])}
      exerciseLibrary={trainerExerciseLibraryItems}
      programTemplates={adminTrainingTemplates}
      selectedProgramId={adminSelectedTemplateId}
      onSelectProgram={setAdminSelectedTemplateId}
      onAssignProgram={() => assignSavedProgramToClient(selectedClient?.id, adminSelectedTemplateId)}
      onSaveWorkoutSchedule={(dates) => saveTrainerClientWorkoutSchedule(dates, selectedClient)}
      programStatus={adminClientStatus}
      onUpdateWorkout={trainerNextWorkspaceHandlers.onUpdateWorkout}
      onUpdateExercise={trainerNextWorkspaceHandlers.onUpdateExercise}
      onSaveExerciseProgressAdjustment={trainerNextWorkspaceHandlers.onSaveExerciseProgressAdjustment}
      onUpdateExerciseSet={trainerNextWorkspaceHandlers.onUpdateExerciseSet}
      onAddExerciseSet={trainerNextWorkspaceHandlers.onAddExerciseSet}
      onRemoveExerciseSet={trainerNextWorkspaceHandlers.onRemoveExerciseSet}
      onAddExercise={trainerNextWorkspaceHandlers.onAddExercise}
      onRemoveExercise={trainerNextWorkspaceHandlers.onRemoveExercise}
      onDuplicateExercise={trainerNextWorkspaceHandlers.onDuplicateExercise}
      onMoveExercise={trainerNextWorkspaceHandlers.onMoveExercise}
      onUploadExerciseVideo={trainerNextWorkspaceHandlers.onUploadExerciseVideo}
      exerciseVideoUploadingId={adminExerciseVideoUploadingId}
      onAddDay={trainerNextWorkspaceHandlers.onAddDay}
      onDuplicateDay={trainerNextWorkspaceHandlers.onDuplicateDay}
      onRemoveDay={trainerNextWorkspaceHandlers.onRemoveDay}
      onSaveWorkouts={saveWorkoutsToFirebase}
      onLogout={logout}
      />
      <TrainerClientOverviewModals
        adminClientProgressPhotos={adminClientProgressPhotos}
        adminNewTaskDueDate={adminNewTaskDueDate}
        adminNewTaskTitle={adminNewTaskTitle}
        adminTaskComposerOpen={adminTaskComposerOpen}
        createAdminClientTask={createAdminClientTask}
        selectedPhotoCompare={[]}
        setAdminNewTaskDueDate={setAdminNewTaskDueDate}
        setAdminNewTaskTitle={setAdminNewTaskTitle}
        setAdminTaskComposerOpen={setAdminTaskComposerOpen}
      />
    </>
  );
}
