function getTimeOfDayGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

export default function ProfileHeroCard({
  isMainDashboard,
  telegramProfile,
  avatarUrl,
  progressScore,
  greetingName,
  onOpenAccount
}) {
  const clickable = false;
  const greeting = getTimeOfDayGreeting();

  return (
    <div
      className={`profileAiHero${clickable ? " profileAiHeroButton" : ""}`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? "Открыть аккаунт" : undefined}
      onClick={() => {
        if (clickable) onOpenAccount();
      }}
      onKeyDown={(event) => {
        if (!clickable || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onOpenAccount();
      }}
    >
      <div className="profileAiAvatarWrap">
        <div className={telegramProfile.connected ? "profileAvatarBig telegram profileUnifiedAvatar profileAiAvatar" : "profileAvatarBig profileUnifiedAvatar profileAiAvatar"}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <span>{telegramProfile.connected ? "✈️" : "👤"}</span>
          )}
        </div>
        <div className="profileAiAvatarRing">
          <strong>{progressScore === null ? "—" : `${progressScore}%`}</strong>
        </div>
      </div>

      <div className="profileAiHeroText">
        {!isMainDashboard && <span>ЛИЧНЫЙ КАБИНЕТ</span>}
        <h1>{greeting}, {greetingName} 👋</h1>
      </div>

    </div>
  );
}
