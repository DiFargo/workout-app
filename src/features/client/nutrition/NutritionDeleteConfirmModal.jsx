import { createPortal } from "react-dom";
import styles from "./NutritionDeleteConfirmModal.module.css";

export default function NutritionDeleteConfirmModal({
  open,
  foodName,
  onCancel,
  onConfirm
}) {
  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className={styles.overlay}
      data-css-module-scope="nutrition-delete-confirm"
      data-testid="nutrition-delete-confirm-modal"
      role="dialog"
      aria-modal="true"
      data-modal-surface="true"
      aria-labelledby="nutrition-delete-title"
    >
      <button
        type="button"
        className={styles.backdrop}
        data-testid="nutrition-delete-confirm-backdrop"
        onClick={onCancel}
        aria-label="Отменить удаление"
      />
      <section className={styles.card}>
        <button
          type="button"
          className={styles.closeButton}
          data-testid="nutrition-delete-confirm-close"
          onClick={onCancel}
          aria-label="Закрыть"
        >
          ×
        </button>
        <span className={styles.icon} aria-hidden="true">⌫</span>
        <h2 className={styles.title} id="nutrition-delete-title">Удалить из моей базы?</h2>
        <p className={styles.description}>
          «{foodName || "Продукт"}» будет удалён без возможности восстановления.
        </p>
        <div className={styles.actions}>
          <button className={styles.actionButton} type="button" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className={`${styles.actionButton} ${styles.dangerAction}`} onClick={onConfirm}>
            Удалить
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
