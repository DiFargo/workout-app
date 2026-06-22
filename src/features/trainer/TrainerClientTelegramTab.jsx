export default function TrainerClientTelegramTab({
  adminTelegramMessage,
  adminTelegramSending,
  getAdminClientInitials,
  getClientTelegramProfile,
  openTelegramChat,
  selectedClient,
  sendAdminTelegramMessage,
  setAdminTelegramMessage,
  setAdminUsersSelectedTab,
  toggleClientTelegramNotifications
}) {
  const telegramProfile = getClientTelegramProfile(selectedClient);

  return (
    <div className="adminClientTabContent adminClientTelegramOnlyTab">
      <div className="adminClientTelegramPanel adminClientTelegramPanelRender">
        <div className="adminClientTelegramHead adminClientTelegramHeadRender">
          <div className="adminClientTelegramTitleRender">
            <div className="adminClientTelegramLogoRender">✈️</div>
            <div>
              <h3>Telegram</h3>
              <p>Уведомления тренера</p>
            </div>
          </div>

          <div className={telegramProfile.connected ? "adminClientTelegramBadge connected" : "adminClientTelegramBadge"}>
            {telegramProfile.connected ? "Подключен" : "Не подключен"}
          </div>
        </div>

        <p className="adminClientTelegramDescriptionRender">Напоминания за день до тренировки и быстрые сообщения клиенту.</p>

        <div className="adminClientTelegramBody adminClientTelegramBodyRender">
          <div className="adminClientTelegramAvatar adminClientTelegramAvatarRender">
            {telegramProfile.avatarUrl ? (
              <img src={telegramProfile.avatarUrl} alt="" />
            ) : (
              <span>
                {getAdminClientInitials(selectedClient)}
              </span>
            )}
          </div>

          <div className="adminClientTelegramUserRender">
            <strong>
              {telegramProfile.connected
                ? (telegramProfile.displayName || selectedClient.name || `@${telegramProfile.username}`)
                : "Telegram не привязан"}
            </strong>
            <small>
              {telegramProfile.connected
                ? `@${telegramProfile.username || "telegram"}`
                : "Клиент должен привязать Telegram в личном кабинете."}
            </small>
          </div>

          <div className="adminClientTelegramActions adminClientTelegramActionsRender">
            <button
              type="button"
              disabled={!telegramProfile.connected}
              onClick={() => openTelegramChat(telegramProfile.username)}
            >
              Открыть чат
            </button>

            <button
              type="button"
              className="danger"
              disabled={!telegramProfile.connected}
              onClick={() => toggleClientTelegramNotifications(selectedClient, !telegramProfile.notificationsEnabled)}
            >
              {telegramProfile.notificationsEnabled ? "Отключить" : "Включить"}
            </button>
          </div>
        </div>

        <div className="adminTelegramComposer adminTelegramComposerRender">
          <div className="adminTelegramTextareaWrapRender">
            <textarea
              value={adminTelegramMessage}
              onChange={(event) => setAdminTelegramMessage(event.target.value)}
              placeholder="Сообщение клиенту в Telegram..."
              disabled={!telegramProfile.connected}
            />
            <span>0/4096</span>
            <button
              type="button"
              className="adminTelegramSendButton"
              disabled={!telegramProfile.connected || adminTelegramSending}
              onClick={() => sendAdminTelegramMessage(selectedClient)}
            >
              {adminTelegramSending ? "Отправляю..." : "✈ Отправить"}
            </button>
          </div>

          <div className="adminTelegramQuickMessages adminTelegramQuickMessagesRender">
            <strong>Быстрые сообщения</strong>
            <div>
              {[
                ["⚡", "Завтра тренировка 💪", "Не забудь выспаться"],
                ["⚡", "Сегодня держи технику", "И не гонись за весом"],
                ["⚡", "Отличная работа 👏", "Продолжай в том же духе"]
              ].map(([icon, title, subtitle]) => {
                const message = `${title}. ${subtitle}.`;
                return (
                  <button
                    key={title}
                    type="button"
                    disabled={!telegramProfile.connected}
                    onClick={() => setAdminTelegramMessage(message)}
                  >
                    <span>{icon}</span>
                    <b>{title}</b>
                    <small>{subtitle}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <button type="button" className="adminClientTelegramSavedRender" onClick={() => setAdminUsersSelectedTab("calendarNutrition")}>
            <span>▣</span>
            <strong>Календарь и Telegram-напоминания сохранены.</strong>
            <i>›</i>
          </button>
        </div>
      </div>
    </div>
  );
}
