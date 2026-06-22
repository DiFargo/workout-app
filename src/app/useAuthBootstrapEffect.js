import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";

import {
  applySignedOutBootstrapState,
  hydrateCachedUserState,
  hydrateRemoteTelegramProfile,
  loadInitialSignedInUserData,
  loadRemoteUserBootstrapState,
  resolveAdminClaim,
  resetAuthBootstrapState
} from "./appBootstrapHelpers";

export function useAuthBootstrapEffect(getBootstrapContext) {
  useEffect(() => {
    const {
      AI_NUTRITION_PLAN_STORAGE_KEY,
      AI_NUTRITION_PROFILE_STORAGE_KEY,
      APP_PAGES,
      APP_THEMES,
      CLIENT_LAST_PAGE_STORAGE_KEY,
      FIRST_SETUP_REQUIRED_VERSION,
      NUTRITION_STORAGE_KEY,
      STORAGE_KEY,
      TELEGRAM_PROFILE_STORAGE_KEY,
      WORKOUT_CALENDAR_STORAGE_KEY,
      WORKOUT_MODE_STORAGE_KEY,
      auth,
      createEmptyAiNutritionProfileDraft,
      createEmptyTelegramProfile,
      db,
      defaultNutritionState,
      endPerformanceCheck,
      getDefaultWorkoutModePreference,
      hasRequiredAiNutritionProfileFields,
      loadClientProgressPhotos,
      loadClientTrainerTasks,
      loadHistory,
      loadNutritionFromFirebase,
      loadProfileMeasurements,
      loadRecentNutritionFoods,
      loadWorkoutsFromFirebase,
      normalizeAppPage,
      normalizeClientPrimaryPage,
      refreshTelegramAvatar,
      replayFailedHistorySaves,
      replayFailedMeasurementSaves,
      replayFailedNutritionSync,
      safeReadUserJsonStorage,
      safeWriteUserJsonStorage,
      setAiNutritionProfile,
      setAiNutritionProfileDraft,
      setAiNutritionSavedPlan,
      setAppLoading,
      setAppTheme,
      setAppThemeCloudReady,
      setClientProgressPhotos,
      setCurrentUserRole,
      setFirstSetupCompletedInCloud,
      setFirstSetupCompletedInSession,
      setFirstSetupProfileHydrated,
      setIsAdminClaim,
      setIsLoggedIn,
      setNutrition,
      setNutritionCloudReady,
      setOnboardingStep,
      setPage,
      setPlan,
      setProfileAccount,
      setProfileAccountAvatarFile,
      setProfileAccountAvatarPreview,
      setProfileAccountDraft,
      setProfileAccountStatus,
      setProfileMeasurements,
      setProfileWorkoutCalendarData,
      setProfileWorkoutCalendarDraftDates,
      setProfileWorkoutCalendarEditing,
      setProfileWorkoutCalendarStatus,
      setProfileWorkoutScheduledDates,
      setRecentNutritionFoods,
      setShowFirstSetupOnboarding,
      setTelegramConnectOpen,
      setTelegramDraft,
      setTelegramProfile,
      setTelegramStatus,
      setUser,
      setWorkoutModePreference,
      setWorkoutModeRemember,
      startPerformanceCheck
    } = getBootstrapContext();
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      const startedAt = Date.now();
      startPerformanceCheck("Auth + initial app data", { signedIn: Boolean(u) });

      resetAuthBootstrapState({
        user: u,
        defaultNutritionState,
        createEmptyAiNutritionProfileDraft,
        createEmptyTelegramProfile,
        setFirstSetupProfileHydrated,
        setFirstSetupCompletedInCloud,
        setFirstSetupCompletedInSession,
        setShowFirstSetupOnboarding,
        setOnboardingStep,
        setAppThemeCloudReady,
        setAiNutritionProfile,
        setAiNutritionProfileDraft,
        setAiNutritionSavedPlan,
        setTelegramProfile,
        setTelegramDraft,
        setTelegramStatus,
        setTelegramConnectOpen,
        setProfileAccount,
        setProfileAccountDraft,
        setProfileAccountAvatarFile,
        setProfileAccountAvatarPreview,
        setProfileAccountStatus,
        setNutritionCloudReady,
        setNutrition,
        setRecentNutritionFoods,
        setUser,
        setIsLoggedIn
      });

      hydrateCachedUserState({
        user: u,
        AI_NUTRITION_PLAN_STORAGE_KEY,
        AI_NUTRITION_PROFILE_STORAGE_KEY,
        NUTRITION_STORAGE_KEY,
        TELEGRAM_PROFILE_STORAGE_KEY,
        WORKOUT_CALENDAR_STORAGE_KEY,
        WORKOUT_MODE_STORAGE_KEY,
        STORAGE_KEY,
        defaultNutritionState,
        createEmptyTelegramProfile,
        getDefaultWorkoutModePreference,
        hasRequiredAiNutritionProfileFields,
        loadRecentNutritionFoods,
        safeReadUserJsonStorage,
        setAiNutritionProfile,
        setAiNutritionProfileDraft,
        setAiNutritionSavedPlan,
        setNutrition,
        setPlan,
        setProfileWorkoutCalendarData,
        setProfileWorkoutCalendarDraftDates,
        setProfileWorkoutScheduledDates,
        setRecentNutritionFoods,
        setTelegramDraft,
        setTelegramProfile,
        setWorkoutModePreference,
        setWorkoutModeRemember,
        setProfileWorkoutCalendarEditing,
        setProfileWorkoutCalendarStatus
      });

      if (u) {
        const nextIsAdmin = await resolveAdminClaim({
          user: u,
          setIsAdminClaim
        });

        await loadRemoteUserBootstrapState({
          user: u,
          db,
          isAdmin: nextIsAdmin,
          APP_PAGES,
          APP_THEMES,
          AI_NUTRITION_PLAN_STORAGE_KEY,
          AI_NUTRITION_PROFILE_STORAGE_KEY,
          CLIENT_LAST_PAGE_STORAGE_KEY,
          FIRST_SETUP_REQUIRED_VERSION,
          WORKOUT_CALENDAR_STORAGE_KEY,
          hasRequiredAiNutritionProfileFields,
          normalizeAppPage,
          normalizeClientPrimaryPage,
          safeReadUserJsonStorage,
          safeWriteUserJsonStorage,
          setAiNutritionProfile,
          setAiNutritionProfileDraft,
          setAiNutritionSavedPlan,
          setAppTheme,
          setAppThemeCloudReady,
          setCurrentUserRole,
          setFirstSetupCompletedInCloud,
          setFirstSetupProfileHydrated,
          setPage,
          setProfileAccount,
          setProfileAccountDraft,
          setProfileWorkoutCalendarData,
          setProfileWorkoutCalendarDraftDates,
          setProfileWorkoutScheduledDates
        });

        await loadInitialSignedInUserData({
          user: u,
          loadWorkoutsFromFirebase,
          loadHistory,
          loadNutritionFromFirebase,
          loadProfileMeasurements,
          loadClientProgressPhotos,
          loadClientTrainerTasks,
          replayFailedHistorySaves,
          replayFailedNutritionSync,
          replayFailedMeasurementSaves
        });

        await hydrateRemoteTelegramProfile({
          user: u,
          db,
          TELEGRAM_PROFILE_STORAGE_KEY,
          refreshTelegramAvatar,
          safeWriteUserJsonStorage,
          setTelegramDraft,
          setTelegramProfile
        });
      } else {
        applySignedOutBootstrapState({
          STORAGE_KEY,
          setClientProgressPhotos,
          setCurrentUserRole,
          setFirstSetupProfileHydrated,
          setAppThemeCloudReady,
          setNutritionCloudReady,
          setPlan,
          setProfileMeasurements
        });
      }

      endPerformanceCheck("Auth + initial app data", { signedIn: Boolean(u) });

      const elapsed = Date.now() - startedAt;
      const minimumSplashTime = 900;

      setTimeout(() => {
        setAppLoading(false);
      }, Math.max(0, minimumSplashTime - elapsed));
    });

    return () => unsubscribe();
  }, []);
}
