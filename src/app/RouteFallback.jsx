export default function RouteFallback() {
  return (
    <div className="clientRouteFallback" role="status" aria-live="polite" aria-label="Загрузка приложения">
      <div className="clientRouteFallbackPanel">
        <span className="clientRouteFallbackSpinner" aria-hidden="true" />
        <span className="clientRouteFallbackText">Загрузка приложения</span>
      </div>
    </div>
  );
}
