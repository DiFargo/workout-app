import styles from "./WorkoutRunPageShell.module.css";

export default function WorkoutRunPageShell({ children, noHeader = false }) {
  return (
    <div
      className={`${styles.root} ${noHeader ? styles.noHeader : ""}`}
      data-css-module-scope="workout-run-page"
      data-workout-run-no-header={noHeader ? "true" : "false"}
    >
      {children}
    </div>
  );
}
