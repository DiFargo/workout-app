import { useEffect, useRef, useState } from "react";
import { TrainerProgramConstructorStyleScope } from "../../components/trainer/TrainerWorkspace";
import TrainerProgramConstructor from "../../components/trainer/TrainerProgramConstructor";
import { Check, Save, Trash2, X } from "lucide-react";
import TrainerProgramCopySheet from "./TrainerProgramCopySheet";
import TrainerProgramLegacyEditor from "./TrainerProgramLegacyEditor";
import TrainerProgramManagerBottomControls from "./TrainerProgramManagerBottomControls";
import TrainerProgramManagerHeader from "./TrainerProgramManagerHeader";
import TrainerProgramOverviewPage from "./TrainerProgramOverviewPage";
import styles from "./TrainerProgramManagerView.module.css";
import "../../components/trainer/TrainerWorkspaceModalSystem.module.css";
import {
  clearTrainerProgramEditorDraft,
  getTrainerProgramEditorDraftKey,
  getTrainerProgramEditorDraftOwner,
  readTrainerProgramEditorDraft,
  saveTrainerProgramEditorDraft
} from "../../utils/trainerProgramEditorDraft";

export function getTrainerProgramEditorSnapshot(program) {
  return JSON.stringify(program || null);
}

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
  duplicateMonthProgramFromLibrary,
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
  prepareMonthProgramForAssignment,
  refreshCurrentMonthProgram,
  removeMonthBlock,
  removeMonthExercise,
  removeMonthExerciseSet,
  removeMonthWeek,
  removeProgramMonth,
  renderTrainerWorkspaceBottomBar,
  restoreMonthProgramDraft,
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
  const isEditorModalOpen = isNextWorkspace && adminProgramLibraryTab === "editor";
  const [editorSaveState, setEditorSaveState] = useState("idle");
  const [editorExitConfirmOpen, setEditorExitConfirmOpen] = useState(false);
  const [editorDraftRecovery, setEditorDraftRecovery] = useState(null);
  const editorSaveCloseTimerRef = useRef(null);
  const editorDraftSaveTimerRef = useRef(null);
  const editorInitialSnapshotRef = useRef(null);
  const editorProgramIdentityRef = useRef("");
  const editorLatestProgramRef = useRef(null);
  const editorDraftContextRef = useRef(null);
  const editorDraftRecoveryKeyRef = useRef("");
  const editorDraftShouldPersistRef = useRef(false);
  const isEditorSaveInProgress = editorSaveState !== "idle";
  const editorProgramIdentity = String(normalizedMonthProgram?.id || "");
  const isPersistedEditorProgram = adminTrainingTemplates.some(
    (template) => template.id === normalizedMonthProgram?.id
  );
  const editorDraftOwnerUid = getTrainerProgramEditorDraftOwner(normalizedMonthProgram);
  const editorDraftEditorMode = isPersistedEditorProgram ? "edit" : "create";
  const editorDraftKey = getTrainerProgramEditorDraftKey({
    ownerUid: editorDraftOwnerUid,
    programId: editorProgramIdentity
  });
  const hasEditorUnsavedChanges = Boolean(
    isEditorModalOpen
    && editorInitialSnapshotRef.current !== null
    && editorInitialSnapshotRef.current !== getTrainerProgramEditorSnapshot(normalizedMonthProgram)
  );

  function clearCurrentEditorDraft() {
    const context = editorDraftContextRef.current;
    if (!context?.programId) return;
    clearTrainerProgramEditorDraft({
      ownerUid: context.ownerUid,
      programId: context.programId
    });
  }

  function persistCurrentEditorDraft() {
    const context = editorDraftContextRef.current;
    const program = editorLatestProgramRef.current;
    if (!context?.programId || !program || String(program.id || "") !== context.programId) return false;

    const snapshot = getTrainerProgramEditorSnapshot(program);
    if (!context.initialSnapshot || snapshot === context.initialSnapshot) return false;

    return saveTrainerProgramEditorDraft({
      program,
      ownerUid: context.ownerUid,
      editorMode: context.editorMode
    });
  }

  useEffect(() => () => {
    if (editorSaveCloseTimerRef.current) window.clearTimeout(editorSaveCloseTimerRef.current);
    if (editorDraftSaveTimerRef.current) window.clearTimeout(editorDraftSaveTimerRef.current);
    if (editorDraftShouldPersistRef.current) persistCurrentEditorDraft();
  }, []);

  useEffect(() => {
    if (isEditorModalOpen || editorSaveState === "idle") return;
    if (editorSaveCloseTimerRef.current) window.clearTimeout(editorSaveCloseTimerRef.current);
    editorSaveCloseTimerRef.current = null;
  }, [editorSaveState, isEditorModalOpen]);

  useEffect(() => {
    if (!isEditorModalOpen) {
      if (editorDraftShouldPersistRef.current) persistCurrentEditorDraft();
      if (editorDraftSaveTimerRef.current) window.clearTimeout(editorDraftSaveTimerRef.current);
      editorDraftSaveTimerRef.current = null;
      editorInitialSnapshotRef.current = null;
      editorProgramIdentityRef.current = "";
      editorLatestProgramRef.current = null;
      editorDraftContextRef.current = null;
      editorDraftRecoveryKeyRef.current = "";
      editorDraftShouldPersistRef.current = false;
      setEditorExitConfirmOpen(false);
      setEditorDraftRecovery(null);
      return;
    }

    if (
      editorInitialSnapshotRef.current === null
      || editorProgramIdentityRef.current !== editorProgramIdentity
    ) {
      editorInitialSnapshotRef.current = getTrainerProgramEditorSnapshot(normalizedMonthProgram);
      editorProgramIdentityRef.current = editorProgramIdentity;
    }

    editorLatestProgramRef.current = normalizedMonthProgram;
    editorDraftContextRef.current = {
      ownerUid: editorDraftOwnerUid,
      programId: editorProgramIdentity,
      editorMode: editorDraftEditorMode,
      initialSnapshot: editorInitialSnapshotRef.current
    };
    editorDraftShouldPersistRef.current = true;
  }, [
    editorDraftEditorMode,
    editorDraftOwnerUid,
    editorProgramIdentity,
    isEditorModalOpen,
    normalizedMonthProgram
  ]);

  useEffect(() => {
    if (
      !isEditorModalOpen ||
      !editorProgramIdentity ||
      editorDraftRecoveryKeyRef.current === editorDraftKey ||
      typeof restoreMonthProgramDraft !== "function"
    ) return;

    editorDraftRecoveryKeyRef.current = editorDraftKey;
    const draft = readTrainerProgramEditorDraft({
      ownerUid: editorDraftOwnerUid,
      programId: editorProgramIdentity
    });
    if (!draft || getTrainerProgramEditorSnapshot(draft.program) === getTrainerProgramEditorSnapshot(normalizedMonthProgram)) {
      return;
    }

    setEditorDraftRecovery(draft);
  }, [
    editorDraftKey,
    editorDraftOwnerUid,
    editorProgramIdentity,
    isEditorModalOpen,
    normalizedMonthProgram,
    restoreMonthProgramDraft
  ]);

  useEffect(() => {
    if (!isEditorModalOpen || !hasEditorUnsavedChanges || editorDraftRecovery) return undefined;

    if (editorDraftSaveTimerRef.current) window.clearTimeout(editorDraftSaveTimerRef.current);
    editorDraftSaveTimerRef.current = window.setTimeout(() => {
      editorDraftSaveTimerRef.current = null;
      persistCurrentEditorDraft();
    }, 280);

    return () => {
      if (editorDraftSaveTimerRef.current) window.clearTimeout(editorDraftSaveTimerRef.current);
      editorDraftSaveTimerRef.current = null;
    };
  }, [editorDraftKey, editorDraftRecovery, hasEditorUnsavedChanges, isEditorModalOpen, normalizedMonthProgram]);

  useEffect(() => {
    if (!isEditorModalOpen || !hasEditorUnsavedChanges) return undefined;

    const persistBeforeUnload = (event) => {
      persistCurrentEditorDraft();
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", persistBeforeUnload);
    return () => window.removeEventListener("beforeunload", persistBeforeUnload);
  }, [hasEditorUnsavedChanges, isEditorModalOpen, normalizedMonthProgram]);

  function finalizeEditorClose({ restoreSavedProgram = false } = {}) {
    if (editorSaveCloseTimerRef.current) window.clearTimeout(editorSaveCloseTimerRef.current);
    editorSaveCloseTimerRef.current = null;
    editorInitialSnapshotRef.current = null;
    editorProgramIdentityRef.current = "";
    setEditorExitConfirmOpen(false);
    setEditorSaveState("idle");
    openAdminProgramsOverview();

    if (restoreSavedProgram) {
      void refreshCurrentMonthProgram();
    }
  }

  function closeEditor() {
    if (isEditorSaveInProgress) return;
    if (hasEditorUnsavedChanges) {
      persistCurrentEditorDraft();
      setEditorExitConfirmOpen(true);
      return;
    }
    finalizeEditorClose();
  }

  function discardEditorChanges() {
    editorDraftShouldPersistRef.current = false;
    clearCurrentEditorDraft();
    finalizeEditorClose({ restoreSavedProgram: isPersistedEditorProgram });
  }

  function dismissEditorDraftRecovery() {
    clearTrainerProgramEditorDraft({
      ownerUid: editorDraftRecovery?.ownerUid || editorDraftOwnerUid,
      programId: editorDraftRecovery?.programId || editorProgramIdentity
    });
    setEditorDraftRecovery(null);
  }

  function recoverEditorDraft() {
    if (!editorDraftRecovery || typeof restoreMonthProgramDraft !== "function") return;
    const restored = restoreMonthProgramDraft(editorDraftRecovery);
    if (restored === false) return;
    setEditorDraftRecovery(null);
  }

  async function handleEditorProgramSave() {
    if (isEditorSaveInProgress) return;

    if (hasEditorUnsavedChanges) persistCurrentEditorDraft();
    setEditorSaveState("saving");
    try {
      const saved = await saveMonthProgramToLibrary();
      if (saved === false) {
        setEditorSaveState("idle");
        return;
      }

      setEditorSaveState("saved");
      editorDraftShouldPersistRef.current = false;
      clearCurrentEditorDraft();
      editorInitialSnapshotRef.current = getTrainerProgramEditorSnapshot(normalizedMonthProgram);
      editorSaveCloseTimerRef.current = window.setTimeout(() => {
        editorSaveCloseTimerRef.current = null;
        finalizeEditorClose();
      }, 420);
    } catch (error) {
      console.error("Save program editor error:", error);
      setEditorSaveState("idle");
    }
  }

  const nextProgramConstructor = isNextWorkspace ? (
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
        onSaveProgram={handleEditorProgramSave}
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
        onMoveExercise={moveMonthExercise}
        onUpdateExerciseSet={updateMonthExerciseSet}
        onAddExerciseSet={addMonthExerciseSet}
        onRemoveExerciseSet={removeMonthExerciseSet}
        onUploadExerciseVideo={uploadMonthExerciseVideo}
        exerciseVideoUploadingId={adminExerciseVideoUploadingId}
        showProgramActions={false}
        embeddedInModal={isEditorModalOpen}
      />}
    </TrainerProgramConstructorStyleScope>
  ) : null;

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

      {adminProgramLibraryTab === "overview" || isEditorModalOpen ? (
        <TrainerProgramOverviewPage
          adminProgramCreateChoiceOpen={adminProgramCreateChoiceOpen}
          adminProgramImportInputRef={adminProgramImportInputRef}
          adminSelectedTemplateId={adminSelectedTemplateId}
          adminTrainingTemplates={adminTrainingTemplates}
          canUseAdminFeatures={canUseAdminFeatures}
          createNewMonthProgramDraft={createNewMonthProgramDraft}
          deleteSelectedProgramFromLibrary={deleteSelectedProgramFromLibrary}
          duplicateMonthProgramFromLibrary={duplicateMonthProgramFromLibrary}
          getTemplateStats={getTemplateStats}
          importMonthProgramWithAi={importMonthProgramWithAi}
          isTrainerNextWorkspace={isTrainerNextWorkspace}
          onGoAdmin={() => setPage(APP_PAGES.ADMIN)}
          openProgramFromLibrary={openProgramFromLibrary}
          prepareMonthProgramForAssignment={prepareMonthProgramForAssignment}
          setAdminProgramCreateChoiceOpen={setAdminProgramCreateChoiceOpen}
          setAdminSelectedTemplateId={setAdminSelectedTemplateId}
        />
      ) : !isNextWorkspace ? (
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
      ) : null}

      {isEditorModalOpen ? (
        <div
          className={styles.editorModalBackdrop}
          data-trainer-modal-backdrop="true"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isEditorSaveInProgress) closeEditor();
          }}
        >
          <section
            className={styles.editorModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trainer-program-editor-modal-title"
            data-modal-surface="true"
            data-trainer-modal-surface="true"
            data-trainer-modal-frame="true"
            aria-busy={isEditorSaveInProgress}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.editorModalHeader} data-trainer-modal-header="true">
              <div>
                <span>РЕДАКТОР ПРОГРАММЫ</span>
                <h2 id="trainer-program-editor-modal-title">{normalizedMonthProgram?.name || "Программа тренировок"}</h2>
              </div>
              <button className={styles.editorModalClose} type="button" onClick={closeEditor} disabled={isEditorSaveInProgress} aria-label="Закрыть редактор программы">
                <X size={20} />
              </button>
            </header>
            <div className={`${styles.editorModalBody} ${styles.editorModalBodyProgram}`} data-trainer-modal-content="true">{nextProgramConstructor}</div>
            <footer className={styles.editorModalFooter} data-trainer-modal-footer="true">
              <button className={styles.editorModalDelete} type="button" onClick={deleteSelectedProgramFromLibrary} disabled={isEditorSaveInProgress}>
                <Trash2 size={17} />Удалить
              </button>
              <button
                className={`${styles.editorModalSave}${editorSaveState === "saving" ? ` ${styles.editorModalSaveSaving}` : ""}${editorSaveState === "saved" ? ` ${styles.editorModalSaveSaved}` : ""}`}
                type="button"
                disabled={isEditorSaveInProgress}
                onClick={handleEditorProgramSave}
              >
                {editorSaveState === "saved" ? <Check size={17} /> : <Save size={17} />}
                {editorSaveState === "saving" ? "Сохраняю…" : editorSaveState === "saved" ? "Сохранено" : "Сохранить"}
              </button>
            </footer>
          </section>
          {editorDraftRecovery && !editorExitConfirmOpen ? (
            <div
              className={styles.editorExitConfirmBackdrop}
              role="presentation"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <section
                className={styles.editorExitConfirm}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="trainer-program-editor-recovery-title"
                aria-describedby="trainer-program-editor-recovery-description"
                onMouseDown={(event) => event.stopPropagation()}
              >
              <span className={styles.editorExitConfirmEyebrow}>НЕСОХРАНЁННЫЕ ИЗМЕНЕНИЯ В БРАУЗЕРЕ</span>
                <h3 id="trainer-program-editor-recovery-title">Восстановить несохранённые изменения?</h3>
                <p id="trainer-program-editor-recovery-description">
                В этом браузере найдена более поздняя несохранённая версия программы. Можно восстановить её или продолжить с сохранённой версией.
                </p>
                <div className={`${styles.editorExitConfirmActions} ${styles.editorDraftRecoveryActions}`}>
                  <button type="button" onClick={dismissEditorDraftRecovery}>
                  Продолжить с сохранённой
                  </button>
                  <button type="button" onClick={recoverEditorDraft}>
                  <Save size={16} />Восстановить изменения
                  </button>
                </div>
              </section>
            </div>
          ) : null}
          {editorExitConfirmOpen ? (
            <div
              className={styles.editorExitConfirmBackdrop}
              role="presentation"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <section
                className={styles.editorExitConfirm}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="trainer-program-editor-exit-title"
                aria-describedby="trainer-program-editor-exit-description"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <span className={styles.editorExitConfirmEyebrow}>РЕДАКТОР ПРОГРАММЫ</span>
                <h3 id="trainer-program-editor-exit-title">Есть несохранённые изменения</h3>
                <p id="trainer-program-editor-exit-description">
                  Сохраните программу, чтобы не потерять добавленные тренировки и упражнения.
                </p>
                <div className={styles.editorExitConfirmActions}>
                  <button type="button" onClick={() => setEditorExitConfirmOpen(false)}>
                    Продолжить редактирование
                  </button>
                  <button type="button" onClick={discardEditorChanges}>
                    Выйти без сохранения
                  </button>
                  <button type="button" onClick={handleEditorProgramSave}>
                    <Save size={16} />Сохранить и выйти
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      ) : null}

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
