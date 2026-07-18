import { getTimestampValue } from "../../../utils/auditSafety";
import styles from "./HistoryDeleteConfirmDialog.module.css";

export default function HistoryDeleteConfirmDialog({
  candidate,
  deletingId,
  onClose,
  onConfirm
}) {
  if (!candidate) return null;

  const workoutDate = getTimestampValue(candidate.date);
  const dateLabel = workoutDate
    ? new Date(workoutDate).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).replace(".", "")
    : "без даты";

  return (
    <div className={styles.overlay} data-testid="workout-history-delete-overlay" data-css-module-scope="workout-history-delete" onClick={onClose}>
      <div className={styles.dialog} data-testid="workout-history-delete-dialog" role="dialog" aria-modal="true" data-modal-surface="true" aria-label="Подтверждение удаления тренировки" onClick={(event) => event.stopPropagation()}>
        <div className={styles.icon}>⌫</div>
        <h3>Удалить тренировку?</h3>
        <p>
          {candidate.workout || "Тренировка"}
          <span>{dateLabel} · действие нельзя отменить</span>
        </p>

        <div className={styles.actions}>
          <button type="button" onClick={onClose} disabled={Boolean(deletingId)}>
            Отмена
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={onConfirm}
            disabled={Boolean(deletingId)}
          >
            {deletingId ? "Удаляю..." : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}
