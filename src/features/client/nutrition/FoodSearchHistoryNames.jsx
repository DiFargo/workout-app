import { getSearchHistoryName } from "../../../utils/nutritionFoodPresentation";

export default function FoodSearchHistoryNames({
  visible,
  foods,
  onSelect
}) {
  if (!visible || foods.length === 0) {
    return null;
  }

  return (
    <div className="fatSearchHistoryNames">
      <div className="fatSearchHistoryNamesTitle">История поиска</div>
      <div className="fatSearchHistoryNamesList">
        {foods.slice(0, 8).map((food, index) => {
          const foodName = getSearchHistoryName(food);
          if (!foodName) return null;

          return (
            <button
              type="button"
              key={`search_history_name_only_${foodName}_${index}`}
              className="fatSearchHistoryNameButton"
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
