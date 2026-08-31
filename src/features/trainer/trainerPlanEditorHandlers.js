import {
  getTrainerNextExerciseId,
  getTrainerNextExerciseSetIndex,
  getTrainerNextPatch,
  getTrainerNextWorkoutId,
  getTrainerNextWorkoutSourceExercise
} from "./trainerWorkoutArgs";
import {
  getTrainerExercisePresentationIdentity,
  mapTrainerNextWorkoutSetExercise,
  normalizeTrainerNextExerciseDefaults
} from "./trainerWorkoutEditHelpers";
import { exerciseUsesExternalWeight } from "../../utils/auditSafety";
import { sanitizeExerciseSetPatch } from "../../utils/exerciseWeightInput";
import { uploadStorageFile } from "../../utils/firebaseStorage";
import {
  patchExerciseInTrainerTemplate,
  removeExerciseFromTrainerTemplate
} from "../../utils/trainerExerciseLibrary.js";

const DEFAULT_EXERCISE_NAME = "\u041d\u043e\u0432\u043e\u0435 \u0443\u043f\u0440\u0430\u0436\u043d\u0435\u043d\u0438\u0435";
const DEFAULT_DAY_NAME = "\u0414\u0435\u043d\u044c";
const DEFAULT_WORKOUT_NAME = "\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0430";
const DEFAULT_EXERCISE_COPY_NAME = "\u0423\u043f\u0440\u0430\u0436\u043d\u0435\u043d\u0438\u0435";
const COPY_SUFFIX = " \u2014 \u043a\u043e\u043f\u0438\u044f";
const ABS_EXERCISE_MARKER = "\u041f\u0440\u0435\u0441\u0441";

function getPlanWorkouts(plan) {
  return Array.isArray(plan?.workouts) ? plan.workouts : [];
}

function getDefaultExerciseReps(exerciseName = "") {
  return String(exerciseName).includes(ABS_EXERCISE_MARKER) ? 15 : 8;
}

function createEmptySet(reps) {
  return { reps, weight: "", enteredReps: "", enteredWeight: "" };
}

function createTrainerNextPlan(plan, workouts) {
  return {
    ...(plan || {}),
    workouts
  };
}

function getTemplateWorkouts(template = {}) {
  const blocks = Array.isArray(template.blocks)
    ? template.blocks
    : (template.months || []).flatMap((month) => month.microcycles || month.blocks || []);

  return [
    ...(template.workouts || []),
    ...blocks.flatMap((block) => (block.weeks || []).flatMap((week) => week.workouts || []))
  ];
}

function appendExerciseToTrainerTemplate(value, workoutId, exercise) {
  if (Array.isArray(value)) {
    return value.map((item) => appendExerciseToTrainerTemplate(item, workoutId, exercise));
  }
  if (!value || typeof value !== "object") return value;

  const current = value.id === workoutId && Array.isArray(value.exercises)
    ? { ...value, exercises: [...value.exercises, exercise] }
    : value;

  return Object.fromEntries(
    Object.entries(current).map(([key, item]) => [key, appendExerciseToTrainerTemplate(item, workoutId, exercise)])
  );
}

export function createTrainerPlanEditorHandlers({
  plan,
  setPlan,
  saveWorkoutsToFirebase,
  adminExerciseSearch,
  trainerExerciseLibraryItems,
  selectedUserId,
  auth,
  setAdminExerciseVideoUploadingId,
  setAdminClientStatus,
  adminTrainingTemplates,
  setAdminTrainingTemplates,
  db,
  doc,
  setDoc
}) {
  const persistPlan = (nextPlan) => {
    setPlan(nextPlan);
    void saveWorkoutsToFirebase(nextPlan, { silent: true });
  };

  function updateTrainerNextWorkout(...args) {
    const constructorMode = args.length >= 4;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const patch = getTrainerNextPatch(args, constructorMode);

    if (typeof workoutId !== "string" || !patch || typeof patch !== "object") return;

    const workouts = getPlanWorkouts(plan);
    const nextWorkouts = mapTrainerNextWorkoutSetExercise(workouts, workoutId, null, (exercises) => exercises.map((exercise) => exercise));
    const normalizedPlan = createTrainerNextPlan(
      plan,
      nextWorkouts.map((workout) => (
        workout.id === workoutId ? { ...workout, ...patch } : workout
      ))
    );

    persistPlan(normalizedPlan);
  }

  function updateTrainerNextExercise(...args) {
    const constructorMode = args.length >= 5;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const exerciseId = getTrainerNextExerciseId(args, constructorMode);
    const patch = sanitizeExerciseSetPatch(getTrainerNextPatch(args, constructorMode));

    if (!exerciseId || !workoutId || !patch || typeof patch !== "object") return;

    const nextWorkouts = mapTrainerNextWorkoutSetExercise(getPlanWorkouts(plan), workoutId, exerciseId, (exercises) => exercises.map((exercise) => (
      exercise.id === exerciseId ? { ...exercise, ...patch } : exercise
    )));

    persistPlan(createTrainerNextPlan(plan, nextWorkouts));
  }

  async function saveTrainerExerciseProgressAdjustment({
    workoutId,
    exerciseId,
    workoutIndex,
    exerciseIndex,
    patch
  } = {}) {
    if (!patch || typeof patch !== "object") return false;

    const workouts = getPlanWorkouts(plan);
    const resolvedWorkoutIndex = workouts.findIndex((workout, index) => (
      (workoutId && workout.id === workoutId) || (!workoutId && index === workoutIndex)
    ));
    const targetWorkout = workouts[resolvedWorkoutIndex];
    if (!targetWorkout) return false;

    const exercises = Array.isArray(targetWorkout.exercises) ? targetWorkout.exercises : [];
    const resolvedExerciseIndex = exercises.findIndex((exercise, index) => (
      (exerciseId && exercise.id === exerciseId) || (!exerciseId && index === exerciseIndex)
    ));
    const targetExercise = exercises[resolvedExerciseIndex];
    if (!targetExercise) return false;

    const ownerUid = selectedUserId || auth.currentUser?.uid || "";
    if (!ownerUid || !targetWorkout.id) {
      setAdminClientStatus("Не удалось определить тренировку клиента.");
      return false;
    }

    const nextExercises = exercises.map((exercise, index) => (
      index === resolvedExerciseIndex ? { ...exercise, ...patch } : exercise
    ));
    const nextWorkout = { ...targetWorkout, exercises: nextExercises };
    const nextWorkouts = workouts.map((workout, index) => (
      index === resolvedWorkoutIndex ? nextWorkout : workout
    ));
    const assignedProgramId = nextWorkout.assignedProgramId || plan?.assignedProgramId || "";
    const assignedTemplate = (adminTrainingTemplates || []).find((template) => template.id === assignedProgramId);

    try {
      await setDoc(doc(db, "users", ownerUid, "workouts", nextWorkout.id), {
        ...nextWorkout,
        id: nextWorkout.id,
        order: Number(nextWorkout.order || resolvedWorkoutIndex + 1),
        sortOrder: Number(nextWorkout.sortOrder || resolvedWorkoutIndex + 1),
        assignedProgramId,
        assignedProgramName: nextWorkout.assignedProgramName || plan?.assignedProgramName || assignedTemplate?.name || "",
        assignedProgramUpdatedAt: nextWorkout.assignedProgramUpdatedAt || plan?.assignedProgramUpdatedAt || "",
        assignedBy: auth.currentUser?.uid || nextWorkout.assignedBy || "",
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setPlan(createTrainerNextPlan(plan, nextWorkouts));
      setAdminClientStatus("Нагрузка упражнения обновлена.");
      return true;
    } catch (error) {
      console.error("Trainer exercise progress adjustment save failed:", error);
      setAdminClientStatus("Не удалось сохранить изменение нагрузки.");
      return false;
    }
  }

  async function updateTrainerLibraryExercise(exercise, patch) {
    const source = exercise?.librarySource;
    if (!source || !exercise?.id || !patch || typeof patch !== "object") return false;

    if (source.type === "plan" && source.workoutId) {
      updateTrainerNextExercise(source.workoutId, exercise.id, patch);
      return true;
    }

    if (source.type !== "template" || !source.templateId) return false;
    const template = (adminTrainingTemplates || []).find((item) => item.id === source.templateId);
    if (!template) return false;

    const nextTemplate = patchExerciseInTrainerTemplate(template, exercise.id, patch);
    setAdminTrainingTemplates((current) => current.map((item) => item.id === source.templateId ? nextTemplate : item));
    try {
      await setDoc(doc(db, "trainingTemplates", source.templateId), nextTemplate, { merge: true });
      return true;
    } catch (error) {
      console.error("Trainer library exercise save error:", error);
      setAdminClientStatus("Не удалось сохранить упражнение в библиотеке.");
      return false;
    }
  }

  async function removeTrainerLibraryExercise(exercise) {
    const source = exercise?.librarySource;
    if (!source || !exercise?.id) return false;

    if (source.type === "plan" && source.workoutId) {
      removeTrainerNextExercise(source.workoutId, exercise.id);
      return true;
    }

    if (source.type !== "template" || !source.templateId) return false;
    const template = (adminTrainingTemplates || []).find((item) => item.id === source.templateId);
    if (!template) return false;

    const nextTemplate = removeExerciseFromTrainerTemplate(template, exercise.id);
    setAdminTrainingTemplates((current) => current.map((item) => item.id === source.templateId ? nextTemplate : item));
    try {
      await setDoc(doc(db, "trainingTemplates", source.templateId), nextTemplate, { merge: true });
      return true;
    } catch (error) {
      console.error("Trainer library exercise delete error:", error);
      setAdminClientStatus("Не удалось удалить упражнение из библиотеки.");
      return false;
    }
  }

  async function createTrainerLibraryExercise(templateId = "", patch = {}) {
    const template = (adminTrainingTemplates || []).find((item) => item.id === templateId)
      || (adminTrainingTemplates || [])[0];
    if (!template?.id) return false;

    const name = String(patch?.name || DEFAULT_EXERCISE_NAME).trim() || DEFAULT_EXERCISE_NAME;
    const exercise = {
      id: `exercise_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      muscleGroup: "",
      rest: "90 сек",
      requiresWeight: true,
      usesWeight: true,
      sets: [createEmptySet(getDefaultExerciseReps(name))],
      ...patch
    };
    const targetWorkout = getTemplateWorkouts(template)[0];
    const nextTemplate = targetWorkout?.id
      ? appendExerciseToTrainerTemplate(template, targetWorkout.id, exercise)
      : {
        ...template,
        workouts: [
          ...(template.workouts || []),
          {
            id: `workout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: `${DEFAULT_WORKOUT_NAME} 1`,
            status: "planned",
            exercises: [exercise]
          }
        ]
      };

    setAdminTrainingTemplates((current) => current.map((item) => item.id === template.id ? nextTemplate : item));
    try {
      await setDoc(doc(db, "trainingTemplates", template.id), nextTemplate, { merge: true });
      return {
        ...exercise,
        librarySource: { type: "template", templateId: template.id }
      };
    } catch (error) {
      console.error("Trainer library exercise create error:", error);
      setAdminClientStatus("Не удалось создать упражнение в библиотеке.");
      return false;
    }
  }

  function updateTrainerNextExerciseSet(...args) {
    const constructorMode = args.length >= 6;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const exerciseId = getTrainerNextExerciseId(args, constructorMode);
    const setIndex = Number(getTrainerNextExerciseSetIndex(args, constructorMode));
    const patch = sanitizeExerciseSetPatch(getTrainerNextPatch(args, constructorMode));

    if (!workoutId || !exerciseId || !Number.isFinite(setIndex) || setIndex < 0 || !patch || typeof patch !== "object") return;

    const workouts = getPlanWorkouts(plan);
    const targetWorkout = workouts.find((workout) => workout.id === workoutId);
    const targetExercise = targetWorkout?.exercises?.find((exercise) => exercise.id === exerciseId);
    const defaultReps = getDefaultExerciseReps(targetExercise?.name);
    const currentSets = Array.isArray(targetExercise?.sets) && targetExercise.sets.length
      ? [...targetExercise.sets]
      : [createEmptySet(defaultReps)];

    if (!currentSets[setIndex]) {
      currentSets[setIndex] = createEmptySet(defaultReps);
    }

    currentSets[setIndex] = {
      ...currentSets[setIndex],
      ...patch
    };

    const nextWorkouts = mapTrainerNextWorkoutSetExercise(workouts, workoutId, exerciseId, (exercises) => exercises.map((exercise) => (
      exercise.id === exerciseId ? { ...exercise, sets: currentSets } : exercise
    )));

    persistPlan(createTrainerNextPlan(plan, nextWorkouts));
  }

  function addTrainerNextExerciseSet(...args) {
    const constructorMode = args.length >= 4;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const exerciseId = getTrainerNextExerciseId(args, constructorMode);

    if (!workoutId || !exerciseId) return;

    const workouts = getPlanWorkouts(plan);
    const targetWorkout = workouts.find((workout) => workout.id === workoutId);
    const targetExercise = targetWorkout?.exercises?.find((exercise) => exercise.id === exerciseId);
    const defaultReps = getDefaultExerciseReps(targetExercise?.name);
    const targetSets = Array.isArray(targetExercise?.sets) && targetExercise.sets.length
      ? [...targetExercise.sets]
      : [createEmptySet(defaultReps)];

    targetSets.push(createEmptySet(defaultReps));

    const nextWorkouts = mapTrainerNextWorkoutSetExercise(workouts, workoutId, exerciseId, (exercises) => exercises.map((exercise) => (
      exercise.id === exerciseId ? { ...exercise, sets: targetSets } : exercise
    )));

    persistPlan(createTrainerNextPlan(plan, nextWorkouts));
  }

  function removeTrainerNextExerciseSet(...args) {
    const constructorMode = args.length >= 5;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const exerciseId = getTrainerNextExerciseId(args, constructorMode);
    const setIndex = Number(getTrainerNextExerciseSetIndex(args, constructorMode));

    if (!workoutId || !exerciseId || !Number.isFinite(setIndex)) return;

    const workouts = getPlanWorkouts(plan);
    const targetWorkout = workouts.find((workout) => workout.id === workoutId);
    const targetExercise = targetWorkout?.exercises?.find((exercise) => exercise.id === exerciseId);
    const currentSets = Array.isArray(targetExercise?.sets) ? [...targetExercise.sets] : [];
    if (currentSets.length <= 1) return;

    currentSets.splice(setIndex, 1);

    const nextWorkouts = mapTrainerNextWorkoutSetExercise(workouts, workoutId, exerciseId, (exercises) => exercises.map((exercise) => (
      exercise.id === exerciseId ? { ...exercise, sets: currentSets } : exercise
    )));

    persistPlan(createTrainerNextPlan(plan, nextWorkouts));
  }

  function addTrainerNextExercise(...args) {
    const constructorMode = args.length >= 4;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const sourceExercise = getTrainerNextWorkoutSourceExercise(args, constructorMode);

    if (!workoutId) return;

    const workouts = getPlanWorkouts(plan);
    const exerciseName = String(
      sourceExercise?.name
      || workouts.find((workout) => workout.id === workoutId)?.name
      || adminExerciseSearch
      || DEFAULT_EXERCISE_NAME
    ).trim() || DEFAULT_EXERCISE_NAME;

    const sourceVideo = sourceExercise?.video || sourceExercise?.videoUrl || sourceExercise?.videoURL || "";
    const newExercise = sourceExercise ? {
      id: `exercise_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...getTrainerExercisePresentationIdentity(sourceExercise),
      name: sourceExercise.name || exerciseName,
      video: sourceVideo,
      videoAutoFilledFrom: sourceVideo ? sourceExercise.name : "",
      requiresWeight: exerciseUsesExternalWeight(sourceExercise),
      usesWeight: exerciseUsesExternalWeight(sourceExercise),
      sets: [createEmptySet(getDefaultExerciseReps(exerciseName))]
    } : normalizeTrainerNextExerciseDefaults(exerciseName, trainerExerciseLibraryItems);

    const nextWorkouts = mapTrainerNextWorkoutSetExercise(workouts, workoutId, null, (exercises) => [
      ...exercises,
      newExercise
    ]);

    persistPlan(createTrainerNextPlan(plan, nextWorkouts));
    return newExercise;
  }

  function removeTrainerNextExercise(...args) {
    const constructorMode = args.length >= 4;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const exerciseId = getTrainerNextExerciseId(args, constructorMode);
    const exerciseIndex = Number(args[constructorMode ? 4 : 2]);
    const hasExerciseId = exerciseId !== undefined && exerciseId !== null && String(exerciseId).trim() !== "";
    const hasExerciseIndex = Number.isInteger(exerciseIndex) && exerciseIndex >= 0;

    if (!workoutId || (!hasExerciseId && !hasExerciseIndex)) return false;

    const workouts = getPlanWorkouts(plan);
    const targetWorkout = workouts.find((workout) => String(workout?.id || "") === String(workoutId));
    const exercises = Array.isArray(targetWorkout?.exercises) ? targetWorkout.exercises : [];
    const matchedExerciseIndex = hasExerciseId
      ? exercises.findIndex((exercise) => String(exercise?.id || "") === String(exerciseId))
      : -1;

    // Older assignments may lack exercise ids, and a stale in-document id can
    // disagree with the loaded row. Prefer the exact id, then use the row index
    // that the editor rendered so the visible future exercise can still be removed.
    const targetExerciseIndex = matchedExerciseIndex >= 0
      ? matchedExerciseIndex
      : (hasExerciseIndex ? exerciseIndex : -1);

    if (targetExerciseIndex < 0 || targetExerciseIndex >= exercises.length) return false;

    const nextWorkouts = mapTrainerNextWorkoutSetExercise(workouts, workoutId, exerciseId, (currentExercises) => (
      currentExercises.filter((_, index) => index !== targetExerciseIndex)
    ));

    persistPlan(createTrainerNextPlan(plan, nextWorkouts));
    return true;
  }

  function duplicateTrainerNextExercise(...args) {
    const constructorMode = args.length >= 4;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const exerciseId = getTrainerNextExerciseId(args, constructorMode);

    if (!workoutId || !exerciseId) return;

    const workouts = getPlanWorkouts(plan);
    const targetWorkout = workouts.find((workout) => workout.id === workoutId);
    const targetExercise = targetWorkout?.exercises?.find((exercise) => exercise.id === exerciseId);
    if (!targetExercise) return;

    const duplicatedExercise = {
      ...targetExercise,
      id: `exercise_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: `${targetExercise.name || DEFAULT_EXERCISE_COPY_NAME}${COPY_SUFFIX}`,
      sets: (targetExercise.sets || []).map((set, setIndex) => ({
        ...set,
        ...(set?.id ? { id: `${set.id}_copy_${setIndex}` } : {})
      }))
    };

    const nextWorkouts = mapTrainerNextWorkoutSetExercise(workouts, workoutId, exerciseId, (exercises) => {
      const items = [];
      exercises.forEach((exercise) => {
        items.push(exercise);
        if (exercise.id === exerciseId) {
          items.push(duplicatedExercise);
        }
      });
      return items;
    });

    persistPlan(createTrainerNextPlan(plan, nextWorkouts));
  }

  function moveTrainerNextExercise(...args) {
    const constructorMode = args.length >= 5;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const exerciseId = getTrainerNextExerciseId(args, constructorMode);
    const direction = Number(args[constructorMode ? 5 - 1 : 2]);

    if (!workoutId || !exerciseId || !Number.isFinite(direction) || direction === 0) return;

    const nextWorkouts = mapTrainerNextWorkoutSetExercise(getPlanWorkouts(plan), workoutId, exerciseId, (exercises) => {
      const nextExercises = [...exercises];
      const currentIndex = nextExercises.findIndex((exercise) => exercise.id === exerciseId);
      const nextIndex = currentIndex + direction;
      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= nextExercises.length) return nextExercises;
      [nextExercises[currentIndex], nextExercises[nextIndex]] = [nextExercises[nextIndex], nextExercises[currentIndex]];
      return nextExercises;
    });

    persistPlan(createTrainerNextPlan(plan, nextWorkouts));
  }

  async function uploadTrainerNextExerciseVideo(...args) {
    const constructorMode = args.length >= 5;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const exerciseId = getTrainerNextExerciseId(args, constructorMode);
    const file = getTrainerNextPatch(args, constructorMode);

    if (!workoutId || !exerciseId || !file) return false;

    setAdminExerciseVideoUploadingId(exerciseId);
    try {
      const owner = selectedUserId || auth.currentUser?.uid;
      if (!owner) {
        setAdminClientStatus("\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d.");
        return false;
      }

      const safeName = String(file.name || "exercise-video").replace(/[^\w\u0430-\u044f\u0410-\u042f\u0451\u0401.-]+/g, "_");
      const uploadedVideo = await uploadStorageFile(
        `exercise-videos/${owner}/${selectedUserId || owner}/${Date.now()}-${safeName}`,
        file
      );
      const url = uploadedVideo.url;

      const nextWorkouts = mapTrainerNextWorkoutSetExercise(getPlanWorkouts(plan), workoutId, exerciseId, (exercises) => exercises.map((exercise) => (
        exercise.id === exerciseId ? { ...exercise, video: url, videoAutoFilledFrom: "" } : exercise
      )));

      const nextPlan = createTrainerNextPlan(plan, nextWorkouts);
      setPlan(nextPlan);
      await saveWorkoutsToFirebase(nextPlan, { silent: true });
      setAdminClientStatus("\u0412\u0438\u0434\u0435\u043e \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e.");
      return url;
    } catch (error) {
      console.error("Trainer exercise video upload error:", error);
      setAdminClientStatus("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0432\u0438\u0434\u0435\u043e.");
      return false;
    } finally {
      setAdminExerciseVideoUploadingId("");
    }
  }

  async function uploadTrainerLibraryExerciseVideo(exercise, file) {
    const source = exercise?.librarySource;
    if (!source || !exercise?.id || !file) return false;

    if (source.type === "plan" && source.workoutId) {
      return uploadTrainerNextExerciseVideo(source.workoutId, exercise.id, file);
    }

    if (source.type !== "template" || !source.templateId) return false;
    const owner = auth.currentUser?.uid || selectedUserId;
    if (!owner) {
      setAdminClientStatus("\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u0432\u044b\u0431\u0440\u0430\u043d.");
      return false;
    }

    setAdminExerciseVideoUploadingId(exercise.id);
    try {
      const safeName = String(file.name || "exercise-video").replace(/[^\w\u0430-\u044f\u0410-\u042f\u0451\u0401.-]+/g, "_");
      const uploadedVideo = await uploadStorageFile(
        `template-exercise-videos/${owner}/${source.templateId}/${Date.now()}-${safeName}`,
        file
      );
      const url = uploadedVideo.url;
      const saved = await updateTrainerLibraryExercise(exercise, { video: url, videoAutoFilledFrom: "" });
      if (saved) setAdminClientStatus("\u0412\u0438\u0434\u0435\u043e \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e.");
      return saved ? url : false;
    } catch (error) {
      console.error("Trainer library exercise video upload error:", error);
      setAdminClientStatus("\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0432\u0438\u0434\u0435\u043e.");
      return false;
    } finally {
      setAdminExerciseVideoUploadingId("");
    }
  }

  function addTrainerNextWorkoutDay() {
    const nextId = `workout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const currentWorkouts = getPlanWorkouts(plan);
    const nextNumber = currentWorkouts.length + 1;

    const nextWorkouts = [
      ...currentWorkouts,
      {
        id: nextId,
        name: `${DEFAULT_DAY_NAME} ${nextNumber}`,
        exercises: [],
        status: "planned"
      }
    ];

    persistPlan(createTrainerNextPlan(plan, nextWorkouts));
  }

  function duplicateTrainerNextWorkoutDay(...args) {
    const constructorMode = args.length >= 3;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const workouts = getPlanWorkouts(plan);

    const targetWorkout = workouts.find((workout) => workout.id === workoutId);
    if (!targetWorkout) return;

    const duplicatedWorkout = {
      ...targetWorkout,
      id: `workout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: `${targetWorkout.name || DEFAULT_WORKOUT_NAME}${COPY_SUFFIX}`,
      exercises: (targetWorkout.exercises || []).map((exercise, index) => ({
        ...exercise,
        id: `${exercise.id || "exercise"}_copy_${Date.now()}_${index}`,
        sets: (exercise.sets || []).map((set, setIndex) => ({
          ...set,
          ...(set?.id ? { id: `${set.id}_copy_${setIndex}` } : {})
        }))
      }))
    };
    const index = workouts.findIndex((workout) => workout.id === workoutId);
    if (index < 0) return;

    const nextWorkouts = [...workouts];
    nextWorkouts.splice(index + 1, 0, duplicatedWorkout);

    persistPlan(createTrainerNextPlan(plan, nextWorkouts));
  }

  function removeTrainerNextWorkoutDay(...args) {
    const constructorMode = args.length >= 3;
    const workoutId = getTrainerNextWorkoutId(args, constructorMode);
    const workouts = getPlanWorkouts(plan);

    const nextWorkouts = workouts.filter((workout) => workout.id !== workoutId);
    if (nextWorkouts.length === workouts.length) return false;

    persistPlan(createTrainerNextPlan(plan, nextWorkouts));
    return true;
  }

  return {
    updateTrainerNextWorkout,
    updateTrainerNextExercise,
    saveTrainerExerciseProgressAdjustment,
    updateTrainerLibraryExercise,
    removeTrainerLibraryExercise,
    createTrainerLibraryExercise,
    updateTrainerNextExerciseSet,
    addTrainerNextExerciseSet,
    removeTrainerNextExerciseSet,
    addTrainerNextExercise,
    removeTrainerNextExercise,
    duplicateTrainerNextExercise,
    moveTrainerNextExercise,
    uploadTrainerNextExerciseVideo,
    uploadTrainerLibraryExerciseVideo,
    addTrainerNextWorkoutDay,
    duplicateTrainerNextWorkoutDay,
    removeTrainerNextWorkoutDay
  };
}
