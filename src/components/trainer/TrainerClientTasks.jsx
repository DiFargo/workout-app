import { Check, ChevronDown, ClipboardList } from "lucide-react";
import styles from "./TrainerClientTasks.module.css";

function getTaskDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "object" && Number.isFinite(value?.seconds)) {
    return new Date(value.seconds * 1000);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTaskDate(value) {
  const date = getTaskDate(value);
  if (!date) return "Без срока";

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const delta = Math.round((todayStart.getTime() - dateStart.getTime()) / 86400000);

  if (delta === 0) return "Сегодня";
  if (delta === 1) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function isTaskCompleted(task = {}) {
  return task.status === "completed" || Boolean(task.completedAt);
}

export default function TrainerClientTasks({ tasks = [] }) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const activeCount = safeTasks.filter((task) => !isTaskCompleted(task)).length;

  return (
    <details className={styles.panel}>
      <summary>
        <span className={styles.icon} aria-hidden="true"><ClipboardList size={18} /></span>
        <span className={styles.summaryText}>
          <strong>Задания клиенту</strong>
          <small>{activeCount ? `${activeCount} активных из ${safeTasks.length}` : "Активных задач сейчас нет"}</small>
        </span>
        <ChevronDown size={17} className={styles.chevron} aria-hidden="true" />
      </summary>

      <div className={styles.list}>
        {safeTasks.length ? safeTasks.map((task, index) => {
          const completed = isTaskCompleted(task);
          const taskDate = task.dueDate || task.createdAt || task.date;
          const dateLabel = task.dueDate ? `до ${formatTaskDate(taskDate)}` : formatTaskDate(taskDate);

          return (
            <article key={task.id || index} className={completed ? styles.completed : ""}>
              <span className={styles.statusIcon} aria-hidden="true"><Check size={14} /></span>
              <span className={styles.taskText}>
                <strong>{task.title || task.text || "Задача"}</strong>
                <small>{completed ? "Выполнено" : "Активно"} · {dateLabel}</small>
              </span>
            </article>
          );
        }) : (
          <p className={styles.empty}>Создайте задачу из шапки карточки клиента.</p>
        )}
      </div>
    </details>
  );
}

