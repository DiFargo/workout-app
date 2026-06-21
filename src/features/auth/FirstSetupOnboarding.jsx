import { hasRequiredAiNutritionProfileFields } from "../../utils/profileDefaults";

const TOTAL_STEPS = 9;

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
  "Проверьте и подтвердите данные перед созданием профиля."
];

export default function FirstSetupOnboarding({
  open,
  onboardingStep,
  profileDraft,
  saveStatus,
  setOnboardingStep,
  setProfileDraft,
  onSubmit
}) {
  if (!open) return null;

  const profileName = String(profileDraft.name || "").trim();
  const numericAge = Number(profileDraft.age);
  const numericWeight = Number(String(profileDraft.weight || "").replace(",", "."));
  const numericHeight = Number(profileDraft.height);
  const stepCanContinue = [
    true,
    profileDraft.sex === "male" || profileDraft.sex === "female",
    profileName.length >= 2,
    Number.isFinite(numericAge) && numericAge >= 14 && numericAge <= 100,
    Number.isFinite(numericWeight) && numericWeight >= 30 && numericWeight <= 350,
    Number.isFinite(numericHeight) && numericHeight >= 120 && numericHeight <= 230,
    ["low", "medium", "high", "veryHigh"].includes(profileDraft.activity),
    ["cut", "mass", "recomp", "maintain"].includes(profileDraft.goal),
    hasRequiredAiNutritionProfileFields(profileDraft)
  ][onboardingStep];

  const goalLabel = GOAL_OPTIONS.find(([id]) => id === profileDraft.goal)?.[2] || "Рекомпозиция";
  const activityLabel = ACTIVITY_OPTIONS.find(([id]) => id === profileDraft.activity)?.[2] || "Умеренный";

  function updateProfileDraft(patch) {
    setProfileDraft((prev) => ({ ...prev, ...patch }));
  }

  function handleFieldSubmit(event) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    if (!stepCanContinue) return;

    event.currentTarget.blur();
    setOnboardingStep((currentStep) => Math.min(currentStep + 1, TOTAL_STEPS - 1));
  }

  return (
    <div className="firstSetupOverlay">
      <div className="firstSetupCard">
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
            <label className="firstSetupField">
              <span>Возраст</span>
              <div className="firstSetupInputWithUnit">
                <input
                  className="firstSetupInput"
                  inputMode="numeric"
                  placeholder="0"
                  type="number"
                  min="14"
                  max="100"
                  enterKeyHint="next"
                  value={profileDraft.age || ""}
                  onChange={(event) => updateProfileDraft({ age: event.target.value })}
                  onKeyDown={handleFieldSubmit}
                />
                <em>лет</em>
              </div>
            </label>
          )}

          {onboardingStep === 4 && (
            <label className="firstSetupField">
              <span>Вес</span>
              <div className="firstSetupInputWithUnit">
                <input
                  className="firstSetupInput"
                  inputMode="decimal"
                  placeholder="0"
                  type="number"
                  min="30"
                  max="350"
                  step="0.1"
                  enterKeyHint="next"
                  value={profileDraft.weight || ""}
                  onChange={(event) => updateProfileDraft({ weight: event.target.value })}
                  onKeyDown={handleFieldSubmit}
                />
                <em>кг</em>
              </div>
            </label>
          )}

          {onboardingStep === 5 && (
            <label className="firstSetupField">
              <span>Рост</span>
              <div className="firstSetupInputWithUnit">
                <input
                  className="firstSetupInput"
                  inputMode="numeric"
                  placeholder="0"
                  type="number"
                  min="120"
                  max="230"
                  enterKeyHint="next"
                  value={profileDraft.height || ""}
                  onChange={(event) => updateProfileDraft({ height: event.target.value })}
                  onKeyDown={handleFieldSubmit}
                />
                <em>см</em>
              </div>
            </label>
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
              <label className="firstSetupField firstSetupTargetWeight">
                <span>Желаемый вес <small>(необязательно)</small></span>
                <div className="firstSetupInputWithUnit">
                  <input
                    className="firstSetupInput"
                    inputMode="decimal"
                    placeholder="Например, 75"
                    type="number"
                    min="30"
                    max="350"
                    step="0.1"
                    enterKeyHint="next"
                    value={profileDraft.targetWeight || ""}
                    onChange={(event) => updateProfileDraft({ targetWeight: event.target.value })}
                    onKeyDown={handleFieldSubmit}
                  />
                  <em>кг</em>
                </div>
              </label>
            </div>
          )}

          {onboardingStep === 8 && (
            <div className="firstSetupReview">
              {[
                ["⚥", "Пол", profileDraft.sex === "female" ? "Женщина" : "Мужчина"],
                ["👤", "Имя", profileName || "—"],
                ["🎂", "Возраст", `${profileDraft.age || "—"} лет`],
                ["⚖️", "Вес", `${profileDraft.weight || "—"} кг`],
                ["📏", "Рост", `${profileDraft.height || "—"} см`],
                ["🏃", "Уровень активности", activityLabel],
                ["🎯", "Цель", goalLabel],
                ["↔", "Желаемый вес", profileDraft.targetWeight ? `${profileDraft.targetWeight} кг` : "Не указан"]
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
              disabled={!hasRequiredAiNutritionProfileFields(profileDraft) || saveStatus === "saving"}
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
      </div>
    </div>
  );
}
