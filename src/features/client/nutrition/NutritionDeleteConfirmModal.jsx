import { createPortal } from "react-dom";

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
    <div className="nutritionDeleteConfirmOverlay" role="dialog" aria-modal="true" aria-labelledby="nutrition-delete-title">
      <button
        type="button"
        className="nutritionDeleteConfirmBackdrop"
        onClick={onCancel}
        aria-label="Отменить удаление"
      />
      <section className="nutritionDeleteConfirmCard">
        <button
          type="button"
          className="nutritionDeleteConfirmClose"
          onClick={onCancel}
          aria-label="Закрыть"
        >
          ×
        </button>
        <span aria-hidden="true">⌫</span>
        <h2 id="nutrition-delete-title">Удалить из моей базы?</h2>
        <p>
          «{foodName || "Продукт"}» будет удалён без возможности восстановления.
        </p>
        <div>
          <button type="button" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            Удалить
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
