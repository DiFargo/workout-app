import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

export default function ProfileEmailModal({
  open,
  email,
  saving,
  status,
  onClose,
  onRequestEmailChange
}) {
  const [nextEmail, setNextEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const currentEmail = String(email || "").trim();

  useEffect(() => {
    if (open) {
      setNextEmail(currentEmail);
      setCurrentPassword("");
    }
  }, [currentEmail, open]);

  if (!open) {
    return null;
  }

  async function submitEmailChange(event) {
    event.preventDefault();
    const changed = await onRequestEmailChange(nextEmail, { currentPassword });
    if (changed) {
      setCurrentPassword("");
    }
  }

  return (
    <div className="profileTelegramModalOverlay" role="presentation" onClick={onClose}>
      <div
        className="profileTelegramModal profileEmailManageModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profileEmailManageTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="profileTelegramModalClose"
          aria-label="Закрыть почту"
          onClick={onClose}
        >×</button>

        <div className="profileTelegramManageHead profileEmailManageHead">
          <div className="profileTelegramManageAvatar profileEmailManageAvatar">
            <Mail size={28} strokeWidth={2.3} />
          </div>
          <div>
            <span>ПОЧТА</span>
            <h3 id="profileEmailManageTitle">Привязка почты</h3>
            <p>
              {currentEmail
                ? `${currentEmail} · используется для входа и восстановления доступа.`
                : "Добавь почту, чтобы входить в аккаунт и восстановить доступ при необходимости."}
            </p>
          </div>
        </div>

        <form className="profileEmailManageForm" onSubmit={submitEmailChange}>
          <label>
            <span>Новая почта</span>
            <input
              type="email"
              autoComplete="email"
              value={nextEmail}
              onChange={(event) => setNextEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </label>

          <label>
            <span>Текущий пароль</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Для Google-аккаунта откроется Google"
            />
          </label>

          <div className="profileTelegramAuthPreview profileEmailAuthPreview">
            <div className="profileTelegramAuthIcon">✓</div>
            <div>
              <strong>Подтверждение входа</strong>
              <span>Для парольного аккаунта нужен текущий пароль. Для Google откроется окно авторизации.</span>
            </div>
          </div>

          <button type="submit" className="profileTelegramCheckButton" disabled={saving}>
            {saving ? "Проверяю..." : "Авторизовать и привязать"}
          </button>
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
