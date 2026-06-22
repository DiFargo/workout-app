import { getIdTokenResult } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

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
}) {
  setFirstSetupProfileHydrated(false);
  setFirstSetupCompletedInCloud(false);
  setFirstSetupCompletedInSession(false);
  setShowFirstSetupOnboarding(false);
  setOnboardingStep(0);
  setAppThemeCloudReady(false);
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
  setRecentNutritionFoods([]);
  setUser(user);
  setIsLoggedIn(Boolean(user));
}

export async function resolveAdminClaim({ user, setIsAdminClaim }) {
  try {
    const token = await getIdTokenResult(user, true);
    const isAdmin = Boolean(token.claims?.admin);
    setIsAdminClaim(isAdmin);
    return isAdmin;
  } catch (error) {
    console.error("Admin claim check error", error);
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
}) {
  try {
    const roleDoc = await getDoc(doc(db, "users", user.uid));
    const roleData = roleDoc.exists() ? roleDoc.data() : {};
    const remoteProfile = roleData.aiNutritionProfile || roleData.profile || null;
    const remotePlan = roleData.aiNutritionPlan || null;
    const remoteProfileCompleted = hasRequiredAiNutritionProfileFields(remoteProfile);
    const remoteTheme = roleData.appTheme;
    const remoteScheduledDates = Array.isArray(roleData.workoutCalendar?.scheduledDates)
      ? roleData.workoutCalendar.scheduledDates
      : Array.isArray(roleData.workoutCalendar?.monthlyTrainingDates)
        ? roleData.workoutCalendar.monthlyTrainingDates
        : [];
    const remoteAccount = {
      displayName: roleData.accountProfile?.displayName || roleData.name || user.displayName || "",
      avatarUrl: roleData.accountProfile?.avatarUrl || roleData.avatarUrl || user.photoURL || "",
      email: user.email || roleData.email || ""
    };

    const resolvedRole = isAdmin ? "admin" : (roleData.role || "client");
    setCurrentUserRole(resolvedRole);
    if (resolvedRole === "client") {
      setPage(
        normalizeAppPage(
          normalizeClientPrimaryPage(
            safeReadUserJsonStorage(CLIENT_LAST_PAGE_STORAGE_KEY, user.uid, APP_PAGES.MAIN)
          )
        )
      );
    }
    setProfileAccount(remoteAccount);
    setProfileAccountDraft({
      displayName: remoteAccount.displayName,
      email: remoteAccount.email
    });

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
    setProfileWorkoutCalendarData(roleData.workoutCalendar || {});
    setProfileWorkoutScheduledDates(remoteScheduledDates);
    setProfileWorkoutCalendarDraftDates(remoteScheduledDates);
    safeWriteUserJsonStorage(WORKOUT_CALENDAR_STORAGE_KEY, user.uid, {
      ...(roleData.workoutCalendar || {}),
      scheduledDates: remoteScheduledDates
    });

    setFirstSetupCompletedInCloud(
      roleData.firstSetupCompleted === true ||
      roleData.firstSetupCompletedVersion === FIRST_SETUP_REQUIRED_VERSION ||
      remoteProfileCompleted
    );
    setAppThemeCloudReady(true);
  } catch (error) {
    console.error("User role check error", error);
    setCurrentUserRole(isAdmin ? "admin" : "client");
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
  await Promise.allSettled([
    loadWorkoutsFromFirebase(user.uid),
    loadHistory(),
    loadNutritionFromFirebase(user.uid),
    loadProfileMeasurements(user.uid),
    loadClientProgressPhotos(user.uid),
    loadClientTrainerTasks(user.uid)
  ]);
  await Promise.allSettled([
    replayFailedHistorySaves(user.uid),
    replayFailedNutritionSync(user.uid),
    replayFailedMeasurementSaves(user.uid)
  ]);
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
  STORAGE_KEY,
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ workouts: [] }));
  } catch {
    // ignore localStorage errors
  }
}

export function hydrateCachedUserState({
  user,
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
}) {
  if (user?.uid) {
    const cachedWorkoutPlan = safeReadUserJsonStorage(STORAGE_KEY, user.uid, null);
    if (Array.isArray(cachedWorkoutPlan?.workouts) && cachedWorkoutPlan.workouts.length > 0) {
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
    if (Array.isArray(cachedWorkoutCalendar?.scheduledDates)) {
      setProfileWorkoutCalendarData(cachedWorkoutCalendar);
      setProfileWorkoutScheduledDates(cachedWorkoutCalendar.scheduledDates);
      setProfileWorkoutCalendarDraftDates(cachedWorkoutCalendar.scheduledDates);
    }

    const savedWorkoutModePreference = safeReadUserJsonStorage(WORKOUT_MODE_STORAGE_KEY, user.uid, getDefaultWorkoutModePreference());
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
