export default function TrainerClientOverviewSummary({
  dailyCalorieGoal,
  formatProfileMeasurementDate,
  getTrainerDayWord,
  selectedAttentionItems,
  selectedLatestMeasurement,
  selectedMeasurementDays,
  selectedNutritionAverage,
  selectedNutritionCompliance,
  selectedSummary,
  selectedWaistDelta,
  selectedWaistValue,
  selectedWeightDelta,
  selectedWeightValue
}) {
  return (
    <>
      <section className="trainerClientOverviewSection trainerClientAttentionSection">
        <div className="trainerClientSectionHead">
          <div>
            <span>ЦЕНТР ВНИМАНИЯ</span>
            <small>Сигналы, которые требуют решения тренера</small>
          </div>
        </div>
        <div className="trainerClientAttentionStrip">
          {selectedAttentionItems.map((item) => (
            <article className={item.id} key={item.title}>
              <i>{item.icon}</i>
              <div>
                <strong>{item.title}</strong>
                <small>{item.text}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="trainerClientKpiGrid">
        <article>
          <span>ВЕС</span>
          <strong>{selectedWeightValue || "—"} <small>кг</small></strong>
          <em className={selectedWeightDelta === null ? "" : selectedWeightDelta <= 0 ? "positive" : "warning"}>
            {selectedWeightDelta === null ? "Нет сравнения" : `${selectedWeightDelta > 0 ? "+" : ""}${selectedWeightDelta} кг`}
          </em>
          <small>{selectedMeasurementDays === null ? "Нет замеров" : `${selectedMeasurementDays} ${getTrainerDayWord(selectedMeasurementDays)} назад`}</small>
        </article>
        <article>
          <span>ТАЛИЯ</span>
          <strong>{selectedWaistValue || "—"} <small>см</small></strong>
          <em className={selectedWaistDelta === null ? "" : selectedWaistDelta <= 0 ? "positive" : "warning"}>
            {selectedWaistDelta === null ? "Нет сравнения" : `${selectedWaistDelta > 0 ? "+" : ""}${selectedWaistDelta} см`}
          </em>
          <small>По контрольным замерам</small>
        </article>
        <article>
          <span>ТРЕНИРОВКИ</span>
          <strong>{selectedSummary.workouts30 || 0}</strong>
          <em>{selectedSummary.workouts7 || 0} за неделю</em>
          <div className="trainerClientMiniBars" aria-hidden="true">
            {[42, 68, 53, 82, 64, 91, 72, 58].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
          </div>
        </article>
        <article>
          <span>ПИТАНИЕ · 7 ДНЕЙ</span>
          <strong>{selectedNutritionAverage.calories || "—"} <small>/ {dailyCalorieGoal}</small></strong>
          <em>ккал/день в среднем</em>
          <b>{selectedNutritionCompliance}%</b>
        </article>
        <article>
          <span>ЗАМЕРЫ</span>
          <strong className="dateValue">{selectedLatestMeasurement ? formatProfileMeasurementDate(selectedLatestMeasurement) : "—"}</strong>
          <em>{selectedMeasurementDays === null ? "Нет данных" : `${selectedMeasurementDays} ${getTrainerDayWord(selectedMeasurementDays)} назад`}</em>
          <small>Контроль тела</small>
        </article>
      </section>
    </>
  );
}
