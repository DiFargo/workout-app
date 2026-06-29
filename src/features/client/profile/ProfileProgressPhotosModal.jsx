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
  onSave
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="cabinetProgressPhotosOverlay"
      role="presentation"
      onClick={() => !uploading && onClose()}
    >
      <section
        className="cabinetProgressPhotosModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cabinetProgressPhotosTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cabinetProgressPhotosHead">
          <div>
            <span>КОНТРОЛЬ ТЕЛА</span>
            <h2 id="cabinetProgressPhotosTitle">Фото прогресса</h2>
            <small>Спереди · сбоку · со спины</small>
          </div>
          <button
            type="button"
            aria-label="Закрыть фото прогресса"
            disabled={uploading}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="cabinetProgressPhotosBody">
          <div className="cabinetProgressPhotosIntro">
            <i aria-hidden="true">📷</i>
            <p>Встань в полный рост, используй одинаковое освещение и держи камеру на одном уровне.</p>
          </div>

          {latestPhoto && (
            <div className="cabinetProgressPhotosLatest">
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
                ].filter(Boolean).map((url) => (
                  <img key={url} src={url} alt="" loading="lazy" />
                ))}
              </div>
            </div>
          )}

          <div className="cabinetProgressPhotoSteps">
            {PROGRESS_PHOTO_STEPS.map(([view, number, label]) => (
              <label className={files[view] ? "selected" : ""} key={view}>
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
            <p className={status.includes("сохранены") ? "cabinetProgressPhotoStatus success" : "cabinetProgressPhotoStatus"}>
              {status}
            </p>
          )}

          {selectedBefore && selectedAfter && (
            <details className="cabinetProgressPhotosCompare">
              <summary className="cabinetProgressPhotosCompareHead">
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

              <div className="cabinetProgressPhotosCompareContent">
                <div className="cabinetProgressPhotosCompareControls">
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

                <div className="cabinetProgressPhotosCompareTabs" role="tablist" aria-label="Ракурс фотографии">
                  {compareViews.map((view) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={compareView === view.id}
                      aria-pressed={compareView === view.id}
                      className={compareView === view.id ? "active" : ""}
                      onClick={() => onCompareViewChange(view.id)}
                      key={view.id}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>

                <div className="cabinetProgressPhotosCompareStage">
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
                        <div className="cabinetProgressPhotosCompareMissing">Нет фото</div>
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
          className="cabinetProgressPhotosSave"
          disabled={uploading || !canSave}
          onClick={onSave}
        >
          {uploading ? "Загружаю фото..." : "Сохранить фото"}
        </button>
      </section>
    </div>
  );
}
