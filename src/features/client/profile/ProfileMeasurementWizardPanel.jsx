import { APP_VERSION } from "../../../constants/appConfig";

const versionedMeasurementAsset = (src) => `${src}?v=${encodeURIComponent(APP_VERSION)}`;

export default function ProfileMeasurementWizardPanel({
  visible,
  open,
  latestMeasurement,
  measurementFields,
  draft,
  status,
  saving,
  step,
  formatMeasurementDate,
  getMeasurementValue,
  onToggle,
  onStart,
  onClose,
  onDraftChange,
  onPreviousStep,
  onNextStep,
  onSave
}) {
  if (!visible) {
    return null;
  }

  const totalWizardScreens = measurementFields.length + 2;
  const isIntroStep = step === 0;
  const isReviewStep = step === totalWizardScreens - 1;
  const activeField = !isIntroStep && !isReviewStep ? measurementFields[step - 1] : null;
  const progressPercent = Math.max(4, Math.round(((step + 1) / totalWizardScreens) * 100));

  return (
    <div className="profileMeasurementPanel profileAiMeasurementPanel profileMeasurementWizardPanel">
      <button
        type="button"
        className={open ? "profileMeasurementToggle open" : "profileMeasurementToggle"}
        onClick={onToggle}
      >
        <span>
          <strong>Контрольный замер</strong>
          <small>{open ? `Мастер замеров · ${totalWizardScreens} шагов` : "Последний замер и быстрый старт"}</small>
        </span>
        <em>{open ? "−" : "+"}</em>
      </button>

      {!open && (
        <div className="profileMeasurementPreview">
          <div className="profileMeasurementDashboardCard">
            <div className="profileMeasurementDashboardTop">
              <span>Контрольный замер</span>
              <strong>Последний замер</strong>
              <small>{formatMeasurementDate(latestMeasurement)}</small>
            </div>

            <div className="profileMeasurementDashboardIconWrap">
              <div className="profileMeasurementDashboardIcon">⚖️</div>
              <p>Быстрый контроль веса и объёмов тела</p>
            </div>
          </div>

          <div className="profileMeasurementLastGrid">
            {measurementFields.slice(0, 6).map((field) => (
              <div key={field.id}>
                <span>{field.label}</span>
                <strong>{getMeasurementValue(latestMeasurement, field)}</strong>
                <small>{field.unit}</small>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="profileMeasurementStartBtn"
            onClick={onStart}
          >
            📏 Начать замер
          </button>
        </div>
      )}

      {open && (
        <div className="profileMeasurementWizard">
          <div className="profileMeasurementWizardProgress">
            <span>Шаг {step + 1} из {totalWizardScreens}</span>
            <i><em style={{ width: `${progressPercent}%` }} /></i>
          </div>

          {isIntroStep && (
            <div className="profileMeasurementWizardCard intro">
              <button
                type="button"
                className="profileMeasurementWizardClose"
                aria-label="Закрыть замер"
                onClick={onClose}
              >
                ×
              </button>
              <div className="profileMeasurementWizardVisual">
                <img
                  src={versionedMeasurementAsset("/measurements/measurement_dashboard.webp")}
                  alt="Как выполнять замеры тела"
                  className="measurementIntroImage"
                  loading="eager"
                  decoding="async"
                />
              </div>

              <h3>Как выполнять замеры</h3>
              <p>Мерь утром, одной и той же лентой, в спокойном состоянии. Не втягивай живот и не затягивай ленту слишком сильно.</p>

              <div className="profileMeasurementTips">
                <span>Одинаковое время</span>
                <span>Одна лента</span>
                <span>Без натяжения</span>
                <span>Фото можно делать отдельно</span>
              </div>
            </div>
          )}

          {activeField && (
            <div className="profileMeasurementWizardCard measurementStepCard">
              <button
                type="button"
                className="profileMeasurementWizardClose"
                aria-label="Закрыть замер"
                onClick={onClose}
              >
                ×
              </button>
              <div className={`profileMeasurementImageFrame zone-${activeField.id}`}>
                <img
                  src={versionedMeasurementAsset(`/measurements/${activeField.id}.webp`)}
                  alt={activeField.label}
                  className="profileMeasurementImage"
                  loading="eager"
                />
              </div>

              <h3>{activeField.label}</h3>
              <p>{activeField.hint}</p>

              <label className="profileMeasurementWizardInput">
                <span className="profileMeasurementInputLabelHidden">{activeField.label}</span>
                <div>
                  <input
                    inputMode="decimal"
                    value={draft[activeField.id] || ""}
                    placeholder={activeField.placeholder}
                    onChange={(event) => onDraftChange(activeField.id, event.target.value)}
                  />
                  <em>{activeField.unit}</em>
                </div>
              </label>

              <small className="profileMeasurementPreviousValue">
                Прошлый раз: {getMeasurementValue(latestMeasurement, activeField)} {activeField.unit}
              </small>
            </div>
          )}

          {isReviewStep && (
            <div className="profileMeasurementWizardCard review">
              <button
                type="button"
                className="profileMeasurementWizardClose"
                aria-label="Закрыть замер"
                onClick={onClose}
              >
                ×
              </button>
              <h3>Проверь данные</h3>
              <p>Если всё верно — сохрани контрольный замер. Пустые поля можно оставить пустыми.</p>

              <div className="profileMeasurementReviewGrid">
                {measurementFields.map((field) => (
                  <div key={field.id}>
                    <span>{field.label}</span>
                    <strong>{draft[field.id] || "—"}</strong>
                    <small>{field.unit}</small>
                  </div>
                ))}
              </div>

              <label className="profileMeasurementNote wizardNote">
                <span>Заметка</span>
                <textarea
                  value={draft.note || ""}
                  placeholder="Например: утром, после тренировки, самочувствие..."
                  onChange={(event) => onDraftChange("note", event.target.value)}
                />
              </label>

              <button
                type="button"
                className="profileMeasurementSave"
                disabled={saving}
                onClick={onSave}
              >
                {saving ? "Сохраняю..." : "Сохранить замер"}
              </button>
            </div>
          )}

          <div className="profileMeasurementWizardNav">
            <button
              type="button"
              disabled={step === 0}
              onClick={onPreviousStep}
            >
              ← Назад
            </button>

            {!isReviewStep ? (
              <button
                type="button"
                className="next"
                onClick={() => onNextStep(totalWizardScreens)}
              >
                Вперёд →
              </button>
            ) : (
              <button
                type="button"
                className="next"
                disabled={saving}
                onClick={onSave}
              >
                Сохранить
              </button>
            )}
          </div>
        </div>
      )}

      {status && (
        <p className="profileMeasurementStatus">{status}</p>
      )}
    </div>
  );
}
