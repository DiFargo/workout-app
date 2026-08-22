export function hasSavedWeightMeasurement(measurements) {
  return Array.isArray(measurements) && measurements.some((measurement) => {
    const rawWeight = measurement?.weight;
    const weight = typeof rawWeight === "string"
      ? Number(rawWeight.replace(",", ".").trim())
      : Number(rawWeight);

    return Number.isFinite(weight) && weight > 0;
  });
}

export async function submitFirstSetupProfileWithDeps({
  APP_PAGES,
  user,
  aiNutritionProfileDraft,
  firstSetupDoneUserStorageKey,
  firstSetupRequiredVersion,
  hasRequiredAiNutritionProfileFields,
  profileMeasurements,
  saveAiNutritionPlan,
  saveProfileMeasurement,
  showAppError,
  setFirstSetupCompletedInSession,
  setFirstSetupSaveStatus,
  setOnboardingStep,
  setPage,
  setProfileAccount,
  setProfileAccountDraft,
  setShowFirstSetupOnboarding
}) {
  if (!hasRequiredAiNutritionProfileFields(aiNutritionProfileDraft)) return;

  setFirstSetupSaveStatus("saving");
  const requiresInitialWeightSave = (
    !hasSavedWeightMeasurement(profileMeasurements) &&
    typeof saveProfileMeasurement === "function"
  );
  const savedToCloud = await saveAiNutritionPlan(aiNutritionProfileDraft, {
    completeFirstSetup: !requiresInitialWeightSave
  });

  if (!savedToCloud) {
    setFirstSetupSaveStatus("error");
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    showAppError(
      offline ? "offline" : "save",
      offline
        ? "Нет подключения к интернету. Подключитесь и повторите сохранение профиля."
        : "Не удалось сохранить профиль в облаке. Данные анкеты не потеряны — повтори сохранение."
    );
    return;
  }

  // The weight entered during first setup is the user's first check-in. Saving
  // it as a measurement prevents the dashboard from asking for the same
  // weigh-in immediately after onboarding. Existing histories stay intact.
  if (requiresInitialWeightSave) {
    const savedWeightToCloud = await saveProfileMeasurement(
      { weight: aiNutritionProfileDraft.weight },
      {
        measurementType: "weight_checkin",
        requireCloudSave: true,
        completeFirstSetupVersion: firstSetupRequiredVersion
      }
    );

    if (!savedWeightToCloud) {
      setFirstSetupSaveStatus("error");
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      showAppError(
        offline ? "offline" : "save",
        offline
          ? "Нет подключения к интернету. Первый замер не сохранён в облаке — подключитесь и повторите."
          : "Не удалось сохранить первый замер в облаке. Данные анкеты не потеряны — повтори сохранение."
      );
      return;
    }
  }

  try {
    if (user?.uid && hasRequiredAiNutritionProfileFields(aiNutritionProfileDraft)) {
      localStorage.setItem(firstSetupDoneUserStorageKey, `${user.uid}:${firstSetupRequiredVersion}`);
      localStorage.setItem(`${firstSetupDoneUserStorageKey}:${user.uid}`, firstSetupRequiredVersion);
    }
  } catch {
    // Local completion marker is best effort only.
  }

  const displayName = String(aiNutritionProfileDraft.name || "").trim();
  if (displayName) {
    setProfileAccount?.((currentAccount) => ({
      ...currentAccount,
      displayName
    }));
    setProfileAccountDraft?.((currentDraft) => ({
      ...currentDraft,
      displayName
    }));
  }

  setFirstSetupCompletedInSession(true);
  setShowFirstSetupOnboarding(false);
  setOnboardingStep(0);
  setFirstSetupSaveStatus("");
  setPage(APP_PAGES.MAIN);
}

export function createFirstSetupHandlers(getContext) {
  async function handleFirstSetupSubmit() {
    const {
      APP_PAGES,
      FIRST_SETUP_DONE_USER_STORAGE_KEY,
      FIRST_SETUP_REQUIRED_VERSION,
      aiNutritionProfileDraft,
      hasRequiredAiNutritionProfileFields,
      profileMeasurements,
      saveAiNutritionPlan,
      saveProfileMeasurement,
      setFirstSetupCompletedInSession,
      setFirstSetupSaveStatus,
      setOnboardingStep,
      setPage,
      setProfileAccount,
      setProfileAccountDraft,
      setShowFirstSetupOnboarding,
      showAppError,
      user
    } = getContext();

    return submitFirstSetupProfileWithDeps({
      APP_PAGES,
      user,
      aiNutritionProfileDraft,
      firstSetupDoneUserStorageKey: FIRST_SETUP_DONE_USER_STORAGE_KEY,
      firstSetupRequiredVersion: FIRST_SETUP_REQUIRED_VERSION,
      hasRequiredAiNutritionProfileFields,
      profileMeasurements,
      saveAiNutritionPlan,
      saveProfileMeasurement,
      showAppError,
      setFirstSetupCompletedInSession,
      setFirstSetupSaveStatus,
      setOnboardingStep,
      setPage,
      setProfileAccount,
      setProfileAccountDraft,
      setShowFirstSetupOnboarding
    });
  }

  return {
    handleFirstSetupSubmit
  };
}
