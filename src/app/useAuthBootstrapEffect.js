import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { advanceAuthSession } from "../utils/authSession";
import { recordStartupStage } from "../utils/performanceChecks.js";
import { cancelAuthProfilePreparation, waitForAuthProfilePreparation } from "../features/auth/authProfilePreparation.js";
import { classifyRoleVerificationError, ROLE_VERIFICATION_RETRY_DELAYS_MS, ROLE_VERIFICATION_TIMEOUT_MS } from "../utils/authRoleVerification.js";

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
      setRoleVerificationIssue,
      roleVerificationRetryRef,
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
    let retryTimerId = null;
    let authSessionId = 0;
    let activeUser = null;
    let attempts = 0;
    let verificationPending = false;
    let roleVerified = false;
    let lastFailure = null;

    function clearBootstrapTimers() {
      if (bootstrapFallbackTimerId) {
        window.clearTimeout(bootstrapFallbackTimerId);
        bootstrapFallbackTimerId = null;
      }
    }

    function clearRetryTimer() {
      if (retryTimerId) window.clearTimeout(retryTimerId);
      retryTimerId = null;
    }

    function retryRoleVerification({ manual = false } = {}) {
      if (disposed || !activeUser || roleVerified || verificationPending || auth.currentUser !== activeUser) return false;
      if (!manual && (lastFailure?.kind !== "connection" || attempts > ROLE_VERIFICATION_RETRY_DELAYS_MS.length)) return false;
      if (manual) attempts = 0;
      clearRetryTimer();
      void runBootstrap(activeUser, { retry: true, sessionId: authSessionId });
      return true;
    }

    function finishBootstrapLoading({ runId }) {
      if (disposed || runId !== bootstrapRunId) return;
      clearBootstrapTimers();

      setAppLoading(false);
      recordStartupStage("role-gate-released");
    }

    async function runBootstrap(u, { retry = false, sessionId } = {}) {
      const runId = bootstrapRunId + 1;
      bootstrapRunId = runId;
      clearBootstrapTimers();
      let expired = false;
      let verificationError;
      const isSameRun = () => !disposed && runId === bootstrapRunId && sessionId === authSessionId &&
        (u ? auth.currentUser === u : !auth.currentUser);
      const isCurrentRun = () => isSameRun() && !expired;
      const failVerification = error => {
        if (!isSameRun()) return;
        clearBootstrapTimers();
        verificationPending = false;
        const kind = classifyRoleVerificationError(error);
        lastFailure = { kind };
        const retryDelay = kind === "connection" ? ROLE_VERIFICATION_RETRY_DELAYS_MS[attempts - 1] : undefined;
        const willRetry = retryDelay !== undefined;
        setRoleVerificationIssue?.({ kind, retrying: false, attempt: attempts, willRetry });
        setFirstSetupProfileHydrated(true);
        setAppThemeCloudReady(true);
        setIsAdminClaim(false);
        setCurrentUserRole("unresolved");
        setAppLoading(false);
        if (willRetry) retryTimerId = window.setTimeout(() => {
          retryTimerId = null;
          if (isSameRun()) retryRoleVerification();
        }, retryDelay);
      };
      verificationPending = Boolean(u);
      if (u) attempts += 1;
      startPerformanceCheck("Auth + initial app data", { signedIn: Boolean(u) });
      setInitialWorkoutLoadState?.("idle");
      setAppLoading(!retry);
      if (retry) setRoleVerificationIssue?.({ kind: lastFailure?.kind || "connection", retrying: true, attempt: attempts, willRetry: false });

      if (u) bootstrapFallbackTimerId = window.setTimeout(() => {
        if (!isCurrentRun()) return;
        expired = true; // Late responses must not grant access after this attempt expired.
        failVerification({ code: "role_verification_timeout" });
      }, ROLE_VERIFICATION_TIMEOUT_MS);

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
        if (retry) setCurrentUserRole("unresolved");

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
          isCurrentRun
        });

        if (u) {
          await waitForAuthProfilePreparation(auth);
          if (!isCurrentRun()) return;
          startPerformanceCheck("Auth · verified identity and profile");
          const profileRequest = readBootstrapProfileResult(u, db);
          recordStartupStage("identity-verified");

          const resolvedRole = await loadRemoteUserBootstrapState({
            user: u,
            db,
            // Only administrator profiles need forced current admin claims.
            // Ordinary client/trainer bootstrap must not wait for an unrelated refresh.
            resolveAdminClaims: () => resolveAdminClaim({ user: u, setIsAdminClaim, isCurrentRun, throwOnError: true }),
            onRoleVerificationError: error => { verificationError = error; },
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
            isCurrentRun
          });
          endPerformanceCheck("Auth · verified identity and profile");
          recordStartupStage("profile-verified", { role: resolvedRole || "unresolved" });

          if (!isCurrentRun()) return;
          if (!resolvedRole || resolvedRole === "unresolved") {
            failVerification(verificationError || { code: "role_claims_invalid" });
            return;
          }

          verificationPending = false;
          roleVerified = true;
          lastFailure = null;
          clearRetryTimer();
          setRoleVerificationIssue?.(null);

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
              isCurrentRun
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
          if (!isCurrentRun()) return;
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
            isCurrentRun
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
        if (!isCurrentRun()) return;
        if (u && !roleVerified) failVerification(error);
        else {
          setFirstSetupProfileHydrated(true);
          setAppThemeCloudReady(true);
        }
      } finally {
        endPerformanceCheck("Auth + initial app data", { signedIn: Boolean(u) });
        if (isCurrentRun()) finishBootstrapLoading({ runId });
      }
    }

    const unsubscribe = onAuthStateChanged(auth, u => {
      if (!u) cancelAuthProfilePreparation(auth);
      // Retrying a role check is not an authentication transition.
      advanceAuthSession(auth, u);
      resetAuthSessionOperations(bootstrapContext);
      authSessionId += 1;
      activeUser = u;
      attempts = 0;
      roleVerified = false;
      verificationPending = false;
      lastFailure = null;
      clearRetryTimer();
      setRoleVerificationIssue?.(null);
      return runBootstrap(u, { sessionId: authSessionId });
    });

    const retry = () => retryRoleVerification({ manual: true });
    if (roleVerificationRetryRef && typeof roleVerificationRetryRef === "object") roleVerificationRetryRef.current = retry;
    const onNetworkReturn = () => { retryRoleVerification(); };
    const documentTarget = typeof document === "undefined" ? null : document;
    const onVisible = () => { if (documentTarget?.visibilityState === "visible") retryRoleVerification(); };
    window.addEventListener?.("online", onNetworkReturn);
    documentTarget?.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      clearBootstrapTimers();
      clearRetryTimer();
      window.removeEventListener?.("online", onNetworkReturn);
      documentTarget?.removeEventListener("visibilitychange", onVisible);
      if (roleVerificationRetryRef?.current === retry) roleVerificationRetryRef.current = null;
      unsubscribe();
    };
    // Auth owns this subscription lifecycle. Re-subscribing when the context factory
    // is recreated would replay the complete bootstrap after every app render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
