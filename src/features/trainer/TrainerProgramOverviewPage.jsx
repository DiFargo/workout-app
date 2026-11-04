import { getProgramLibraryStatusMeta } from "../../utils/trainerProgramLibraryStatus.js";
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
  TRAINER_PROGRAM_STATUSES
} from "../../utils/trainerProgramLifecycle.js";
import { getTrainerProgramFormatMeta, TRAINER_PROGRAM_FORMATS } from "../../utils/trainerProgramFormat.js";
import styles from "./TrainerProgramOverviewPage.module.css";
import TrainerLibraryLoadNotice from "../../components/trainer/TrainerLibraryLoadNotice.jsx";
import { getTrainerLibraryViewState } from "../../utils/trainerLibraryLoadState.js";

function ProgramClientAvatar({ client }) {
  const [failed, setFailed] = useState(false);
  const name = client.name || client.displayName || client.email || "Клиент";
  const photo = client.avatarUrl || client.photoURL || client.telegramAvatarUrl || client.telegram?.avatarUrl;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase("ru");
  return <span className={styles.clientAvatar} title={name} aria-label={name}>
    {photo && !failed ? <img src={photo} alt="" loading="lazy" onError={() => setFailed(true)} /> : initials}
  </span>;
}

export default function TrainerProgramOverviewPage({
  clients = [],
  adminProgramCreateChoiceOpen,
  adminProgramImportInputRef,
  adminSelectedTemplateId,
  adminTrainingTemplates,
  trainerLibraryLoadState,
  onRetryLibrary,
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
  const [testProgramsOnly, setTestProgramsOnly] = useState(false);
  const normalizedProgramSearch = programSearch.trim().toLocaleLowerCase("ru-RU");
  const matchingTemplates = normalizedProgramSearch
    ? adminTrainingTemplates.filter((template) => [template.name, template.description]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(normalizedProgramSearch)))
    : adminTrainingTemplates;
  const visibleTrainingTemplates = matchingTemplates.filter((program) => Boolean(program.isTest) === testProgramsOnly);
  const libraryView = getTrainerLibraryViewState(trainerLibraryLoadState);
  const testProgramFilter = (
    <label className={styles.testFilter} onClick={(event) => event.stopPropagation()}>
      <input type="checkbox" checked={testProgramsOnly} onChange={(event) => { setTestProgramsOnly(event.target.checked); setAdminSelectedTemplateId(""); }} />
      Тестовые программы
    </label>
  );

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

        <aside className={styles.templatePurpose} aria-labelledby="trainer-template-purpose-title">
          <h2 id="trainer-template-purpose-title">Шаблон — не план клиента</h2>
          <p>При назначении клиент получит <strong>отдельную копию</strong>. Настройте её персонально в плане клиента.</p>
        </aside>

        {!isNextWorkspace ? testProgramFilter : null}

        {isNextWorkspace ? (
          <div className={styles.toolbar} onClick={(event) => event.stopPropagation()}>
            <label className={styles.searchField} data-trainer-program-search>
              <ProgramSearchIcon size={20} aria-hidden="true" />
              <input
                type="search"
                value={programSearch}
                onChange={(event) => setProgramSearch(event.target.value)}
                placeholder="Найти программу"
                aria-label="Найти программу"
              />
            </label>
            <button className={styles.addButton} type="button" disabled={!libraryView.complete && !adminTrainingTemplates.length} onClick={() => setAdminProgramCreateChoiceOpen(true)}>
              <ProgramPlusIcon size={20} aria-hidden="true" />
              Создать шаблон
            </button>
          </div>
        ) : null}

        {isNextWorkspace ? <div className={styles.catalogMeta} onClick={(event) => event.stopPropagation()}>
          {libraryView.complete || adminTrainingTemplates.length ? <span>{libraryView.complete ? "Найдено" : "Показано"}: {visibleTrainingTemplates.length}</span> : <span aria-hidden="true" />}
          {testProgramFilter}
        </div> : null}

        <TrainerLibraryLoadNotice state={trainerLibraryLoadState} hasItems={adminTrainingTemplates.length > 0} onRetry={onRetryLibrary} />

        {libraryView.complete && adminTrainingTemplates.length === 0 && !isNextWorkspace ? (
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
          <div className={isNextWorkspace ? styles.grid : "programsOverviewGrid"} aria-busy={libraryView.loading} data-testid={isNextWorkspace ? "trainer-program-overview-grid" : undefined}>
            {visibleTrainingTemplates.map((template) => {
          const stats = getTemplateStats(template);
          const isSelected = adminSelectedTemplateId === template.id;
          const assignedClients = clients.filter((client) => client.assignedProgramId === template.id);
          const statusMeta = getProgramLibraryStatusMeta(template, assignedClients.length);
          const isDraft = statusMeta.id === TRAINER_PROGRAM_STATUSES.DRAFT;
              const formatMeta = getTrainerProgramFormatMeta(template.trainingFormat);
              const createdAt = template.createdAt ? new Date(template.createdAt) : null;
              const createdLabel = createdAt && !Number.isNaN(createdAt.getTime())
                ? createdAt.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
                : "—";

              const programContent = (
                <>
                  <div className={isNextWorkspace ? styles.cardTitle : "programsOverviewCardTitle"}>
                    <i><ProgramDumbbellIcon size={29} aria-hidden="true" /></i>
                    <div>
                      <strong>{template.name || "Без названия"}</strong>
                      <p>{isNextWorkspace ? `Общий шаблон${template.description ? ` · ${template.description}` : ""}` : `Общий шаблон · ${template.description || "Готовая тренировочная программа из библиотеки."}`}</p>
                      {formatMeta ? <span className={styles.formatBadge}>{formatMeta.label}</span> : null}
                    </div>
                  </div>
                  <div className={isNextWorkspace ? styles.cardStats : "programsOverviewCardStats"}>
                    <span><ProgramDumbbellIcon size={16} aria-hidden="true" /><b>{stats.workoutsCount}</b><small>тренировок</small></span>
                    <span><ProgramListIcon size={16} aria-hidden="true" /><b>{stats.exercisesCount}</b><small>упражнений</small></span>
                  </div>
                  <footer>
                    <span>Создана: {createdLabel}</span>
                    <span className={isNextWorkspace
                      ? `${styles.statusBadge}${statusMeta.tone === "used" ? ` ${styles.statusUsed}` : ""}`
                      : `programsOverviewStatusBadge status-${statusMeta.tone}`} title={statusMeta.description}>
                      {statusMeta.label}
                    </span>
                    {isNextWorkspace && assignedClients.length > 0 ? <span className={styles.clientAvatars} aria-label={`Используют: ${assignedClients.map((client) => client.name || client.email || "Клиент").join(", ")}`}>
                      {assignedClients.slice(0, 4).map((client) => <ProgramClientAvatar key={client.id} client={client} />)}
                      {assignedClients.length > 4 ? <span className={styles.clientAvatar} title={assignedClients.slice(4).map((client) => client.name || client.email || "Клиент").join(", ")}>+{assignedClients.length - 4}</span> : null}
                    </span> : null}
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
                      <button className={styles.copyAction} type="button" aria-label="Создать копию программы" onClick={() => duplicateMonthProgramFromLibrary(template.id)}>
                        <ProgramCopyIcon size={17} />
                        Создать копию
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
            {isNextWorkspace && libraryView.complete && visibleTrainingTemplates.length === 0 ? (
              <div className={styles.empty}>
                <strong>{adminTrainingTemplates.length ? "Шаблоны не найдены" : "Шаблонов пока нет"}</strong>
                <span>{adminTrainingTemplates.length ? testProgramsOnly && !normalizedProgramSearch ? "Тестовых шаблонов пока нет. Снимите фильтр, чтобы увидеть рабочие." : "Попробуйте изменить запрос или фильтр." : "Создайте первый шаблон через кнопку выше."}</span>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {isNextWorkspace && adminProgramCreateChoiceOpen && !aiImportOpen && (
        <div className={styles.overlay} data-modal-backdrop="true" role="dialog" aria-modal="true" aria-labelledby="programCreateChoiceTitle" onClick={closeCreateChoice}>
          <section className={styles.choiceSheet} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span>БИБЛИОТЕКА ПРОГРАММ</span>
                <h2 id="programCreateChoiceTitle">Создать общий шаблон</h2>
              </div>
              <button type="button" onClick={closeCreateChoice} aria-label="Закрыть">×</button>
            </header>
            <p className={styles.choiceHint}>Выберите метку формата для библиотеки. Любой вариант откроет одинаковый пустой шаблон с одним днём: упражнения и дополнительные дни вы добавите сами. При назначении клиент получит отдельную копию.</p>
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
                    <span><strong>{format.label}</strong><small>Метка для библиотеки · пустой шаблон с одним днём</small></span>
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
        <div className={styles.overlay} data-modal-backdrop="true" role="dialog" aria-modal="true" aria-labelledby="programAiImportTitle" onClick={closeCreateChoice}>
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
