import { getTimestampValue } from "../../../utils/auditSafety";

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
    <div className="historyDeleteOverlay" onClick={onClose}>
      <div className="historyDeleteModal" onClick={(event) => event.stopPropagation()}>
        <div className="historyDeleteIcon">⌫</div>
        <h3>Удалить тренировку?</h3>
        <p>
          {candidate.workout || "Тренировка"}
          <span>{dateLabel} · действие нельзя отменить</span>
        </p>

        <div className="historyDeleteActions">
          <button type="button" onClick={onClose} disabled={Boolean(deletingId)}>
            Отмена
          </button>
          <button
            type="button"
            className="danger"
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
