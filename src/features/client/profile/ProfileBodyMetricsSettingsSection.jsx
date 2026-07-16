import styles from "./ProfileBodyMetricsSettingsSection.module.css";

const SEX_OPTIONS = [
  { id: "male", title: "Мужчина" },
  { id: "female", title: "Женщина" }
];

const GOAL_OPTIONS = [
  { id: "cut", title: "Похудение" },
  { id: "mass", title: "Набор массы" },
  { id: "recomp", title: "Рекомпозиция" },
  { id: "maintain", title: "Поддержание" }
];

const ACTIVITY_OPTIONS = [
  { id: "low", title: "Низкая" },
  { id: "medium", title: "Средняя" },
  { id: "high", title: "Высокая" },
  { id: "veryHigh", title: "Очень высокая" }
];

const METRIC_FIELDS = {
  weight: { label: "Текущий вес", min: 30, max: 350, step: 0.1, fallback: 80 },
  targetWeight: { label: "Целевой вес", min: 30, max: 350, step: 0.1, fallback: 75 },
  height: { label: "Рост", min: 120, max: 230, step: 1, fallback: 175 },
  age: { label: "Возраст", min: 14, max: 100, step: 1, fallback: 30 }
};

function normalizeMetricValue(value) {
  const number = Number(String(value || "").replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function formatMetricValue(value, step = 1) {
  const number = normalizeMetricValue(value);
  if (number === null) return "";
  return Number(step) < 1
    ? number.toFixed(1).replace(/\.0$/, "")
    : String(Math.round(number));
}

function getTargetFallback(draft) {
  const weight = normalizeMetricValue(draft.weight);
  if (!weight) return METRIC_FIELDS.targetWeight.fallback;
  if (draft.goal === "mass") return Math.round(weight * 1.08 * 10) / 10;
  if (draft.goal === "cut") return Math.round(weight * 0.9 * 10) / 10;
  return weight;
}

function ProfileMetricField({ field, value, fallback, onChange }) {
  const config = METRIC_FIELDS[field];
  const placeholder = formatMetricValue(fallback ?? config.fallback, config.step);

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{config.label}</span>
      <input
        className={styles.control}
        inputMode={config.step < 1 ? "decimal" : "numeric"}
        type="number"
        min={config.min}
        max={config.max}
        step={config.step}
        placeholder={placeholder}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export default function ProfileBodyMetricsSettingsSection({
  open,
  draft,
  description = "Вес, рост, возраст и активность",
  onToggle,
  onDraftChange,
  onSave,
  variant = "modal"
}) {
  const variantClass = variant === "tab" ? styles.tab : styles.modal;

  return (
    <section
      className={`${styles.section} ${variantClass}`}
      data-testid="profile-body-metrics-section"
      data-profile-body-metrics-variant={variant}
      data-open={open ? "true" : "false"}
    >
      <button
        type="button"
        className={styles.head}
        data-testid="profile-body-metrics-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        <div className={styles.headText}>
          <span className={styles.eyebrow}>ПРОФИЛЬ</span>
          <strong className={styles.title}>Параметры тела</strong>
          <small className={styles.description}>{description}</small>
        </div>
        <em className={styles.expandIcon}>{open ? "−" : "+"}</em>
      </button>

      {open && (
        <div className={styles.accordion}>
          <div className={`${styles.grid} ${styles.gridTwo}`}>
            <ProfileMetricField
              field="weight"
              value={draft.weight}
              onChange={(value) => onDraftChange("weight", value)}
            />
            <ProfileMetricField
              field="targetWeight"
              value={draft.targetWeight}
              fallback={getTargetFallback(draft)}
              onChange={(value) => onDraftChange("targetWeight", value)}
            />
            <ProfileMetricField
              field="height"
              value={draft.height}
              onChange={(value) => onDraftChange("height", value)}
            />
            <ProfileMetricField
              field="age"
              value={draft.age}
              onChange={(value) => onDraftChange("age", value)}
            />
          </div>

          <div className={styles.sexPicker}>
            {SEX_OPTIONS.map((sex) => (
              <button
                type="button"
                key={sex.id}
                className={`${styles.sexButton}${draft.sex === sex.id ? ` ${styles.active}` : ""}`}
                aria-pressed={draft.sex === sex.id}
                onClick={() => onDraftChange("sex", sex.id)}
              >
                {sex.title}
              </button>
            ))}
          </div>

          <div className={`${styles.grid} ${styles.gridTwo}`}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Твоя цель</span>
              <select
                className={styles.control}
                aria-label="Твоя цель"
                value={draft.goal || "recomp"}
                onChange={(event) => onDraftChange("goal", event.target.value)}
              >
                {GOAL_OPTIONS.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.title}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Активность</span>
              <select
                className={styles.control}
                aria-label="Активность"
                value={draft.activity}
                onChange={(event) => onDraftChange("activity", event.target.value)}
              >
                {ACTIVITY_OPTIONS.map((activity) => (
                  <option key={activity.id} value={activity.id}>{activity.title}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            className={styles.saveButton}
            data-testid="profile-body-metrics-save"
            onClick={onSave}
          >
            Сохранить анкету
          </button>
        </div>
      )}
    </section>
  );
}
