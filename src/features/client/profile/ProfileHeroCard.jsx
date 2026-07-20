import { Dumbbell } from "lucide-react";
import styles from "./ProfileHeroCard.module.css";

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

export default function ProfileHeroCard({
  telegramProfile,
  avatarUrl,
  greetingName,
  activeGoalLabel,
  totalWorkouts = 0
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
        <span className={styles.greeting}>{greeting},</span>
        <h2 className={styles.title} data-testid="profile-main-hero-title">{greetingName}</h2>
        <span className={styles.workouts}><Dumbbell aria-hidden="true" />{totalWorkouts} {totalWorkouts === 1 ? "тренировка" : "тренировки"}</span>
      </div>

      <span className={styles.goal}>{activeGoalLabel}</span>
    </div>
  );
}
