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
  weight: { label: "Текущий вес", min: 30, max: 350, step: 0.1, unit: "кг", fallback: 80 },
  targetWeight: { label: "Целевой вес", min: 30, max: 350, step: 0.1, unit: "кг", fallback: 75 },
  height: { label: "Рост", min: 120, max: 230, step: 1, unit: "см", fallback: 175 },
  age: { label: "Возраст", min: 14, max: 100, step: 1, unit: "лет", fallback: 30 }
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
    <label>
      <span>{config.label}</span>
      <input
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
  onSave
}) {
  return (
    <section className="profileDashboardCard profileBodyMetricsSettingsSection">
      <button
        type="button"
        className={open ? "profileAccordionHead open" : "profileAccordionHead"}
        onClick={onToggle}
      >
        <div>
          <span>ПРОФИЛЬ</span>
          <strong>Параметры тела</strong>
          <small>{description}</small>
        </div>
        <em>{open ? "−" : "+"}</em>
      </button>

      {open && (
        <div className="profileBodyMetricsAccordion">
          <div className="profileBodyMetricsGrid profileBodyMetricsGridTwo">
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

          <div className="profileSexPicker">
            {SEX_OPTIONS.map((sex) => (
              <button
                type="button"
                key={sex.id}
                className={draft.sex === sex.id ? "active" : ""}
                onClick={() => onDraftChange("sex", sex.id)}
              >
                {sex.title}
              </button>
            ))}
          </div>

          <div className="profileBodyMetricsGrid profileBodyMetricsGridTwo">
            <label>
              <span>Твоя цель</span>
              <select
                value={draft.goal || "recomp"}
                onChange={(event) => onDraftChange("goal", event.target.value)}
              >
                {GOAL_OPTIONS.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.title}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Активность</span>
              <select
                value={draft.activity}
                onChange={(event) => onDraftChange("activity", event.target.value)}
              >
                {ACTIVITY_OPTIONS.map((activity) => (
                  <option key={activity.id} value={activity.id}>{activity.title}</option>
                ))}
              </select>
            </label>
          </div>

          <button type="button" className="profileBodySaveBtn" onClick={onSave}>
            Сохранить анкету
          </button>
        </div>
      )}
    </section>
  );
}
