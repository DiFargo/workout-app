import { useEffect, useEffectEvent } from "react";
import { useClientAppearance } from "../features/client/appearance/clientAppearance.js";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

import { normalizeAppTheme } from "./appTheme";
import { isTrainerForbiddenClientPage } from "./appNavigation";
import { captureAuthSession } from "../utils/authSession.js";
import { resolveUserRole } from "../utils/roleAccess.js";
import { rememberOfflineClientProfile } from "../utils/offlineWorkoutAccess.js";
import { invalidateSessionResource } from "../utils/sessionResource.js";
import { invalidateWorkoutHistory } from "../utils/workoutHistoryRevision.js";
import { invalidateWorkoutPlan } from "../utils/workoutPlanAuthority.js";
import { compactStoredWorkoutPlans, createPersistableWorkoutPlan } from "../utils/workoutPlanStorage.js";
import {
  addUserLocalBackup,
  safeWriteUserJsonStorage
} from "../utils/userScopedStorage";

export function useAppRuntimeEffects({
  APP_PAGES,
  auth,
  appLoading,
  appTheme,
  appThemeCloudReady,
  currentUserRole,
  db,
  firstSetupCompletedInCloud,
  firstSetupCompletedInSession,
  firstSetupDoneUserStorageKey,
  firstSetupProfileHydrated,
  firstSetupRequiredVersion,
  isAdminClaim,
  isClientPrimaryPage,
  isLoggedIn,
  page,
  plan,
  user,
  appThemeStorageKey,
  clientLastPageStorageKey,
  workoutPlanBackupStorageKey,
  workoutStorageKey,
  aiNutritionProfile,
  hasRequiredAiNutritionProfileFields,
  normalizeAppPage,
  setAppTheme,
  setAppThemeCloudReady,
  setPage,
  setSelectedUserId,
  setCurrentUserRole,
  onMemberAccessRevoked,
  onMemberAssignmentChanged,
  setShowFirstSetupOnboarding
}) {
  useClientAppearance(isLoggedIn && currentUserRole === "client");
  const revokeMemberMedia = useEffectEvent(() => onMemberAccessRevoked?.());
  const refreshMemberAssignment = useEffectEvent(() => onMemberAssignmentChanged?.());
  useEffect(() => {
    const safeTheme = normalizeAppTheme(appTheme);
    document.documentElement.dataset.appTheme = safeTheme;
    document.body.dataset.appTheme = safeTheme;

    try {
      localStorage.setItem(appThemeStorageKey, safeTheme);
    } catch {
      // ignore localStorage errors
    }
  }, [appTheme, appThemeStorageKey]);

  useEffect(() => {
    if (!user?.uid || !appThemeCloudReady) return;

    const safeTheme = normalizeAppTheme(appTheme);
    setDoc(doc(db, "users", user.uid), {
      appTheme: safeTheme,
      appThemeUpdatedAt: new Date().toISOString()
    }, { merge: true }).catch((error) => console.warn("Theme sync error", error));
  }, [appTheme, appThemeCloudReady, db, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const session = captureAuthSession(auth);
    if (session.uid !== user.uid || !session.isCurrent()) return undefined;
    let active = true;
    let previousAssignmentRevision = null;
    let previousAccessRevision = null;
    const unsubscribe = onSnapshot(
      doc(db, "users", user.uid),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (!active || !session.isCurrent()) return;
        const data = snapshot.data() || {};
        const remoteTheme = normalizeAppTheme(data.appTheme);
        setAppTheme((currentTheme) => active && session.isCurrent() && remoteTheme !== currentTheme ? remoteTheme : currentTheme);
        setAppThemeCloudReady(true);
        if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) {
          rememberOfflineClientProfile(user.uid, data, true);
          const accessRevision = JSON.stringify([data.role, data.accountAccessStatus, data.trainerAssignmentState,
            data.active, data.archived, data.accessDisabled, data.membershipStatus]);
          const assignmentRevision = JSON.stringify([data.role, data.accountAccessStatus, data.trainerAssignmentState,
            data.active, data.archived, data.accessDisabled, data.membershipStatus, data.assignedProgramId,
            data.assignedProgramAddedAt, data.assignedProgramUpdatedAt, data.assignedProgramLifecycleStatus,
            data.trainerUid, data.trainerId, data.trainerEmail, data.workoutCalendar?.updatedAt]);
          if (previousAssignmentRevision !== null && assignmentRevision !== previousAssignmentRevision) {
            if (accessRevision !== previousAccessRevision) invalidateSessionResource(auth);
            else invalidateSessionResource(auth, key => key.startsWith("client-demand:history:"));
            invalidateWorkoutHistory(auth);
            invalidateWorkoutPlan(auth);
            refreshMemberAssignment();
          }
          previousAssignmentRevision = assignmentRevision;
          previousAccessRevision = accessRevision;
        }
        if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites && snapshot.exists() &&
          resolveUserRole({ role: data.role, accountAccessStatus: data.accountAccessStatus, trainerAssignmentState: data.trainerAssignmentState }) === "pending-client") {
          revokeMemberMedia();
          setCurrentUserRole?.(role => active && session.isCurrent() && role === "client" ? "pending-client" : role);
        }
      },
      (error) => console.warn("Theme subscription error", error)
    );
    return () => { active = false; unsubscribe(); };
  }, [auth, db, setAppTheme, setAppThemeCloudReady, setCurrentUserRole, user?.uid]);

  useEffect(() => {
    const hasTrainerDashboard = Boolean(
      isAdminClaim ||
      currentUserRole === "admin" ||
      currentUserRole === "trainer"
    );
    const trainerForbiddenClientPage = isTrainerForbiddenClientPage(page);

    if (isLoggedIn && !appLoading && hasTrainerDashboard && trainerForbiddenClientPage) {
      setSelectedUserId(null);
      setPage(APP_PAGES.ADMIN);
    }
  }, [
    APP_PAGES.ADMIN,
    appLoading,
    currentUserRole,
    isAdminClaim,
    isLoggedIn,
    page,
    setPage,
    setSelectedUserId,
    user?.email
  ]);

  useEffect(() => {
    const normalizedClientPrimaryPage = normalizeAppPage(page);
    if (
      !isLoggedIn ||
      appLoading ||
      !user?.uid ||
      currentUserRole !== "client" ||
      !isClientPrimaryPage(normalizedClientPrimaryPage)
    ) return;

    safeWriteUserJsonStorage(clientLastPageStorageKey, user.uid, normalizedClientPrimaryPage);

    const currentHistoryPage = window.history.state?.workoutAppPage;
    if (!currentHistoryPage) {
      window.history.replaceState(
        { ...(window.history.state || {}), workoutAppPage: normalizedClientPrimaryPage },
        ""
      );
    } else if (currentHistoryPage !== normalizedClientPrimaryPage) {
      window.history.pushState(
        { ...(window.history.state || {}), workoutAppPage: normalizedClientPrimaryPage },
        ""
      );
    }
  }, [appLoading, clientLastPageStorageKey, currentUserRole, isClientPrimaryPage, isLoggedIn, normalizeAppPage, page, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    compactStoredWorkoutPlans(user.uid, { workoutPlanBackupStorageKey });
    const savedPlan = createPersistableWorkoutPlan(plan);
    safeWriteUserJsonStorage(workoutStorageKey, user.uid, plan);
    addUserLocalBackup(workoutPlanBackupStorageKey, user.uid, { plan: savedPlan }, 10);
  }, [plan, user?.uid, workoutPlanBackupStorageKey, workoutStorageKey]);

  useEffect(() => {
    if (
      !isLoggedIn ||
      appLoading ||
      !user?.uid ||
      !firstSetupProfileHydrated ||
      firstSetupCompletedInSession ||
      currentUserRole !== "client"
    ) return;

    const session = captureAuthSession(auth);
    if (session.uid !== user.uid || !session.isCurrent()) return;
    let active = true;
    const timerIds = [];
    const setOnboardingOpen = (open) => {
      if (!active || !session.isCurrent()) return;
      setShowFirstSetupOnboarding((current) => active && session.isCurrent() ? open : current);
    };
    const cleanup = () => {
      active = false;
      timerIds.forEach((timerId) => clearTimeout(timerId));
    };

    let completedForThisUser;

    try {
      completedForThisUser =
        localStorage.getItem(firstSetupDoneUserStorageKey) === `${user.uid}:${firstSetupRequiredVersion}` ||
        localStorage.getItem(`${firstSetupDoneUserStorageKey}:${user.uid}`) === firstSetupRequiredVersion;
    } catch {
      completedForThisUser = false;
    }

    const profileHasRequiredFields = hasRequiredAiNutritionProfileFields(aiNutritionProfile);

    if (firstSetupCompletedInCloud || profileHasRequiredFields) {
      try {
        localStorage.setItem(firstSetupDoneUserStorageKey, `${user.uid}:${firstSetupRequiredVersion}`);
        localStorage.setItem(`${firstSetupDoneUserStorageKey}:${user.uid}`, firstSetupRequiredVersion);
      } catch {
        // ignore localStorage errors
      }

      setOnboardingOpen(false);
      return cleanup;
    }

    if (!completedForThisUser) {
      setOnboardingOpen(true);
      timerIds.push(setTimeout(() => setOnboardingOpen(true), 120));
      timerIds.push(setTimeout(() => setOnboardingOpen(true), 600));
    }
    return cleanup;
  }, [
    aiNutritionProfile,
    appLoading,
    auth,
    currentUserRole,
    firstSetupCompletedInCloud,
    firstSetupCompletedInSession,
    firstSetupDoneUserStorageKey,
    firstSetupProfileHydrated,
    firstSetupRequiredVersion,
    hasRequiredAiNutritionProfileFields,
    isLoggedIn,
    setShowFirstSetupOnboarding,
    user?.uid
  ]);
}
