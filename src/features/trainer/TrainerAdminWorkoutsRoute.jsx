import { TrainerShell } from "../../components/trainer/TrainerWorkspace";
import {
  createFourWeekWorkoutProgramBlocks
} from "../../utils/auditSafety";
import { normalizeTrainerMonthProgram } from "../../utils/trainerMonthProgramNormalization";
import TrainerAdminWorkoutsNextRoute from "./TrainerAdminWorkoutsNextRoute";
import TrainerProgramManagerView from "./TrainerProgramManagerView";
import { buildTrainerMonthProgramEditorModel } from "./trainerMonthProgramEditorModel";
import { createTrainerMonthExerciseHandlers } from "./trainerMonthExerciseHandlers";
import { createTrainerMonthProgramLibraryHandlers } from "./trainerMonthProgramLibraryHandlers";
import { createTrainerMonthProgramPersistenceHandlers } from "./trainerMonthProgramPersistenceHandlers";
import { createTrainerMonthProgramStructureHandlers } from "./trainerMonthProgramStructureHandlers";
import { createTrainerMonthSelectedExerciseHandlers } from "./trainerMonthSelectedExerciseHandlers";

export default function TrainerAdminWorkoutsRoute({
  APP_PAGES,
  APP_VERSION,
  adminActiveDayId,
  adminActiveProgramId,
  adminClientStatus,
  adminExerciseEditSnapshotRef,
  adminExerciseLibrary,
  adminExerciseSearch,
  adminExerciseVideoUploadingId,
  adminOpenProgramBlocks,
  adminOpenProgramWeeks,
  adminOpenWorkoutId,
  adminProgramCopyTarget,
  adminProgramCreateChoiceOpen,
  adminProgramGroups,
  adminProgramImportInputRef,
  adminProgramLibraryTab,
  adminProgramSwipeOpenKey,
  adminSelectedClient,
  adminSelectedExerciseId,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  auth,
  assignSavedProgramToClient,
  canManageTrainingTemplate,
  canUseAdminFeatures,
  canUseTrainerFeatures,
  db,
  getCurrentProgramOwner,
  getTrainerNextCreateClientState,
  handleAdminProgramSwipeCancel,
  handleAdminProgramSwipeClick,
  handleAdminProgramSwipeEnd,
  handleAdminProgramSwipeStart,
  loadAdminTrainingTemplates,
  loadHistory,
  navigateTrainerNext,
  openAdminClientsWithFilter,
  openAdminProgramsOverview,
  openTrainerExerciseLibrary,
  openTrainerProgramManager,
  plan,
  renderTrainerWorkspaceBottomBar,
  saveTrainerClientWorkoutSchedule,
  saveWorkoutsToFirebase,
  setAdminActiveDayId,
  setAdminActiveProgramId,
  setAdminCreateClientModalOpen,
  setAdminExerciseSearch,
  setAdminExerciseVideoUploadingId,
  setAdminOpenProgramBlocks,
  setAdminOpenProgramWeeks,
  setAdminOpenWorkoutId,
  setAdminProgramCopyTarget,
  setAdminProgramCreateChoiceOpen,
  setAdminProgramEditorMode,
  setAdminProgramGroups,
  setAdminProgramLibraryTab,
  setAdminProgramSwipeOpenKey,
  setAdminSelectedExerciseId,
  setAdminSelectedTemplateId,
  setAdminTemplateName,
  setAdminTrainingTemplates,
  setPage,
  setPlan,
  setProfileActiveTab,
  setSelectedUserId,
  selectedUserId,
  setTrainerProgramManagerOpen,
  showAppConfirm,
  showAppError,
  sortWorkoutDays,
  storage,
  telegramProfile,
  trainerExerciseLibraryItems,
  trainerNextWorkspaceHandlers,
  trainerProgramManagerOpen,
  trainerWorkoutTab,
  user,
  usersList,
  isTrainerNextWorkspace
}) {
  if (!canUseTrainerFeatures()) {
    return (
      <div className="app">
        <button className="backBtn" type="button" onClick={() => setPage(APP_PAGES.MAIN)}>← Главное меню</button>
        <div className="historyEmptyCard">
          <h3>Доступ закрыт</h3>
          <p>Тренерская доступна админам и пользователям с ролью тренера.</p>
        </div>
      </div>
    );
  }

  const selectedUser = usersList.find((u) => u.id === selectedUserId);

  if (isTrainerNextWorkspace() && !trainerProgramManagerOpen) {
    const trainerName = telegramProfile.displayName ||
      auth.currentUser?.displayName ||
      auth.currentUser?.email?.split("@")?.[0] ||
      "Trainer";

    return (
      <TrainerAdminWorkoutsNextRoute
        APP_VERSION={APP_VERSION}
        trainerName={trainerName}
        adminClientStatus={adminClientStatus}
        adminExerciseVideoUploadingId={adminExerciseVideoUploadingId}
        adminSelectedClient={adminSelectedClient}
        adminSelectedTemplateId={adminSelectedTemplateId}
        adminTrainingTemplates={adminTrainingTemplates}
        assignSavedProgramToClient={assignSavedProgramToClient}
        getTrainerNextCreateClientState={getTrainerNextCreateClientState}
        navigateTrainerNext={navigateTrainerNext}
        openTrainerExerciseLibrary={openTrainerExerciseLibrary}
        openTrainerProgramManager={openTrainerProgramManager}
        plan={plan}
        saveTrainerClientWorkoutSchedule={saveTrainerClientWorkoutSchedule}
        saveWorkoutsToFirebase={saveWorkoutsToFirebase}
        selectedUser={selectedUser}
        setAdminCreateClientModalOpen={setAdminCreateClientModalOpen}
        setAdminSelectedTemplateId={setAdminSelectedTemplateId}
        sortWorkoutDays={sortWorkoutDays}
        telegramProfile={telegramProfile}
        trainerExerciseLibraryItems={trainerExerciseLibraryItems}
        trainerNextWorkspaceHandlers={trainerNextWorkspaceHandlers}
        trainerWorkoutTab={trainerWorkoutTab}
        usersList={usersList}
      />
    );
  }

  const monthProgram = adminProgramGroups?.[0] || {
    id: `month_${Date.now()}`,
    name: "Программа на месяц",
    blocks: createFourWeekWorkoutProgramBlocks("default")
  };

  function normalizeMonthProgram(program = monthProgram) {
    return normalizeTrainerMonthProgram(program);
  }

  function setMonthProgram(updater) {
    setAdminProgramGroups((prev) => {
      const base = normalizeMonthProgram(prev?.[0] || monthProgram);
      const nextProgram = normalizeMonthProgram(typeof updater === "function" ? updater(base) : updater);
      const flatWorkouts = nextProgram.blocks.flatMap((block) =>
        block.weeks.flatMap((week) =>
          (week.workouts || []).map((workout) => ({
            ...workout,
            name: workout.name || `${week.name} — тренировка`,
            blockName: block.name,
            weekName: week.name
          }))
        )
      );
      setPlan({ workouts: flatWorkouts });
      return [nextProgram];
    });
  }

  const normalizedMonthProgram = normalizeMonthProgram(monthProgram);
  const monthBlocks = normalizedMonthProgram.blocks || [];
  const monthGroups = normalizedMonthProgram.months || [];
  const {
    adminExerciseLibrary: monthAdminExerciseLibrary,
    monthWorkouts,
    openMonthWorkoutContext
  } = buildTrainerMonthProgramEditorModel({
    adminOpenWorkoutId,
    adminTrainingTemplates,
    monthBlocks
  });

  const {
    addMonthBlock,
    addMonthWeek,
    addMonthWorkout,
    addProgramMonth,
    confirmRemoveMonthWorkout,
    copyMonthProgramBlock,
    duplicateMonthWorkout,
    openCopyMonthProgramBlock,
    removeMonthBlock,
    removeMonthWeek,
    removeProgramMonth,
    toggleMonthProgramBlock,
    toggleMonthProgramWeek,
    updateMonthProgramName,
    updateProgramMonth
  } = createTrainerMonthProgramStructureHandlers({
    adminActiveDayId,
    adminOpenWorkoutId,
    adminProgramCopyTarget,
    monthBlocks,
    monthGroups,
    monthWorkouts,
    setAdminActiveDayId,
    setAdminOpenProgramBlocks,
    setAdminOpenProgramWeeks,
    setAdminOpenWorkoutId,
    setAdminProgramCopyTarget,
    setAdminProgramSwipeOpenKey,
    setAdminSelectedExerciseId,
    setMonthProgram,
    showAppConfirm
  });

  function updateMonthWorkout(blockId, weekId, workoutId, patch) {
    setMonthProgram((program) => ({
      ...program,
      blocks: program.blocks.map((block) => block.id !== blockId ? block : {
        ...block,
        weeks: block.weeks.map((week) => week.id !== weekId ? week : {
          ...week,
          workouts: (week.workouts || []).map((workout) =>
            workout.id === workoutId ? { ...workout, ...patch } : workout
          )
        })
      })
    }));
  }

  const {
    createNewMonthProgramDraft,
    editExistingMonthProgram,
    importMonthProgramFromFile,
    importMonthProgramWithAi,
    refreshCurrentMonthProgram,
    saveMonthProgramAndOpenOverview,
    saveMonthProgramToLibrary,
    saveMonthWorkoutAndReturnToBlock,
    uploadMonthExerciseVideo
  } = createTrainerMonthProgramPersistenceHandlers({
    adminActiveProgramId,
    adminExerciseEditSnapshotRef,
    adminExerciseLibrary: monthAdminExerciseLibrary,
    adminOpenWorkoutId,
    adminSelectedExerciseId,
    adminSelectedTemplateId,
    adminTrainingTemplates,
    canManageTrainingTemplate,
    canUseAdminFeatures,
    db,
    getCurrentProgramOwner,
    loadAdminTrainingTemplates,
    monthProgram,
    normalizeMonthProgram,
    openAdminProgramsOverview,
    setAdminActiveProgramId,
    setAdminExerciseSearch,
    setAdminExerciseVideoUploadingId,
    setAdminOpenProgramBlocks,
    setAdminOpenProgramWeeks,
    setAdminOpenWorkoutId,
    setAdminProgramEditorMode,
    setAdminProgramGroups,
    setAdminProgramLibraryTab,
    setAdminSelectedExerciseId,
    setAdminSelectedTemplateId,
    setAdminTemplateName,
    setAdminTrainingTemplates,
    setMonthProgram,
    setPlan,
    showAppError,
    storage,
    user
  });

  const {
    addMonthExercise,
    addMonthExerciseSet,
    cancelMonthExerciseEdit,
    duplicateMonthExercise,
    moveMonthExercise,
    openMonthExerciseEditor,
    removeMonthExercise,
    removeMonthExerciseSet,
    saveMonthExerciseEdit,
    updateMonthExercise,
    updateMonthExerciseName,
    updateMonthExerciseSet
  } = createTrainerMonthExerciseHandlers({
    adminExerciseEditSnapshotRef,
    adminExerciseSearch,
    adminExerciseLibrary: monthAdminExerciseLibrary,
    monthWorkouts,
    saveMonthProgramToLibrary,
    setAdminExerciseSearch,
    setAdminSelectedExerciseId,
    updateMonthWorkout
  });

  const {
    deleteSelectedProgramFromLibrary,
    getTemplateStats,
    handleMonthProgramBack,
    openProgramFromLibrary
  } = createTrainerMonthProgramLibraryHandlers({
    adminOpenProgramBlocks,
    adminOpenWorkoutId,
    adminSelectedExerciseId,
    adminSelectedTemplateId,
    adminTrainingTemplates,
    canManageTrainingTemplate,
    cancelMonthExerciseEdit,
    db,
    editExistingMonthProgram,
    loadAdminTrainingTemplates,
    openAdminProgramsOverview,
    setAdminExerciseSearch,
    setAdminOpenProgramBlocks,
    setAdminOpenWorkoutId,
    setAdminProgramEditorMode,
    setAdminProgramLibraryTab,
    setAdminSelectedTemplateId,
    showAppConfirm,
    showAppError
  });

  const {
    deleteSelectedMonthExercise
  } = createTrainerMonthSelectedExerciseHandlers({
    adminActiveProgramId,
    adminExerciseEditSnapshotRef,
    adminSelectedExerciseId,
    adminSelectedTemplateId,
    db,
    openMonthWorkoutContext,
    removeMonthExercise,
    setAdminExerciseSearch,
    setAdminSelectedExerciseId,
    showAppConfirm,
    showAppError,
    updateMonthExercise
  });

  const programManagerView = (
    <TrainerProgramManagerView
      APP_PAGES={APP_PAGES}
      addMonthBlock={addMonthBlock}
      addMonthExercise={addMonthExercise}
      addMonthExerciseSet={addMonthExerciseSet}
      addMonthWeek={addMonthWeek}
      addMonthWorkout={addMonthWorkout}
      addProgramMonth={addProgramMonth}
      adminExerciseLibrary={monthAdminExerciseLibrary}
      adminExerciseSearch={adminExerciseSearch}
      adminExerciseVideoUploadingId={adminExerciseVideoUploadingId}
      adminOpenProgramBlocks={adminOpenProgramBlocks}
      adminOpenProgramWeeks={adminOpenProgramWeeks}
      adminOpenWorkoutId={adminOpenWorkoutId}
      adminProgramCopyTarget={adminProgramCopyTarget}
      adminProgramCreateChoiceOpen={adminProgramCreateChoiceOpen}
      adminProgramImportInputRef={adminProgramImportInputRef}
      adminProgramLibraryTab={adminProgramLibraryTab}
      adminProgramSwipeOpenKey={adminProgramSwipeOpenKey}
      adminSelectedExerciseId={adminSelectedExerciseId}
      adminSelectedTemplateId={adminSelectedTemplateId}
      adminTrainingTemplates={adminTrainingTemplates}
      canUseAdminFeatures={canUseAdminFeatures}
      cancelMonthExerciseEdit={cancelMonthExerciseEdit}
      confirmRemoveMonthWorkout={confirmRemoveMonthWorkout}
      copyMonthProgramBlock={copyMonthProgramBlock}
      createNewMonthProgramDraft={createNewMonthProgramDraft}
      deleteSelectedMonthExercise={deleteSelectedMonthExercise}
      deleteSelectedProgramFromLibrary={deleteSelectedProgramFromLibrary}
      duplicateMonthExercise={duplicateMonthExercise}
      duplicateMonthWorkout={duplicateMonthWorkout}
      getTemplateStats={getTemplateStats}
      handleAdminProgramSwipeCancel={handleAdminProgramSwipeCancel}
      handleAdminProgramSwipeClick={handleAdminProgramSwipeClick}
      handleAdminProgramSwipeEnd={handleAdminProgramSwipeEnd}
      handleAdminProgramSwipeStart={handleAdminProgramSwipeStart}
      handleMonthProgramBack={handleMonthProgramBack}
      importMonthProgramFromFile={importMonthProgramFromFile}
      importMonthProgramWithAi={importMonthProgramWithAi}
      isTrainerNextWorkspace={isTrainerNextWorkspace}
      loadAdminTrainingTemplates={loadAdminTrainingTemplates}
      loadHistory={loadHistory}
      monthBlocks={monthBlocks}
      monthGroups={monthGroups}
      monthProgram={monthProgram}
      moveMonthExercise={moveMonthExercise}
      normalizedMonthProgram={normalizedMonthProgram}
      openAdminClientsWithFilter={openAdminClientsWithFilter}
      openAdminProgramsOverview={openAdminProgramsOverview}
      openCopyMonthProgramBlock={openCopyMonthProgramBlock}
      openMonthExerciseEditor={openMonthExerciseEditor}
      openMonthWorkoutContext={openMonthWorkoutContext}
      openProgramFromLibrary={openProgramFromLibrary}
      refreshCurrentMonthProgram={refreshCurrentMonthProgram}
      removeMonthBlock={removeMonthBlock}
      removeMonthExercise={removeMonthExercise}
      removeMonthExerciseSet={removeMonthExerciseSet}
      removeMonthWeek={removeMonthWeek}
      removeProgramMonth={removeProgramMonth}
      renderTrainerWorkspaceBottomBar={renderTrainerWorkspaceBottomBar}
      saveMonthExerciseEdit={saveMonthExerciseEdit}
      saveMonthProgramAndOpenOverview={saveMonthProgramAndOpenOverview}
      saveMonthProgramToLibrary={saveMonthProgramToLibrary}
      saveMonthWorkoutAndReturnToBlock={() => saveMonthWorkoutAndReturnToBlock(handleMonthProgramBack)}
      setAdminExerciseSearch={setAdminExerciseSearch}
      setAdminOpenWorkoutId={setAdminOpenWorkoutId}
      setAdminProgramCopyTarget={setAdminProgramCopyTarget}
      setAdminProgramCreateChoiceOpen={setAdminProgramCreateChoiceOpen}
      setAdminSelectedExerciseId={setAdminSelectedExerciseId}
      setAdminSelectedTemplateId={setAdminSelectedTemplateId}
      setPage={setPage}
      setProfileActiveTab={setProfileActiveTab}
      setSelectedUserId={setSelectedUserId}
      setTrainerProgramManagerOpen={setTrainerProgramManagerOpen}
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
  );

  if (isTrainerNextWorkspace()) {
    const trainerName = telegramProfile.displayName ||
      auth.currentUser?.displayName ||
      auth.currentUser?.email?.split("@")?.[0] ||
      "Тренер";

    return (
      <TrainerShell
        appVersion={APP_VERSION}
        activeSection="workouts"
        onNavigate={navigateTrainerNext}
        trainerName={trainerName}
        trainerAvatar={telegramProfile.avatarUrl}
      >
        <div className="trainerNextPage trainerNextWorkoutPage trainerNextProgramsTab">
          <div className="trainerNextDesktopPageHead">
            <div>
              <h1>{adminProgramLibraryTab === "editor" ? "Редактор программы" : "Программы тренировок"}</h1>
              <p>Создание программ и назначение клиентам</p>
            </div>
          </div>
          <header className="trainerNextMobileHeader">
            <div className="trainerNextMobileTitle">{adminProgramLibraryTab === "editor" ? "Редактор программы" : "Библиотека программ"}</div>
          </header>
          <div className="trainerNextPageTabs">
            <button type="button" className="active" aria-pressed="true">Программы</button>
            <button type="button" onClick={openTrainerExerciseLibrary}>Библиотека упражнений</button>
          </div>
          {programManagerView}
        </div>
      </TrainerShell>
    );
  }

  return programManagerView;
}
