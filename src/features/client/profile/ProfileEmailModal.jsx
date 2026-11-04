import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Mail } from "lucide-react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import ProfileModalCloseButton from "./ProfileModalCloseButton";
import styles from "./ProfileEmailModal.module.css";
import { getAccountRecoveryEmail } from "./profileAccountEmail.js";
import { useProfileEmailAuthMethod } from "./useProfileEmailAuthMethod.js";
import { useModalBackNavigation } from "../../../shared/hooks/useModalBackNavigation.js";

export default function ProfileEmailModal(props) {
  return props.open ? <ProfileEmailForm {...props} /> : null;
}

function ProfileEmailForm({
  email,
  authUser,
  saving,
  status,
  onClose,
  onReauthenticate,
  onRequestEmailChange
}) {
  const currentEmail = getAccountRecoveryEmail(email);
  const authMethod = useProfileEmailAuthMethod(authUser);
  const customSession = authMethod === "custom";
  const [nextEmail, setNextEmail] = useState(currentEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [reauthenticatePending, setReauthenticatePending] = useState(false);
  const [reauthenticateError, setReauthenticateError] = useState("");
  const handoffPendingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const attemptReauthentication = useCallback(async () => {
    if (handoffPendingRef.current) return;
    handoffPendingRef.current = true;
    setReauthenticatePending(true);
    setReauthenticateError("");
    try {
      const result = await (onReauthenticate || onClose)?.();
      if (result === false && mountedRef.current) setReauthenticateError("Не удалось завершить выход. Попробуй ещё раз.");
    } catch {
      if (mountedRef.current) setReauthenticateError("Не удалось завершить выход. Попробуй ещё раз.");
    } finally {
      handoffPendingRef.current = false;
      if (mountedRef.current) setReauthenticatePending(false);
    }
  }, [onReauthenticate, onClose]);
  useModalBackNavigation({ open: saveSuccess, onBack: attemptReauthentication });

  async function submitEmailChange(event) {
    event.preventDefault();
    const changed = await onRequestEmailChange(nextEmail, { currentPassword });
    if (changed) {
      setCurrentPassword("");
      setSaveSuccess(true);
    }
  }

  return (
    <div
      className={styles.overlay} data-modal-backdrop="true"
      data-testid="profile-email-overlay"
      data-css-module-scope="profile-email-modal"
      role="presentation"
      onClick={saveSuccess ? undefined : onClose}
    >
      <div
        className={styles.dialog}
        data-testid="profile-email-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        data-cabinet-sheet="true"
        aria-labelledby="profileEmailManageTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <ClientPageHeader
          compact
          embedded
          controlsVariant="workout"
          className={styles.header}
          title={saveSuccess ? "Почта сохранена" : currentEmail ? "Изменить почту" : "Добавить личную почту"}
          titleId="profileEmailManageTitle"
          scope="profile-email-header"
          actions={(
            <ProfileModalCloseButton
              testId="profile-email-close"
              ariaLabel="Закрыть почту"
              disabled={saveSuccess}
              onClick={onClose}
            />
          )}
        />

        {saveSuccess ? <section className={styles.form} data-testid="profile-email-success">
          <div className={styles.preview} role="status">
            <div className={styles.previewIcon} aria-hidden="true"><Check /></div>
            <div>
              <strong>Требуется повторный вход</strong>
              <span>{customSession
                ? "Почта сохранена. Для безопасности войди снова через Telegram в тот же аккаунт. Адрес ещё не подтверждён, пароль не создаётся автоматически. После входа ссылку для установки или смены пароля можно запросить в разделе «Пароль»."
                : "Почта сохранена. Для безопасности войди в аккаунт заново привычным способом. Адрес ещё не подтверждён; пароль не создаётся автоматически. Если используешь пароль, вводи новый email и существующий пароль."}</span>
            </div>
          </div>
          {reauthenticateError ? <p className={styles.status} role="alert" data-testid="profile-email-reauthenticate-error">{reauthenticateError}</p> : null}
          <button type="button" className={styles.primaryButton} data-testid="profile-email-reauthenticate" autoFocus disabled={reauthenticatePending} onClick={attemptReauthentication}>
            {reauthenticatePending ? "Завершаю выход…" : "Перейти к повторному входу"}
          </button>
        </section> : <>
        <div className={styles.head}>
          <div className={styles.avatar}>
            <Mail size={28} strokeWidth={2.3} />
          </div>
          <div>
            <p className={styles.intro}>
              {currentEmail
                ? `${currentEmail} · адрес аккаунта. Для входа по email нужен заданный пароль.`
                : "Добавь личную почту. После сохранения адреса пароль не создаётся автоматически."}
            </p>
          </div>
        </div>

        <form className={styles.form} data-testid="profile-email-form" onSubmit={submitEmailChange}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Новая почта</span>
            <input
              className={styles.input}
              data-testid="profile-email-address"
              type="email"
              autoComplete="email"
              value={nextEmail}
              onChange={(event) => setNextEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </label>

          {!customSession && authMethod !== "checking" && <label className={styles.field}>
            <span className={styles.fieldLabel}>Текущий пароль</span>
            <input
              className={styles.input}
              data-testid="profile-email-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Для Google-аккаунта откроется Google"
            />
          </label>}

          <div className={styles.preview}>
            <div className={styles.previewIcon} aria-hidden="true"><Check /></div>
            <div>
              <strong>Подтверждение входа</strong>
              <span>{authMethod === "checking" ? "Проверяем способ текущего входа…" : customSession
                ? "Подтверждение — текущая сессия Telegram не старше 5 минут. Если вход устарел, потребуется снова войти через Telegram в тот же аккаунт. Для установки или смены пароля после сохранения запроси ссылку в разделе «Пароль»."
                : authMethod === "unavailable" ? "Не удалось проверить текущий вход. Закрой окно и попробуй ещё раз."
                : "Для парольного аккаунта нужен текущий пароль. Для Google откроется окно авторизации."}</span>
            </div>
          </div>

          <button type="submit" className={styles.primaryButton} data-testid="profile-email-submit" disabled={saving || saveSuccess || authMethod === "checking" || authMethod === "unavailable"}>
            {saving ? "Проверяю..." : currentEmail ? "Подтвердить и сохранить" : "Привязать почту"}
          </button>
        </form>

        {status && (
          <div className={styles.status} data-testid="profile-email-status">{status}</div>
        )}

        <button type="button" className={styles.secondaryButton} data-testid="profile-email-dismiss" onClick={onClose} disabled={saveSuccess}>
          Закрыть
        </button>
        </>}
      </div>
    </div>
  );
}
