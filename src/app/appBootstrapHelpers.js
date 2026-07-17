import { getIdTokenResult } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { normalizeBasicWorkoutPlanState } from "../utils/basicWorkoutPlanBuilder.js";
import { resolveUserRole } from "../utils/roleAccess.js";
import { migrateLegacyUserStorage } from "../utils/userScopedStorage.js";

export function getBootstrapWorkoutCalendarDates(calendar = {}) {
  return [...new Set([
    ...(Array.isArray(calendar?.scheduledDates) ? calendar.scheduledDates : []),
    ...(Array.isArray(calendar?.monthlyTrainingDates) ? calendar.monthlyTrainingDates : [])
  ]
    .filter((dateKey) => typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey))
  )].sort();
}

function timestampMs(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveBootstrapWorkoutCalendar(remoteCalendar = {}, cachedCalendar = null) {
  const safeRemoteCalendar = remoteCalendar && typeof remoteCalendar === "object" ? remoteCalendar : {};
  const safeCachedCalendar = cachedCalendar && typeof cachedCalendar === "object" ? cachedCalendar : null;
  const remoteDates = getBootstrapWorkoutCalendarDates(safeRemoteCalendar);
  const cachedDates = getBootstrapWorkoutCalendarDates(safeCachedCalendar);

  if (remoteDates.length) {
    return {
      ...safeRemoteCalendar,
      scheduledDates: remoteDates,
      monthlyTrainingDates: remoteDates
    };
  }

  const remoteHasExplicitDateList = Array.isArray(safeRemoteCalendar.scheduledDates) ||
    Array.isArray(safeRemoteCalendar.monthlyTrainingDates);
  const remoteClearedAfterCache = remoteHasExplicitDateList &&
    timestampMs(safeRemoteCalendar.updatedAt) > 0 &&
    timestampMs(safeRemoteCalendar.updatedAt) >= timestampMs(safeCachedCalendar?.updatedAt);

  if (cachedDates.length && !remoteClearedAfterCache) {
    return {
      ...(safeCachedCalendar || {}),
      ...safeRemoteCalendar,
      plannedWorkouts: Array.isArray(safeRemoteCalendar.plannedWorkouts)
        ? safeRemoteCalendar.plannedWorkouts
        : safeCachedCalendar?.plannedWorkouts,
      scheduledDates: cachedDates,
      monthlyTrainingDates: cachedDates
    };
  }

  return {
    ...safeRemoteCalendar,
    scheduledDates: [],
    monthlyTrainingDates: []
  };
}

export function resetAuthBootstrapState({
  user,
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
  setRecentNutritionFoods,
  setUser,
  setIsLoggedIn
}) {
  setFirstSetupProfileHydrated(false);
  setFirstSetupCompletedInCloud(false);
  setFirstSetupCompletedInSession(false);
  setShowFirstSetupOnboarding(false);
  setOnboardingStep(0);
  setAppThemeCloudReady(false);
  setClientProgressPhotos([]);
  setClientTrainerTasks([]);
  setAiNutritionProfile(null);
  setAiNutritionProfileDraft(createEmptyAiNutritionProfileDraft());
  setAiNutritionSavedPlan(null);
  setTelegramProfile(createEmptyTelegramProfile());
  setTelegramDraft(createEmptyTelegramProfile());
  setTelegramStatus("");
  setTelegramConnectOpen(false);
  setProfileAccount({
    displayName: user?.displayName || "",
    avatarUrl: user?.photoURL || "",
    email: user?.email || ""
  });
  setProfileAccountDraft({
    displayName: user?.displayName || "",
    email: user?.email || ""
  });
  setProfileAccountAvatarFile(null);
  setProfileAccountAvatarPreview("");
  setProfileAccountStatus("");
  setNutritionCloudReady(false);
  setNutrition(defaultNutritionState);
  setHistory([]);
  setPlan({ workouts: [] });
  setProfileMeasurements([]);
  setRecentNutritionFoods([]);
  setUser(user);
  setIsLoggedIn(Boolean(user));
}

export async function resolveAdminClaim({ user, setIsAdminClaim, isCurrentRun }) {
  try {
    const token = await getIdTokenResult(user, true);
    if (isCurrentRun && !isCurrentRun()) return false;
    const isAdmin = Boolean(token.claims?.admin);
    setIsAdminClaim(isAdmin);
    return isAdmin;
  } catch (error) {
    console.error("Admin claim check error", error);
    if (isCurrentRun && !isCurrentRun()) return false;
    setIsAdminClaim(false);
    return false;
  }
}

export async function loadRemoteUserBootstrapState({
  user,
  db,
  isAdmin,
  APP_PAGES,
  APP_THEMES,
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
}) {
  try {
    const roleDoc = await getDoc(doc(db, "users", user.uid));
    if (isCurrentRun && !isCurrentRun()) return null;
    const roleData = roleDoc.exists() ? roleDoc.data() : {};
    const remoteProfile = roleData.aiNutritionProfile || roleData.profile || null;
    const remotePlan = roleData.aiNutritionPlan || null;
    const remoteProfileCompleted = hasRequiredAiNutritionProfileFields(remoteProfile);
    const remoteTheme = roleData.appTheme;
    const cachedWorkoutCalendar = safeReadUserJsonStorage(WORKOUT_CALENDAR_STORAGE_KEY, user.uid, null);
    const resolvedWorkoutCalendar = resolveBootstrapWorkoutCalendar(
      roleData.workoutCalendar || {},
      cachedWorkoutCalendar
    );
    const remoteScheduledDates = resolvedWorkoutCalendar.scheduledDates;
    const remoteAccount = {
      displayName: roleData.accountProfile?.displayName || roleData.name || user.displayName || "",
      avatarUrl: roleData.accountProfile?.avatarUrl || roleData.avatarUrl || user.photoURL || "",
      email: user.email || roleData.email || "",
      login: roleData.accountProfile?.login || roleData.loginLower || ""
    };
    const remoteWorkoutModePreference = roleData.workoutModePreference || null;
    const userScopedWorkoutModePreference = safeReadUserJsonStorage(
      WORKOUT_MODE_STORAGE_KEY,
      user.uid,
      null
    );
    const cachedWorkoutModePreference = userScopedWorkoutModePreference || getDefaultWorkoutModePreference();
    const remoteWorkoutMode = remoteWorkoutModePreference?.mode;
    const cachedWorkoutMode = cachedWorkoutModePreference?.mode;
    const remoteWorkoutModeValid = remoteWorkoutMode === "individual" || remoteWorkoutMode === "basic";
    const cachedWorkoutModeValid = cachedWorkoutMode === "individual" || cachedWorkoutMode === "basic";
    const remoteWorkoutModeUpdatedAt = Date.parse(remoteWorkoutModePreference?.updatedAt || "");
    const cachedWorkoutModeUpdatedAt = Date.parse(cachedWorkoutModePreference?.updatedAt || "");
    const shouldPreferCachedWorkoutMode =
      cachedWorkoutModeValid &&
      (
        !remoteWorkoutModeValid ||
        (Number.isFinite(cachedWorkoutModeUpdatedAt) &&
          (!Number.isFinite(remoteWorkoutModeUpdatedAt) || cachedWorkoutModeUpdatedAt > remoteWorkoutModeUpdatedAt))
      );
    const resolvedWorkoutModePreference =
      shouldPreferCachedWorkoutMode
        ? {
            mode: cachedWorkoutMode,
            remember: Boolean(cachedWorkoutModePreference.remember),
            updatedAt: cachedWorkoutModePreference.updatedAt || ""
          }
        : remoteWorkoutModeValid
        ? {
            mode: remoteWorkoutMode,
            remember: Boolean(remoteWorkoutModePreference.remember),
            updatedAt: remoteWorkoutModePreference.updatedAt || ""
          }
        : (cachedWorkoutModePreference || getDefaultWorkoutModePreference());

    const resolvedRole = resolveUserRole({
      isAdminClaim: isAdmin,
      role: roleData.role,
      email: user.email || roleData.email || ""
    });
    setCurrentUserRole(resolvedRole);
    if (resolvedRole === "client") {
      setPage(
        normalizeAppPage(
          normalizeClientPrimaryPage(
            safeReadUserJsonStorage(CLIENT_LAST_PAGE_STORAGE_KEY, user.uid, APP_PAGES.MAIN)
          )
        )
      );
    } else {
      setPage(APP_PAGES.ADMIN);
    }
    setProfileAccount(remoteAccount);
    setProfileAccountDraft({
      displayName: remoteAccount.displayName,
      email: remoteAccount.email,
      login: remoteAccount.login
    });
    setWorkoutModePreference(resolvedWorkoutModePreference);
    setWorkoutModeRemember(Boolean(resolvedWorkoutModePreference?.remember));
    safeWriteUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, user.uid, resolvedWorkoutModePreference);

    if (remoteTheme === APP_THEMES.WARM_LIGHT || remoteTheme === APP_THEMES.DARK_GREEN) {
      setAppTheme(remoteTheme);
    }

    if (remoteProfileCompleted) {
      setAiNutritionProfile(remoteProfile);
      setAiNutritionProfileDraft((prev) => ({ ...prev, ...remoteProfile }));

      try {
        safeWriteUserJsonStorage(AI_NUTRITION_PROFILE_STORAGE_KEY, user.uid, remoteProfile);
      } catch {
        // ignore localStorage errors
      }
    }
    if (remotePlan) {
      setAiNutritionSavedPlan(remotePlan);
      safeWriteUserJsonStorage(AI_NUTRITION_PLAN_STORAGE_KEY, user.uid, remotePlan);
    }
    setProfileWorkoutCalendarData(resolvedWorkoutCalendar);
    setProfileWorkoutScheduledDates(remoteScheduledDates);
    setProfileWorkoutCalendarDraftDates(remoteScheduledDates);
    safeWriteUserJsonStorage(WORKOUT_CALENDAR_STORAGE_KEY, user.uid, resolvedWorkoutCalendar);

    setFirstSetupCompletedInCloud(
      roleData.firstSetupCompleted === true ||
      roleData.firstSetupCompletedVersion === FIRST_SETUP_REQUIRED_VERSION ||
      remoteProfileCompleted
    );
    setAppThemeCloudReady(true);
    return resolvedRole;
  } catch (error) {
    console.error("User role check error", error);
    const fallbackRole = resolveUserRole({
      isAdminClaim: isAdmin,
      role: "",
      email: user.email || ""
    });
    setCurrentUserRole(fallbackRole);
    if (fallbackRole !== "client") {
      setPage(APP_PAGES.ADMIN);
    }
    return fallbackRole;
  } finally {
    setFirstSetupProfileHydrated(true);
  }
}

export async function loadInitialSignedInUserData({
  user,
  loadWorkoutsFromFirebase,
  loadHistory,
  loadNutritionFromFirebase,
  loadProfileMeasurements,
  loadClientProgressPhotos,
  loadClientTrainerTasks,
  replayFailedHistorySaves,
  replayFailedNutritionSync,
  replayFailedMeasurementSaves
}) {
  const criticalWorkoutsLoad = Promise.resolve(
    loadWorkoutsFromFirebase(user.uid, { preserveBasicPlanOnEmpty: true })
  ).catch((error) => {
    console.warn("Initial workout plan load failed", error);
  });

  const backgroundLoad = Promise.allSettled([
    loadHistory(),
    loadNutritionFromFirebase(user.uid),
    loadProfileMeasurements(user.uid),
    loadClientProgressPhotos(user.uid),
    loadClientTrainerTasks(user.uid)
  ]).then(() => Promise.allSettled([
    replayFailedHistorySaves(user.uid),
    replayFailedNutritionSync(user.uid),
    replayFailedMeasurementSaves(user.uid)
  ]));

  // The app can open as soon as the profile and workout program are ready.
  // Slow secondary cards keep loading in the background instead of blocking splash.
  await Promise.race([
    criticalWorkoutsLoad,
    new Promise((resolve) => window.setTimeout(resolve, 5000))
  ]);

  void backgroundLoad;
}

export async function hydrateRemoteTelegramProfile({
  user,
  db,
  TELEGRAM_PROFILE_STORAGE_KEY,
  refreshTelegramAvatar,
  safeWriteUserJsonStorage,
  setTelegramDraft,
  setTelegramProfile
}) {
  try {
    const profileDoc = await getDoc(doc(db, "users", user.uid));
    const profileData = profileDoc.exists() ? profileDoc.data() : {};
    const savedTelegram = profileData?.telegram || null;
    if (savedTelegram) {
      const nextTelegram = {
        ...savedTelegram,
        connected: savedTelegram.connected !== false,
        username: savedTelegram.username || profileData.telegramUsername || "",
        displayName: savedTelegram.displayName || profileData.telegramDisplayName || savedTelegram.username || "",
        avatarUrl: savedTelegram.avatarUrl || profileData.telegramAvatarUrl || ""
      };
      setTelegramProfile(nextTelegram);
      setTelegramDraft(nextTelegram);
      safeWriteUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, user.uid, nextTelegram);
      if (
        nextTelegram.connected &&
        nextTelegram.telegramUserId &&
        (
          !nextTelegram.avatarUrl ||
          String(nextTelegram.avatarUrl).includes("api.telegram.org/file/bot")
        )
      ) {
        refreshTelegramAvatar();
      }
    }
  } catch {
    // ignore Telegram profile loading errors
  }
}

export function applySignedOutBootstrapState({
  setClientProgressPhotos,
  setCurrentUserRole,
  setFirstSetupProfileHydrated,
  setAppThemeCloudReady,
  setNutritionCloudReady,
  setPlan,
  setProfileMeasurements
}) {
  setCurrentUserRole("client");
  setFirstSetupProfileHydrated(true);
  setAppThemeCloudReady(true);
  setNutritionCloudReady(false);
  setProfileMeasurements([]);
  setClientProgressPhotos([]);
  setPlan({ workouts: [] });
}

export function hydrateCachedUserState({
  user,
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
  setProfileWorkoutCalendarStatus
}) {
  if (user?.uid) {
    migrateLegacyUserStorage([
      AI_NUTRITION_PLAN_STORAGE_KEY,
      AI_NUTRITION_PROFILE_STORAGE_KEY,
      BASIC_WORKOUT_PLAN_STORAGE_KEY,
      NUTRITION_STORAGE_KEY,
      STORAGE_KEY,
      TELEGRAM_PROFILE_STORAGE_KEY,
      WORKOUT_CALENDAR_STORAGE_KEY,
      WORKOUT_MODE_STORAGE_KEY
    ], user.uid);
    const userScopedWorkoutModePreference = safeReadUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, user.uid, null);
    const savedWorkoutModePreference = userScopedWorkoutModePreference || getDefaultWorkoutModePreference();
    const cachedBasicWorkoutPlan = safeReadUserJsonStorage(BASIC_WORKOUT_PLAN_STORAGE_KEY, user.uid, null);
    const cachedWorkoutPlan = safeReadUserJsonStorage(STORAGE_KEY, user.uid, null);
    const normalizedCachedBasicWorkoutPlan = Array.isArray(cachedBasicWorkoutPlan?.workouts) &&
      cachedBasicWorkoutPlan.workouts.length > 0
      ? normalizeBasicWorkoutPlanState(cachedBasicWorkoutPlan)
      : null;
    const normalizedLegacyBasicWorkoutPlan = cachedWorkoutPlan?.source === "basic" &&
      Array.isArray(cachedWorkoutPlan?.workouts) &&
      cachedWorkoutPlan.workouts.length > 0
      ? normalizeBasicWorkoutPlanState(cachedWorkoutPlan)
      : null;
    const normalizedBasicWorkoutPlan = (
      savedWorkoutModePreference?.mode === "basic" ||
      normalizedLegacyBasicWorkoutPlan?.source === "basic" ||
      normalizedCachedBasicWorkoutPlan?.source === "basic"
    )
      ? (normalizedCachedBasicWorkoutPlan || normalizedLegacyBasicWorkoutPlan)
      : null;

    if (normalizedBasicWorkoutPlan?.workouts?.length > 0) {
      setPlan(normalizedBasicWorkoutPlan);
    } else if (Array.isArray(cachedWorkoutPlan?.workouts) && cachedWorkoutPlan.workouts.length > 0) {
      setPlan(cachedWorkoutPlan);
    }
    const cachedNutrition = safeReadUserJsonStorage(NUTRITION_STORAGE_KEY, user.uid, null);
    if (cachedNutrition?.__uid === user.uid) {
      setNutrition({
        ...defaultNutritionState,
        ...cachedNutrition,
        goals: { ...defaultNutritionState.goals, ...(cachedNutrition.goals || {}) },
        days: cachedNutrition.days || {},
        favorites: cachedNutrition.favorites || defaultNutritionState.favorites,
        recent: cachedNutrition.recent || [],
        myFoods: cachedNutrition.myFoods || {}
      });
    }
    setRecentNutritionFoods(loadRecentNutritionFoods(user.uid));
    const cachedProfile = safeReadUserJsonStorage(AI_NUTRITION_PROFILE_STORAGE_KEY, user.uid, null);
    const cachedPlan = safeReadUserJsonStorage(AI_NUTRITION_PLAN_STORAGE_KEY, user.uid, null);
    const cachedTelegram = safeReadUserJsonStorage(TELEGRAM_PROFILE_STORAGE_KEY, user.uid, null);
    const cachedWorkoutCalendar = safeReadUserJsonStorage(WORKOUT_CALENDAR_STORAGE_KEY, user.uid, null);

    if (hasRequiredAiNutritionProfileFields(cachedProfile)) {
      setAiNutritionProfile(cachedProfile);
      setAiNutritionProfileDraft((current) => ({ ...current, ...cachedProfile }));
    }
    if (cachedPlan) setAiNutritionSavedPlan(cachedPlan);
    if (cachedTelegram) {
      setTelegramProfile({ ...createEmptyTelegramProfile(), ...cachedTelegram });
      setTelegramDraft({ ...createEmptyTelegramProfile(), ...cachedTelegram });
    }
    const cachedWorkoutDates = getBootstrapWorkoutCalendarDates(cachedWorkoutCalendar);
    if (cachedWorkoutDates.length) {
      setProfileWorkoutCalendarData({
        ...cachedWorkoutCalendar,
        scheduledDates: cachedWorkoutDates,
        monthlyTrainingDates: cachedWorkoutDates
      });
      setProfileWorkoutScheduledDates(cachedWorkoutDates);
      setProfileWorkoutCalendarDraftDates(cachedWorkoutDates);
    }

    setWorkoutModePreference(savedWorkoutModePreference || getDefaultWorkoutModePreference());
    setWorkoutModeRemember(Boolean(savedWorkoutModePreference?.remember));
    return;
  }

  setWorkoutModePreference(getDefaultWorkoutModePreference());
  setWorkoutModeRemember(false);
  setProfileWorkoutCalendarData({});
  setProfileWorkoutScheduledDates([]);
  setProfileWorkoutCalendarDraftDates([]);
  setProfileWorkoutCalendarEditing(false);
  setProfileWorkoutCalendarStatus("");
  setRecentNutritionFoods([]);
}
