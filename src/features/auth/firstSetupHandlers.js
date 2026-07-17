export async function submitFirstSetupProfileWithDeps({
  APP_PAGES,
  user,
  aiNutritionProfileDraft,
  firstSetupDoneUserStorageKey,
  firstSetupRequiredVersion,
  hasRequiredAiNutritionProfileFields,
  saveAiNutritionPlan,
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
  const savedToCloud = await saveAiNutritionPlan(aiNutritionProfileDraft);

  if (!savedToCloud) {
    setFirstSetupSaveStatus("error");
    showAppError(
      "save",
      "Профиль сохранён на устройстве, но не отправлен в облако. Проверь соединение и повтори."
    );
    return;
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
      saveAiNutritionPlan,
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
      saveAiNutritionPlan,
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
