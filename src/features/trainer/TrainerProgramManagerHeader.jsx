export default function TrainerProgramManagerHeader({
  adminOpenProgramBlocks,
  adminOpenWorkoutId,
  adminProgramLibraryTab,
  handleMonthProgramBack,
  isTrainerNextWorkspace,
  onGoAdmin,
  setTrainerProgramManagerOpen
}) {
  const isNextWorkspace = isTrainerNextWorkspace();

  if (isNextWorkspace) return null;

  return (
    <header className="programsCompactHeader">
      <button
        className="adminFixedMainBack"
        type="button"
        onClick={() => {
          if (adminProgramLibraryTab === "editor") {
            handleMonthProgramBack();
            return;
          }
          if (isNextWorkspace) {
            setTrainerProgramManagerOpen(false);
            return;
          }
          onGoAdmin();
        }}
        aria-label={
          adminProgramLibraryTab !== "editor"
            ? isNextWorkspace ? "К плану клиента" : "Главная"
            : adminOpenWorkoutId
              ? "Назад к микроциклу"
              : Object.values(adminOpenProgramBlocks).some(Boolean)
                ? "К списку микроциклов"
                : "К программам"
        }
      >
        <span>←</span>
        <b>
          {adminProgramLibraryTab !== "editor"
            ? isNextWorkspace ? "К плану клиента" : "Главная"
            : adminOpenWorkoutId
              ? "К микроциклу"
              : Object.values(adminOpenProgramBlocks).some(Boolean)
                ? "К микроциклам"
                : "К программам"}
        </b>
      </button>
      <h1>{adminProgramLibraryTab === "editor" ? "Редактор программы" : "Программы"}</h1>
    </header>
  );
}
