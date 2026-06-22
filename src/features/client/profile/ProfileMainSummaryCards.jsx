export default function ProfileMainSummaryCards({
  activeGoalLabel,
  weight,
  totalWorkouts,
  lastWorkoutDate,
  nextTrainingText
}) {
  return (
    <>
      <div className="profileAiStatsRow">
        <div className="goal">
          <span>Твоя цель</span>
          <strong>{activeGoalLabel}</strong>
          <small>&nbsp;</small>
        </div>

        <div>
          <span>Текущий вес</span>
          <strong>{weight || "—"} кг</strong>
          <small>&nbsp;</small>
        </div>

        <div>
          <span>Тренировок</span>
          <strong>{totalWorkouts}</strong>
          <small>&nbsp;</small>
        </div>
      </div>

      <div className="profileAiSplitCards">
        <div className="profileAiMiniCard">
          <span>📅 Последняя тренировка</span>
          <strong>{lastWorkoutDate || "Нет данных"}</strong>
        </div>

        <div className="profileAiMiniCard">
          <span>⚡ Следующая тренировка</span>
          <strong>{nextTrainingText}</strong>
        </div>
      </div>
    </>
  );
}
