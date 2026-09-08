import { ArrowLeft, Check } from "lucide-react";
import styles from "./FoodProductActionBar.module.css";

export default function FoodProductActionBar({
  hidden,
  onBack,
  onAdd
}) {
  if (hidden) {
    return null;
  }

  const releaseAmountInput = () => {
    const activeElement = document.activeElement;
    if (activeElement?.matches?.("[data-food-amount-input]")) {
      activeElement.blur();
    }
  };

  return (
    <nav
      className={styles.root}
      aria-label="Действия с продуктом"
      data-css-module-scope="food-product-action-bar"
      data-testid="food-product-action-bar"
    >
      <button
        type="button"
        className={styles.button}
        data-css-module-control="food-product-action"
        data-food-product-action="back"
        onClick={onBack}
      >
        <span aria-hidden="true" data-css-module-text="food-product-action"><ArrowLeft /></span>
        <strong data-css-module-text="food-product-action">К поиску</strong>
      </button>

      <button
        type="button"
        className={`${styles.button} ${styles.add}`}
        data-css-module-control="food-product-action"
        data-food-product-action="add"
        onPointerDown={releaseAmountInput}
        onClick={onAdd}
      >
        <span aria-hidden="true" data-css-module-text="food-product-action"><Check /></span>
        <strong data-css-module-text="food-product-action">Добавить</strong>
      </button>
    </nav>
  );
}
