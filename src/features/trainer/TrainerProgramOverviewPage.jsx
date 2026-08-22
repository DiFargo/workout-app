import {
  Check as ProgramCheckIcon,
  Copy as ProgramCopyIcon,
  Dumbbell as ProgramDumbbellIcon,
  FileText as ProgramFileTextIcon,
  ListChecks as ProgramListIcon,
  Pencil as ProgramEditIcon,
  Plus as ProgramPlusIcon,
  Search as ProgramSearchIcon,
  Sparkles as ProgramSparklesIcon,
  Trash2 as ProgramTrashIcon,
  Upload as ProgramUploadIcon
} from "lucide-react";
import { useState } from "react";
import {
  getTrainerProgramStatusMeta,
  TRAINER_PROGRAM_STATUSES
} from "../../utils/trainerProgramLifecycle.js";
import { getTrainerProgramFormatMeta, TRAINER_PROGRAM_FORMATS } from "../../utils/trainerProgramFormat.js";
import styles from "./TrainerProgramOverviewPage.module.css";

function getProgramLibraryStatusMeta(program = {}) {
  const status = getTrainerProgramStatusMeta(program);

  if (status.id === "draft") {
    return {
      ...status,
      label: "Черновик",
      description: "Не назначается клиентам, пока не подготовлена"
    };
  }

  if (status.id === "archived") {
    return { ...status, label: "Архив", description: "Программу нельзя назначить клиенту" };
  }

  if (
    status.id === "assigned" ||
    status.id === "active" ||
    (Array.isArray(program.assignedClientIds) && program.assignedClientIds.length > 0)
  ) {
    return { ...status, tone: "used", label: "Используется", description: "Программа назначена одному или нескольким клиентам" };
  }

  return {
    ...status,
    tone: "ready",
    label: "Готова к назначению",
    description: "Программу можно назначать клиентам"
  };
}

export default function TrainerProgramOverviewPage({
  adminProgramCreateChoiceOpen,
  adminProgramImportInputRef,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  canUseAdminFeatures,
  createNewMonthProgramDraft,
  deleteSelectedProgramFromLibrary,
  duplicateMonthProgramFromLibrary,
  getTemplateStats,
  importMonthProgramWithAi,
  isTrainerNextWorkspace,
  onGoAdmin,
  openProgramFromLibrary,
  prepareMonthProgramForAssignment,
  setAdminProgramCreateChoiceOpen,
  setAdminSelectedTemplateId
}) {
  const selectedTemplate = adminTrainingTemplates.find((template) => template.id === adminSelectedTemplateId);
  const isNextWorkspace = isTrainerNextWorkspace();
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [aiImportText, setAiImportText] = useState("");
  const [aiImportFile, setAiImportFile] = useState(null);
  const [aiImportLoading, setAiImportLoading] = useState(false);
  const [aiImportError, setAiImportError] = useState("");
  const [programSearch, setProgramSearch] = useState("");
  const normalizedProgramSearch = programSearch.trim().toLocaleLowerCase("ru-RU");
  const visibleTrainingTemplates = normalizedProgramSearch
    ? adminTrainingTemplates.filter((template) => [template.name, template.description]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(normalizedProgramSearch)))
    : adminTrainingTemplates;

  function closeCreateChoice() {
    if (aiImportLoading) return;
    setAiImportOpen(false);
    setAiImportText("");
    setAiImportFile(null);
    setAiImportError("");
    setAdminProgramCreateChoiceOpen(false);
  }

  async function handleAiImportSubmit(event) {
    event.preventDefault();
    if (aiImportLoading) return;
    if (!aiImportText.trim() && !aiImportFile) {
      setAiImportError("Вставьте текст программы или прикрепите файл.");
      return;
    }

    setAiImportLoading(true);
    setAiImportError("");
    try {
      await importMonthProgramWithAi({ text: aiImportText, file: aiImportFile });
      closeCreateChoice();
    } catch (error) {
      setAiImportError(error.message || "Не получилось распознать программу.");
    } finally {
      setAiImportLoading(false);
    }
  }

  return (
    <main className={isNextWorkspace ? styles.root : "programsOverviewPage"}>
      {!isNextWorkspace && (
        <nav className="adminV3Nav programsTopActionBar" aria-label="Действия с программами">
            <button type="button" onClick={onGoAdmin}>
              <span className="adminV3NavIcon">←</span>
              <span className="adminV3NavLabel">Главная</span>
            </button>
            <button type="button" onClick={createNewMonthProgramDraft}>
              <span className="adminV3NavIcon">＋</span>
              <span className="adminV3NavLabel">Создать</span>
            </button>
            <button
              type="button"
              disabled={!selectedTemplate}
              onClick={() => openProgramFromLibrary(selectedTemplate?.id)}
            >
              <span className="adminV3NavIcon">✎</span>
              <span className="adminV3NavLabel">Редактировать</span>
            </button>
          <button type="button" onClick={() => adminProgramImportInputRef.current?.click()}>
            <span className="adminV3NavIcon">↑</span>
            <span className="adminV3NavLabel">Загрузить</span>
          </button>
        </nav>
      )}

      <section
        className={isNextWorkspace ? styles.section : "programsOverviewSection"}
        onClick={() => setAdminSelectedTemplateId("")}
      >
        {!isNextWorkspace ? (
          <div className="programsOverviewSectionHead">
            <div>
              <span>БИБЛИОТЕКА</span>
              <h2>Готовые программы</h2>
              <p>Выберите программу для просмотра и редактирования.</p>
            </div>
          </div>
        ) : null}

        {isNextWorkspace ? (
          <div className={styles.toolbar} onClick={(event) => event.stopPropagation()}>
            <label className={styles.searchField}>
              <ProgramSearchIcon size={20} aria-hidden="true" />
              <input
                type="search"
                value={programSearch}
                onChange={(event) => setProgramSearch(event.target.value)}
                placeholder="Найти программу"
                aria-label="Найти программу"
              />
            </label>
            <button className={styles.addButton} type="button" onClick={() => setAdminProgramCreateChoiceOpen(true)}>
              <ProgramPlusIcon size={20} />
              Добавить
            </button>
          </div>
        ) : null}

        {adminTrainingTemplates.length === 0 && !isNextWorkspace ? (
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
          <div className={isNextWorkspace ? styles.grid : "programsOverviewGrid"} data-testid={isNextWorkspace ? "trainer-program-overview-grid" : undefined}>
            {visibleTrainingTemplates.map((template) => {
          const stats = getTemplateStats(template);
          const isSelected = adminSelectedTemplateId === template.id;
          const statusMeta = getProgramLibraryStatusMeta(template);
          const isDraft = statusMeta.id === TRAINER_PROGRAM_STATUSES.DRAFT;
              const formatMeta = getTrainerProgramFormatMeta(template.trainingFormat);
              const createdAt = template.createdAt ? new Date(template.createdAt) : null;
              const createdLabel = createdAt && !Number.isNaN(createdAt.getTime())
                ? createdAt.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
                : "—";

              const programContent = (
                <>
                  <div className={isNextWorkspace ? styles.cardTitle : "programsOverviewCardTitle"}>
                    <i><ProgramDumbbellIcon size={29} /></i>
                    <div>
                      <strong>{template.name || "Без названия"}</strong>
                      <p>{template.description || "Готовая тренировочная программа из библиотеки."}</p>
                      {formatMeta ? <span className={styles.formatBadge}>{formatMeta.label}</span> : null}
                    </div>
                  </div>
                  <div className={isNextWorkspace ? styles.cardStats : "programsOverviewCardStats"}>
                    <span><ProgramDumbbellIcon size={16} /><b>{stats.workoutsCount}</b><small>тренировок</small></span>
                    <span><ProgramListIcon size={16} /><b>{stats.exercisesCount}</b><small>упражнений</small></span>
                  </div>
                  <footer>
                    <span>Создана: {createdLabel}</span>
                    <span className={isNextWorkspace
                      ? `${styles.statusBadge}${statusMeta.tone === "used" ? ` ${styles.statusUsed}` : ""}`
                      : `programsOverviewStatusBadge status-${statusMeta.tone}`} title={statusMeta.description}>
                      {statusMeta.label}
                    </span>
                    {isSelected && (
                      <span className={styles.selectedMark} aria-label="Выбрана" title="Выбрана">
                        <ProgramCheckIcon size={15} aria-hidden="true" />
                      </span>
                    )}
                  </footer>
                </>
              );

              if (!isNextWorkspace) {
                return (
                  <button
                    className={isSelected ? "programsOverviewCard selected" : "programsOverviewCard"}
                    type="button"
                    aria-pressed={isSelected}
                    key={template.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setAdminSelectedTemplateId(isSelected ? "" : template.id);
                    }}
                  >
                    {programContent}
                  </button>
                );
              }

              return (
                <article
                  className={`${styles.card}${isSelected ? ` ${styles.selected}` : ""}`}
                  data-testid="trainer-program-overview-card"
                  key={template.id}
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    className={styles.cardSelect}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setAdminSelectedTemplateId(isSelected ? "" : template.id)}
                  >
                    {programContent}
                  </button>
              {isSelected && (
                <div
                  className={[
                    styles.selectedActions,
                    isDraft ? styles.selectedActionsWithPrepare : ""
                  ].filter(Boolean).join(" ")}
                  aria-label={`Действия с программой «${template.name || "Без названия"}»`}
                >
                  {isDraft ? (
                    <button
                      className={styles.prepareAction}
                      type="button"
                      onClick={() => prepareMonthProgramForAssignment?.(template.id)}
                    >
                      <ProgramCheckIcon size={17} />
                      Подготовить к назначению
                    </button>
                  ) : null}
                  <button className={styles.editAction} type="button" onClick={() => openProgramFromLibrary(template.id)}>
                        <ProgramEditIcon size={17} />
                        Редактировать
                      </button>
                      <button className={styles.copyAction} type="button" onClick={() => duplicateMonthProgramFromLibrary(template.id)}>
                        <ProgramCopyIcon size={17} />
                        Создать копию программы
                      </button>
                      <button className={styles.deleteAction} type="button" onClick={deleteSelectedProgramFromLibrary}>
                        <ProgramTrashIcon size={17} />
                        Удалить
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
            {isNextWorkspace && visibleTrainingTemplates.length === 0 ? (
              <div className={styles.empty}>
                <strong>{adminTrainingTemplates.length ? "Программы не найдены" : "Программ пока нет"}</strong>
                <span>{adminTrainingTemplates.length ? "Попробуйте изменить запрос поиска." : "Добавьте первую программу через кнопку выше."}</span>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {isNextWorkspace && adminProgramCreateChoiceOpen && !aiImportOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="programCreateChoiceTitle" onClick={closeCreateChoice}>
          <section className={styles.choiceSheet} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>НОВАЯ ПРОГРАММА</span>
                <h2 id="programCreateChoiceTitle">Выберите формат программы</h2>
              </div>
              <button type="button" onClick={closeCreateChoice} aria-label="Закрыть">×</button>
            </header>
            <p className={styles.choiceHint}>Формат сохранится в программе и поможет сразу задать структуру тренировок.</p>
            <div className={styles.choiceOptions}>
              {TRAINER_PROGRAM_FORMATS.map((format, index) => {
                const Icon = index === 1 ? ProgramListIcon : index === 2 ? ProgramSparklesIcon : ProgramDumbbellIcon;

                return (
                  <button
                    data-program-format={format.id}
                    key={format.id}
                    type="button"
                    onClick={() => {
                      setAdminProgramCreateChoiceOpen(false);
                      createNewMonthProgramDraft(format.id);
                    }}
                  >
                    <Icon size={22} />
                    <span><strong>{format.label}</strong><small>{format.description}</small></span>
                  </button>
                );
              })}
              <p className={styles.choiceDivider}>или загрузите уже готовую программу</p>
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
              <button
                type="button"
                onClick={() => {
                  setAiImportOpen(true);
                  setAiImportError("");
                }}
              >
                <ProgramSparklesIcon size={22} />
                <span><strong>ИИ импорт программы</strong><small>Вставьте текст или загрузите фото/документ, ИИ соберёт программу для редактора.</small></span>
              </button>
            </div>
          </section>
        </div>
      )}

      {isNextWorkspace && adminProgramCreateChoiceOpen && aiImportOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="programAiImportTitle" onClick={closeCreateChoice}>
          <form className={`${styles.choiceSheet} ${styles.aiImportSheet}`} onSubmit={handleAiImportSubmit} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>ИИ ИМПОРТ</span>
                <h2 id="programAiImportTitle">Создать из материала</h2>
              </div>
              <button type="button" onClick={closeCreateChoice} aria-label="Закрыть">×</button>
            </header>
            <p className={styles.aiImportHint}>
              Загрузите фото, PDF/DOCX или вставьте текст программы. ИИ распознает дни, упражнения, подходы и повторения.
            </p>
            <label className={styles.aiImportText}>
              <span>Текст программы</span>
              <textarea
                value={aiImportText}
                onChange={(event) => setAiImportText(event.target.value)}
                placeholder={"Пример: День 1 — грудь и спина. Жим лежа 3×10 60 кг, тяга блока 3×12..."}
                rows={7}
              />
            </label>
            <label className={styles.aiImportFile}>
              <ProgramFileTextIcon size={22} />
              <span>
                <strong>{aiImportFile ? aiImportFile.name : "Прикрепить файл"}</strong>
                <small>Фото, PDF, DOCX, TXT, JSON или CSV до 8 МБ.</small>
              </span>
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => {
                  setAiImportFile(event.target.files?.[0] || null);
                  setAiImportError("");
                }}
              />
            </label>
            {aiImportError && <p className={styles.aiImportError}>{aiImportError}</p>}
            <div className={styles.aiImportActions}>
              <button type="button" onClick={() => setAiImportOpen(false)} disabled={aiImportLoading}>Назад</button>
              <button type="submit" disabled={aiImportLoading}>
                {aiImportLoading ? "Анализирую..." : "Создать черновик"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
