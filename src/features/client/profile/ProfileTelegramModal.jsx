import { Send } from "lucide-react";
import { useRef, useState } from "react";
import { useModalBackNavigation } from "../../../shared/hooks/useModalBackNavigation.js";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import ProfileModalCloseButton from "./ProfileModalCloseButton";
import styles from "./ProfileTelegramModal.module.css";

export default function ProfileTelegramModal(props) {
  return props.open ? <ProfileTelegramSheet {...props} /> : null;
}

function ProfileTelegramSheet({
  telegramProfile,
  botLinkUrl = "",
  linking,
  status,
  onAvatarError,
  onClose,
  onCheckLogin,
  onStartLink,
  onOpenBotLink,
  onChangeTelegram,
  onCancelChange,
  onOpenRecoveryEmail,
  onDisconnect
}) {
  const [replacement, setReplacement] = useState(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const pendingDisconnect = useRef(false);
  const identity = `${telegramProfile.telegramUserId || telegramProfile.chatId || telegramProfile.username || "connected"}:${telegramProfile.connectedAt || ""}`;
  const replacing = Boolean(replacement && telegramProfile.connected && replacement.identity === identity);
  const cancelReplacement = () => { setReplacement(null); onCancelChange?.(); };
  const close = () => {
    if (linking || pendingDisconnect.current) return;
    if (disconnectConfirm) setDisconnectConfirm(false);
    else if (replacing) cancelReplacement();
    else onClose?.();
  };
  useModalBackNavigation({ open: true, onBack: close });
  const confirmDisconnect = async () => {
    if (linking || pendingDisconnect.current) return;
    pendingDisconnect.current = true;
    try {
      if (await onDisconnect?.() === true) { setDisconnectConfirm(false); setReplacement(null); }
    } finally { pendingDisconnect.current = false; }
  };
  const displayedStatus = replacing && status === "Telegram подключён в профиле."
    ? "В профиле пока подключён прежний Telegram. Подтверди новую ссылку в боте и повтори проверку."
    : status;

  return (
    <div className={styles.overlay} data-modal-backdrop="true" data-testid="profile-telegram-overlay" role="presentation" onClick={close}>
      <div
        className={styles.dialog}
        data-css-module-scope="profile-telegram-modal"
        data-testid="profile-telegram-dialog"
        role={disconnectConfirm ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-busy={Boolean(linking)}
        data-modal-surface="true"
        data-cabinet-sheet="true"
        aria-labelledby="profileTelegramManageTitle"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}
      >
        <ClientPageHeader
          compact
          embedded
          controlsVariant="workout"
          className={styles.header}
          title={disconnectConfirm ? "Отключить Telegram?" : replacing ? "Заменить Telegram" : telegramProfile.connected ? "Telegram подключён" : "Привязать Telegram"}
          titleId="profileTelegramManageTitle"
          scope="profile-telegram-header"
          actions={(
            <ProfileModalCloseButton
              testId="profile-telegram-close"
              ariaLabel="Закрыть Telegram"
              onClick={close}
              disabled={linking}
            />
          )}
        />

        {telegramProfile.connected && <div className={styles.head}>
          <div className={styles.avatar}>
            {telegramProfile.avatarUrl ? <img src={telegramProfile.avatarUrl} alt="" onError={onAvatarError} /> : <span className={styles.avatarFallback}><Send size={25} strokeWidth={1.9} aria-hidden="true" /></span>}
          </div>
          <div>
            <p className={styles.intro}>
              {telegramProfile.connected
                ? `${telegramProfile.displayName || `@${telegramProfile.username || "telegram"}`} ${telegramProfile.username ? `· @${telegramProfile.username}` : ""}`
                : "Войди через Telegram, чтобы получать уведомления от тренера."}
            </p>
          </div>
        </div>}

        {disconnectConfirm ? <section className={styles.confirmation}>
          <p>Вход через этот Telegram и уведомления бота перестанут работать. Тренировки, питание и история останутся в аккаунте.</p>
          <p>Перед отключением проверь, что можешь войти через Google или личную почту с паролем. Если другого способа нет, сначала добавь почту в настройках аккаунта. Наличие почты само по себе не подтверждает пароль.</p>
          {typeof onOpenRecoveryEmail === "function" ? <button type="button" className={styles.secondaryButton} disabled={linking} onClick={() => { setDisconnectConfirm(false); onOpenRecoveryEmail(); }}>Проверить почту для входа</button> : null}
          <button type="button" className={`${styles.actionButton} ${styles.dangerButton}`} disabled={linking} onClick={confirmDisconnect}>{linking ? "Отключаю…" : "Подтвердить отключение"}</button>
          <button type="button" className={styles.secondaryButton} disabled={linking} onClick={() => setDisconnectConfirm(false)}>Отмена</button>
        </section> : null}

        {(!telegramProfile.connected || replacing) && !disconnectConfirm && (
          <>
            <div className={styles.preview}>
              <div className={styles.previewIcon}><Send size={22} strokeWidth={2} aria-hidden="true" /></div>
              <div>
                <strong>ZMENA в Telegram</strong>
                <span>{replacing ? "Прежний Telegram остаётся подключённым до подтверждения нового. Можно отменить замену без отключения." : "Подключи бота к этому аккаунту, чтобы входить через Telegram и получать уведомления."}</span>
              </div>
            </div>

            {botLinkUrl ? (
              <>
                <ol className={styles.steps} data-testid="profile-telegram-instructions">
                  <li>Открой бота и нажми Start.</li>
                  <li>Вернись сюда — проверим подключение.</li>
                </ol>
                <a
                  className={styles.primaryButton}
                  data-testid="profile-telegram-open-bot"
                  href={linking ? undefined : botLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={linking || undefined}
                  tabIndex={linking ? -1 : undefined}
                  onClick={(event) => {
                    if (linking) event.preventDefault();
                    else onOpenBotLink?.(event);
                  }}
                >
                  Открыть бота
                </a>
                <p className={styles.linkHint}>Ссылка действует 10 минут. Если срок истёк, создай новую.{replacing ? " Отмена закроет этот шаг, но не отзовёт уже открытую ссылку: не подтверждай её в боте, если передумал менять Telegram." : ""}</p>
              </>
            ) : (
              <button
                type="button"
                className={styles.primaryButton}
                data-testid="profile-telegram-start"
                onClick={onStartLink}
                disabled={linking}
              >
                {linking ? "Создаю ссылку…" : "Подключить через бота"}
              </button>
            )}

            <button
              type="button"
              className={styles.secondaryButton}
              data-testid="profile-telegram-check"
              onClick={onCheckLogin}
              disabled={linking}
            >
              {linking ? "Проверяю..." : "Проверить подключение"}
            </button>
            {botLinkUrl && (
              <button type="button" className={styles.textButton} data-testid="profile-telegram-renew" onClick={onStartLink} disabled={linking}>
                Создать новую ссылку
              </button>
            )}
          </>
        )}

        {replacing ? <button type="button" className={styles.secondaryButton} disabled={linking} onClick={cancelReplacement}>Отменить замену</button> : null}

        {telegramProfile.connected && !replacing && !disconnectConfirm && (
          <div className={styles.manageActions} data-testid="profile-telegram-actions">
            <button type="button" className={styles.actionButton} data-testid="profile-telegram-change" onClick={() => { setReplacement({ identity }); onChangeTelegram?.(); }} disabled={linking}>
              Изменить Telegram
            </button>

            <button type="button" className={`${styles.actionButton} ${styles.dangerButton}`} data-testid="profile-telegram-disconnect" onClick={() => setDisconnectConfirm(true)} disabled={linking}>
              Отключить
            </button>
          </div>
        )}

        {displayedStatus && (
          <div className={styles.status} data-testid="profile-telegram-status" role="status" aria-live="polite" aria-atomic="true">
            <span>{displayedStatus}</span>
          </div>
        )}

        <button type="button" className={styles.secondaryButton} data-testid="profile-telegram-dismiss" onClick={close} disabled={linking}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
