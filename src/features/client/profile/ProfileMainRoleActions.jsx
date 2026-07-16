import styles from "./ProfileMainRoleActions.module.css";

export default function ProfileMainRoleActions({
  showTrainer,
  showAdmin,
  onOpenTrainer,
  onOpenAdmin
}) {
  if (!showTrainer && !showAdmin) {
    return null;
  }

  return (
    <div
      className={styles.root}
      data-css-module-scope="profile-main-role-actions"
      data-testid="profile-main-role-actions"
    >
      {showTrainer && (
        <button
          type="button"
          className={styles.action}
          data-testid="profile-main-role-trainer"
          onClick={onOpenTrainer}
        >
          ⚙️ Тренерская
        </button>
      )}
      {showAdmin && (
        <button
          type="button"
          className={styles.action}
          data-testid="profile-main-role-admin"
          onClick={onOpenAdmin}
        >
          🛠️ Админ-панель
        </button>
      )}
    </div>
  );
}
