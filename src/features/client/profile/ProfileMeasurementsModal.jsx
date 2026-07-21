import { Ruler, Scale } from "lucide-react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import ProfileModalCloseButton from "./ProfileModalCloseButton";
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
        <ClientPageHeader
          compact
          embedded
          controlsVariant="workout"
          className={styles.header}
          title="Замеры тела"
          titleId="profileMeasurementsModalTitle"
          testId="profile-measurements-header"
          scope="profile-measurements-header"
          actions={(
            <ProfileModalCloseButton
              testId="profile-measurements-close"
              ariaLabel="Закрыть замеры"
              onClick={onClose}
            />
          )}
        />

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
          <span aria-hidden="true"><Scale size={20} strokeWidth={2} /></span>
          <p>{latestMeasurement ? `Последний замер: ${formatMeasurementDate(latestMeasurement)}` : "Быстрый контроль веса и объёмов тела"}</p>
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
          <Ruler size={18} strokeWidth={2.1} aria-hidden="true" />
          Начать замер
        </button>
      </section>
    </div>
  );
}
