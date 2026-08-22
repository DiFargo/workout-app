import { ChevronRight, Utensils } from "lucide-react";
import styles from "./NutritionDiary.module.css";

const MEAL_TIMES = ["08:00", "13:00", "19:00"];

export default function NutritionDiary({
  nutritionZoukExpanded,
  nutritionZoukFoodsCount,
  nutritionMeals,
  nutritionToday,
  mealStats,
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
      <section className={styles.diaryBlock} data-css-module-scope="nutrition-diary">
        <button
          type="button"
          className={styles.diaryHeader}
          data-testid="nutrition-diary-toggle"
          onClick={onOpenZouk}
          aria-expanded={nutritionZoukExpanded}
          aria-haspopup="dialog"
        >
          <span className={styles.titleText}>Дневник</span>
          <ChevronRight aria-hidden="true" />
        </button>
      </section>

      {nutritionZoukExpanded && (
        <div
          className={styles.modalOverlay}
          data-testid="nutrition-diary-modal"
          role="dialog"
          aria-modal="true"
          data-modal-surface="true"
          aria-label="Дневник питания"
        >
          <button
            type="button"
            className={styles.modalBackdrop}
            onClick={onCloseZouk}
            aria-label="Закрыть список продуктов"
          />
          <section className={styles.modalSheet}>
            <header className={styles.modalHeader}>
              <span className={styles.diaryIcon} aria-hidden="true">🍽️</span>
              <div>
                <small>Продукты за день</small>
                <h2>Дневник питания</h2>
                <strong>{nutritionZoukFoodsCount ? `${nutritionZoukFoodsCount} шт` : "пока пусто"}</strong>
              </div>
              <button
                type="button"
                data-testid="nutrition-diary-close"
                onClick={onCloseZouk}
                aria-label="Закрыть"
              >
                ×
              </button>
            </header>

            <div className={styles.content}>
              {nutritionMeals.map((meal) => {
                const foods = (nutritionToday.foods || []).filter((item) => item.mealId === meal.id);
                const stats = mealStats[meal.id] || { calories: 0, count: 0 };

                return (
                  <div className={styles.mealGroup} key={meal.id}>
                    <div className={styles.mealHeading}>
                      <span className={styles.mealIcon} aria-hidden="true">{meal.icon}</span>
                      <div>
                        <strong>{meal.name}</strong>
                        <small>{foods.length ? `${foods.length} шт · ${Math.round(stats.calories)} ккал` : "продуктов нет"}</small>
                      </div>
                      <button
                        type="button"
                        className={styles.addButton}
                        data-testid="nutrition-diary-add"
                        onClick={() => onAddMealFood(meal.id)}
                        aria-label={`Добавить продукт: ${meal.name}`}
                      >
                        +
                      </button>
                    </div>

                    {foods.length > 0 ? (
                      <div className={styles.foods}>
                        {foods.map((item) => (
                          <div
                            className={`${styles.swipeShell} ${deletingFoodId === item.id ? styles.deleting : ""}`}
                            key={item.id}
                          >
                            <div className={styles.deleteBackground}>
                              <span aria-hidden="true">×</span>
                            </div>

                            <button
                              type="button"
                              className={`${styles.foodButton} ${deletingFoodId === item.id ? styles.deleting : ""}`}
                              data-testid="nutrition-diary-food"
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
                            <span className={styles.foodIcon} aria-hidden="true">{item.icon || getFoodIcon(item)}</span>
                            <span className={styles.foodText}>
                              <strong>{item.name}</strong>
                              <small>
                                {item.amount} г · Б {roundMacro(item.protein)} · Ж {roundMacro(item.fat)} · У {roundMacro(item.carbs)}
                                {item.source === "Оценка ИИ" ? " · Оценка ИИ" : ""}
                              </small>
                            </span>
                            <span className={styles.foodCalories}>
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
                        className={styles.emptyButton}
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

      <section className={styles.mealList} data-testid="nutrition-diary-list">
        {nutritionMeals.slice(0, 3).map((meal, mealIndex) => {
          const stats = mealStats[meal.id] || { calories: 0, count: 0 };
          const hasFoods = stats.count > 0;

          return (
            <div
              className={styles.mealCard}
              key={meal.id}
            >
              <div
                className={styles.mealRow}
              >
                <button
                  type="button"
                  className={styles.mealOpenArea}
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
                <div className={styles.mealIcon}><Utensils aria-hidden="true" /></div>
                <div className={styles.mealTitle}>
                  <strong>{meal.name}</strong>
                  <span>{hasFoods ? `${stats.count} шт · ${Math.round(stats.calories)} ккал` : "Не добавлено"}</span>
                </div>
                <div className={styles.mealCalories}>
                  <strong>{MEAL_TIMES[mealIndex]}</strong>
                  <ChevronRight aria-hidden="true" />
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
