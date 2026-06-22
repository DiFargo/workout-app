import { getTrainerTaskStatus } from "../../../domain/clientInsights";

export default function ProfileTrainerNotificationsModal({
  open,
  tasks = [],
  activeCount,
  getTaskDestination,
  onClose,
  onOpenTask
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="profileTrainerNotificationsOverlay" role="presentation" onClick={onClose}>
      <section
        className="profileTrainerNotificationsModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profileTrainerNotificationsTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="profileTrainerNotificationsHead">
          <div>
            <span>ОТ ТРЕНЕРА</span>
            <h2 id="profileTrainerNotificationsTitle">Уведомления</h2>
          </div>
          <button type="button" aria-label="Закрыть уведомления" onClick={onClose}>
            ×
          </button>
        </header>

        {tasks.length > 0 ? (
          <>
            <p className="profileTrainerNotificationsSummary">
              {activeCount > 0
                ? `${activeCount} ${activeCount === 1 ? "активная задача" : "активных задач"}`
                : "Все задачи выполнены"}
            </p>
            <div className="profileTrainerNotificationsList">
              {tasks.map((task) => {
                const taskStatus = getTrainerTaskStatus(task);
                const taskDestination = getTaskDestination(task);
                return (
                  <button
                    type="button"
                    key={task.id}
                    className={`profileTrainerNotificationItem ${taskStatus.id}${taskDestination ? " actionable" : ""}`}
                    onClick={() => onOpenTask(task)}
                  >
                    <i aria-hidden="true">{taskStatus.id === "completed" ? "✓" : "!"}</i>
                    <span>
                      <strong>{task.title}</strong>
                      <small>
                        {task.dueDate
                          ? `До ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("ru-RU")}`
                          : "Без срока"}
                      </small>
                    </span>
                    <em>{taskStatus.label}</em>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="profileTrainerNotificationsEmpty">
            <i aria-hidden="true">✓</i>
            <strong>Новых уведомлений нет</strong>
            <p>Задачи и рекомендации тренера появятся здесь.</p>
          </div>
        )}
      </section>
    </div>
  );
}
