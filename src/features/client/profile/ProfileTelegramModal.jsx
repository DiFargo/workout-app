import { Send } from "lucide-react";
import styles from "./ProfileTelegramModal.module.css";

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
    <div className={styles.overlay} data-testid="profile-telegram-overlay" role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        data-css-module-scope="profile-telegram-modal"
        data-testid="profile-telegram-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="profileTelegramManageTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeButton}
          data-testid="profile-telegram-close"
          aria-label="Закрыть Telegram"
          onClick={onClose}
        >×</button>

        <div className={styles.head}>
          <div className={styles.avatar}>
            {telegramProfile.avatarUrl ? <img src={telegramProfile.avatarUrl} alt="" onError={onAvatarError} /> : <span className={styles.avatarFallback}><Send size={25} strokeWidth={1.9} /></span>}
          </div>
          <div>
            <span className={styles.eyebrow}>TELEGRAM</span>
            <h3 className={styles.heading} id="profileTelegramManageTitle">{telegramProfile.connected ? "Telegram подключён" : "Привязать Telegram"}</h3>
            <p className={styles.intro}>
              {telegramProfile.connected
                ? `${telegramProfile.displayName || `@${telegramProfile.username || "telegram"}`} ${telegramProfile.username ? `· @${telegramProfile.username}` : ""}`
                : "Войди через Telegram, чтобы получать уведомления от тренера."}
            </p>
          </div>
        </div>

        {!telegramProfile.connected && (
          <>
            <div className={styles.preview}>
              <div className={styles.previewIcon}><Send size={22} strokeWidth={2} aria-hidden="true" /></div>
              <div>
                <strong>Tren AI Coach</strong>
                <span>Без ручного ввода username. Всё привяжется через Telegram.</span>
              </div>
            </div>

            <div className={styles.loginWidgetCard} data-testid="profile-telegram-widget-card">
              <div ref={loginContainerRef} className={styles.loginWidget} />
              {!loginWidgetReady && (
                <div className={styles.widgetLoading} data-testid="profile-telegram-widget-loading">
                  Загружаю Telegram Login...
                </div>
              )}
            </div>

            <button
              type="button"
              className={styles.primaryButton}
              data-testid="profile-telegram-check"
              onClick={onCheckLogin}
              disabled={linking}
            >
              {linking ? "Проверяю..." : "Проверить подключение"}
            </button>
          </>
        )}

        {telegramProfile.connected && (
          <div className={styles.manageActions} data-testid="profile-telegram-actions">
            <button type="button" className={styles.actionButton} data-testid="profile-telegram-change" onClick={onChangeTelegram}>
              Изменить Telegram
            </button>

            <button type="button" className={`${styles.actionButton} ${styles.dangerButton}`} data-testid="profile-telegram-disconnect" onClick={onDisconnect}>
              Отключить
            </button>
          </div>
        )}

        {status && (
          <div className={styles.status} data-testid="profile-telegram-status">
            <span>{status}</span>
          </div>
        )}

        <button type="button" className={styles.secondaryButton} data-testid="profile-telegram-dismiss" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
