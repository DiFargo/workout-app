import styles from "./ProfileMeasurementWizardPanel.module.css";

export default function ProfileMeasurementWizardPanel({
  visible,
  latestMeasurement,
  measurementFields,
  formatMeasurementDate,
  getMeasurementValue,
  onStart
}) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className={styles.panel}
      data-css-module-scope="profile-measurement-panel"
      data-testid="profile-measurement-panel"
    >
      <div className={styles.preview}>
        <div className={styles.dashboardCard} data-testid="profile-measurement-dashboard">
          <div className={styles.dashboardTop}>
            <span>Контрольный замер</span>
            <strong>Последний замер</strong>
            <small>{formatMeasurementDate(latestMeasurement)}</small>
          </div>

          <div className={styles.iconWrap}>
            <div className={styles.icon}>⚖️</div>
            <p>Быстрый контроль веса и объёмов тела</p>
          </div>
        </div>

        <div className={styles.lastGrid}>
          {measurementFields.slice(0, 6).map((field) => (
            <div key={field.id} data-testid="profile-measurement-last-value">
              <span>{field.label}</span>
              <strong>{getMeasurementValue(latestMeasurement, field)}</strong>
              <small>{field.unit}</small>
            </div>
          ))}
        </div>

        <button
          type="button"
          className={styles.startButton}
          data-testid="profile-measurement-start"
          onClick={onStart}
        >
          📏 Начать замер
        </button>
      </div>
    </div>
  );
}
