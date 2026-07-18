import styles from "./ProfileMeasurementsModal.module.css";

export default function ProfileMeasurementsModal({
  open,
  latestMeasurement,
  measurementFields,
  formatMeasurementDate,
  getMeasurementValue,
  onClose,
  onStart,
  onOpenPhotos
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      data-css-module-scope="profile-measurements-modal"
      data-testid="profile-measurements-overlay"
      role="presentation"
      onClick={onClose}
    >
      <section
        className={`${styles.dialog}${onOpenPhotos ? ` ${styles.bodyControlDialog}` : ""}`}
        data-testid="profile-measurements-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="profileMeasurementsModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header} data-testid="profile-measurements-header">
          <div>
            <span>КОНТРОЛЬ ТЕЛА</span>
            <h2 id="profileMeasurementsModalTitle">Последний замер</h2>
            <small>{latestMeasurement ? formatMeasurementDate(latestMeasurement) : "Замеров пока нет"}</small>
          </div>
          <button
            className={styles.closeButton}
            data-testid="profile-measurements-close"
            type="button"
            aria-label="Закрыть замеры"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {onOpenPhotos && (
          <div className={styles.bodyControlTabs} data-testid="profile-measurements-section-tabs" role="tablist" aria-label="Контроль тела">
            <button
              type="button"
              role="tab"
              aria-selected="false"
              onClick={onOpenPhotos}
            >
              Фото прогресса
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="true"
              className={styles.active}
            >
              Замеры
            </button>
          </div>
        )}

        <div className={styles.summary} data-testid="profile-measurements-summary">
          <span aria-hidden="true">⚖️</span>
          <p>Быстрый контроль веса и объёмов тела</p>
        </div>

        {latestMeasurement ? (
          <div className={styles.grid} data-testid="profile-measurements-grid">
            {measurementFields.map((field) => {
              const value = getMeasurementValue(latestMeasurement, field);

              return (
                <div data-testid="profile-measurements-cell" key={field.id} aria-label={`${field.label}: ${value}`}>
                  <span>{field.label}</span>
                  <strong>{value}</strong>
                  <small>{field.unit}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty} data-testid="profile-measurements-empty">
            Сделай первый контрольный замер, чтобы отслеживать изменения тела.
          </p>
        )}

        <button
          type="button"
          className={styles.startButton}
          data-testid="profile-measurements-start"
          aria-label="Начать новый замер тела"
          onClick={onStart}
        >
          📏 Начать замер
        </button>
      </section>
    </div>
  );
}
