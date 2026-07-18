
import { Dumbbell, Home, UserRound, Utensils } from "lucide-react";
import styles from "./BottomBar.module.css";

function runDeferredTouchPreload(preload) {
  if (typeof preload !== "function") return undefined;
  return (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      window.setTimeout(preload, 90);
      return;
    }

    preload();
  };
}

export function ClientMainBottomBar({
  activeTab = "main",
  className = "mainMenuBottomBar profileBottomTabBar",
  variant,
  isTrainerMode,
  onGoMain,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onPreloadMain,
  onPreloadTraining,
  onPreloadNutrition,
  onPreloadCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  const preloadMain = runDeferredTouchPreload(onPreloadMain);
  const preloadTraining = runDeferredTouchPreload(onPreloadTraining);
  const preloadNutrition = runDeferredTouchPreload(onPreloadNutrition);
  const preloadCabinet = runDeferredTouchPreload(onPreloadCabinet);

  if (isTrainerMode) {
    return (
      <TrainerMainBottomBar
        activeTab={activeTab}
        className={className}
        onGoMain={onGoMain}
        onOpenTrainerClients={onOpenTrainerClients}
        onOpenTrainerPrograms={onOpenTrainerPrograms}
        onOpenCabinet={onOpenCabinet}
        onLoadTrainerCabinet={onLoadTrainerCabinet}
      />
    );
  }

  const nutritionVariant = variant === "nutrition";
  const navigationClassName = nutritionVariant
    ? styles.nutrition
    : styles.main;

  return (
    <div className={`${styles.dock} ${nutritionVariant ? styles.nutritionDock : styles.mainDock}`}>
      <nav
        className={navigationClassName}
        data-css-module-scope={nutritionVariant ? "nutrition-bottom-bar" : "client-main-bottom-bar"}
        data-testid="client-bottom-nav"
        aria-label="Основные разделы"
      >
      <button
        type="button"
        data-testid="client-nav-main"
        className={activeTab === "main" ? styles.active : ""}
        aria-current={activeTab === "main" ? "page" : undefined}
        onPointerDown={preloadMain}
        onFocus={onPreloadMain}
        onClick={onGoMain}
      >
        <span aria-hidden="true"><Home /></span>
        <strong>Главная</strong>
      </button>
      <button
        type="button"
        data-testid="client-nav-workouts"
        className={activeTab === "workouts" ? styles.active : ""}
        aria-current={activeTab === "workouts" ? "page" : undefined}
        onPointerDown={preloadTraining}
        onFocus={onPreloadTraining}
        onClick={onOpenTraining}
      >
        <span aria-hidden="true"><Dumbbell /></span>
        <strong>Тренировки</strong>
      </button>
      <button
        type="button"
        data-testid="client-nav-nutrition"
        className={activeTab === "nutrition" ? styles.active : ""}
        aria-current={activeTab === "nutrition" ? "page" : undefined}
        onPointerDown={preloadNutrition}
        onFocus={onPreloadNutrition}
        onClick={onOpenNutrition}
      >
        <span aria-hidden="true"><Utensils /></span>
        <strong>Питание</strong>
      </button>
      <button
        type="button"
        data-testid="client-nav-cabinet"
        className={activeTab === "cabinet" ? styles.active : ""}
        aria-current={activeTab === "cabinet" ? "page" : undefined}
        onPointerDown={preloadCabinet}
        onFocus={onPreloadCabinet}
        onClick={onOpenCabinet}
      >
        <span aria-hidden="true"><UserRound /></span>
        <strong>Кабинет</strong>
      </button>
      </nav>
    </div>
  );
}

export function TrainerMainBottomBar({
  activeTab = "main",
  className = "mainMenuBottomBar profileBottomTabBar",
  onGoMain,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  return (
    <nav className={`${className} trainerRoleBottomBar`} aria-label="Разделы тренера">
      <button
        type="button"
        className={activeTab === "main" ? "active" : ""}
        aria-current={activeTab === "main" ? "page" : undefined}
        onClick={onGoMain}
      >
        <span aria-hidden="true">🏠</span>
        <strong>Главная</strong>
      </button>
      <button
        type="button"
        className={activeTab === "clients" ? "active" : ""}
        aria-current={activeTab === "clients" ? "page" : undefined}
        onClick={onOpenTrainerClients}
      >
        <span aria-hidden="true">👥</span>
        <strong>Клиенты</strong>
      </button>
      <button
        type="button"
        className={activeTab === "programs" ? "active" : ""}
        aria-current={activeTab === "programs" ? "page" : undefined}
        onClick={onOpenTrainerPrograms}
      >
        <span aria-hidden="true">📋</span>
        <strong>Программы</strong>
      </button>
      <button
        type="button"
        className={activeTab === "cabinet" ? "active" : ""}
        aria-current={activeTab === "cabinet" ? "page" : undefined}
        onClick={onLoadTrainerCabinet}
      >
        <span aria-hidden="true">👤</span>
        <strong>Кабинет</strong>
      </button>
    </nav>
  );
}

export function TrainerWorkspaceBottomBar({
  activeTab = "clients",
  onGoMain,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  return (
    <nav className="adminV3Nav adminV3BottomBar trainerRoleWorkspaceBar" aria-label="Разделы тренера">
      <button
        className={activeTab === "main" ? "active" : ""}
        type="button"
        aria-current={activeTab === "main" ? "page" : undefined}
        onClick={onGoMain}
      >
        <span className="adminV3NavIcon">🏠</span>
        <span className="adminV3NavLabel">Главная</span>
      </button>
      <button
        className={activeTab === "clients" ? "active" : ""}
        type="button"
        aria-current={activeTab === "clients" ? "page" : undefined}
        onClick={onOpenTrainerClients}
      >
        <span className="adminV3NavIcon">👥</span>
        <span className="adminV3NavLabel">Клиенты</span>
      </button>
      <button
        className={activeTab === "programs" ? "active" : ""}
        type="button"
        aria-current={activeTab === "programs" ? "page" : undefined}
        onClick={onOpenTrainerPrograms}
      >
        <span className="adminV3NavIcon">📋</span>
        <span className="adminV3NavLabel">Программы</span>
      </button>
      <button
        className={activeTab === "cabinet" ? "active" : ""}
        type="button"
        aria-current={activeTab === "cabinet" ? "page" : undefined}
        onClick={onLoadTrainerCabinet}
      >
        <span className="adminV3NavIcon">👤</span>
        <span className="adminV3NavLabel">Кабинет</span>
      </button>
    </nav>
  );
}

export function ClientTrainingBottomBar({
  activeTab = "workouts",
  onGoMain,
  onOpenWorkouts,
  onOpenPlan,
  onOpenHistory
}) {
  return (
    <div className={`${styles.dock} ${styles.trainingDock}`}>
      <nav
        className={styles.training}
        data-testid="client-training-bottom-nav"
        data-css-module-scope="training-bottom-bar"
        aria-label="Навигация тренировок"
      >
      <button type="button" onClick={onGoMain}>
        <span aria-hidden="true">🏠</span>
        <strong>Главная</strong>
      </button>
      <button
        type="button"
        className={activeTab === "workouts" ? styles.active : ""}
        aria-current={activeTab === "workouts" ? "page" : undefined}
        onClick={onOpenWorkouts}
      >
        <span aria-hidden="true">🏋️</span>
        <strong>Тренировки</strong>
      </button>
      <button
        type="button"
        className={activeTab === "plan" ? styles.active : ""}
        aria-current={activeTab === "plan" ? "page" : undefined}
        onClick={onOpenPlan}
      >
        <span aria-hidden="true">📋</span>
        <strong>План</strong>
      </button>
      <button type="button" onClick={onOpenHistory}>
        <span aria-hidden="true">🗓️</span>
        <strong>История</strong>
      </button>
      </nav>
    </div>
  );
}
