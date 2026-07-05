import { CalendarDays, Dumbbell, Scale, Target, Zap } from "lucide-react";

export default function ProfileMainSummaryCards({
  activeGoalLabel,
  targetWeight,
  weight,
  currentGoalId,
  totalWorkouts,
  lastWorkoutDate,
  nextTrainingText,
  showStats = true,
  showSplitCards = true
}) {
  const formatWeightValue = (value) => {
    const numericValue = Number(String(value || "").replace(",", "."));
    if (!Number.isFinite(numericValue) || numericValue <= 0) return "";
    return Number.isInteger(numericValue)
      ? String(numericValue)
      : numericValue.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  };
  const resolvedTargetWeight = formatWeightValue(targetWeight) ||
    (currentGoalId === "maintain" || currentGoalId === "recomp" ? formatWeightValue(weight) : "");

  return (
    <>
      {showStats && (
      <div className="profileAiStatsRow">
        <div className="goal">
          <span className="profileAiStatLabel"><Target aria-hidden="true" />Твоя цель</span>
          <strong>{activeGoalLabel}</strong>
          <small>&nbsp;</small>
        </div>

        <div>
          <span className="profileAiStatLabel"><Scale aria-hidden="true" />Целевой вес</span>
          <strong>{resolvedTargetWeight || "—"} кг</strong>
          <small>&nbsp;</small>
        </div>

        <div>
          <span className="profileAiStatLabel"><Dumbbell aria-hidden="true" />Тренировок</span>
          <strong>{totalWorkouts}</strong>
          <small>&nbsp;</small>
        </div>
      </div>
      )}

      {showSplitCards && (
      <div className="profileMainSummaryGrid profileAiSplitCards">
        <article className="profileAiMiniCard">
          <span><CalendarDays aria-hidden="true" />Последняя тренировка</span>
          <strong>{lastWorkoutDate || "Нет данных"}</strong>
        </article>

        <article className="profileAiMiniCard">
          <span><Zap aria-hidden="true" />Следующая тренировка</span>
          <strong>{nextTrainingText}</strong>
        </article>
      </div>
      )}
    </>
  );
}
