import styles from "./FoodPhotoAiSearchProcess.module.css";

export default function FoodPhotoAiSearchProcess({ visible }) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className={styles.process}
      data-css-module-scope="food-photo-ai-search-process"
      data-testid="food-photo-ai-search-process"
    >
      <div className={styles.orbit} aria-hidden="true">
        <i className={styles.orbitRing} />
        <span className={styles.orbitCore} />
      </div>
      <div className={styles.content}>
        <strong className={styles.title}>ИИ ищет продукт по фото</strong>
        <p className={styles.description}>Анализирую изображение, название, этикетку и порцию.</p>
      </div>
    </div>
  );
}
