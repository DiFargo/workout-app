import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import {
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "../../../utils/userScopedStorage";
import { clearStaleWorkoutCaches } from "../../../utils/workoutDraftStorage";

export async function loadWorkoutsFromFirebaseWithDeps({
  db,
  auth,
  selectedUserId,
  plan,
  storageKey,
  normalizeExercise,
  sortWorkoutDays,
  canUseAdminFeatures,
  startPerformanceCheck,
  endPerformanceCheck,
  showAppError,
  setPlan,
  userIdFromClick,
  options = {}
}) {
  const preserveCurrentPlanOnError = options.preserveCurrentPlanOnError === true;
  const currentUser = auth.currentUser;
  const targetUserId = userIdFromClick || selectedUserId || currentUser?.uid;
  const isOwnPlan = currentUser?.uid === targetUserId;

  try {
    if (!targetUserId) {
      const emptyPlan = { workouts: [] };
      setPlan(emptyPlan);
      return emptyPlan;
    }

    const isAdminLoadingClient = Boolean(userIdFromClick || selectedUserId) && canUseAdminFeatures();

    startPerformanceCheck("Firebase · workouts load", {
      userId: String(targetUserId).slice(0, 6),
      ownPlan: isOwnPlan,
      admin: isAdminLoadingClient
    });

    // Client sees only workouts assigned by trainer in users/{uid}/workouts.
    const [querySnapshot, profileSnapshot] = await Promise.all([
      getDocs(collection(db, "users", targetUserId, "workouts")),
      getDoc(doc(db, "users", targetUserId))
    ]);
    const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
    const assignedProgramUpdatedAt = profileData.assignedProgramUpdatedAt || profileData.assignedProgramAt || "";

    const workoutsFromDb = [];

    querySnapshot.forEach((workoutDoc) => {
      const data = workoutDoc.data();

      workoutsFromDb.push({
        id: workoutDoc.id,
        name: data.name || "Без названия",
        order: data.order,
        sortOrder: data.sortOrder,
        status: data.status || "planned",
        statusUpdatedAt: data.statusUpdatedAt || "",
        movedToDate: data.movedToDate || "",
        scheduledDate: data.scheduledDate || "",
        plannedDate: data.plannedDate || "",
        assignedBy: data.assignedBy || "",
        assignedAt: data.assignedAt || "",
        assignedProgramId: data.assignedProgramId || profileData.assignedProgramId || "",
        assignedProgramName: data.assignedProgramName || profileData.assignedProgramName || "",
        assignedProgramUpdatedAt: data.assignedProgramUpdatedAt || assignedProgramUpdatedAt,
        exercises: (data.exercises || []).map(normalizeExercise)
      });
    });

    const nextPlan = {
      assignedProgramId: profileData.assignedProgramId || "",
      assignedProgramName: profileData.assignedProgramName || "",
      assignedProgramUpdatedAt,
      workouts: sortWorkoutDays(workoutsFromDb)
    };

    if (isOwnPlan && currentUser?.uid) {
      clearStaleWorkoutCaches(currentUser.uid, assignedProgramUpdatedAt);
    }
    setPlan(nextPlan);

    if (isOwnPlan && currentUser?.uid) {
      safeWriteUserJsonStorage(storageKey, currentUser.uid, nextPlan);
    }

    endPerformanceCheck("Firebase · workouts load", {
      workouts: workoutsFromDb.length
    });
    return nextPlan;
  } catch (err) {
    console.error("Ошибка загрузки тренировок:", err);
    if (preserveCurrentPlanOnError) {
      return plan;
    }

    if (isOwnPlan && currentUser?.uid) {
      const cachedPlan = safeReadUserJsonStorage(storageKey, currentUser.uid, null);
      if (Array.isArray(cachedPlan?.workouts) && cachedPlan.workouts.length > 0) {
        setPlan(cachedPlan);
        showAppError("savedLocal", "Нет соединения. Показываю последнюю сохранённую программу.");
        return cachedPlan;
      }
    }

    const emptyPlan = { workouts: [] };
    setPlan(emptyPlan);
    showAppError("firebase", "Не получилось загрузить назначенные тренировки.");
    return emptyPlan;
  }
}
