import styles from "./NutritionCreateChoice.module.css";

export default function NutritionCreateChoice({
  open,
  onCreateFood,
  onCreateDish,
  onClose
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      data-css-module-scope="nutrition-create-choice"
      data-testid="nutrition-create-choice"
    >
      <div className={styles.sheet}>
        <div className={styles.header}>
          <button
            type="button"
            className={styles.closeButton}
            data-testid="nutrition-create-choice-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
          <span className={styles.eyebrow}>Моя база</span>
          <h3 className={styles.title}>Создать</h3>
          <p className={styles.description}>Выбери продукт или блюдо из нескольких ингредиентов.</p>
        </div>

        <div className={styles.grid}>
          <button className={styles.option} data-testid="nutrition-create-choice-option" type="button" onClick={onCreateFood}>
            <span className={styles.optionIcon}>＋</span>
            <strong className={styles.optionTitle}>Продукт</strong>
            <small className={styles.optionDescription}>КБЖУ на 100 г или порцию</small>
          </button>

          <button className={styles.option} data-testid="nutrition-create-choice-option" type="button" onClick={onCreateDish}>
            <span className={styles.optionIcon}>🍲</span>
            <strong className={styles.optionTitle}>Блюдо</strong>
            <small className={styles.optionDescription}>Итоговый вес и КБЖУ блюда</small>
          </button>
        </div>
      </div>
    </div>
  );
}
