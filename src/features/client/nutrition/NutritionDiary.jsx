export default function NutritionDiary({
  nutritionZoukExpanded,
  nutritionZoukFoodsCount,
  nutritionMeals,
  nutritionToday,
  mealStats,
  expandedNutritionMeals,
  deletingFoodId,
  swipeOffsets = {},
  swipeMovedRef,
  getFoodIcon,
  roundMacro,
  onOpenZouk,
  onCloseZouk,
  onAddMealFood,
  onEditFood,
  onOpenMealFoods,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  onSwipeCancel
}) {
  return (
    <>
      <section className="nutritionZoukBlock">
        <button
          type="button"
          className="nutritionZoukHeader"
          onClick={onOpenZouk}
          aria-expanded={nutritionZoukExpanded}
          aria-haspopup="dialog"
        >
          <span className="nutritionZoukIcon" aria-hidden="true">🍽️</span>
          <span className="nutritionZoukTitle">
            <strong>Дневник</strong>
            <small>Список продуктов за день</small>
          </span>
          <span className="nutritionZoukMeta">
            <small>{nutritionZoukFoodsCount ? `${nutritionZoukFoodsCount} шт` : "пусто"}</small>
            <i aria-hidden="true">›</i>
          </span>
        </button>
      </section>

      {nutritionZoukExpanded && (
        <div className="nutritionZoukModalOverlay" role="dialog" aria-modal="true" aria-label="Дневник питания">
          <button
            type="button"
            className="nutritionZoukModalBackdrop"
            onClick={onCloseZouk}
            aria-label="Закрыть список продуктов"
          />
          <section className="nutritionZoukModalSheet">
            <header className="nutritionZoukModalHeader">
              <span className="nutritionZoukIcon" aria-hidden="true">🍽️</span>
              <div>
                <small>Продукты за день</small>
                <h2>Дневник питания</h2>
                <strong>{nutritionZoukFoodsCount ? `${nutritionZoukFoodsCount} шт` : "пока пусто"}</strong>
              </div>
              <button
                type="button"
                onClick={onCloseZouk}
                aria-label="Закрыть"
              >
                ×
              </button>
            </header>

            <div className="nutritionZoukContent">
              {nutritionMeals.map((meal) => {
                const foods = (nutritionToday.foods || []).filter((item) => item.mealId === meal.id);
                const stats = mealStats[meal.id] || { calories: 0, count: 0 };

                return (
                  <div className="nutritionZoukMeal" key={meal.id}>
                    <div className="nutritionZoukMealHead">
                      <span className="nutritionZoukMealIcon" aria-hidden="true">{meal.icon}</span>
                      <div>
                        <strong>{meal.name}</strong>
                        <small>{foods.length ? `${foods.length} шт · ${Math.round(stats.calories)} ккал` : "продуктов нет"}</small>
                      </div>
                      <button
                        type="button"
                        className="nutritionZoukAdd"
                        onClick={() => onAddMealFood(meal.id)}
                        aria-label={`Добавить продукт: ${meal.name}`}
                      >
                        +
                      </button>
                    </div>

                    {foods.length > 0 ? (
                      <div className="nutritionZoukFoods">
                        {foods.map((item) => (
                          <div
                            className={`productSwipeShell nutritionZoukSwipeShell ${deletingFoodId === item.id ? "deleting" : ""}`}
                            key={item.id}
                          >
                            <div className="productDeleteBg">
                              <span aria-hidden="true">×</span>
                            </div>

                            <button
                              type="button"
                              className={`nutritionZoukFood ${deletingFoodId === item.id ? "deleting" : ""}`}
                              style={{
                                transform: `translateX(${swipeOffsets[item.id] || 0}px)`,
                                opacity: deletingFoodId === item.id ? 0 : 1
                              }}
                              onClick={() => {
                                if (swipeMovedRef?.current?.[item.id]) return;
                                onEditFood(item);
                              }}
                              onTouchStart={(event) => onSwipeStart?.(item.id, event)}
                              onTouchMove={(event) => onSwipeMove?.(item.id, event)}
                              onTouchEnd={(event) => onSwipeEnd?.(item.id, event)}
                              onTouchCancel={() => onSwipeCancel?.(item.id)}
                            >
                            <span className="nutritionZoukFoodIcon" aria-hidden="true">{item.icon || getFoodIcon(item)}</span>
                            <span className="nutritionZoukFoodText">
                              <strong>{item.name}</strong>
                              <small>{item.amount} г · Б {roundMacro(item.protein)} · Ж {roundMacro(item.fat)} · У {roundMacro(item.carbs)}</small>
                            </span>
                            <span className="nutritionZoukFoodKcal">
                              <strong>{Math.round(Number(item.calories) || 0)}</strong>
                              <small>ккал</small>
                            </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="nutritionZoukEmpty"
                        onClick={() => onAddMealFood(meal.id)}
                      >
                        Добавить продукт
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <section className="fatMealList">
        {nutritionMeals.map((meal) => {
          const stats = mealStats[meal.id] || { calories: 0, count: 0 };
          const hasFoods = stats.count > 0;

          return (
            <div
              className="fatMealCard collapsed"
              key={meal.id}
            >
              <div
                className="fatMealMain mealRowExact"
              >
                <button
                  type="button"
                  className="fatMealOpenArea"
                  aria-label={`Открыть приём пищи: ${meal.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (hasFoods) {
                      onOpenMealFoods(meal.id);
                    } else {
                      onAddMealFood(meal.id);
                    }
                  }}
                />
                <div className="fatMealIcon mealIconExact">{meal.icon}</div>
                <div className="fatMealTitle mealTitleExact">
                  <strong>{meal.name}</strong>
                  {hasFoods && <span>{stats.count} шт</span>}
                  <button
                    type="button"
                    className={`fatMealToggle mealToggleUnderCount ${!hasFoods ? "disabled" : ""}`}
                    aria-label="Открыть список продуктов"
                    aria-expanded={Boolean(expandedNutritionMeals[meal.id])}
                    disabled={!hasFoods}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!hasFoods) return;
                      onOpenMealFoods(meal.id);
                    }}
                  >
                    ›
                  </button>
                </div>
                <div className="fatMealKcal">
                  <strong>{Math.round(stats.calories)}</strong>
                  <span>Калории</span>
                </div>

                <div className="fatMealActions mealActionsExact">
                  <button
                    type="button"
                    className="fatPlusBtn mealPlusExact"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddMealFood(meal.id);
                    }}
                    aria-label={`Добавить еду: ${meal.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
