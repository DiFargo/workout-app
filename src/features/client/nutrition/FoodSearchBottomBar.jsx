import styles from "./FoodSearchBottomBar.module.css";

export default function FoodSearchBottomBar({
  createChoiceOpen,
  searchTab,
  onBack,
  onSearch,
  onCreate,
  onMyProducts
}) {
  const searchActive = !createChoiceOpen && searchTab !== "my";
  const createActive = createChoiceOpen;
  const myProductsActive = !createChoiceOpen && searchTab === "my";

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
        <span>←</span>
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
        <span>⌕</span>
        <strong>Поиск</strong>
      </button>

      <button
        type="button"
        className={`${styles.button} ${createActive ? styles.active : ""}`}
        data-css-module-control="food-search-bottom-bar-action"
        data-food-search-action="create"
        aria-pressed={createActive}
        onClick={onCreate}
      >
        <span>＋</span>
        <strong>Создать</strong>
      </button>

      <button
        type="button"
        className={`${styles.button} ${myProductsActive ? styles.active : ""}`}
        data-css-module-control="food-search-bottom-bar-action"
        data-food-search-action="my-products"
        aria-pressed={myProductsActive}
        onClick={onMyProducts}
      >
        <span>▣</span>
        <strong>Мои</strong>
      </button>
    </div>
  );
}
