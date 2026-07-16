import styles from "./ProfileDashboardShell.module.css";

const SUPPORTED_MODES = new Set(["main", "cabinet", "measurements", "settings", "nutrition"]);

function normalizeMode(mode) {
  return SUPPORTED_MODES.has(mode) ? mode : "cabinet";
}

export function ProfileDashboardShell({
  children,
  mode = "cabinet",
  testId
}) {
  const normalizedMode = normalizeMode(mode);

  return (
    <div
      className={`${styles.root} ${styles[normalizedMode]}`}
      data-css-module-scope="profile-dashboard-shell"
      data-profile-tab={normalizedMode === "main" ? "cabinet" : normalizedMode}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function ProfileDashboardContent({
  children,
  mode = "cabinet"
}) {
  const normalizedMode = normalizeMode(mode);

  return (
    <section
      className={`${styles.content} ${styles[`${normalizedMode}Content`]}`}
      data-testid="profile-dashboard-content"
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
