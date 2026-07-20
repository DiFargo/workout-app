import { PackagePlus, UtensilsCrossed, X } from "lucide-react";
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
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="nutritionCreateChoiceTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <button
            type="button"
            className={styles.closeButton}
            data-testid="nutrition-create-choice-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X aria-hidden="true" />
          </button>
          <span className={styles.eyebrow}>Моя база</span>
          <h3 className={styles.title} id="nutritionCreateChoiceTitle">Создать</h3>
          <p className={styles.description}>Выбери продукт или блюдо из нескольких ингредиентов.</p>
        </div>

        <div className={styles.grid}>
          <button className={styles.option} data-testid="nutrition-create-choice-option" type="button" onClick={onCreateFood}>
            <span className={styles.optionIcon}><PackagePlus aria-hidden="true" /></span>
            <strong className={styles.optionTitle}>Продукт</strong>
            <small className={styles.optionDescription}>КБЖУ на 100 г или порцию</small>
          </button>

          <button className={styles.option} data-testid="nutrition-create-choice-option" type="button" onClick={onCreateDish}>
            <span className={styles.optionIcon}><UtensilsCrossed aria-hidden="true" /></span>
            <strong className={styles.optionTitle}>Блюдо</strong>
            <small className={styles.optionDescription}>Итоговый вес и КБЖУ блюда</small>
          </button>
        </div>
      </div>
    </div>
  );
}
