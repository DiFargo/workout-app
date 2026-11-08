
import { CalendarDays, ChartNoAxesColumnIncreasing, ClipboardList, Dumbbell, Home, UserRound, Utensils } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import styles from "./BottomBar.module.css";

const CLIENT_TABS = ["main", "workouts", "nutrition", "progress", "cabinet"];
let previousClientTab = "main";

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
  onOpenProgress,
  onOpenCabinet,
  onPreloadMain,
  onPreloadTraining,
  onPreloadNutrition,
  onPreloadCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
  const lensRef = useRef(null);
  const tabIndex = Math.max(0, CLIENT_TABS.indexOf(activeTab));
  useLayoutEffect(() => {
    if (isTrainerMode || !lensRef.current) return;
    const from = Math.max(0, CLIENT_TABS.indexOf(previousClientTab));
    previousClientTab = activeTab;
    if (from === tabIndex || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lens = lensRef.current;
    const animation = lens.animate([{ transform: `translateX(${from * 100}%)` }, { transform: `translateX(${tabIndex * 100}%)` }],
      { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
    return () => animation.cancel();
  }, [activeTab, isTrainerMode, tabIndex]);
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
    <div
      className={`${styles.dock} ${nutritionVariant ? styles.nutritionDock : styles.mainDock}`}
      data-client-bottom-dock="true"
    >
      <nav
        className={navigationClassName}
        data-css-module-scope={nutritionVariant ? "nutrition-bottom-bar" : "client-main-bottom-bar"}
        data-testid="client-bottom-nav"
        aria-label="Основные разделы"
      >
      <span ref={lensRef} className={styles.lens} aria-hidden="true" style={{ transform: `translateX(${tabIndex * 100}%)` }} />
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
        <strong>Сегодня</strong>
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
        data-testid="client-nav-progress"
        className={activeTab === "progress" ? styles.active : ""}
        aria-current={activeTab === "progress" ? "page" : undefined}
        onClick={onOpenProgress}
      >
        <span aria-hidden="true"><ChartNoAxesColumnIncreasing /></span>
        <strong>Прогресс</strong>
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
    <div className={`${styles.dock} ${styles.trainingDock}`} data-client-bottom-dock="true">
      <nav
        className={styles.training}
        data-testid="client-training-bottom-nav"
        data-css-module-scope="training-bottom-bar"
        aria-label="Навигация тренировок"
      >
      <button type="button" onClick={onGoMain}>
        <span aria-hidden="true"><Home /></span>
        <strong>Главная</strong>
      </button>
      <button
        type="button"
        className={activeTab === "workouts" ? styles.active : ""}
        aria-current={activeTab === "workouts" ? "page" : undefined}
        onClick={onOpenWorkouts}
      >
        <span aria-hidden="true"><Dumbbell /></span>
        <strong>Тренировки</strong>
      </button>
      <button
        type="button"
        className={activeTab === "plan" ? styles.active : ""}
        aria-current={activeTab === "plan" ? "page" : undefined}
        onClick={onOpenPlan}
      >
        <span aria-hidden="true"><ClipboardList /></span>
        <strong>План</strong>
      </button>
      <button type="button" onClick={onOpenHistory}>
        <span aria-hidden="true"><CalendarDays /></span>
        <strong>История</strong>
      </button>
      </nav>
    </div>
  );
}
