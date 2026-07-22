import { Dumbbell, Scale, Target } from "lucide-react";
import styles from "./ProfileHeroCard.module.css";

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

function getDisplayTargetWeight(targetWeight, currentWeight, goalId) {
  const explicitTarget = Number(String(targetWeight ?? "").replace(",", "."));
  if (Number.isFinite(explicitTarget) && explicitTarget > 0) {
    return explicitTarget;
  }

  const numericWeight = Number(String(currentWeight ?? "").replace(",", "."));
  if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
    return null;
  }

  if (goalId === "mass") return Math.round(numericWeight * 1.08 * 10) / 10;
  if (goalId === "cut") return Math.round(numericWeight * 0.9 * 10) / 10;
  return numericWeight;
}

function formatTargetWeight(targetWeight, currentWeight, goalId) {
  const numericValue = getDisplayTargetWeight(targetWeight, currentWeight, goalId);

  if (numericValue === null) {
    return "—";
  }

  return `${Number.isInteger(numericValue) ? numericValue : numericValue.toFixed(1)} кг`;
}

export default function ProfileHeroCard({
  telegramProfile,
  avatarUrl,
  greetingName,
  activeGoalLabel,
  totalWorkouts = 0,
  targetWeight,
  currentWeight,
  goalId
}) {
  const greeting = getTimeOfDayGreeting();
  const fallbackLetter = String(greetingName || "А").trim().charAt(0).toUpperCase() || "А";

  return (
    <div
      className={styles.root}
      data-css-module-scope="profile-hero-card"
      data-testid="profile-main-hero"
    >
      <div className={styles.avatarWrap} data-testid="profile-main-hero-avatar-wrap">
        <div
          className={`${styles.avatar}${telegramProfile.connected ? ` ${styles.telegram}` : ""}`}
          data-testid="profile-main-hero-avatar"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <span className={styles.fallback} data-testid="profile-main-hero-avatar-fallback">
              {fallbackLetter}
            </span>
          )}
        </div>
      </div>

      <div className={styles.text} data-testid="profile-main-hero-text">
        <div className={styles.identity}>
          <span className={styles.greeting} data-testid="profile-main-hero-greeting">{greeting}</span>
          <h2 className={styles.title} data-testid="profile-main-hero-title">{greetingName}</h2>
        </div>
      </div>

      <div className={styles.stats} data-testid="profile-main-hero-stats">
        <span className={styles.stat}>
          <span className={styles.statLabel}>
            <Target aria-hidden="true" />
            <small>Цель</small>
          </span>
          <strong>{activeGoalLabel}</strong>
        </span>
        <span className={styles.stat}>
          <span className={styles.statLabel}>
            <Scale aria-hidden="true" />
            <small>Целевой вес</small>
          </span>
          <strong data-testid="profile-main-hero-target-weight">
            {formatTargetWeight(targetWeight, currentWeight, goalId)}
          </strong>
        </span>
        <span className={styles.stat}>
          <span className={styles.statLabel}>
            <Dumbbell aria-hidden="true" />
            <small>Тренировок</small>
          </span>
          <strong data-testid="profile-main-hero-workouts">{totalWorkouts}</strong>
        </span>
      </div>
    </div>
  );
}
