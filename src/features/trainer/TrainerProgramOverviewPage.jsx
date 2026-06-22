import {
  CalendarDays as ProgramCalendarIcon,
  Dumbbell as ProgramDumbbellIcon,
  ListChecks as ProgramListIcon,
  Pencil as ProgramEditIcon,
  Plus as ProgramPlusIcon,
  RefreshCw as ProgramRefreshIcon,
  Repeat2 as ProgramCycleIcon,
  Trash2 as ProgramTrashIcon,
  Upload as ProgramUploadIcon
} from "lucide-react";

export default function TrainerProgramOverviewPage({
  adminProgramCreateChoiceOpen,
  adminProgramImportInputRef,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  canUseAdminFeatures,
  createNewMonthProgramDraft,
  deleteSelectedProgramFromLibrary,
  getTemplateStats,
  isTrainerNextWorkspace,
  loadAdminTrainingTemplates,
  onGoAdmin,
  openProgramFromLibrary,
  setAdminProgramCreateChoiceOpen,
  setAdminSelectedTemplateId
}) {
  const selectedTemplate = adminTrainingTemplates.find((template) => template.id === adminSelectedTemplateId);
  const isNextWorkspace = isTrainerNextWorkspace();

  return (
    <main className="programsOverviewPage">
      <nav className="adminV3Nav programsTopActionBar" aria-label="Действия с программами">
        {!isNextWorkspace && (
          <>
            <button type="button" onClick={onGoAdmin}>
              <span className="adminV3NavIcon">←</span>
              <span className="adminV3NavLabel">Главная</span>
            </button>
            <button type="button" onClick={createNewMonthProgramDraft}>
              <span className="adminV3NavIcon">＋</span>
              <span className="adminV3NavLabel">Создать</span>
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!selectedTemplate}
          onClick={() => openProgramFromLibrary(selectedTemplate?.id)}
        >
          {isNextWorkspace ? <ProgramEditIcon size={19} /> : <span className="adminV3NavIcon">✎</span>}
          <span className="adminV3NavLabel">Редактировать</span>
        </button>
        {!isNextWorkspace && (
          <button type="button" onClick={() => adminProgramImportInputRef.current?.click()}>
            <span className="adminV3NavIcon">↑</span>
            <span className="adminV3NavLabel">Загрузить</span>
          </button>
        )}
        {isNextWorkspace && (
          <button
            className="danger"
            type="button"
            disabled={!selectedTemplate}
            onClick={deleteSelectedProgramFromLibrary}
          >
            <ProgramTrashIcon size={19} />
            <span className="adminV3NavLabel">Удалить</span>
          </button>
        )}
      </nav>

      <section className="programsOverviewSection">
        <div className="programsOverviewSectionHead">
          <div>
            <span>БИБЛИОТЕКА</span>
            <h2>Готовые программы</h2>
            <p>Выберите программу для просмотра и редактирования.</p>
          </div>
          <button type="button" onClick={loadAdminTrainingTemplates} aria-label="Обновить программы">
            <ProgramRefreshIcon size={17} />Обновить
          </button>
        </div>

        {adminTrainingTemplates.length === 0 ? (
          <div className="programsOverviewEmpty">
            <strong>{canUseAdminFeatures() ? "Пока нет готовых программ" : "У вас пока нет программ"}</strong>
            <p>Создайте первую программу или загрузите Excel/JSON.</p>
            <div className="programsOverviewConstructorActions">
              {isNextWorkspace ? (
                <button type="button" onClick={() => setAdminProgramCreateChoiceOpen(true)}>Создать или загрузить новую программу</button>
              ) : (
                <>
                  <button type="button" onClick={createNewMonthProgramDraft}>Создать</button>
                  <button type="button" onClick={() => adminProgramImportInputRef.current?.click()}>Загрузить</button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="programsOverviewGrid">
            {adminTrainingTemplates.map((template) => {
              const stats = getTemplateStats(template);
              const isSelected = adminSelectedTemplateId === template.id;
              const createdAt = template.createdAt ? new Date(template.createdAt) : null;
              const createdLabel = createdAt && !Number.isNaN(createdAt.getTime())
                ? createdAt.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
                : "—";

              return (
                <button
                  className={isSelected ? "programsOverviewCard selected" : "programsOverviewCard"}
                  type="button"
                  key={template.id}
                  onClick={() => setAdminSelectedTemplateId(template.id)}
                >
                  <div className="programsOverviewCardTitle">
                    <i><ProgramDumbbellIcon size={29} /></i>
                    <div>
                      <strong>{template.name || "Без названия"}</strong>
                      <p>{template.description || "Готовая тренировочная программа из библиотеки."}</p>
                    </div>
                    {isSelected && <span><b>✓</b>Выбрана</span>}
                  </div>
                  <div className="programsOverviewCardStats">
                    <span><ProgramCalendarIcon size={16} /><b>{stats.weeksCount}</b><small>недель</small></span>
                    <span><ProgramDumbbellIcon size={16} /><b>{stats.workoutsCount}</b><small>тренировок</small></span>
                    <span><ProgramCycleIcon size={16} /><b>{stats.blocksCount}</b><small>микроцикла</small></span>
                    <span><ProgramListIcon size={16} /><b>{stats.exercisesCount}</b><small>упражнений</small></span>
                  </div>
                  <footer><span>Создана: {createdLabel}</span><span>Автор: Вы</span><b>•••</b></footer>
                </button>
              );
            })}
            {isNextWorkspace && (
              <button className="programsOverviewCreateCard" type="button" onClick={() => setAdminProgramCreateChoiceOpen(true)}>
                <ProgramPlusIcon size={21} />
                <strong>Создать или загрузить новую программу</strong>
                <span>Выберите: начать с нуля или импортировать готовую программу</span>
              </button>
            )}
          </div>
        )}
      </section>

      {isNextWorkspace && adminProgramCreateChoiceOpen && (
        <div className="programCreateChoiceOverlay" role="dialog" aria-modal="true" aria-labelledby="programCreateChoiceTitle" onClick={() => setAdminProgramCreateChoiceOpen(false)}>
          <section className="programCreateChoiceSheet" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>НОВАЯ ПРОГРАММА</span>
                <h2 id="programCreateChoiceTitle">Создать или загрузить?</h2>
              </div>
              <button type="button" onClick={() => setAdminProgramCreateChoiceOpen(false)} aria-label="Закрыть">×</button>
            </header>
            <div>
              <button
                type="button"
                onClick={() => {
                  setAdminProgramCreateChoiceOpen(false);
                  createNewMonthProgramDraft();
                }}
              >
                <ProgramPlusIcon size={22} />
                <span><strong>Создать с нуля</strong><small>Открыть пустой конструктор программы.</small></span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminProgramCreateChoiceOpen(false);
                  adminProgramImportInputRef.current?.click();
                }}
              >
                <ProgramUploadIcon size={22} />
                <span><strong>Загрузить файл</strong><small>Импортировать готовую программу из Excel или JSON.</small></span>
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
