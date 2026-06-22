import AdminWorkoutsNextWorkspace from "../../components/admin/AdminWorkoutsNextWorkspace";

export default function TrainerAdminWorkoutsNextRoute({
  APP_VERSION,
  adminClientStatus,
  adminExerciseVideoUploadingId,
  adminSelectedTemplateId,
  adminSelectedClient,
  adminTrainingTemplates,
  assignSavedProgramToClient,
  getTrainerNextCreateClientState,
  navigateTrainerNext,
  openTrainerExerciseLibrary,
  openTrainerProgramManager,
  plan,
  saveTrainerClientWorkoutSchedule,
  saveWorkoutsToFirebase,
  selectedUser,
  setAdminCreateClientModalOpen,
  setAdminSelectedTemplateId,
  sortWorkoutDays,
  telegramProfile,
  trainerName,
  trainerExerciseLibraryItems,
  trainerNextWorkspaceHandlers,
  trainerWorkoutTab,
  usersList
}) {
  const selectedWorkoutClient = adminSelectedClient || selectedUser || usersList[0];

  return (
    <AdminWorkoutsNextWorkspace
      appVersion={APP_VERSION}
      trainerName={trainerName}
      trainerAvatar={telegramProfile.avatarUrl}
      clients={usersList}
      selectedClient={selectedWorkoutClient || null}
      workouts={sortWorkoutDays(plan.workouts || [])}
      exerciseLibrary={trainerExerciseLibraryItems}
      programTemplates={adminTrainingTemplates}
      selectedProgramId={adminSelectedTemplateId}
      onSelectProgram={setAdminSelectedTemplateId}
      onAssignProgram={() => assignSavedProgramToClient(selectedWorkoutClient?.id, adminSelectedTemplateId)}
      onSaveWorkoutSchedule={(dates) => saveTrainerClientWorkoutSchedule(dates, selectedWorkoutClient)}
      onOpenProgramManager={openTrainerProgramManager}
      activeWorkoutTab={trainerWorkoutTab}
      onWorkoutTabChange={openTrainerExerciseLibrary}
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
      onCreateClient={() => setAdminCreateClientModalOpen(true)}
      createClientState={getTrainerNextCreateClientState()}
      onNavigate={navigateTrainerNext}
      mode="workouts"
      activeSection="workouts"
    />
  );
}
