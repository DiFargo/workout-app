export function AppSplash() {
  return (
    <div className="appSplash">
      <div className="splashInner">
        <div className="splashMark">🏋️</div>
        <div className="splashLogo">GYM</div>
        <div className="splashText">Загрузка тренировки</div>
        <div className="splashProgress">
          <span />
        </div>
        <div className="splashDots" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
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
    <div className="loginPage">
      <div className="loginHero">
        <div className="appLogo">W</div>
        <h1>Workout</h1>
        <p>Доступ к приложению открывает тренер</p>
      </div>

      <form className="loginCard" onSubmit={handleLogin}>
        <h2>Вход по приглашению</h2>
        <p className="loginInviteNote">
          Если тренер уже добавил тебя, войди по логину, email или Google.
        </p>

        <label className="loginField">
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
            <small className="loginFieldError" id="login-email-error">{loginFieldErrors.email}</small>
          )}
        </label>

        <label className="loginField">
          <span>Пароль</span>
          <div className="passwordBox">
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
              className="eyeBtn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPassword ? "👁️" : "🙈"}
            </button>
          </div>
          {loginFieldErrors.password && (
            <small className="loginFieldError" id="login-password-error">{loginFieldErrors.password}</small>
          )}
        </label>

        {loginError && <div className="loginError" role="alert">{loginError}</div>}
        {loginNotice && <div className="loginNotice" role="status">{loginNotice}</div>}

        <button className="loginBtn" type="submit" disabled={loginSubmitting || passwordResetSending}>
          {loginSubmitting ? "Вхожу..." : "Войти"}
        </button>

        <button
          className="loginGoogleBtn"
          type="button"
          disabled={loginSubmitting || passwordResetSending}
          onClick={handleGoogleAuth}
        >
          <span aria-hidden="true">G</span>
          Войти через Google
        </button>

        <button
          className="loginResetBtn"
          type="button"
          disabled={loginSubmitting || passwordResetSending}
          onClick={handleLoginPasswordReset}
        >
          {passwordResetSending ? "Отправляю..." : "Забыли пароль?"}
        </button>

        <p className="loginHint">Нет доступа? Попроси тренера отправить приглашение. Восстановление пароля отправит письмо на почту аккаунта.</p>
      </form>
    </div>
  );
}
