import { useEffect, useState } from "react";

import { hasRequiredAiNutritionProfileFields } from "../../utils/profileDefaults";

const TOTAL_STEPS = 10;

const ACTIVITY_OPTIONS = [
  ["low", "🪑", "Минимальный", "Мало движения"],
  ["medium", "🚶", "Умеренный", "1–3 тренировки в неделю"],
  ["high", "🏃", "Активный", "3–5 тренировок в неделю"],
  ["veryHigh", "🏋️", "Очень активный", "Спорт почти каждый день"]
];

const GOAL_OPTIONS = [
  ["cut", "🔥", "Похудение", "Снизить вес"],
  ["mass", "💪", "Набор массы", "Набрать мышечную массу"],
  ["recomp", "🔄", "Рекомпозиция", "Снизить жир и набрать мышцы"],
  ["maintain", "🌿", "Поддержание формы", "Сохранить текущую форму"]
];

const ONBOARDING_TITLES = [
  "Добро пожаловать!",
  "Выберите пол",
  "Как вас зовут?",
  "Сколько вам лет?",
  "Ваш текущий вес",
  "Ваш рост",
  "Уровень активности",
  "Ваша цель",
  "Целевой вес",
  "Проверьте ваши данные"
];

const ONBOARDING_SUBTITLES = [
  "Давайте настроим ваш профиль, чтобы тренировки и рекомендации были максимально точными.",
  "Это поможет учитывать ваши особенности.",
  "Введите ваше имя.",
  "Введите ваш возраст.",
  "Введите ваш текущий вес.",
  "Введите ваш рост.",
  "Выберите, насколько вы активны.",
  "Выберите вашу основную цель.",
  "Укажите вес, к которому будем вести питание и прогресс.",
  "Проверьте и подтвердите данные перед созданием профиля."
];

const NUMBER_SLIDER_CONFIG = {
  age: { label: "Возраст", min: 14, max: 80, step: 1, unit: "лет", fallback: 30, marks: ["14", "30", "80"] },
  weight: { label: "Текущий вес", min: 40, max: 250, step: 0.1, unit: "кг", fallback: 80, marks: ["40", "80", "250"] },
  height: { label: "Рост", min: 140, max: 210, step: 1, unit: "см", fallback: 175, marks: ["140", "175", "210"] },
  targetWeight: { label: "Целевой вес", min: 40, max: 250, step: 0.1, unit: "кг", fallback: 75, marks: ["40", "75", "250"] }
};

const METRIC_STEP_FIELDS = {
  3: "age",
  4: "weight",
  5: "height",
  8: "targetWeight"
};

function normalizeNumberValue(value) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function formatNumberValue(value, step = 1) {
  const number = normalizeNumberValue(value);
  if (number === null) return "";
  return Number(step) < 1
    ? number.toFixed(1).replace(/\.0$/, "")
    : String(Math.round(number));
}

function getSuggestedTargetWeight(profileDraft) {
  const currentWeight = normalizeNumberValue(profileDraft.weight);
  if (!currentWeight) return NUMBER_SLIDER_CONFIG.targetWeight.fallback;

  const multiplier = profileDraft.goal === "mass"
    ? 1.08
    : profileDraft.goal === "cut"
      ? 0.9
      : 1;

  const suggested = Math.round(currentWeight * multiplier * 10) / 10;
  return Math.min(NUMBER_SLIDER_CONFIG.targetWeight.max, Math.max(NUMBER_SLIDER_CONFIG.targetWeight.min, suggested));
}

function FirstSetupMetricSlider({ field, value, onChange, fallback }) {
  const config = NUMBER_SLIDER_CONFIG[field];
  const safeFallback = fallback ?? config.fallback;
  const numericValue = normalizeNumberValue(value);
  const sliderValue = numericValue ?? safeFallback;
  const rangeValue = Math.min(config.max, Math.max(config.min, sliderValue));
  const sliderProgress = Math.min(
    100,
    Math.max(0, ((rangeValue - config.min) / (config.max - config.min)) * 100)
  );

  return (
    <label className="firstSetupMetricSlider" style={{ "--slider-progress": `${sliderProgress}%` }}>
      <span className="firstSetupMetricLabel">{config.label}</span>
      <strong className="firstSetupMetricValue">{formatNumberValue(sliderValue, config.step)} <small>{config.unit}</small></strong>
      <input
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={rangeValue}
        onChange={(event) => onChange(formatNumberValue(event.target.value, config.step))}
      />
      <div className="firstSetupMetricTicks" aria-hidden="true">
        {Array.from({ length: 21 }, (_, index) => <i key={index} />)}
      </div>
      <div className="firstSetupMetricMarks" aria-hidden="true">
        {(config.marks || [config.min, safeFallback, config.max]).map((mark) => <span key={mark}>{mark}</span>)}
      </div>
      <div className="firstSetupMetricInput">
        <input
          inputMode={config.step < 1 ? "decimal" : "numeric"}
          type="number"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        />
        <em>{config.unit}</em>
      </div>
    </label>
  );
}

export default function FirstSetupOnboarding({
  open,
  onboardingStep,
  profileDraft,
  saveStatus,
  setOnboardingStep,
  setProfileDraft,
  onSubmit,
  onExit
}) {
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);

  const profileName = String(profileDraft.name || "").trim();
  const numericAge = Number(profileDraft.age);
  const numericWeight = Number(String(profileDraft.weight || "").replace(",", "."));
  const numericHeight = Number(profileDraft.height);
  const numericTargetWeight = Number(String(profileDraft.targetWeight || "").replace(",", "."));
  const targetWeightIsValid = Number.isFinite(numericTargetWeight) && numericTargetWeight >= 30 && numericTargetWeight <= 350;
  const stepCanContinue = [
    true,
    profileDraft.sex === "male" || profileDraft.sex === "female",
    profileName.length >= 2,
    Number.isFinite(numericAge) && numericAge >= 14 && numericAge <= 100,
    Number.isFinite(numericWeight) && numericWeight >= 30 && numericWeight <= 350,
    Number.isFinite(numericHeight) && numericHeight >= 120 && numericHeight <= 230,
    ["low", "medium", "high", "veryHigh"].includes(profileDraft.activity),
    ["cut", "mass", "recomp", "maintain"].includes(profileDraft.goal),
    targetWeightIsValid,
    hasRequiredAiNutritionProfileFields(profileDraft) && targetWeightIsValid
  ][onboardingStep];

  const goalLabel = GOAL_OPTIONS.find(([id]) => id === profileDraft.goal)?.[2] || "Рекомпозиция";
  const activityLabel = ACTIVITY_OPTIONS.find(([id]) => id === profileDraft.activity)?.[2] || "Умеренный";

  function updateProfileDraft(patch) {
    setProfileDraft((prev) => ({ ...prev, ...patch }));
  }

  useEffect(() => {
    const field = METRIC_STEP_FIELDS[onboardingStep];
    if (!field || profileDraft[field]) return;

    const fallback = field === "targetWeight"
      ? getSuggestedTargetWeight(profileDraft)
      : NUMBER_SLIDER_CONFIG[field].fallback;

    setProfileDraft((prev) => (
      prev[field]
        ? prev
        : { ...prev, [field]: formatNumberValue(fallback, NUMBER_SLIDER_CONFIG[field].step) }
    ));
  }, [
    onboardingStep,
    profileDraft.age,
    profileDraft.weight,
    profileDraft.height,
    profileDraft.targetWeight,
    profileDraft.goal,
    setProfileDraft
  ]);

  function handleFieldSubmit(event) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    if (!stepCanContinue) return;

    event.currentTarget.blur();
    setOnboardingStep((currentStep) => Math.min(currentStep + 1, TOTAL_STEPS - 1));
  }

  if (!open) return null;

  return (
    <div className="firstSetupOverlay">
      <div className="firstSetupCard">
        <button
          type="button"
          className="firstSetupExitButton"
          aria-label="Выйти из опросника"
          onClick={() => setExitConfirmOpen(true)}
        >
          ×
        </button>

        <div className="firstSetupProgress">
          <span>{onboardingStep + 1} / {TOTAL_STEPS}</span>
          <div>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <i className={index <= onboardingStep ? "active" : ""} key={index} />
            ))}
          </div>
        </div>

        <header className="firstSetupHeader">
          <h2>{ONBOARDING_TITLES[onboardingStep]}</h2>
          <p>{ONBOARDING_SUBTITLES[onboardingStep]}</p>
        </header>

        <div className="firstSetupBody">
          {onboardingStep === 0 && (
            <div className="firstSetupWelcomeVisual" aria-hidden="true">
              <span className="firstSetupClipboard">📋</span>
              <span className="firstSetupDumbbell">🏋️</span>
              <span className="firstSetupApple">🍏</span>
              <span className="firstSetupBottle">🧴</span>
            </div>
          )}

          {onboardingStep === 1 && (
            <div className="firstSetupChoiceGrid firstSetupSexGrid">
              <button
                type="button"
                className={profileDraft.sex === "male" ? "active" : ""}
                onClick={() => updateProfileDraft({ sex: "male" })}
              >
                <span>👨🏻</span>
                <strong>Мужчина</strong>
              </button>

              <button
                type="button"
                className={profileDraft.sex === "female" ? "active" : ""}
                onClick={() => updateProfileDraft({ sex: "female" })}
              >
                <span>👩🏻</span>
                <strong>Женщина</strong>
              </button>
            </div>
          )}

          {onboardingStep === 2 && (
            <label className="firstSetupField">
              <span>Ваше имя</span>
              <input
                className="firstSetupInput"
                placeholder="Например, Илья"
                type="text"
                autoComplete="name"
                enterKeyHint="next"
                value={profileDraft.name || ""}
                onChange={(event) => updateProfileDraft({ name: event.target.value })}
                onKeyDown={handleFieldSubmit}
              />
            </label>
          )}

          {onboardingStep === 3 && (
            <FirstSetupMetricSlider
              field="age"
              value={profileDraft.age}
              onChange={(value) => updateProfileDraft({ age: value })}
            />
          )}

          {onboardingStep === 4 && (
            <FirstSetupMetricSlider
              field="weight"
              value={profileDraft.weight}
              onChange={(value) => updateProfileDraft({ weight: value })}
            />
          )}

          {onboardingStep === 5 && (
            <FirstSetupMetricSlider
              field="height"
              value={profileDraft.height}
              onChange={(value) => updateProfileDraft({ height: value })}
            />
          )}

          {onboardingStep === 6 && (
            <div className="firstSetupActivityList">
              {ACTIVITY_OPTIONS.map(([id, icon, label, description]) => (
                <button
                  type="button"
                  key={id}
                  className={profileDraft.activity === id ? "active" : ""}
                  onClick={() => updateProfileDraft({ activity: id })}
                >
                  <span>{icon}</span>
                  <span><strong>{label}</strong><small>{description}</small></span>
                  <i aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {onboardingStep === 7 && (
            <div className="firstSetupGoalStep">
              <div className="firstSetupGoalGrid">
                {GOAL_OPTIONS.map(([id, icon, label, description]) => (
                  <button
                    type="button"
                    key={id}
                    className={profileDraft.goal === id ? "active" : ""}
                    onClick={() => updateProfileDraft({ goal: id })}
                  >
                    <span>{icon}</span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          {onboardingStep === 8 && (
            <FirstSetupMetricSlider
              field="targetWeight"
              value={profileDraft.targetWeight}
              fallback={getSuggestedTargetWeight(profileDraft)}
              onChange={(value) => updateProfileDraft({ targetWeight: value })}
            />
          )}

          {onboardingStep === 9 && (
            <div className="firstSetupReview">
              {[
                ["⚥", "Пол", profileDraft.sex === "female" ? "Женщина" : "Мужчина"],
                ["👤", "Имя", profileName || "—"],
                ["🎂", "Возраст", `${profileDraft.age || "—"} лет`],
                ["⚖️", "Вес", `${profileDraft.weight || "—"} кг`],
                ["📏", "Рост", `${profileDraft.height || "—"} см`],
                ["🏃", "Уровень активности", activityLabel],
                ["🎯", "Цель", goalLabel],
                ["↔", "Целевой вес", profileDraft.targetWeight ? `${profileDraft.targetWeight} кг` : "Не указан"]
              ].map(([icon, label, value]) => (
                <div key={label}>
                  <span>{icon}</span>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="firstSetupBottom">
          {onboardingStep > 0 && (
            <button
              type="button"
              className="firstSetupSecondary"
              onClick={() => setOnboardingStep((prev) => prev - 1)}
            >
              Назад
            </button>
          )}

          {onboardingStep < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              className="firstSetupPrimary"
              disabled={!stepCanContinue}
              onClick={() => setOnboardingStep((prev) => prev + 1)}
            >
              {onboardingStep === 0 ? "Начать" : "Далее"}
            </button>
          ) : (
            <button
              type="button"
              className="firstSetupPrimary"
              disabled={!hasRequiredAiNutritionProfileFields(profileDraft) || !targetWeightIsValid || saveStatus === "saving"}
              onClick={onSubmit}
            >
              {saveStatus === "saving"
                ? "Сохраняю..."
                : saveStatus === "error"
                  ? "Повторить сохранение"
                  : "Создать профиль"}
            </button>
          )}
        </div>

        {exitConfirmOpen && (
          <div className="firstSetupExitConfirm" role="dialog" aria-modal="true">
            <div className="firstSetupExitConfirmCard">
              <h3>Выйти из опросника?</h3>
              <p>Данные этого шага не сохранятся. Ты вернёшься на экран авторизации.</p>
              <div>
                <button type="button" onClick={() => setExitConfirmOpen(false)}>Остаться</button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setExitConfirmOpen(false);
                    onExit?.();
                  }}
                >
                  Выйти
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
