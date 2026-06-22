export default function NutritionCreateChoice({
  open,
  onCreateFood,
  onCreateDish
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="nutritionCreateChoiceOverlay nutritionCreateChoiceScreen">
      <div className="nutritionCreateChoiceSheet">
        <div className="nutritionCreateChoiceHeader">
          <span>Моя база</span>
          <h3>Создать</h3>
          <p>Выбери продукт или блюдо из нескольких ингредиентов.</p>
        </div>

        <div className="nutritionCreateChoiceGrid">
          <button type="button" onClick={onCreateFood}>
            <span>＋</span>
            <strong>Продукт</strong>
            <small>КБЖУ на 100 г или порцию</small>
          </button>

          <button type="button" onClick={onCreateDish}>
            <span>🍲</span>
            <strong>Блюдо</strong>
            <small>Итоговый вес и КБЖУ блюда</small>
          </button>
        </div>
      </div>
    </div>
  );
}
