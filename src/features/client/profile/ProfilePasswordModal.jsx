import { useEffect, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

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

  useEffect(() => {
    if (open) {
      setPasswordDraft({
        currentPassword: "",
        nextPassword: "",
        confirmPassword: ""
      });
      setVisiblePasswordFields({
        currentPassword: false,
        nextPassword: false,
        confirmPassword: false
      });
    }
  }, [open]);

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
      <div className="profilePasswordInputWrap">
        <input
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          value={passwordDraft[field]}
          onChange={(event) => updatePasswordDraft(field, event.target.value)}
        />
        <button
          type="button"
          className="profilePasswordVisibilityButton"
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
    <div className="profileTelegramModalOverlay" role="presentation" onClick={onClose}>
      <div
        className="profileTelegramModal profilePasswordManageModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profilePasswordManageTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="profileTelegramModalClose"
          aria-label="Закрыть пароль"
          onClick={onClose}
        >×</button>

        <div className="profileTelegramManageHead profilePasswordManageHead">
          <div className="profileTelegramManageAvatar profilePasswordManageAvatar">
            <LockKeyhole size={28} strokeWidth={2.3} />
          </div>
          <div>
            <span>БЕЗОПАСНОСТЬ</span>
            <h3 id="profilePasswordManageTitle">{canSetPasswordViaGoogle ? "Задать пароль" : "Изменить пароль"}</h3>
            <p>
              {canSetPasswordViaGoogle
                ? "Аккаунт подключён через Google. Подтверди вход Google и задай пароль для входа через логин."
                : "Обнови пароль для входа через логин или email."}
            </p>
          </div>
        </div>

        <form className="profileEmailManageForm profilePasswordManageForm" onSubmit={submitPasswordChange}>
          {hasPasswordProvider && (
            <label>
              <span>Текущий пароль</span>
              {renderPasswordInput("currentPassword", "current-password")}
            </label>
          )}

          <label>
            <span>Новый пароль</span>
            {renderPasswordInput("nextPassword", "new-password")}
          </label>

          <label>
            <span>Повтори пароль</span>
            {renderPasswordInput("confirmPassword", "new-password")}
          </label>

          <div className="profileTelegramAuthPreview profileEmailAuthPreview profilePasswordAuthPreview">
            <div className="profileTelegramAuthIcon">✓</div>
            <div>
              <strong>Подтверждение входа</strong>
              <span>
                {canSetPasswordViaGoogle
                  ? "Для Google-аккаунта откроется окно подтверждения Google."
                  : "Для смены пароля нужен текущий пароль. Можно отправить ссылку восстановления на почту."}
              </span>
            </div>
          </div>

          <div className="profilePasswordManageActions">
            <button type="button" className="profileTelegramSave ghost" onClick={onSendPasswordReset}>
              Ссылка на почту
            </button>
            <button type="submit" className="profileTelegramCheckButton" disabled={saving}>
              {saving ? "Меняю..." : canSetPasswordViaGoogle ? "Задать пароль" : "Обновить"}
            </button>
          </div>
        </form>

        {status && (
          <div className="profileTelegramAuthStatus">
            <span>{status}</span>
          </div>
        )}

        <button type="button" className="profileTelegramSave ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
