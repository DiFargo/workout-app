import FirstSetupOnboarding from "../features/auth/FirstSetupOnboarding";
import { AppSplash, LoginPage } from "../components/auth/AuthScreens";

export function getFirstSetupCompletedLocally({
  isLoggedIn,
  userId,
  storageKey,
  requiredVersion
}) {
  if (!isLoggedIn || !userId) return false;

  try {
    return (
      localStorage.getItem(storageKey) === `${userId}:${requiredVersion}` ||
      localStorage.getItem(`${storageKey}:${userId}`) === requiredVersion
    );
  } catch {
    return false;
  }
}

export function getFirstSetupGateState({
  isLoggedIn,
  userId,
  firstSetupProfileHydrated,
  currentUserRole,
  firstSetupCompletedInSession,
  firstSetupCompletedInCloud,
  hasRequiredAiNutritionProfileFields,
  storageKey,
  requiredVersion
}) {
  const firstSetupCompletedLocally = getFirstSetupCompletedLocally({
    isLoggedIn,
    userId,
    storageKey,
    requiredVersion
  });

  return {
    firstSetupStillResolving: Boolean(
      isLoggedIn &&
      !firstSetupProfileHydrated
    ),
    firstSetupRequiredNow: Boolean(
      isLoggedIn &&
      firstSetupProfileHydrated &&
      currentUserRole === "client" &&
      !firstSetupCompletedInSession &&
      !firstSetupCompletedInCloud &&
      !hasRequiredAiNutritionProfileFields &&
      !firstSetupCompletedLocally
    )
  };
}

export function renderAppStartupGate({
  appLoading,
  firstSetupStillResolving,
  showFirstSetupOnboarding,
  firstSetupRequiredNow,
  isLoggedIn,
  onboardingStep,
  aiNutritionProfileDraft,
  firstSetupSaveStatus,
  setOnboardingStep,
  setAiNutritionProfileDraft,
  handleFirstSetupSubmit,
  login,
  setLogin,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  loginError,
  setLoginError,
  loginNotice,
  setLoginNotice,
  loginFieldErrors,
  setLoginFieldErrors,
  loginSubmitting,
  passwordResetSending,
  handleGoogleAuth,
  handleLogin,
  handleLoginPasswordReset,
  logout
}) {
  if (appLoading || firstSetupStillResolving) {
    return <AppSplash />;
  }

  if ((showFirstSetupOnboarding || firstSetupRequiredNow) && isLoggedIn && !appLoading) {
    return (
      <FirstSetupOnboarding
        open={Boolean(showFirstSetupOnboarding || firstSetupRequiredNow)}
        onboardingStep={onboardingStep}
        profileDraft={aiNutritionProfileDraft}
        saveStatus={firstSetupSaveStatus}
        setOnboardingStep={setOnboardingStep}
        setProfileDraft={setAiNutritionProfileDraft}
        onSubmit={handleFirstSetupSubmit}
        onExit={logout}
      />
    );
  }

  if (!isLoggedIn) {
    return (
      <LoginPage
        login={login}
        setLogin={setLogin}
        password={password}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        loginError={loginError}
        setLoginError={setLoginError}
        loginNotice={loginNotice}
        setLoginNotice={setLoginNotice}
        loginFieldErrors={loginFieldErrors}
        setLoginFieldErrors={setLoginFieldErrors}
        loginSubmitting={loginSubmitting}
        passwordResetSending={passwordResetSending}
        handleGoogleAuth={handleGoogleAuth}
        handleLogin={handleLogin}
        handleLoginPasswordReset={handleLoginPasswordReset}
      />
    );
  }

  return null;
}
