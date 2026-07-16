import { Mail } from "lucide-react";
import styles from "./ProfileAppSettingsSection.module.css";

export default function ProfileAppSettingsSection({
  isWarmLightTheme,
  email,
  telegramProfile,
  onToggleTheme,
  onOpenEmail,
  onOpenTelegram,
  onTelegramAvatarError,
  heading,
  variant = "modal",
  darkThemeLabel = "тёмный стиль",
  disconnectedText = "Нажми, чтобы подключить",
  connectedBadge = "Подключён"
}) {
  const variantClass = variant === "account"
    ? styles.account
    : variant === "tab"
      ? styles.tab
      : styles.modal;

  return (
    <section
      className={`${styles.section} ${variantClass}${heading ? ` ${styles.hasHeading}` : ""}`}
      data-testid="profile-app-settings-section"
      data-profile-app-settings-variant={variant}
    >
      {heading && <p className={styles.panelTitle}>{heading}</p>}
      <div className={styles.actions}>
        {onOpenEmail && (
          <button
            type="button"
            className={`${styles.item} ${styles.emailItem}${email ? ` ${styles.connected}` : ""}`}
            data-testid="profile-settings-email"
            aria-label={email ? "Открыть настройки почты" : "Привязать почту"}
            onClick={onOpenEmail}
          >
            <span className={`${styles.avatar} ${styles.emailAvatar}`}>
              <Mail size={18} strokeWidth={2.4} />
            </span>
            <span className={styles.text}>
              <strong>Почта</strong>
              <small>{email ? `${email} · привязана` : "Нажми, чтобы привязать"}</small>
            </span>
            <em className={styles.badge}>{email ? "Привязана" : "Привязать"}</em>
            <i className={styles.arrow}>›</i>
          </button>
        )}

        <button
          type="button"
          className={`${styles.item}${telegramProfile.connected ? ` ${styles.connected}` : ""}`}
          data-testid="profile-settings-telegram"
          aria-label={telegramProfile.connected ? "Открыть настройки подключенного Telegram" : "Подключить Telegram"}
          onClick={onOpenTelegram}
        >
          <span className={styles.avatar}>
            {telegramProfile.avatarUrl ? <img src={telegramProfile.avatarUrl} alt="" onError={onTelegramAvatarError} /> : "✈️"}
          </span>
          <span className={styles.text}>
            <strong>Telegram</strong>
            <small>
              {telegramProfile.connected
                ? `@${telegramProfile.username || "telegram"} · подключён`
                : disconnectedText}
            </small>
          </span>
          <em className={styles.badge}>{telegramProfile.connected ? connectedBadge : "Подключить"}</em>
          <i className={styles.arrow}>›</i>
        </button>

        <button
          type="button"
          className={styles.themeButton}
          data-testid="profile-settings-theme"
          aria-label={isWarmLightTheme ? `Переключить оформление на ${darkThemeLabel}` : "Переключить оформление на светлый стиль"}
          aria-pressed={isWarmLightTheme}
          onClick={onToggleTheme}
        >
          <span className={styles.themeIcon}>{isWarmLightTheme ? "🌙" : "☀️"}</span>
          <span className={styles.themeText}>
            <strong>Оформление</strong>
            <small>{isWarmLightTheme ? `Переключить на ${darkThemeLabel}` : "Переключить на светлый стиль"}</small>
          </span>
          <span className={styles.toggle} aria-hidden="true">
            <span className={styles.toggleKnob} />
          </span>
        </button>
      </div>
    </section>
  );
}
