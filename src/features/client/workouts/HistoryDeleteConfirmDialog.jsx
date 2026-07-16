import { getTimestampValue } from "../../../utils/auditSafety";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import styles from "./HistoryDeleteConfirmDialog.module.css";

export default function HistoryDeleteConfirmDialog({
  candidate,
  deletingId,
  onClose,
  onConfirm
}) {
  const workoutDate = getTimestampValue(candidate?.date);
  const dateLabel = workoutDate
    ? new Date(workoutDate).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).replace(".", "")
    : "без даты";

  return (
    <ConfirmDialog
      open={Boolean(candidate)}
      title="Удалить тренировку?"
      titleAs="h3"
      description={candidate ? (
        <p>
          {candidate.workout || "Тренировка"}
          <span>{dateLabel} · действие нельзя отменить</span>
        </p>
      ) : null}
      pending={Boolean(deletingId)}
      confirmLabel={deletingId ? "Удаляю..." : "Удалить"}
      onCancel={onClose}
      onConfirm={onConfirm}
      classNames={{
        overlay: styles.overlay,
        content: styles.dialog,
        icon: styles.icon,
        title: styles.title,
        description: styles.description,
        actions: styles.actions,
        action: styles.action,
        danger: styles.danger
      }}
      testIds={{
        overlay: "workout-history-delete-overlay",
        content: "workout-history-delete-dialog",
        titleId: "workout-history-delete-title"
      }}
    />
  );
}
