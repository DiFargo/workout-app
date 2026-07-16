import styles from "./TrainerProgramManagerBottomControls.module.css";

export default function TrainerProgramManagerBottomControls({
  adminOpenWorkoutId,
  adminProgramImportInputRef,
  adminProgramLibraryTab,
  adminSelectedExerciseId,
  deleteSelectedMonthExercise,
  deleteSelectedProgramFromLibrary,
  handleMonthProgramBack,
  importMonthProgramFromFile,
  isTrainerNextWorkspace,
  loadHistory,
  openAdminClientsWithFilter,
  openAdminProgramsOverview,
  openMonthWorkoutContext,
  refreshCurrentMonthProgram,
  renderTrainerWorkspaceBottomBar,
  saveMonthProgramAndOpenOverview,
  saveMonthWorkoutAndReturnToBlock,
  setPage,
  setProfileActiveTab,
  setSelectedUserId,
  addMonthExercise,
  APP_PAGES
}) {
  return (
    <>
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
      {isTrainerNextWorkspace() ? null : adminSelectedExerciseId ? null : adminOpenWorkoutId && openMonthWorkoutContext ? (
        <nav className="adminV3Nav adminV3BottomBar workoutEditorBottomBar" aria-label="Редактор тренировки">
          <button type="button" onClick={handleMonthProgramBack}>
            <span className="adminV3NavIcon">←</span>
            <span className="adminV3NavLabel">К микроциклу</span>
          </button>
          <button
            type="button"
            onClick={() => addMonthExercise(
              openMonthWorkoutContext.block.id,
              openMonthWorkoutContext.week.id,
              openMonthWorkoutContext.workout.id
            )}
          >
            <span className="adminV3NavIcon">＋</span>
            <span className="adminV3NavLabel">Упражнение</span>
          </button>
          <button className="workoutEditorBottomBarDelete" type="button" onClick={deleteSelectedMonthExercise}>
            <span className="adminV3NavIcon">×</span>
            <span className="adminV3NavLabel">Удалить</span>
          </button>
          <button type="button" onClick={saveMonthWorkoutAndReturnToBlock}>
            <span className="adminV3NavIcon">💾</span>
            <span className="adminV3NavLabel">Сохранить</span>
          </button>
        </nav>
      ) : adminProgramLibraryTab === "editor" ? (
        <nav className="adminV3Nav adminV3BottomBar programEditorBottomBar" aria-label="Редактор программы">
          <button type="button" onClick={openAdminProgramsOverview}>
            <span className="adminV3NavIcon">←</span>
            <span className="adminV3NavLabel">Назад</span>
          </button>
          <button type="button" onClick={refreshCurrentMonthProgram}>
            <span className="adminV3NavIcon">↻</span>
            <span className="adminV3NavLabel">Обновить</span>
          </button>
          <button className="programEditorBottomBarDelete" type="button" onClick={deleteSelectedProgramFromLibrary}>
            <span className="adminV3NavIcon">×</span>
            <span className="adminV3NavLabel">Удалить</span>
          </button>
          <button className="programEditorBottomBarSave" type="button" onClick={saveMonthProgramAndOpenOverview}>
            <span className="adminV3NavIcon">💾</span>
            <span className="adminV3NavLabel">Сохранить</span>
          </button>
        </nav>
      ) : (
        isTrainerNextWorkspace() ? null : renderTrainerWorkspaceBottomBar("programs", {
          onGoMain: () => {
            setSelectedUserId(null);
            setPage(APP_PAGES.ADMIN);
          },
          onOpenTrainerClients: () => openAdminClientsWithFilter("all"),
          onOpenTrainerPrograms: openAdminProgramsOverview,
          onLoadTrainerCabinet: () => {
            loadHistory();
            setProfileActiveTab("cabinet");
            setPage(APP_PAGES.PROFILE);
          }
        })
      )}
    </>
  );
}
