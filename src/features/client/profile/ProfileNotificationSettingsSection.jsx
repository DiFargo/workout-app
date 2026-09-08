import { useRef, useState } from "react";
import { Bell, Check, Send } from "lucide-react";
import styles from "./ProfileNotificationSettingsSection.module.css";

export default function ProfileNotificationSettingsSection({ telegramProfile, onToggleNotifications, onOpenConnections }) {
  const [saveState, setSaveState] = useState("");
  const pending = useRef(false);
  const connected = telegramProfile?.connected === true;
  const enabled = connected && telegramProfile.notificationsEnabled !== false;

  async function toggle() {
    if (!connected || !onToggleNotifications || pending.current) return;
    pending.current = true;
    setSaveState("saving");
    try {
      const saved = await onToggleNotifications(!enabled);
      setSaveState(saved === true ? "saved" : "error");
    } catch {
      setSaveState("error");
    } finally {
      pending.current = false;
    }
  }

  return <section className={styles.root} data-testid="profile-notification-settings">
    <p className={styles.caption}>Напоминания</p>
    <div className={styles.card}>
      <button type="button" role="switch" aria-checked={enabled} aria-label="Напоминания в Telegram"
        aria-describedby="telegram-reminders-help" aria-busy={saveState === "saving"}
        className={styles.setting} data-testid="profile-settings-notifications-toggle"
        disabled={!connected || !onToggleNotifications || saveState === "saving"} onClick={toggle}>
        <span className={styles.icon}><Bell size={20} aria-hidden="true" /></span>
        <span className={styles.copy}><strong>Напоминания в Telegram</strong><small>Тренировки, замеры и фото прогресса</small></span>
        <span className={styles.toggle} aria-hidden="true"><span /></span>
      </button>
      <div className={styles.connection}>
        <Send size={16} aria-hidden="true" />
        <span>{connected ? "Telegram подключён" : "Telegram не подключён"}</span>
        {connected && <Check size={16} className={styles.check} aria-hidden="true" />}
      </div>
    </div>
    <p id="telegram-reminders-help" className={styles.help}>{connected
      ? "Напоминания приходят по вашему расписанию. Их можно отключить, сохранив подключение Telegram."
      : "Чтобы получать напоминания, сначала подключите Telegram в разделе «Подключение аккаунтов»."}</p>
    {!connected && onOpenConnections && <button type="button" className={styles.link} onClick={onOpenConnections}>Перейти к подключению аккаунтов</button>}
    {connected && <p className={styles.help}>Сообщения от тренера и уведомления внутри приложения остаются доступными.</p>}
    {saveState && <p className={`${styles.status} ${saveState === "error" ? styles.error : ""}`}
      role={saveState === "error" ? "alert" : "status"}>
      {saveState === "saving" ? "Сохраняем…" : saveState === "error"
        ? "Не удалось сохранить. Проверьте соединение и попробуйте переключить ещё раз."
        : enabled ? "Напоминания включены" : "Напоминания отключены"}
    </p>}
  </section>;
}
