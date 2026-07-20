import styles from "./AccessDeniedScreen.module.css";

export default function AccessDeniedScreen({
  title = "Доступ закрыт",
  message,
  backLabel = "← Главное меню",
  onBack
}) {
  return (
    <div className={`${styles.root} app`}>
      {onBack && (
        <button className={`${styles.back} backBtn`} type="button" onClick={onBack}>
          {backLabel}
        </button>
      )}
      <div className={`${styles.card} historyEmptyCard`}>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
    </div>
  );
}
