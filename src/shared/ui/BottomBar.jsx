
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
    <nav className={className} aria-label="ÐžÑÐ½Ð¾Ð²Ð½Ñ‹Ðµ Ñ€Ð°Ð·Ð´ÐµÐ»Ñ‹">
      <button
        type="button"
        className={activeTab === "main" ? "active" : ""}
        aria-current={activeTab === "main" ? "page" : undefined}
        onClick={onGoMain}
      >
        <span aria-hidden="true">ðŸ </span>
        <strong>Ð“Ð»Ð°Ð²Ð½Ð°Ñ</strong>
      </button>
      <button
        type="button"
        className={activeTab === "workouts" ? "active" : ""}
        aria-current={activeTab === "workouts" ? "page" : undefined}
        onClick={onOpenTraining}
      >
        <span aria-hidden="true">ðŸ‹ï¸</span>
        <strong>Ð¢Ñ€ÐµÐ½Ð¸Ñ€Ð¾Ð²ÐºÐ¸</strong>
      </button>
      <button
        type="button"
        className={activeTab === "nutrition" ? "active" : ""}
        aria-current={activeTab === "nutrition" ? "page" : undefined}
        onClick={onOpenNutrition}
      >
        <span aria-hidden="true">ðŸ½ï¸</span>
        <strong>ÐŸÐ¸Ñ‚Ð°Ð½Ð¸Ðµ</strong>
      </button>
      <button
        type="button"
        className={activeTab === "cabinet" ? "active" : ""}
        aria-current={activeTab === "cabinet" ? "page" : undefined}
        onClick={onOpenCabinet}
      >
        <span aria-hidden="true">ðŸ‘¤</span>
        <strong>ÐšÐ°Ð±Ð¸Ð½ÐµÑ‚</strong>
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
    <nav className={`${className} trainerRoleBottomBar`} aria-label="Ð Ð°Ð·Ð´ÐµÐ»Ñ‹ Ñ‚Ñ€ÐµÐ½ÐµÑ€Ð°">
      <button
        type="button"
        className={activeTab === "main" ? "active" : ""}
        aria-current={activeTab === "main" ? "page" : undefined}
        onClick={onGoMain}
      >
        <span aria-hidden="true">ðŸ </span>
        <strong>Ð“Ð»Ð°Ð²Ð½Ð°Ñ</strong>
      </button>
      <button
        type="button"
        className={activeTab === "clients" ? "active" : ""}
        aria-current={activeTab === "clients" ? "page" : undefined}
        onClick={onOpenTrainerClients}
      >
        <span aria-hidden="true">ðŸ‘¥</span>
        <strong>ÐšÐ»Ð¸ÐµÐ½Ñ‚Ñ‹</strong>
      </button>
      <button
        type="button"
        className={activeTab === "programs" ? "active" : ""}
        aria-current={activeTab === "programs" ? "page" : undefined}
        onClick={onOpenTrainerPrograms}
      >
        <span aria-hidden="true">ðŸ“‹</span>
        <strong>ÐŸÑ€Ð¾Ð³Ñ€Ð°Ð¼Ð¼Ñ‹</strong>
      </button>
      <button
        type="button"
        className={activeTab === "cabinet" ? "active" : ""}
        aria-current={activeTab === "cabinet" ? "page" : undefined}
        onClick={onLoadTrainerCabinet}
      >
        <span aria-hidden="true">ðŸ‘¤</span>
        <strong>ÐšÐ°Ð±Ð¸Ð½ÐµÑ‚</strong>
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
    <nav className="adminV3Nav adminV3BottomBar trainerRoleWorkspaceBar" aria-label="Ð Ð°Ð·Ð´ÐµÐ»Ñ‹ Ñ‚Ñ€ÐµÐ½ÐµÑ€Ð°">
      <button
        className={activeTab === "main" ? "active" : ""}
        type="button"
        onClick={onGoMain}
      >
        <span className="adminV3NavIcon">ðŸ </span>
        <span className="adminV3NavLabel">Ð“Ð»Ð°Ð²Ð½Ð°Ñ</span>
      </button>
      <button className={activeTab === "clients" ? "active" : ""} type="button" onClick={onOpenTrainerClients}>
        <span className="adminV3NavIcon">ðŸ‘¥</span>
        <span className="adminV3NavLabel">ÐšÐ»Ð¸ÐµÐ½Ñ‚Ñ‹</span>
      </button>
      <button
        className={activeTab === "programs" ? "active" : ""}
        type="button"
        onClick={onOpenTrainerPrograms}
      >
        <span className="adminV3NavIcon">ðŸ“‹</span>
        <span className="adminV3NavLabel">ÐŸÑ€Ð¾Ð³Ñ€Ð°Ð¼Ð¼Ñ‹</span>
      </button>
      <button
        className={activeTab === "cabinet" ? "active" : ""}
        type="button"
        onClick={onLoadTrainerCabinet}
      >
        <span className="adminV3NavIcon">ðŸ‘¤</span>
        <span className="adminV3NavLabel">ÐšÐ°Ð±Ð¸Ð½ÐµÑ‚</span>
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
    <nav className="individualWorkoutMenuBar" aria-label="ÐÐ°Ð²Ð¸Ð³Ð°Ñ†Ð¸Ñ Ñ‚Ñ€ÐµÐ½Ð¸Ñ€Ð¾Ð²Ð¾Ðº">
      <button type="button" onClick={onGoMain}>
        <span aria-hidden="true">ðŸ </span>
        <strong>Ð“Ð»Ð°Ð²Ð½Ð°Ñ</strong>
      </button>
      <button
        type="button"
        className={activeTab === "workouts" ? "active" : ""}
        aria-current={activeTab === "workouts" ? "page" : undefined}
        onClick={onOpenWorkouts}
      >
        <span aria-hidden="true">ðŸ‹ï¸</span>
        <strong>Ð¢Ñ€ÐµÐ½Ð¸Ñ€Ð¾Ð²ÐºÐ¸</strong>
      </button>
      <button
        type="button"
        className={activeTab === "plan" ? "active" : ""}
        aria-current={activeTab === "plan" ? "page" : undefined}
        onClick={onOpenPlan}
      >
        <span aria-hidden="true">ðŸ“‹</span>
        <strong>ÐŸÐ»Ð°Ð½</strong>
      </button>
      <button type="button" onClick={onOpenHistory}>
        <span aria-hidden="true">ðŸ—“ï¸</span>
        <strong>Ð˜ÑÑ‚Ð¾Ñ€Ð¸Ñ</strong>
      </button>
    </nav>
  );
}

