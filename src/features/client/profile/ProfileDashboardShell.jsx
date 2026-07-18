import styles from "./ProfileDashboardShell.module.css";
import adaptiveShellStyles from "../../../shared/ui/ClientAdaptiveShell.module.css";

const SUPPORTED_MODES = new Set(["main", "cabinet", "measurements", "settings", "nutrition"]);

function normalizeMode(mode) {
  return SUPPORTED_MODES.has(mode) ? mode : "cabinet";
}

function getLegacyRootClass(mode) {
  if (mode === "main") {
    return "profileDashboardPage profileTabbedPage mainDashboardPage clientCorePage clientCorePageMain trainerRolePage";
  }

  if (mode === "cabinet") {
    return "profileDashboardPage profileTabbedPage clientCorePage clientCorePageCabinet trainerRolePage";
  }

  return "profileDashboardPage profileTabbedPage trainerRolePage";
}

export function ProfileDashboardShell({
  children,
  legacyTrainer = false,
  mode = "cabinet",
  testId
}) {
  const normalizedMode = normalizeMode(mode);

  return (
    <div
      className={legacyTrainer
        ? getLegacyRootClass(normalizedMode)
        : `${styles.root} ${styles[normalizedMode]} ${adaptiveShellStyles.shell}`}
      data-css-module-scope={legacyTrainer ? undefined : "profile-dashboard-shell"}
      data-client-adaptive-shell={legacyTrainer ? undefined : "true"}
      data-profile-tab={normalizedMode === "main" ? "cabinet" : normalizedMode}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function ProfileDashboardContent({
  children,
  legacyTrainer = false,
  mode = "cabinet"
}) {
  const normalizedMode = normalizeMode(mode);

  return (
    <section
      className={legacyTrainer
        ? "profileUnifiedCard profileAiDashboardCard profileCabinetSection"
        : `${styles.content} ${styles[`${normalizedMode}Content`]}`}
      data-testid={legacyTrainer ? undefined : "profile-dashboard-content"}
    >
      {children}
    </section>
  );
}

export function ProfileMainHeroStatsShell({ children }) {
  return (
    <div className={styles.heroStats} data-testid="profile-main-hero-stats-shell">
      {children}
    </div>
  );
}

export function ProfileDashboardVersion({ children }) {
  return (
    <div className={styles.version} data-testid="profile-dashboard-version">
      {children}
    </div>
  );
}

export function ProfileHarnessTitle({ children }) {
  return <h1 className={styles.harnessTitle}>{children}</h1>;
}
