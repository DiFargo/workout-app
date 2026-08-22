import { ChevronLeft, Package, Search } from "lucide-react";
import styles from "./FoodSearchBottomBar.module.css";

export default function FoodSearchBottomBar({
  searchTab,
  onBack,
  onSearch,
  onMyProducts
}) {
  const searchActive = searchTab !== "my";
  const myProductsActive = searchTab === "my";

  return (
    <div
      className={styles.root}
      data-css-module-scope="food-search-bottom-bar"
      data-testid="food-search-bottom-bar"
    >
      <button
        type="button"
        className={styles.button}
        data-css-module-control="food-search-bottom-bar-action"
        data-food-search-action="back"
        onClick={onBack}
        aria-label="Назад к питанию"
      >
        <span aria-hidden="true"><ChevronLeft /></span>
        <strong>Назад</strong>
      </button>

      <button
        type="button"
        className={`${styles.button} ${searchActive ? styles.active : ""}`}
        data-css-module-control="food-search-bottom-bar-action"
        data-food-search-action="search"
        aria-pressed={searchActive}
        onClick={onSearch}
      >
        <span aria-hidden="true"><Search /></span>
        <strong>Поиск</strong>
      </button>

      <button
        type="button"
        className={`${styles.button} ${myProductsActive ? styles.active : ""}`}
        data-css-module-control="food-search-bottom-bar-action"
        data-food-search-action="my-products"
        aria-pressed={myProductsActive}
        onClick={onMyProducts}
      >
        <span aria-hidden="true"><Package /></span>
        <strong>Мои</strong>
      </button>
    </div>
  );
}
