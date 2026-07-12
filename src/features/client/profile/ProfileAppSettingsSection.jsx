import { Mail } from "lucide-react";

export default function ProfileAppSettingsSection({
  isWarmLightTheme,
  email,
  telegramProfile,
  onToggleTheme,
  onOpenEmail,
  onOpenTelegram,
  onTelegramAvatarError,
  heading,
  darkThemeLabel = "тёмный стиль",
  disconnectedText = "Нажми, чтобы подключить",
  connectedBadge = "Подключён"
}) {
  return (
    <section className={heading ? "profileDashboardCard profileAppSettingsSection hasHeading" : "profileDashboardCard profileAppSettingsSection"}>
      {heading && <p className="profileAccountPanelTitle">{heading}</p>}
      <div className="profileSettingsActions">
        {onOpenEmail && (
          <button
            type="button"
            className={email ? "profileSettingsEmailItem connected" : "profileSettingsEmailItem"}
            aria-label={email ? "Открыть настройки почты" : "Привязать почту"}
            onClick={onOpenEmail}
          >
            <span className="profileSettingsTelegramAvatar profileSettingsEmailAvatar">
              <Mail size={18} strokeWidth={2.4} />
            </span>
            <span className="profileSettingsTelegramText">
              <strong>Почта</strong>
              <small>{email ? `${email} · привязана` : "Нажми, чтобы привязать"}</small>
            </span>
            <em>{email ? "Привязана" : "Привязать"}</em>
            <i>›</i>
          </button>
        )}

        <button
          type="button"
          className={telegramProfile.connected ? "profileSettingsTelegramItem connected" : "profileSettingsTelegramItem"}
          aria-label={telegramProfile.connected ? "Открыть настройки подключенного Telegram" : "Подключить Telegram"}
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

        <button
          type="button"
          className="profileThemeSwitchBtn"
          aria-label={isWarmLightTheme ? `Переключить оформление на ${darkThemeLabel}` : "Переключить оформление на светлый стиль"}
          aria-pressed={isWarmLightTheme}
          onClick={onToggleTheme}
        >
          <span className="profileThemeIcon">{isWarmLightTheme ? "🌙" : "☀️"}</span>
          <span className="profileThemeText">
            <strong>Оформление</strong>
            <small>{isWarmLightTheme ? `Переключить на ${darkThemeLabel}` : "Переключить на светлый стиль"}</small>
          </span>
          <span className="profileThemeToggle" aria-hidden="true">
            <span />
          </span>
        </button>
      </div>
    </section>
  );
}
