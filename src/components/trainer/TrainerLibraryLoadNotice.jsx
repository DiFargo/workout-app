import { CircleAlert, LoaderCircle } from "lucide-react";
import { getTrainerLibraryViewState } from "../../utils/trainerLibraryLoadState.js";
import styles from "./TrainerLibraryLoadNotice.module.css";

export default function TrainerLibraryLoadNotice({ state, kind = "templates", hasItems = false, onRetry }) {
  const view = getTrainerLibraryViewState(state, kind);
  if (view.complete) return null;
  const noun = kind === "exercises" ? "упражнения" : "шаблоны";
  const title = view.error
    ? `Не удалось ${hasItems ? "полностью загрузить" : "загрузить"} ${noun}`
    : `${hasItems ? "Обновляем" : "Загружаем"} ${noun}…`;
  const description = view.error
    ? hasItems
      ? "Показаны доступные данные. Повторите загрузку, чтобы получить полный список."
      : "Проверьте подключение к интернету и повторите загрузку."
    : hasItems
      ? "Показываем ранее загруженные данные, пока получаем актуальные."
      : "Получаем актуальные данные библиотеки.";
  const Icon = view.error ? CircleAlert : LoaderCircle;

  return <section className={`${styles.notice}${view.error ? ` ${styles.error}` : ""}`}
    role={view.error ? "alert" : "status"} aria-busy={view.loading} aria-atomic="true">
    <Icon className={`${styles.icon}${view.loading ? ` ${styles.loadingIcon}` : ""}`} size={22} aria-hidden="true" />
    <div className={styles.copy}><strong>{title}</strong><p>{description}</p></div>
    {view.error ? <button className={styles.retry} type="button" disabled={typeof onRetry !== "function"}
      onClick={event => { event.stopPropagation(); onRetry?.(); }}>Повторить загрузку</button> : null}
  </section>;
}
