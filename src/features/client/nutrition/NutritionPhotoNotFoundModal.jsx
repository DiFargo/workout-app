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
    <div className="nutritionPhotoNotFoundOverlay" role="presentation">
      <section
        className="nutritionPhotoNotFoundModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nutritionPhotoNotFoundTitle"
      >
        <button
          type="button"
          className="nutritionPhotoNotFoundClose"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>

        <div className="nutritionPhotoNotFoundIcon" aria-hidden="true">⌕</div>
        <h3 id="nutritionPhotoNotFoundTitle">Продукт не распознан</h3>
        <p>Попробуй сделать более чёткое фото или добавь данные продукта самостоятельно.</p>

        <div className="nutritionPhotoNotFoundActions">
          <button type="button" onClick={onRetry}>
            <span aria-hidden="true">📷</span>
            Сфотографировать ещё раз
          </button>
          <button
            type="button"
            className="primary"
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
