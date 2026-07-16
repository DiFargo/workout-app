import { getSearchHistoryName } from "../../../utils/nutritionFoodPresentation";
import styles from "./FoodSearchHistoryNames.module.css";

export default function FoodSearchHistoryNames({
  visible,
  foods,
  onSelect
}) {
  if (!visible || foods.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.root}
      data-css-module-scope="food-search-history-names"
      data-testid="food-search-history-names"
    >
      <div className={styles.title}>История поиска</div>
      <div className={styles.list}>
        {foods.slice(0, 8).map((food, index) => {
          const foodName = getSearchHistoryName(food);
          if (!foodName) return null;

          return (
            <button
              type="button"
              key={`search_history_name_only_${foodName}_${index}`}
              className={styles.button}
              data-css-module-control="food-search-history-name"
              data-history-name-only="true"
              title={foodName}
              onClick={() => onSelect(foodName)}
            >
              <span>{foodName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
