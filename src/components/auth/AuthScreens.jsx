import { Dumbbell, Eye, EyeOff } from "lucide-react";
import styles from "./AuthScreens.module.css";

export function AppSplash() {
  return (
    <main className={styles.appSplash} role="status" aria-label="Загрузка приложения">
      <div className={styles.splashInner}>
        <div className={styles.splashMark} aria-hidden="true"><Dumbbell size={34} strokeWidth={2.1} /></div>
        <div className={styles.splashLogo}>GYM</div>
        <div className={styles.splashText}>Загрузка приложения</div>
        <div className={styles.splashProgress}>
          <span />
        </div>
        <div className={styles.splashDots} aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
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
  handleLoginPasswordReset
}) {
  return (
    <div className={`${styles.loginPage} loginPage`}>
      <div className={`${styles.loginHero} loginHero`}>
        <div className={`${styles.appLogo} appLogo`} aria-hidden="true"><Dumbbell size={30} strokeWidth={2.15} /></div>
        <h1>Workout</h1>
        <p>Доступ к приложению открывает тренер</p>
      </div>

      <form className={`${styles.loginCard} loginCard`} onSubmit={handleLogin}>
        <h2>Вход по приглашению</h2>
        <p className={`${styles.loginInviteNote} loginInviteNote`}>
          Если тренер уже добавил тебя, войди по логину, email или Google.
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

        {loginError && <div className={`${styles.loginError} loginError`} role="alert">{loginError}</div>}
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
    </div>
  );
}
