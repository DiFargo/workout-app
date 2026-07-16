import ProfileAppSettingsSection from "./ProfileAppSettingsSection";
import ProfileBodyMetricsSettingsSection from "./ProfileBodyMetricsSettingsSection";
import styles from "./ProfileSettingsTab.module.css";

export default function ProfileSettingsTab({
  visible,
  bodyMetricsOpen,
  draft,
  isWarmLightTheme,
  email,
  telegramProfile,
  onToggleBodyMetrics,
  onDraftChange,
  onSaveBodyMetrics,
  onToggleTheme,
  onOpenEmail,
  onOpenTelegram,
  onTelegramAvatarError
}) {
  if (!visible) {
    return null;
  }

  return (
    <>
      <ProfileBodyMetricsSettingsSection
        variant="tab"
        open={bodyMetricsOpen}
        draft={draft}
        description="Вес, рост, возраст, активность и тренировочные дни"
        onToggle={onToggleBodyMetrics}
        onDraftChange={onDraftChange}
        onSave={onSaveBodyMetrics}
      />

      <h1
        className={styles.title}
        data-css-module-scope="profile-settings-tab"
        data-testid="profile-settings-tab-title"
      >
        Настройки
      </h1>
      <ProfileAppSettingsSection
        variant="tab"
        isWarmLightTheme={isWarmLightTheme}
        email={email}
        telegramProfile={telegramProfile}
        darkThemeLabel="тёмно-зелёный стиль"
        disconnectedText="Не подключён · нажми, чтобы привязать"
        connectedBadge="Подключен"
        onToggleTheme={onToggleTheme}
        onOpenEmail={onOpenEmail}
        onOpenTelegram={onOpenTelegram}
        onTelegramAvatarError={onTelegramAvatarError}
      />
    </>
  );
}
