import { BARCODE_SEARCH_ENABLED } from "../../../constants/appConfig";
import styles from "./NutritionBarcodeOverlay.module.css";

export default function NutritionBarcodeOverlay({ open }) {
  if (!BARCODE_SEARCH_ENABLED || !open) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      data-css-module-scope="nutrition-barcode"
      data-testid="nutrition-barcode-overlay"
    >
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>Скоро</span>
          <h3 className={styles.title}>Штрихкод</h3>
          <p className={styles.description}>Мы готовим базу продуктов, чтобы поиск по упаковке был точным и быстрым.</p>
        </div>
        <div className={styles.placeholder} data-testid="nutrition-barcode-placeholder">
          <span className={styles.placeholderIcon} aria-hidden="true">▦</span>
          <strong className={styles.placeholderTitle}>Поиск по штрихкоду появится позже</strong>
          <p className={styles.placeholderDescription}>Сейчас добавь продукт через обычный поиск, ИИ-фото или кнопку «Создать».</p>
        </div>
      </div>
    </div>
  );
}
