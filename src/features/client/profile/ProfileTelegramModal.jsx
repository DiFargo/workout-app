export default function ProfileTelegramModal({
  open,
  telegramProfile,
  loginContainerRef,
  loginWidgetReady,
  linking,
  status,
  onAvatarError,
  onClose,
  onCheckLogin,
  onChangeTelegram,
  onDisconnect
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="profileTelegramModalOverlay" role="presentation" onClick={onClose}>
      <div
        className="profileTelegramModal profileTelegramManageModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profileTelegramManageTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="profileTelegramModalClose"
          aria-label="Закрыть Telegram"
          onClick={onClose}
        >×</button>

        <div className="profileTelegramManageHead">
          <div className="profileTelegramManageAvatar">
            {telegramProfile.avatarUrl ? <img src={telegramProfile.avatarUrl} alt="" onError={onAvatarError} /> : <span>✈️</span>}
          </div>
          <div>
            <span>TELEGRAM</span>
            <h3 id="profileTelegramManageTitle">{telegramProfile.connected ? "Telegram подключён" : "Привязать Telegram"}</h3>
            <p>
              {telegramProfile.connected
                ? `${telegramProfile.displayName || `@${telegramProfile.username || "telegram"}`} ${telegramProfile.username ? `· @${telegramProfile.username}` : ""}`
                : "Войди через Telegram, чтобы получать уведомления от тренера."}
            </p>
          </div>
        </div>

        {!telegramProfile.connected && (
          <>
            <div className="profileTelegramAuthPreview">
              <div className="profileTelegramAuthIcon">✈️</div>
              <div>
                <strong>Tren AI Coach</strong>
                <span>Без ручного ввода username. Всё привяжется через Telegram.</span>
              </div>
            </div>

            <div className="profileTelegramLoginWidgetCard">
              <div ref={loginContainerRef} className="profileTelegramLoginWidget" />
              {!loginWidgetReady && (
                <div className="profileTelegramWidgetLoading">
                  Загружаю Telegram Login...
                </div>
              )}
            </div>

            <button
              type="button"
              className="profileTelegramCheckButton"
              onClick={onCheckLogin}
              disabled={linking}
            >
              {linking ? "Проверяю..." : "Проверить подключение"}
            </button>
          </>
        )}

        {telegramProfile.connected && (
          <div className="profileTelegramManageActions">
            <button type="button" onClick={onChangeTelegram}>
              Изменить Telegram
            </button>

            <button type="button" className="danger" onClick={onDisconnect}>
              Отключить
            </button>
          </div>
        )}

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
