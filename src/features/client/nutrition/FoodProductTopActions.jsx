import { X } from "lucide-react";
import styles from "./FoodProductTopActions.module.css";

export default function FoodProductTopActions({
  onClose
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
