import styles from "./TrainerSummaryStatus.module.css";
const sourceNames = { history: "Тренировки", nutrition: "Питание", measurements: "Замеры", payment: "Оплата", workouts: "Программа", tasks: "Задания" };

export default function TrainerSummaryStatus({ clients, summaries, loading, onRetry }) {
  const pending = clients.filter((client) => summaries[client.id]?.trainerSummaryState === "partial");
  if (!pending.length) return null;
  return <aside className={styles.status} aria-label="Состояние данных клиентов">
    <strong>Часть данных не обновилась</strong>
    <p>Показываем последние полученные значения. Отсутствие ответа не считается отсутствием активности.</p>
    <details><summary>Проверить клиентов · {pending.length}</summary><ul>{pending.map((client) => {
      const summary = summaries[client.id];
      return <li key={client.id}><span><strong>{client.name || client.displayName || "Клиент"}</strong><small>{summary.lastUpdatedAt ? `Обновлено ${new Date(summary.lastUpdatedAt).toLocaleString("ru-RU", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}` : "Полные данные пока не получены"}</small></span>
        <span>{(summary.failedSources || []).map((source) => <small key={source}>{sourceNames[source]}: {summary.sources?.[source]?.state === "limited" ? "подробности в карточке клиента" : "не удалось обновить"}</small>)}</span>
        <button type="button" disabled={loading} onClick={() => onRetry?.([client.id])}>Повторить</button></li>;
    })}</ul></details>
  </aside>;
}
