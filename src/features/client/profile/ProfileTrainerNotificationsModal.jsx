import { getTrainerTaskStatus } from "../../../domain/clientInsights";
import styles from "./ProfileTrainerNotificationsModal.module.css";

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
    <div
      className={styles.overlay}
      data-css-module-scope="profile-trainer-notifications"
      data-testid="profile-trainer-notifications-overlay"
      role="presentation"
      onClick={onClose}
    >
      <section
        className={styles.dialog}
        data-testid="profile-trainer-notifications-dialog"
        role="dialog"
        aria-modal="true"
        data-modal-surface="true"
        aria-labelledby="profileTrainerNotificationsTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.eyebrow}>ОТ ТРЕНЕРА</span>
            <h2 className={styles.heading} id="profileTrainerNotificationsTitle">Уведомления</h2>
          </div>
          <button
            className={styles.closeButton}
            data-testid="profile-trainer-notifications-close"
            type="button"
            aria-label="Закрыть уведомления"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {tasks.length > 0 ? (
          <>
            <p className={styles.summary} data-testid="profile-trainer-notifications-summary">
              {activeCount > 0
                ? `${activeCount} ${activeCount === 1 ? "активная задача" : "активных задач"}`
                : "Все задачи выполнены"}
            </p>
            <div className={styles.list} data-testid="profile-trainer-notifications-list">
              {tasks.map((task) => {
                const taskStatus = getTrainerTaskStatus(task);
                const taskDestination = getTaskDestination(task);
                const taskDueText = task.dueDate
                  ? `До ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("ru-RU")}`
                  : "Без срока";
                return (
                  <article
                    key={task.id}
                    className={`${styles.item} ${styles[taskStatus.id] || ""}${taskDestination ? ` ${styles.actionable}` : ""}`}
                    data-task-status={taskStatus.id}
                    data-testid="profile-trainer-notification-item"
                    aria-label={`Задача тренера: ${task.title}. ${taskStatus.label}. ${taskDueText}`}
                  >
                    <i className={styles.itemIcon} aria-hidden="true">
                      {taskStatus.id === "completed" ? "✓" : "!"}
                    </i>
                    <span className={styles.itemText}>
                      <strong className={styles.itemTitle}>{task.title}</strong>
                      <small className={styles.itemMeta}>{taskDueText}</small>
                    </span>
                    <em className={styles.itemStatus}>{taskStatus.label}</em>
                    <div className={styles.actions} data-testid="profile-trainer-notification-actions">
                      {taskDestination ? (
                        <button
                          className={styles.actionButton}
                          data-testid="profile-trainer-notification-open"
                          type="button"
                          onClick={() => onOpenTask(task)}
                        >
                          Открыть
                        </button>
                      ) : null}
                      {onUpdateTask ? (
                        <button
                          className={styles.actionButton}
                          data-testid="profile-trainer-notification-toggle"
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
          <div className={styles.empty} data-testid="profile-trainer-notifications-empty">
            <i className={styles.emptyIcon} aria-hidden="true">✓</i>
            <strong className={styles.emptyTitle}>Новых уведомлений нет</strong>
            <p className={styles.emptyText}>Задачи и рекомендации тренера появятся здесь.</p>
          </div>
        )}
      </section>
    </div>
  );
}
