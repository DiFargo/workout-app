import ClientPageHeader from "../../../shared/ui/ClientPageHeader";
import { ChevronRight, ClipboardList, Dumbbell } from "lucide-react";
import adaptiveShellStyles from "../../../shared/ui/ClientAdaptiveShell.module.css";
import styles from "./WorkoutModePage.module.css";

export default function WorkoutModePage({
  renderClientMainBottomBar,
  canUseTrainerFeatures,
  onBackToMain,
  onOpenBasicWorkouts,
  onOpenIndividualWorkouts,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  return (
    <div className={`${styles.page} ${adaptiveShellStyles.shell}`} data-client-adaptive-shell="true" data-testid="workout-mode-page" data-css-module-scope="workout-mode">
      <ClientPageHeader
        compact
        className={styles.topBar}
        title="Режим тренировок"
        eyebrow="Кабинет"
        onBack={onOpenCabinet || onBackToMain}
        backAriaLabel="Вернуться в кабинет"
        testId="workout-mode-header"
        scope="workout-mode-header"
      />

      <p className={styles.lead} data-testid="workout-mode-lead">
        Выбери, по какой программе тренироваться. Режим можно изменить в кабинете в любой момент.
      </p>

      <section className={styles.cards} data-testid="workout-mode-cards">
        <button className={styles.card} data-testid="workout-mode-card" type="button" onClick={onOpenBasicWorkouts}>
          <span className={styles.icon} aria-hidden="true"><Dumbbell /></span>
          <div>
            <span className={styles.kicker}>Самостоятельно</span>
            <strong>Базовые тренировки</strong>
            <small>Тренировка на сегодня или программа на четыре недели.</small>
          </div>
          <i aria-hidden="true"><ChevronRight /></i>
        </button>

        <button className={[styles.card, styles.premium].join(" ")} data-testid="workout-mode-card" type="button" onClick={onOpenIndividualWorkouts}>
          <span className={styles.icon} aria-hidden="true"><ClipboardList /></span>
          <div>
            <span className={styles.kicker}>С тренером</span>
            <strong>Индивидуальный план</strong>
            <small>Тренировки, которые создал и назначил тренер.</small>
          </div>
          <i aria-hidden="true"><ChevronRight /></i>
        </button>
      </section>

      {renderClientMainBottomBar?.(
        "workouts",
        {
          className: "mainMenuBottomBar profileBottomTabBar workoutModeBottomBar",
          isTrainerMode: canUseTrainerFeatures,
          onGoMain: onBackToMain,
          onOpenTraining,
          onOpenNutrition,
          onOpenCabinet,
          onOpenTrainerClients,
          onOpenTrainerPrograms,
          onLoadTrainerCabinet
        }
      )}

    </div>
  );
}
