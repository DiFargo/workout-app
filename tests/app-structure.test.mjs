import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

async function readText(path) {
  return fs.readFile(path, "utf8");
}

async function pathExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(dir, extensions, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(entryPath, extensions, files);
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(entryPath);
    }
  }

  return files;
}

function collectCssImports(source) {
  return [...source.matchAll(/@import\s+["']([^"']+)["']\s*;/g)].map((match) => match[1]);
}

function collectModuleImports(source) {
  return [
    ...source.matchAll(/\bimport\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\(["']([^"']+)["']\)/g)
  ].map((match) => match[1]);
}

function resolveRelativeImport(file, importSource) {
  if (!importSource.startsWith(".")) return null;
  return path.normalize(path.join(path.dirname(file), importSource));
}

async function resolveSourceImport(file, importSource) {
  const base = resolveRelativeImport(file, importSource);
  if (!base) return null;

  for (const candidate of [
    base,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, "index.js"),
    path.join(base, "index.jsx")
  ]) {
    if (await pathExists(candidate)) return path.normalize(candidate);
  }

  return null;
}

async function walkCssImports(entryPath, visiting = new Set(), visited = new Set()) {
  const normalizedEntry = path.normalize(entryPath);
  assert.equal(visiting.has(normalizedEntry), false, `CSS import cycle detected at ${normalizedEntry}`);
  if (visited.has(normalizedEntry)) return visited;

  const source = await readText(normalizedEntry);
  visiting.add(normalizedEntry);

  for (const importPath of collectCssImports(source)) {
    if (!importPath.endsWith(".css")) continue;

    const resolved = path.normalize(path.join(path.dirname(normalizedEntry), importPath));
    assert.equal(await pathExists(resolved), true, `Missing CSS import ${importPath} from ${normalizedEntry}`);
    await walkCssImports(resolved, visiting, visited);
  }

  visiting.delete(normalizedEntry);
  visited.add(normalizedEntry);
  return visited;
}

test("AppCore stays a coordinator and does not re-import nutrition internals", async () => {
  const appCore = await readText("src/AppCore.jsx");
  const appCoreLines = appCore.split(/\r?\n/).length;

  assert.match(appCore, /NutritionRoute/);
  assert.doesNotMatch(appCore, /renderNutritionRoute/);
  assert.doesNotMatch(appCore, /renderNutritionPageFromContext/);
  assert.doesNotMatch(appCore, /NutritionPageView/);
  assert.doesNotMatch(appCore, /nutritionPageModel/);
  assert.doesNotMatch(appCore, /NUTRITION_ICON_PRESETS/);
  assert.doesNotMatch(appCore, /nutritionMeals/);
  assert.ok(appCoreLines <= 3200, `AppCore.jsx grew to ${appCoreLines} lines; keep it as a coordinator`);
});

test("app entrypoints stay thin", async () => {
  const appSource = await readText("src/App.jsx");
  const mainSource = await readText("src/main.jsx");
  const serviceWorkerSource = await readText("src/app/registerServiceWorker.js");

  assert.match(appSource, /import AppCore from ["']\.\/AppCore["']/);
  assert.match(appSource, /import AppErrorBoundary from ["']\.\/components\/common\/AppErrorBoundary["']/);
  assert.match(appSource, /<AppErrorBoundary>/);
  assert.match(appSource, /<AppCore \/>/);
  assert.ok(appSource.split(/\r?\n/).length <= 16, "App.jsx should remain a thin AppCore wrapper");

  assert.match(mainSource, /createRoot\(document\.getElementById\(['"]root['"]\)\)\.render/);
  assert.match(mainSource, /['"]\.\/styles\/index\.css['"]/);
  assert.match(mainSource, /registerServiceWorker\(\);/);
  assert.match(serviceWorkerSource, /navigator\.serviceWorker\.register\(["']\/sw\.js["'],\s*\{\s*updateViaCache:\s*["']none["']\s*\}/);
  assert.match(serviceWorkerSource, /controllerchange/);
  assert.match(serviceWorkerSource, /registration\.update\(\)/);
  assert.doesNotMatch(mainSource, /AppCore/);
  assert.ok(mainSource.split(/\r?\n/).length <= 16, "main.jsx should remain a thin app entrypoint");
});

test("source modules stay reachable from the app entrypoint", async () => {
  const allSourceFiles = (await collectFiles("src", [".js", ".jsx"]))
    .map((file) => path.normalize(file))
    .sort();
  const reachableFiles = new Set();
  const pendingFiles = [path.normalize("src/main.jsx")];

  while (pendingFiles.length > 0) {
    const file = pendingFiles.pop();
    if (reachableFiles.has(file)) continue;
    reachableFiles.add(file);

    const source = await readText(file);
    for (const importSource of collectModuleImports(source)) {
      const resolved = await resolveSourceImport(file, importSource);
      if (resolved) pendingFiles.push(resolved);
    }
  }

  const unreachableFiles = allSourceFiles.filter((file) => !reachableFiles.has(file));

  assert.deepEqual(unreachableFiles, []);
});

test("source module import graph stays acyclic", async () => {
  const sourceFiles = await collectFiles("src", [".js", ".jsx"]);
  const graph = new Map();

  for (const file of sourceFiles) {
    const source = await readText(file);
    const imports = [];

    for (const importSource of collectModuleImports(source)) {
      const resolved = await resolveSourceImport(file, importSource);
      if (resolved) imports.push(resolved);
    }

    graph.set(path.normalize(file), imports);
  }

  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];

  function visit(file) {
    if (visiting.has(file)) {
      const cycleStart = stack.indexOf(file);
      cycles.push([...stack.slice(cycleStart), file].join(" -> "));
      return;
    }

    if (visited.has(file)) return;

    visiting.add(file);
    stack.push(file);

    for (const nextFile of graph.get(file) || []) {
      visit(nextFile);
    }

    stack.pop();
    visiting.delete(file);
    visited.add(file);
  }

  for (const file of graph.keys()) {
    visit(file);
  }

  assert.deepEqual(cycles, []);
});

test("shared React hooks stay in the shared hooks layer", async () => {
  const legacyHookFiles = await pathExists("src/hooks")
    ? await collectFiles("src/hooks", [".js", ".jsx"])
    : [];

  assert.deepEqual(legacyHookFiles, []);
});

test("application styles use the modular styles entrypoint", async () => {
  const main = await readText("src/main.jsx");
  const indexCss = await readText("src/styles/index.css");
  const clientWorkoutLazyCss = await readText("src/styles/client-workout-lazy.css");
  const nutritionStackCss = await readText("src/styles/nutrition-stack.css");
  const nutritionAiPlanLazyCss = await readText("src/styles/nutrition-ai-plan-lazy.css");
  const nutritionFoodIconLazyCss = await readText("src/styles/nutrition-food-icon-lazy.css");
  const aiCoachLazyCss = await readText("src/styles/ai-coach-lazy.css");
  const clientMeasurementsLazyCss = await readText("src/styles/client-measurements-lazy.css");
  const clientProfileLazyCss = await readText("src/styles/client-profile-lazy.css");
  const appSource = await readText("src/App.jsx");
  const appCore = await readText("src/AppCore.jsx");
  const appRouter = await readText("src/app/AppRouter.jsx");
  const appTerminalRoutes = await readText("src/app/appTerminalRoutes.jsx");
  const trainerWorkspace = await readText("src/components/trainer/TrainerWorkspace.jsx");
  const adminPanelHub = await readText("src/components/admin/AdminPanelHub.jsx");
  const adminE2EHarness = await readText("src/components/admin/AdminE2EHarness.jsx");
  const adminLazyCss = await readText("src/styles/admin-lazy.css");
  const adminInternalsLazyCss = await readText("src/styles/admin-internals-lazy.css");

  assert.equal(await pathExists("src/styles.css"), false);
  assert.match(main, /['"]\.\/styles\/index\.css['"]/);
  assert.doesNotMatch(main, /['"]\.\/styles\.css['"]/);
  assert.doesNotMatch(appSource, /styles\.css/);
  assert.match(indexCss, /@import "\.\/legacy-profile-first-setup-core\.css"/);
  assert.doesNotMatch(indexCss, /legacy-ai-nutrition-workout-readiness\.css/);
  assert.match(appCore, /['"]\.\/styles\/client-workout-lazy\.css['"]/);
  assert.match(appCore, /['"]\.\/styles\/nutrition-stack\.css['"]/);
  assert.match(appCore, /['"]\.\/styles\/ai-coach-lazy\.css['"]/);
  assert.match(aiCoachLazyCss, /\.aiCoachPage/);
  assert.match(aiCoachLazyCss, /\.aiNutritionPlanShell/);
  assert.match(nutritionStackCss, /@import "\.\/nutrition-ai-plan-lazy\.css"/);
  assert.match(nutritionStackCss, /@import "\.\/nutrition-food-icon-lazy\.css"/);
  assert.match(nutritionAiPlanLazyCss, /\.nutritionAiPlanDashboard/);
  assert.match(nutritionAiPlanLazyCss, /\.nutritionAiHistoryPlanCard/);
  assert.match(nutritionFoodIconLazyCss, /\.foodEditIconManualBox/);
  assert.match(nutritionFoodIconLazyCss, /\.nutritionCaloriesRenderCard\.trainingDay/);
  assert.doesNotMatch(indexCss, /\.aiCoachPage/);
  assert.doesNotMatch(indexCss, /\.aiNutritionPlanShell/);
  assert.doesNotMatch(indexCss, /\.nutritionAiPlanDashboard/);
  assert.doesNotMatch(indexCss, /\.foodEditIconManualBox/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/legacy-client-workout-flow-late\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/legacy-workout-flow-polish\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/legacy-workout-exercise-notes\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/legacy-workout-navigation-close-early\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/client-workout-set-rows\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/client-workout-dialogs-lazy\.css"/);
  for (const nutritionLazyImport of [
    "./legacy-warm-light-add-food-search-cleanup.css",
    "./client-food-search-final.css",
    "./legacy-nutrition-photo-not-found.css",
    "./legacy-nutrition-orbit.css",
    "./legacy-nutrition-flow.css"
  ]) {
    assert.match(nutritionStackCss, new RegExp(`@import "${nutritionLazyImport.replace(".", "\\.")}"`));
  }
  assert.match(appRouter, /['"]\.\.\/styles\/client-workout-lazy\.css['"]/);
  assert.match(appRouter, /['"]\.\.\/styles\/ai-coach-lazy\.css['"]/);
  assert.match(appRouter, /['"]\.\.\/styles\/client-measurements-lazy\.css['"]/);
  assert.match(appTerminalRoutes, /['"]\.\.\/styles\/client-workout-lazy\.css['"]/);
  assert.match(appTerminalRoutes, /['"]\.\.\/styles\/client-profile-lazy\.css['"]/);
  assert.match(clientProfileLazyCss, /@import "\.\/client-measurements-lazy\.css"/);
  for (const measurementLazyImport of [
    "./legacy-measurements-late.css",
    "./legacy-measurement-review.css"
  ]) {
    assert.match(clientMeasurementsLazyCss, new RegExp(`@import "${measurementLazyImport.replace(".", "\\.")}"`));
    assert.doesNotMatch(indexCss, new RegExp(`@import "${measurementLazyImport.replace(".", "\\.")}"`));
  }
  for (const profileLazyImport of [
    "./legacy-profile-dashboard-telegram-late.css",
    "./legacy-history-ai-search-late.css",
    "./legacy-profile-nutrition-late.css",
    "./legacy-profile-progress-late.css",
    "./legacy-desktop-cabinet-polish.css",
    "./legacy-cabinet-calendar-insights.css",
    "./legacy-profile-account-editor.css",
    "./legacy-progress-insights.css"
  ]) {
    assert.match(clientProfileLazyCss, new RegExp(`@import "${profileLazyImport.replace(".", "\\.")}"`));
    assert.doesNotMatch(indexCss, new RegExp(`@import "${profileLazyImport.replace(".", "\\.")}"`));
  }
  assert.match(trainerWorkspace, /['"]\.\.\/\.\.\/styles\/trainer-lazy\.css['"]/);
  assert.match(adminPanelHub, /['"]\.\.\/\.\.\/styles\/admin-lazy\.css['"]/);
  assert.match(adminE2EHarness, /['"]\.\.\/\.\.\/styles\/admin-internals-lazy\.css['"]/);
  assert.match(adminLazyCss, /@import "\.\/adminPanelHub\.css"/);

  for (const adminHeavyImport of [
    "./legacy-admin-shell-crm-app46.css",
    "./legacy-admin-program-editor-app49.css",
    "./legacy-month-program-editor-early.css",
    "./legacy-admin-client-page.css",
    "./legacy-admin-dashboard-bars.css",
    "./legacy-admin-programs-dashboard.css",
    "./legacy-admin-client-dashboard-polish.css",
    "./legacy-admin-calendar-reminders-late.css",
    "./legacy-trainer-desktop-adaptation-late.css",
    "./legacy-trainer-program-editor-late.css",
    "./nutrition-trainer-desktop.css"
  ]) {
    const escapedImport = adminHeavyImport.replace(".", "\\.");
    assert.doesNotMatch(adminLazyCss, new RegExp(`@import "${escapedImport}"`));
    assert.match(adminInternalsLazyCss, new RegExp(`@import "${escapedImport}"`));
  }

  for (const requiredImport of [
    "./tokens.css",
    "./theme.css",
    "./base.css",
    "./app.css",
    "./menu.css",
    "./splash.css",
    "./workoutFlow.css",
    "./auth.css",
    "./legacy-overrides.css",
    "./legacy-client-screen-alignment.css"
  ]) {
    assert.match(indexCss, new RegExp(`@import "${requiredImport.replace(".", "\\.")}"`));
  }

  for (const deferredImport of [
    "./trainer.css",
    "./admin.css",
    "./themes.css",
    "./client-main.css",
    "./layout.css",
    "./components.css",
    "./legacy-stack.css",
    "./legacy-stack-foundation.css",
    "./legacy-stack-workflows.css",
    "./legacy-stack-final-polish.css",
    "./ai-coach-lazy.css",
    "./nutrition-ai-plan-lazy.css",
    "./nutrition-food-icon-lazy.css",
    "./client-measurements-lazy.css",
    "./client-profile-lazy.css",
    "./nutrition-stack.css",
    "./legacy-admin-stack.css",
    "./legacy-trainer-desktop-adaptation-late.css",
    "./legacy-trainer-program-editor-late.css",
    "./legacy-trainer-light-workspace.css",
    "./legacy-trainer-light-audit.css",
    "./nutrition-trainer-desktop.css",
    "./legacy-client-workout-flow-late.css",
    "./legacy-workout-flow-polish.css",
    "./legacy-workout-exercise-notes.css",
    "./legacy-workout-navigation-close-early.css",
    "./client-workout-set-rows.css",
    "./client-workout-dialogs-lazy.css",
    "./legacy-dark-green-food-flow.css",
    "./legacy-warm-light-add-food-search-cleanup.css",
    "./client-food-search-final.css",
    "./legacy-nutrition-photo-not-found.css",
    "./legacy-nutrition-orbit.css",
    "./legacy-nutrition-flow.css"
  ]) {
    assert.doesNotMatch(indexCss, new RegExp(`@import "${deferredImport.replace(".", "\\.")}"`));
  }

  const allSourceFiles = await collectFiles("src", [".js", ".jsx"]);
  const allowedCssImportFiles = new Set([
    path.normalize("src/main.jsx"),
    path.normalize("src/AppCore.jsx"),
    path.normalize("src/app/AppRouter.jsx"),
    path.normalize("src/app/appTerminalRoutes.jsx"),
    path.normalize("src/components/trainer/TrainerWorkspace.jsx"),
    path.normalize("src/components/admin/AdminPanelHub.jsx"),
    path.normalize("src/components/admin/AdminE2EHarness.jsx")
  ]);

  for (const file of allSourceFiles) {
    const source = await readText(file);
    if (!/\.css['"]/.test(source)) continue;
    assert.ok(
      allowedCssImportFiles.has(path.normalize(file)),
      `Unexpected CSS import outside approved entrypoints: ${file}`
    );
  }
});

test("modular CSS import graph resolves without cycles", async () => {
  const visited = new Set();
  for (const cssEntry of [
    "src/styles/index.css",
    "src/styles/ai-coach-lazy.css",
    "src/styles/client-measurements-lazy.css",
    "src/styles/client-profile-lazy.css",
    "src/styles/client-workout-lazy.css",
    "src/styles/nutrition-stack.css",
    "src/styles/trainer-lazy.css",
    "src/styles/admin-lazy.css",
    "src/styles/admin-internals-lazy.css"
  ]) {
    await walkCssImports(cssEntry, new Set(), visited);
  }
  const allCssFiles = [
    ...(await collectFiles("src/styles", [".css"])),
    ...(await collectFiles("src/components", [".css"]))
  ].map((file) => path.normalize(file)).sort();
  const reachableCssFiles = [...visited].sort();

  assert.ok(visited.has(path.normalize("src/styles/index.css")));
  assert.ok(visited.has(path.normalize("src/styles/ai-coach-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/client-workout-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/nutrition-stack.css")));
  assert.ok(visited.has(path.normalize("src/styles/trainer-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/admin-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/legacy-overrides.css")));
  assert.ok(visited.has(path.normalize("src/components/trainer/trainer-workspace.css")));
  assert.equal(await pathExists("src/styles.css"), false);
  assert.deepEqual(reachableCssFiles, allCssFiles);
});

test("dark nutrition hero keeps explicit readable text overrides", async () => {
  const indexCss = await readText("src/styles/index.css");
  const nutritionStackCss = await readText("src/styles/nutrition-stack.css");
  const darkGreenFoodFlow = await readText("src/styles/legacy-client-screen-alignment.css");

  assert.doesNotMatch(indexCss, /@import "\.\/legacy-dark-green-food-flow\.css"/);
  assert.match(nutritionStackCss, /@import "\.\/legacy-dark-green-food-flow\.css"/);
  assert.match(indexCss, /@import "\.\/legacy-client-screen-alignment\.css"/);
  assert.match(darkGreenFoodFlow, /nutritionHeroTitleV4 \.clientCorePageTitle/);
  assert.match(darkGreenFoodFlow, /nutritionWeekV4 \.nutritionDayV4 small/);
  assert.match(darkGreenFoodFlow, /nutritionStreakV4 span/);
  assert.match(darkGreenFoodFlow, /rgba\(248,\s*250,\s*255,\s*0\.94\)/);
});

test("verification scripts stay usable in the Windows workspace", async () => {
  const packageJson = JSON.parse(await readText("package.json"));
  const verifyScript = await readText("scripts/verify.cmd");

  assert.equal(packageJson.scripts.verify, "scripts\\verify.cmd");
  assert.equal(packageJson.scripts["verify:smoke"], undefined);
  assert.match(packageJson.scripts["test:rules"], /XDG_CONFIG_HOME=\.config/);
  assert.match(packageJson.scripts["test:rules"], /--cache \.\/\.npm-cache/);

  for (const requiredCommand of [
    "call npm.cmd run build",
    "call npm.cmd run check:bundle",
    "call npm.cmd test",
    "call npm.cmd run lint:critical"
  ]) {
    assert.match(verifyScript, new RegExp(requiredCommand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.doesNotMatch(verifyScript, /test:rules/);
  assert.doesNotMatch(verifyScript, /test:e2e/);
});

test("auth bootstrap cannot leave the splash screen blocked forever", async () => {
  const source = await readText("src/app/useAuthBootstrapEffect.js");

  assert.match(source, /bootstrapFallbackTimerId\s*=\s*window\.setTimeout/);
  assert.match(source, /Auth bootstrap timeout: forcing loading screen to close/);
  assert.match(source, /setFirstSetupProfileHydrated\(true\);[\s\S]*setAppLoading\(false\);/);
  assert.match(source, /catch \(error\)[\s\S]*setFirstSetupProfileHydrated\(true\);[\s\S]*finally/);
});

test("trainer UI routes stay behind terminal route boundaries", async () => {
  const appCore = await readText("src/AppCore.jsx");
  const terminalRoutes = await readText("src/app/appTerminalRoutes.jsx");
  const trainerUsersRoute = await readText("src/features/trainer/TrainerUsersRoute.jsx");
  const trainerWorkoutsRoute = await readText("src/features/trainer/TrainerAdminWorkoutsRoute.jsx");

  assert.match(appCore, /renderAppTerminalRoute/);
  assert.doesNotMatch(appCore, /TrainerUsersLegacyRoute/);
  assert.doesNotMatch(appCore, /TrainerClientsWorkspaceRoute/);
  assert.doesNotMatch(appCore, /TrainerAdminWorkoutsNextRoute/);
  assert.doesNotMatch(appCore, /TrainerProgramManagerView/);
  assert.doesNotMatch(appCore, /from ["']\.\/components\/trainer\/TrainerWorkspace["']/);

  assert.match(terminalRoutes, /TrainerDashboardRoute/);
  assert.match(terminalRoutes, /TrainerUsersRoute/);
  assert.match(terminalRoutes, /TrainerAdminWorkoutsRoute/);
  assert.doesNotMatch(terminalRoutes, /TrainerUsersLegacyRoute/);
  assert.doesNotMatch(terminalRoutes, /TrainerClientsWorkspaceRoute/);
  assert.doesNotMatch(terminalRoutes, /TrainerProgramManagerView/);

  assert.match(trainerUsersRoute, /TrainerClientsWorkspaceRoute/);
  assert.match(trainerUsersRoute, /TrainerUsersLegacyRoute/);
  assert.match(trainerUsersRoute, /buildTrainerUsersPageModel/);
  assert.match(trainerWorkoutsRoute, /TrainerAdminWorkoutsNextRoute/);
  assert.match(trainerWorkoutsRoute, /TrainerProgramManagerView/);
});

test("trainer program editor keeps an explicit back action", async () => {
  const workspace = await readText("src/components/trainer/TrainerWorkspace.jsx");
  const managerView = await readText("src/features/trainer/TrainerProgramManagerView.jsx");

  assert.match(workspace, /export function TrainerProgramConstructor\(\{[\s\S]*?\bonBack,/);
  assert.match(workspace, /onBack\s*\?\s*\([\s\S]*?<button type="button" onClick=\{onBack\}>[\s\S]*?<ArrowLeft/);
  assert.match(managerView, /<TrainerProgramConstructor[\s\S]*?onBack=\{handleMonthProgramBack\}/);
});

test("trainer admin user selectors expose selected state", async () => {
  const usersHeader = await readText("src/features/trainer/TrainerAdminUsersListHeader.jsx");
  const usersGrid = await readText("src/features/trainer/TrainerAdminUsersClientGrid.jsx");

  assert.match(usersHeader, /className=\{adminClientFilter === id \? "active" : ""\}[\s\S]*aria-pressed=\{adminClientFilter === id\}/);
  assert.match(usersGrid, /className=\{active \? "adminClientCard[\s\S]*aria-pressed=\{active\}/);
});

test("trainer dashboard selectors expose selected state", async () => {
  const dashboardFilters = await readText("src/features/trainer/TrainerDashboardKpiFilters.jsx");
  const dashboardGrid = await readText("src/features/trainer/TrainerDashboardGrid.jsx");

  assert.match(dashboardFilters, /className=\{adminClientFilter === id \? "active" : ""\}[\s\S]*aria-pressed=\{adminClientFilter === id\}/);
  assert.match(dashboardGrid, /className=\{isActive \? "active" : ""\}[\s\S]*aria-pressed=\{isActive\}/);
});

test("trainer client workspace header selectors expose selected state", async () => {
  const workspaceHeader = await readText("src/features/trainer/TrainerAdminClientWorkspaceHeader.jsx");

  assert.match(workspaceHeader, /className=\{selectedClient\.role === "trainer" \? "adminTrainerRoleButton active" : "adminTrainerRoleButton"\}[\s\S]*aria-pressed=\{selectedClient\.role === "trainer"\}/);
  assert.match(workspaceHeader, /className=\{adminUsersSelectedTab === id \? "active" : ""\}[\s\S]*aria-pressed=\{adminUsersSelectedTab === id\}/);
});

test("client workout warmup timer presets expose selected state", async () => {
  const warmupStage = await readText("src/features/client/workouts/WorkoutWarmupStage.jsx");

  assert.match(warmupStage, /className=\{timerDuration === seconds \? "active" : ""\}[\s\S]*aria-pressed=\{timerDuration === seconds\}/);
});

test("trainer client training program cards expose selected state", async () => {
  const trainingTab = await readText("src/features/trainer/TrainerClientTrainingTab.jsx");

  assert.match(trainingTab, /className=\{isSelected \|\| isAssigned \? "adminSavedProgramCard active" : "adminSavedProgramCard"\}[\s\S]*aria-pressed=\{isSelected \|\| isAssigned\}/);
});

test("client workout next card exposes current step state", async () => {
  const workoutListPage = await readText("src/features/client/workouts/WorkoutListPage.jsx");

  assert.match(workoutListPage, /className=\{`workoutSelectCard individualWorkoutCardPro[\s\S]*aria-current=\{activeNext \? "step" : undefined\}/);
});

test("trainer legacy dashboard tabs expose selected state", async () => {
  const legacyDashboard = await readText("src/features/trainer/TrainerLegacyDashboardRoute.jsx");

  assert.match(legacyDashboard, /className=\{adminClientTab === id \? "active" : ""\}[\s\S]*aria-pressed=\{adminClientTab === id\}/);
});

test("trainer admin history bulk selection exposes accessible state", async () => {
  const historyTab = await readText("src/features/trainer/TrainerAdminHistoryTab.jsx");

  assert.match(historyTab, /const allVisibleSelected = visibleHistory\.length > 0 && visibleHistory\.every/);
  assert.match(historyTab, /<button type="button" aria-pressed=\{allVisibleSelected\}[\s\S]*onClick=\{toggleAdminSelectAllHistory\}/);
  assert.match(historyTab, /type="checkbox"[\s\S]*checked=\{adminSelectedHistoryIds\.includes\(item\.id\)\}[\s\S]*aria-label=\{`Выбрать тренировку: \$\{item\.workout \|\| "Тренировка"\}`\}/);
});

test("trainer program overview cards expose selected state", async () => {
  const overviewPage = await readText("src/features/trainer/TrainerProgramOverviewPage.jsx");

  assert.match(overviewPage, /className=\{isSelected \? "programsOverviewCard selected" : "programsOverviewCard"\}[\s\S]*type="button"[\s\S]*aria-pressed=\{isSelected\}/);
});

test("trainer mobile overflow navigation exposes current page state", async () => {
  const workspace = await readText("src/components/trainer/TrainerWorkspace.jsx");

  assert.match(workspace, /const active = activeSection === item\.id;[\s\S]*data-testid=\{`trainer-more-\$\{item\.id\}`\}[\s\S]*className=\{active \? "active" : ""\}[\s\S]*aria-current=\{active \? "page" : undefined\}/);
});

test("trainer workouts page program tab exposes selected state", async () => {
  const workoutsRoute = await readText("src/features/trainer/TrainerAdminWorkoutsRoute.jsx");

  assert.match(workoutsRoute, /<button type="button" className="active" aria-pressed="true">[\s\S]*?<\/button>[\s\S]*openTrainerExerciseLibrary/);
});

test("legacy trainer admin action buttons declare button type", async () => {
  const dangerZone = await readText("src/features/trainer/TrainerAdminDangerZone.jsx");
  const notesTab = await readText("src/features/trainer/TrainerAdminNotesTab.jsx");
  const programTab = await readText("src/features/trainer/TrainerAdminProgramTab.jsx");
  const dashboardGrid = await readText("src/features/trainer/TrainerDashboardGrid.jsx");
  const trainingTab = await readText("src/features/trainer/TrainerClientTrainingTab.jsx");

  assert.match(dangerZone, /<button className="danger" type="button"[\s\S]*onDeleteClient/);
  assert.match(notesTab, /<button className="adminV3OpenEditor" type="button"[\s\S]*saveAdminTrainerNote/);
  assert.match(programTab, /<button type="button" onClick=\{createAdminTemplateFromCurrentPlan\}/);
  assert.match(programTab, /<button type="button" onClick=\{\(\) => selectedClient && assignAdminTemplateToClient\(selectedClient\.id\)\}/);
  assert.match(programTab, /<button type="button" onClick=\{\(\) => selectedClient && clearClientProgram\(selectedClient\.id\)\}/);
  assert.match(programTab, /<button type="button" onClick=\{copyCurrentProgramToClient\}/);
  assert.match(programTab, /<button className="adminV3OpenEditor" type="button"[\s\S]*onOpenDesktopEditor/);
  assert.match(dashboardGrid, /<button type="button" onClick=\{\(\) => setPage\(APP_PAGES\.ADMIN_USERS\)\}/);
  assert.match(trainingTab, /<button type="button" onClick=\{\(\) => \{[\s\S]*setPage\(trainerWorkoutsPage\)/);
  assert.match(trainingTab, /<button type="button" onClick=\{\(\) => assignSavedProgramToClient\(selectedClient\.id\)\}/);
});

test("admin and access denied navigation buttons declare button type", async () => {
  const adminPanelHub = await readText("src/components/admin/AdminPanelHub.jsx");
  const accessDeniedScreen = await readText("src/components/common/AccessDeniedScreen.jsx");
  const trainerWorkoutsRoute = await readText("src/features/trainer/TrainerAdminWorkoutsRoute.jsx");

  assert.match(adminPanelHub, /<button className="backBtn" type="button"[\s\S]*setPage\("main"\)/);
  assert.match(adminPanelHub, /className="adminFixedMainBack"[\s\S]*type="button"[\s\S]*setPage\("main"\)/);
  assert.match(accessDeniedScreen, /<button className="backBtn" type="button"[\s\S]*onClick=\{onBack\}/);
  assert.match(trainerWorkoutsRoute, /<button className="backBtn" type="button"[\s\S]*setPage\(APP_PAGES\.MAIN\)/);
});

test("all JSX buttons declare an explicit type", async () => {
  const jsxFiles = await collectFiles("src", [".jsx"]);
  const missingTypeButtons = [];

  for (const file of jsxFiles) {
    const source = await readText(file);

    for (const match of source.matchAll(/<button\b[\s\S]*?>/g)) {
      if (/\btype\s*=/.test(match[0])) continue;

      const line = source.slice(0, match.index).split(/\r?\n/).length;
      missingTypeButtons.push(`${file}:${line}`);
    }
  }

  assert.deepEqual(missingTypeButtons, []);
});

test("client icon-only actions expose accessible labels", async () => {
  const aiCoach = await readText("src/features/client/ai/AiCoachPage.jsx");
  const basicQuiz = await readText("src/features/client/workouts/BasicWorkoutQuizPage.jsx");
  const workoutMode = await readText("src/features/client/workouts/WorkoutModePage.jsx");
  const historyPage = await readText("src/features/client/workouts/WorkoutHistoryPage.jsx");
  const runOverlays = await readText("src/features/client/workouts/WorkoutRunOverlays.jsx");
  const dishPicker = await readText("src/features/client/nutrition/DishIngredientPicker.jsx");

  assert.match(aiCoach, /aiCoachBackBtn" type="button"[\s\S]*aria-label="Назад"/);
  assert.match(basicQuiz, /className="workoutModeBack" type="button"[\s\S]*aria-label="Назад к выбору режима"/);
  assert.match(workoutMode, /className="workoutModeBack" type="button"[\s\S]*aria-label="Назад на главную"/);
  assert.match(historyPage, /historyCompactRefresh" type="button"[\s\S]*aria-label="Обновить историю тренировок"/);
  assert.match(runOverlays, /type="button"[\s\S]*onClick=\{onClose\}[\s\S]*aria-label="Закрыть видео"/);
  assert.match(dishPicker, /type="button" onClick=\{onClose\} aria-label="Закрыть выбор ингредиента"/);
});

test("production components do not import feature layers back", async () => {
  const componentFiles = await collectFiles("src/components", [".js", ".jsx"]);
  const allowedFeatureImports = new Set([
    path.normalize("src/components/admin/AdminE2EHarness.jsx"),
    path.normalize("src/components/client/ClientE2EHarness.jsx")
  ]);
  const violations = [];

  for (const file of componentFiles) {
    const source = await readText(file);
    if (!source.includes("features/")) continue;
    if (allowedFeatureImports.has(path.normalize(file))) continue;
    violations.push(file);
  }

  assert.deepEqual(violations, []);
});

test("client and trainer feature layers do not import each other", async () => {
  const clientFiles = await collectFiles("src/features/client", [".js", ".jsx"]);
  const trainerFiles = await collectFiles("src/features/trainer", [".js", ".jsx"]);
  const trainerFeatureRoot = path.normalize("src/features/trainer");
  const clientFeatureRoot = path.normalize("src/features/client");
  const violations = [];

  for (const file of clientFiles) {
    const source = await readText(file);
    for (const importSource of collectModuleImports(source)) {
      const resolved = resolveRelativeImport(file, importSource);
      if (resolved?.startsWith(trainerFeatureRoot)) {
        violations.push(`${file} -> ${importSource}`);
      }
    }
  }

  for (const file of trainerFiles) {
    const source = await readText(file);
    for (const importSource of collectModuleImports(source)) {
      const resolved = resolveRelativeImport(file, importSource);
      if (resolved?.startsWith(clientFeatureRoot)) {
        violations.push(`${file} -> ${importSource}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("feature layers only depend on app navigation contracts", async () => {
  const featureFiles = await collectFiles("src/features", [".js", ".jsx"]);
  const allowedAppModules = new Set([
    path.normalize("src/app/appPages"),
    path.normalize("src/app/appNavigation")
  ]);
  const violations = [];

  for (const file of featureFiles) {
    const source = await readText(file);
    for (const importSource of collectModuleImports(source)) {
      const resolved = resolveRelativeImport(file, importSource);
      if (!resolved?.startsWith(path.normalize("src/app"))) continue;
      if (allowedAppModules.has(resolved)) continue;
      violations.push(`${file} -> ${importSource}`);
    }
  }

  assert.deepEqual(violations, []);
});

test("domain and utils stay free from React and UI layers", async () => {
  const pureFiles = [
    ...(await collectFiles("src/domain", [".js", ".mjs"])),
    ...(await collectFiles("src/utils", [".js", ".mjs"]))
  ];
  const forbiddenPatterns = [
    /\bfrom\s+["']react["']/,
    /\bimport\s+["']react["']/,
    /components\//,
    /features\//,
    /\.jsx["']/
  ];
  const violations = [];

  for (const file of pureFiles) {
    const source = await readText(file);
    if (forbiddenPatterns.some((pattern) => pattern.test(source))) {
      violations.push(file);
    }
  }

  assert.deepEqual(violations, []);
});
