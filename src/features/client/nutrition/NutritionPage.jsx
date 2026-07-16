import styles from "./NutritionPage.module.css";

export default function NutritionPage({
  children
}) {
  return (
    <div
      className={styles.root}
      data-css-module-scope="nutrition-page"
      data-testid="nutrition-page"
    >
      {children}
    </div>
  );
}
