export default function RouteFallback() {
  return (
    <div className="clientRouteFallback" role="status" aria-live="polite" aria-label="Загрузка приложения">
      <span className="clientRouteFallbackText">Загрузка приложения</span>
    </div>
  );
}
