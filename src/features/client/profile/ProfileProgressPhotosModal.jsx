import { Camera } from "lucide-react";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import ProfileModalCloseButton from "./ProfileModalCloseButton";
import styles from "./ProfileProgressPhotosModal.module.css";

const PROGRESS_PHOTO_STEPS = [
  ["front", "01", "Спереди"],
  ["side", "02", "Сбоку"],
  ["back", "03", "Со спины"]
];

const COMPARE_SLOTS = [
  ["Раньше", 0],
  ["Позже", 1]
];

export default function ProfileProgressPhotosModal({
  open,
  uploading,
  latestPhoto,
  photos = [],
  files,
  previews,
  status,
  compareIds,
  compareViews,
  compareView,
  activeCompareView,
  selectedBefore,
  selectedAfter,
  canSave,
  formatPhotoDate,
  onClose,
  onSelectPhoto,
  onCompareIdsChange,
  onCompareViewChange,
  onSave,
  onOpenMeasurements
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      data-css-module-scope="profile-progress-photos"
      data-testid="profile-progress-photos-overlay"
      role="presentation"
      onClick={() => !uploading && onClose()}
    >
      <section
        className={`${styles.dialog}${onOpenMeasurements ? ` ${styles.bodyControlDialog}` : ""}`}
        data-testid="profile-progress-photos-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="profileProgressPhotosTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <ClientPageHeader
          compact
          embedded
          controlsVariant="workout"
          className={styles.header}
          title="Фото прогресса"
          titleId="profileProgressPhotosTitle"
          testId="profile-progress-photos-header"
          scope="profile-progress-photos-header"
          actions={(
            <ProfileModalCloseButton
              testId="profile-progress-photos-close"
              ariaLabel="Закрыть фото прогресса"
              disabled={uploading}
              onClick={onClose}
            />
          )}
        />

        {onOpenMeasurements && (
          <div className={styles.bodyControlTabs} data-testid="profile-progress-photos-section-tabs" role="tablist" aria-label="Контроль тела">
            <button
              type="button"
              role="tab"
              aria-selected="true"
              className={styles.active}
            >
              Фото прогресса
            </button>
            <button
              type="button"
              role="tab"
              aria-selected="false"
              onClick={onOpenMeasurements}
            >
              Замеры
            </button>
          </div>
        )}

        <div className={styles.body} data-testid="profile-progress-photos-body">
          <div className={styles.intro} data-testid="profile-progress-photos-intro">
            <i aria-hidden="true"><Camera size={20} strokeWidth={2} /></i>
            <p>Встань в полный рост, используй одинаковое освещение и держи камеру на одном уровне.</p>
          </div>

          {latestPhoto && (
            <div className={styles.latest} data-testid="profile-progress-photos-latest">
              <div>
                <span>ПОСЛЕДНЯЯ ФОТОСЕССИЯ</span>
                <strong>
                  {new Date(`${latestPhoto.date || latestPhoto.createdAt?.slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU")}
                </strong>
              </div>
              <div>
                {[
                  latestPhoto.frontUrl,
                  latestPhoto.sideUrl,
                  latestPhoto.backUrl
                ].filter(Boolean).map((url, index) => (
                  <img key={`${index}_${url}`} src={url} alt="" loading="lazy" />
                ))}
              </div>
            </div>
          )}

          <div className={styles.steps} data-testid="profile-progress-photos-steps">
            {PROGRESS_PHOTO_STEPS.map(([view, number, label]) => (
              <label
                className={files[view] ? styles.selected : undefined}
                data-photo-view={view}
                data-testid="profile-progress-photo-step"
                key={view}
              >
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label={`Добавить фото: ${label}`}
                  disabled={uploading}
                  onChange={(event) => onSelectPhoto(view, event.target.files?.[0] || null)}
                />
                {previews[view] ? (
                  <img src={previews[view]} alt={`Фото ${label.toLowerCase()}`} />
                ) : (
                  <i aria-hidden="true">{number}</i>
                )}
                <span>
                  <strong>{label}</strong>
                  <small>{files[view] ? "Готово · нажми, чтобы заменить" : "Нажми, чтобы сделать фото"}</small>
                </span>
                <em>{files[view] ? "✓" : "+"}</em>
              </label>
            ))}
          </div>

          {status && (
            <p
              className={`${styles.status}${status.includes("сохранены") ? ` ${styles.success}` : ""}`}
              data-testid="profile-progress-photos-status"
            >
              {status}
            </p>
          )}

          {selectedBefore && selectedAfter && (
            <details className={styles.compare} data-testid="profile-progress-photos-compare">
              <summary className={styles.compareHeader} data-testid="profile-progress-photos-compare-toggle">
                <span>
                  <strong>Сравнить фотосессии</strong>
                  <small>
                    {formatPhotoDate(selectedBefore)}
                    {" → "}
                    {formatPhotoDate(selectedAfter)}
                  </small>
                </span>
                <i aria-hidden="true">⌄</i>
              </summary>

              <div className={styles.compareContent} data-testid="profile-progress-photos-compare-content">
                <div className={styles.compareControls}>
                  {COMPARE_SLOTS.map(([label, slot]) => (
                    <label key={slot}>
                      <span>{label}</span>
                      <select
                        aria-label={`Выбрать фотосессию: ${label.toLowerCase()}`}
                        value={compareIds[slot]}
                        onChange={(event) => onCompareIdsChange(slot, event.target.value)}
                      >
                        {photos.map((photo) => (
                          <option
                            key={photo.id}
                            value={photo.id}
                            disabled={compareIds[slot === 0 ? 1 : 0] === photo.id}
                          >
                            {formatPhotoDate(photo)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                <div className={styles.compareTabs} data-testid="profile-progress-photos-compare-tabs" role="tablist" aria-label="Ракурс фотографии">
                  {compareViews.map((view) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={compareView === view.id}
                      aria-pressed={compareView === view.id}
                      className={compareView === view.id ? styles.active : undefined}
                      data-compare-view={view.id}
                      onClick={() => onCompareViewChange(view.id)}
                      key={view.id}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>

                <div className={styles.compareStage} data-testid="profile-progress-photos-compare-stage">
                  {[
                    ["Раньше", selectedBefore],
                    ["Позже", selectedAfter]
                  ].map(([label, photo]) => (
                    <figure key={`${label}_${photo?.id || ""}`}>
                      <figcaption>
                        <span>{label}</span>
                        <strong>{formatPhotoDate(photo)}</strong>
                      </figcaption>
                      {photo?.[activeCompareView.urlKey] ? (
                        <img
                          src={photo[activeCompareView.urlKey]}
                          alt={`${activeCompareView.label}: ${label.toLowerCase()}`}
                          loading="lazy"
                        />
                      ) : (
                        <div className={styles.compareMissing}>Нет фото</div>
                      )}
                    </figure>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>

        <button
          type="button"
          className={styles.saveButton}
          data-testid="profile-progress-photos-save"
          disabled={uploading || !canSave}
          onClick={onSave}
        >
          {uploading ? "Загружаю фото..." : "Сохранить фото"}
        </button>
      </section>
    </div>
  );
}
