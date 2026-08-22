import { TrainerShell } from "../../components/trainer/TrainerWorkspace";
import AdminWorkspace from "../../components/admin/AdminWorkspace";
import { ChevronLeft } from "lucide-react";
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
import materialsStyles from "./AdminTrainerMaterialsShell.module.css";

function hasAdminAccess(canUseAdminFeatures) {
  return typeof canUseAdminFeatures === "function"
    ? canUseAdminFeatures()
    : Boolean(canUseAdminFeatures);
}

function isTrainerAccount(user) {
  return ["trainer", "coach", "тренер", "коуч"].includes(
    String(user?.role || "").trim().toLocaleLowerCase("ru")
  );
}

function getUserLabel(user) {
  return String(
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.email?.split("@")?.[0] ||
    "Тренер"
  ).trim() || "Тренер";
}

export default function TrainerAdminWorkoutsRoute({
  APP_PAGES,
  APP_VERSION,
  adminEmail,
  adminActiveDayId,
  adminActiveProgramId,
  adminClientStatus,
  adminExerciseEditSnapshotRef,
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
  logout,
  navigateTrainerNext,
  openAdminBaseLibrary,
  openAdminClientsWithFilter,
  openAdminProgramsOverview,
  openProfileAccount,
  openTrainerExerciseLibrary,
  openTrainerProgramManager,
  plan,
  renderTrainerWorkspaceBottomBar,
  saveTrainerClientWorkoutSchedule,
  saveWorkoutsToFirebase,
  setAdminActiveDayId,
  setAdminActiveProgramId,
  setAdminClientPageOpen,
  setAdminClientStatus,
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
  setAdminSelectedClient,
  setAdminSelectedTemplateId,
  setAdminTemplateName,
  setAdminTrainingTemplates,
  setPage,
  setPlan,
  setProfileActiveTab,
  setSelectedUserId,
  selectedUserId,
  setTrainerProgramManagerOpen,
  setTrainerWorkoutTab,
  showAppConfirm,
  showAppError,
  sortWorkoutDays,
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
  const selectedTrainer = adminSelectedClient || selectedUser || null;
  const selectedTrainerId = String(selectedTrainer?.id || selectedTrainer?.uid || "").trim();
  const isAdminTrainerMaterials = hasAdminAccess(canUseAdminFeatures) && isTrainerAccount(selectedTrainer);
  const trainerMaterialsName = getUserLabel(selectedTrainer);

  const clearAdminTrainerMaterialsState = () => {
    setTrainerProgramManagerOpen?.(false);
    setAdminClientStatus?.("");
    setAdminClientPageOpen?.(false);
  };

  const returnToTrainerProfile = () => {
    clearAdminTrainerMaterialsState();
    setTrainerWorkoutTab?.("programs");
    setAdminSelectedClient?.(selectedTrainer);
    if (selectedTrainerId) setSelectedUserId?.(selectedTrainerId);
    setPage?.(APP_PAGES.ADMIN_USERS);
  };

  const openAdminWorkspaceSection = (sectionId) => {
    clearAdminTrainerMaterialsState();

    if (sectionId === "overview") {
      setAdminSelectedClient?.(null);
      setPage?.(APP_PAGES.ADMIN_PANEL);
      return;
    }

    if (sectionId === "users") {
      setAdminSelectedClient?.(null);
      if (typeof openAdminClientsWithFilter === "function") {
        openAdminClientsWithFilter("all");
        return;
      }
      setPage?.(APP_PAGES.ADMIN_USERS);
      return;
    }

    const tab = sectionId === "exercises" ? "exercises" : "programs";
    setAdminSelectedClient?.(null);
    if (typeof openAdminBaseLibrary === "function") {
      openAdminBaseLibrary(tab);
      return;
    }
    setPage?.(APP_PAGES.ADMIN_LIBRARY);
  };

  const renderAdminTrainerMaterials = (content) => {
    if (!isAdminTrainerMaterials) return content;

    return (
      <AdminWorkspace
        activeSection="users"
        adminEmail={adminEmail || user?.email || ""}
        adminMeta="Системное управление"
        adminName={getUserLabel(user)}
        headerTitle="Материалы тренера"
        onLogout={logout}
        onProfileClick={openProfileAccount}
        onSectionChange={openAdminWorkspaceSection}
        subtitle={`Личные программы и упражнения: ${trainerMaterialsName}`}
        testId="admin-trainer-materials-workspace"
        title="Админка"
      >
        <div className={materialsStyles.root}>
          <button className={materialsStyles.breadcrumb} type="button" onClick={returnToTrainerProfile}>
            <ChevronLeft aria-hidden="true" size={18} strokeWidth={2} />
            <span>К профилю тренера</span>
          </button>
          <div className={materialsStyles.content}>{content}</div>
        </div>
      </AdminWorkspace>
    );
  };

  if (isTrainerNextWorkspace() && !trainerProgramManagerOpen) {
    const trainerName = telegramProfile.displayName ||
      auth.currentUser?.displayName ||
      auth.currentUser?.email?.split("@")?.[0] ||
      "Trainer";

    return renderAdminTrainerMaterials(
      <TrainerAdminWorkoutsNextRoute
        APP_VERSION={APP_VERSION}
        trainerName={trainerName}
        adminClientStatus={adminClientStatus}
        adminExerciseVideoUploadingId={adminExerciseVideoUploadingId}
        adminSelectedClient={adminSelectedClient}
        adminSelectedTemplateId={adminSelectedTemplateId}
        adminTrainingTemplates={adminTrainingTemplates}
        assignSavedProgramToClient={assignSavedProgramToClient}
        canUseAdminFeatures={canUseAdminFeatures}
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
        setTrainerProgramManagerOpen={setTrainerProgramManagerOpen}
        setTrainerWorkoutTab={setTrainerWorkoutTab}
        sortWorkoutDays={sortWorkoutDays}
        telegramProfile={telegramProfile}
        trainerExerciseLibraryItems={trainerExerciseLibraryItems}
        trainerNextWorkspaceHandlers={trainerNextWorkspaceHandlers}
        trainerWorkoutTab={trainerWorkoutTab}
        usersList={usersList}
        embedded={isAdminTrainerMaterials}
      />
    );
  }

  const monthProgram = adminProgramGroups?.[0] || {
    id: "month_default",
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

  function restoreMonthProgramDraft(draft = {}) {
    const sourceProgram = draft?.program;
    if (!sourceProgram || typeof sourceProgram !== "object" || !sourceProgram.id) return false;

    const nextProgram = normalizeMonthProgram(sourceProgram);
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
    const isExistingProgram = draft.editorMode === "edit";

    setAdminProgramEditorMode(isExistingProgram ? "edit" : "create");
    setAdminProgramLibraryTab("editor");
    setAdminOpenWorkoutId("");
    setAdminSelectedExerciseId("");
    setAdminExerciseSearch("");
    adminExerciseEditSnapshotRef.current = null;
    setAdminOpenProgramBlocks({});
    setAdminOpenProgramWeeks({});
    setAdminActiveProgramId(nextProgram.id);
    setAdminSelectedTemplateId(isExistingProgram ? nextProgram.id : "");
    setAdminProgramGroups([nextProgram]);
    setPlan({ workouts: flatWorkouts });
    return true;
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
    duplicateMonthProgramFromLibrary,
    editExistingMonthProgram,
    importMonthProgramFromFile,
    importMonthProgramWithAi,
    prepareMonthProgramForAssignment,
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
      duplicateMonthProgramFromLibrary={duplicateMonthProgramFromLibrary}
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
      prepareMonthProgramForAssignment={prepareMonthProgramForAssignment}
      refreshCurrentMonthProgram={refreshCurrentMonthProgram}
      removeMonthBlock={removeMonthBlock}
      removeMonthExercise={removeMonthExercise}
      removeMonthExerciseSet={removeMonthExerciseSet}
      removeMonthWeek={removeMonthWeek}
      removeProgramMonth={removeProgramMonth}
      renderTrainerWorkspaceBottomBar={renderTrainerWorkspaceBottomBar}
      restoreMonthProgramDraft={restoreMonthProgramDraft}
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

    const programPage = (
      <div className="trainerNextPage trainerNextWorkoutPage trainerNextProgramsTab">
        <div className="trainerNextDesktopPageHead">
          <div>
            <h1>{adminProgramLibraryTab === "editor" ? "Редактор программы" : "Программы тренировок"}</h1>
            <p>Создание программ и назначение клиентам</p>
          </div>
        </div>
        <header className="trainerNextMobileHeader">
          {adminProgramLibraryTab === "editor" ? (
            <button type="button" onClick={handleMonthProgramBack} aria-label="Назад к программам">
              <ChevronLeft size={22} />
            </button>
          ) : <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />}
          <div className="trainerNextMobileTitle">{adminProgramLibraryTab === "editor" ? "Редактор программы" : "Библиотека программ"}</div>
          <span className="trainerNextMobileHeaderSpacer" aria-hidden="true" />
        </header>
        {adminProgramLibraryTab !== "editor" ? (
          <div className="trainerNextPageTabs">
            <button
              type="button"
              className="isActive"
              aria-current="page"
              aria-pressed="true"
              onClick={openAdminProgramsOverview}
            >
              Программы
            </button>
            <button type="button" aria-pressed="false" onClick={openTrainerExerciseLibrary}>
              Библиотека упражнений
            </button>
          </div>
        ) : null}
        {programManagerView}
      </div>
    );

    if (isAdminTrainerMaterials) {
      return renderAdminTrainerMaterials(
        <div className={`trainerNextRoot ${materialsStyles.programManager}`}>{programPage}</div>
      );
    }

    return (
      <TrainerShell
        appVersion={APP_VERSION}
        activeSection="workouts"
        onNavigate={navigateTrainerNext}
        trainerName={trainerName}
        trainerAvatar={telegramProfile.avatarUrl}
      >
        {programPage}
      </TrainerShell>
    );
  }

  return programManagerView;
}
