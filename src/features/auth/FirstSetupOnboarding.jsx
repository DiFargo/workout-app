import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Apple,
  Armchair,
  CakeSlice,
  Check,
  Dumbbell,
  Flame,
  Footprints,
  Leaf,
  PersonStanding,
  MoveHorizontal,
  RefreshCcw,
  Ruler,
  Scale,
  Target,
  UserRound,
  X
} from "lucide-react";
import styles from "./FirstSetupOnboarding.module.css";
import {
  ageToCenteredSlider,
  centeredSliderToAge,
  getWeightSliderWindow
} from "./firstSetupMetricScale.js";

import { hasRequiredAiNutritionProfileFields } from "../../utils/profileDefaults";
import { limitUserDisplayName, MAX_USER_DISPLAY_NAME_LENGTH } from "../../utils/userDisplayName.js";

const MAX_PROFILE_NAME_LENGTH = MAX_USER_DISPLAY_NAME_LENGTH;

const TOTAL_STEPS = 10;

const ACTIVITY_OPTIONS = [
  ["low", Armchair, "Минимальный", "Мало движения"],
  ["medium", Footprints, "Умеренный", "1–3 тренировки в неделю"],
  ["high", Activity, "Активный", "3–5 тренировок в неделю"],
  ["veryHigh", Dumbbell, "Очень активный", "Спорт почти каждый день"]
];

const GOAL_OPTIONS = [
  ["cut", Flame, "Похудение", "Снизить вес"],
  ["mass", Dumbbell, "Набор массы", "Набрать мышечную массу"],
  ["recomp", RefreshCcw, "Рекомпозиция", "Снизить жир и набрать мышцы"],
  ["maintain", Leaf, "Поддержание формы", "Сохранить текущую форму"]
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
  "Так к вам будут обращаться в приложении.",
  "Введите ваш возраст.",
  "Введите ваш текущий вес.",
  "Введите ваш рост.",
  "Выберите, насколько вы активны.",
  "Выберите вашу основную цель.",
  "Укажите вес, к которому будем вести питание и прогресс.",
  "Проверьте и подтвердите данные перед созданием профиля."
];

const NUMBER_SLIDER_CONFIG = {
  age: { label: "Возраст", min: 14, max: 80, step: 1, unit: "лет", fallback: 35, marks: ["14", "35", "80"] },
  weight: { label: "Текущий вес", min: 40, max: 250, step: 0.1, unit: "кг", fallback: 80 },
  height: { label: "Рост", min: 140, max: 210, step: 1, unit: "см", fallback: 175, marks: ["140", "175", "210"] },
  targetWeight: { label: "Целевой вес", min: 40, max: 250, step: 0.1, unit: "кг", fallback: 75, marks: ["40", "75", "250"] }
};

const METRIC_STEP_FIELDS = {
  3: "age",
  4: "weight",
  5: "height",
  8: "targetWeight"
};

function FirstSetupSexIllustration({ sex }) {
  const isFemale = sex === "female";

  return (
    <svg className={styles.firstSetupSexIllustration} data-sex-portrait={sex} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="32" fill="var(--setup-muted)" />
      {isFemale ? (
        <>
          <path d="M15 30c-3-15 4-24 17-24s20 9 17 24l-2 20 7 14H10l7-14z" fill="#40515b" />
          <path d="M27 36h10v10H27z" fill="#e8b893" />
          <path d="M8 64c1-12 9-19 20-20l4 4 4-4c12 1 19 8 20 20z" fill="#4d8585" />
          <ellipse cx="32" cy="24" rx="10" ry="12" fill="#f2c6a4" />
          <path d="M22 22c1-9 5-14 11-14 7 0 11 5 11 14-4-1-8-4-11-7-3 4-7 6-11 7z" fill="#40515b" />
          <path d="M20 22c0 9 0 15-4 21 4 1 7-3 8-8V23M44 22c0 9 0 15 4 21-4 1-7-3-8-8V23" fill="#40515b" />
          <path d="M28 27h.1M36 27h.1" stroke="#29383f" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M29 33c2 2 4 2 6 0" fill="none" stroke="#a66e5d" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M19 25c-2-12 3-19 13-19s15 7 13 19l-3 13H22z" fill="#40515b" />
          <path d="M27 36h10v10H27z" fill="#e8b893" />
          <path d="M8 64c1-12 9-19 20-20l4 4 4-4c12 1 19 8 20 20z" fill="#4778a4" />
          <ellipse cx="32" cy="24" rx="10" ry="12" fill="#f2c6a4" />
          <path d="M22 21c1-8 5-13 11-13 7 0 10 5 10 13-4-1-8-3-11-6-3 3-6 5-10 6z" fill="#40515b" />
          <path d="M28 27h.1M36 27h.1" stroke="#29383f" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M29 33c2 2 4 2 6 0" fill="none" stroke="#a66e5d" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function normalizeNumberValue(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return null;

  const number = Number(rawValue.replace(",", "."));
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
  const [weightDragCenter, setWeightDragCenter] = useState(null);

  const weightWindow = field === "weight"
    ? getWeightSliderWindow(weightDragCenter ?? rangeValue)
    : null;
  const usesCenteredScale = field === "age";
  const nativeSliderValue = field === "age"
      ? ageToCenteredSlider(rangeValue)
      : rangeValue;
  const nativeSliderMin = weightWindow?.min ?? (usesCenteredScale ? 0 : config.min);
  const nativeSliderMax = weightWindow?.max ?? (usesCenteredScale ? 100 : config.max);
  const nativeSliderStep = usesCenteredScale ? 0.01 : config.step;
  const sliderProgress = Math.min(
    100,
    Math.max(0, ((nativeSliderValue - nativeSliderMin) / (nativeSliderMax - nativeSliderMin)) * 100)
  );

  function handleRangeChange(event) {
    const nextNativeValue = Number(event.target.value);
    const nextValue = field === "age"
        ? centeredSliderToAge(nextNativeValue)
        : nextNativeValue;

    onChange(formatNumberValue(nextValue, config.step));
  }

  return (
    <div role="group" aria-label={config.label} className={styles.firstSetupMetricSlider} style={{ "--slider-progress": `${sliderProgress}%` }}>
      <span className={styles.firstSetupMetricLabel}>{config.label}</span>
      <strong className={styles.firstSetupMetricValue}>{formatNumberValue(sliderValue, config.step)} <small>{config.unit}</small></strong>
      <input
        type="range"
        aria-label={`${config.label}, шкала`}
        min={nativeSliderMin}
        max={nativeSliderMax}
        step={nativeSliderStep}
        value={nativeSliderValue}
        onChange={handleRangeChange}
        onPointerDown={() => field === "weight" && setWeightDragCenter(rangeValue)}
        onPointerUp={() => field === "weight" && setWeightDragCenter(null)}
        onPointerCancel={() => field === "weight" && setWeightDragCenter(null)}
        onKeyDown={() => field === "weight" && setWeightDragCenter(current => current ?? rangeValue)}
        onKeyUp={() => field === "weight" && setWeightDragCenter(null)}
        onBlur={() => field === "weight" && setWeightDragCenter(null)}
      />
      <div className={styles.firstSetupMetricTicks} aria-hidden="true">
        {Array.from({ length: 21 }, (_, index) => <i key={index} />)}
      </div>
      <div className={styles.firstSetupMetricMarks} aria-hidden="true">
        {(weightWindow
          ? [weightWindow.min, weightWindow.midpoint, weightWindow.max]
          : config.marks || [config.min, safeFallback, config.max]
        ).map((mark, index) => <span key={`${mark}-${index}`}>{formatNumberValue(mark, config.step)}</span>)}
      </div>
      <div className={styles.firstSetupMetricInput}>
        <input
          inputMode={config.step < 1 ? "decimal" : "numeric"}
          type="text"
          aria-label={`${config.label}, ${config.unit}`}
          value={value ?? ""}
          onChange={(event) => {
            const nextValue = event.target.value;
            const expression = config.step < 1
              ? /^\d*(?:[.,]\d*)?$/
              : /^\d*$/;

            if (expression.test(nextValue)) onChange(nextValue);
          }}
        />
        <em>{config.unit}</em>
      </div>
    </div>
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
  const [editingReview, setEditingReview] = useState(false);
  const initializedMetricStepsRef = useRef(new Set());

  const profileName = limitUserDisplayName(profileDraft.name);
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
    if (!open) initializedMetricStepsRef.current.clear();
  }, [open]);

  useEffect(() => {
    const field = METRIC_STEP_FIELDS[onboardingStep];
    const initializationKey = `${onboardingStep}:${field || ""}`;
    if (!field || initializedMetricStepsRef.current.has(initializationKey)) return;

    initializedMetricStepsRef.current.add(initializationKey);
    if (normalizeNumberValue(profileDraft[field]) !== null) return;

    const fallback = field === "targetWeight"
      ? getSuggestedTargetWeight(profileDraft)
      : NUMBER_SLIDER_CONFIG[field].fallback;

    setProfileDraft((prev) => normalizeNumberValue(prev[field]) !== null ? prev : ({
      ...prev,
      [field]: formatNumberValue(fallback, NUMBER_SLIDER_CONFIG[field].step)
    }));
  }, [
    onboardingStep,
    profileDraft,
    setProfileDraft
  ]);

  function handleFieldSubmit(event) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    if (!stepCanContinue) return;

    event.currentTarget.blur();
    setOnboardingStep((currentStep) => editingReview ? 9 : Math.min(currentStep + 1, TOTAL_STEPS - 1));
    setEditingReview(false);
  }

  if (!open) return null;

  return (
    <div className={styles.firstSetupOverlay} data-testid="first-setup-onboarding">
      <div className={styles.firstSetupCard} data-step={onboardingStep} data-testid="first-setup-card">
        <button
          type="button"
          className={styles.firstSetupExitButton}
          aria-label="Выйти из опросника"
          onClick={() => setExitConfirmOpen(true)}
        >
          <X size={21} strokeWidth={2.2} aria-hidden="true" />
        </button>

        <div className={styles.firstSetupProgress} data-testid="first-setup-progress">
          <span>Шаг {onboardingStep + 1} из {TOTAL_STEPS}</span>
          <div>
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <i className={index <= onboardingStep ? "active" : ""} key={index} />
            ))}
          </div>
        </div>

        <header className={styles.firstSetupHeader}>
          <h2>{ONBOARDING_TITLES[onboardingStep]}</h2>
          <p>{ONBOARDING_SUBTITLES[onboardingStep]}</p>
        </header>

        <div className={styles.firstSetupBody} data-testid="first-setup-body">
          {onboardingStep === 0 && (
            <ul className={styles.welcomeList} data-testid="first-setup-welcome-features">
              {[
                [Dumbbell, "Тренировки", "Ваш план и результаты занятий"],
                [Apple, "Питание", "Дневник и цели на каждый день"],
                [Activity, "Прогресс", "Вес, замеры и ваши достижения"]
              ].map(([Icon, title, description]) => (
                <li key={title}>
                  <span className={styles.welcomeIcon}><Icon aria-hidden="true" /></span>
                  <div><strong>{title}</strong><small>{description}</small></div>
                </li>
              ))}
            </ul>
          )}

          {onboardingStep === 1 && (
            <div className={styles.firstSetupChoiceGrid + " " + styles.firstSetupSexGrid}>
              <button
                type="button"
                className={profileDraft.sex === "male" ? "active" : ""}
                aria-pressed={profileDraft.sex === "male"}
                onClick={() => updateProfileDraft({ sex: "male" })}
              >
                <span className={styles.firstSetupSexIcon}><FirstSetupSexIllustration sex="male" /></span>
                <strong>Мужчина</strong>
                {profileDraft.sex === "male" ? <span className={styles.firstSetupSexSelected} aria-hidden="true"><Check size={14} strokeWidth={2.8} /></span> : null}
              </button>

              <button
                type="button"
                className={profileDraft.sex === "female" ? "active" : ""}
                aria-pressed={profileDraft.sex === "female"}
                onClick={() => updateProfileDraft({ sex: "female" })}
              >
                <span className={styles.firstSetupSexIcon}><FirstSetupSexIllustration sex="female" /></span>
                <strong>Женщина</strong>
                {profileDraft.sex === "female" ? <span className={styles.firstSetupSexSelected} aria-hidden="true"><Check size={14} strokeWidth={2.8} /></span> : null}
              </button>
            </div>
          )}

          {onboardingStep === 2 && (
            <label className={styles.firstSetupField}>
              <span>Ваше имя</span>
              <input
                className={styles.firstSetupInput}
                placeholder="Как к вам обращаться?"
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                maxLength={MAX_PROFILE_NAME_LENGTH}
                value={profileDraft.name || ""}
                onChange={(event) => updateProfileDraft({ name: event.target.value.slice(0, MAX_PROFILE_NAME_LENGTH) })}
                onBlur={(event) => updateProfileDraft({ name: limitUserDisplayName(event.target.value) })}
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
            <div className={styles.firstSetupActivityList}>
              {ACTIVITY_OPTIONS.map(([id, Icon, label, description]) => (
                <button
                  type="button"
                  key={id}
                  className={`${styles.activityOption} ${profileDraft.activity === id ? "active" : ""}`}
                  aria-pressed={profileDraft.activity === id}
                  onClick={() => updateProfileDraft({ activity: id })}
                >
                  <span><Icon aria-hidden="true" /></span>
                  <span><strong>{label}</strong><small>{description}</small></span>
                  <i aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          {onboardingStep === 7 && (
            <div className={styles.firstSetupGoalStep}>
              <div className={styles.firstSetupGoalGrid}>
                {GOAL_OPTIONS.map(([id, Icon, label, description]) => (
                  <button
                    type="button"
                    key={id}
                    className={`${styles.goalOption} ${profileDraft.goal === id ? "active" : ""}`}
                    aria-pressed={profileDraft.goal === id}
                    onClick={() => updateProfileDraft({ goal: id })}
                  >
                    <span><Icon aria-hidden="true" /></span>
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
            <div className={styles.firstSetupReview} data-testid="first-setup-review">
              {[
                [profileDraft.sex === "female" ? UserRound : PersonStanding, "Пол", profileDraft.sex === "female" ? "Женщина" : "Мужчина"],
                [UserRound, "Имя", profileName || "—"],
                [CakeSlice, "Возраст", `${profileDraft.age || "—"} лет`],
                [Scale, "Вес", `${profileDraft.weight || "—"} кг`],
                [Ruler, "Рост", `${profileDraft.height || "—"} см`],
                [Activity, "Уровень активности", activityLabel],
                [Target, "Цель", goalLabel],
                [MoveHorizontal, "Целевой вес", profileDraft.targetWeight ? `${profileDraft.targetWeight} кг` : "Не указан"]
              ].map(([Icon, label, value], index) => (
                <button type="button" key={label} aria-label={`Изменить: ${label}`} onClick={() => { setEditingReview(true); setOnboardingStep(index + 1); }}>
                  <span><Icon aria-hidden="true" /></span>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.firstSetupBottom} data-testid="first-setup-navigation">
          {onboardingStep > 0 && (
            <button
              type="button"
              className={styles.firstSetupSecondary}
              onClick={() => { setOnboardingStep((prev) => editingReview ? 9 : prev - 1); setEditingReview(false); }}
            >
              Назад
            </button>
          )}

          {onboardingStep < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              className={styles.firstSetupPrimary}
              disabled={!stepCanContinue}
              onClick={() => { setOnboardingStep((prev) => editingReview ? 9 : prev + 1); setEditingReview(false); }}
            >
              {editingReview ? "Готово" : onboardingStep === 0 ? "Начать" : "Далее"}
            </button>
          ) : (
            <button
              type="button"
              className={styles.firstSetupPrimary}
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
          <div className={styles.firstSetupExitConfirm} role="dialog" aria-modal="true" aria-label="Выход из опросника">
            <div className={styles.firstSetupExitConfirmCard} data-modal-surface="true">
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
