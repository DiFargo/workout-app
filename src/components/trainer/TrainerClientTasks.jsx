import { Check, ChevronDown, ClipboardList, Plus } from "lucide-react";
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

function formatActiveTaskCount(count) {
  const absolute = Math.abs(count);
  const lastTwo = absolute % 100;
  const last = absolute % 10;
  const label = lastTwo > 10 && lastTwo < 20
    ? "активных заданий"
    : last === 1
      ? "активное задание"
      : last >= 2 && last <= 4
        ? "активных задания"
        : "активных заданий";

  return `${count} ${label}`;
}

export default function TrainerClientTasks({ tasks = [], embedded = false, onCreateTask }) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const activeCount = safeTasks.filter((task) => !isTaskCompleted(task)).length;
  const summary = activeCount
    ? `${formatActiveTaskCount(activeCount)} из ${safeTasks.length}`
    : safeTasks.length
      ? "Активных заданий сейчас нет"
      : "Назначений пока нет";
  const taskList = (
    <div className={styles.list}>
      {safeTasks.length ? safeTasks.map((task, index) => {
        const completed = isTaskCompleted(task);
        const taskDate = task.dueDate || task.createdAt || task.date;
        const dateLabel = task.dueDate ? `до ${formatTaskDate(taskDate)}` : formatTaskDate(taskDate);

        return (
          <article key={task.id || index} className={completed ? styles.completed : ""}>
            <span className={styles.statusIcon} aria-hidden="true"><Check size={14} /></span>
            <span className={styles.taskText}>
              <strong>{task.title || task.text || "Задание"}</strong>
              <small>{completed ? "Выполнено" : "Активно"} · {dateLabel}</small>
            </span>
          </article>
        );
      }) : (
        <p className={styles.empty}>Добавьте первое задание для клиента — оно появится в этом списке.</p>
      )}
    </div>
  );

  if (embedded) {
    return (
      <section className={`${styles.panel} ${styles.embedded}`} data-trainer-client-tasks-sheet="true">
        <header className={styles.embeddedHeader}>
          <span className={styles.icon} aria-hidden="true"><ClipboardList size={18} /></span>
          <span className={styles.summaryText}>
            <strong>Назначения клиента</strong>
            <small>{summary}</small>
          </span>
          <button className={styles.createButton} type="button" onClick={onCreateTask}>
            <Plus size={16} />
            <span>Назначить задание</span>
          </button>
        </header>
        {taskList}
      </section>
    );
  }

  return (
    <details className={styles.panel}>
      <summary>
        <span className={styles.icon} aria-hidden="true"><ClipboardList size={18} /></span>
        <span className={styles.summaryText}>
          <strong>Задания клиенту</strong>
          <small>{summary}</small>
        </span>
        <ChevronDown size={17} className={styles.chevron} aria-hidden="true" />
      </summary>
      {taskList}
    </details>
  );
}
