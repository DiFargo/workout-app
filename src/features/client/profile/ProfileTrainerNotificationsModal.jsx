import { getTrainerTaskStatus } from "../../../domain/clientInsights";

export default function ProfileTrainerNotificationsModal({
  open,
  tasks = [],
  activeCount,
  getTaskDestination,
  onClose,
  onOpenTask,
  onUpdateTask
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
                const taskDueText = task.dueDate
                  ? `До ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("ru-RU")}`
                  : "Без срока";
                return (
                  <article
                    key={task.id}
                    className={`profileTrainerNotificationItem ${taskStatus.id}${taskDestination ? " actionable" : ""}`}
                    aria-label={`Задача тренера: ${task.title}. ${taskStatus.label}. ${taskDueText}`}
                  >
                    <i aria-hidden="true">{taskStatus.id === "completed" ? "✓" : "!"}</i>
                    <span>
                      <strong>{task.title}</strong>
                      <small>
                        {taskDueText}
                      </small>
                    </span>
                    <em>{taskStatus.label}</em>
                    <div className="profileTrainerNotificationActions">
                      {taskDestination ? (
                        <button type="button" onClick={() => onOpenTask(task)}>
                          Открыть
                        </button>
                      ) : null}
                      {onUpdateTask ? (
                        <button
                          type="button"
                          onClick={() => onUpdateTask(task, taskStatus.id !== "completed")}
                        >
                          {taskStatus.id === "completed" ? "Вернуть" : "Готово"}
                        </button>
                      ) : null}
                    </div>
                  </article>
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
