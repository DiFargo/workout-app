import { AppSplash } from "../components/auth/AuthScreens";
import ClientPageHeader from "../shared/ui/ClientPageHeader.jsx";
import styles from "./RouteFallback.module.css";

export default function RouteFallback({ title, renderBottomBar, activeTab, error, onRetry }) {
  if (!title) return <AppSplash />;
  return <div className={styles.page} aria-busy={!error} data-testid="route-loading">
    <ClientPageHeader title={title} />
    <section className={styles.content} role="status" aria-live="polite">
      <p>{error ? "Не удалось загрузить раздел. Сохранённые записи остались на устройстве." : "Загружаем раздел…"}</p>
      {error ? <button type="button" className={styles.retry} onClick={onRetry}>Повторить загрузку</button> : <>
        <div className={styles.placeholder} aria-hidden="true" />
        <div className={styles.placeholder} aria-hidden="true" />
      </>}
    </section>
    {renderBottomBar?.(activeTab)}
  </div>;
}
