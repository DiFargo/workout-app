import FirstSetupOnboarding from "../features/auth/FirstSetupOnboarding";
import { AppSplash, LoginPage } from "../components/auth/AuthScreens";
import "./AppStartupGate.module.css";

function RoleAccessVerificationScreen({ logout }) {
  return (
    <main className="roleAccessGate" role="alert" aria-live="assertive">
      <section className="roleAccessGateCard">
        <span>ПРОВЕРКА ДОСТУПА</span>
        <h1>Не удалось подтвердить роль аккаунта</h1>
        <p>Данные клиента не открыты. Повторите проверку или войдите в аккаунт заново.</p>
        <div>
          <button type="button" className="primary" onClick={() => window.location.reload()}>Повторить</button>
          <button type="button" onClick={logout}>Выйти</button>
        </div>
      </section>
    </main>
  );
}

export function AppStartupGate({
  appLoading,
  roleAccessGateState,
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

  if (roleAccessGateState === "resolving") {
    return <AppSplash />;
  }

  if (roleAccessGateState === "unresolved") {
    return <RoleAccessVerificationScreen logout={logout} />;
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
