import TrainerNavigation from "./TrainerNavigation";
import styles from "./TrainerWorkspace.module.css";
import workspaceUnityStyles from "./TrainerWorkspaceUnity.module.css";

export default function TrainerShell({ activeSection, onNavigate, trainerName, trainerAvatar, children }) {
  return (
    <div className={`${styles.scope} trainerNextRoot ${workspaceUnityStyles.unity}`}>
      <TrainerNavigation
        activeSection={activeSection}
        onNavigate={onNavigate}
        trainerName={trainerName}
        trainerAvatar={trainerAvatar}
      />
      <main className="trainerNextMain">{children}</main>
    </div>
  );
}
