export default function NutritionMealModal({
  activeMeal,
  foods,
  stats,
  deletingFoodId,
  swipeOffsets,
  swipeMovedRef,
  getFoodIcon,
  onClose,
  onAddFood,
  onEditFood,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  onSwipeCancel
}) {
  if (!activeMeal) return null;

  return (
    <div className="nutritionMealModalOverlay" role="dialog" aria-modal="true" aria-label={activeMeal.name}>
      <button
        type="button"
        className="nutritionMealModalBackdrop"
        onClick={onClose}
        aria-label="Закрыть список продуктов"
      />

      <section className="nutritionMealModalSheet">
        <header className="nutritionMealModalHeader">
          <span className="nutritionMealModalIcon" aria-hidden="true">{activeMeal.icon}</span>
          <div>
            <small>{foods.length} продуктов</small>
            <h2>{activeMeal.name}</h2>
            <strong>{Math.round(stats.calories)} ккал</strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть">×</button>
        </header>

        <div className="nutritionMealModalList">
          {foods.map((item) => (
            <div
              className={`productSwipeShell ${deletingFoodId === item.id ? "deleting" : ""}`}
              key={item.id}
            >
              <div className="productDeleteBg">
                <span>🗑️</span>
              </div>

              <div
                className={`productRowExact ${deletingFoodId === item.id ? "deleting" : ""}`}
                style={{
                  transform: `translateX(${swipeOffsets[item.id] || 0}px)`,
                  opacity: deletingFoodId === item.id ? 0 : 1
                }}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (swipeMovedRef.current[item.id]) return;
                  onEditFood(item);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  onEditFood(item);
                }}
                onTouchStart={(event) => onSwipeStart(item.id, event)}
                onTouchMove={(event) => onSwipeMove(item.id, event)}
                onTouchEnd={(event) => onSwipeEnd(item.id, event)}
                onTouchCancel={() => onSwipeCancel(item.id)}
              >
                <div className="productFoodIconWrap">
                  <span className="productFoodIcon" aria-hidden="true">
                    {item.icon || getFoodIcon(item)}
                  </span>
                  <span className="productFoodCaloriesUnder">
                    {Math.round(Number(item.calories) || 0)}
                    <small>ккал</small>
                  </span>
                </div>

                <div className="productInfoExact">
                  <strong>{item.name}</strong>
                  <span>{item.amount} г</span>
                </div>

                <div className="productArrowExact">›</div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="nutritionMealModalAdd"
          onClick={() => onAddFood(activeMeal.id)}
        >
          <span aria-hidden="true">＋</span>
          Добавить продукт
        </button>
      </section>
    </div>
  );
}
