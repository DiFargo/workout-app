import { doc, getDoc, setDoc } from "firebase/firestore";

import { createFourWeekWorkoutProgramBlocks } from "../../utils/auditSafety";
import { uploadStorageFile } from "../../utils/firebaseStorage";
import { buildDraftProgramMetadata } from "../../utils/trainerProgramLifecycle.js";
import { requestTrainerAiProgramImport } from "./trainerAiProgramImport";
import { createTrainerMonthProgramImportHelpers } from "./trainerMonthProgramImportHelpers";

function flattenMonthProgramWorkouts(program) {
  return program.blocks.flatMap((block) =>
    block.weeks.flatMap((week) =>
      (week.workouts || []).map((workout) => ({
        ...workout,
        blockName: block.name,
        weekName: week.name
      }))
    )
  );
}

export function createTrainerMonthProgramPersistenceHandlers({
  adminActiveProgramId,
  adminExerciseEditSnapshotRef,
  adminExerciseLibrary,
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
}) {
  const {
    normalizeImportedExcelProgram,
    normalizeImportedMonthlyProgram
  } = createTrainerMonthProgramImportHelpers({
    adminExerciseLibrary,
    normalizeMonthProgram
  });

  async function saveMonthProgramToLibrary(programOverride = null) {
    const program = normalizeMonthProgram(programOverride || monthProgram);
    const owner = getCurrentProgramOwner();
    const existingTemplate = adminTrainingTemplates.find((template) => template.id === program.id);
    if (!owner.uid) {
      showAppError("load", "Не удалось определить владельца программы.");
      return false;
    }
    if (!canUseAdminFeatures() && (
      (existingTemplate && !canManageTrainingTemplate(existingTemplate)) ||
      (program.ownerUid && program.ownerUid !== owner.uid)
    )) {
      showAppError("load", "Тренер может изменять только свои программы.");
      return false;
    }
    const ownerUid = canUseAdminFeatures()
      ? (existingTemplate?.ownerUid || program.ownerUid || owner.uid)
      : owner.uid;
    const ownerRole = canUseAdminFeatures()
      ? (existingTemplate?.ownerRole || program.ownerRole || "admin")
      : "trainer";
    const createdByUid = existingTemplate?.createdByUid || program.createdByUid || ownerUid;
    const nowIso = new Date().toISOString();
    const workoutsToSave = program.blocks.flatMap((block, blockIndex) =>
      block.weeks.flatMap((week, weekIndex) =>
        (week.workouts || []).map((workout, workoutIndex) => ({
          ...workout,
          microcycleId: block.id,
          microcycleName: block.name,
          blockId: block.id,
          blockName: block.name,
          weekId: week.id,
          weekName: week.name,
          order: blockIndex * 100 + weekIndex * 20 + workoutIndex + 1
        }))
      )
    );

    try {
      await setDoc(doc(db, "trainingTemplates", program.id), {
        id: program.id,
        name: program.name,
        description: program.description || "",
        type: "monthly_program",
        source: "program_library",
        ownerUid,
        ownerRole,
        createdByUid,
        months: program.months,
        blocks: program.blocks,
        workouts: workoutsToSave,
        createdAt: program.createdAt || existingTemplate?.createdAt || nowIso,
        updatedAt: nowIso,
        ...buildDraftProgramMetadata(existingTemplate || program, { nowIso, ownerUid: owner.uid }),
        createdBy: createdByUid,
        createdByEmail: user?.email || ""
      }, { merge: true });

      setAdminTemplateName(program.name || "");
      setAdminSelectedTemplateId(program.id);
      showAppError("savedLocal", "Программа сохранена в библиотеку.");
      loadAdminTrainingTemplates();
      return true;
    } catch (error) {
      console.error("Save month program to library error:", error);
      showAppError("firebase", "Не получилось сохранить программу в библиотеку.");
      return false;
    }
  }

  async function uploadMonthExerciseVideo(blockId, weekId, workoutId, exerciseId, file) {
    if (!file) return;

    setAdminExerciseVideoUploadingId(exerciseId);
    try {
      const owner = getCurrentProgramOwner();
      const existingTemplate = adminTrainingTemplates.find((template) => template.id === monthProgram.id);
      if (!owner.uid || (existingTemplate && !canManageTrainingTemplate(existingTemplate))) {
        showAppError("load", "У вас нет прав на изменение этой программы.");
        return;
      }
      const safeName = String(file.name || "exercise-video").replace(/[^\wа-яА-ЯёЁ.-]+/g, "_");
      const uploadedVideo = await uploadStorageFile(
        `exercise-videos/${owner.uid}/${monthProgram.id || "draft"}/${Date.now()}-${safeName}`,
        file
      );
      const url = uploadedVideo.url;

      const programWithVideo = normalizeMonthProgram({
        ...monthProgram,
        blocks: monthProgram.blocks.map((block) => block.id !== blockId ? block : {
          ...block,
          weeks: block.weeks.map((week) => week.id !== weekId ? week : {
            ...week,
            workouts: (week.workouts || []).map((workout) => workout.id !== workoutId ? workout : {
              ...workout,
              exercises: (workout.exercises || []).map((exercise) =>
                exercise.id === exerciseId
                  ? { ...exercise, video: url, videoAutoFilledFrom: "" }
                  : exercise
              )
            })
          })
        })
      });

      setMonthProgram(programWithVideo);
      const saved = await saveMonthProgramToLibrary(programWithVideo);
      if (saved) {
        showAppError("savedLocal", "Видео загружено и сохранено в программе.");
      }
    } catch (error) {
      console.error("Month exercise video upload error:", error);
      showAppError("firebase", "Не получилось загрузить видео.");
    } finally {
      setAdminExerciseVideoUploadingId("");
    }
  }

  async function saveMonthWorkoutAndReturnToBlock(handleMonthProgramBack) {
    const saved = await saveMonthProgramToLibrary();
    if (saved) handleMonthProgramBack();
  }

  async function saveMonthProgramAndOpenOverview() {
    const saved = await saveMonthProgramToLibrary();
    if (saved) openAdminProgramsOverview();
  }

  async function importMonthProgramFromFile(file) {
    if (!file) return;

    try {
      const isExcel = /\.xlsx$/i.test(file.name || "");
      let nextProgram;

      if (isExcel) {
        const { default: readExcelFile } = await import("read-excel-file/browser");
        const sheets = await readExcelFile(file);
        nextProgram = normalizeImportedExcelProgram(sheets, file.name);
      } else {
        const text = await file.text();
        const parsed = JSON.parse(text);
        nextProgram = normalizeImportedMonthlyProgram(parsed);
      }
      const owner = getCurrentProgramOwner();
      const importStamp = Date.now();
      nextProgram = normalizeMonthProgram({
        ...nextProgram,
        id: `imported_${importStamp}`,
        ownerUid: owner.uid,
        ownerRole: owner.role,
        createdByUid: owner.uid,
        updatedByUid: owner.uid,
        createdAt: new Date(importStamp).toISOString()
      });

      const importedWorkouts = (nextProgram.blocks || []).flatMap((block) =>
        (block.weeks || []).flatMap((week) => week.workouts || [])
      );
      const importedExercises = importedWorkouts.flatMap((workout) => workout.exercises || []);
      const importedTaskBlocks = importedWorkouts.flatMap((workout) => workout.taskBlocks || []);
      const groupCount = importedTaskBlocks.filter((block) => block.type === "group").length;
      const intervalCount = importedTaskBlocks.filter((block) => block.type === "interval").length;
      const importApproved = typeof window === "undefined" || window.confirm([
        "Предварительный просмотр импорта",
        `Тренировочных дней: ${importedWorkouts.length}`,
        `Упражнений: ${importedExercises.length}`,
        `Групп упражнений: ${groupCount}`,
        `Интервальных блоков: ${intervalCount}`,
        "",
        "Импортировать программу?"
      ].join("\n"));
      if (!importApproved) return;

      setAdminProgramEditorMode("create");
      setAdminProgramLibraryTab("editor");
      setAdminOpenWorkoutId("");
      setAdminSelectedExerciseId("");
      setAdminExerciseSearch("");
      adminExerciseEditSnapshotRef.current = null;
      setAdminOpenProgramBlocks({});
      setAdminOpenProgramWeeks({});
      setAdminActiveProgramId(nextProgram.id);
      setAdminSelectedTemplateId(nextProgram.id);
      setAdminProgramGroups([nextProgram]);

      const flatWorkouts = flattenMonthProgramWorkouts(nextProgram);

      setPlan({ workouts: flatWorkouts });
      setAdminTrainingTemplates((current) => [
        { ...nextProgram, workouts: flatWorkouts },
        ...current.filter((template) => template.id !== nextProgram.id)
      ]);
      const saved = await saveMonthProgramToLibrary(nextProgram);
      if (saved) {
        showAppError("savedLocal", `${isExcel ? "Excel" : "JSON"} импортирован в ваши программы.`);
      }
    } catch (error) {
      console.error("Program import error:", error);
      showAppError("load", error.message || "Не получилось импортировать программу.");
    }
  }

  async function importMonthProgramWithAi({ text = "", file = null } = {}) {
    if (!String(text || "").trim() && !file) {
      showAppError("load", "Вставьте текст программы или прикрепите файл.");
      return;
    }

    try {
      const aiProgram = await requestTrainerAiProgramImport({ text, file });
      let nextProgram = normalizeImportedMonthlyProgram(aiProgram);
      const owner = getCurrentProgramOwner();
      const importStamp = Date.now();
      nextProgram = normalizeMonthProgram({
        ...nextProgram,
        id: `ai_imported_${importStamp}`,
        ownerUid: owner.uid,
        ownerRole: owner.role,
        createdByUid: owner.uid,
        updatedByUid: owner.uid,
        createdAt: new Date(importStamp).toISOString()
      });

      setAdminProgramEditorMode("create");
      setAdminProgramLibraryTab("editor");
      setAdminOpenWorkoutId("");
      setAdminSelectedExerciseId("");
      setAdminExerciseSearch("");
      adminExerciseEditSnapshotRef.current = null;
      setAdminOpenProgramBlocks({});
      setAdminOpenProgramWeeks({});
      setAdminActiveProgramId(nextProgram.id);
      setAdminSelectedTemplateId(nextProgram.id);
      setAdminProgramGroups([nextProgram]);

      const flatWorkouts = flattenMonthProgramWorkouts(nextProgram);

      setPlan({ workouts: flatWorkouts });
      setAdminTrainingTemplates((current) => [
        { ...nextProgram, workouts: flatWorkouts },
        ...current.filter((template) => template.id !== nextProgram.id)
      ]);
      const saved = await saveMonthProgramToLibrary(nextProgram);
      if (saved) {
        showAppError("savedLocal", "ИИ создал черновик программы. Проверьте и отредактируйте перед назначением.");
      }
    } catch (error) {
      console.error("AI program import error:", error);
      showAppError("load", error.message || "Не получилось создать программу через ИИ.");
      throw error;
    }
  }

  function createNewMonthProgramDraft() {
    const owner = getCurrentProgramOwner();
    const nextProgram = normalizeMonthProgram({
      id: `month_${Date.now()}`,
      name: "Новая программа на месяц",
      ownerUid: owner.uid,
      ownerRole: owner.role,
      createdByUid: owner.uid,
      updatedByUid: owner.uid,
      blocks: createFourWeekWorkoutProgramBlocks(Date.now())
    });

    setAdminProgramEditorMode("create");
    setAdminProgramLibraryTab("editor");
    setAdminOpenWorkoutId("");
    setAdminOpenProgramBlocks({});
    setAdminOpenProgramWeeks({});
    setAdminActiveProgramId(nextProgram.id);
    setAdminSelectedTemplateId("");
    setAdminProgramGroups([nextProgram]);
    setPlan({ workouts: flattenMonthProgramWorkouts(nextProgram) });
  }

  function editExistingMonthProgram(templateId) {
    const template = adminTrainingTemplates.find((item) => item.id === templateId);

    if (!template) return;
    if (!canManageTrainingTemplate(template)) {
      showAppError("load", "У вас нет прав на редактирование этой программы.");
      return;
    }

    const templateMonths = Array.isArray(template.months) ? template.months : [];
    const nestedMicrocycles = templateMonths.flatMap((month, monthIndex) =>
      (Array.isArray(month.microcycles) ? month.microcycles : (month.blocks || [])).map((microcycle) => ({
        ...microcycle,
        monthId: microcycle.monthId || month.id || `month_${monthIndex + 1}`
      }))
    );
    const hasStructuredHierarchy = templateMonths.some((month) =>
      Array.isArray(month.microcycles) || Array.isArray(month.blocks)
    ) || (templateMonths.length > 0 && Array.isArray(template.blocks));
    const templateBlocks = nestedMicrocycles.length
      ? nestedMicrocycles
      : Array.isArray(template.blocks) && (template.blocks.length || hasStructuredHierarchy)
        ? template.blocks
        : hasStructuredHierarchy
          ? []
          : [
              {
                id: "microcycle_1",
                name: "Микроцикл 1",
                weeks: [
                  { id: "week_1", name: "Неделя 1", workouts: template.workouts || [] },
                  { id: "week_2", name: "Неделя 2", workouts: [] }
                ]
              },
              {
                id: "microcycle_2",
                name: "Микроцикл 2",
                weeks: [
                  { id: "week_3", name: "Неделя 3", workouts: [] },
                  { id: "week_4", name: "Неделя 4", workouts: [] }
                ]
              }
            ];

    const nextProgram = normalizeMonthProgram({
      id: template.id,
      name: template.name || "Программа на месяц",
      description: template.description || "",
      ownerUid: template.ownerUid || "",
      ownerRole: template.ownerRole || "",
      createdByUid: template.createdByUid || "",
      updatedByUid: template.updatedByUid || "",
      createdAt: template.createdAt,
      months: hasStructuredHierarchy ? templateMonths : undefined,
      blocks: templateBlocks
    });

    setAdminProgramEditorMode("edit");
    setAdminSelectedTemplateId(template.id);
    setAdminActiveProgramId(template.id);
    setAdminOpenWorkoutId("");
    setAdminSelectedExerciseId("");
    setAdminExerciseSearch("");
    adminExerciseEditSnapshotRef.current = null;
    setAdminOpenProgramBlocks({});
    setAdminOpenProgramWeeks({});
    setAdminProgramGroups([nextProgram]);
    setPlan({ workouts: flattenMonthProgramWorkouts(nextProgram) });
  }

  async function refreshCurrentMonthProgram() {
    const templateId = adminActiveProgramId || adminSelectedTemplateId;
    const openWorkoutId = adminOpenWorkoutId;
    const scrollPosition = { x: window.scrollX, y: window.scrollY };
    if (!templateId) {
      showAppError("load", "Сначала сохраните программу.");
      return;
    }

    try {
      const templateSnapshot = await getDoc(doc(db, "trainingTemplates", templateId));
      if (!templateSnapshot.exists()) {
        showAppError("load", "Сохранённая программа не найдена.");
        return;
      }

      const template = { id: templateSnapshot.id, ...templateSnapshot.data() };
      const nextProgram = normalizeMonthProgram({
        id: template.id,
        name: template.name || "Программа на месяц",
        description: template.description || "",
        ownerUid: template.ownerUid || "",
        ownerRole: template.ownerRole || "",
        createdByUid: template.createdByUid || "",
        updatedByUid: template.updatedByUid || "",
        createdAt: template.createdAt,
        months: Array.isArray(template.months) ? template.months : undefined,
        blocks: Array.isArray(template.blocks) ? template.blocks : undefined
      });
      const flatWorkouts = flattenMonthProgramWorkouts(nextProgram);

      const refreshedOpenWorkout = openWorkoutId
        ? flatWorkouts.find((workout) => workout.id === openWorkoutId)
        : null;
      const selectedExerciseExists = refreshedOpenWorkout?.exercises?.some(
        (exercise) => exercise.id === adminSelectedExerciseId
      );

      setAdminProgramGroups([nextProgram]);
      setPlan({ workouts: flatWorkouts });
      setAdminTrainingTemplates((current) => current.map((item) =>
        item.id === template.id ? template : item
      ));
      setAdminOpenWorkoutId(refreshedOpenWorkout ? openWorkoutId : "");
      if (!refreshedOpenWorkout || (adminSelectedExerciseId && !selectedExerciseExists)) {
        setAdminSelectedExerciseId("");
        setAdminExerciseSearch("");
        adminExerciseEditSnapshotRef.current = null;
      }
      window.requestAnimationFrame(() => {
        window.scrollTo(scrollPosition.x, scrollPosition.y);
      });
      showAppError("savedLocal", "Данные программы обновлены.");
    } catch (error) {
      console.error("Refresh current program error:", error);
      showAppError("firebase", "Не получилось обновить данные программы.");
    }
  }

  return {
    createNewMonthProgramDraft,
    editExistingMonthProgram,
    importMonthProgramFromFile,
    importMonthProgramWithAi,
    refreshCurrentMonthProgram,
    saveMonthProgramAndOpenOverview,
    saveMonthProgramToLibrary,
    saveMonthWorkoutAndReturnToBlock,
    uploadMonthExerciseVideo
  };
}
