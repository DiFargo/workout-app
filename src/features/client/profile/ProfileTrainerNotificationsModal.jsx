import { useRef, useState } from "react";
import { AlertCircle, CircleCheck, MessageSquare } from "lucide-react";
import { getTrainerTaskStatus } from "../../../domain/clientInsights";
import { formatRussianCount } from "../../../utils/russianCount";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import ProfileModalCloseButton from "./ProfileModalCloseButton";
import styles from "./ProfileTrainerNotificationsModal.module.css";

function ProfileTrainerNotificationsContent({
  isBasicPlan = false,
  tasks = [],
  getTaskDestination,
  onClose,
  onOpenTask,
  onUpdateTask
}) {
  const [view, setView] = useState("active");
  const [pendingIds, setPendingIds] = useState([]);
  const [updateError, setUpdateError] = useState("");
  const pendingRef = useRef(new Set());
  const tabsRef = useRef([]);

  const groups = { active: [], history: [] };
  for (const task of tasks) {
    if (!task) continue;
    groups[getTrainerTaskStatus(task).id === "completed" ? "history" : "active"].push(task);
  }
  const visibleTasks = groups[view];
  const unreadMessages = groups.active.filter((task) => task.notificationType === "message").length;
  const activeTasks = groups.active.length - unreadMessages;
  const summary = view === "history"
    ? "Выполненные задачи и прочитанные сообщения."
    : [
        activeTasks ? formatRussianCount(activeTasks, isBasicPlan ? ["напоминание", "напоминания", "напоминаний"] : ["задача", "задачи", "задач"]) : "",
        unreadMessages ? formatRussianCount(unreadMessages, ["новое сообщение", "новых сообщения", "новых сообщений"]) : ""
      ].filter(Boolean).join(" · ") || "Всё прочитано и выполнено";

  const updateTask = async (task, completed) => {
    if (!onUpdateTask || pendingRef.current.has(task.id)) return;
    pendingRef.current.add(task.id);
    setPendingIds([...pendingRef.current]);
    setUpdateError("");
    try {
      const result = await onUpdateTask(task, completed);
      if (result === false) setUpdateError("Не удалось изменить отметку. Попробуйте ещё раз.");
    } catch {
      setUpdateError("Не удалось изменить отметку. Попробуйте ещё раз.");
    } finally {
      pendingRef.current.delete(task.id);
      setPendingIds([...pendingRef.current]);
    }
  };

  const handleTabKeyDown = (event, index) => {
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? 1
      : event.key === "ArrowRight" || event.key === "ArrowLeft" ? 1 - index : null;
    if (nextIndex === null) return;
    event.preventDefault();
    setView(nextIndex === 0 ? "active" : "history");
    tabsRef.current[nextIndex]?.focus();
  };

  return (
    <div
      className={styles.overlay} data-modal-backdrop="true"
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

        <div className={styles.controls}>
          <div className={styles.tabs} role="tablist" aria-label="Разделы уведомлений">
            {[["active", "Актуальные"], ["history", "История"]].map(([id, label], index) => (
              <button
                key={id}
                ref={(node) => { tabsRef.current[index] = node; }}
                className={styles.tab}
                type="button"
                role="tab"
                id={`profile-notifications-tab-${id}`}
                aria-selected={view === id}
                aria-controls="profile-notifications-panel"
                tabIndex={view === id ? 0 : -1}
                onClick={() => setView(id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {label} <span className={styles.tabCount}>{groups[id].length}</span>
              </button>
            ))}
          </div>
          <p className={styles.summary} data-testid="profile-trainer-notifications-summary" aria-live="polite">{summary}</p>
          {updateError ? <p className={styles.error} role="alert">{updateError}</p> : null}
        </div>
        <div
          className={styles.list}
          data-testid="profile-trainer-notifications-list"
          role="tabpanel"
          id="profile-notifications-panel"
          aria-labelledby={`profile-notifications-tab-${view}`}
          tabIndex={0}
        >
          {visibleTasks.length > 0 ? visibleTasks.map((task) => {
                const taskStatus = getTrainerTaskStatus(task);
                const isMessageNotification = task.notificationType === "message";
                const taskDestination = isMessageNotification ? "" : getTaskDestination?.(task);
                const messageRead = isMessageNotification && taskStatus.id === "completed";
                const messageText = String(task.message || task.description || "").trim();
                const messageContext = isMessageNotification
                  ? String(task.messageContext || "").trim()
                  : "";
                const isReplyNotification = Boolean(messageContext);
                const messageTitle = isBasicPlan
                  ? isReplyNotification ? "Ответ на сообщение" : "Сообщение"
                  : isReplyNotification ? "Ответ тренера" : "Сообщение от тренера";
                const completed = taskStatus.id === "completed";
                const pending = pendingIds.includes(task.id);
                const dueDate = task.dueDate ? new Date(`${task.dueDate}T12:00:00`) : null;
                const taskDueText = dueDate && Number.isFinite(dueDate.getTime())
                  ? `${completed ? "Срок был до" : "До"} ${dueDate.toLocaleDateString("ru-RU")}`
                  : "Без срока";
                const toggleLabel = isMessageNotification
                  ? messageRead ? "Отметить непрочитанным" : "Отметить прочитанным"
                  : completed ? "Вернуть в актуальные" : "Отметить выполненным";
                return (
                  <article
                    key={task.id}
                    className={`${styles.item} ${styles[taskStatus.id] || ""}`}
                    data-task-status={taskStatus.id}
                    data-testid="profile-trainer-notification-item"
                    aria-label={isMessageNotification
                      ? `${messageTitle}${messageContext ? `: ${messageContext}` : ""}. ${messageText || task.title}. ${messageRead ? "Прочитано" : "Новое"}`
                      : `${isBasicPlan ? "Напоминание" : "Задача тренера"}: ${task.title}. ${taskStatus.label}. ${taskDueText}`}
                  >
                    <i className={styles.itemIcon} aria-hidden="true">
                      {messageRead || completed
                        ? <CircleCheck size={17} strokeWidth={2.1} />
                        : isMessageNotification ? <MessageSquare size={17} strokeWidth={2.1} />
                          : <AlertCircle size={17} strokeWidth={2.1} />}
                    </i>
                    <div className={styles.itemText}>
                      <strong className={styles.itemTitle}>{isMessageNotification ? messageTitle : task.title}</strong>
                      <em className={styles.itemStatus}>{isMessageNotification ? messageRead ? "Прочитано" : "Новое сообщение" : completed ? "Выполнено" : taskStatus.id === "overdue" ? "Срок прошёл" : "Нужно выполнить"}</em>
                      {messageContext ? <small className={styles.itemContext}>{messageContext}</small> : null}
                      {!isMessageNotification ? <small className={styles.itemMeta}>{taskDueText}</small> : null}
                    </div>
                    {isMessageNotification && messageText ? <details className={styles.messageDetails}>
                      <summary>
                        <span className={styles.messagePreview}>{messageText}</span>
                        <span className={styles.expandLabel}>Читать полностью</span>
                        <span className={styles.collapseLabel}>Свернуть сообщение</span>
                      </summary>
                      <p className={styles.messageFull}>{messageText}</p>
                    </details> : null}
                    {taskDestination || onUpdateTask ? <div className={styles.actions} data-testid="profile-trainer-notification-actions">
                      {taskDestination ? (
                        <button
                          className={`${styles.actionButton} ${!completed ? styles.primaryAction : ""}`}
                          data-testid="profile-trainer-notification-open"
                          type="button"
                          onClick={() => onOpenTask?.(task, taskDestination)}
                        >
                          Открыть
                        </button>
                      ) : null}
                      {onUpdateTask ? (
                        <button
                          className={`${styles.actionButton} ${!completed && !taskDestination ? styles.primaryAction : ""}`}
                          data-testid="profile-trainer-notification-toggle"
                          type="button"
                          disabled={pending}
                          aria-busy={pending}
                          onClick={() => updateTask(task, !completed)}
                        >
                          {pending ? "Сохраняем…" : toggleLabel}
                        </button>
                      ) : null}
                    </div> : null}
                  </article>
                );
              }) : (
          <div className={styles.empty} data-testid="profile-trainer-notifications-empty">
            <i className={styles.emptyIcon} aria-hidden="true"><CircleCheck size={25} strokeWidth={2} /></i>
            <strong className={styles.emptyTitle}>{view === "history" ? "История пока пуста" : "Новых уведомлений нет"}</strong>
            <p className={styles.emptyText}>{view === "history"
              ? "Здесь сохранятся выполненные задачи и прочитанные сообщения."
              : groups.history.length > 0 ? "Выполненные задачи и прочитанные сообщения — во вкладке «История»."
                : isBasicPlan ? "Сообщения и напоминания появятся здесь." : "Задачи и рекомендации тренера появятся здесь."}</p>
          </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function ProfileTrainerNotificationsModal({ open, ...props }) {
  return open ? <ProfileTrainerNotificationsContent {...props} /> : null;
}
