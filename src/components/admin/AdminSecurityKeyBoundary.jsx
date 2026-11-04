import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onIdTokenChanged, signInWithCustomToken } from "firebase/auth";
import { KeyRound, ShieldCheck, X } from "lucide-react";
import { fetchAuthorizedWithTimeout } from "../../utils/apiClient.js";
import { captureAuthSession } from "../../utils/authSession.js";
import { createAdminSecurityKeyClient, securityKeyErrorMessage } from "../../utils/adminSecurityKeyClient.js";
import { useModalBackNavigation } from "../../shared/hooks/useModalBackNavigation.js";
import { AdminSecurityKeyContext } from "./AdminSecurityKeyContext.js";
import styles from "./AdminSecurityKeyBoundary.module.css";

async function registerKey(options) {
  const { startRegistration } = await import("@simplewebauthn/browser");
  return startRegistration(options);
}
async function authenticateKey(options) {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  return startAuthentication(options);
}

export default function AdminSecurityKeyBoundary({ auth, onLogout, children }) {
  const [state, setState] = useState({ status: null, loading: true, error: "" });
  const [managerOpen, setManagerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [now, setNow] = useState(Date.now);
  const run = useRef(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  const client = useMemo(() => createAdminSecurityKeyClient({ auth, request: fetchAuthorizedWithTimeout,
    startRegistration: registerKey, startAuthentication: authenticateKey, exchangeToken: signInWithCustomToken }), [auth]);

  const refresh = useCallback(async () => {
    const current = ++run.current;
    const guard = captureAuthSession(auth);
    setState({ status: null, loading: true, error: "" });
    try {
      const status = await client.status();
      if (mounted.current && current === run.current && guard.isCurrent()) {
        setState({ status, loading: false, error: "" }); setNow(Date.now());
      }
    } catch (error) {
      if (mounted.current && current === run.current && guard.isCurrent()) {
        setState({ status: null, loading: false, error: securityKeyErrorMessage(error) });
      }
    }
  }, [auth, client]);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = onIdTokenChanged(auth, () => { void refresh(); });
    return () => { mounted.current = false; run.current += 1; unsubscribe(); };
  }, [auth, refresh]);
  useEffect(() => {
    const until = Number(state.status?.verifiedUntil);
    if (!until) return undefined;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(0, until - Date.now() + 10));
    const wake = () => setNow(Date.now());
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake); };
  }, [state.status?.verifiedUntil]);
  const locked = state.status?.required === true && !(state.status.verifiedUntil > now);
  useModalBackNavigation({ open: managerOpen && Boolean(state.status) && !locked,
    onBack: () => { if (!pending.current) setManagerOpen(false); } });

  async function confirm(register) {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    setState(previous => ({ ...previous, error: "" }));
    try {
      await client.confirm({ register, label });
      if (!mounted.current) return;
      setLabel("");
      await refresh();
    } catch (error) {
      if (mounted.current) setState(previous => ({ ...previous, error: securityKeyErrorMessage(error) }));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const supported = typeof window !== "undefined" && window.isSecureContext && Boolean(window.PublicKeyCredential);
  const error = state.error ? <p className={styles.error} role="alert">{state.error}</p> : null;
  if (!state.status || locked) return <main className={styles.gate}>
    <section className={styles.card} aria-busy={busy || state.loading}>
      <KeyRound className={styles.keyIcon} size={30} aria-hidden="true" />
      <span className={styles.eyebrow}>Доступ администратора</span>
      <h1>{state.loading ? "Проверяем защиту входа" : locked ? "Подтвердите вход ключом" : "Не удалось проверить доступ"}</h1>
      <p>{locked ? "Подключите зарегистрированный USB/NFC-ключ. Браузер попросит PIN или касание ключа." : "Данные администратора откроются после проверки."}</p>
      {error}
      {!supported && locked ? <p>Этот браузер не поддерживает ключи. Откройте tren-85720.web.app в Chrome, Edge или Safari.</p> : null}
      {!state.loading ? <button type="button" className={styles.primary} disabled={busy || (locked && !supported)} onClick={() => locked ? void confirm(false) : void refresh()}>
        {busy ? "Ожидаем ключ…" : locked ? "Подтвердить ключом" : "Повторить проверку"}
      </button> : null}
      <button type="button" className={styles.secondary} disabled={busy} onClick={onLogout}>Выйти из аккаунта</button>
      {locked ? <small>Нет ключа? Используйте зарегистрированный резервный. При потере всех ключей восстановление выполняет владелец Firebase-проекта, не через сброс пароля.</small> : null}
    </section>
  </main>;

  return <AdminSecurityKeyContext.Provider value={() => setManagerOpen(true)}>
    {children}
    {managerOpen ? <div className={styles.overlay} role="presentation" data-modal-backdrop="true">
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="admin-key-title" data-modal-surface="true" aria-busy={busy}>
        <header><div><span className={styles.eyebrow}>Защита администратора</span><h2 id="admin-key-title">USB/NFC-ключи</h2></div>
          <button type="button" className={styles.close} disabled={busy} aria-label="Закрыть ключи доступа" onClick={() => setManagerOpen(false)}><X size={22} /></button>
        </header>
        <div className={styles.body}>
          <div className={styles.notice}><ShieldCheck size={23} aria-hidden="true" /><div><strong>{state.status.required ? "Вход защищён ключом" : "Защита ещё не включена"}</strong>
            <p>{state.status.required ? "После входа в аккаунт подтверждайте доступ ключом. Подтверждение действует до 8 часов." : "Первый добавленный ключ включит обязательное подтверждение. Сначала войдите в аккаунт заново, затем зарегистрируйте ключ."}</p></div></div>
          <p>Нужен отдельный FIDO2-ключ с PIN или биометрией. Добавьте второй ключ как резервный и храните его отдельно.</p>
          {state.status.keys?.length ? <ul className={styles.keys}>{state.status.keys.map((key, index) => <li key={key.id}><KeyRound size={20} aria-hidden="true" /><span><strong>{key.label || `Ключ ${index + 1}`}</strong><small>Добавлен {new Date(key.createdAt).toLocaleDateString("ru-RU")}</small></span></li>)}</ul> : null}
          <label className={styles.label}>Название ключа <span>необязательно</span><input value={label} maxLength={80} disabled={busy} onChange={event => setLabel(event.target.value)} placeholder="Например, основной или резервный" /></label>
          {!supported ? <p className={styles.error}>Регистрация доступна в обычном браузере по адресу tren-85720.web.app. Подключите ключ к устройству.</p> : null}
          <small>Закрытый ключ не покидает устройство. Пароль не заменяет ключ. Если потеряны все ключи, потребуется проверка личности владельцем Firebase-проекта.</small>
          {error}
        </div>
        <footer><button type="button" className={styles.secondary} disabled={busy} onClick={() => setManagerOpen(false)}>Закрыть</button>
          <button type="button" className={styles.primary} disabled={busy || !supported || state.status.keys?.length >= 5} onClick={() => void confirm(true)}>{busy ? "Ожидаем ключ…" : state.status.required ? "Добавить резервный ключ" : "Добавить ключ и включить"}</button></footer>
      </section>
    </div> : null}
  </AdminSecurityKeyContext.Provider>;
}
