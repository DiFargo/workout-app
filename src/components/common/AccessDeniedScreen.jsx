export default function AccessDeniedScreen({
  title = "Доступ закрыт",
  message,
  backLabel = "← Главное меню",
  onBack
}) {
  return (
    <div className="app">
      {onBack && (
        <button className="backBtn" onClick={onBack}>
          {backLabel}
        </button>
      )}
      <div className="historyEmptyCard">
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
    </div>
  );
}
