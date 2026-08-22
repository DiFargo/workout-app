import { Bell, Mail } from "lucide-react";
import styles from "./ProfileAppSettingsSection.module.css";

export default function ProfileAppSettingsSection({
  email,
  telegramProfile,
  onOpenEmail,
  onOpenTelegram,
  onTelegramAvatarError,
  showEmail = true,
  showTelegram = true,
  showNotifications = false,
  notificationsEnabled = true,
  onToggleNotifications,
  heading,
  variant = "modal",
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
        {showNotifications && (
          <button
            type="button"
            className={styles.notificationButton}
            data-testid="profile-settings-notifications-toggle"
            aria-label={notificationsEnabled ? "Отключить напоминания" : "Включить напоминания"}
            aria-pressed={notificationsEnabled}
            onClick={() => onToggleNotifications?.(!notificationsEnabled)}
            disabled={!onToggleNotifications}
          >
            <span className={styles.notificationIcon} aria-hidden="true">
              <Bell size={18} strokeWidth={2.2} />
            </span>
            <span className={styles.notificationText}>
              <strong>Напоминания</strong>
              <small>{notificationsEnabled ? "О тренировках и прогрессе" : "Напоминания отключены"}</small>
            </span>
            <span className={styles.toggle} aria-hidden="true">
              <span className={styles.toggleKnob} />
            </span>
          </button>
        )}

        {showEmail && onOpenEmail && (
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

        {showTelegram && <button
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
        </button>}

      </div>
    </section>
  );
}
