import { getAiNutritionGoalLabel } from "../../../utils/aiNutritionLabels";
import { X } from "lucide-react";
import { useState } from "react";
import { APP_VERSION } from "../../../constants/appConfig";
import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import {
  getProfileMeasurementFields,
  getProfileMeasurementValue,
  PROFILE_MEASUREMENT_LIMITS,
  validateProfileMeasurementValue
} from "../../../utils/profileMeasurements";
import "./ClientMeasurements.module.css";
import adaptiveShellStyles from "../../../shared/ui/ClientAdaptiveShell.module.css";
import styles from "./MeasurementWizardPage.module.css";

const versionedMeasurementAsset = (src) => `${src}?v=${encodeURIComponent(APP_VERSION)}`;

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
  const [measurementMode, setMeasurementMode] = useState("full");
  const activeProfile = {
    ...(aiNutritionProfile || {}),
    ...aiNutritionProfileDraft
  };
  const latestProfileMeasurement = Array.isArray(profileMeasurements) && profileMeasurements.length
    ? profileMeasurements[0]
    : null;
  const allMeasurementFields = getProfileMeasurementFields(activeProfile?.goal || "recomp");
  const measurementFields = measurementMode === "weight"
    ? allMeasurementFields.filter((field) => field.id === "weight")
    : allMeasurementFields;
  const totalWizardScreens = measurementFields.length + 2;
  const isIntroStep = profileMeasurementWizardStep === 0;
  const isReviewStep = profileMeasurementWizardStep === totalWizardScreens - 1;
  const activeField = !isIntroStep && !isReviewStep ? measurementFields[profileMeasurementWizardStep - 1] : null;
  const activeFieldValidation = activeField
    ? validateProfileMeasurementValue(activeField, profileMeasurementDraft[activeField.id])
    : null;
  const activeFieldLimits = activeField ? PROFILE_MEASUREMENT_LIMITS[activeField.id] : null;
  const nextMeasurementField = measurementFields[profileMeasurementWizardStep] || null;
  const progressPercent = Math.max(4, Math.round(((profileMeasurementWizardStep + 1) / totalWizardScreens) * 100));

  const closeMeasurementWizard = () => {
    setMeasurementMode("full");
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
    if (isIntroStep) {
      setMeasurementMode("full");
      setProfileMeasurementStatus("");
      setProfileMeasurementWizardStep(1);
      return;
    }

    if (activeField) {
      const validation = validateProfileMeasurementValue(
        activeField,
        profileMeasurementDraft[activeField.id]
      );

      if (!validation.valid) {
        setProfileMeasurementStatus(validation.error);
        return;
      }

      if (!validation.empty && validation.value !== profileMeasurementDraft[activeField.id]) {
        setProfileMeasurementDraft((previous) => ({
          ...previous,
          [activeField.id]: validation.value
        }));
      }
    }

    if (!isReviewStep) {
      setProfileMeasurementStatus("");
      setProfileMeasurementWizardStep((step) => Math.min(totalWizardScreens - 1, step + 1));
      return;
    }

    saveProfileMeasurement();
  };

  const startWeightOnlyMeasurement = () => {
    setMeasurementMode("weight");
    setProfileMeasurementStatus("");
    setProfileMeasurementWizardStep(1);
  };

  const startFullMeasurement = () => {
    setMeasurementMode("full");
    setProfileMeasurementStatus("");
    setProfileMeasurementWizardStep(1);
  };

  return (
    <div
      className={`${styles.page} ${adaptiveShellStyles.shell}`}
      data-client-adaptive-shell="true"
      data-css-module-scope="measurement-wizard-page"
      data-testid="measurement-wizard-page"
    >
      <ClientPageHeader
        compact
        className={styles.header}
        title="Замеры тела"
        testId="measurement-wizard-header"
        scope="measurement-wizard-header"
        onBack={handleGoBack}
        backAriaLabel="Вернуться к предыдущему шагу"
        actions={(
          <button
            type="button"
            className={styles.close}
            onClick={closeMeasurementWizard}
            aria-label="Закрыть без сохранения"
          >
            <X aria-hidden="true" />
          </button>
        )}
      >
        <div className={styles.progress}>
          <span>Шаг {profileMeasurementWizardStep + 1} из {totalWizardScreens}</span>
          <i><em style={{ width: `${progressPercent}%` }} /></i>
        </div>
      </ClientPageHeader>

      <main className={styles.body}>
        {nextMeasurementField && (
          <img
            src={versionedMeasurementAsset(`/measurements/${nextMeasurementField.id}.webp`)}
            alt=""
            aria-hidden="true"
            className={styles.preload}
            loading="eager"
            decoding="async"
          />
        )}

        {isIntroStep && (
          <section
            className={`${styles.card} ${styles.introCard}`}
            data-testid="measurement-wizard-intro"
          >
            <div className={styles.introVisual}>
              <img
                src={versionedMeasurementAsset("/measurements/measurement_dashboard.webp")}
                alt="Как выполнять замеры тела"
                className={styles.introImage}
                loading="eager"
                decoding="async"
              />
            </div>

            <h2>Как выполнять замеры</h2>
            <p>Мерь утром, одной и той же лентой, в спокойном состоянии. Не втягивай живот и не затягивай ленту слишком сильно.</p>

            <div className={styles.tips}>
              <span>Одинаковое время</span>
              <span>Одна лента</span>
              <span>Без натяжения</span>
              <span>Фото можно делать отдельно</span>
            </div>

            <div className={styles.modeChoices} data-testid="measurement-wizard-mode-choices">
              <button type="button" onClick={startWeightOnlyMeasurement}>
                <strong>Только вес</strong>
                <small>Быстрая отметка без остальных замеров</small>
              </button>
              <button type="button" className={styles.fullMode} onClick={startFullMeasurement}>
                <strong>Полный замер</strong>
                <small>Вес и параметры тела</small>
              </button>
            </div>
          </section>
        )}

        {activeField && (
          <section
            className={`${styles.card} ${styles.measurementCard}`}
            data-testid="measurement-wizard-measurement"
          >
            <div
              className={styles.imageFrame}
              data-measurement-zone={activeField.id}
            >
              <img
                src={versionedMeasurementAsset(`/measurements/${activeField.id}.webp`)}
                alt={activeField.label}
                className={styles.image}
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </div>

            <div className={styles.text}>
              <h2>{activeField.label}</h2>
              <p>{activeField.hint}</p>
            </div>

            <label className={styles.input}>
              <div>
                <input
                  data-css-module-control
                  inputMode="decimal"
                  autoComplete="off"
                  value={profileMeasurementDraft[activeField.id] || ""}
                  placeholder="0"
                  aria-label={`${activeField.label}, ${activeField.unit}`}
                  aria-invalid={Boolean(activeFieldValidation && !activeFieldValidation.valid)}
                  aria-describedby={`measurement-${activeField.id}-range`}
                  maxLength={6}
                  onChange={(event) => {
                    setProfileMeasurementDraft((prev) => ({ ...prev, [activeField.id]: event.target.value }));
                    if (profileMeasurementStatus) setProfileMeasurementStatus("");
                  }}
                />
                <em>{activeField.unit}</em>
              </div>
            </label>

            {activeFieldLimits && (
              <small
                className={styles.rangeHint}
                id={`measurement-${activeField.id}-range`}
              >
                Допустимо: {activeFieldLimits.min}–{activeFieldLimits.max} {activeField.unit}
              </small>
            )}

            <small className={styles.previous}>
              Прошлый раз: {getProfileMeasurementValue(latestProfileMeasurement, activeField)} {activeField.unit}
            </small>
          </section>
        )}

        {isReviewStep && (
          <section
            className={`${styles.card} ${styles.reviewCard}`}
            data-testid="measurement-wizard-review"
          >
            <h2>Проверь данные</h2>
            <p>Если всё верно — сохрани контрольный замер. Пустые поля можно оставить пустыми.</p>

            <div className={styles.reviewGrid}>
              {measurementFields.map((field) => (
                <div key={field.id} data-testid="measurement-wizard-review-cell">
                  <span>{field.label}</span>
                  <strong>{profileMeasurementDraft[field.id] || "Не указано"}</strong>
                  <small>{field.unit}</small>
                </div>
              ))}
            </div>

            <label className={styles.note}>
              <span>Заметка</span>
              <textarea
                data-css-module-control
                value={profileMeasurementDraft.note || ""}
                placeholder={`Например: ${getAiNutritionGoalLabel(activeProfile?.goal || "recomp")} / ${activeField ? activeField.label : "замеры"}`}
                onChange={(event) => setProfileMeasurementDraft((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
          </section>
        )}
      </main>

      {profileMeasurementStatus && (
        <p className={styles.status} role="status" aria-live="polite">{profileMeasurementStatus}</p>
      )}

      <div className={styles.navigation} data-testid="measurement-wizard-navigation">
        <button
          type="button"
          onClick={handleGoBack}
        >
          ← Назад
        </button>

        <button
          type="button"
          className={styles.next}
          disabled={isReviewStep && profileMeasurementSaving}
          onClick={handleGoNext}
        >
          {isIntroStep
            ? "Полный замер →"
            : (!isReviewStep ? "Вперёд →" : (profileMeasurementStatus.startsWith("Замер сохранён") ? "Сохранено ✓" : "Сохранить"))}
        </button>
      </div>
    </div>
  );
}
