export default function RouteFallback() {
  return (
    <div className="clientRouteFallback" aria-hidden="true">
      <div className="clientRouteFallbackPanel">
        <span className="clientRouteFallbackSpinner" />
      </div>
    </div>
  );
}
