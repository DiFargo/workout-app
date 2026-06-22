const SEX_OPTIONS = [
  { id: "male", title: "Мужчина" },
  { id: "female", title: "Женщина" }
];

export default function ProfileBodyMetricsSettingsSection({
  open,
  draft,
  activeGoalLabel,
  description = "Вес, рост, возраст и активность",
  ageInputClassName = "",
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
          <div className="profileBodyMetricsGrid">
            <label>
              <span>Текущий вес</span>
              <input
                inputMode="decimal"
                value={draft.weight}
                onChange={(event) => onDraftChange("weight", event.target.value)}
                placeholder="80 кг"
              />
            </label>
            <label>
              <span>Рост</span>
              <input
                inputMode="decimal"
                value={draft.height}
                onChange={(event) => onDraftChange("height", event.target.value)}
                placeholder="180 см"
              />
            </label>
            <label>
              <span>Возраст</span>
              <input
                inputMode="numeric"
                className={ageInputClassName}
                value={draft.age}
                onChange={(event) => onDraftChange("age", event.target.value)}
                placeholder="31"
              />
            </label>
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
            <label className="profileGoalReadonly">
              <span>Твоя цель</span>
              <div className="profileGoalReadonlyValue">{activeGoalLabel}</div>
            </label>
            <label>
              <span>Активность</span>
              <select
                value={draft.activity}
                onChange={(event) => onDraftChange("activity", event.target.value)}
              >
                <option value="low">Низкая</option>
                <option value="medium">Средняя</option>
                <option value="high">Высокая</option>
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
