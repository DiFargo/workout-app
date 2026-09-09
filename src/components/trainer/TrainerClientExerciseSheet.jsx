import TrainerEditorSheet from "./TrainerEditorSheet";
import styles from "./TrainerClientWorkoutPlan.module.css";

export default function TrainerClientExerciseSheet({ enabled, onClose, children }) {
  return enabled ? <TrainerEditorSheet title="Настройки упражнения" onClose={onClose} className={styles.clientExerciseSheet} bodyClassName={styles.clientExerciseSheetBody}>{children}</TrainerEditorSheet> : children;
}
