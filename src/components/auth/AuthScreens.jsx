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
  handleLogin,
  handleLoginPasswordReset
}) {
  return (
    <div className="loginPage">
      <div className="loginHero">
        <div className="appLogo">W</div>
        <h1>Workout</h1>
        <p>Твой дневник тренировок</p>
      </div>

      <form className="loginCard" onSubmit={handleLogin}>
        <h2>Вход</h2>

        <label className="loginField">
          <span>Email</span>
          <input
            value={login}
            onChange={(e) => {
              setLogin(e.target.value);
              setLoginFieldErrors((current) => ({ ...current, email: "" }));
              setLoginError("");
              setLoginNotice("");
            }}
            placeholder="name@example.com"
            inputMode="email"
            autoComplete="email"
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
          className="loginResetBtn"
          type="button"
          disabled={loginSubmitting || passwordResetSending}
          onClick={handleLoginPasswordReset}
        >
          {passwordResetSending ? "Отправляю..." : "Забыли пароль?"}
        </button>

        <p className="loginHint">Вход через email и пароль</p>
      </form>
    </div>
  );
}
