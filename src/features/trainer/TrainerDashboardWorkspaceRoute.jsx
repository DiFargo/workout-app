import TrainerWorkspace from "../../components/trainer/TrainerWorkspace";

export default function TrainerDashboardWorkspaceRoute({
  APP_VERSION,
  adminClientHistory,
  adminClientMeasurements,
  adminClientProgressPhotos,
  adminClientStatus,
  adminClientTasks,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  adminTrainerNote,
  adminUsersSelectedTab,
  assignSavedProgramToClient,
  attentionCount,
  clientNutritionDays,
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
  saveTrainerClientWorkoutSchedule,
  saveWorkoutsToFirebase,
  selectedClient,
  selectedEffectiveNutritionGoals,
  selectedProfile,
  sendAdminTestWorkoutReminder,
  sendTrainerClientMessage,
  setAdminClientPageOpen,
  setAdminCreateClientModalOpen,
  setAdminClientStatus,
  setAdminSelectedTemplateId,
  setAdminUsersSelectedTab,
  setTrainerNextSection,
  sortWorkoutDays,
  plan,
  telegramProfile,
  trainerClientSummariesLoading,
  trainerExerciseLibraryItems,
  trainerName,
  trainerNextActiveSection,
  trainerNextMode,
  trainerNextSelectedSummary,
  trainerNextSummaries,
  trainerNextWorkspaceHandlers,
  trainerNutritionPlanOptions,
  trainerStatusCounts,
  usersList,
  adminExerciseVideoUploadingId
}) {
  return (
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
