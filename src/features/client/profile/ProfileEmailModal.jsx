import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import SaveSuccessNotice from "../../../shared/ui/SaveSuccessNotice";
import ProfileModalCloseButton from "./ProfileModalCloseButton";
import styles from "./ProfileEmailModal.module.css";

export default function ProfileEmailModal({
  open,
  email,
  saving,
  status,
  onClose,
  onRequestEmailChange
}) {
  const currentEmail = String(email || "").trim();
  const [nextEmail, setNextEmail] = useState(currentEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (open) setSaveSuccess(false);
  }, [open]);

  if (!open) {
    return null;
  }

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
      className={styles.overlay}
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
        aria-labelledby="profileEmailManageTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <ClientPageHeader
          compact
          embedded
          controlsVariant="workout"
          className={styles.header}
          title="Привязка почты"
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

        <div className={styles.head}>
          <div className={styles.avatar}>
            <Mail size={28} strokeWidth={2.3} />
          </div>
          <div>
            <p className={styles.intro}>
              {currentEmail
                ? `${currentEmail} · используется для входа и восстановления доступа.`
                : "Добавь почту, чтобы входить в аккаунт и восстановить доступ при необходимости."}
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

          <label className={styles.field}>
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
          </label>

          <div className={styles.preview}>
            <div className={styles.previewIcon}>✓</div>
            <div>
              <strong>Подтверждение входа</strong>
              <span>Для парольного аккаунта нужен текущий пароль. Для Google откроется окно авторизации.</span>
            </div>
          </div>

          <button type="submit" className={styles.primaryButton} data-testid="profile-email-submit" disabled={saving || saveSuccess}>
            {saving ? "Проверяю..." : "Авторизовать и привязать"}
          </button>
        </form>

        {status && (
          <div className={styles.status} data-testid="profile-email-status">{status}</div>
        )}

        <button type="button" className={styles.secondaryButton} data-testid="profile-email-dismiss" onClick={onClose} disabled={saveSuccess}>
          Закрыть
        </button>
        {saveSuccess ? (
          <SaveSuccessNotice
            title="Почта изменена"
            description="Новый адрес привязан к аккаунту и доступен для входа."
            onComplete={onClose}
          />
        ) : null}
      </div>
    </div>
  );
}
