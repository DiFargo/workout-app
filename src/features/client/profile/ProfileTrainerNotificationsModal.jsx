import { AlertCircle, CircleCheck } from "lucide-react";
import { getTrainerTaskStatus } from "../../../domain/clientInsights";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import ProfileModalCloseButton from "./ProfileModalCloseButton";
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
        <ClientPageHeader
          compact
          embedded
          controlsVariant="workout"
          className={styles.header}
          title="Уведомления"
          titleId="profileTrainerNotificationsTitle"
          scope="profile-trainer-notifications-header"
          actions={(
            <ProfileModalCloseButton
              testId="profile-trainer-notifications-close"
              ariaLabel="Закрыть уведомления"
              onClick={onClose}
            />
          )}
        />

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
                const isMessageNotification = task.notificationType === "message";
                const taskDestination = isMessageNotification ? "" : getTaskDestination(task);
                const messageRead = isMessageNotification && taskStatus.id === "completed";
                const messageText = String(task.message || task.description || "").trim();
                const messageContext = isMessageNotification
                  ? String(task.messageContext || "").trim()
                  : "";
                const isReplyNotification = Boolean(messageContext);
                const taskDueText = task.dueDate
                  ? `До ${new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("ru-RU")}`
                  : "Без срока";
                return (
                  <article
                    key={task.id}
                    className={`${styles.item} ${styles[taskStatus.id] || ""}${taskDestination ? ` ${styles.actionable}` : ""}`}
                    data-task-status={taskStatus.id}
                    data-testid="profile-trainer-notification-item"
                    aria-label={isMessageNotification
                      ? `${isReplyNotification ? "Ответ тренера" : "Сообщение от тренера"}${messageContext ? `: ${messageContext}` : ""}. ${messageText || task.title}. ${messageRead ? "Прочитано" : "Новое"}`
                      : `Задача тренера: ${task.title}. ${taskStatus.label}. ${taskDueText}`}
                  >
                    <i className={styles.itemIcon} aria-hidden="true">
                      {messageRead || taskStatus.id === "completed"
                        ? <CircleCheck size={17} strokeWidth={2.1} />
                        : <AlertCircle size={17} strokeWidth={2.1} />}
                    </i>
                    <span className={styles.itemText}>
                      <strong className={styles.itemTitle}>{isMessageNotification ? isReplyNotification ? "Ответ тренера" : "Сообщение от тренера" : task.title}</strong>
                      {messageContext ? <small className={styles.itemContext}>{messageContext}</small> : null}
                      <small className={styles.itemMeta}>{isMessageNotification ? messageText : taskDueText}</small>
                    </span>
                    <em className={styles.itemStatus}>{isMessageNotification ? messageRead ? "Прочитано" : "Новое" : taskStatus.label}</em>
                    <div className={styles.actions} data-testid="profile-trainer-notification-actions">
                      {taskDestination ? (
                        <button
                          className={styles.actionButton}
                          data-testid="profile-trainer-notification-open"
                          type="button"
                          onClick={() => onOpenTask(task, taskDestination)}
                        >
                          Открыть
                        </button>
                      ) : null}
                      {onUpdateTask ? (
                        <button
                          className={styles.actionButton}
                          data-testid="profile-trainer-notification-toggle"
                          type="button"
                          onClick={() => onUpdateTask(task, isMessageNotification ? !messageRead : taskStatus.id !== "completed")}
                        >
                          {isMessageNotification
                            ? messageRead ? "Вернуть" : "Прочитано"
                            : taskStatus.id === "completed" ? "Вернуть" : "Готово"}
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
            <i className={styles.emptyIcon} aria-hidden="true"><CircleCheck size={25} strokeWidth={2} /></i>
            <strong className={styles.emptyTitle}>Новых уведомлений нет</strong>
            <p className={styles.emptyText}>Задачи и рекомендации тренера появятся здесь.</p>
          </div>
        )}
      </section>
    </div>
  );
}
