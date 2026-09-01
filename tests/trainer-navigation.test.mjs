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

test("program overview uses compact cards with a program search and add control", async () => {
  const source = await readFile(new URL("../src/features/trainer/TrainerProgramOverviewPage.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/features/trainer/TrainerProgramOverviewPage.module.css", import.meta.url), "utf8");

  assert.match(source, /TrainerProgramOverviewPage\.module\.css/);
  assert.match(source, /ProgramCheckIcon size=\{15\}/);
  assert.match(source, /className=\{styles\.selectedMark\} aria-label="Выбрана"/);
  assert.match(source, /label: "Черновик"/);
  assert.match(source, /label: "Готова к назначению"/);
  assert.match(source, /label: "Используется"/);
  assert.match(source, /label: "Архив"/);
  assert.doesNotMatch(source, /<b>•••<\/b>/);
  assert.doesNotMatch(source, /className=\{styles\.headerActions\}/);
  assert.doesNotMatch(source, /ProgramRefreshIcon/);
  assert.match(source, /className=\{styles\.cardSelect\}/);
  assert.match(source, /styles\.selectedActions,/);
  assert.match(styles, /\.selectedActions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(source, /styles\.statusUsed/);
  assert.match(styles, /\.statusUsed/);
  assert.match(source, /ProgramSearchIcon/);
  assert.match(source, /styles\.toolbar/);
  assert.match(source, /styles\.searchField/);
  assert.match(source, /styles\.addButton/);
  assert.doesNotMatch(source, /className=\{styles\.createCard\}/);
  assert.match(styles, /\.toolbar \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/);
  assert.match(styles, /grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 260px\), 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 720px\) \{[\s\S]*?\.grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /grid-template-areas:\s*"title status"\s*"stats stats"/);
  assert.match(styles, /background: #fff/);
  assert.match(styles, /background: #f7f6f8/);
  assert.doesNotMatch(styles, /!important/);
  assert.match(styles, /border: 2px solid #fff/);
  assert.match(styles, /border: 2px dashed #bca9fa/);
});

test("program creation asks for a format and persists the selected format", async () => {
  const overview = await readFile(new URL("../src/features/trainer/TrainerProgramOverviewPage.jsx", import.meta.url), "utf8");
  const persistence = await readFile(new URL("../src/features/trainer/trainerMonthProgramPersistenceHandlers.js", import.meta.url), "utf8");
  const normalization = await readFile(new URL("../src/utils/trainerMonthProgramNormalization.js", import.meta.url), "utf8");
  const formats = await readFile(new URL("../src/utils/trainerProgramFormat.js", import.meta.url), "utf8");

  assert.match(overview, /TRAINER_PROGRAM_FORMATS\.map/);
  assert.match(overview, /data-program-format=\{format\.id\}/);
  assert.match(overview, /createNewMonthProgramDraft\(format\.id\)/);
  assert.match(persistence, /function createNewMonthProgramDraft\(trainingFormat = ""\)/);
  assert.match(persistence, /trainingFormat: program\.trainingFormat \|\| ""/);
  assert.match(normalization, /trainingFormat: normalizeTrainerProgramFormat\(program\.trainingFormat\)/);
  assert.match(formats, /id: "full_body"/);
  assert.match(formats, /id: "split"/);
  assert.match(formats, /id: "circuit"/);
  assert.match(formats, /id: "strength"/);
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
  assert.match(source, /aria-haspopup="menu"/);
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
  assert.match(source, /aria-label="Свернуть тренировочный день"/);
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
  const manager = await readFile(new URL("../src/features/trainer/TrainerProgramManagerView.jsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/features/trainer/TrainerAdminWorkoutsRoute.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");

  assert.match(route, /adminProgramLibraryTab === "editor" \?[\s\S]*?onClick=\{handleMonthProgramBack\}/);
  assert.doesNotMatch(constructor, /programBackButton/);
  assert.match(constructor, /className=\{styles\.deleteButton\}[\s\S]*?onClick=\{onDeleteProgram\}/);
  assert.match(constructor, /className=\{styles\.saveButton\}[\s\S]*?onClick=\{\(\) => onSaveProgram\(\)\}/);
  assert.match(manager, /data-trainer-modal-backdrop="true"[\s\S]*?data-trainer-modal-surface="true"/);
  assert.match(manager, /className=\{styles\.editorModalClose\}[\s\S]*?onClick=\{closeEditor\}/);
  assert.match(manager, /embeddedInModal=\{isEditorModalOpen\}/);
  assert.match(constructor, /isDayEditorOpen && !embeddedInModal \? "true" : undefined/);
  assert.match(manager, /const saved = await saveMonthProgramToLibrary\(\)/);
  assert.match(manager, /if \(saved === false\)[\s\S]*?setEditorSaveState\("idle"\)/);
  assert.match(manager, /function closeEditor\(\)[\s\S]*?hasEditorUnsavedChanges[\s\S]*?setEditorExitConfirmOpen\(true\)/);
  assert.match(manager, /Есть несохранённые изменения/);
  assert.match(manager, /Выйти без сохранения/);
  assert.match(manager, /Сохранить и выйти/);
  assert.match(manager, /function discardEditorChanges\(\)[\s\S]*?restoreSavedProgram: isPersistedEditorProgram/);
  assert.match(manager, /readTrainerProgramEditorDraft/);
  assert.match(manager, /Восстановить несохранённые изменения/);
  assert.match(manager, /beforeunload/);
  assert.match(manager, /persistCurrentEditorDraft/);
  assert.match(route, /function restoreMonthProgramDraft\(/);
  assert.match(manager, /setEditorSaveState\("saved"\)[\s\S]*?finalizeEditorClose\(\)/);
  assert.match(manager, /editorModalSaveSaving/);
  assert.match(manager, /editorModalSaveSaved/);
  assert.match(styles, /\.programActions \{[\s\S]*?position: fixed;[\s\S]*?bottom: max\(16px, calc\(env\(safe-area-inset-bottom\) \+ 12px\)\)/);
  assert.match(styles, /\.embeddedInModal \.dayEditorModal \{/);
  assert.doesNotMatch(styles, /!important/);
});

test("trainer plan keeps program and exercise-library navigation outside editor", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const harness = await readFile(new URL("../src/components/trainer/TrainerE2EHarness.jsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/features/trainer/TrainerAdminWorkoutsRoute.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceCalm.module.css", import.meta.url), "utf8");

  assert.match(source, /!embedded \? <div className="trainerNextPageTabs" aria-label="Разделы программ">/);
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
  const mobileStyles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceMobile.module.css", import.meta.url), "utf8");
  const clientsPage = source.match(/function TrainerClientsPage\([\s\S]*?\n}\n\nfunction getWorkoutTitle/)?.[0] || "";

  assert.match(clientsPage, /className="trainerNextClientSearchRow"/);
  assert.match(clientsPage, /className="trainerNextClientSearchAdd"[\s\S]*?onClick=\{onCreateClient\}/);
  assert.doesNotMatch(clientsPage, /trainerNextMobileAddClient/);
  assert.match(styles, /trainerNextClientSearchRow\) \{[\s\S]*?gap: 8px/);
  assert.match(mobileStyles, /trainerNextClientSearchAdd\) \{[\s\S]*?min-width: 132px/);
});

test("client list cards always open the client overview", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const clientList = source.match(/function DashboardClientList\([\s\S]*?\n}\n\nfunction getAttentionReason/)?.[0] || "";

  assert.match(clientList, /onClick=\{\(\) => onOpenClient\(client, "overview"\)\}/);
  assert.doesNotMatch(clientList, /onOpenClient\(client, statusAction\.targetTab\)/);
});

test("workout schedule keeps subscription editing beside schedule editing", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceClientWorkoutPlan.module.css", import.meta.url), "utf8");
  const schedule = workspace.match(/function WorkoutSchedulePlanner\([\s\S]*?\n}\n\nfunction TrainerProgramScheduleModal/)?.[0] || "";

  assert.match(schedule, /showEditAction=\{false\}/);
  assert.match(schedule, /className="trainerWorkoutScheduleSubscriptionAction"/);
  assert.match(schedule, /onClick=\{startSubscriptionEditing\}/);
  assert.match(styles, /trainerWorkoutScheduleSubscriptionAction\) \{[\s\S]*?background: #eee7fa/);
  assert.match(styles, /trainerWorkoutScheduleActions\) \{[\s\S]*?flex-direction: column/);
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

test("special workout blocks offer simple sets, supersets, and trisets with real exercises", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");

  assert.match(source, /const \[isSpecialBlockMenuOpen, setIsSpecialBlockMenuOpen\] = useState\(false\)/);
  assert.match(source, /aria-haspopup="menu"/);
  assert.match(source, /setIsSpecialBlockMenuOpen\(false\)/);
  assert.match(source, /\u041e\u0431\u044b\u0447\u043d\u044b\u0439 \u0441\u0435\u0442/);
  assert.match(source, /\u0421\u0443\u043f\u0435\u0440\u0441\u0435\u0442 · 2 \u0443\u043f\u0440\u0430\u0436\u043d\u0435\u043d\u0438\u044f/);
  assert.match(source, /\u0422\u0440\u0438\u0441\u0435\u0442 · 3 \u0443\u043f\u0440\u0430\u0436\u043d\u0435\u043d\u0438\u044f/);
  assert.doesNotMatch(source, /addExerciseGroup\("circuit"\)|addExerciseGroup\("sequence"\)/);
  assert.match(source, /function selectGroupLibraryExercise\(block, slotIndex, libraryExercise\)/);
  assert.match(source, /function removeGroupExercise\(block, slotIndex\)/);
  assert.match(source, /groupExerciseSlots/);
  assert.match(styles, /bottom: calc\(100% \+ 5px\)/);
  assert.match(styles, /\.groupExerciseSlots \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); gap: 6px; \}/);
  assert.match(styles, /\.blockFields \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); gap: 7px; \}/);
  assert.match(styles, /\.blockFields \.wideField \{ grid-column: 1 \/ -1; \}/);
});

test("trainer library exercise selection survives the mobile input blur and applies the selected entry", async () => {
  const source = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");

  assert.match(source, /function selectLibraryExercise\(exercise, libraryExercise\)/);
  assert.match(source, /onUpdateExercise\(activeContext\.cycle\.id, activeContext\.week\.id, activeContext\.workout\.id, exercise\.id, patch\)/);
  assert.match(source, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(source, /event\.stopPropagation\(\);\s*selectLibraryExercise\(exercise, item\)/);
});

test("subscription lives on the overview and reminders stay compact", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const handlers = await readFile(new URL("../src/features/trainer/trainerClientCalendarHandlers.js", import.meta.url), "utf8");
  const backend = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceSubscriptionProgress.module.css", import.meta.url), "utf8");

  assert.match(workspace, /subscriptionOnly: true/);
  assert.match(workspace, /function ClientSubscriptionCard/);
  assert.match(workspace, /onSaveSubscription=\{onSaveSubscription\}/);
  const clientNotifications = workspace.match(/function ClientNotifications[\s\S]*?function ClientWorkSummary/)?.[0] || "";
  const globalNotifications = workspace.match(/function TrainerGlobalSubscriptionNotifications[\s\S]*?function TrainerUtilityPage/)?.[0] || "";
  assert.doesNotMatch(clientNotifications, /subscriptionReminderBar|subscriptionWarningDays|subscriptionDigestMode/);
  assert.equal((clientNotifications.match(/checked=\{draft\.enabled\}/g) || []).length, 1);
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
  assert.match(styles, /@media \(max-width: 680px\) \{[\s\S]*?\.globalSubscriptionSettings \.subscriptionReminderBar \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.globalSubscriptionSettings \.subscriptionReminderBar input\[type="time"\] \{[\s\S]*?min-inline-size: 0/);
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

test("client card keeps Messages and notifications in the header instead of duplicating tabs", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const messagingHandlers = await readFile(new URL("../src/features/trainer/trainerMessagingHandlers.js", import.meta.url), "utf8");
  const replyModal = await readFile(new URL("../src/components/trainer/TrainerWorkoutFeedbackReplyModal.jsx", import.meta.url), "utf8");
  const clientNotifications = await readFile(new URL("../src/features/client/profile/ProfileTrainerNotificationsModal.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerClientMessages.module.css", import.meta.url), "utf8");
  const mobileStyles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceMobile.module.css", import.meta.url), "utf8");
  const tasksComponent = await readFile(new URL("../src/components/trainer/TrainerClientTasks.jsx", import.meta.url), "utf8");
  const tasksStyles = await readFile(new URL("../src/components/trainer/TrainerClientTasks.module.css", import.meta.url), "utf8");
  const clientTabs = workspace.match(/const CLIENT_TABS = \[([\s\S]*?)\n\];/)?.[1] || "";
  const messagesView = workspace.match(/function ClientMessages\(([\s\S]*?)\n\}\n\nfunction getWorkoutScheduleInitialDates/)?.[1] || "";
  const overviewView = workspace.match(/function ClientOverview\(([\s\S]*?)\n\}\n\nfunction ClientMeasurements/)?.[1] || "";

  assert.doesNotMatch(clientTabs, /\{ id: "messages", label: "Сообщения" \}/);
  assert.doesNotMatch(clientTabs, /\{ id: "notifications", label: "Уведомления" \}/);
  assert.doesNotMatch(clientTabs, /label: "Заметки"/);
  assert.match(workspace, /\["messages", "notes"\]\.includes\(currentTab\)/);
  assert.match(messagesView, /embedded \? "Новые сообщения" : "Сообщения"/);
  assert.match(messagesView, /aria-label="Фильтры сообщений клиента"/);
  assert.match(messagesView, /Ждут ответа/);
  assert.match(messagesView, /Обработаны/);
  assert.match(messagesView, /data-selected=\{selected \? "true" : undefined\}/);
  assert.match(styles, /\.filters button\[aria-pressed="true"\]/);
  assert.match(styles, /background: #806bb6/);
  assert.match(styles, /\.replyPrimary\s*\{[\s\S]*?background: #806bb6/);
  assert.match(messagesView, /onReplyToMessage\(item\)/);
  assert.match(messagesView, /Обработать все/);
  assert.doesNotMatch(messagesView, /Задания клиенту|tasksPanel/);
  assert.doesNotMatch(overviewView, /<TrainerClientTasks tasks=\{tasks\} \/>/);
  assert.doesNotMatch(overviewView, /trainerNextRecommendation/);
  assert.match(tasksComponent, /Задания клиенту/);
  assert.doesNotMatch(messagesView, /trainerNextNoteCard|StickyNote|\bnote\b/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.embeddedPanel/);
  assert.match(styles, /\.replyPrimary/);
  assert.doesNotMatch(styles, /\.tasksPanel/);
  assert.match(mobileStyles, /\.clientPageFix :global\(\.trainerClientBarChart > div > span\) \{[\s\S]*?height: 112px/);
  assert.match(tasksStyles, /grid-column: 1 \/ -1/);
  assert.match(workspace, /onMarkProcessed=\{messageSourceNote/);
  assert.match(workspace, /"resolve_client_messages"/);
  assert.match(workspace, /const \[messageChannel, setMessageChannel\] = useState\("notification"\)/);
  assert.match(workspace, /function openMessageFromNote\(noteItem\) \{[\s\S]*?setMessageChannel\("notification"\)/);
  assert.match(messagingHandlers, /if \(deliveryChannel === "notification"\) \{[\s\S]*?sendClientBellNotification\(message, client, replyContext\)[\s\S]*?channel: "internal"/);
  assert.match(messagingHandlers, /messageContext: replyTopic[\s\S]*?Ответ на ваш комментарий/);
  assert.match(replyModal, /ОТВЕТ В ПРИЛОЖЕНИИ/);
  assert.match(replyModal, /Отправить в приложение/);
  assert.match(clientNotifications, /const messageContext = isMessageNotification/);
  assert.match(clientNotifications, /Ответ тренера/);
  assert.match(workspace, /const \[autoSaveState, setAutoSaveState\] = useState\("idle"\)/);
  assert.match(workspace, /window\.setTimeout\(\(\) => \{[\s\S]*?queueSettingsSave\(notificationSettings\)[\s\S]*?\}, 450\)/);
  assert.match(workspace, /Все изменения на этой странице сохраняются автоматически/);
  assert.match(workspace, /autoSaveState === "saved" \? "Сохранено" : "Сохранить настройки"/);
  assert.match(workspace, /currentTab === "overview" \? \([\s\S]*?<ClientOverview/);
  assert.match(overviewView, /<ClientWorkSummary/);
  assert.doesNotMatch(workspace, /<ClientWorkSummary[^>]*\/>\s*\n\s*<nav className="trainerNextClientTabs">/);
});

test("client bell refreshes trainer notifications when returning to the main page", async () => {
  const appCore = await readFile(new URL("../src/AppCore.jsx", import.meta.url), "utf8");
  const profileRoute = await readFile(new URL("../src/features/client/profile/ProfileDashboardRoute.jsx", import.meta.url), "utf8");

  assert.match(appCore, /loadClientTrainerTasks,\s*\n\s*loadHistory,/);
  assert.match(profileRoute, /import \{ useEffect, useRef, useState \} from "react"/);
  assert.match(profileRoute, /void loadClientTrainerTasksRef\.current\?\.\(clientUid\)/);
  assert.match(profileRoute, /\[clientUid, hasTrainerFeatures, isMainDashboard\]/);
  assert.match(profileRoute, /onOpenTrainerNotifications=\{\(\) => \{[\s\S]*?loadClientTrainerTasks\?\.\(clientUid\)[\s\S]*?setProfileTrainerNotificationsOpen\(true\)/);
});

test("client overview keeps assignments in one task entry point and removes the duplicate summary card", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const responsiveStyles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceResponsivePass.module.css", import.meta.url), "utf8");

  assert.match(workspace, /className="trainerNextClientStatusRow"/);
  assert.match(workspace, /utilitySheet === "tasks"/);
  assert.match(workspace, /<TrainerClientTasks[\s\S]*?embedded/);
  assert.doesNotMatch(workspace, /activeTasksCount/);
  assert.doesNotMatch(workspace, /trainerNextClientContextActions/);
  assert.match(responsiveStyles, /\.trainerNextClientStatusRow\) \{[\s\S]*?justify-content: space-between/);
  assert.match(responsiveStyles, /\.trainerClientWorkSummary\) \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(responsiveStyles, /article\.attention\),[\s\S]*?nth-child\(3\)[\s\S]*?grid-column: 1 \/ -1/);
});

test("tablet cabinet keeps all summary values and workspace actions in stable grids", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const cabinetStyles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceCabinet.module.css", import.meta.url), "utf8");
  const calmStyles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceCalm.module.css", import.meta.url), "utf8");
  const adaptiveStyles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceAdaptive.module.css", import.meta.url), "utf8");

  assert.match(workspace, /import cabinetStyles from "\.\/TrainerWorkspaceCabinet\.module\.css"/);
  assert.match(workspace, /\$\{cabinetStyles\.scope\}/);
  assert.match(cabinetStyles, /:local\(\.scope\) \{[\s\S]*?min-width: 0/);
  assert.match(cabinetStyles, /trainerCabinetWorkspaceLinks\) \{[\s\S]*?display: grid/);
  assert.match(cabinetStyles, /trainerCabinetWorkspaceLinks button\) \{[\s\S]*?grid-template-columns: 42px minmax\(0, 1fr\) 18px/);
  assert.match(adaptiveStyles, /trainerNextCabinetPage \.trainerCabinetStats\) \{[\s\S]*?repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(adaptiveStyles, /trainerNextCabinetPage \.trainerCabinetWorkspaceLinks\) \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(workspace, /aria-label="Кабинет тренера"/);
  assert.match(workspace, /aria-label="Основное меню тренера"/);
  assert.match(workspace, /className="trainerNextDesktopDock"/);
  assert.match(workspace, /className="trainerNextMobileNav"/);
  assert.match(adaptiveStyles, /@media \(min-width: 700px\) and \(max-width: 1199px\)/);
  assert.match(calmStyles, /trainerCabinetLogout\) \{[\s\S]*?width: 100%/);
});

test("tablet program overview fills the available workspace width", async () => {
  const overview = await readFile(new URL("../src/features/trainer/TrainerProgramOverviewPage.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/features/trainer/TrainerProgramOverviewPage.module.css", import.meta.url), "utf8");

  assert.match(overview, /data-testid=\{isNextWorkspace \? "trainer-program-overview-grid" : undefined\}/);
  assert.match(overview, /data-testid="trainer-program-overview-card"/);
  assert.match(styles, /@media \(min-width: 721px\) and \(max-width: 979px\) \{[\s\S]*?\.grid \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.card,[\s\S]*?\.createCard \{[\s\S]*?min-height: 264px/);
});

test("nutrition diary uses a compact calendar and compact meal entries", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceNutritionDiary.module.css", import.meta.url), "utf8");
  const diary = workspace.match(/function NutritionDiary\(([\s\S]*?)\n\}\n\nfunction NutritionPlan/)?.[1] || "";

  assert.match(diary, /const calendarCells = displayedMonthKey/);
  assert.match(diary, /const \{ entry, dayNumber \} = cell/);
  assert.match(diary, /aria-label=\{entry \? `\$\{dateLabel\}: \$\{entry\.calories\} ккал` : `\$\{dateLabel\}: нет записи`\}/);
  assert.match(diary, /<strong>\{dayNumber\}<\/strong>/);
  assert.match(styles, /trainerNutritionDiaryCalendarGrid\) \{[\s\S]*?grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
  assert.match(styles, /trainerNutritionDiaryCalendarGrid > button\)[\s\S]*?min-height: 46px/);
  assert.match(styles, /trainerNutritionDiary \.trainerNextMealList article\) \{[\s\S]*?grid-template-columns: 34px minmax\(0, 1fr\);[\s\S]*?min-height: 0/);
  assert.match(workspace, /Дневник доступен только для просмотра/);
  assert.match(styles, /trainerNutritionPlanModal \.trainerNutritionGoalInputs\),[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /trainerNutritionPlanModal \.trainerNutritionPlanFields input\),[\s\S]*?min-height: 40px/);
  assert.match(styles, /trainerNutritionPlanModal \.trainerNutritionValidity input\) \{[\s\S]*?box-sizing: border-box;[\s\S]*?max-width: 100%/);
  assert.match(styles, /trainerNutritionPlanModal > \.trainerNutritionPlanActions > button\) \{[\s\S]*?min-height: 44px/);
});

test("client card keeps four main pages and opens exercise progress in a sheet", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const responsiveStyles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceResponsivePass.module.css", import.meta.url), "utf8");
  const clientTabs = workspace.match(/const CLIENT_TABS = \[([\s\S]*?)\n\];/)?.[1] || "";
  const exerciseSection = workspace.match(/\{exercisesOpen \? \(([\s\S]*?)\n      \) : null\}/)?.[1] || "";
  const clientOverview = workspace.match(/function ClientOverview\(\{([\s\S]*?)\n\}\n\nfunction ClientMeasurements/)?.[1] || "";

  assert.match(clientTabs, /\{ id: "exercises", label: "Тренировки", target: "workouts" \}/);
  assert.ok(!clientTabs.includes('id: "messages"') && !clientTabs.includes('id: "notifications"'));
  assert.doesNotMatch(clientTabs, /\{ id: "workouts", label: "План тренировок"/);
  assert.doesNotMatch(clientTabs, /\{ id: "exerciseProgress", label: "Прогресс упражнений"/);
  assert.match(workspace, /\["exercises", "workouts", "exerciseProgress", "training"\]\.includes\(currentTab\)/);
  assert.match(exerciseSection, /<ClientWorkoutPlan/);
  assert.doesNotMatch(exerciseSection, /title="Открыть прогресс упражнений"/);
  assert.match(clientOverview, /title="Открыть прогресс упражнений"/);
  assert.match(clientOverview, /onClick=\{onOpenExerciseProgress\}/);
  assert.match(workspace, /onOpenExerciseProgress=\{\(\) => setUtilitySheet\("exerciseProgress"\)\}/);
  assert.match(workspace, /utilitySheet === "exerciseProgress"/);
  assert.match(workspace, /"Календарь тренировок"/);
  assert.match(workspace, /onSaveSubscription=\{saveSubscription\}/);
  assert.match(workspace, /editingSubscription/);
  assert.match(workspace, /Изменить абонемент/);
  assert.match(workspace, /utilitySheet === "calendar"/);
  assert.doesNotMatch(workspace, /setUtilitySheet\("subscription"\)/);
  assert.doesNotMatch(workspace, /\["calendar", "subscription"\]\.includes\(utilitySheet\)/);
  assert.doesNotMatch(workspace, /title="Открыть календарь тренировок"/);
  assert.match(workspace, /utilitySheet === "nutritionDiary"/);
  assert.match(workspace, /title="Открыть дневник питания"/);
  assert.match(workspace, /<ClientPhotos photos=\{photos\} \/>\s*<ClientMeasurements measurements=\{measurements\} separated \/>/);
  assert.match(workspace, /trainerSubscriptionCalendarUnified trainerNotificationCalendarUnified/);
  assert.match(workspace, /trainerClientTabContent/);
  assert.match(responsiveStyles, /trainerNextClientVariantA \.trainerNextClientTabs\) \{[\s\S]*?margin: 0 0 16px/);
  assert.match(responsiveStyles, /trainerClientMeasurementsSection\) \{[\s\S]*?margin-top: 16px/);
  assert.doesNotMatch(workspace, /ClientSectionTabs/);
  assert.doesNotMatch(exerciseSection, /Разделы упражнений клиента/);
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
  const workspace = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");
  const responsiveStyles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceResponsivePass.module.css", import.meta.url), "utf8");

  assert.match(workspace, /const \[isDayEditorOpen, setIsDayEditorOpen\] = useState\(false\)/);
  assert.match(workspace, /setIsDayEditorOpen\(true\)/);
  assert.match(workspace, /aria-label="Свернуть тренировочный день"/);
  assert.match(workspace, /styles\.dayEditorBackdrop/);
  assert.match(styles, /\.dayEditorModal\s*\{/);
  assert.match(styles, /\.dayEditorModalHeader\s*\{/);
  assert.match(responsiveStyles, /\.trainerNextVideoUpload input\[type="file"\]/);
  assert.match(responsiveStyles, /opacity: 0 !important/);
});

test("embedded program day editor removes the redundant program bar gap", async () => {
  const manager = await readFile(new URL("../src/features/trainer/TrainerProgramManagerView.jsx", import.meta.url), "utf8");
  const managerStyles = await readFile(new URL("../src/features/trainer/TrainerProgramManagerView.module.css", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramConstructor.module.css", import.meta.url), "utf8");

  assert.match(manager, /\$\{styles\.editorModalBody\} \$\{styles\.editorModalBodyProgram\}/);
  assert.match(managerStyles, /\.editorModalBody\.editorModalBodyProgram\s*\{\s*padding-top: 0;/);
  assert.match(styles, /\.embeddedInModal \{ min-height: 0; gap: 0; \}/);
  assert.match(styles, /\.embeddedInModal \.programBar \{ display: none; \}/);
  assert.match(styles, /\.embeddedInModal \.editorGrid \{ grid-template-columns: minmax\(0, 1fr\); gap: 0; \}/);
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
  const layoutStyles = await readFile(new URL("../src/components/trainer/TrainerWorkspaceClientWorkoutPlan.module.css", import.meta.url), "utf8");
  const clientActions = await readFile(new URL("../src/features/trainer/trainerClientActionHandlers.js", import.meta.url), "utf8");
  const plan = workspace.match(/function ClientWorkoutPlan\(([\s\S]*?)\n\}\n\nfunction ClientExerciseProgress/)?.[0] || "";
  const dynamicsLabel = new RegExp("\\u0414\\u0418\\u041d\\u0410\\u041c\\u0418\\u041a\\u0410", "u");
  const workoutDynamicsTitle = new RegExp("\\u041a\\u0430\\u043a \\u043f\\u0440\\u043e\\u0445\\u043e\\u0434\\u044f\\u0442 \\u0442\\u0440\\u0435\\u043d\\u0438\\u0440\\u043e\\u0432\\u043a\\u0438", "u");

  assert.match(workspace, /import TrainerWorkoutReviewDecisionModal from "\.\/TrainerWorkoutReviewDecisionModal"/);
  assert.match(workspace, /import trainerClientWorkoutPlanStyles from "\.\/TrainerClientWorkoutPlan\.module\.css"/);
  assert.match(workspace, /import clientWorkoutPlanStyles from "\.\/TrainerWorkspaceClientWorkoutPlan\.module\.css"/);
  assert.match(workspace, /\$\{clientWorkoutPlanStyles\.scope\}/);
  assert.match(layoutStyles, /:local\(\.scope\) \{[\s\S]*?min-width: 0/);
  assert.doesNotMatch(plan, dynamicsLabel);
  assert.doesNotMatch(plan, workoutDynamicsTitle);
  assert.match(plan, /Открыть разбор и историю тренировок/);
  assert.match(plan, /title="Разбор и история тренировок"/);
  assert.match(plan, /<ClientWorkoutReviewPanel[\s\S]*?<ClientWorkoutHistoryBlock history=\{history\} showAll/);
  assert.match(workspace, /function ClientWorkoutHistoryBlock\(\{ history = \[\], showAll = false \}\)/);
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
  assert.match(styles, /grid-template-columns: minmax\(420px, 1\.(?:05|1)fr\) minmax\(300px, \.(?:95|9)fr\)/);
});

test("trainer can restore an unfinished archived program assignment", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const handlers = await readFile(new URL("../src/features/trainer/trainerProgramTemplateHandlers.js", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/features/trainer/TrainerClientsWorkspaceRoute.jsx", import.meta.url), "utf8");

  assert.match(workspace, /Достать из архива/);
  assert.match(workspace, /requestProgramAssignmentAction\(assignment, "restore"\)/);
  assert.match(workspace, /onRestoreProgramAssignment/);
  assert.match(handlers, /async function restoreClientProgramAssignment/);
  assert.match(handlers, /updateProgramAssignmentLocally\(clientId, assignmentKey, "restore", clientPatch, "", \{/);
  assert.match(handlers, /buildClientProgramLifecycleMetadata\(\{/);
  assert.match(handlers, /const currentTrainerUid = auth\.currentUser\?\.uid \|\| ""/);
  assert.match(handlers, /Restoring[\s\S]*?must not depend on the source template still existing/);
  assert.doesNotMatch(handlers, /templateSnapshot = await getDoc\(doc\(db, "trainingTemplates", storedProgramId\)\)/);
  assert.match(handlers, /if \(!storedProgramId \|\| !storedProgramName\)/);
  assert.match(handlers, /assignedProgramArchivedAt: ""/);
  assert.match(workspace, /Не удалось вернуть программу из архива/);
  assert.match(route, /onRestoreProgramAssignment=\{\(assignment\) => restoreClientProgramAssignment/);
});

test("trainer client visual modules remain attached to the workspace bundle", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const modules = [
    "TrainerWorkspaceClientViews",
    "TrainerWorkspaceNutritionAnalytics",
    "TrainerWorkspaceClientNutrition",
    "TrainerWorkspaceExerciseProgress",
    "TrainerWorkspaceDashboard"
  ];

  for (const moduleName of modules) {
    const styleFile = await readFile(new URL(`../src/components/trainer/${moduleName}.module.css`, import.meta.url), "utf8");
    const variableName = moduleName
      .replace("TrainerWorkspace", "")
      .replace(/([A-Z])/g, (match, index) => (index ? match : match.toLowerCase()))
      .replace(/^./, (match) => match.toLowerCase())
      .replace("ClientViews", "clientViews")
      .replace("NutritionAnalytics", "nutritionAnalytics")
      .replace("ClientNutrition", "clientNutrition")
      .replace("ExerciseProgress", "exerciseProgress")
      .replace("Dashboard", "dashboard");

    assert.match(styleFile, /:local\(\.scope\) \{[\s\S]*?min-width: 0/);
    assert.match(workspace, new RegExp(`\\$\\{${variableName}Styles\\.scope\\}`));
  }
});

test("program assignment opens a client-specific load review before it replaces workouts", async () => {
  const workspace = await readFile(new URL("../src/components/trainer/TrainerWorkspace.jsx", import.meta.url), "utf8");
  const modal = await readFile(new URL("../src/components/trainer/TrainerProgramAssignmentAdjustmentModal.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/trainer/TrainerProgramAssignmentAdjustmentModal.module.css", import.meta.url), "utf8");
  const handlers = await readFile(new URL("../src/features/trainer/trainerProgramTemplateHandlers.js", import.meta.url), "utf8");
  const { applyTrainerProgramAssignmentLoadAdjustments } = await import("../src/utils/trainerProgramAssignmentAdjustment.js");

  assert.match(workspace, /<TrainerProgramAssignmentAdjustmentModal/);
  assert.match(workspace, /setAssignmentReviewOpen\(true\)/);
  assert.match(workspace, /skipConfirmation: true/);
  assert.match(modal, /Корректировка под клиента/);
  assert.match(modal, /Поправка к весам/);
  assert.match(modal, /type="number"\s*\n\s*min="0"\s*\n\s*step="0\.5"/);
  assert.match(styles, /max-height: calc\(100dvh - 36px\)/);
  assert.match(handlers, /applyTrainerProgramAssignmentLoadAdjustments\(/);
  assert.match(handlers, /assignmentOptions\.skipConfirmation/);

  const sourceWorkouts = [{ exercises: [{ name: "Жим лёжа", requiresWeight: true, sets: [{ weight: "40" }, { weight: "45" }] }] }];
  const adjustedWorkouts = applyTrainerProgramAssignmentLoadAdjustments(sourceWorkouts, { "жим лёжа": "2.5" });
  assert.equal(sourceWorkouts[0].exercises[0].sets[0].weight, "40");
  assert.equal(adjustedWorkouts[0].exercises[0].sets[0].weight, "42.5");
  assert.equal(adjustedWorkouts[0].exercises[0].sets[1].weight, "47.5");

  const negativeAdjustment = applyTrainerProgramAssignmentLoadAdjustments(sourceWorkouts, { "жим лёжа": "-2.5" });
  assert.equal(negativeAdjustment[0].exercises[0].sets[0].weight, "40");
  assert.equal(negativeAdjustment[0].exercises[0].sets[1].weight, "45");
});
