import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import {
  safeReadUserJsonStorage,
  safeWriteUserJsonStorage
} from "../../../utils/userScopedStorage";
import {
  mergeBasicWorkoutPlanWithSavedWorkouts,
  normalizeBasicWorkoutPlanState
} from "../../../utils/basicWorkoutPlanBuilder.js";
import { clearStaleWorkoutCaches } from "../../../utils/workoutDraftStorage";
import {
  isBasicWorkoutPlanItem,
  resolveWorkoutPlanMode
} from "../../../utils/workoutPlanMode.js";
import { isTrainerProgramClientVisible } from "../../../utils/trainerProgramLifecycle.js";
import {
  buildTrainerClientProgramTimeline,
  isTrainerClientCurrentAssignmentWorkout
} from "../../../utils/trainerClientProgramAssignments.js";

function getGroupExerciseMetadata(taskBlocks = []) {
  const metadataByExerciseId = new Map();

  taskBlocks.forEach((block) => {
    if (block?.type !== "group") return;
    const exerciseIds = Array.isArray(block.exerciseIds) ? block.exerciseIds : [];

    exerciseIds.forEach((exerciseId, exerciseIndex) => {
      const cleanExerciseId = String(exerciseId || "").trim();
      if (!cleanExerciseId || metadataByExerciseId.has(cleanExerciseId)) return;
      metadataByExerciseId.set(cleanExerciseId, {
        block,
        exerciseIndex,
        exerciseCount: exerciseIds.length
      });
    });
  });

  return metadataByExerciseId;
}

export async function loadWorkoutsFromFirebaseWithDeps({
  db,
  auth,
  selectedUserId,
  plan,
  storageKey,
  basicWorkoutPlanStorageKey,
  workoutModeStorageKey,
  workoutModePreference,
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
  const storedWorkoutModePreference = isOwnPlan && currentUser?.uid && workoutModeStorageKey
    ? safeReadUserJsonStorage(workoutModeStorageKey, currentUser.uid, null)
    : null;
  const requestedMode = isOwnPlan
    ? resolveWorkoutPlanMode({
        options,
        workoutModePreference: storedWorkoutModePreference || workoutModePreference
      })
    : "individual";

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
    const [querySnapshot, profileSnapshot, historySnapshot] = await Promise.all([
      getDocs(collection(db, "users", targetUserId, "workouts")),
      getDoc(doc(db, "users", targetUserId)),
      getDocs(collection(db, "users", targetUserId, "history"))
    ]);
    if (isOwnPlan && auth.currentUser?.uid !== targetUserId) return { workouts: [] };
    const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
    const assignedProgramUpdatedAt = profileData.assignedProgramUpdatedAt || profileData.assignedProgramAt || "";
    const workoutHistory = (historySnapshot?.docs || []).map((historyDoc) => ({
      id: historyDoc.id,
      ...(historyDoc.data() || {})
    }));

    const workoutsFromDb = [];
    const individualWorkoutDocuments = [];

    querySnapshot.forEach((workoutDoc) => {
      const data = workoutDoc.data();
      const taskBlocks = Array.isArray(data.taskBlocks) ? data.taskBlocks : [];
      const groupExerciseMetadata = getGroupExerciseMetadata(taskBlocks);
      const workoutAssignmentVersion = String(data.assignedProgramUpdatedAt || assignedProgramUpdatedAt || "").trim();
      const isBasicWorkout = data.source === "basic" || workoutAssignmentVersion.startsWith("basic:");
      if (!isBasicWorkout) {
        individualWorkoutDocuments.push({ id: workoutDoc.id, ...data });
      }
      const isClientVisibleLifecycle = isBasicWorkout || isTrainerProgramClientVisible({
        lifecycleStatus: data.assignedProgramLifecycleStatus || "active"
      });
      const isCurrentAssignment = isBasicWorkout ||
        isTrainerClientCurrentAssignmentWorkout(data, profileData);

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
        assignedProgramAddedAt: data.assignedProgramAddedAt || data.programAssignmentId || data.assignedAt || "",
        taskBlocks,
        exercises: (data.exercises || []).map((exercise) => {
          const groupMetadata = groupExerciseMetadata.get(String(exercise?.id || "").trim());
          return normalizeExercise({
            ...exercise,
            ...(groupMetadata ? {
              taskBlockId: groupMetadata.block.id,
              taskBlockType: "group",
              taskBlockConfig: { ...groupMetadata.block },
              taskBlockExerciseIndex: groupMetadata.exerciseIndex,
              taskBlockExerciseCount: groupMetadata.exerciseCount
            } : {})
          });
        })
      });
    });

    const individualWorkoutsFromDb = workoutsFromDb.filter((workout) => !isBasicWorkoutPlanItem(workout));
    const activeIndividualAssignment = buildTrainerClientProgramTimeline({
      workouts: individualWorkoutDocuments,
      history: workoutHistory,
      clientProfile: profileData
    }).find((assignment) => assignment.workouts.some((workout) => (
      isTrainerClientCurrentAssignmentWorkout(workout, profileData)
    )));
    const activeIndividualProgramCompleted = individualWorkoutsFromDb.length > 0 &&
      (activeIndividualAssignment?.status === "past" || activeIndividualAssignment?.status === "archived");
    const individualPlan = {
      assignedProgramId: activeIndividualProgramCompleted ? "" : (profileData.assignedProgramId || ""),
      assignedProgramName: activeIndividualProgramCompleted ? "" : (profileData.assignedProgramName || ""),
      assignedProgramAt: activeIndividualProgramCompleted ? "" : (profileData.assignedProgramAt || ""),
      assignedProgramUpdatedAt,
      workouts: sortWorkoutDays(activeIndividualProgramCompleted ? [] : individualWorkoutsFromDb)
    };
    const activeBasicPlanId = String(
      profileData.basicWorkoutPlan?.basicPlanId ||
      profileData.basicWorkoutPlan?.id ||
      ""
    );
    const basicWorkoutsFromDb = workoutsFromDb.filter((workout) => {
      return isBasicWorkoutPlanItem(workout) &&
        (!activeBasicPlanId || workout.assignedProgramId === activeBasicPlanId);
    });
    const remoteBasicPlan = profileData.basicWorkoutPlan || null;
    const normalizedRemoteBasicPlan = Array.isArray(remoteBasicPlan?.workouts) && remoteBasicPlan.workouts.length > 0
      ? normalizeBasicWorkoutPlanState(remoteBasicPlan)
      : null;
    const firstBasicWorkout = basicWorkoutsFromDb[0];
    let basicPlanFromDb = null;
    if (normalizedRemoteBasicPlan) {
      basicPlanFromDb = mergeBasicWorkoutPlanWithSavedWorkouts(
        normalizedRemoteBasicPlan,
        basicWorkoutsFromDb
      );
    } else if (firstBasicWorkout) {
      basicPlanFromDb = {
        source: "basic",
        basicPlanId: firstBasicWorkout.assignedProgramId || profileData.basicWorkoutPlan?.basicPlanId || "",
        basicPlanName: firstBasicWorkout.assignedProgramName || profileData.basicWorkoutPlan?.basicPlanName || "",
        assignedProgramId: firstBasicWorkout.assignedProgramId || "",
        assignedProgramName: firstBasicWorkout.assignedProgramName || "",
        assignedProgramUpdatedAt: firstBasicWorkout.assignedProgramUpdatedAt || "",
        workouts: sortWorkoutDays(basicWorkoutsFromDb)
      };
    }

    let nextPlan = requestedMode === "basic"
      ? (basicPlanFromDb || {
          source: "basic",
          basicPlanId: activeBasicPlanId,
          basicPlanName: profileData.basicWorkoutPlan?.basicPlanName || "",
          assignedProgramId: activeBasicPlanId,
          assignedProgramName: profileData.basicWorkoutPlan?.basicPlanName || "",
          assignedProgramUpdatedAt: activeBasicPlanId ? `basic:${activeBasicPlanId}` : "",
          workouts: []
        })
      : individualPlan;

    if (
      isOwnPlan &&
      requestedMode === "basic" &&
      basicWorkoutsFromDb.length === 0 &&
      currentUser?.uid &&
      basicWorkoutPlanStorageKey
    ) {
      const cachedBasicPlan = safeReadUserJsonStorage(basicWorkoutPlanStorageKey, currentUser.uid, null);
      const currentBasicPlan = plan?.source === "basic" ? plan : null;
      const preservedBasicPlan = Array.isArray(remoteBasicPlan?.workouts) && remoteBasicPlan.workouts.length > 0
        ? normalizeBasicWorkoutPlanState(remoteBasicPlan)
        : Array.isArray(cachedBasicPlan?.workouts) && cachedBasicPlan.workouts.length > 0
          ? normalizeBasicWorkoutPlanState(cachedBasicPlan)
          : Array.isArray(currentBasicPlan?.workouts) && currentBasicPlan.workouts.length > 0
          ? normalizeBasicWorkoutPlanState(currentBasicPlan)
          : null;

      if (preservedBasicPlan?.workouts?.length > 0) {
        nextPlan = preservedBasicPlan;
        safeWriteUserJsonStorage(basicWorkoutPlanStorageKey, currentUser.uid, preservedBasicPlan);
      }
    }

    if (isOwnPlan && currentUser?.uid && requestedMode === "individual") {
      clearStaleWorkoutCaches(currentUser.uid, assignedProgramUpdatedAt);
    }
    setPlan(nextPlan);

    if (isOwnPlan && currentUser?.uid) {
      if (requestedMode === "basic" && nextPlan.source === "basic") {
        safeWriteUserJsonStorage(basicWorkoutPlanStorageKey, currentUser.uid, nextPlan);
      } else if (requestedMode === "individual") {
        safeWriteUserJsonStorage(storageKey, currentUser.uid, nextPlan);
      }
    }

    endPerformanceCheck("Firebase · workouts load", {
      workouts: nextPlan.workouts.length,
      mode: requestedMode
    });
    return nextPlan;
  } catch (err) {
    console.error("Ошибка загрузки тренировок:", err);
    if (isOwnPlan && auth.currentUser?.uid !== targetUserId) return { workouts: [] };
    const currentPlanMatchesMode = requestedMode === "basic"
      ? plan?.source === "basic"
      : plan?.source !== "basic";
    if (preserveCurrentPlanOnError && currentPlanMatchesMode) {
      return plan;
    }

    if (isOwnPlan && currentUser?.uid) {
      const cacheKey = requestedMode === "basic"
        ? basicWorkoutPlanStorageKey
        : storageKey;
      const cachedPlan = safeReadUserJsonStorage(cacheKey, currentUser.uid, null);
      const cachedPlanMatchesMode = requestedMode === "basic"
        ? cachedPlan?.source === "basic"
        : cachedPlan?.source !== "basic";
      if (
        cachedPlanMatchesMode &&
        Array.isArray(cachedPlan?.workouts) &&
        cachedPlan.workouts.length > 0
      ) {
        setPlan(cachedPlan);
        showAppError("savedLocal", "Нет соединения. Показываю последнюю сохранённую программу.");
        return cachedPlan;
      }

      if (currentPlanMatchesMode && Array.isArray(plan?.workouts) && plan.workouts.length > 0) {
        return plan;
      }
    }

    const emptyPlan = { workouts: [] };
    setPlan(emptyPlan);
    showAppError("firebase", "Не получилось загрузить назначенные тренировки.");
    return emptyPlan;
  }
}
