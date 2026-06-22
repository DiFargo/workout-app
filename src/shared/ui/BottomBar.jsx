
export function ClientMainBottomBar({
  activeTab = "main",
  className = "mainMenuBottomBar profileBottomTabBar",
  isTrainerMode,
  onGoMain,
  onOpenTraining,
  onOpenNutrition,
  onOpenCabinet,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onLoadTrainerCabinet
}) {
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

  return (
    <nav className={className} aria-label="Основные разделы">
      <button
        type="button"
        data-testid="client-nav-main"
        className={activeTab === "main" ? "active" : ""}
        aria-current={activeTab === "main" ? "page" : undefined}
        onClick={onGoMain}
      >
        <span aria-hidden="true">🏠</span>
        <strong>Главная</strong>
      </button>
      <button
        type="button"
        data-testid="client-nav-workouts"
        className={activeTab === "workouts" ? "active" : ""}
        aria-current={activeTab === "workouts" ? "page" : undefined}
        onClick={onOpenTraining}
      >
        <span aria-hidden="true">🏋️</span>
        <strong>Тренировки</strong>
      </button>
      <button
        type="button"
        data-testid="client-nav-nutrition"
        className={activeTab === "nutrition" ? "active" : ""}
        aria-current={activeTab === "nutrition" ? "page" : undefined}
        onClick={onOpenNutrition}
      >
        <span aria-hidden="true">🍽️</span>
        <strong>Питание</strong>
      </button>
      <button
        type="button"
        data-testid="client-nav-cabinet"
        className={activeTab === "cabinet" ? "active" : ""}
        aria-current={activeTab === "cabinet" ? "page" : undefined}
        onClick={onOpenCabinet}
      >
        <span aria-hidden="true">👤</span>
        <strong>Кабинет</strong>
      </button>
    </nav>
  );
}

export function TrainerMainBottomBar({
  activeTab = "main",
  className = "mainMenuBottomBar profileBottomTabBar",
  onGoMain,
  onOpenTrainerClients,
  onOpenTrainerPrograms,
  onOpenCabinet,
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
  onOpenCabinet,
  onLoadTrainerCabinet
}) {
  return (
    <nav className="adminV3Nav adminV3BottomBar trainerRoleWorkspaceBar" aria-label="Разделы тренера">
      <button
        className={activeTab === "main" ? "active" : ""}
        type="button"
        onClick={onGoMain}
      >
        <span className="adminV3NavIcon">🏠</span>
        <span className="adminV3NavLabel">Главная</span>
      </button>
      <button className={activeTab === "clients" ? "active" : ""} type="button" onClick={onOpenTrainerClients}>
        <span className="adminV3NavIcon">👥</span>
        <span className="adminV3NavLabel">Клиенты</span>
      </button>
      <button
        className={activeTab === "programs" ? "active" : ""}
        type="button"
        onClick={onOpenTrainerPrograms}
      >
        <span className="adminV3NavIcon">📋</span>
        <span className="adminV3NavLabel">Программы</span>
      </button>
      <button
        className={activeTab === "cabinet" ? "active" : ""}
        type="button"
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
    <nav className="individualWorkoutMenuBar" aria-label="Навигация тренировок">
      <button type="button" onClick={onGoMain}>
        <span aria-hidden="true">🏠</span>
        <strong>Главная</strong>
      </button>
      <button
        type="button"
        className={activeTab === "workouts" ? "active" : ""}
        aria-current={activeTab === "workouts" ? "page" : undefined}
        onClick={onOpenWorkouts}
      >
        <span aria-hidden="true">🏋️</span>
        <strong>Тренировки</strong>
      </button>
      <button
        type="button"
        className={activeTab === "plan" ? "active" : ""}
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
  );
}

