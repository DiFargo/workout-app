import AdminWorkoutsNextWorkspace from "../../components/admin/AdminWorkoutsNextWorkspace";
import { buildTrainerExerciseLibraryItems } from "../../utils/trainerExerciseLibrary";

export default function TrainerAdminWorkoutsNextRoute({
  APP_VERSION,
  adminClientStatus,
  adminExerciseVideoUploadingId,
  adminSelectedTemplateId,
  adminSelectedClient,
  adminTrainingTemplates,
  assignSavedProgramToClient,
  canUseAdminFeatures,
  getTrainerNextCreateClientState,
  navigateTrainerNext,
  openTrainerExerciseLibrary,
  openTrainerProgramManager,
  plan,
  saveTrainerClientWorkoutSchedule,
  saveWorkoutsToFirebase,
  selectedUser,
  setAdminSelectedTemplateId,
  setTrainerProgramManagerOpen,
  setTrainerWorkoutTab,
  sortWorkoutDays,
  telegramProfile,
  trainerName,
  trainerExerciseLibraryItems,
  trainerNextWorkspaceHandlers,
  trainerWorkoutTab,
  usersList,
  embedded = false
}) {
  const selectedWorkoutClient = adminSelectedClient || selectedUser || usersList[0];
  const isAdmin = typeof canUseAdminFeatures === "function"
    ? canUseAdminFeatures()
    : Boolean(canUseAdminFeatures);
  const selectedTrainerId = String(selectedWorkoutClient?.id || selectedWorkoutClient?.uid || "");
  const isTrainerMaterials = isAdmin && selectedWorkoutClient?.role === "trainer" && Boolean(selectedTrainerId);
  const visibleProgramTemplates = isTrainerMaterials
    ? (adminTrainingTemplates || []).filter((template) =>
      template?.ownerRole === "trainer" && String(template?.ownerUid || "") === selectedTrainerId
    )
    : adminTrainingTemplates;
  const isExerciseLibraryTab = trainerWorkoutTab === "library";
  const activeWorkoutClient = isExerciseLibraryTab ? null : selectedWorkoutClient || null;
  const activeWorkouts = isExerciseLibraryTab ? [] : sortWorkoutDays(plan.workouts || []);
  const activeExerciseLibrary = isExerciseLibraryTab
    ? buildTrainerExerciseLibraryItems({}, visibleProgramTemplates)
    : trainerExerciseLibraryItems;

  const handleWorkoutTabChange = () => {
    if (isTrainerMaterials) {
      setTrainerProgramManagerOpen?.(false);
      setTrainerWorkoutTab?.("library");
      return;
    }
    openTrainerExerciseLibrary?.();
  };

  const handleAssignProgram = (options) => {
    if (isExerciseLibraryTab || !selectedWorkoutClient) return false;
    return assignSavedProgramToClient(selectedWorkoutClient.id, adminSelectedTemplateId, options);
  };

  const handleSaveWorkoutSchedule = (dates, assignmentWorkouts) => {
    if (isExerciseLibraryTab || !selectedWorkoutClient) return false;
    return saveTrainerClientWorkoutSchedule(dates, selectedWorkoutClient, assignmentWorkouts);
  };

  return (
    <AdminWorkoutsNextWorkspace
      appVersion={APP_VERSION}
      embedded={embedded}
      trainerName={trainerName}
      trainerAvatar={telegramProfile.avatarUrl}
      clients={usersList}
      selectedClient={activeWorkoutClient}
      workouts={activeWorkouts}
      exerciseLibrary={activeExerciseLibrary}
      programTemplates={visibleProgramTemplates}
      selectedProgramId={adminSelectedTemplateId}
      onSelectProgram={setAdminSelectedTemplateId}
      onAssignProgram={handleAssignProgram}
      onSaveWorkoutSchedule={handleSaveWorkoutSchedule}
      onOpenProgramManager={openTrainerProgramManager}
      activeWorkoutTab={trainerWorkoutTab}
      onWorkoutTabChange={handleWorkoutTabChange}
      programStatus={adminClientStatus}
      onUpdateWorkout={trainerNextWorkspaceHandlers.onUpdateWorkout}
      onUpdateExercise={trainerNextWorkspaceHandlers.onUpdateExercise}
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
      onCreateClient={getTrainerNextCreateClientState().onOpen}
      createClientState={getTrainerNextCreateClientState()}
      onNavigate={navigateTrainerNext}
      mode="workouts"
      activeSection="workouts"
    />
  );
}
