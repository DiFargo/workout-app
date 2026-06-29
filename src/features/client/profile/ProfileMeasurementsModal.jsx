export default function ProfileMeasurementsModal({
  open,
  latestMeasurement,
  measurementFields,
  formatMeasurementDate,
  getMeasurementValue,
  onClose,
  onStart
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="cabinetMeasurementModalOverlay"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="cabinetMeasurementModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cabinetMeasurementModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="cabinetMeasurementModalHead">
          <div>
            <span>КОНТРОЛЬ ТЕЛА</span>
            <h2 id="cabinetMeasurementModalTitle">Последний замер</h2>
            <small>{latestMeasurement ? formatMeasurementDate(latestMeasurement) : "Замеров пока нет"}</small>
          </div>
          <button
            type="button"
            aria-label="Закрыть замеры"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="cabinetMeasurementModalSummary">
          <span aria-hidden="true">⚖️</span>
          <p>Быстрый контроль веса и объёмов тела</p>
        </div>

        {latestMeasurement ? (
          <div className="cabinetMeasurementModalGrid">
            {measurementFields.map((field) => {
              const value = getMeasurementValue(latestMeasurement, field);

              return (
                <div key={field.id} aria-label={`${field.label}: ${value}`}>
                  <span>{field.label}</span>
                  <strong>{value}</strong>
                  <small>{field.unit}</small>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="cabinetMeasurementModalEmpty">
            Сделай первый контрольный замер, чтобы отслеживать изменения тела.
          </p>
        )}

        <button
          type="button"
          className="cabinetMeasurementModalStart"
          aria-label="Начать новый замер тела"
          onClick={onStart}
        >
          📏 Начать замер
        </button>
      </section>
    </div>
  );
}
