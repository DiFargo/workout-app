import { getAiNutritionGoalLabel } from "../../../utils/aiNutritionLabels";
import {
  getProfileMeasurementFields,
  getProfileMeasurementValue
} from "../../../utils/profileMeasurements";

export default function MeasurementWizardPage({
  aiNutritionProfile,
  aiNutritionProfileDraft,
  profileMeasurements,
  profileMeasurementWizardStep,
  profileMeasurementDraft,
  profileMeasurementStatus,
  profileMeasurementSaving,
  setProfileMeasurementDraft,
  setProfileMeasurementStatus,
  setProfileMeasurementWizardStep,
  setProfileMeasurementOpen,
  setProfileActiveTab,
  profileMeasurementReturnTab,
  saveProfileMeasurement,
  onNavigateProfilePage,
  setPage
}) {
  const activeProfile = {
    ...(aiNutritionProfile || {}),
    ...aiNutritionProfileDraft
  };
  const latestProfileMeasurement = Array.isArray(profileMeasurements) && profileMeasurements.length
    ? profileMeasurements[0]
    : null;
  const measurementFields = getProfileMeasurementFields(activeProfile?.goal || "recomp");
  const totalWizardScreens = measurementFields.length + 2;
  const isIntroStep = profileMeasurementWizardStep === 0;
  const isReviewStep = profileMeasurementWizardStep === totalWizardScreens - 1;
  const activeField = !isIntroStep && !isReviewStep ? measurementFields[profileMeasurementWizardStep - 1] : null;
  const nextMeasurementField = measurementFields[profileMeasurementWizardStep] || null;
  const progressPercent = Math.max(4, Math.round(((profileMeasurementWizardStep + 1) / totalWizardScreens) * 100));

  const closeMeasurementWizard = () => {
    setProfileMeasurementDraft({
      weight: "",
      neck: "",
      shoulders: "",
      chest: "",
      biceps: "",
      forearm: "",
      wrist: "",
      belly: "",
      pelvis: "",
      thigh: "",
      calf: "",
      ankle: "",
      note: ""
    });
    setProfileMeasurementStatus("");
    setProfileMeasurementWizardStep(0);
    setProfileMeasurementOpen(false);
    setProfileActiveTab(profileMeasurementReturnTab);

    if (typeof setPage === "function") {
      setPage("profile");
      return;
    }

    if (typeof onNavigateProfilePage === "function") {
      onNavigateProfilePage();
    }
  };

  const handleGoBack = () => {
    if (profileMeasurementWizardStep === 0) {
      closeMeasurementWizard();
      return;
    }

    setProfileMeasurementWizardStep((step) => Math.max(0, step - 1));
  };

  const handleGoNext = () => {
    if (!isReviewStep) {
      setProfileMeasurementWizardStep((step) => Math.min(totalWizardScreens - 1, step + 1));
      return;
    }

    saveProfileMeasurement();
  };

  return (
    <div className="measurementFullscreenPage">
      <div className="measurementFullscreenHeader">
        <div className="measurementFullscreenProgress">
          <span>Шаг {profileMeasurementWizardStep + 1} из {totalWizardScreens}</span>
          <i><em style={{ width: `${progressPercent}%` }} /></i>
        </div>
        <button
          type="button"
          className="measurementFullscreenClose"
          onClick={closeMeasurementWizard}
          aria-label="Закрыть без сохранения"
        >
          ×
        </button>
      </div>

      <main className="measurementFullscreenBody">
        {nextMeasurementField && (
          <img
            src={`/measurements/${nextMeasurementField.id}.webp`}
            alt=""
            aria-hidden="true"
            className="measurementFullscreenPreload"
            loading="eager"
            decoding="async"
          />
        )}

        {isIntroStep && (
          <section className="measurementFullscreenCard intro">
            <div className="profileMeasurementWizardVisual measurementIntroVisual">
              <div className="profileMeasurementMiniHuman">
                <i />
                <b />
                <em />
              </div>
            </div>

            <h2>Как выполнять замеры</h2>
            <p>Мерь утром, одной и той же лентой, в спокойном состоянии. Не втягивай живот и не затягивай ленту слишком сильно.</p>

            <div className="profileMeasurementTips">
              <span>Одинаковое время</span>
              <span>Одна лента</span>
              <span>Без натяжения</span>
              <span>Фото можно делать отдельно</span>
            </div>
          </section>
        )}

        {activeField && (
          <section className="measurementFullscreenCard measurement">
            <div className={`measurementFullscreenImageFrame zone-${activeField.id}`}>
              <img
                src={`/measurements/${activeField.id}.webp`}
                alt={activeField.label}
                className="measurementFullscreenImage"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </div>

            <div className="measurementFullscreenText">
              <h2>{activeField.label}</h2>
              <p>{activeField.hint}</p>
            </div>

            <label className="measurementFullscreenInput">
              <div>
                <input
                  inputMode="decimal"
                  value={profileMeasurementDraft[activeField.id] || ""}
                  placeholder="0"
                  onChange={(event) => setProfileMeasurementDraft((prev) => ({ ...prev, [activeField.id]: event.target.value }))}
                />
                <em>{activeField.unit}</em>
              </div>
            </label>

            <small className="measurementFullscreenPrevious">
              Прошлый раз: {getProfileMeasurementValue(latestProfileMeasurement, activeField)} {activeField.unit}
            </small>
          </section>
        )}

        {isReviewStep && (
          <section className="measurementFullscreenCard review">
            <h2>Проверь данные</h2>
            <p>Если всё верно — сохрани контрольный замер. Пустые поля можно оставить пустыми.</p>

            <div className="measurementFullscreenReviewGrid">
              {measurementFields.map((field) => (
                <div key={field.id}>
                  <span>{field.label}</span>
                  <strong>{profileMeasurementDraft[field.id] || "0"}</strong>
                  <small>{field.unit}</small>
                </div>
              ))}
            </div>

            <label className="profileMeasurementNote wizardNote">
              <span>Заметка</span>
              <textarea
                value={profileMeasurementDraft.note || ""}
                placeholder={`Например: ${getAiNutritionGoalLabel(activeProfile?.goal || "recomp")} / ${activeField ? activeField.label : "замеры"}`}
                onChange={(event) => setProfileMeasurementDraft((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
          </section>
        )}
      </main>

      {profileMeasurementStatus && (
        <p className="measurementFullscreenStatus">{profileMeasurementStatus}</p>
      )}

      <div className="measurementFullscreenNav">
        <button
          type="button"
          onClick={handleGoBack}
        >
          ← Назад
        </button>

        <button
          type="button"
          className="next"
          disabled={isReviewStep && profileMeasurementSaving}
          onClick={handleGoNext}
        >
          {!isReviewStep ? "Вперёд →" : (profileMeasurementStatus.startsWith("Замер сохранён") ? "Сохранено ✓" : "Сохранить")}
        </button>
      </div>
    </div>
  );
}

