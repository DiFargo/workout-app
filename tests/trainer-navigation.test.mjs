import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("sidebar Programs navigation opens the program manager instead of the exercise library", async () => {
  const source = await readFile(new URL("../src/features/trainer/trainerNavigation.js", import.meta.url), "utf8");
  const workoutsBranch = source.match(/if \(nextSection === "workouts"\) \{([\s\S]*?)\n      \}/)?.[1] || "";

  assert.match(workoutsBranch, /setTrainerProgramManagerOpen\(true\)/);
  assert.match(workoutsBranch, /setTrainerWorkoutTab\("plan"\)/);
  assert.match(workoutsBranch, /setPage\(APP_PAGES\.ADMIN_WORKOUTS\)/);
});

test("exercise library navigation closes the program manager and selects the library tab", async () => {
  const source = await readFile(new URL("../src/features/trainer/trainerNavigation.js", import.meta.url), "utf8");
  const libraryAction = source.match(/openTrainerExerciseLibrary\(\) \{([\s\S]*?)\n    \}/)?.[1] || "";

  assert.match(libraryAction, /setTrainerProgramManagerOpen\(false\)/);
  assert.match(libraryAction, /setTrainerWorkoutTab\("library"\)/);
  assert.match(libraryAction, /setPage\(APP_PAGES\.ADMIN_WORKOUTS\)/);
});

test("exercise library cards open the editor and the Add control creates a new exercise", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerExerciseLibraryEditor.module.css", import.meta.url), "utf8");

  assert.match(source, /aria-label=\{`Редактировать упражнение/);
  assert.match(source, /setLibraryEditorTarget\(\{ workoutId: exercise\.sourceWorkoutId \|\| "", exerciseId: exercise\.id/);
  assert.match(source, /id="trainer-library-editor-title">Редактирование упражнения/);
  assert.match(source, /onClick=\{\(\) => openLibraryEditor\(exercise\)\}/);
  assert.match(source, /function createLibraryExercise\(\)/);
  assert.match(source, /onAddExercise\?\.\(selectedWorkout\.id, \{ name: "Новое упражнение" \}\)/);
  assert.match(source, /onClick=\{createLibraryExercise\}/);
  assert.doesNotMatch(source, /event\.stopPropagation\(\); selectedWorkout && onAddExercise/);
  assert.match(source, /TrainerExerciseLibraryEditor\.module\.css/);
  assert.match(styles, /overflow-x: hidden/);
  assert.match(styles, /grid-template-columns: 1fr/);
});

test("program overview uses compact app-colored cards and ends with an Add program card", async () => {
  const source = await readFile(new URL("../src/features/trainer/TrainerProgramOverviewPage.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/features/trainer/TrainerProgramOverviewPage.module.css", import.meta.url), "utf8");

  assert.match(source, /TrainerProgramOverviewPage\.module\.css/);
  assert.match(source, /ProgramCheckIcon size=\{15\}/);
  assert.match(source, /className=\{styles\.selectedMark\} aria-label="Выбрана"/);
  assert.match(source, /label: "Черновик"/);
  assert.match(source, /label: "Готова"/);
  assert.match(source, /label: "Используется"/);
  assert.match(source, /label: "Архив"/);
  assert.doesNotMatch(source, /<b>•••<\/b>/);
  assert.doesNotMatch(source, /className=\{styles\.headerActions\}/);
  assert.doesNotMatch(source, /ProgramRefreshIcon/);
  assert.match(source, /className=\{styles\.cardSelect\}/);
  assert.match(source, /className=\{styles\.selectedActions\}/);
  assert.match(styles, /\.selectedActions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(source, /styles\.statusUsed/);
  assert.match(styles, /\.statusUsed/);
  assert.match(source, /<strong>Добавить программу<\/strong>/);
  assert.match(styles, /grid-template-columns: repeat\(auto-fill, minmax\(230px, 280px\)\)/);
  assert.match(styles, /@media \(max-width: 720px\) \{[\s\S]*?\.grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /grid-template-areas:\s*"title status"\s*"stats stats"/);
  assert.match(styles, /background: #fff/);
  assert.match(styles, /background: #f8f6ff/);
  assert.doesNotMatch(styles, /!important/);
  assert.match(styles, /border: 2px solid #fff/);
  assert.match(styles, /border: 2px dashed #bca9fa/);
});

test("trainer constructor omits the redundant insights sidebar", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /styles\.insightsPanel/);
  assert.doesNotMatch(source, /styles\.volumeCard/);
  assert.doesNotMatch(source, /styles\.tipCard/);
  assert.match(styles, /grid-template-columns: 248px minmax\(600px, 1fr\)/);
});

test("trainer constructor does not duplicate ordinary exercises as blocks", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");

  assert.match(source, /advancedTaskBlocks = taskBlocks\.filter/);
  assert.match(source, /advancedTaskBlocks\.map/);
  assert.match(source, /<summary><Plus size=\{17\} \/>Специальный блок<\/summary>/);
  assert.doesNotMatch(source, /<Plus size=\{14\} \/>Упражнение<\/button>/);
});

test("trainer constructor omits misleading preview and assignment actions", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /Предпросмотр/);
  assert.doesNotMatch(source, /Назначить программу клиенту/);
  assert.doesNotMatch(source, /ProgramPreview/);
  assert.doesNotMatch(source, /className=\{styles\.moreButton\}/);
  assert.doesNotMatch(styles, /programActions \.previewButton/);
  assert.doesNotMatch(styles, /programActions \.assignButton/);
});

test("trainer constructor keeps one clear workout day list", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");

  assert.match(source, /\{workoutContexts\.map\(renderDay\)\}/);
  assert.doesNotMatch(source, /По неделям/);
  assert.doesNotMatch(source, /dayViewTabs/);
  assert.doesNotMatch(source, /weekGroups/);
});

test("trainer constructor opens the selected day in a dedicated editor modal", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");

  assert.match(source, /const \[isDayEditorOpen, setIsDayEditorOpen\] = useState\(false\)/);
  assert.match(source, /setIsDayEditorOpen\(true\)/);
  assert.match(source, /setIsDayEditorOpen\(false\)/);
  assert.match(source, /Редактор тренировочного дня/);
  assert.match(styles, /\.dayEditorModal/);
  assert.match(styles, /\.dayEditorBackdrop/);
  assert.doesNotMatch(styles, /!important/);
});

test("trainer day editor keeps all exercise controls within the mobile sheet", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");

  assert.match(source, /className=\{styles\.exerciseMetrics\}/);
  assert.match(source, /className=\{styles\.metricField\}/);
  assert.match(styles, /\.dayStats \{ width: 100%;[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.exerciseMetrics \{ grid-area: metrics; display: grid; grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /:global\(\.trainerNextRoot\):has\(\.dayEditorModal\) :global\(\.trainerNextMobileNav\) \{ display: none; \}/);
});

test("trainer program editor keeps mobile back and save actions reachable", async () => {
  const constructor = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/features/trainer/TrainerAdminWorkoutsRoute.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");

  assert.match(route, /adminProgramLibraryTab === "editor" \?[\s\S]*?onClick=\{handleMonthProgramBack\}/);
  assert.doesNotMatch(constructor, /programBackButton/);
  assert.match(constructor, /className=\{styles\.deleteButton\}[\s\S]*?onClick=\{onDeleteProgram\}/);
  assert.match(constructor, /className=\{styles\.saveButton\}[\s\S]*?onClick=\{\(\) => onSaveProgram\(\)\}/);
  assert.match(styles, /\.programActions \{[\s\S]*?position: fixed;[\s\S]*?bottom: calc\(max\(8px, env\(safe-area-inset-bottom\)\) \+ 84px\)/);
  assert.doesNotMatch(styles, /!important/);
});

test("trainer program editor does not render the library switcher", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const harness = await readFile(new URL("../src/components/trainer/TrainerE2EHarness.jsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/features/trainer/TrainerAdminWorkoutsRoute.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceCalm.module.css", import.meta.url), "utf8");

  assert.match(source, /!embedded && tab !== "plan" \? <div className="trainerNextPageTabs">/);
  assert.match(harness, /programLibraryTab !== "editor" \? <div className="trainerNextPageTabs">/);
  assert.match(route, /adminProgramLibraryTab !== "editor" \? \([\s\S]*?<div className="trainerNextPageTabs">/);
  assert.match(route, /className="isActive"[\s\S]*?aria-current="page"/);
  assert.match(styles, /trainerNextProgramsTab > \.trainerNextPageTabs\) \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(styles, /!important/);
});

test("new program exercises start with one editable set", async () => {
  const source = await readFile(new URL("../src/features/trainer/trainerMonthExerciseHandlers.js", import.meta.url), "utf8");
  const addExercise = source.match(/function addMonthExercise\([\s\S]*?\n  \}/)?.[0] || "";

  assert.match(addExercise, /sets: \[\{ reps: 8, weight: "" \}\]/);
  assert.doesNotMatch(addExercise, /Array\.from\(\{ length: 3 \}/);
});

test("trainer workspace does not overlay the brand with the legacy fixed back button", async () => {
  const source = await readFile(new URL("../src/features/trainer/TrainerProgramManagerHeader.jsx", import.meta.url), "utf8");

  assert.match(source, /if \(isNextWorkspace\) return null/);
  assert.match(source, /className="adminFixedMainBack"/);
});

test("mobile client invite action sits beside the client search", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceCalm.module.css", import.meta.url), "utf8");
  const clientsPage = source.match(/function TrainerClientsPage\([\s\S]*?\n}\n\nfunction getWorkoutTitle/)?.[0] || "";

  assert.match(clientsPage, /className="trainerNextClientSearchRow"/);
  assert.match(clientsPage, /className="trainerNextClientSearchAdd"[\s\S]*?onClick=\{onCreateClient\}/);
  assert.doesNotMatch(clientsPage, /trainerNextMobileAddClient/);
  assert.match(styles, /trainerNextClientSearchRow\) \{[\s\S]*?gap: 8px/);
  assert.match(styles, /trainerNextClientSearchAdd\) \{[\s\S]*?min-width: 132px/);
});

test("trainer editor Back returns directly to the programs overview", async () => {
  const source = await readFile(new URL("../src/features/trainer/TrainerAdminWorkoutsRoute.jsx", import.meta.url), "utf8");

  assert.match(source, /onClick=\{handleMonthProgramBack\}/);
});

test("trainer constructor omits the noisy set field chooser", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /fieldChooser/);
  assert.doesNotMatch(source, /toggleSetField/);
  assert.doesNotMatch(styles, /\.fieldChooser/);
});

test("trainer constructor omits block and set mode selectors", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /moveExerciseToBlock/);
  assert.doesNotMatch(source, /Блок выполнения/);
  assert.doesNotMatch(source, /Режим подходов/);
});

test("trainer set rows keep only repetitions and weight", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");
  const setEditor = source.match(/<section className=\{styles\.setsEditor\}>([\s\S]*?)<\/section>/)?.[1] || "";

  assert.doesNotMatch(setEditor, /<span>RPE<\/span>|<span>RIR<\/span>|<span>Отдых<\/span>|<span>Темп<\/span>/);
  assert.doesNotMatch(setEditor, /aria-label=\{`RPE|aria-label=\{`RIR|aria-label=\{`Отдых|aria-label=\{`Темп/);
  assert.match(styles, /grid-template-columns: 54px repeat\(2, minmax\(90px, 1fr\)\) 34px/);
});

test("trainer exercise name searches the library and offers creation", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");
  const manager = await readFile(new URL("../src/features/trainer/TrainerProgramManagerView.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");

  assert.match(manager, /exerciseLibrary=\{adminExerciseLibrary\}/);
  assert.match(source, /role="combobox"/);
  assert.match(source, /getLibraryMatches\(exercise\)/);
  assert.match(source, /Создать новое упражнение/);
  assert.match(styles, /\.exerciseSearchDropdown/);
});

test("subscription lives on the overview and reminders stay compact", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const handlers = await readFile(new URL("../src/features/trainer/trainerClientCalendarHandlers.js", import.meta.url), "utf8");
  const backend = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceSubscriptionProgress.module.css", import.meta.url), "utf8");

  assert.match(workspace, /subscriptionOnly: true/);
  assert.match(workspace, /function ClientSubscriptionCard/);
  assert.match(workspace, /onSaveSubscription=\{onSaveNotifications\}/);
  const clientNotifications = workspace.match(/function ClientNotifications[\s\S]*?function ClientWorkSummary/)?.[0] || "";
  const globalNotifications = workspace.match(/function TrainerGlobalSubscriptionNotifications[\s\S]*?function TrainerUtilityPage/)?.[0] || "";
  assert.doesNotMatch(clientNotifications, /subscriptionReminderBar|subscriptionWarningDays|subscriptionDigestMode/);
  assert.match(globalNotifications, /subscriptionReminderBar/);
  assert.match(globalNotifications, /Настройки сохранены для всех клиентов/);
  assert.match(workspace, /Не удалось сохранить/);
  assert.match(handlers, /if \(settings\.subscriptionOnly\)/);
  assert.match(handlers, /saveTrainerSubscriptionNotificationSettings/);
  const regularReminderSave = handlers.match(/const offsets = getReminderOffsets[\s\S]*?async function loadTrainerSubscriptionNotificationSettings/)?.[0] || "";
  assert.doesNotMatch(regularReminderSave, /subscription:\s*nextSubscription/);
  assert.match(backend, /subscription=renew/);
  assert.match(workspace, /params\.get\("subscription"\) === "renew"/);
  assert.match(styles, /\.overviewSubscription/);
  assert.match(styles, /\.subscriptionModal/);
  assert.match(styles, /\.notificationCalendar \{ order: 1/);
  assert.match(styles, /\.reminderCard \{ order: 3/);
  assert.match(styles, /\.globalSubscriptionSettings/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});

test("trainer navigation omits the standalone messages item", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const navigation = await readFile(new URL("../src/features/trainer/trainerNavigation.js", import.meta.url), "utf8");
  const navigationItems = ["NAV_ITEMS", "MOBILE_OVERFLOW_ITEMS", "DESKTOP_NAV_ITEMS"]
    .map((name) => workspace.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`))?.[1] || "")
    .join("\n");

  assert.doesNotMatch(navigationItems, /\{ id: "messages", label: "Сообщения"/);
  assert.doesNotMatch(workspace, /\["dashboard", "clients", "messages", "more"\]/);
  assert.doesNotMatch(navigation, /^\s*"messages",$/m);
});

test("client card exposes compact Messages without the trainer note card", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerClientMessages.module.css", import.meta.url), "utf8");
  const tasksComponent = await readFile(new URL("../src/components/trainer/TrainerClientTasks.jsx", import.meta.url), "utf8");
  const tasksStyles = await readFile(new URL("../src/components/trainer/TrainerClientTasks.module.css", import.meta.url), "utf8");
  const clientTabs = workspace.match(/const CLIENT_TABS = \[([\s\S]*?)\n\];/)?.[1] || "";
  const messagesView = workspace.match(/function ClientMessages\(([\s\S]*?)\n\}\n\nfunction getWorkoutScheduleInitialDates/)?.[1] || "";
  const overviewView = workspace.match(/function ClientOverview\(([\s\S]*?)\n\}\n\nfunction ClientMeasurements/)?.[1] || "";

  assert.match(clientTabs, /\{ id: "messages", label: "Сообщения" \}/);
  assert.doesNotMatch(clientTabs, /label: "Заметки"/);
  assert.match(workspace, /\["messages", "notes"\]\.includes\(activeTab\)/);
  assert.match(messagesView, /id="trainer-client-messages-title">Сообщения/);
  assert.match(messagesView, /aria-label="Фильтры сообщений клиента"/);
  assert.match(messagesView, /Ждут ответа/);
  assert.match(messagesView, /Обработаны/);
  assert.match(messagesView, /onReplyToMessage\(item\)/);
  assert.match(messagesView, /Обработать все/);
  assert.doesNotMatch(messagesView, /Задания клиенту|tasksPanel/);
  assert.match(overviewView, /<TrainerClientTasks tasks=\{tasks\} \/>/);
  assert.doesNotMatch(overviewView, /trainerNextRecommendation/);
  assert.match(tasksComponent, /Задания клиенту/);
  assert.doesNotMatch(messagesView, /trainerNextNoteCard|StickyNote|\bnote\b/);
  assert.match(styles, /grid-template-columns: 34px minmax\(0, 1fr\)/);
  assert.match(styles, /\.replyPrimary/);
  assert.doesNotMatch(styles, /\.tasksPanel/);
  assert.match(tasksStyles, /grid-column: 1 \/ -1/);
  assert.match(workspace, /onMarkProcessed=\{messageSourceNote/);
  assert.match(workspace, /"resolve_client_messages"/);
  assert.match(workspace, /activeTab === "overview" \? \([\s\S]*?<ClientWorkSummary[\s\S]*?<ClientOverview/);
  assert.doesNotMatch(workspace, /<ClientWorkSummary[^>]*\/>\s*\n\s*<nav className="trainerNextClientTabs">/);
});

test("client card unifies workout plan and exercise progress under Exercises", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerClientExercisesTabs.module.css", import.meta.url), "utf8");
  const clientTabs = workspace.match(/const CLIENT_TABS = \[([\s\S]*?)\n\];/)?.[1] || "";
  const exerciseSection = workspace.match(/\{exercisesOpen \? \(([\s\S]*?)\n      \) : null\}/)?.[1] || "";

  assert.match(clientTabs, /\{ id: "exercises", label: "Тренировки", target: "workouts" \}/);
  assert.ok(clientTabs.indexOf('id: "messages"') < clientTabs.indexOf('id: "notifications"'));
  assert.doesNotMatch(clientTabs, /\{ id: "workouts", label: "План тренировок"/);
  assert.doesNotMatch(clientTabs, /\{ id: "exerciseProgress", label: "Прогресс упражнений"/);
  assert.match(workspace, /\["exercises", "workouts", "exerciseProgress", "training"\]\.includes\(activeTab\)/);
  assert.match(exerciseSection, /aria-label="Разделы упражнений клиента"/);
  assert.match(exerciseSection, />\s*План тренировок\s*<\/button>/);
  assert.match(exerciseSection, />\s*Прогресс упражнений\s*<\/button>/);
  assert.match(exerciseSection, /aria-pressed=\{exerciseSubview === "plan"\}/);
  assert.match(exerciseSection, /aria-pressed=\{exerciseSubview === "progress"\}/);
  assert.match(exerciseSection, /<ClientWorkoutPlan/);
  assert.match(exerciseSection, /<ClientExerciseProgress/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.switcher button\.active/);
});

test("trainer constructor keeps editable names without pencil decorations", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /\bPencil\b/);
  assert.doesNotMatch(source, /dayEditIcon/);
  assert.match(source, /aria-label="Название программы"/);
  assert.match(source, /aria-label="Название тренировки"/);
  assert.match(styles, /\.dayHeader \{[^}]*grid-template-columns: minmax\(170px, 1fr\) auto/);
});

test("trainer program days open in a dismissible exercise editor modal", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerWorkspace.module.css", import.meta.url), "utf8");

  assert.match(workspace, /const \[isDayEditorOpen, setIsDayEditorOpen\] = useState\(false\)/);
  assert.match(workspace, /setIsDayEditorOpen\(true\)/);
  assert.match(workspace, /aria-label="Закрыть редактор дня"/);
  assert.match(workspace, /trainerProgramDayEditorBackdrop/);
  assert.match(styles, /trainerProgramDayPanelModal/);
  assert.match(styles, /trainerProgramDayModalHeader/);
});

test("exercise progress load action opens a two-path trainer decision modal", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const modal = await readFile(new URL("../src/components/trainer/TrainerExerciseLoadReviewModal.jsx", import.meta.url), "utf8");
  const modalStyles = await readFile(new URL("../src/components/trainer/TrainerExerciseLoadReviewModal.module.css", import.meta.url), "utf8");
  const planHandlers = await readFile(new URL("../src/features/trainer/trainerPlanEditorHandlers.js", import.meta.url), "utf8");
  const clientActions = await readFile(new URL("../src/features/trainer/trainerClientActionHandlers.js", import.meta.url), "utf8");

  assert.match(workspace, /setDecisionItem\(item\)/);
  assert.match(workspace, /<TrainerExerciseLoadReviewModal/);
  assert.doesNotMatch(workspace, /onOpenWorkouts\?\.\(item\)/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /Всё в порядке/);
  assert.match(modal, /Изменить упражнение/);
  assert.match(modal, /Сохранить изменения/);
  assert.match(modal, /Повторы, подход \{index \+ 1\}/);
  assert.match(modal, /Вес, подход \{index \+ 1\}/);
  assert.match(modalStyles, /width: min\(650px, 100%\)/);
  assert.match(planHandlers, /async function saveTrainerExerciseProgressAdjustment/);
  assert.match(planHandlers, /await setDoc\(doc\(db, "users", ownerUid, "workouts", nextWorkout\.id\)/);
  assert.match(clientActions, /action === "resolve_exercise_progress"/);
  assert.match(clientActions, /"exercise_progress_review"/);
});

test("client workout plan is compact and offers a two-path workout review decision", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const modal = await readFile(new URL("../src/components/trainer/TrainerWorkoutReviewDecisionModal.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerClientWorkoutPlan.module.css", import.meta.url), "utf8");
  const clientActions = await readFile(new URL("../src/features/trainer/trainerClientActionHandlers.js", import.meta.url), "utf8");
  const plan = workspace.match(/function ClientWorkoutPlan\(([\s\S]*?)\n\}\n\nfunction ClientExerciseProgress/)?.[0] || "";
  const dynamicsLabel = new RegExp("\\u0414\\u0418\\u041d\\u0410\\u041c\\u0418\\u041a\\u0410", "u");
  const workoutDynamicsTitle = new RegExp("\\u041a\\u0430\\u043a \\u043f\\u0440\\u043e\\u0445\\u043e\\u0434\\u044f\\u0442 \\u0442\\u0440\\u0435\\u043d\\u0438\\u0440\\u043e\\u0432\\u043a\\u0438", "u");

  assert.match(workspace, /import TrainerWorkoutReviewDecisionModal from "\.\/TrainerWorkoutReviewDecisionModal"/);
  assert.match(workspace, /import trainerClientWorkoutPlanStyles from "\.\/TrainerClientWorkoutPlan\.module\.css"/);
  assert.doesNotMatch(plan, dynamicsLabel);
  assert.doesNotMatch(plan, workoutDynamicsTitle);
  assert.match(plan, /<TrainerWorkoutReviewDecisionModal/);
  assert.match(plan, /onConfirm=\{\(\) => resolveWorkoutReview\("accepted"\)\}/);
  assert.match(plan, /onEdit=\{openReviewEditor\}/);
  assert.match(plan, /setPendingReviewAdjustment\(/);
  assert.match(modal, /className=\{styles\.accept\} onClick=\{onConfirm\}/);
  assert.match(modal, /className=\{styles\.edit\} onClick=\{onEdit\}/);
  assert.match(clientActions, /action === "resolve_workout_review"/);
  assert.match(clientActions, /"workout_review"/);
  assert.match(styles, /\.programCard/);
  assert.match(styles, /\.programGrid/);
  assert.match(styles, /grid-template-columns: minmax\(300px, \.95fr\) minmax\(420px, 1\.05fr\)/);
});
