export default function ProfileAppSettingsSection({
  isWarmLightTheme,
  telegramProfile,
  onToggleTheme,
  onOpenTelegram,
  onTelegramAvatarError,
  darkThemeLabel = "тёмный стиль",
  disconnectedText = "Нажми, чтобы подключить",
  connectedBadge = "Подключён"
}) {
  return (
    <section className="profileDashboardCard profileAppSettingsSection">
      <div className="profileSettingsActions">
        <button type="button" className="profileThemeSwitchBtn" onClick={onToggleTheme}>
          <span className="profileThemeIcon">{isWarmLightTheme ? "🌙" : "☀️"}</span>
          <span className="profileThemeText">
            <strong>Оформление</strong>
            <small>{isWarmLightTheme ? `Переключить на ${darkThemeLabel}` : "Переключить на светлый стиль"}</small>
          </span>
          <i>›</i>
        </button>

        <button
          type="button"
          className={telegramProfile.connected ? "profileSettingsTelegramItem connected" : "profileSettingsTelegramItem"}
          onClick={onOpenTelegram}
        >
          <span className="profileSettingsTelegramAvatar">
            {telegramProfile.avatarUrl ? <img src={telegramProfile.avatarUrl} alt="" onError={onTelegramAvatarError} /> : "✈️"}
          </span>
          <span className="profileSettingsTelegramText">
            <strong>Telegram</strong>
            <small>
              {telegramProfile.connected
                ? `@${telegramProfile.username || "telegram"} · подключён`
                : disconnectedText}
            </small>
          </span>
          <em>{telegramProfile.connected ? connectedBadge : "Подключить"}</em>
          <i>›</i>
        </button>
      </div>
    </section>
  );
}
