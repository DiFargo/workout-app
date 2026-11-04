import { useEffect, useRef, useState } from "react";
import { CircleAlert, ChevronDown, LoaderCircle, X } from "lucide-react";
import styles from "./TrainerSummaryStatus.module.css";
const sourceNames = { history: "Тренировки", nutrition: "Питание", measurements: "Замеры", payment: "Оплата", workouts: "Программа", tasks: "Задания" };

export default function TrainerSummaryStatus({ clients = [], summaries = {}, loading = false, onRetry }) {
  const detailsRef = useRef(null);
  const retryPendingRef = useRef(false);
  const [retryPending, setRetryPending] = useState(false);
  const [retryError, setRetryError] = useState("");
  useEffect(() => {
    function closeOutside(event) {
      if (detailsRef.current?.open && !detailsRef.current.contains(event.target)) detailsRef.current.open = false;
    }
    document.addEventListener("pointerdown", closeOutside, { passive: true });
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  const pending = clients.filter((client) => summaries[client.id]?.trainerSummaryState === "partial");
  const deferred = clients.filter((client) => summaries[client.id]?.trainerSummaryState === "deferred");
  const busy = loading || retryPending;
  if (!pending.length && !deferred.length && !busy) return null;
  const label = busy ? "Обновляем данные" : pending.length ? `Проверить данные · ${pending.length}` : `Ещё сводки · ${deferred.length}`;
  function closeDetails() {
    if (!detailsRef.current) return;
    detailsRef.current.open = false;
    detailsRef.current.querySelector("summary")?.focus();
  }
  async function retry(ids) {
    if (!onRetry || loading || retryPendingRef.current) return;
    retryPendingRef.current = true;
    setRetryPending(true);
    setRetryError("");
    try {
      const result = await onRetry(ids);
      if (result === false) setRetryError("Не удалось запустить проверку. Попробуйте ещё раз.");
    } catch {
      setRetryError("Не удалось запустить проверку. Попробуйте ещё раз.");
    } finally {
      retryPendingRef.current = false;
      setRetryPending(false);
    }
  }
  return <aside className={styles.status} aria-label={pending.length ? "Состояние данных клиентов" : "Подгрузка сводок клиентов"} data-testid="trainer-summary-status">
    <details ref={detailsRef} className={styles.disclosure} onKeyDown={(event) => {
      if (event.key === "Escape" && detailsRef.current?.open) { event.preventDefault(); event.stopPropagation(); closeDetails(); }
    }}>
      <summary className={styles.trigger}>
        {busy ? <LoaderCircle className={styles.spinner} size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
        <span aria-live="polite">{label}</span><ChevronDown className={styles.chevron} size={14} aria-hidden="true" />
      </summary>
      <section className={styles.panel} aria-label="Подробности загрузки данных">
        <header><strong>{pending.length ? "Данные требуют проверки" : "Загрузка сводок"}</strong><button className={styles.close} type="button" aria-label="Свернуть состояние данных" onClick={closeDetails}><X size={18} aria-hidden="true" /></button></header>
        <p>{pending.length ? "Часть данных сохранена ранее или получена не полностью. Это не означает отсутствие активности клиента." : busy ? "Получаем актуальные значения. Клиенты остаются доступны в списке." : "Сводки загружаются по мере просмотра списка."}</p>
        {deferred.length ? <div className={styles.deferred}><span>Ещё не запрошено: {deferred.length}</span><button type="button" className={styles.primary} disabled={busy || !onRetry} onClick={() => retry(deferred.slice(0, 20).map(client => client.id))}>Загрузить следующие сводки</button></div> : null}
        {retryError ? <p className={styles.error} role="alert">{retryError}</p> : null}
        {pending.length ? <ul>{pending.map((client) => {
          const summary = summaries[client.id];
          const updated = summary.lastUpdatedAt ? new Date(summary.lastUpdatedAt) : null;
          return <li key={client.id}>
            <div><strong>{client.name || client.displayName || "Клиент"}</strong><small>{updated && Number.isFinite(updated.getTime()) ? `Последняя полная сводка: ${updated.toLocaleString("ru-RU", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}` : "Полные данные пока не получены"}</small></div>
            <div className={styles.sources}>{(summary.failedSources || []).map((source) => <small key={source}>{sourceNames[source] || source}: {summary.sources?.[source]?.state === "limited" ? "выборка ограничена, подробности в карточке клиента" : "не удалось обновить"}</small>)}</div>
            <button type="button" disabled={busy || !onRetry} onClick={() => retry([client.id])}>Повторить</button>
          </li>;
        })}</ul> : null}
      </section>
    </details>
  </aside>;
}
