import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { advanceAuthSession } from "../utils/authSession";
import { recordStartupStage } from "../utils/performanceChecks.js";
import { cancelAuthProfilePreparation, waitForAuthProfilePreparation } from "../features/auth/authProfilePreparation.js";

import {
  applySignedOutBootstrapState,
  hydrateCachedUserState,
  hydrateRemoteTelegramProfile,
  loadInitialSignedInUserData,
  loadRemoteUserBootstrapState,
  resolveAdminClaim,
  readBootstrapProfileResult,
  resetAuthSessionOperations,
  resetAuthBootstrapState
} from "./appBootstrapHelpers";

const BOOTSTRAP_FALLBACK_TIMEOUT_MS = 9000;

export function useAuthBootstrapEffect(getBootstrapContext) {
  useEffect(() => {
    const bootstrapContext = getBootstrapContext();
    const {
      AI_NUTRITION_PLAN_STORAGE_KEY,
      AI_NUTRITION_PROFILE_STORAGE_KEY,
      APP_PAGES,
      CLIENT_LAST_PAGE_STORAGE_KEY,
      FIRST_SETUP_REQUIRED_VERSION,
      BASIC_WORKOUT_PLAN_STORAGE_KEY,
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
      setClientTrainerTasks,
      setCurrentUserRole,
      setFirstSetupCompletedInCloud,
      setFirstSetupCompletedInSession,
      setFirstSetupProfileHydrated,
      setHistory,
      setIsAdminClaim,
      setIsLoggedIn,
      setNutrition,
      setNutritionCloudReady,
      setOnboardingStep,
      setPage,
      setPlan,
      setInitialWorkoutLoadState,
      setProfileAccount,
      setProfileAccountAvatarFile,
      setProfileAccountAvatarPreview,
      setProfileAccountDraft,
      setProfileAccountStatus,
      setProfileMeasurements,
      setProfileMeasurementSnapshot,
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
    } = bootstrapContext;
    let disposed = false;
    let bootstrapRunId = 0;
    let bootstrapFallbackTimerId = null;

    function clearBootstrapTimers() {
      if (bootstrapFallbackTimerId) {
        window.clearTimeout(bootstrapFallbackTimerId);
        bootstrapFallbackTimerId = null;
      }
    }

    function finishBootstrapLoading({ runId }) {
      if (disposed || runId !== bootstrapRunId) return;
      clearBootstrapTimers();

      setAppLoading(false);
      recordStartupStage("role-gate-released");
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) cancelAuthProfilePreparation(auth);
      advanceAuthSession(auth, u);
      resetAuthSessionOperations(bootstrapContext);
      const runId = bootstrapRunId + 1;
      bootstrapRunId = runId;
      clearBootstrapTimers();
      startPerformanceCheck("Auth + initial app data", { signedIn: Boolean(u) });
      setInitialWorkoutLoadState?.("idle");
      setAppLoading(true);

      bootstrapFallbackTimerId = window.setTimeout(() => {
        if (!disposed && runId === bootstrapRunId) {
          console.warn("Auth bootstrap timeout: role could not be verified");
          setFirstSetupProfileHydrated(true);
          setAppThemeCloudReady(true);
          setCurrentUserRole("unresolved");
          setAppLoading(false);
        }
      }, BOOTSTRAP_FALLBACK_TIMEOUT_MS);

      try {
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
          setClientProgressPhotos,
          setClientTrainerTasks,
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
          setHistory,
          setPlan,
          setProfileMeasurements,
          setProfileMeasurementSnapshot,
          setRecentNutritionFoods,
          setUser,
          setIsLoggedIn,
          setCurrentUserRole
        });

        hydrateCachedUserState({
          user: u,
          AI_NUTRITION_PLAN_STORAGE_KEY,
          AI_NUTRITION_PROFILE_STORAGE_KEY,
          BASIC_WORKOUT_PLAN_STORAGE_KEY,
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
          setProfileWorkoutCalendarStatus,
          isCurrentRun: () => !disposed && runId === bootstrapRunId
        });

        if (u) {
          await waitForAuthProfilePreparation(auth);
          if (disposed || runId !== bootstrapRunId) return;
          startPerformanceCheck("Auth · verified identity and profile");
          const profileRequest = readBootstrapProfileResult(u, db);
          const adminClaims = await resolveAdminClaim({
            user: u,
            setIsAdminClaim,
            isCurrentRun: () => !disposed && runId === bootstrapRunId
          });
          recordStartupStage("identity-verified");
          if (disposed || runId !== bootstrapRunId) return;

          const resolvedRole = await loadRemoteUserBootstrapState({
            user: u,
            db,
            adminClaims,
            profileRequest,
            setIsAdminClaim,
            APP_PAGES,
            AI_NUTRITION_PLAN_STORAGE_KEY,
            AI_NUTRITION_PROFILE_STORAGE_KEY,
            CLIENT_LAST_PAGE_STORAGE_KEY,
            FIRST_SETUP_REQUIRED_VERSION,
            WORKOUT_CALENDAR_STORAGE_KEY,
            WORKOUT_MODE_STORAGE_KEY,
            getDefaultWorkoutModePreference,
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
            setProfileWorkoutScheduledDates,
            setWorkoutModePreference,
            setWorkoutModeRemember,
            isCurrentRun: () => !disposed && runId === bootstrapRunId
          });
          endPerformanceCheck("Auth · verified identity and profile");
          recordStartupStage("profile-verified", { role: resolvedRole || "unresolved" });

          if (disposed || runId !== bootstrapRunId || !resolvedRole) return;

          // The fallback protects role verification. A slow workout load must
          // not revoke a role already verified from the current profile.
          if (["client", "pending-client", "trainer", "admin"].includes(resolvedRole) && bootstrapFallbackTimerId) {
            window.clearTimeout(bootstrapFallbackTimerId);
            bootstrapFallbackTimerId = null;
          }

          if (resolvedRole === "client") {
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
              replayFailedMeasurementSaves,
              onWorkoutsLoadState: state => {
                setInitialWorkoutLoadState?.(state);
                if (state === "ready") recordStartupStage("critical-workouts-ready");
              },
              isCurrentRun: () => !disposed && runId === bootstrapRunId
            });
          } else {
            setPlan({ workouts: [] });
            setNutrition(defaultNutritionState);
            setRecentNutritionFoods([]);
            setProfileMeasurements([]);
            setProfileMeasurementSnapshot?.(null);
            setClientProgressPhotos([]);
            setProfileWorkoutCalendarData({});
            setProfileWorkoutScheduledDates([]);
            setProfileWorkoutCalendarDraftDates([]);
            setWorkoutModePreference(getDefaultWorkoutModePreference());
            setWorkoutModeRemember(false);
          }

          // Telegram is a secondary profile enhancement. It must not keep the
          // application splash screen open after the workout and profile core
          // are ready.
          if (disposed || runId !== bootstrapRunId) return;
          void hydrateRemoteTelegramProfile({
            user: u,
            db,
            TELEGRAM_PROFILE_STORAGE_KEY,
            refreshTelegramAvatar,
            safeWriteUserJsonStorage,
            setTelegramDraft,
            setTelegramProfile,
            readProfile: async () => {
              const result = await profileRequest;
              if (result.error) throw result.error;
              return result.snapshot;
            },
            isCurrentRun: () => !disposed && runId === bootstrapRunId
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
            setProfileMeasurements,
            setProfileMeasurementSnapshot
          });
        }
      } catch (error) {
        console.error("Auth bootstrap error", error);
        setFirstSetupProfileHydrated(true);
        setAppThemeCloudReady(true);
      } finally {
        endPerformanceCheck("Auth + initial app data", { signedIn: Boolean(u) });
        finishBootstrapLoading({ runId });
      }
    });

    return () => {
      disposed = true;
      clearBootstrapTimers();
      unsubscribe();
    };
    // Auth owns this subscription lifecycle. Re-subscribing when the context factory
    // is recreated would replay the complete bootstrap after every app render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
