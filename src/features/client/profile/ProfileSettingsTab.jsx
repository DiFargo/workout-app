import ProfileAppSettingsSection from "./ProfileAppSettingsSection";
import ProfileBodyMetricsSettingsSection from "./ProfileBodyMetricsSettingsSection";

export default function ProfileSettingsTab({
  visible,
  bodyMetricsOpen,
  draft,
  activeGoalLabel,
  isWarmLightTheme,
  telegramProfile,
  onToggleBodyMetrics,
  onDraftChange,
  onSaveBodyMetrics,
  onToggleTheme,
  onOpenTelegram,
  onTelegramAvatarError
}) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <ProfileBodyMetricsSettingsSection
        open={bodyMetricsOpen}
        draft={draft}
        activeGoalLabel={activeGoalLabel}
        description="Вес, рост, возраст, активность и тренировочные дни"
        ageInputClassName="adminReminderTimeInput"
        onToggle={onToggleBodyMetrics}
        onDraftChange={onDraftChange}
        onSave={onSaveBodyMetrics}
      />

      <h1 className="profileSettingsPageTitle">Настройки</h1>
      <ProfileAppSettingsSection
        isWarmLightTheme={isWarmLightTheme}
        telegramProfile={telegramProfile}
        darkThemeLabel="тёмно-зелёный стиль"
        disconnectedText="Не подключён · нажми, чтобы привязать"
        connectedBadge="Подключен"
        onToggleTheme={onToggleTheme}
        onOpenTelegram={onOpenTelegram}
        onTelegramAvatarError={onTelegramAvatarError}
      />
    </>
  );
}
