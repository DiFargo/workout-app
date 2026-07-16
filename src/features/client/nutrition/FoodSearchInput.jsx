import styles from "./FoodSearchInput.module.css";

export default function FoodSearchInput({
  value,
  onChange,
  onReset,
  variant = "search"
}) {
  const isMyProducts = variant === "my-products";

  return (
    <div
      className={`${styles.root} ${isMyProducts ? styles.myProducts : styles.search}`}
      data-css-module-scope="food-search-input"
      data-testid="food-search-input"
    >
      <span className={styles.searchIcon} aria-hidden="true">⌕</span>
      <input
        className={styles.input}
        data-css-module-control="food-search-input"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        placeholder="Поиск еды, бренда или блюда..."
      />
      {value && (
        <button
          className={styles.clearButton}
          type="button"
          onClick={onReset}
          aria-label="Сбросить поиск"
        >
          ×
        </button>
      )}
    </div>
  );
}
