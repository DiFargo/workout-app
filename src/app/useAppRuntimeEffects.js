import { useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

import { APP_THEMES, normalizeAppTheme } from "./appTheme";
import {
  addUserLocalBackup,
  safeWriteUserJsonStorage
} from "../utils/userScopedStorage";

export function useAppRuntimeEffects({
  APP_PAGES,
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
  setShowFirstSetupOnboarding
}) {
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

    return onSnapshot(
      doc(db, "users", user.uid),
      (snapshot) => {
        const remoteTheme = snapshot.data()?.appTheme;
        if (remoteTheme === APP_THEMES.WARM_LIGHT || remoteTheme === APP_THEMES.DARK_GREEN) {
          setAppTheme((currentTheme) => remoteTheme !== currentTheme ? remoteTheme : currentTheme);
        }
        setAppThemeCloudReady(true);
      },
      (error) => console.warn("Theme subscription error", error)
    );
  }, [db, setAppTheme, setAppThemeCloudReady, user?.uid]);

  useEffect(() => {
    const hasTrainerDashboard = Boolean(
      isAdminClaim || currentUserRole === "admin" || currentUserRole === "trainer"
    );

    if (isLoggedIn && !appLoading && hasTrainerDashboard && page === APP_PAGES.MAIN) {
      setSelectedUserId(null);
      setPage(APP_PAGES.ADMIN);
    }
  }, [APP_PAGES.ADMIN, APP_PAGES.MAIN, appLoading, currentUserRole, isAdminClaim, isLoggedIn, page, setPage, setSelectedUserId]);

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

    safeWriteUserJsonStorage(workoutStorageKey, user.uid, plan);
    addUserLocalBackup(workoutPlanBackupStorageKey, user.uid, { plan }, 10);
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

      setShowFirstSetupOnboarding(false);
      return;
    }

    if (!completedForThisUser) {
      setShowFirstSetupOnboarding(true);
      setTimeout(() => setShowFirstSetupOnboarding(true), 120);
      setTimeout(() => setShowFirstSetupOnboarding(true), 600);
    }
  }, [
    aiNutritionProfile,
    appLoading,
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
