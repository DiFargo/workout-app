import styles from "./NutritionPage.module.css";
import adaptiveShellStyles from "../../../shared/ui/ClientAdaptiveShell.module.css";

export default function NutritionPage({
  children
}) {
  return (
    <div
      className={`${styles.root} ${adaptiveShellStyles.shell}`}
      data-client-adaptive-shell="true"
      data-css-module-scope="nutrition-page"
      data-testid="nutrition-page"
    >
      {children}
    </div>
  );
}
