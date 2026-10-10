import { useEffect, useState } from "react";
import { Eye, EyeOff, Send } from "lucide-react";
import styles from "./AuthScreens.module.css";

export function AppSplash() {
  const [showRecovery, setShowRecovery] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const updateConnection = () => setIsOffline(!navigator.onLine);
    const timerId = window.setTimeout(() => setShowRecovery(true), 6000);

    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  return (
    <main className={styles.appSplash} role="status" aria-label="Загрузка приложения" aria-busy="true">
      <div className={styles.splashInner}>
        <img className={styles.splashMark} src="/brand/ownset.svg?v=gradient-1" width="68" height="68" alt="" />
        <div className={styles.splashLogo}>Zmena</div>
        <div className={styles.splashText}>Загрузка приложения</div>
        <div className={styles.splashCaption}>Готовим ваши тренировки и прогресс</div>
        <div className={styles.splashProgress}>
          <span />
        </div>
        <div className={styles.splashDots} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        {showRecovery && (
          <div className={styles.splashRecovery} role="status" aria-live="polite">
            <p>{isOffline
              ? "Нет соединения. Проверь интернет и повтори попытку."
              : "Загрузка занимает больше обычного. Можно попробовать ещё раз."}</p>
            <button type="button" className={styles.splashRetry} onClick={() => window.location.reload()}>
              Повторить
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export function LoginPage({
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
  handleTelegramMiniAppAuth
}) {
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(
    () => typeof window !== "undefined" && Boolean(window.Telegram?.WebApp?.initData)
  );

  useEffect(() => {
    const syncTelegramSdk = () => {
      const webApp = window.Telegram?.WebApp;
      setIsTelegramMiniApp(Boolean(webApp?.initData));
    };
    const script = document.getElementById("telegram-web-app-sdk");
    script?.addEventListener("load", syncTelegramSdk);
    syncTelegramSdk();
    return () => script?.removeEventListener("load", syncTelegramSdk);
  }, []);

  return (
    <div className={`${styles.loginPage} loginPage`}>
      <div className={`${styles.loginHero} loginHero`}>
        <img className={`${styles.appLogo} appLogo`} src="/brand/ownset.svg?v=gradient-1" width="64" height="64" alt="" />
        <span className={styles.loginEyebrow}>Персональные тренировки</span>
        <h1>Zmena</h1>
        <p>Войди через Telegram или используй данные приглашения тренера</p>
      </div>

      <section className={`${styles.loginCard} loginCard`} aria-labelledby="telegram-login-title">
        <div className={styles.telegramLoginIntro}>
          <span className={styles.telegramLoginEyebrow}>БЫСТРО И БЕЗ ПАРОЛЯ</span>
          <h2 id="telegram-login-title">Вход через Telegram</h2>
          <p className={`${styles.loginInviteNote} loginInviteNote`}>
            {isTelegramMiniApp
              ? "Подтверди вход своим Telegram-аккаунтом."
              : "Открой приложение через кнопку меню своего бота в Telegram."}
          </p>
        </div>

        {loginError && <div className={`${styles.loginError} loginError`} role="alert">{loginError}</div>}
        <button
          className={styles.loginTelegramBtn}
          type="button"
          disabled={loginSubmitting || passwordResetSending}
          onClick={handleTelegramMiniAppAuth}
        >
          <Send size={19} aria-hidden="true" />
          {loginSubmitting ? "Проверяю Telegram…" : "Продолжить через Telegram"}
        </button>

        <details className={styles.loginAlternate}>
          <summary>Есть приглашение от тренера? Войти</summary>
          <form className={styles.loginAlternateForm} onSubmit={handleLogin}>
            <h3>Вход по приглашению</h3>
            <p className={`${styles.loginInviteNote} loginInviteNote`}>
              Открой ссылку активации и задай пароль. Потом введи ниже логин из сообщения тренера и этот пароль. Вход через Telegram доступен после привязки аккаунта.
            </p>

        <label className={`${styles.loginField} loginField`}>
          <span>Логин или email</span>
          <input
            value={login}
            onChange={(e) => {
              setLogin(e.target.value);
              setLoginFieldErrors((current) => ({ ...current, email: "" }));
              setLoginError("");
              setLoginNotice("");
            }}
            placeholder="ilya или name@example.com"
            inputMode="email"
            autoComplete="username"
            aria-label="Логин или email"
            aria-invalid={Boolean(loginFieldErrors.email)}
            aria-describedby={loginFieldErrors.email ? "login-email-error" : undefined}
          />
          {loginFieldErrors.email && (
            <small className={`${styles.loginFieldError} loginFieldError`} id="login-email-error">{loginFieldErrors.email}</small>
          )}
        </label>

        <label className={`${styles.loginField} loginField`}>
          <span>Пароль</span>
          <div className={`${styles.passwordBox} passwordBox`}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setLoginFieldErrors((current) => ({ ...current, password: "" }));
                setLoginError("");
              }}
              placeholder="Пароль"
              autoComplete="current-password"
              aria-invalid={Boolean(loginFieldErrors.password)}
              aria-describedby={loginFieldErrors.password ? "login-password-error" : undefined}
            />

            <button
              type="button"
              className={`${styles.eyeBtn} eyeBtn`}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPassword ? <EyeOff size={20} strokeWidth={2} /> : <Eye size={20} strokeWidth={2} />}
            </button>
          </div>
          {loginFieldErrors.password && (
            <small className={`${styles.loginFieldError} loginFieldError`} id="login-password-error">{loginFieldErrors.password}</small>
          )}
        </label>

        {loginNotice && <div className={`${styles.loginNotice} loginNotice`} role="status">{loginNotice}</div>}

        <button className={`${styles.loginBtn} loginBtn`} type="submit" disabled={loginSubmitting || passwordResetSending}>
          {loginSubmitting ? "Вхожу..." : "Войти"}
        </button>

        <button
          className={`${styles.loginGoogleBtn} loginGoogleBtn`}
          type="button"
          disabled={loginSubmitting || passwordResetSending}
          onClick={handleGoogleAuth}
        >
          <span aria-hidden="true">G</span>
          Войти через Google
        </button>

        <button
          className={`${styles.loginResetBtn} loginResetBtn`}
          type="button"
          disabled={loginSubmitting || passwordResetSending}
          onClick={handleLoginPasswordReset}
        >
          {passwordResetSending ? "Отправляю..." : "Забыли пароль?"}
        </button>

        <p className={`${styles.loginHint} loginHint`}>Нет доступа? Попроси тренера отправить приглашение. Восстановление пароля отправит письмо на почту аккаунта.</p>
          </form>
        </details>
      </section>
    </div>
  );
}
