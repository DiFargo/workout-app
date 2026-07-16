import styles from "./FoodProductTopActions.module.css";

export default function FoodProductTopActions({
  canDelete,
  onDelete,
  onEdit
}) {
  return (
    <div
      className={styles.root}
      aria-label="Действия с продуктом"
      data-css-module-scope="food-product-top-actions"
      data-testid="food-product-top-actions"
    >
      <button
        type="button"
        className={styles.action}
        data-css-module-control="food-product-top-action"
        data-food-product-top-action="delete"
        disabled={!canDelete}
        onClick={onDelete}
        aria-label="Удалить продукт"
        title="Удалить"
      >
        <span className={styles.icon} aria-hidden="true" data-css-module-text="food-product-top-action">🗑</span>
      </button>

      <button
        type="button"
        className={styles.action}
        data-css-module-control="food-product-top-action"
        data-food-product-top-action="edit"
        onClick={onEdit}
        aria-label="Редактировать продукт"
        title="Редактировать"
      >
        <span
          className={`${styles.icon} ${styles.editIcon}`}
          aria-hidden="true"
          data-css-module-text="food-product-top-action"
        >
          ✎
        </span>
      </button>
    </div>
  );
}
