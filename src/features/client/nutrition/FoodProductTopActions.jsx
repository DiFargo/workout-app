import { Trash2, X } from "lucide-react";
import styles from "./FoodProductTopActions.module.css";

export default function FoodProductTopActions({
  onClose,
  onDelete
}) {
  return (
    <div
      className={styles.root}
      aria-label="Действия с продуктом"
      data-css-module-scope="food-product-top-actions"
      data-testid="food-product-top-actions"
    >
      {onDelete && <button type="button" className={styles.action}
        data-food-product-top-action="delete" onClick={onDelete}
        aria-label="Удалить из моей базы" title="Удалить из моей базы">
        <Trash2 size={20} aria-hidden="true" />
      </button>}
      <button
        type="button"
        className={styles.action}
        data-css-module-control="food-product-top-action"
        data-food-product-top-action="close"
        onClick={onClose}
        aria-label="Закрыть продукт"
        title="Закрыть"
      >
        <X
          className={`${styles.icon} ${styles.closeIcon}`}
          size={22}
          strokeWidth={2.2}
          aria-hidden="true"
          data-css-module-text="food-product-top-action"
        />
      </button>
    </div>
  );
}
