import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";

import { addLocalBackup } from "../../../utils/storageSafety";
import { safeWriteUserJsonStorage } from "../../../utils/userScopedStorage";
import { syncWorkoutCalendarWithPlan } from "../../../utils/workoutSchedule";
import { makeThreeSets } from "../../../utils/workoutPlanNormalization";
import { exerciseUsesExternalWeight } from "../../../utils/auditSafety";

export async function saveWorkoutsToFirebaseWithDeps({
  db,
  auth,
  selectedUserId,
  plan,
  workoutPlanBackupStorageKey,
  workoutCalendarStorageKey,
  showAppError,
  setAdminClientStatus,
  setAdminSelectedClient,
  setUsersList,
  setProfileWorkoutCalendarData,
  setProfileWorkoutScheduledDates,
  setProfileWorkoutCalendarDraftDates,
  planOverride = null,
  options = {}
}) {
  try {
    const userId = selectedUserId || auth.currentUser?.uid;
    const hasPlanOverride = Boolean(planOverride && typeof planOverride === "object" && Array.isArray(planOverride.workouts));
    const planToSave = hasPlanOverride ? planOverride : plan;
    const saveOptions = hasPlanOverride ? options : {};
    const silent = Boolean(saveOptions.silent);

    if (!userId) {
      if (silent) setAdminClientStatus("Пользователь не найден.");
      else showAppError("load", "Пользователь не найден");
      return;
    }

    addLocalBackup(workoutPlanBackupStorageKey, {
      plan: planToSave,
      reason: "before_workouts_cloud_save",
      userId
    }, 10);

    const workoutsRef = collection(db, "users", userId, "workouts");
    const userRef = doc(db, "users", userId);
    const [existingWorkouts, userSnapshot] = await Promise.all([
      getDocs(workoutsRef),
      getDoc(userRef)
    ]);
    const userData = userSnapshot.exists() ? userSnapshot.data() : {};
    const nowIso = new Date().toISOString();
    const currentWorkoutIds = new Set((planToSave.workouts || []).map((workout) => workout.id));
    const batch = writeBatch(db);
    const nextWorkoutCalendar = syncWorkoutCalendarWithPlan(
      userData.workoutCalendar || {},
      planToSave.workouts || [],
      nowIso,
      auth.currentUser?.uid || ""
    );
    const rootAssignmentInfo = {
      assignedProgramId: nextWorkoutCalendar.assignedProgramId || planToSave.assignedProgramId || userData.assignedProgramId || "",
      assignedProgramName: nextWorkoutCalendar.assignedProgramName || planToSave.assignedProgramName || userData.assignedProgramName || "",
      assignedProgramUpdatedAt: nextWorkoutCalendar.assignedProgramUpdatedAt || planToSave.assignedProgramUpdatedAt || userData.assignedProgramUpdatedAt || userData.assignedProgramAt || ""
    };
    const getPlannedSlot = (workout, index) => (
      (Array.isArray(nextWorkoutCalendar.plannedWorkouts) ? nextWorkoutCalendar.plannedWorkouts : []).find((item) => (
        String(item?.workoutId || "").trim() === String(workout?.id || "").trim() ||
        Number(item?.order) === index + 1 ||
        Number(item?.index) === index
      )) || {}
    );

    existingWorkouts.forEach((workoutDoc) => {
      if (!currentWorkoutIds.has(workoutDoc.id)) {
        batch.delete(workoutDoc.ref);
      }
    });

    for (const [workoutIndex, workout] of (planToSave.workouts || []).entries()) {
      const plannedSlot = getPlannedSlot(workout, workoutIndex);
      const scheduleOrder = Number(workout.scheduleOrder || plannedSlot.order || workoutIndex + 1);
      const plannedDate = workout.plannedDate || workout.scheduledDate || plannedSlot.date || "";
      const status = workout.status || plannedSlot.status || "planned";
      const assignmentInfo = {
        assignedProgramId: workout.assignedProgramId || rootAssignmentInfo.assignedProgramId,
        assignedProgramName: workout.assignedProgramName || rootAssignmentInfo.assignedProgramName,
        assignedProgramUpdatedAt: workout.assignedProgramUpdatedAt || rootAssignmentInfo.assignedProgramUpdatedAt
      };
      batch.set(doc(db, "users", userId, "workouts", workout.id), {
        ...workout,
        id: workout.id,
        name: workout.name || `День ${workoutIndex + 1}`,
        order: workoutIndex + 1,
        sortOrder: workoutIndex + 1,
        scheduleOrder,
        scheduledDate: plannedDate,
        plannedDate,
        status,
        movedToDate: workout.movedToDate || plannedSlot.movedToDate || "",
        statusUpdatedAt: workout.statusUpdatedAt || plannedSlot.statusUpdatedAt || "",
        ...assignmentInfo,
        assignedBy: auth.currentUser?.uid || "",
        assignedAt: workout.assignedAt || nowIso,
        exercises: (workout.exercises || []).map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          video: exercise.video || exercise.videoUrl || exercise.videoURL || "",
          videoAutoFilledFrom: exercise.videoAutoFilledFrom || "",
          rest: exercise.rest || "90 сек",
          requiresWeight: exercise.requiresWeight ?? exerciseUsesExternalWeight(exercise),
          usesWeight: exercise.requiresWeight ?? exerciseUsesExternalWeight(exercise),
          note: exercise.note || "",
          description: exercise.description || "",
          technique: exercise.technique || "",
          sets: makeThreeSets(exercise.sets, exercise.name?.includes("Пресс") ? 15 : 8).map((set) => ({
            ...(set?.id ? { id: set.id } : {}),
            reps: set?.reps ?? "",
            weight: set?.weight ?? ""
          }))
        }))
      }, { merge: true });
    }

    batch.set(userRef, {
      workoutCalendar: nextWorkoutCalendar,
      ...rootAssignmentInfo,
      assignedWorkoutCount: (planToSave.workouts || []).length,
      updatedAt: nowIso
    }, { merge: true });

    await batch.commit();
    const clientPatch = {
      workoutCalendar: nextWorkoutCalendar,
      ...rootAssignmentInfo,
      assignedWorkoutCount: (planToSave.workouts || []).length
    };
    setAdminSelectedClient((prev) => prev?.id === userId ? { ...prev, ...clientPatch } : prev);
    setUsersList((prev) => prev.map((item) => item.id === userId ? { ...item, ...clientPatch } : item));
    if (auth.currentUser?.uid === userId) {
      setProfileWorkoutCalendarData(nextWorkoutCalendar);
      setProfileWorkoutScheduledDates(nextWorkoutCalendar.scheduledDates || []);
      setProfileWorkoutCalendarDraftDates(nextWorkoutCalendar.scheduledDates || []);
      safeWriteUserJsonStorage(workoutCalendarStorageKey, userId, nextWorkoutCalendar);
    }
    if (silent) setAdminClientStatus(saveOptions.successMessage || "Изменения тренировки сохранены.");
    else showAppError("savedLocal", "Тренировки пользователя сохранены.");
  } catch (err) {
    console.error("Ошибка сохранения тренировок:", err);
    if (options?.silent) setAdminClientStatus("Не получилось сохранить изменения тренировки.");
    else showAppError("firebase", "Не получилось сохранить тренировки.");
  }
}
