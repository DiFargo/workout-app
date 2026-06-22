import { deleteDoc, doc } from "firebase/firestore";

import { getTrainerProgramTemplateStats } from "../../utils/trainerProgramStats";

export function createTrainerMonthProgramLibraryHandlers({
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
}) {
  function getTemplateStats(template = {}) {
    return getTrainerProgramTemplateStats(template);
  }

  function openProgramFromLibrary(templateId) {
    if (!templateId) return;
    const template = adminTrainingTemplates.find((item) => item.id === templateId);
    if (!template || !canManageTrainingTemplate(template)) {
      showAppError("load", "У вас нет прав на редактирование этой программы.");
      return;
    }

    editExistingMonthProgram(templateId);
    setAdminProgramLibraryTab("editor");
    setAdminProgramEditorMode("edit");
  }

  async function deleteProgramFromLibrary(templateId) {
    const template = adminTrainingTemplates.find((item) => item.id === templateId);

    if (!template) return false;
    if (!canManageTrainingTemplate(template)) {
      showAppError("load", "Тренер может удалять только свои программы.");
      return false;
    }

    const confirmed = await showAppConfirm(`Удалить программу “${template.name}” из библиотеки? Это не удалит уже назначенные клиентам тренировки.`);

    if (!confirmed) return false;

    try {
      await deleteDoc(doc(db, "trainingTemplates", templateId));

      if (adminSelectedTemplateId === templateId) {
        setAdminSelectedTemplateId("");
      }

      await loadAdminTrainingTemplates();
      showAppError("savedLocal", "Программа удалена из библиотеки.");
      return true;
    } catch (error) {
      console.error("Delete program from library error:", error);
      showAppError("firebase", "Не получилось удалить программу.");
      return false;
    }
  }

  async function deleteSelectedProgramFromLibrary() {
    if (!adminSelectedTemplateId) {
      showAppError("load", "Сначала выберите программу.");
      return;
    }

    const deleted = await deleteProgramFromLibrary(adminSelectedTemplateId);
    if (deleted) {
      setAdminOpenWorkoutId("");
      setAdminProgramLibraryTab("overview");
    }
  }

  function handleMonthProgramBack() {
    if (adminSelectedExerciseId) {
      cancelMonthExerciseEdit();
      return;
    }

    if (adminOpenWorkoutId) {
      setAdminOpenWorkoutId("");
      setAdminExerciseSearch("");
      return;
    }

    if (Object.values(adminOpenProgramBlocks).some(Boolean)) {
      setAdminOpenProgramBlocks({});
      return;
    }

    openAdminProgramsOverview();
  }

  return {
    deleteProgramFromLibrary,
    deleteSelectedProgramFromLibrary,
    getTemplateStats,
    handleMonthProgramBack,
    openProgramFromLibrary
  };
}
