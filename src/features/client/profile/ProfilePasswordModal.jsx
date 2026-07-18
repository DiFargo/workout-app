import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import styles from "./ProfilePasswordModal.module.css";

export default function ProfilePasswordModal({
  open,
  hasPasswordProvider = true,
  hasGoogleProvider = false,
  saving,
  status,
  onClose,
  onChangePassword,
  onSendPasswordReset
}) {
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    nextPassword: "",
    confirmPassword: ""
  });
  const [visiblePasswordFields, setVisiblePasswordFields] = useState({
    currentPassword: false,
    nextPassword: false,
    confirmPassword: false
  });
  const canSetPasswordViaGoogle = !hasPasswordProvider && hasGoogleProvider;

  if (!open) return null;

  function updatePasswordDraft(field, value) {
    setPasswordDraft((current) => ({ ...current, [field]: value }));
  }

  function togglePasswordVisibility(field) {
    setVisiblePasswordFields((current) => ({ ...current, [field]: !current[field] }));
  }

  function renderPasswordInput(field, autoComplete) {
    const isVisible = Boolean(visiblePasswordFields[field]);

    return (
      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          data-testid={`profile-password-${field}`}
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          value={passwordDraft[field]}
          onChange={(event) => updatePasswordDraft(field, event.target.value)}
        />
        <button
          type="button"
          className={styles.visibilityButton}
          data-testid={`profile-password-toggle-${field}`}
          aria-label={isVisible ? "Скрыть пароль" : "Показать пароль"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => togglePasswordVisibility(field)}
        >
          {isVisible ? <EyeOff size={18} strokeWidth={2.2} /> : <Eye size={18} strokeWidth={2.2} />}
        </button>
      </div>
    );
  }

  async function submitPasswordChange(event) {
    event.preventDefault();
    const changed = await onChangePassword(passwordDraft);
    if (changed) {
      setPasswordDraft({
        currentPassword: "",
        nextPassword: "",
        confirmPassword: ""
      });
      onClose();
    }
  }

  return (
    <div
      className={styles.overlay}
      data-testid="profile-password-overlay"
      data-css-module-scope="profile-password-modal"
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.dialog}
        data-testid="profile-password-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="profilePasswordManageTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeButton}
          data-testid="profile-password-close"
          aria-label="Закрыть пароль"
          onClick={onClose}
        >×</button>

        <div className={styles.head}>
          <div className={styles.avatar}>
            <LockKeyhole size={28} strokeWidth={2.3} />
          </div>
          <div>
            <span className={styles.eyebrow}>БЕЗОПАСНОСТЬ</span>
            <h3 className={styles.heading} id="profilePasswordManageTitle">{canSetPasswordViaGoogle ? "Задать пароль" : "Изменить пароль"}</h3>
            <p className={styles.intro}>
              {canSetPasswordViaGoogle
                ? "Аккаунт подключён через Google. Подтверди вход Google и задай пароль для входа через логин."
                : "Обнови пароль для входа через логин или email."}
            </p>
          </div>
        </div>

        <form className={styles.form} data-testid="profile-password-form" onSubmit={submitPasswordChange}>
          {hasPasswordProvider && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Текущий пароль</span>
              {renderPasswordInput("currentPassword", "current-password")}
            </label>
          )}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Новый пароль</span>
            {renderPasswordInput("nextPassword", "new-password")}
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Повтори пароль</span>
            {renderPasswordInput("confirmPassword", "new-password")}
          </label>

          <div className={styles.preview}>
            <div className={styles.previewIcon}>✓</div>
            <div>
              <strong>Подтверждение входа</strong>
              <span>
                {canSetPasswordViaGoogle
                  ? "Для Google-аккаунта откроется окно подтверждения Google."
                  : "Для смены пароля нужен текущий пароль. Можно отправить ссылку восстановления на почту."}
              </span>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} data-testid="profile-password-reset" onClick={onSendPasswordReset}>
              Ссылка на почту
            </button>
            <button type="submit" className={styles.primaryButton} data-testid="profile-password-submit" disabled={saving}>
              {saving ? "Меняю..." : canSetPasswordViaGoogle ? "Задать пароль" : "Обновить"}
            </button>
          </div>
        </form>

        {status && (
          <div className={styles.status} data-testid="profile-password-status">{status}</div>
        )}

        <button type="button" className={styles.secondaryButton} data-testid="profile-password-dismiss" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
