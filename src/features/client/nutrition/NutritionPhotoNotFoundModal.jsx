import styles from "./NutritionPhotoNotFoundModal.module.css";

export default function NutritionPhotoNotFoundModal({
  open,
  onClose,
  onRetry,
  onAddManually
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      data-css-module-scope="nutrition-photo-not-found"
      data-testid="nutrition-photo-not-found-overlay"
      role="presentation"
    >
      <section
        className={styles.modal}
        data-testid="nutrition-photo-not-found-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nutritionPhotoNotFoundTitle"
      >
        <button
          type="button"
          className={styles.closeButton}
          data-testid="nutrition-photo-not-found-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>

        <div className={styles.icon} aria-hidden="true">⌕</div>
        <h3 className={styles.title} id="nutritionPhotoNotFoundTitle">Продукт не распознан</h3>
        <p className={styles.description}>Попробуй сделать более чёткое фото или добавь данные продукта самостоятельно.</p>

        <div className={styles.actions}>
          <button className={styles.actionButton} type="button" onClick={onRetry}>
            <span aria-hidden="true">📷</span>
            Сфотографировать ещё раз
          </button>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.primaryAction}`}
            onClick={onAddManually}
          >
            <span aria-hidden="true">＋</span>
            Добавить вручную
          </button>
        </div>
      </section>
    </div>
  );
}
