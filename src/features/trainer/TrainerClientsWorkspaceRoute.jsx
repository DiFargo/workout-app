import TrainerWorkspace from "../../components/trainer/TrainerWorkspace";
import TrainerClientOverviewModals from "./TrainerClientOverviewModals";
import AdminTrainerProfileRoute, { isAdminTrainerSelection } from "./AdminTrainerProfileRoute";

export default function TrainerClientsWorkspaceRoute({
  APP_VERSION,
  embedded = false,
  adminAllUsersList,
  adminClientEvents,
  adminClientHistory,
  adminClientLoading,
  adminClientMeasurements,
  adminClientProgressPhotos,
  adminNewTaskDueDate,
  adminNewTaskTitle,
  adminClientStatus,
  adminClientTasks,
  adminClientTelegramMessages,
  adminClientTab,
  adminExerciseVideoUploadingId,
  adminTaskComposerOpen,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  adminTrainerNote,
  archiveClientProgramAssignment,
  restoreClientProgramAssignment,
  assignSavedProgramToClient,
  canUseAdminFeatures,
  clientNutritionDays,
  createAdminClientTask,
  deleteClientProgramAssignment,
  getAdminClientGoalLabel,
  getClientActivityStatus,
  getClientCardSummary,
  getTrainerNextCreateClientState,
  handleTrainerClientAction,
  logout,
  navigateTrainerNext,
  onCloseClient,
  openClientTelegramConnection,
  openAdminBaseLibrary,
  openAdminClientsWithFilter,
  openProfileAccount,
  openTelegramChat,
  openTrainerNextClient,
  plan,
  refreshPage,
  saveTrainerClientNutritionPlan,
  saveTrainerClientNotificationSettings,
  saveTrainerClientSetupProgress,
  loadTrainerSubscriptionNotificationSettings,
  loadUsers,
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
  setAdminClientTab,
  setAdminAllUsersList,
  setAdminNewTaskDueDate,
  setAdminNewTaskTitle,
  setAdminSelectedTemplateId,
  setAdminSelectedClient,
  setAdminTaskComposerOpen,
  setTrainerNextSection,
  setTrainerProgramManagerOpen,
  setTrainerWorkoutTab,
  setPage,
  sortWorkoutDays,
  telegramProfile,
  trainerClientSummariesLoading,
  trainerSubscriptionNotificationSettings,
  trainerExerciseLibraryItems,
  trainerNextWorkspaceHandlers,
  trainerNutritionPlanOptions,
  updateUserTrainerRole,
  user,
  usersList,
  adminClientPageOpen
}) {
  if (isAdminTrainerSelection({ canUseAdminFeatures, selectedClient })) {
    return (
      <AdminTrainerProfileRoute
        adminAllUsersList={adminAllUsersList}
        adminTrainingTemplates={adminTrainingTemplates}
        canUseAdminFeatures={canUseAdminFeatures}
        loadUsers={loadUsers}
        logout={logout}
        openAdminBaseLibrary={openAdminBaseLibrary}
        openAdminClientsWithFilter={openAdminClientsWithFilter}
        openProfileAccount={openProfileAccount}
        selectedClient={selectedClient}
        setAdminClientPageOpen={setAdminClientPageOpen}
        setAdminClientStatus={setAdminClientStatus}
        setAdminAllUsersList={setAdminAllUsersList}
        setAdminSelectedClient={setAdminSelectedClient}
        setPage={setPage}
        setTrainerNextSection={setTrainerNextSection}
        setTrainerProgramManagerOpen={setTrainerProgramManagerOpen}
        setTrainerWorkoutTab={setTrainerWorkoutTab}
        updateUserTrainerRole={updateUserTrainerRole}
        user={user}
        usersList={usersList}
      />
    );
  }

  const trainerNextSummaries = Object.fromEntries(
    usersList.map((client) => {
      const summary = getClientCardSummary(client);
      return [client.id, {
        ...summary,
        status: getClientActivityStatus(summary)
      }];
    })
  );
  // The client-detail tab is intentionally separate from the user-directory
  // filter. Reusing `adminUsersSelectedTab` here can leave the detail with a
  // value such as "clients" or "trainers", for which there is no content.
  // In that case the screen used to render only the header and an empty area.
  const trainerNextTab = [
    "overview",
    "workouts",
    "exerciseProgress",
    "nutrition",
    "bodyProgress",
    "measurements",
    "photos",
    "notifications",
    "messages"
  ].includes(adminClientTab)
    ? adminClientTab
    : "overview";

  return (
    <>
      <TrainerWorkspace
      appVersion={APP_VERSION}
      embedded={embedded}
      mode={adminClientPageOpen && selectedClient ? "client" : "clients"}
      activeSection="clients"
      onNavigate={navigateTrainerNext}
      onRefresh={refreshPage}
      trainerName={selectedTrainerName}
      trainerAvatar={telegramProfile.avatarUrl}
      clients={usersList}
      clientSummaries={trainerNextSummaries}
      summariesLoading={trainerClientSummariesLoading}
      clientLoading={adminClientLoading}
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
      onClientTabChange={setAdminClientTab}
      onOpenClient={openTrainerNextClient}
      onCloseClient={onCloseClient || (() => setAdminClientPageOpen(false))}
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
      onSaveClientSetupProgress={saveTrainerClientSetupProgress}
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
      canAdminManageProgramAssignments={canUseAdminFeatures()}
      onResolveExerciseProgress={(payload) => handleTrainerClientAction("resolve_exercise_progress", selectedClient, payload)}
      workouts={sortWorkoutDays(plan.workouts || [])}
      archivedWorkouts={sortWorkoutDays(plan.archivedWorkouts || [])}
      exerciseLibrary={trainerExerciseLibraryItems}
      programTemplates={adminTrainingTemplates}
      selectedProgramId={adminSelectedTemplateId}
      onSelectProgram={setAdminSelectedTemplateId}
      onAssignProgram={(options) => assignSavedProgramToClient(selectedClient?.id, adminSelectedTemplateId, options)}
      onArchiveProgramAssignment={(assignment) => archiveClientProgramAssignment(selectedClient?.id, assignment)}
      onRestoreProgramAssignment={(assignment) => restoreClientProgramAssignment(selectedClient?.id, assignment)}
      onDeleteProgramAssignment={(assignment) => deleteClientProgramAssignment(selectedClient?.id, assignment)}
      onSaveWorkoutSchedule={(dates, assignmentWorkouts) => saveTrainerClientWorkoutSchedule(dates, selectedClient, assignmentWorkouts)}
      programStatus={adminClientStatus}
      onUpdateWorkout={trainerNextWorkspaceHandlers.onUpdateWorkout}
      onUpdateExercise={trainerNextWorkspaceHandlers.onUpdateExercise}
      onSaveExerciseProgressAdjustment={trainerNextWorkspaceHandlers.onSaveExerciseProgressAdjustment}
      onUpdateLibraryExercise={trainerNextWorkspaceHandlers.onUpdateLibraryExercise}
      onRemoveLibraryExercise={trainerNextWorkspaceHandlers.onRemoveLibraryExercise}
      onCreateLibraryExercise={trainerNextWorkspaceHandlers.onCreateLibraryExercise}
      onUpdateExerciseSet={trainerNextWorkspaceHandlers.onUpdateExerciseSet}
      onAddExerciseSet={trainerNextWorkspaceHandlers.onAddExerciseSet}
      onRemoveExerciseSet={trainerNextWorkspaceHandlers.onRemoveExerciseSet}
      onAddExercise={trainerNextWorkspaceHandlers.onAddExercise}
      onRemoveExercise={trainerNextWorkspaceHandlers.onRemoveExercise}
      onDuplicateExercise={trainerNextWorkspaceHandlers.onDuplicateExercise}
      onMoveExercise={trainerNextWorkspaceHandlers.onMoveExercise}
      onUploadExerciseVideo={trainerNextWorkspaceHandlers.onUploadExerciseVideo}
      onUploadLibraryExerciseVideo={trainerNextWorkspaceHandlers.onUploadLibraryExerciseVideo}
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
