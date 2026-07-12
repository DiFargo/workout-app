import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import {
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "../../../utils/userScopedStorage";
import { normalizeBasicWorkoutPlanState } from "../../../utils/basicWorkoutPlanBuilder.js";
import { clearStaleWorkoutCaches } from "../../../utils/workoutDraftStorage";
import { isTrainerProgramClientVisible } from "../../../utils/trainerProgramLifecycle.js";

export async function loadWorkoutsFromFirebaseWithDeps({
  db,
  auth,
  selectedUserId,
  plan,
  storageKey,
  basicWorkoutPlanStorageKey,
  workoutModeStorageKey,
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
  const preserveBasicPlanOnEmpty = options.preserveBasicPlanOnEmpty === true;
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
    if (isOwnPlan && auth.currentUser?.uid !== targetUserId) return { workouts: [] };
    const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
    const assignedProgramUpdatedAt = profileData.assignedProgramUpdatedAt || profileData.assignedProgramAt || "";

    const workoutsFromDb = [];

    querySnapshot.forEach((workoutDoc) => {
      const data = workoutDoc.data();
      const workoutAssignmentVersion = String(data.assignedProgramUpdatedAt || assignedProgramUpdatedAt || "").trim();
      const isBasicWorkout = data.source === "basic" || workoutAssignmentVersion.startsWith("basic:");
      const isClientVisibleLifecycle = isBasicWorkout || isTrainerProgramClientVisible({
        lifecycleStatus: data.assignedProgramLifecycleStatus || "active"
      });
      const isCurrentAssignment = !assignedProgramUpdatedAt ||
        !workoutAssignmentVersion ||
        workoutAssignmentVersion === String(assignedProgramUpdatedAt || "").trim() ||
        isBasicWorkout;

      if (!isClientVisibleLifecycle) return;
      if (!isCurrentAssignment) return;

      workoutsFromDb.push({
        id: workoutDoc.id,
        source: data.source || "",
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
        assignedProgramUpdatedAt: workoutAssignmentVersion,
        exercises: (data.exercises || []).map(normalizeExercise)
      });
    });

    const nextPlan = {
      assignedProgramId: profileData.assignedProgramId || "",
      assignedProgramName: profileData.assignedProgramName || "",
      assignedProgramUpdatedAt,
      workouts: sortWorkoutDays(workoutsFromDb)
    };
    const basicWorkoutsFromDb = workoutsFromDb.filter((workout) => (
      workout.source === "basic" ||
      String(workout.assignedProgramUpdatedAt || "").startsWith("basic:")
    ));
    const firstBasicWorkout = basicWorkoutsFromDb[0];
    if (firstBasicWorkout) {
      nextPlan.source = "basic";
      nextPlan.basicPlanId = firstBasicWorkout.assignedProgramId || profileData.basicWorkoutPlan?.basicPlanId || "";
      nextPlan.basicPlanName = firstBasicWorkout.assignedProgramName || profileData.basicWorkoutPlan?.basicPlanName || "";
      nextPlan.assignedProgramId = firstBasicWorkout.assignedProgramId || nextPlan.assignedProgramId;
      nextPlan.assignedProgramName = firstBasicWorkout.assignedProgramName || nextPlan.assignedProgramName;
      nextPlan.assignedProgramUpdatedAt = firstBasicWorkout.assignedProgramUpdatedAt || nextPlan.assignedProgramUpdatedAt;
      nextPlan.workouts = sortWorkoutDays(basicWorkoutsFromDb);
    }

    if (
      isOwnPlan &&
      preserveBasicPlanOnEmpty &&
      workoutsFromDb.length === 0 &&
      currentUser?.uid &&
      basicWorkoutPlanStorageKey &&
      workoutModeStorageKey
    ) {
      const userScopedWorkoutModePreference = safeReadUserJsonStorage(workoutModeStorageKey, currentUser.uid, null);
      const savedWorkoutModePreference = userScopedWorkoutModePreference;
      const remoteBasicPlan = profileData.basicWorkoutPlan || null;
      const cachedBasicPlan = safeReadUserJsonStorage(basicWorkoutPlanStorageKey, currentUser.uid, null);
      const currentBasicPlan = plan?.source === "basic" ? plan : null;
      const preservedBasicPlan = Array.isArray(remoteBasicPlan?.workouts) && remoteBasicPlan.workouts.length > 0
        ? normalizeBasicWorkoutPlanState(remoteBasicPlan)
        : Array.isArray(cachedBasicPlan?.workouts) && cachedBasicPlan.workouts.length > 0
          ? normalizeBasicWorkoutPlanState(cachedBasicPlan)
          : Array.isArray(currentBasicPlan?.workouts) && currentBasicPlan.workouts.length > 0
          ? normalizeBasicWorkoutPlanState(currentBasicPlan)
          : null;

      if (savedWorkoutModePreference?.mode === "basic" && preservedBasicPlan?.workouts?.length > 0) {
        setPlan(preservedBasicPlan);
        safeWriteUserJsonStorage(basicWorkoutPlanStorageKey, currentUser.uid, preservedBasicPlan);
        endPerformanceCheck("Firebase · workouts load", {
          workouts: 0,
          preservedBasicPlan: true
        });
        return preservedBasicPlan;
      }
    }

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
    if (isOwnPlan && auth.currentUser?.uid !== targetUserId) return { workouts: [] };
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
