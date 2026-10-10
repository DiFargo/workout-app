import { Search } from "lucide-react";
import { useState } from "react";
import { GEMINI_ONLY_FOOD_SEARCH } from "../../../utils/nutritionSearchMode";
import styles from "./FoodSearchInput.module.css";

export default function FoodSearchInput({
  value,
  onChange,
  onReset,
  variant = "search",
  loading = false,
  onRetry
}) {
  const isMyProducts = variant === "my-products";
  const gemini = GEMINI_ONLY_FOOD_SEARCH && !isMyProducts;
  const [draft, setDraft] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setDraft(value);
  }
  const submit = () => {
    if (loading || draft.trim().length < 2) return;
    if (draft.trim() === value.trim() && onRetry) onRetry();
    else onChange(draft.trim());
  };
  const inputId = isMyProducts ? "my-foods-search" : "nutrition-food-search";
  const searchLabel = isMyProducts
    ? "Поиск в моей базе продуктов"
    : "Поиск еды, бренда или блюда";

  return (
    <div
      className={`${styles.root} ${isMyProducts ? styles.myProducts : styles.search} ${gemini ? styles.gemini : ""}`}
      data-css-module-scope="food-search-input"
      data-testid="food-search-input"
      role="search"
    >
      <label className={styles.visuallyHidden} htmlFor={inputId}>{searchLabel}</label>
      <span className={styles.searchIcon} aria-hidden="true"><Search /></span>
      <input
        id={inputId}
        className={styles.input}
        data-css-module-control="food-search-input"
        type="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        inputMode="search"
        enterKeyHint="search"
        value={gemini ? draft : value}
        onChange={(event) => gemini ? setDraft(event.target.value) : onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (gemini) submit();
            event.currentTarget.blur();
          }
        }}
        placeholder="Поиск еды, бренда или блюда..."
      />
      {(gemini ? draft : value) && (
        <button
          className={styles.clearButton}
          type="button"
          onClick={() => { setDraft(""); onReset(); }}
          aria-label="Сбросить поиск"
        >
          ×
        </button>
      )}
      {gemini && <button type="button" className={styles.submitButton} disabled={loading || draft.trim().length < 2} onClick={submit}>Найти</button>}
    </div>
  );
}
