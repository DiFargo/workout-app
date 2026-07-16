import styles from "./NutritionMealModal.module.css";

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
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={activeMeal.name}
      data-testid="nutrition-meal-modal"
      data-css-module-scope="nutrition-meal-modal"
    >
      <button
        type="button"
        className={styles.backdrop}
        onClick={onClose}
        aria-label="Закрыть список продуктов"
        data-nutrition-meal-part="backdrop"
      />

      <section className={styles.sheet} data-nutrition-meal-part="sheet">
        <header className={styles.header} data-nutrition-meal-part="header">
          <span className={styles.icon} aria-hidden="true" data-nutrition-meal-part="icon">{activeMeal.icon}</span>
          <div className={styles.headerInfo}>
            <small className={styles.headerEyebrow}>{foods.length} продуктов</small>
            <h2 className={styles.title}>{activeMeal.name}</h2>
            <strong className={styles.headerTotal}>{Math.round(stats.calories)} ккал</strong>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Закрыть"
            data-testid="nutrition-meal-close"
          >
            ×
          </button>
        </header>

        <div className={styles.list} data-nutrition-meal-part="list">
          {foods.map((item) => (
            <div
              className={`${styles.swipeShell} ${deletingFoodId === item.id ? styles.deleting : ""}`}
              key={item.id}
              data-nutrition-meal-row={item.id}
              data-state={deletingFoodId === item.id ? "deleting" : "idle"}
            >
              <div className={styles.deleteBackground} data-nutrition-meal-part="delete-background">
                <span className={styles.deleteIcon}>🗑️</span>
              </div>

              <div
                className={`${styles.row} ${deletingFoodId === item.id ? styles.deleting : ""}`}
                style={{
                  transform: deletingFoodId === item.id
                    ? "translateX(-120%)"
                    : `translateX(${swipeOffsets[item.id] || 0}px)`,
                  opacity: deletingFoodId === item.id ? 0 : 1
                }}
                role="button"
                tabIndex={0}
                data-testid="nutrition-meal-food"
                data-nutrition-meal-part="row"
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
                <div className={styles.foodIconWrap} data-nutrition-meal-part="food-icon-wrap">
                  <span className={styles.foodIcon} aria-hidden="true" data-nutrition-meal-part="food-icon">
                    {item.icon || getFoodIcon(item)}
                  </span>
                  <span className={styles.calories} data-nutrition-meal-part="calories">
                    {Math.round(Number(item.calories) || 0)}
                    <small className={styles.caloriesLabel}>ккал</small>
                  </span>
                </div>

                <div className={styles.info} data-nutrition-meal-part="info">
                  <strong className={styles.name}>{item.name}</strong>
                  <span className={styles.amount}>{item.amount} г</span>
                </div>

                <div className={styles.arrow} data-nutrition-meal-part="arrow">›</div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className={styles.addButton}
          onClick={() => onAddFood(activeMeal.id)}
          data-testid="nutrition-meal-add"
        >
          <span className={styles.addIcon} aria-hidden="true">＋</span>
          Добавить продукт
        </button>
      </section>
    </div>
  );
}
