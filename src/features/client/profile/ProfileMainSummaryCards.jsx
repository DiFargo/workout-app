import { CalendarDays, Dumbbell, Scale, Target, Zap } from "lucide-react";
import styles from "./ProfileMainSummaryCards.module.css";

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
      <div
        className={styles.statsRoot}
        data-css-module-scope="profile-main-summary-stats"
        data-testid="profile-main-stats"
      >
        <div className={styles.stat}>
          <span className={styles.statLabel}><Target className={styles.statIcon} aria-hidden="true" />Твоя цель</span>
          <strong className={`${styles.statValue} ${styles.goalValue}`}>{activeGoalLabel}</strong>
        </div>

        <div className={styles.stat}>
          <span className={styles.statLabel}><Scale className={styles.statIcon} aria-hidden="true" />Целевой вес</span>
          <strong className={styles.statValue}>{resolvedTargetWeight || "—"} кг</strong>
        </div>

        <div className={styles.stat}>
          <span className={styles.statLabel}><Dumbbell className={styles.statIcon} aria-hidden="true" />Тренировок</span>
          <strong className={styles.statValue}>{totalWorkouts}</strong>
        </div>
      </div>
      )}

      {showSplitCards && (
      <div
        className={styles.summaryGrid}
        data-css-module-scope="profile-main-summary-grid"
        data-testid="profile-main-summary-grid"
      >
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}><CalendarDays className={styles.summaryIcon} aria-hidden="true" />Последняя тренировка</span>
          <strong className={styles.summaryValue}>{lastWorkoutDate || "Нет данных"}</strong>
        </article>

        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}><Zap className={`${styles.summaryIcon} ${styles.nextIcon}`} aria-hidden="true" />Следующая тренировка</span>
          <strong className={styles.summaryValue}>{nextTrainingText}</strong>
        </article>
      </div>
      )}
    </>
  );
}
