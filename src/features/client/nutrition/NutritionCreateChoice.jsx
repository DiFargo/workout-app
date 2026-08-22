import { PackagePlus, UtensilsCrossed, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import styles from "./NutritionCreateChoice.module.css";

export default function NutritionCreateChoice({
  open,
  onCreateFood,
  onCreateDish,
  onClose
}) {
  const returnFocusRef = useRef(null);
  const wasOpenRef = useRef(false);

  useLayoutEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement;
    returnFocusRef.current = previousFocus instanceof HTMLElement ? previousFocus : null;
    wasOpenRef.current = true;
  }, [open]);

  useEffect(() => {
    if (open || !wasOpenRef.current) return undefined;

    wasOpenRef.current = false;
    const returnFocus = returnFocusRef.current;
    if (!returnFocus || !document.contains(returnFocus)) return undefined;

    let restoreTimeout = null;
    const restoreFrame = window.requestAnimationFrame(() => {
      restoreTimeout = window.setTimeout(() => {
        if (document.contains(returnFocus)) {
          returnFocus.focus({ preventScroll: true });
        }
      }, 0);
    });

    return () => {
      window.cancelAnimationFrame(restoreFrame);
      if (restoreTimeout !== null) window.clearTimeout(restoreTimeout);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

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
        <button
          type="button"
          className={styles.closeButton}
          data-testid="nutrition-create-choice-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <X aria-hidden="true" />
        </button>

        <div className={styles.header}>
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
