import TrainerProgramUnsavedDialog from "../../components/trainer/TrainerProgramUnsavedDialog";
import TrainerEditorSheet from "../../components/trainer/TrainerEditorSheet.jsx";
import { useEffect, useRef, useState } from "react";
import { TrainerProgramConstructorStyleScope } from "../../components/trainer/TrainerWorkspace";
import TrainerProgramConstructor from "../../components/trainer/TrainerProgramConstructor";
import { Check, Save, Settings2, Trash2, X } from "lucide-react";
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

import { getTrainerProgramEditorSnapshot } from "../../utils/trainerProgramEditorSnapshot.js";

export default function TrainerProgramManagerView(props) {
  const editing = props.isTrainerNextWorkspace() && props.adminProgramLibraryTab === "editor";
  return <TrainerProgramManagerSession key={`${props.normalizedMonthProgram?.id || ""}:${editing}`} {...props} />;
}

function TrainerProgramManagerSession({
  usersList = [],
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
  trainerLibraryLoadState,
  onRetryLibrary,
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
  openTrainerExerciseLibrary,
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
  updateMonthProgramTestFlag,
  updateMonthWorkout,
  updateProgramMonth,
  uploadMonthExerciseVideo
}) {
  const isNextWorkspace = isTrainerNextWorkspace();
  const isEditorModalOpen = isNextWorkspace && adminProgramLibraryTab === "editor";
  const [editorSaveState, setEditorSaveState] = useState("idle");
  const [editorSaveError, setEditorSaveError] = useState("");
  const [editorExitConfirmOpen, setEditorExitConfirmOpen] = useState(false);
  const [editorLibraryRequested, setEditorLibraryRequested] = useState(false);
  const [templateSettingsOpen, setTemplateSettingsOpen] = useState(false);
  const [editorDraftRecovery, setEditorDraftRecovery] = useState(() => {
    if (!isEditorModalOpen || typeof restoreMonthProgramDraft !== "function") return null;
    const draft = readTrainerProgramEditorDraft({
      ownerUid: getTrainerProgramEditorDraftOwner(normalizedMonthProgram),
      programId: String(normalizedMonthProgram?.id || "")
    });
    return draft && getTrainerProgramEditorSnapshot(draft.program) !== getTrainerProgramEditorSnapshot(normalizedMonthProgram)
      ? draft : null;
  });
  const [editorInitialSnapshot, setEditorInitialSnapshot] = useState(() => isEditorModalOpen
    ? getTrainerProgramEditorSnapshot(normalizedMonthProgram) : null);
  const editorSaveCloseTimerRef = useRef(null);
  const editorDraftSaveTimerRef = useRef(null);
  const editorUploadSessionRef = useRef(Symbol("program-editor-upload-session"));
  const editorLatestProgramRef = useRef(null);
  const editorDraftContextRef = useRef(null);
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
    && editorInitialSnapshot !== null
    && editorInitialSnapshot !== getTrainerProgramEditorSnapshot(normalizedMonthProgram)
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
    editorUploadSessionRef.current = null;
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
    if (!isEditorModalOpen) return;
    if (!editorUploadSessionRef.current) editorUploadSessionRef.current = Symbol("program-editor-upload-session");

    editorLatestProgramRef.current = normalizedMonthProgram;
    editorDraftContextRef.current = {
      ownerUid: editorDraftOwnerUid,
      programId: editorProgramIdentity,
      editorMode: editorDraftEditorMode,
      initialSnapshot: editorInitialSnapshot
    };
    editorDraftShouldPersistRef.current = true;
  }, [
    editorDraftEditorMode,
    editorDraftOwnerUid,
    editorInitialSnapshot,
    editorProgramIdentity,
    isEditorModalOpen,
    normalizedMonthProgram
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
    setEditorInitialSnapshot(null);
    editorUploadSessionRef.current = null;
    setEditorExitConfirmOpen(false);
    setEditorSaveState("idle");
    setEditorLibraryRequested(false);
    if (editorLibraryRequested) openTrainerExerciseLibrary?.();
    else openAdminProgramsOverview();

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

  function openLibraryFromEditor() {
    if (isEditorSaveInProgress) return;
    if (hasEditorUnsavedChanges) {
      persistCurrentEditorDraft();
      setEditorLibraryRequested(true);
      setEditorExitConfirmOpen(true);
      return;
    }
    openTrainerExerciseLibrary?.();
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
    if (isEditorSaveInProgress || adminExerciseVideoUploadingId) return;

    if (hasEditorUnsavedChanges) persistCurrentEditorDraft();
    setEditorSaveError("");
    setEditorSaveState("saving");
    try {
      const saved = await saveMonthProgramToLibrary();
      if (saved === false) {
        setEditorSaveError("Не удалось сохранить. Правки остались в редакторе; повторите попытку.");
        setEditorSaveState("idle");
        return;
      }

      setEditorSaveState("saved");
      editorDraftShouldPersistRef.current = false;
      clearCurrentEditorDraft();
      setEditorInitialSnapshot(getTrainerProgramEditorSnapshot(normalizedMonthProgram));
      editorSaveCloseTimerRef.current = window.setTimeout(() => {
        editorSaveCloseTimerRef.current = null;
        finalizeEditorClose();
      }, 420);
    } catch (error) {
      console.error("Save program editor error:", error);
      setEditorSaveError("Не удалось сохранить. Правки остались в редакторе; повторите попытку.");
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
        onOpenExerciseLibrary={openLibraryFromEditor}
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
        onUploadExerciseVideo={(...args) => {
          const session = editorUploadSessionRef.current;
          return uploadMonthExerciseVideo(...args, {
            isCurrent: () => Boolean(session && editorUploadSessionRef.current === session)
          });
        }}
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
          clients={usersList}
          adminProgramCreateChoiceOpen={adminProgramCreateChoiceOpen}
          adminProgramImportInputRef={adminProgramImportInputRef}
          adminSelectedTemplateId={adminSelectedTemplateId}
          adminTrainingTemplates={adminTrainingTemplates}
          trainerLibraryLoadState={trainerLibraryLoadState}
          onRetryLibrary={onRetryLibrary}
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
          onOpenExerciseLibrary={openLibraryFromEditor}
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
          className={styles.editorModalBackdrop} data-modal-backdrop="true"
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
            onKeyDown={(event) => { if (event.key === "Escape" && !document.querySelector("dialog[open]")) { event.stopPropagation(); closeEditor(); } }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.editorModalHeader} data-trainer-modal-header="true">
              <label className={styles.editorProgramNameField}>
                <span className={styles.editorTemplateLabel} id="trainer-program-editor-modal-title">Общий шаблон</span>
                <input
                  value={normalizedMonthProgram?.name || ""}
                  onChange={(event) => updateMonthProgramName(event.target.value.slice(0, 80))}
                  maxLength={80}
                  placeholder="Название шаблона"
                  aria-label="Название программы"
                  disabled={isEditorSaveInProgress}
                />
              </label>
              <div className={styles.editorHeaderActions}>
              <button type="button" onClick={() => setTemplateSettingsOpen(true)} disabled={isEditorSaveInProgress} aria-label="Настройки шаблона"><Settings2 size={20} /></button>
              <button className={styles.editorModalClose} type="button" onClick={closeEditor} disabled={isEditorSaveInProgress} aria-label="Закрыть редактор программы">
                <X size={20} />
              </button>
              </div>
              <p className={styles.editorPurpose}>При назначении клиент получит отдельную копию.</p>
            </header>
            <div className={`${styles.editorModalBody} ${styles.editorModalBodyProgram}`} data-trainer-modal-content="true">
              {nextProgramConstructor}</div>
            <footer className={styles.editorModalFooter} data-trainer-modal-footer="true">
              {editorSaveError ? <p role="alert">{editorSaveError}</p> : null}
              <button
                className={`${styles.editorModalSave}${editorSaveState === "saving" ? ` ${styles.editorModalSaveSaving}` : ""}${editorSaveState === "saved" ? ` ${styles.editorModalSaveSaved}` : ""}`}
                type="button"
                disabled={isEditorSaveInProgress || Boolean(adminExerciseVideoUploadingId)}
                onClick={handleEditorProgramSave}
              >
                {editorSaveState === "saved" ? <Check size={17} /> : <Save size={17} />}
                {adminExerciseVideoUploadingId ? "Загрузка видео…" : editorSaveState === "saving" ? "Сохраняю…" : editorSaveState === "saved" ? "Сохранено" : "Сохранить шаблон"}
              </button>
            </footer>
          </section>
          {templateSettingsOpen ? <TrainerEditorSheet title="Настройки шаблона" className={styles.templateSettingsSheet} bodyClassName={styles.templateSettingsBody} onClose={() => setTemplateSettingsOpen(false)}>
            <label className={styles.editorTestFlag}><input type="checkbox" checked={Boolean(normalizedMonthProgram?.isTest)} onChange={event => updateMonthProgramTestFlag?.(event.target.checked)} disabled={isEditorSaveInProgress} />Тестовая программа</label>
            <p>Это общая основа программы. Персональная нагрузка настраивается в копии клиента.</p>
            <button className={styles.editorModalDelete} type="button" onClick={() => { setTemplateSettingsOpen(false); deleteSelectedProgramFromLibrary(); }} disabled={isEditorSaveInProgress}><Trash2 size={17} aria-hidden="true" />Удалить шаблон</button>
          </TrainerEditorSheet> : null}
          {editorDraftRecovery && !editorExitConfirmOpen ? (
            <div
              className={styles.editorExitConfirmBackdrop} data-modal-backdrop="true"
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
          {editorExitConfirmOpen ? <TrainerProgramUnsavedDialog onContinue={() => { setEditorExitConfirmOpen(false); setEditorLibraryRequested(false); }} onDiscard={discardEditorChanges} onSave={handleEditorProgramSave} saving={isEditorSaveInProgress} status={editorSaveError} /> : null}
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
