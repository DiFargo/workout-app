import {
  CalendarDays as ProgramCalendarIcon,
  Check as ProgramCheckIcon,
  Dumbbell as ProgramDumbbellIcon,
  FileText as ProgramFileTextIcon,
  ListChecks as ProgramListIcon,
  Pencil as ProgramEditIcon,
  Plus as ProgramPlusIcon,
  RefreshCw as ProgramRefreshIcon,
  Repeat2 as ProgramCycleIcon,
  Sparkles as ProgramSparklesIcon,
  Trash2 as ProgramTrashIcon,
  Upload as ProgramUploadIcon
} from "lucide-react";
import { useState } from "react";
import { getTrainerProgramStatusMeta } from "../../utils/trainerProgramLifecycle.js";
import styles from "./TrainerProgramOverviewPage.module.css";

function getProgramLibraryStatusMeta(program = {}) {
  const status = getTrainerProgramStatusMeta(program);

  if (status.id === "draft") {
    return { ...status, label: "Черновик", description: "Видит только тренер" };
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

  return { ...status, tone: "ready", label: "Готова", description: "Программу можно использовать и назначать клиентам" };
}

export default function TrainerProgramOverviewPage({
  adminProgramCreateChoiceOpen,
  adminProgramImportInputRef,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  canUseAdminFeatures,
  createNewMonthProgramDraft,
  deleteSelectedProgramFromLibrary,
  getTemplateStats,
  importMonthProgramWithAi,
  isTrainerNextWorkspace,
  loadAdminTrainingTemplates,
  onGoAdmin,
  openProgramFromLibrary,
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

      <section className={isNextWorkspace ? styles.section : "programsOverviewSection"}>
        <div className={isNextWorkspace ? styles.sectionHead : "programsOverviewSectionHead"}>
          <div>
            <span>БИБЛИОТЕКА</span>
            <h2>Готовые программы</h2>
            <p>Выберите программу для просмотра и редактирования.</p>
          </div>
          <div className={styles.headerActions}>
            {isNextWorkspace && (
              <>
                <button
                  type="button"
                  disabled={!selectedTemplate}
                  onClick={() => openProgramFromLibrary(selectedTemplate?.id)}
                >
                  <ProgramEditIcon size={18} />
                  Редактировать
                </button>
                <button
                  className={styles.deleteAction}
                  type="button"
                  disabled={!selectedTemplate}
                  onClick={deleteSelectedProgramFromLibrary}
                >
                  <ProgramTrashIcon size={18} />
                  Удалить
                </button>
              </>
            )}
            <button type="button" onClick={loadAdminTrainingTemplates} aria-label="Обновить программы">
              <ProgramRefreshIcon size={17} />Обновить
            </button>
          </div>
        </div>

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
          <div className={isNextWorkspace ? styles.grid : "programsOverviewGrid"}>
            {adminTrainingTemplates.map((template) => {
              const stats = getTemplateStats(template);
              const isSelected = adminSelectedTemplateId === template.id;
              const statusMeta = getProgramLibraryStatusMeta(template);
              const createdAt = template.createdAt ? new Date(template.createdAt) : null;
              const createdLabel = createdAt && !Number.isNaN(createdAt.getTime())
                ? createdAt.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
                : "—";

              return (
                <button
                  className={isNextWorkspace
                    ? `${styles.card}${isSelected ? ` ${styles.selected}` : ""}`
                    : `${isSelected ? "programsOverviewCard selected" : "programsOverviewCard"}`}
                  type="button"
                  aria-pressed={isSelected}
                  key={template.id}
                  onClick={() => setAdminSelectedTemplateId(template.id)}
                >
                  <div className={isNextWorkspace ? styles.cardTitle : "programsOverviewCardTitle"}>
                    <i><ProgramDumbbellIcon size={29} /></i>
                    <div>
                      <strong>{template.name || "Без названия"}</strong>
                      <p>{template.description || "Готовая тренировочная программа из библиотеки."}</p>
                    </div>
                    {isSelected && (
                      <span className={styles.selectedMark} aria-label="Выбрана" title="Выбрана">
                        <ProgramCheckIcon size={15} aria-hidden="true" />
                      </span>
                    )}
                  </div>
                  <div className={isNextWorkspace ? styles.cardStats : "programsOverviewCardStats"}>
                    <span><ProgramCalendarIcon size={16} /><b>{stats.weeksCount}</b><small>недель</small></span>
                    <span><ProgramDumbbellIcon size={16} /><b>{stats.workoutsCount}</b><small>тренировок</small></span>
                    <span><ProgramCycleIcon size={16} /><b>{stats.blocksCount}</b><small>микроцикла</small></span>
                    <span><ProgramListIcon size={16} /><b>{stats.exercisesCount}</b><small>упражнений</small></span>
                  </div>
                  <footer>
                    <span>Создана: {createdLabel}</span>
                    <span className={isNextWorkspace
                      ? `${styles.statusBadge}${statusMeta.tone === "used" ? ` ${styles.statusUsed}` : ""}`
                      : `programsOverviewStatusBadge status-${statusMeta.tone}`} title={statusMeta.description}>
                      {statusMeta.label}
                    </span>
                  </footer>
                </button>
              );
            })}
            {isNextWorkspace && (
              <button className={styles.createCard} type="button" onClick={() => setAdminProgramCreateChoiceOpen(true)}>
                <i><ProgramPlusIcon size={38} /></i>
                <strong>Добавить программу</strong>
                <span>Создать с нуля или импортировать</span>
              </button>
            )}
          </div>
        )}
      </section>

      {isNextWorkspace && adminProgramCreateChoiceOpen && !aiImportOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="programCreateChoiceTitle" onClick={closeCreateChoice}>
          <section className={styles.choiceSheet} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>НОВАЯ ПРОГРАММА</span>
                <h2 id="programCreateChoiceTitle">Создать или загрузить?</h2>
              </div>
              <button type="button" onClick={closeCreateChoice} aria-label="Закрыть">×</button>
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
