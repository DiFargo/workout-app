import TrainerProgramConstructor from "../../components/trainer/TrainerProgramConstructor";
import TrainerProgramCopySheet from "./TrainerProgramCopySheet";
import TrainerProgramOverviewPage from "./TrainerProgramOverviewPage";
import styles from "./TrainerProgramManagerView.module.css";

export default function TrainerProgramManagerView({
  addMonthBlock,
  addMonthExercise,
  addMonthExerciseSet,
  addMonthWeek,
  addMonthWorkout,
  addProgramMonth,
  adminExerciseLibrary,
  adminExerciseVideoUploadingId,
  adminOpenWorkoutId,
  adminProgramCopyTarget,
  adminProgramCreateChoiceOpen,
  adminProgramImportInputRef,
  adminProgramLibraryTab,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  canUseAdminFeatures,
  confirmRemoveMonthWorkout,
  copyMonthProgramBlock,
  createNewMonthProgramDraft,
  deleteSelectedProgramFromLibrary,
  duplicateMonthExercise,
  duplicateMonthWorkout,
  getTemplateStats,
  importMonthProgramFromFile,
  importMonthProgramWithAi,
  loadAdminTrainingTemplates,
  monthGroups,
  moveMonthExercise,
  normalizedMonthProgram,
  openAdminProgramsOverview,
  openCopyMonthProgramBlock,
  openProgramFromLibrary,
  removeMonthBlock,
  removeMonthExercise,
  removeMonthExerciseSet,
  removeMonthWeek,
  removeProgramMonth,
  saveMonthProgramToLibrary,
  setAdminExerciseSearch,
  setAdminOpenWorkoutId,
  setAdminProgramCopyTarget,
  setAdminProgramCreateChoiceOpen,
  setAdminSelectedExerciseId,
  setAdminSelectedTemplateId,
  updateMonthExercise,
  updateMonthExerciseName,
  updateMonthExerciseSet,
  updateMonthProgramName,
  updateMonthWorkout,
  updateProgramMonth,
  uploadMonthExerciseVideo
}) {
  return (
    <div className={styles.root}>
      <input
        ref={adminProgramImportInputRef}
        className={styles.importInput}
        type="file"
        accept="application/json,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
        onChange={(event) => {
          importMonthProgramFromFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {adminProgramLibraryTab === "overview" ? (
        <TrainerProgramOverviewPage
          adminProgramCreateChoiceOpen={adminProgramCreateChoiceOpen}
          adminProgramImportInputRef={adminProgramImportInputRef}
          adminSelectedTemplateId={adminSelectedTemplateId}
          adminTrainingTemplates={adminTrainingTemplates}
          canUseAdminFeatures={canUseAdminFeatures}
          createNewMonthProgramDraft={createNewMonthProgramDraft}
          deleteSelectedProgramFromLibrary={deleteSelectedProgramFromLibrary}
          getTemplateStats={getTemplateStats}
          importMonthProgramWithAi={importMonthProgramWithAi}
          loadAdminTrainingTemplates={loadAdminTrainingTemplates}
          openProgramFromLibrary={openProgramFromLibrary}
          setAdminProgramCreateChoiceOpen={setAdminProgramCreateChoiceOpen}
          setAdminSelectedTemplateId={setAdminSelectedTemplateId}
        />
      ) : (
        <TrainerProgramConstructor
          program={normalizedMonthProgram}
          months={monthGroups}
          exerciseLibrary={adminExerciseLibrary}
          activeWorkoutId={adminOpenWorkoutId}
          onSelectWorkout={(workoutId) => {
            setAdminSelectedExerciseId("");
            setAdminExerciseSearch("");
            setAdminOpenWorkoutId(workoutId);
          }}
          onProgramNameChange={updateMonthProgramName}
          onSaveProgram={saveMonthProgramToLibrary}
          onDeleteProgram={deleteSelectedProgramFromLibrary}
          onBack={openAdminProgramsOverview}
          onAddMonth={addProgramMonth}
          onUpdateMonth={updateProgramMonth}
          onDeleteMonth={removeProgramMonth}
          onAddCycle={addMonthBlock}
          onCopyCycle={openCopyMonthProgramBlock}
          onDeleteCycle={removeMonthBlock}
          onAddWeek={addMonthWeek}
          onDeleteWeek={removeMonthWeek}
          onAddWorkout={addMonthWorkout}
          onUpdateWorkout={updateMonthWorkout}
          onDeleteWorkout={confirmRemoveMonthWorkout}
          onDuplicateWorkout={duplicateMonthWorkout}
          onAddExercise={(blockId, weekId, workoutId, sourceExercise = null) =>
            addMonthExercise(blockId, weekId, workoutId, sourceExercise, false)
          }
          onUpdateExercise={updateMonthExercise}
          onUpdateExerciseName={updateMonthExerciseName}
          onDeleteExercise={removeMonthExercise}
          onDuplicateExercise={duplicateMonthExercise}
          onMoveExercise={moveMonthExercise}
          onUpdateExerciseSet={updateMonthExerciseSet}
          onAddExerciseSet={addMonthExerciseSet}
          onRemoveExerciseSet={removeMonthExerciseSet}
          onUploadExerciseVideo={uploadMonthExerciseVideo}
          exerciseVideoUploadingId={adminExerciseVideoUploadingId}
        />
      )}

      <TrainerProgramCopySheet
        adminProgramCopyTarget={adminProgramCopyTarget}
        copyMonthProgramBlock={copyMonthProgramBlock}
        monthGroups={monthGroups}
        setAdminProgramCopyTarget={setAdminProgramCopyTarget}
      />

    </div>
  );
}
