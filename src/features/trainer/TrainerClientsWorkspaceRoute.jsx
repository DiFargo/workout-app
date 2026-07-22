import TrainerWorkspace from "../../components/trainer/TrainerWorkspace";
import TrainerClientOverviewModals from "./TrainerClientOverviewModals";

export default function TrainerClientsWorkspaceRoute({
  APP_VERSION,
  adminClientEvents,
  adminClientHistory,
  adminClientMeasurements,
  adminClientProgressPhotos,
  adminNewTaskDueDate,
  adminNewTaskTitle,
  adminClientStatus,
  adminClientTasks,
  adminClientTelegramMessages,
  adminExerciseVideoUploadingId,
  adminTaskComposerOpen,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  adminTrainerNote,
  adminUsersSelectedTab,
  assignSavedProgramToClient,
  canUseAdminFeatures,
  clientNutritionDays,
  createAdminClientTask,
  getAdminClientGoalLabel,
  getClientActivityStatus,
  getClientCardSummary,
  getTrainerNextCreateClientState,
  handleTrainerClientAction,
  logout,
  navigateTrainerNext,
  openClientTelegramConnection,
  openTelegramChat,
  openTrainerNextClient,
  plan,
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
  selectedSummary,
  selectedPhotoCompare,
  selectedTrainerName,
  selectedClientSnapshot,
  selectedLastWorkoutReview,
  sendAdminTestWorkoutReminder,
  sendTrainerClientMessage,
  setAdminClientPageOpen,
  setAdminClientStatus,
  setAdminNewTaskDueDate,
  setAdminNewTaskTitle,
  setAdminSelectedTemplateId,
  setAdminTaskComposerOpen,
  setAdminUsersSelectedTab,
  sortWorkoutDays,
  telegramProfile,
  trainerClientSummariesLoading,
  trainerSubscriptionNotificationSettings,
  trainerExerciseLibraryItems,
  trainerNextWorkspaceHandlers,
  trainerNutritionPlanOptions,
  usersList,
  adminClientPageOpen
}) {
  const trainerNextSummaries = Object.fromEntries(
    usersList.map((client) => {
      const summary = getClientCardSummary(client);
      return [client.id, {
        ...summary,
        status: getClientActivityStatus(summary)
      }];
    })
  );
  const trainerNextTab = {
    training: "workouts",
    calendarNutrition: "nutrition",
    telegram: "notifications"
  }[adminUsersSelectedTab] || adminUsersSelectedTab;

  return (
    <>
      <TrainerWorkspace
      appVersion={APP_VERSION}
      mode={adminClientPageOpen && selectedClient ? "client" : "clients"}
      activeSection="clients"
      onNavigate={navigateTrainerNext}
      onRefresh={refreshPage}
      trainerName={selectedTrainerName}
      trainerAvatar={telegramProfile.avatarUrl}
      clients={usersList}
      clientSummaries={trainerNextSummaries}
      summariesLoading={trainerClientSummariesLoading}
      selectedClient={selectedClient}
      selectedProfile={{
        ...selectedProfile,
        goalLabel: getAdminClientGoalLabel(selectedProfile?.goal)
      }}
      selectedSummary={{
        ...selectedSummary,
        status: getClientActivityStatus(selectedSummary)
      }}
      selectedClientSnapshot={selectedClientSnapshot}
      selectedLastWorkoutReview={selectedLastWorkoutReview}
      activeClientTab={trainerNextTab}
      onClientTabChange={setAdminUsersSelectedTab}
      onOpenClient={openTrainerNextClient}
      onCloseClient={() => setAdminClientPageOpen(false)}
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
      onOpenTelegramChat={openTelegramChat}
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
        selectedPhotoCompare={selectedPhotoCompare || []}
        setAdminNewTaskDueDate={setAdminNewTaskDueDate}
        setAdminNewTaskTitle={setAdminNewTaskTitle}
        setAdminTaskComposerOpen={setAdminTaskComposerOpen}
      />
    </>
  );
}
