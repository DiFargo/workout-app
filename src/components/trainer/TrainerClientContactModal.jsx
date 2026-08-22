import { Bell, MessageCircle, X } from "lucide-react";
import { createPortal } from "react-dom";
import styles from "./TrainerClientContactModal.module.css";

export default function TrainerClientContactModal({
  clientName,
  telegramAvailable = false,
  onOpenTelegram,
  onOpenNotification,
  onRequestClose
}) {
  const modal = (
    <div className={styles.backdrop} data-trainer-modal-backdrop="true" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onRequestClose();
    }}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        data-trainer-modal-surface="true"
        data-trainer-modal-frame="true"
        aria-labelledby="trainer-client-contact-title"
        data-testid="trainer-client-contact-dialog"
      >
        <header className={styles.header} data-trainer-modal-header="true">
          <div>
            <span>СВЯЗЬ С КЛИЕНТОМ</span>
            <h2 id="trainer-client-contact-title">{clientName}</h2>
            <p>Выберите удобный способ отправить сообщение.</p>
          </div>
          <button type="button" onClick={onRequestClose} aria-label="Закрыть выбор способа связи">
            <X size={18} />
          </button>
        </header>

        <div className={styles.options} data-trainer-modal-content="true">
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

        <footer className={styles.footer} data-trainer-modal-footer="true">
          <button type="button" onClick={onRequestClose}>Отмена</button>
        </footer>
      </section>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
