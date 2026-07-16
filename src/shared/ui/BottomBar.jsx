
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

function NavigationItems({
  items,
  activeTab,
  activeClassName,
  iconClassName,
  labelClassName,
  labelElement: LabelElement = "strong"
}) {
  return items.map((item) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    const preload = runDeferredTouchPreload(item.onPreload);

    return (
      <button
        key={item.id}
        type="button"
        data-testid={item.testId}
        className={isActive ? activeClassName : ""}
        aria-current={isActive ? "page" : undefined}
        onPointerDown={preload}
        onFocus={item.onPreload}
        onClick={item.onClick}
      >
        <span className={iconClassName} aria-hidden="true">
          {typeof Icon === "string" ? Icon : <Icon />}
        </span>
        <LabelElement className={labelClassName}>{item.label}</LabelElement>
      </button>
    );
  });
}

export function PrimaryBottomNavigation({
  activeTab = "main",
  onGoMain,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onPreloadMain,
  onPreloadTraining,
  onPreloadNutrition,
  onPreloadCabinet
}) {
  const items = [
    { id: "main", label: "Главная", icon: Home, testId: "client-nav-main", onClick: onGoMain, onPreload: onPreloadMain },
    { id: "workouts", label: "Тренировки", icon: Dumbbell, testId: "client-nav-workouts", onClick: onOpenTraining, onPreload: onPreloadTraining },
    { id: "nutrition", label: "Питание", icon: Utensils, testId: "client-nav-nutrition", onClick: onOpenNutrition, onPreload: onPreloadNutrition },
    { id: "cabinet", label: "Кабинет", icon: UserRound, testId: "client-nav-cabinet", onClick: onOpenCabinet, onPreload: onPreloadCabinet }
  ];

  return (
    <nav
      className={styles.main}
      data-css-module-scope="client-primary-bottom-bar"
      data-testid="client-bottom-nav"
      aria-label="Основные разделы"
    >
      <NavigationItems items={items} activeTab={activeTab} activeClassName={styles.active} />
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
  const items = [
    { id: "main", label: "Главная", icon: "🏠", onClick: onGoMain },
    { id: "workouts", label: "Тренировки", icon: "🏋️", onClick: onOpenWorkouts },
    { id: "plan", label: "План", icon: "📋", onClick: onOpenPlan },
    { id: "history", label: "История", icon: "🗓️", onClick: onOpenHistory }
  ];

  return (
    <nav
      className={styles.training}
      data-testid="client-training-bottom-nav"
      data-css-module-scope="training-bottom-bar"
      aria-label="Навигация тренировок"
    >
      <NavigationItems items={items} activeTab={activeTab} activeClassName={styles.active} />
    </nav>
  );
}
