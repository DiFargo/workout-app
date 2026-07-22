import { Bell, MessageCircle, X } from "lucide-react";
import styles from "./TrainerClientContactModal.module.css";

export default function TrainerClientContactModal({
  clientName,
  telegramAvailable = false,
  onOpenTelegram,
  onOpenNotification,
  onRequestClose
}) {
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onRequestClose();
    }}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trainer-client-contact-title"
        data-testid="trainer-client-contact-dialog"
      >
        <header className={styles.header}>
          <div>
            <span>СВЯЗЬ С КЛИЕНТОМ</span>
            <h2 id="trainer-client-contact-title">{clientName}</h2>
            <p>Выберите удобный способ отправить сообщение.</p>
          </div>
          <button type="button" onClick={onRequestClose} aria-label="Закрыть выбор способа связи">
            <X size={18} />
          </button>
        </header>

        <div className={styles.options}>
          <button
            className={styles.option}
            data-testid="trainer-client-contact-telegram"
            type="button"
            disabled={!telegramAvailable}
            onClick={onOpenTelegram}
          >
            <i className={styles.telegramIcon} aria-hidden="true"><MessageCircle size={21} /></i>
            <span>
              <strong>Написать в Telegram</strong>
              <small>{telegramAvailable ? "Откроется личный чат с клиентом" : "Telegram у клиента не подключён"}</small>
            </span>
          </button>

          <button
            className={styles.option}
            data-testid="trainer-client-contact-notification"
            type="button"
            onClick={onOpenNotification}
          >
            <i className={styles.notificationIcon} aria-hidden="true"><Bell size={21} /></i>
            <span>
              <strong>Уведомление в приложении</strong>
              <small>Появится у клиента в колокольчике</small>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
