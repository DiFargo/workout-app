import { TrainerProgramConstructorStyleScope } from "../../components/trainer/TrainerWorkspace";
import TrainerProgramConstructor from "../../components/trainer/TrainerProgramConstructor";
import TrainerProgramCopySheet from "./TrainerProgramCopySheet";
import TrainerProgramLegacyEditor from "./TrainerProgramLegacyEditor";
import TrainerProgramManagerBottomControls from "./TrainerProgramManagerBottomControls";
import TrainerProgramManagerHeader from "./TrainerProgramManagerHeader";
import TrainerProgramOverviewPage from "./TrainerProgramOverviewPage";
import styles from "./TrainerProgramManagerView.module.css";

export default function TrainerProgramManagerView({
  APP_PAGES,
  addMonthBlock,
  addMonthExercise,
  addMonthExerciseSet,
  addMonthWeek,
  addMonthWorkout,
  addProgramMonth,
  adminExerciseLibrary,
  adminExerciseSearch,
  adminExerciseVideoUploadingId,
  adminOpenProgramBlocks,
  adminOpenProgramWeeks,
  adminOpenWorkoutId,
  adminProgramCopyTarget,
  adminProgramCreateChoiceOpen,
  adminProgramImportInputRef,
  adminProgramLibraryTab,
  adminProgramSwipeOpenKey,
  adminSelectedExerciseId,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  canUseAdminFeatures,
  cancelMonthExerciseEdit,
  confirmRemoveMonthWorkout,
  copyMonthProgramBlock,
  createNewMonthProgramDraft,
  deleteSelectedMonthExercise,
  deleteSelectedProgramFromLibrary,
  duplicateMonthExercise,
  duplicateMonthWorkout,
  getTemplateStats,
  handleAdminProgramSwipeCancel,
  handleAdminProgramSwipeClick,
  handleAdminProgramSwipeEnd,
  handleAdminProgramSwipeStart,
  handleMonthProgramBack,
  importMonthProgramFromFile,
  importMonthProgramWithAi,
  isTrainerNextWorkspace,
  loadHistory,
  monthBlocks,
  monthGroups,
  monthProgram,
  moveMonthExercise,
  normalizedMonthProgram,
  openAdminClientsWithFilter,
  openAdminProgramsOverview,
  openCopyMonthProgramBlock,
  openMonthExerciseEditor,
  openMonthWorkoutContext,
  openProgramFromLibrary,
  refreshCurrentMonthProgram,
  removeMonthBlock,
  removeMonthExercise,
  removeMonthExerciseSet,
  removeMonthWeek,
  removeProgramMonth,
  renderTrainerWorkspaceBottomBar,
  saveMonthExerciseEdit,
  saveMonthProgramAndOpenOverview,
  saveMonthProgramToLibrary,
  saveMonthWorkoutAndReturnToBlock,
  setAdminExerciseSearch,
  setAdminOpenWorkoutId,
  setAdminProgramCopyTarget,
  setAdminProgramCreateChoiceOpen,
  setAdminSelectedExerciseId,
  setAdminSelectedTemplateId,
  setPage,
  setProfileActiveTab,
  setSelectedUserId,
  setTrainerProgramManagerOpen,
  toggleMonthProgramBlock,
  toggleMonthProgramWeek,
  updateMonthExercise,
  updateMonthExerciseName,
  updateMonthExerciseSet,
  updateMonthProgramName,
  updateMonthWorkout,
  updateProgramMonth,
  uploadMonthExerciseVideo
}) {
  const isNextWorkspace = isTrainerNextWorkspace();

  return (
    <div className={isNextWorkspace
      ? styles.root
      : `monthProgramEditorPage monthProgramPremium${adminProgramLibraryTab === "overview" ? " monthProgramOverviewMode" : ""}${adminOpenWorkoutId ? " monthProgramPremiumDayMode" : ""}`}>
      <TrainerProgramManagerHeader
        adminOpenProgramBlocks={adminOpenProgramBlocks}
        adminOpenWorkoutId={adminOpenWorkoutId}
        adminProgramLibraryTab={adminProgramLibraryTab}
        handleMonthProgramBack={handleMonthProgramBack}
        isTrainerNextWorkspace={isTrainerNextWorkspace}
        onGoAdmin={() => setPage(APP_PAGES.ADMIN)}
        setTrainerProgramManagerOpen={setTrainerProgramManagerOpen}
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
          isTrainerNextWorkspace={isTrainerNextWorkspace}
          onGoAdmin={() => setPage(APP_PAGES.ADMIN)}
          openProgramFromLibrary={openProgramFromLibrary}
          setAdminProgramCreateChoiceOpen={setAdminProgramCreateChoiceOpen}
          setAdminSelectedTemplateId={setAdminSelectedTemplateId}
        />
      ) : isTrainerNextWorkspace() ? (
        <TrainerProgramConstructorStyleScope>
          {(constructorStyles) => <TrainerProgramConstructor
          styles={constructorStyles}
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
          onDuplicateExercise={duplicateMonthExercise}
          onMoveExercise={moveMonthExercise}
          onUpdateExerciseSet={updateMonthExerciseSet}
          onAddExerciseSet={addMonthExerciseSet}
          onRemoveExerciseSet={removeMonthExerciseSet}
          onUploadExerciseVideo={uploadMonthExerciseVideo}
          exerciseVideoUploadingId={adminExerciseVideoUploadingId}
        />}
        </TrainerProgramConstructorStyleScope>
      ) : (
        <TrainerProgramLegacyEditor
          addMonthBlock={addMonthBlock}
          addMonthExercise={addMonthExercise}
          addMonthExerciseSet={addMonthExerciseSet}
          addMonthWeek={addMonthWeek}
          addMonthWorkout={addMonthWorkout}
          addProgramMonth={addProgramMonth}
          adminExerciseLibrary={adminExerciseLibrary}
          adminExerciseSearch={adminExerciseSearch}
          adminExerciseVideoUploadingId={adminExerciseVideoUploadingId}
          adminOpenProgramBlocks={adminOpenProgramBlocks}
          adminOpenProgramWeeks={adminOpenProgramWeeks}
          adminOpenWorkoutId={adminOpenWorkoutId}
          adminProgramSwipeOpenKey={adminProgramSwipeOpenKey}
          adminSelectedExerciseId={adminSelectedExerciseId}
          cancelMonthExerciseEdit={cancelMonthExerciseEdit}
          confirmRemoveMonthWorkout={confirmRemoveMonthWorkout}
          handleAdminProgramSwipeCancel={handleAdminProgramSwipeCancel}
          handleAdminProgramSwipeClick={handleAdminProgramSwipeClick}
          handleAdminProgramSwipeEnd={handleAdminProgramSwipeEnd}
          handleAdminProgramSwipeStart={handleAdminProgramSwipeStart}
          handleMonthProgramBack={handleMonthProgramBack}
          monthBlocks={monthBlocks}
          monthGroups={monthGroups}
          monthProgram={monthProgram}
          openCopyMonthProgramBlock={openCopyMonthProgramBlock}
          openMonthExerciseEditor={openMonthExerciseEditor}
          removeMonthBlock={removeMonthBlock}
          removeMonthExerciseSet={removeMonthExerciseSet}
          removeMonthWeek={removeMonthWeek}
          removeProgramMonth={removeProgramMonth}
          saveMonthExerciseEdit={saveMonthExerciseEdit}
          setAdminExerciseSearch={setAdminExerciseSearch}
          setAdminOpenWorkoutId={setAdminOpenWorkoutId}
          setAdminSelectedExerciseId={setAdminSelectedExerciseId}
          toggleMonthProgramBlock={toggleMonthProgramBlock}
          toggleMonthProgramWeek={toggleMonthProgramWeek}
          updateMonthExercise={updateMonthExercise}
          updateMonthExerciseName={updateMonthExerciseName}
          updateMonthExerciseSet={updateMonthExerciseSet}
          updateMonthProgramName={updateMonthProgramName}
          updateMonthWorkout={updateMonthWorkout}
          updateProgramMonth={updateProgramMonth}
          uploadMonthExerciseVideo={uploadMonthExerciseVideo}
        />
      )}

      <TrainerProgramCopySheet
        adminProgramCopyTarget={adminProgramCopyTarget}
        copyMonthProgramBlock={copyMonthProgramBlock}
        monthGroups={monthGroups}
        setAdminProgramCopyTarget={setAdminProgramCopyTarget}
      />

      <TrainerProgramManagerBottomControls
        adminOpenWorkoutId={adminOpenWorkoutId}
        adminProgramImportInputRef={adminProgramImportInputRef}
        adminProgramLibraryTab={adminProgramLibraryTab}
        adminSelectedExerciseId={adminSelectedExerciseId}
        deleteSelectedMonthExercise={deleteSelectedMonthExercise}
        deleteSelectedProgramFromLibrary={deleteSelectedProgramFromLibrary}
        handleMonthProgramBack={handleMonthProgramBack}
        importMonthProgramFromFile={importMonthProgramFromFile}
        isTrainerNextWorkspace={isTrainerNextWorkspace}
        loadHistory={loadHistory}
        openAdminClientsWithFilter={openAdminClientsWithFilter}
        openAdminProgramsOverview={openAdminProgramsOverview}
        openMonthWorkoutContext={openMonthWorkoutContext}
        refreshCurrentMonthProgram={refreshCurrentMonthProgram}
        renderTrainerWorkspaceBottomBar={renderTrainerWorkspaceBottomBar}
        saveMonthProgramAndOpenOverview={saveMonthProgramAndOpenOverview}
        saveMonthWorkoutAndReturnToBlock={saveMonthWorkoutAndReturnToBlock}
        setPage={setPage}
        setProfileActiveTab={setProfileActiveTab}
        setSelectedUserId={setSelectedUserId}
        addMonthExercise={addMonthExercise}
        APP_PAGES={APP_PAGES}
      />
    </div>
  );
}
