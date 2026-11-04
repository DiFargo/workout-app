import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Eye, EyeOff, Send } from "lucide-react";
import styles from "./AuthScreens.module.css";
import compactStyles from "./CompactAuth.module.css";

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
  handleEmailSignup,
  handleLogin,
  handleLoginPasswordReset,
  handleTelegramMiniAppAuth
}) {
  const styles = compactStyles;
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [method, setMethod] = useState(() => typeof window !== "undefined"
    && (window.Telegram?.WebApp?.initData || new URLSearchParams(window.location.search).get("telegramInvite"))
    ? "telegram" : "password");
  const formCardRef = useRef(null);
  const returnMethodRef = useRef(method);
  const focusNextInputRef = useRef(false);
  const chooseMethod = (nextMethod) => {
    if ((nextMethod === "signup" || nextMethod === "recovery") && (method === "telegram" || method === "password")) {
      returnMethodRef.current = method;
    }
    setLoginError("");
    setLoginNotice("");
    setLoginFieldErrors({});
    focusNextInputRef.current = nextMethod !== "telegram";
    setMethod(nextMethod);
  };
  useEffect(() => {
    if (!focusNextInputRef.current) return undefined;
    focusNextInputRef.current = false;
    window.scrollTo({ top: 0, left: 0 });
    const frame = window.requestAnimationFrame(() => formCardRef.current?.querySelector("input")?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [method]);
  const [telegramInviteToken] = useState(
    () => typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("telegramInvite") || "" : ""
  );
  const hasTelegramInvite = Boolean(telegramInviteToken);
  const safeInviteToken = /^[A-Za-z0-9_-]{20,60}$/.test(telegramInviteToken) ? telegramInviteToken : "";
  const telegramBotUrl = safeInviteToken
    ? `https://t.me/zmena_teleg_bot?start=invite_${encodeURIComponent(safeInviteToken)}`
    : "https://t.me/zmena_teleg_bot";
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

  const isBusy = loginSubmitting || passwordResetSending;
  const isLoginMethod = method === "telegram" || method === "password";

  return (
    <main className={`${styles.loginPage} ${styles.compactLoginPage}`}>
      <div className={styles.compactBrand} aria-label="Zmena">
        <img src="/brand/ownset.svg?v=gradient-1" width="38" height="38" alt="" />
        <span>Zmena</span>
      </div>

      <section ref={formCardRef} className={`${styles.loginCard} ${styles.compactLoginCard}`} aria-labelledby="auth-title" aria-busy={isBusy}>
        {!isLoginMethod && (
          <button type="button" className={styles.loginBackBtn} disabled={isBusy} onClick={() => chooseMethod(returnMethodRef.current)}>
            <ChevronLeft size={18} aria-hidden="true" /> Назад
          </button>
        )}
        <h1 id="auth-title">{method === "signup" ? "Создать аккаунт" : method === "recovery" ? "Восстановить пароль" : hasTelegramInvite ? "Приглашение от тренера" : "Войти в Zmena"}</h1>

        {isLoginMethod && <div className={styles.methodSwitch} role="group" aria-label="Способ входа">
          <button type="button" aria-pressed={method === "telegram"} disabled={isBusy} onClick={() => chooseMethod("telegram")}>Telegram</button>
          <button type="button" aria-pressed={method === "password"} disabled={isBusy} onClick={() => chooseMethod("password")}>Email или логин</button>
        </div>}

        {loginError && <div className={styles.loginError} role="alert">{loginError}</div>}
        {loginNotice && <div className={styles.loginNotice} role="status">{loginNotice}</div>}

        {method === "telegram" && <div className={styles.compactTelegram}>
          <span className={styles.compactTelegramIcon}><Send size={30} aria-hidden="true" /></span>
          <p className={styles.compactNote}>{isTelegramMiniApp
            ? hasTelegramInvite ? "Подтверди приглашение своим Telegram-аккаунтом." : "Быстрый вход без пароля."
            : hasTelegramInvite ? "Это приглашение нужно подтвердить в Telegram. Открой чат с ботом и нажми Start."
              : "Сейчас приложение открыто в браузере. Перейди в Telegram и открой Zmena кнопкой приложения в чате с ботом."}</p>
          {isTelegramMiniApp ? <button className={styles.loginTelegramBtn} type="button" disabled={isBusy} onClick={handleTelegramMiniAppAuth}>
            <Send size={19} aria-hidden="true" />
            {loginSubmitting ? "Проверяю Telegram…" : hasTelegramInvite ? "Принять приглашение" : "Продолжить через Telegram"}
          </button> : <a className={styles.loginTelegramBtn} href={telegramBotUrl} aria-disabled={isBusy || undefined} onClick={(event) => { if (isBusy) event.preventDefault(); }}>
            <Send size={19} aria-hidden="true" />
            {hasTelegramInvite ? "Открыть приглашение в Telegram" : "Открыть бота в Telegram"}
          </a>}
          {!hasTelegramInvite && <p className={styles.existingAccountNote}>Уже есть аккаунт с email? Сначала <button type="button" className={styles.inlineAuthLink} disabled={isBusy} onClick={() => chooseMethod("password")}>войди в него</button>, затем подключи Telegram в кабинете.</p>}
        </div>}

        {(method === "password" || method === "recovery") && <form className={`${styles.loginAlternateForm} ${styles.compactForm}`} onSubmit={method === "recovery" ? (event) => { event.preventDefault(); handleLoginPasswordReset(); } : handleLogin}>
          {method === "recovery" && <p className={styles.compactNote}>Укажи email или логин. Ссылка для смены пароля придёт на почту этого аккаунта.</p>}
          {hasTelegramInvite && method === "password" && <p className={styles.compactNote}>Для приглашения через Telegram пароль не нужен. Подтверди его своим Telegram-аккаунтом.</p>}
          <label className={styles.loginField}>
            <span>Email или логин</span>
            <input value={login} onChange={(event) => {
              setLogin(event.target.value);
              setLoginFieldErrors((current) => ({ ...current, email: "" }));
              setLoginError("");
              setLoginNotice("");
            }} placeholder="Твой email или логин" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-label="Email или логин" aria-invalid={Boolean(loginFieldErrors.email)} aria-describedby={loginFieldErrors.email ? "login-email-error" : undefined} />
            {loginFieldErrors.email && <small className={styles.loginFieldError} id="login-email-error">{loginFieldErrors.email}</small>}
          </label>
          {method === "password" && <>
            <label className={styles.loginField}>
              <span>Пароль</span>
              <div className={styles.passwordBox}>
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => {
                  setPassword(event.target.value);
                  setLoginFieldErrors((current) => ({ ...current, password: "" }));
                  setLoginError("");
                }} placeholder="Введи пароль" autoComplete="current-password" aria-label="Пароль" aria-invalid={Boolean(loginFieldErrors.password)} aria-describedby={loginFieldErrors.password ? "login-password-error" : undefined} />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}>
                  {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </div>
              {loginFieldErrors.password && <small className={styles.loginFieldError} id="login-password-error">{loginFieldErrors.password}</small>}
            </label>
            <button className={styles.compactResetLink} type="button" disabled={isBusy} onClick={() => chooseMethod("recovery")}>Забыли пароль?</button>
          </>}
          <button className={styles.loginBtn} type="submit" disabled={isBusy}>
            {method === "recovery" ? passwordResetSending ? "Отправляю…" : "Отправить ссылку" : loginSubmitting ? "Вхожу…" : "Войти"}
          </button>
        </form>}

        {method === "signup" && <form className={`${styles.loginAlternateForm} ${styles.compactForm}`} onSubmit={(event) => handleEmailSignup(event, signupEmail, signupPassword)}>
          <p className={styles.compactNote}>Зарегистрироваться можно без приглашения.</p>
          <label className={styles.loginField}>
            <span>Email</span>
            <input type="email" value={signupEmail} onChange={(event) => { setSignupEmail(event.target.value); setLoginError(""); setLoginNotice(""); }} placeholder="name@example.com" autoComplete="email" autoCapitalize="none" spellCheck={false} required />
          </label>
          <label className={styles.loginField}>
            <span>Пароль</span>
            <div className={styles.passwordBox}>
              <input type={showPassword ? "text" : "password"} value={signupPassword} onChange={(event) => { setSignupPassword(event.target.value); setLoginError(""); setLoginNotice(""); }} placeholder="Не менее 6 символов" autoComplete="new-password" aria-label="Пароль" minLength={6} required />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}>
                {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
          </label>
          <p className={styles.trainerAccessNote}>Без назначенного тренера доступно только ознакомление. Тренировки и питание откроются после назначения тренера.</p>
          <a className={styles.privacyLink} href="/privacy.html" target="_blank" rel="noopener noreferrer">Данные и конфиденциальность</a>
          <button className={styles.loginBtn} type="submit" disabled={isBusy}>{loginSubmitting ? "Создаю аккаунт…" : "Создать аккаунт"}</button>
        </form>}

        {isLoginMethod && <div className={styles.compactSignupRow}><span>Нет аккаунта?</span><button type="button" className={styles.inlineAuthLink} disabled={isBusy} onClick={() => chooseMethod("signup")}>Создать аккаунт</button></div>}
      </section>

      <footer className={styles.compactAuthFooter}>
        <details className={styles.loginHelp}>
          <summary>Помощь со входом</summary>
          <div>
            <h2>Есть приглашение?</h2>
            <p>Приглашение через Telegram? Продолжи через Telegram — пароль для этого не нужен. Если в приглашении предложено создать пароль, сначала задай его по ссылке, затем войди по логину или email.</p>
            <h2>Забыли пароль?</h2>
            <p>Выбери «Email или логин» → «Забыли пароль?». Восстановление пароля отправит письмо на почту аккаунта.</p>
            <h2>Пока нет тренера?</h2>
            <p>Можно создать аккаунт и познакомиться с приложением. Тренировки и питание откроются после назначения тренера.</p>
          </div>
        </details>
        {method !== "signup" && <a className={styles.privacyLink} href="/privacy.html" target="_blank" rel="noopener noreferrer">Данные и конфиденциальность</a>}
      </footer>
    </main>
  );
}
