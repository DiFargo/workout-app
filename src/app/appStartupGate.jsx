import FirstSetupOnboarding from "../features/auth/FirstSetupOnboarding";
import { AppSplash, LoginPage } from "../components/auth/AuthScreens";
import { ChartNoAxesColumn, Copy, Dumbbell, LockKeyhole, LogOut, RefreshCw, Send, Utensils } from "lucide-react";
import styles from "./AppStartupGate.module.css";

function RoleAccessVerificationScreen({ logout }) {
  return (
    <main className={styles.roleAccessGate} role="alert" aria-live="assertive">
      <section className={styles.roleAccessGateCard}>
        <span>ПРОВЕРКА ДОСТУПА</span>
        <h1>Не удалось подтвердить роль аккаунта</h1>
        <p>Данные клиента не открыты. Повторите проверку или войдите в аккаунт заново.</p>
        <div>
          <button type="button" className={styles.primary} onClick={() => window.location.reload()}>Повторить</button>
          <button type="button" onClick={logout}>Выйти</button>
        </div>
      </section>
    </main>
  );
}

function PendingTrainerAccessScreen({ logout, user, profileAccount, handleTelegramMiniAppAuth, loginSubmitting, passwordResetSending, loginError, loginNotice }) {
  const [copyStatus, setCopyStatus] = useState("");
  const accountId = profileAccount?.login || user?.uid || "";
  const queryToken = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("telegramInvite") || "";
  const inviteToken = /^[A-Za-z0-9_-]{20,60}$/.test(queryToken) ? queryToken : "";
  const hasTelegramContext = typeof window !== "undefined" && Boolean(String(window.Telegram?.WebApp?.initData || "").trim());
  const busy = Boolean(loginSubmitting || passwordResetSending);
  const botUrl = inviteToken ? `https://t.me/zmena_teleg_bot?start=invite_${encodeURIComponent(inviteToken)}` : "https://t.me/zmena_teleg_bot";
  const copyAccountId = async () => {
    try {
      await navigator.clipboard.writeText(accountId);
      setCopyStatus("Скопировано — отправьте тренеру.");
    } catch {
      setCopyStatus("Не удалось скопировать. Выделите идентификатор и отправьте тренеру.");
    }
  };
  return (
    <main className={styles.pendingAccessGate}>
      <section className={styles.pendingAccessCard} aria-labelledby="pending-access-title" aria-busy={busy}>
        <img src="/brand/ownset.svg?v=gradient-1" width="56" height="56" alt="" />
        <span className={styles.pendingAccessEyebrow}>АККАУНТ ZMENA</span>
        <h1 id="pending-access-title">{inviteToken ? "Принять приглашение тренера" : "Ждём назначения тренера"}</h1>
        <p className={styles.pendingAccessDescription}>
          {inviteToken ? hasTelegramContext
            ? "Вы уже вошли. Подтвердите приглашение, чтобы подключиться к тренеру."
            : "Откройте приглашение в Telegram и нажмите Start в чате с ботом."
            : "Вы уже вошли. Тренер или администратор должен назначить вам доступ — после этого откроются личные разделы и данные."}
        </p>
        <div className={styles.pendingAccessHelp}>
          {inviteToken ? <>
            <h2>{hasTelegramContext ? "Приглашение можно подтвердить здесь" : "Продолжите в Telegram"}</h2>
            <p>{hasTelegramContext ? "Нажмите «Принять приглашение». Повторная регистрация не нужна." : "В ответном сообщении бота нажмите «Принять приглашение». Создавать новый аккаунт не нужно."}</p>
          </> : <>
            <h2>Как получить доступ</h2>
            <p>Сейчас идёт закрытое тестирование. Вход и регистрация доступны, но личные разделы открываются только после назначения тренера.</p>
            <p>Отправьте тренеру свой {profileAccount?.login ? "логин" : "ID аккаунта"}. Он пришлёт приглашение или попросит администратора назначить вам тренера.</p>
          </>}
          {accountId && <div className={styles.pendingAccessIdentity}>
            <span><small>{profileAccount?.login ? "Ваш логин" : "ID аккаунта"}</small><code>{accountId}</code></span>
            <button type="button" onClick={copyAccountId} aria-label="Скопировать идентификатор аккаунта"><Copy size={18} aria-hidden="true" /></button>
          </div>}
          {copyStatus && <p role="status" aria-live="polite">{copyStatus}</p>}
          {!inviteToken ? <>
            <p>Уже получили приглашение? {hasTelegramContext ? "Нажмите «Проверить приглашение» или откройте ссылку из сообщения тренера." : <>Откройте ссылку из сообщения тренера. <a href={botUrl}>Перейти к боту в Telegram</a></>}</p>
            <p>Нет тренера или приглашения? Назначение не происходит автоматически. Уточните возможность участия у человека, от которого вы узнали о Zmena, и передайте ему свой логин или ID. Повторная регистрация не откроет доступ.</p>
          </> : null}
        </div>
        {!inviteToken ? <div className={styles.pendingAccessFeatures} aria-label="Разделы пока закрыты">
          <div><Dumbbell size={19} aria-hidden="true" /><span>Тренировки</span><LockKeyhole size={15} aria-hidden="true" /></div>
          <div><Utensils size={19} aria-hidden="true" /><span>Питание</span><LockKeyhole size={15} aria-hidden="true" /></div>
          <div><ChartNoAxesColumn size={19} aria-hidden="true" /><span>Прогресс</span><LockKeyhole size={15} aria-hidden="true" /></div>
        </div> : null}
        {loginError ? <p className={styles.pendingAccessError} role="alert">{loginError}</p> : null}
        {loginNotice ? <p className={styles.pendingAccessNotice} role="status">{loginNotice}</p> : null}
        <p className={styles.pendingAccessHint} role="status">
          {inviteToken ? "Если доступ уже назначен, нажмите «Проверить доступ»." : "Когда тренер назначит вас, нажмите «Проверить доступ»."}
        </p>
        <div className={styles.pendingAccessActions}>
          {hasTelegramContext ? <button type="button" className={styles.pendingAccessPrimary} disabled={busy || typeof handleTelegramMiniAppAuth !== "function"} onClick={handleTelegramMiniAppAuth}>
            <Send size={17} aria-hidden="true" />{busy ? "Проверяем приглашение…" : inviteToken ? "Принять приглашение" : "Проверить приглашение"}
          </button> : inviteToken ? <a className={styles.pendingAccessPrimary} href={botUrl} aria-disabled={busy || undefined} onClick={event => { if (busy) event.preventDefault(); }}><Send size={17} aria-hidden="true" />Открыть приглашение в Telegram</a> : null}
          <button type="button" className={hasTelegramContext || inviteToken ? styles.pendingAccessSecondary : styles.pendingAccessPrimary} disabled={busy} onClick={() => window.location.reload()}>
            <RefreshCw size={17} aria-hidden="true" /> Проверить доступ
          </button>
          <button type="button" className={styles.pendingAccessSecondary} disabled={busy} onClick={logout}>
            <LogOut size={17} aria-hidden="true" /> Выйти
          </button>
        </div>
      </section>
    </main>
  );
}

export function AppStartupGate({
  appLoading,
  currentUserRole,
  user,
  profileAccount,
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
  handleEmailSignup,
  handleGoogleAuth,
  handleLogin,
  handleLoginPasswordReset,
  handleTelegramMiniAppAuth,
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

  if (isLoggedIn && currentUserRole === "pending-client") {
    return <PendingTrainerAccessScreen logout={logout} user={user} profileAccount={profileAccount} handleTelegramMiniAppAuth={handleTelegramMiniAppAuth} loginSubmitting={loginSubmitting} passwordResetSending={passwordResetSending} loginError={loginError} loginNotice={loginNotice} />;
  }

  if (currentUserRole === "client" && (showFirstSetupOnboarding || firstSetupRequiredNow) && isLoggedIn && !appLoading) {
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
        handleEmailSignup={handleEmailSignup}
        handleGoogleAuth={handleGoogleAuth}
        handleLogin={handleLogin}
        handleLoginPasswordReset={handleLoginPasswordReset}
        handleTelegramMiniAppAuth={handleTelegramMiniAppAuth}
      />
    );
  }

  return null;
}
import { useState } from "react";
