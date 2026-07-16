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
  greetingName
}) {
  const greeting = getTimeOfDayGreeting();

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
              {telegramProfile.connected ? "✈️" : "👤"}
            </span>
          )}
        </div>
      </div>

      <div className={styles.text} data-testid="profile-main-hero-text">
        <h1 className={styles.title} data-testid="profile-main-hero-title">
          {greeting}, {greetingName} 👋
        </h1>
      </div>
    </div>
  );
}
