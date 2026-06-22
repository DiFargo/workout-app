import TrainerWorkspace from "../../components/trainer/TrainerWorkspace";

export default function TrainerClientsWorkspaceRoute({
  APP_VERSION,
  adminClientHistory,
  adminClientMeasurements,
  adminClientProgressPhotos,
  adminClientStatus,
  adminClientTasks,
  adminExerciseVideoUploadingId,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  adminTrainerNote,
  adminUsersSelectedTab,
  assignSavedProgramToClient,
  clientNutritionDays,
  getAdminClientGoalLabel,
  getClientActivityStatus,
  getClientCardSummary,
  getTrainerNextCreateClientState,
  handleTrainerClientAction,
  logout,
  navigateTrainerNext,
  openClientTelegramConnection,
  openTrainerNextClient,
  plan,
  refreshPage,
  saveTrainerClientNutritionPlan,
  saveTrainerClientNotificationSettings,
  saveTrainerClientWorkoutSchedule,
  saveWorkoutsToFirebase,
  selectedClient,
  selectedEffectiveNutritionGoals,
  selectedProfile,
  selectedSummary,
  selectedTrainerName,
  sendAdminTestWorkoutReminder,
  sendTrainerClientMessage,
  setAdminClientPageOpen,
  setAdminClientStatus,
  setAdminCreateClientModalOpen,
  setAdminSelectedTemplateId,
  setAdminUsersSelectedTab,
  sortWorkoutDays,
  telegramProfile,
  trainerClientSummariesLoading,
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
      activeClientTab={trainerNextTab}
      onClientTabChange={setAdminUsersSelectedTab}
      onOpenClient={openTrainerNextClient}
      onCloseClient={() => setAdminClientPageOpen(false)}
      onCreateClient={() => setAdminCreateClientModalOpen(true)}
      createClientState={getTrainerNextCreateClientState()}
      measurements={adminClientMeasurements}
      history={adminClientHistory}
      nutritionDays={clientNutritionDays}
      nutritionGoals={selectedEffectiveNutritionGoals}
      nutritionPlanOptions={trainerNutritionPlanOptions}
      photos={adminClientProgressPhotos}
      tasks={adminClientTasks}
      trainerNote={adminTrainerNote}
      onGenerateNutritionPlan={() => setAdminClientStatus("Параметры AI-плана открыты в разделе питания.")}
      onSaveNutritionPlan={saveTrainerClientNutritionPlan}
      onSaveNotifications={saveTrainerClientNotificationSettings}
      onTestNotification={() => sendAdminTestWorkoutReminder(selectedClient)}
      onConnectTelegram={openClientTelegramConnection}
      onSendMessage={sendTrainerClientMessage}
      onClientAction={handleTrainerClientAction}
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
  );
}
