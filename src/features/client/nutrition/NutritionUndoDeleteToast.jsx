import styles from "./NutritionUndoDeleteToast.module.css";

export default function NutritionUndoDeleteToast({
  open,
  onRestore
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.toast}
      data-css-module-scope="nutrition-undo-delete"
      data-testid="nutrition-undo-toast"
      role="status"
    >
      <span className={styles.message}>Продукт удалён</span>
      <button
        className={styles.restoreButton}
        data-testid="nutrition-undo-restore"
        type="button"
        onClick={onRestore}
      >
        Вернуть
      </button>
    </div>
  );
}
