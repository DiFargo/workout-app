import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

async function readText(path) {
  return fs.readFile(path, "utf8");
}

async function readCssWithImports(entryPath, seen = new Set()) {
  const normalizedEntry = path.normalize(entryPath);
  assert.equal(seen.has(normalizedEntry), false, `CSS import cycle detected at ${normalizedEntry}`);

  const source = await readText(normalizedEntry);
  const importPattern = /@import\s+["']([^"']+\.css)["'][^;]*;/g;
  const chunks = [];
  let cursor = 0;

  seen.add(normalizedEntry);

  for (const match of source.matchAll(importPattern)) {
    chunks.push(source.slice(cursor, match.index));

    const resolved = path.normalize(path.join(path.dirname(normalizedEntry), match[1]));
    assert.equal(await pathExists(resolved), true, `Missing CSS import ${match[1]} from ${normalizedEntry}`);
    chunks.push(await readCssWithImports(resolved, seen));

    cursor = match.index + match[0].length;
  }

  chunks.push(source.slice(cursor));
  seen.delete(normalizedEntry);

  return chunks.join("\n");
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
  return [...source.matchAll(/@import\s+["']([^"']+)["'][^;]*;/g)].map((match) => match[1]);
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
  const nutritionAiPlanLazyCss = await readCssWithImports("src/styles/nutrition-ai-plan-lazy.css");
  const nutritionFoodIconLazyCss = await readText("src/styles/nutrition-food-icon-lazy.css");
  const clientFirstSetupLazyCss = await readText("src/styles/client-first-setup-lazy.css");
  const clientMeasurementsLazyCss = await readText("src/styles/client-measurements-lazy.css");
  const clientProfileLazyCss = await readText("src/styles/client-profile-lazy.css");
  const appSource = await readText("src/App.jsx");
  const appCore = await readText("src/AppCore.jsx");
  const appRouter = await readText("src/app/AppRouter.jsx");
  const appRouteLoaders = await readText("src/app/appRouteLoaders.js");
  const appStartupGate = await readText("src/app/appStartupGate.jsx");
  const appTerminalRoutes = await readText("src/app/appTerminalRoutes.jsx");
  const appTerminalRoute = await readText("src/app/AppTerminalRoute.jsx");
  const appTerminalRouteLoaders = await readText("src/app/appTerminalRouteLoaders.js");
  const trainerWorkspace = await readText("src/components/trainer/TrainerWorkspace.jsx");
  const adminPanelHub = await readText("src/components/admin/AdminPanelHub.jsx");
  const adminE2EHarness = await readText("src/components/admin/AdminE2EHarness.jsx");
  const trainerLazyCss = await readText("src/styles/trainer-lazy.css");
  const adminLazyCss = await readText("src/styles/admin-lazy.css");
  const adminInternalsLazyCss = await readText("src/styles/admin-internals-lazy.css");

  assert.equal(await pathExists("src/styles.css"), false);
  assert.match(main, /['"]\.\/styles\/index\.css['"]/);
  assert.doesNotMatch(main, /['"]\.\/styles\.css['"]/);
  assert.doesNotMatch(appSource, /styles\.css/);
  assert.doesNotMatch(indexCss, /legacy-ai-nutrition-workout-readiness\.css/);
  assert.match(appCore, /['"]\.\/styles\/client-workout-lazy\.css['"]/);
  assert.match(appCore, /['"]\.\/styles\/nutrition-stack\.css['"]/);
  assert.doesNotMatch(appCore, /ai-coach-lazy\.css/);
  assert.match(nutritionStackCss, /@import "\.\/nutrition-ai-plan-lazy\.css"/);
  assert.match(nutritionStackCss, /@import "\.\/nutrition-food-icon-lazy\.css"/);
  assert.doesNotMatch(nutritionAiPlanLazyCss, /\.nutritionAiPlanDashboard/);
  assert.match(nutritionAiPlanLazyCss, /\.nutritionAiHistoryPlanCard/);
  assert.doesNotMatch(nutritionFoodIconLazyCss, /\.foodEditIconManualBox/);
  assert.match(nutritionFoodIconLazyCss, /\.nutritionCaloriesRenderCard\.trainingDay/);
  assert.doesNotMatch(indexCss, /\.aiCoachPage/);
  assert.doesNotMatch(indexCss, /\.aiNutritionPlanShell/);
  assert.doesNotMatch(indexCss, /\.nutritionAiPlanDashboard/);
  assert.doesNotMatch(indexCss, /\.foodEditIconManualBox/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/workouts\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/workoutFlow\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/client-workout-flow\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/workout-flow-layout\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/workout-exercise-notes\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/workout-navigation-close\.css"/);
  assert.doesNotMatch(clientWorkoutLazyCss, /@import "\.\/client-workout-set-rows\.css"/);
  assert.equal(await pathExists("src/styles/client-workout-set-rows.css"), false);
  assert.doesNotMatch(clientWorkoutLazyCss, /client-workout-dialogs-lazy\.css/);
  for (const nutritionLazyImport of [
    "./nutrition-food-products-summary.css",
    "./nutrition-food-editor-workout-close.css",
    "./warm-light-food-edit-back-buttons.css",
    "./warm-light-add-food-search.css",
    "./client-food-search.css",
    "./nutrition-orbit.css",
    "./nutrition-flow.css"
  ]) {
    assert.match(nutritionStackCss, new RegExp(`@import "${nutritionLazyImport.replace(".", "\\.")}"`));
  }
  assert.doesNotMatch(nutritionStackCss, /nutrition-photo-not-found\.css/);
  assert.equal(await pathExists("src/styles/nutrition-photo-not-found.css"), false);
  assert.match(appRouteLoaders, /['"]\.\.\/styles\/client-workout-lazy\.css['"]/);
  for (const workoutRouteLoader of [
    "loadBasicWorkoutQuizPage",
    "loadWorkoutHistoryPage",
    "loadWorkoutListPage",
    "loadWorkoutModePage",
    "loadWorkoutPlanPage"
  ]) {
    assert.match(appRouteLoaders, new RegExp(`const ${workoutRouteLoader} = \\(\\) => Promise\\.all\\(\\[[\\s\\S]*?loadWorkoutStyles\\(\\)`));
  }
  assert.doesNotMatch(appRouteLoaders, /ai-coach-lazy\.css/);
  assert.match(appRouteLoaders, /loadAiCoachPage = \(\) => import\("\.\.\/features\/client\/ai\/AiCoachPage"\)/);
  assert.match(appRouteLoaders, /['"]\.\.\/styles\/client-measurements-lazy\.css['"]/);
  assert.match(appStartupGate, /['"]\.\.\/styles\/client-first-setup-lazy\.css['"]/);
  for (const firstSetupLazyImport of [
    "./profile-first-setup-core.css",
    "./client-questionnaire-sliders.css"
  ]) {
    assert.match(clientFirstSetupLazyCss, new RegExp(`@import "${firstSetupLazyImport.replace(".", "\\.")}"`));
    assert.doesNotMatch(indexCss, new RegExp(`@import "${firstSetupLazyImport.replace(".", "\\.")}"`));
  }
  assert.match(appTerminalRouteLoaders, /['"]\.\.\/styles\/client-workout-lazy\.css['"]/);
  assert.match(appTerminalRoute, /['"]\.\.\/styles\/client-profile-lazy\.css['"]/);
  assert.match(clientProfileLazyCss, /@import "\.\/client-measurements-lazy\.css"/);
  for (const measurementLazyImport of [
    "./client-measurements.css"
  ]) {
    assert.match(clientMeasurementsLazyCss, new RegExp(`@import "${measurementLazyImport.replace(".", "\\.")}"`));
    assert.doesNotMatch(indexCss, new RegExp(`@import "${measurementLazyImport.replace(".", "\\.")}"`));
  }
  assert.doesNotMatch(clientMeasurementsLazyCss, /client-measurement-review\.css/);
  assert.equal(await pathExists("src/styles/client-measurement-review.css"), false);
  for (const profileLazyImport of [
    "./profile-dashboard-telegram.css",
    "./client-history-ai-search.css",
    "./profile-nutrition.css",
    "./profile-progress.css",
    "./client-cabinet-desktop.css"
  ]) {
    assert.match(clientProfileLazyCss, new RegExp(`@import "${profileLazyImport.replace(".", "\\.")}"`));
    assert.doesNotMatch(indexCss, new RegExp(`@import "${profileLazyImport.replace(".", "\\.")}"`));
  }
  assert.match(trainerWorkspace, /['"]\.\/TrainerWorkspace\.module\.css['"]/);
  assert.doesNotMatch(trainerWorkspace, /styles\/trainer-lazy\.css/);
  assert.match(adminPanelHub, /['"]\.\.\/\.\.\/styles\/admin-lazy\.css['"]/);
  assert.match(adminE2EHarness, /['"]\.\.\/\.\.\/styles\/admin-internals-lazy\.css['"]/);
  assert.match(adminLazyCss, /@import "\.\/adminPanelHub\.css"/);

  for (const adminHeavyImport of [
    "./admin-shell-crm.css",
    "./admin-program-editor.css",
    "./trainer-month-program-editor.css",
    "./trainer-exercise-weight-mode.css",
    "./admin-client-page.css",
    "./admin-dashboard-bars.css",
    "./admin-programs-dashboard.css",
    "./admin-client-dashboard.css",
    "./admin-calendar-reminders.css",
    "./trainer-desktop-adaptation.css",
    "./trainer-program-editor.css",
    "./nutrition-trainer-desktop.css"
  ]) {
    const escapedImport = adminHeavyImport.replace(".", "\\.");
    assert.doesNotMatch(adminLazyCss, new RegExp(`@import "${escapedImport}"`));
    assert.match(adminInternalsLazyCss, new RegExp(`@import "${escapedImport}"`));
    assert.match(trainerLazyCss, new RegExp(`@import "${escapedImport}"`));
  }

  for (const requiredImport of [
    "./tokens.css",
    "./theme.css",
    "./base.css",
    "./app.css",
    "./menu.css",
    "./splash.css",
    "./auth.css",
    "./compatibility.css",
    "./client-screen-alignment.css"
  ]) {
    assert.match(indexCss, new RegExp(`@import "${requiredImport.replace(".", "\\.")}"`));
  }

  for (const deferredImport of [
    "./trainer.css",
    "./admin.css",
    "./themes.css",
    "./layout.css",
    "./components.css",
    "./legacy-stack.css",
    "./legacy-stack-foundation.css",
    "./legacy-stack-workflows.css",
    "./legacy-stack-final-polish.css",
    "./ai-coach-lazy.css",
    "./nutrition-ai-plan-lazy.css",
    "./nutrition-food-icon-lazy.css",
    "./client-first-setup-lazy.css",
    "./client-measurements-lazy.css",
    "./client-profile-lazy.css",
    "./nutrition-stack.css",
    "./legacy-admin-stack.css",
    "./trainer-desktop-adaptation.css",
    "./trainer-program-editor.css",
    "./trainer-light-workspace.css",
    "./trainer-light-audit.css",
    "./nutrition-trainer-desktop.css",
    "./workouts.css",
    "./client-workout-flow.css",
    "./workoutFlow.css",
    "./trainer-exercise-weight-mode.css",
    "./workout-flow-layout.css",
    "./workout-exercise-notes.css",
    "./workout-navigation-close.css",
    "./client-workout-set-rows.css",
    "./client-workout-dialogs-lazy.css",
    "./nutrition-dark-food-flow.css",
    "./nutrition-food-products-summary.css",
    "./nutrition-food-editor-workout-close.css",
    "./warm-light-food-edit-back-buttons.css",
    "./warm-light-add-food-search.css",
    "./client-food-search.css",
    "./nutrition-photo-not-found.css",
    "./nutrition-orbit.css",
    "./nutrition-flow.css"
  ]) {
    assert.doesNotMatch(indexCss, new RegExp(`@import "${deferredImport.replace(".", "\\.")}"`));
  }

  const allSourceFiles = await collectFiles("src", [".js", ".jsx"]);
  const allowedCssImportFiles = new Set([
    path.normalize("src/main.jsx"),
    path.normalize("src/app/cssVariant.js"),
    path.normalize("src/AppCore.jsx"),
    path.normalize("src/app/AppRouter.jsx"),
    path.normalize("src/app/AppTerminalRoute.jsx"),
    path.normalize("src/app/appRouteLoaders.js"),
    path.normalize("src/app/appStartupGate.jsx"),
    path.normalize("src/app/appTerminalRoutes.jsx"),
    path.normalize("src/app/appTerminalRouteLoaders.js"),
    path.normalize("src/components/trainer/TrainerWorkspace.jsx"),
    path.normalize("src/features/trainer/TrainerProgramOverviewPage.jsx"),
    path.normalize("src/components/admin/AdminPanelHub.jsx"),
    path.normalize("src/components/admin/AdminE2EHarness.jsx")
  ]);

  for (const file of allSourceFiles) {
    const source = await readText(file);
    if (!/\.css['"]/.test(source)) continue;

    const cssImports = collectModuleImports(source).filter((importSource) => importSource.endsWith(".css"));
    const nonModuleImports = cssImports.filter((importSource) => !importSource.endsWith(".module.css"));

    for (const moduleImport of cssImports.filter((importSource) => importSource.endsWith(".module.css"))) {
      const resolvedModule = resolveRelativeImport(file, moduleImport);
      assert.ok(resolvedModule, `CSS Module imports must be relative: ${moduleImport} from ${file}`);
      assert.equal(
        path.dirname(resolvedModule),
        path.dirname(path.normalize(file)),
        `CSS Module must be colocated with its component: ${moduleImport} from ${file}`
      );
      assert.equal(await pathExists(resolvedModule), true, `Missing CSS Module ${moduleImport} from ${file}`);
      assert.doesNotMatch(await readText(resolvedModule), /!important/, `CSS Module cannot use !important: ${resolvedModule}`);
    }

    if (nonModuleImports.length === 0) continue;
    assert.ok(
      allowedCssImportFiles.has(path.normalize(file)),
      `Unexpected global CSS import outside approved entrypoints: ${file}`
    );
  }
});

test("client loading fallback CSS keeps warm-light panel and spinner shells grouped", async () => {
  const source = await readText("src/styles/client-loading-fallback.css");

  assert.equal(
    (source.match(/\.clientRouteFallbackPanel,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientRouteFallbackPanel\s*\{\s*width:\s*64px;\s*height:\s*64px;\s*border:\s*1px solid rgba\(219, 223, 235, 0\.95\);\s*border-radius:\s*22px;\s*display:\s*grid;\s*place-items:\s*center;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientRouteFallbackSpinner,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientRouteFallbackSpinner\s*\{\s*width:\s*26px;\s*height:\s*26px;\s*border:\s*3px solid rgba\(109, 77, 248, 0\.16\);\s*border-top-color:\s*#6f55f2;\s*border-radius:\s*999px;\s*animation:\s*clientRouteFallbackSpin 0\.78s linear infinite;\s*\}/g) || []).length,
    1
  );
  assert.equal((source.match(/box-shadow:\s*0 18px 42px rgba\(33, 41, 66, 0\.12\);/g) || []).length, 1);
  assert.equal((source.match(/animation:\s*clientRouteFallbackSpin 0\.78s linear infinite;/g) || []).length, 1);
});

test("AI coach owns colocated scoped styles without legacy selector owners", async () => {
  const component = await readText("src/features/client/ai/AiCoachPage.jsx");
  const moduleCss = await readText("src/features/client/ai/AiCoachPage.module.css");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyStyles = (await Promise.all(legacyFiles.map((file) => readText(file)))).join("\n");
  const legacySelectors = /aiCoach(?:Page|BackBtn|Hero|Badge|ResultCard|ResultTop|Meter|Blocks|MiniBlock|Grid|FeatureCard)|aiNutrition(?:PlanShell|OnboardingCard|PlanCardFull|OnboardingHead|PlanHero|PlanInsight|TwoCol|ImproveBox|GoalPicker|PrimaryBtn|PlanActions|TodayMacros|BadgesRow|WeeksGrid|AdaptBtn|AdaptResult|TrainingDaysPicker|TrainingDaysHead|TrainingDaysGrid|TrainingDayInfo|BodyReadOnlyCard|BodyReadOnlyHead|BodyReadOnlyGrid|ProfileLinkBtn|SexPicker)/;

  assert.match(component, /import styles from "\.\/AiCoachPage\.module\.css"/);
  assert.match(component, /className=\{styles\.root\}[\s\S]*data-css-module-scope="ai-coach-page"/);
  for (const testId of [
    "ai-coach-page",
    "ai-coach-back",
    "ai-coach-hero",
    "ai-coach-result",
    "ai-coach-features",
    "ai-nutrition-plan-shell",
    "ai-nutrition-onboarding",
    "ai-nutrition-plan"
  ]) {
    assert.match(component, new RegExp(`data-testid="${testId}"`));
  }
  assert.doesNotMatch(component, legacySelectors);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.weeksGrid,\s*\.twoColumn\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(moduleCss, /@media \(max-width: 430px\)/);
  assert.match(moduleCss, /@media \(max-width: 380px\)/);
  assert.match(variables, /--background-ai-coach-page:/);
  assert.match(variables, /--color-ai-coach-heading:/);
  assert.doesNotMatch(legacyStyles, legacySelectors);
  assert.equal(await pathExists("src/styles/ai-coach-lazy.css"), false);
});

test("legacy registration CSS keeps first setup active choices grouped", async () => {
  const source = await readCssWithImports("src/styles/registration-accessibility.css");

  assert.equal(
    (
      source.match(
        /\.firstSetupSexGrid button\.active,\s*\.firstSetupGoalGrid button\.active\s*\{\s*border-color:\s*#6b55e6 !important;\s*background:\s*#f6f4ff !important;\s*box-shadow:\s*inset 0 0 0 1px #6b55e6 !important;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (source.match(/border-color:\s*#6b55e6 !important;\s*background:\s*#f6f4ff !important;\s*box-shadow:\s*inset 0 0 0 1px #6b55e6 !important;/g) || []).length,
    1
  );
});

test("workout picker and profile history dialogs own scoped modules without legacy selectors", async () => {
  const workoutDialogs = await readText("src/features/client/workouts/WorkoutListDialogs.jsx");
  const workoutDialogsCss = await readText("src/features/client/workouts/WorkoutListDialogs.module.css");
  const profileHistory = await readText("src/features/client/profile/ProfileWorkoutHistoryModal.jsx");
  const profileHistoryCss = await readText("src/features/client/profile/ProfileWorkoutHistoryModal.module.css");
  const profileJournal = await readText("src/features/client/profile/ProfileWorkoutJournalModal.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldSelector = /\.(?:workoutModeModalOverlay|workoutModeModal|workoutModeModalHeader|workoutModeModalOptions|workoutModeModalRemember|workoutHistoryModal|workoutHistoryModalList|workoutHistoryModalItem|workoutHistoryModalAll|cabinetWorkoutHistoryItem|cabinetWorkoutHistoryDetails|cabinetWorkoutHistoryExercise|cabinetWorkoutHistoryExerciseHead|cabinetWorkoutHistorySets|cabinetWorkoutHistoryDelete)(?![\w-])/;

  assert.match(workoutDialogs, /import styles from "\.\/WorkoutListDialogs\.module\.css";/);
  assert.match(workoutDialogs, /data-css-module-scope="workout-list-dialogs"/);
  assert.match(workoutDialogs, /data-testid="workout-mode-option"/);
  assert.match(workoutDialogs, /data-testid="workout-history-dialog"/);
  assert.doesNotMatch(workoutDialogs, oldSelector);
  assert.doesNotMatch(workoutDialogsCss, /!important/);
  assert.match(workoutDialogsCss, /\.dialog\s*\{[\s\S]*?width:\s*min\(100%, 350px\);/);
  assert.match(workoutDialogsCss, /\.historyDialog\s*\{[\s\S]*?max-height:\s*min\(680px, calc\(100dvh - 28px\)\);/);
  assert.match(workoutDialogsCss, /var\(--background-workout-list-dialog-overlay\)/);

  assert.match(profileHistory, /import styles from "\.\/ProfileWorkoutHistoryModal\.module\.css";/);
  assert.match(profileHistory, /data-css-module-scope="profile-workout-history"/);
  assert.match(profileHistory, /data-testid="profile-workout-history-delete"/);
  assert.doesNotMatch(profileHistory, oldSelector);
  assert.doesNotMatch(profileHistoryCss, /!important/);
  assert.match(profileHistoryCss, /\.embeddedList\s*\{[\s\S]*?padding-right:\s*1px;/);
  assert.match(profileHistoryCss, /\.set\s*\{[\s\S]*?grid-template-columns:\s*20px minmax\(0, 1fr\) auto;/);
  assert.match(profileJournal, /<ProfileWorkoutHistoryContent embedded \{\.\.\.historyProps\} \/>/);

  assert.match(variables, /--background-workout-list-dialog-overlay:/);
  assert.match(variables, /--background-workout-history-set:/);
  assert.doesNotMatch(legacyCss, oldSelector);

  for (const removedFile of [
    "src/styles/registration-accessibility-workout-history-mode-modal-v308.css",
    "src/styles/registration-accessibility-workout-history-mode-modal-warm-light-v309.css",
    "src/styles/registration-accessibility-workout-history-modal-list-v310.css",
    "src/styles/registration-accessibility-workout-history-cabinet-item-v311.css",
    "src/styles/registration-accessibility-workout-history-cabinet-details-v312.css",
    "src/styles/registration-accessibility-workout-history-cabinet-warm-light-v313.css",
    "src/styles/client-workout-card-render.css",
    "src/styles/client-workout-card-render-final-lock.css"
  ]) {
    assert.equal(await pathExists(removedFile), false, `${removedFile} must stay removed`);
  }
});

test("profile workout calendar owns a colocated module and excludes dead standalone modals", async () => {
  const calendar = await readText("src/features/client/profile/ProfileWorkoutCalendarModal.jsx");
  const calendarCss = await readText("src/features/client/profile/ProfileWorkoutCalendarModal.module.css");
  const history = await readText("src/features/client/profile/ProfileWorkoutHistoryModal.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldCalendarSelector = /\.cabinetWorkoutCalendar(?:Nav|Planner|Weekdays|Grid|Legend|EditActions|Status|Day)?(?![\w-])/;

  assert.match(calendar, /import styles from "\.\/ProfileWorkoutCalendarModal\.module\.css";/);
  assert.match(calendar, /data-css-module-scope="profile-workout-calendar"/);
  assert.match(calendar, /styles\[visualStatus\]/);
  assert.doesNotMatch(calendar, oldCalendarSelector);
  assert.doesNotMatch(calendar, /export default function ProfileWorkoutCalendarModal/);
  assert.doesNotMatch(history, /export default function ProfileWorkoutHistoryModal/);
  assert.doesNotMatch(calendarCss, /!important/);
  assert.match(calendarCss, /\.grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\);/);
  assert.match(calendarCss, /\.dayButton\.completed,[\s\S]*?\.dayButton\.historyCompleted/);
  assert.match(calendarCss, /var\(--color-workout-calendar-shell-border\)/);
  assert.match(variables, /--background-workout-calendar-shell:/);
  assert.match(variables, /--color-workout-calendar-details-heading:/);
  assert.doesNotMatch(legacyCss, oldCalendarSelector);
  assert.doesNotMatch(legacyCss, /\.cabinetProgressModal(?![\w-])/);

  for (const removedFile of [
    "src/styles/cabinet-calendar-insights-calendar.css",
    "src/styles/cabinet-calendar-insights-calendar-modal-v290.css",
    "src/styles/cabinet-calendar-insights-calendar-shell-v291.css",
    "src/styles/cabinet-calendar-insights-calendar-grid-v292.css",
    "src/styles/cabinet-calendar-insights-calendar-actions-v293.css",
    "src/styles/cabinet-calendar-insights-calendar-day-detail-v294.css",
    "src/styles/cabinet-calendar-insights-warm-light.css"
  ]) {
    assert.equal(await pathExists(removedFile), false, `${removedFile} must stay removed`);
  }
});

test("profile workout journal owns its live modal shell in a colocated module", async () => {
  const journal = await readText("src/features/client/profile/ProfileWorkoutJournalModal.jsx");
  const journalCss = await readText("src/features/client/profile/ProfileWorkoutJournalModal.module.css");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldJournalSelector = /\.(?:cabinetWorkoutJournalModal|cabinetWorkoutJournalHead|cabinetWorkoutJournalTabs|cabinetWorkoutJournalBody|cabinetWorkoutJournalHistoryPanel)(?![\w-])/;

  assert.match(journal, /import styles from "\.\/ProfileWorkoutJournalModal\.module\.css";/);
  assert.match(journal, /data-css-module-scope="profile-workout-journal"/);
  assert.match(journal, /data-testid="profile-workout-journal-dialog"/);
  assert.match(journal, /data-testid="profile-workout-journal-close"/);
  assert.doesNotMatch(journal, oldJournalSelector);
  assert.doesNotMatch(journalCss, /!important/);
  assert.match(journalCss, /\.dialog\s*\{[\s\S]*?grid-template-rows:\s*48px 48px minmax\(0, 1fr\);/);
  assert.match(journalCss, /@media \(max-height: 720px\)[\s\S]*?grid-template-rows:\s*42px 46px minmax\(0, 1fr\);/);
  assert.match(journalCss, /var\(--background-profile-modal-overlay\)/);
  assert.match(variables, /--background-profile-modal:/);
  assert.match(variables, /--shadow-workout-journal-tab-active:/);
  assert.doesNotMatch(legacyCss, oldJournalSelector);
});

test("profile feedback modal owns its live styles without legacy selector branches", async () => {
  const feedback = await readText("src/features/client/profile/ProfileFeedbackModal.jsx");
  const feedbackCss = await readText("src/features/client/profile/ProfileFeedbackModal.module.css");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldFeedbackSelector = /\.(?:profileFeedbackOverlay|profileFeedbackModal|profileFeedbackHead|profileFeedbackBody|profileFeedbackTypeGrid|profileFeedbackField|profileFeedbackAttachment|profileFeedbackAttachmentFile|profileFeedbackStatus|profileFeedbackSubmit)(?![\w-])/;

  assert.match(feedback, /import styles from "\.\/ProfileFeedbackModal\.module\.css";/);
  assert.match(feedback, /data-css-module-scope="profile-feedback"/);
  assert.match(feedback, /data-testid="profile-feedback-dialog"/);
  assert.match(feedback, /data-testid="profile-feedback-type"/);
  assert.doesNotMatch(feedback, oldFeedbackSelector);
  assert.doesNotMatch(feedback, /className="[^\"]*compact/);
  assert.doesNotMatch(feedbackCss, /!important/);
  assert.match(feedbackCss, /\.dialog\s*\{[\s\S]*?grid-template-rows:\s*48px minmax\(0, 1fr\) 54px;/);
  assert.match(feedbackCss, /\.typeGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr;/);
  assert.match(feedbackCss, /@media \(max-height: 720px\)[\s\S]*?grid-template-rows:\s*42px minmax\(0, 1fr\);/);
  assert.match(feedbackCss, /var\(--color-profile-feedback-field-border\)/);
  assert.match(variables, /--background-profile-modal-overlay:/);
  assert.match(variables, /--background-profile-feedback-type-active:/);
  assert.doesNotMatch(legacyCss, oldFeedbackSelector);
});

test("profile settings modal owns all live shell variants without cabinet utility selectors", async () => {
  const settings = await readText("src/features/client/profile/ProfileSettingsModal.jsx");
  const settingsCss = await readText("src/features/client/profile/ProfileSettingsModal.module.css");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldSettingsSelector = /\.(?:cabinetUtilityModalOverlay|cabinetUtilityModalHead|cabinetUtilityModalBody|cabinetUtilityModal|cabinetSettingsModal)(?![\w-])/;

  assert.match(settings, /import styles from "\.\/ProfileSettingsModal\.module\.css";/);
  assert.match(settings, /data-css-module-scope="profile-settings"/);
  assert.match(settings, /data-profile-settings-section=\{section\}/);
  assert.match(settings, /data-testid="profile-settings-close"/);
  assert.doesNotMatch(settings, oldSettingsSelector);
  assert.doesNotMatch(settingsCss, /!important/);
  assert.match(settingsCss, /\.accountCompact\s*\{[\s\S]*?grid-template-rows:\s*44px minmax\(0, 1fr\);/);
  assert.match(settingsCss, /\.profileCompact\s*\{[\s\S]*?grid-template-rows:\s*42px minmax\(0, 1fr\);/);
  assert.match(settingsCss, /@media \(max-height: 720px\)/);
  assert.match(settingsCss, /var\(--color-profile-modal-border\)/);
  assert.match(variables, /--color-profile-settings-control-active-border:/);
  assert.doesNotMatch(legacyCss, oldSettingsSelector);
  assert.equal(await pathExists("src/styles/theme-light-nested-screens-cabinet-profile.css"), false);
});

test("profile app settings section owns modal, account, and tab variants", async () => {
  const component = await readText("src/features/client/profile/ProfileAppSettingsSection.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileAppSettingsSection.module.css");
  const settingsModalCss = await readText("src/features/client/profile/ProfileSettingsModal.module.css");
  const settingsTab = await readText("src/features/client/profile/ProfileSettingsTab.jsx");
  const dashboard = await readText("src/features/client/profile/ProfileDashboardRoute.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldAppSelector = /\.(?:profileAppSettingsSection|profileSettingsActions|profileSettingsEmailItem|profileSettingsTelegramItem|profileSettingsTelegramAvatar|profileSettingsEmailAvatar|profileSettingsTelegramText|profileThemeSwitchBtn|profileThemeIcon|profileThemeText|profileThemeToggle)(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileAppSettingsSection\.module\.css";/);
  assert.match(component, /data-profile-app-settings-variant=\{variant\}/);
  assert.match(component, /data-testid="profile-settings-theme"/);
  assert.match(component, /data-testid="profile-settings-telegram"/);
  assert.match(settingsTab, /variant="tab"/);
  assert.match(dashboard, /variant="account"/);
  assert.match(dashboard, /variant="modal"/);
  assert.doesNotMatch(component, oldAppSelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.account\s*\{[\s\S]*?border-radius:\s*16px;/);
  assert.match(moduleCss, /\.tab\s*\{[\s\S]*?width:\s*calc\(100% - 28px\);/);
  assert.match(moduleCss, /@media \(max-width: 370px\)/);
  assert.match(moduleCss, /var\(--background-profile-app-item\)/);
  assert.match(variables, /--background-profile-app-item-connected:/);
  assert.doesNotMatch(settingsModalCss, oldAppSelector);
  assert.doesNotMatch(legacyCss, oldAppSelector);
});

test("profile body metrics settings owns modal and tab variants without dead workout-mode CSS", async () => {
  const component = await readText("src/features/client/profile/ProfileBodyMetricsSettingsSection.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileBodyMetricsSettingsSection.module.css");
  const settingsModalCss = await readText("src/features/client/profile/ProfileSettingsModal.module.css");
  const settingsTab = await readText("src/features/client/profile/ProfileSettingsTab.jsx");
  const dashboard = await readText("src/features/client/profile/ProfileDashboardRoute.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldBodySelector = /\.(?:profileBodyMetricsSettingsSection|profileBodyMetricsAccordion|profileBodyMetricsGrid|profileBodyMetricsGridTwo|profileSexPicker|profileBodySaveBtn|profileAccordionHead)(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileBodyMetricsSettingsSection\.module\.css";/);
  assert.match(component, /data-profile-body-metrics-variant=\{variant\}/);
  assert.match(component, /data-testid="profile-body-metrics-toggle"/);
  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /data-testid="profile-body-metrics-save"/);
  assert.match(settingsTab, /variant="tab"/);
  assert.match(dashboard, /variant="modal"/);
  assert.doesNotMatch(settingsTab, /activeGoalLabel|ageInputClassName/);
  assert.doesNotMatch(component, /unit:/);
  assert.doesNotMatch(component, oldBodySelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.gridTwo\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(moduleCss, /\.modal \.head\s*\{[\s\S]*?min-height:\s*66px;/);
  assert.match(moduleCss, /\.tab\s*\{[\s\S]*?width:\s*calc\(100% - 28px\);/);
  assert.match(moduleCss, /@media \(max-width: 420px\)/);
  assert.match(variables, /--background-profile-settings-expand:/);
  assert.doesNotMatch(settingsModalCss, oldBodySelector);
  assert.doesNotMatch(legacyCss, oldBodySelector);
  assert.doesNotMatch(legacyCss, /\.profileWorkoutMode(?:SettingsSection|Toggle|Actions|Card)(?![\w-])/);
  assert.equal(await pathExists("src/styles/trainer-month-program-editor-workout-mode-profile-mobile.css"), false);
});

test("profile account settings owns its live editor styles and local logout action", async () => {
  const component = await readText("src/features/client/profile/ProfileAccountSettingsSection.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileAccountSettingsSection.module.css");
  const settingsModal = await readText("src/features/client/profile/ProfileSettingsModal.jsx");
  const settingsModalCss = await readText("src/features/client/profile/ProfileSettingsModal.module.css");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldAccountSelector = /\.(?:profileAccountSection|profileAccountSummarySection|profileAccountIdentity|profileAccountHeroCard|profileAccountAvatarCenterAction|profileAccountAvatarPreview|profileAccountAvatarCamera|profileAccountHeroNameRow|profileAccountHeroNameEdit|profileAccountQuickPanel|profileAccountDataPanel|profileAccountSecurityPanel|profileAccountQuickRow|profileAccountLoginRow|profileAccountQuickIcon|profileAccountQuickTitle|profileAccountQuickValue|profileAccountQuickEdit|profileAccountQuickButton|profileAccountStatus|profileAccountLogout)(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileAccountSettingsSection\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-account-settings"/);
  assert.match(component, /data-testid="profile-account-avatar"/);
  assert.match(component, /data-testid="profile-account-login-edit"/);
  assert.match(component, /data-testid="profile-account-password"/);
  assert.doesNotMatch(component, oldAccountSelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.quickRow\s*\{[\s\S]*?grid-template-columns:\s*30px minmax\(74px, 0\.85fr\) minmax\(0, 1\.15fr\) 24px;/);
  assert.match(moduleCss, /\.camera\s*\{[\s\S]*?var\(--background-profile-account-camera\)/);
  assert.match(moduleCss, /@media \(max-width: 350px\)/);
  assert.match(settingsModal, /export function ProfileSettingsLogoutButton/);
  assert.match(settingsModal, /data-testid="profile-settings-logout"/);
  assert.match(settingsModalCss, /\.logoutButton\s*\{[\s\S]*?var\(--background-profile-account-logout\)/);
  assert.match(variables, /--background-profile-account-camera:/);
  assert.match(variables, /--color-profile-account-logout:/);
  assert.doesNotMatch(settingsModalCss, oldAccountSelector);
  assert.doesNotMatch(legacyCss, oldAccountSelector);
  assert.equal(await pathExists("src/styles/profile-account-editor-avatar-v295.css"), false);
});

test("profile avatar crop editor owns its visual shell in a colocated module", async () => {
  const component = await readText("src/features/client/profile/ProfileAvatarCropModal.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileAvatarCropModal.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldCropSelector = /\.(?:profileAvatarCropOverlay|profileAvatarCropModal|profileAvatarCropViewport|profileAvatarCropMask|profileAvatarCropZoom|profileAvatarCropActions)(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileAvatarCropModal\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-avatar-crop-modal"/);
  assert.match(component, /data-testid="profile-avatar-crop-dialog"/);
  assert.match(component, /data-testid="profile-avatar-crop-viewport"/);
  assert.match(component, /data-testid="profile-avatar-crop-apply"/);
  assert.match(component, /--profile-avatar-crop-image-width/);
  assert.doesNotMatch(component, /style=\{\{[\s\S]*?\b(?:width|height|transform):/);
  assert.doesNotMatch(component, oldCropSelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.dialog\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 28px\);[\s\S]*?overflow-y:\s*auto;/);
  assert.match(moduleCss, /\.viewport\s*\{[\s\S]*?width:\s*240px;[\s\S]*?touch-action:\s*none;/);
  assert.match(moduleCss, /\.image\s*\{[\s\S]*?transform:\s*var\(--profile-avatar-crop-image-transform\);/);
  assert.match(moduleCss, /\.closeButton\s*\{[\s\S]*?width:\s*36px;[\s\S]*?height:\s*36px;/);
  assert.match(variables, /--background-profile-avatar-crop-overlay:/);
  assert.match(variables, /--background-profile-avatar-crop-dialog:/);
  assert.match(variables, /--shadow-profile-avatar-crop-mask:/);
  assert.match(harness, /harnessPageParam === "avatarCrop"/);
  assert.match(harness, /<ProfileAvatarCropModal/);
  assert.doesNotMatch(legacyCss, oldCropSelector);
  assert.equal(await pathExists("src/styles/profile-account-editor.css"), false);
  assert.equal(await pathExists("src/styles/profile-account-editor-avatar-crop-v298.css"), false);
  assert.equal(await pathExists("src/styles/profile-account-editor-avatar-crop-warm-light-v299.css"), false);
});

test("profile password modal owns its complete shell and removes versioned editor CSS", async () => {
  const component = await readText("src/features/client/profile/ProfilePasswordModal.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfilePasswordModal.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldPasswordSelector = /\.(?:profilePasswordInputWrap|profilePasswordVisibilityButton|profilePasswordManageModal|profilePasswordManageHead|profilePasswordManageAvatar|profilePasswordManageForm|profilePasswordAuthPreview|profilePasswordManageActions)(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfilePasswordModal\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-password-modal"/);
  assert.match(component, /data-testid="profile-password-dialog"/);
  assert.match(component, /data-testid=\{`profile-password-toggle-\$\{field\}`\}/);
  assert.match(component, /data-testid="profile-password-submit"/);
  assert.doesNotMatch(component, oldPasswordSelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.dialog\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 36px\);[\s\S]*?overflow-y:\s*auto;/);
  assert.match(moduleCss, /\.head\s*\{[\s\S]*?grid-template-columns:\s*62px minmax\(0, 1fr\);/);
  assert.match(moduleCss, /\.visibilityButton\s*\{[\s\S]*?width:\s*40px;[\s\S]*?height:\s*40px;/);
  assert.match(moduleCss, /@media \(max-width: 520px\)/);
  assert.match(moduleCss, /var\(--background-profile-credential-dialog\)/);
  assert.match(variables, /--background-profile-credential-overlay:/);
  assert.match(variables, /--color-profile-credential-input-border:/);
  assert.match(harness, /onOpenPassword=\{\(\) => setProfilePasswordModalOpen\(true\)\}/);
  assert.match(harness, /<ProfilePasswordModal/);
  assert.doesNotMatch(legacyCss, oldPasswordSelector);
  assert.equal(await pathExists("src/styles/profile-account-editor-fields-v296.css"), false);
  assert.equal(await pathExists("src/styles/profile-account-editor-warm-light-v297.css"), false);
});

test("profile email modal owns its complete credential shell without shared legacy classes", async () => {
  const component = await readText("src/features/client/profile/ProfileEmailModal.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileEmailModal.module.css");
  const passwordCss = await readText("src/features/client/profile/ProfilePasswordModal.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldEmailSelector = /\.(?:profileEmailManageModal|profileEmailManageHead|profileEmailManageAvatar|profileEmailManageForm|profileEmailAuthPreview)(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileEmailModal\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-email-modal"/);
  assert.match(component, /data-testid="profile-email-dialog"/);
  assert.match(component, /data-testid="profile-email-address"/);
  assert.match(component, /data-testid="profile-email-submit"/);
  assert.doesNotMatch(component, oldEmailSelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.dialog\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 36px\);[\s\S]*?overflow-y:\s*auto;/);
  assert.match(moduleCss, /\.input\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*46px;/);
  assert.match(moduleCss, /var\(--background-profile-credential-dialog\)/);
  assert.match(passwordCss, /var\(--background-profile-credential-dialog\)/);
  assert.match(variables, /--color-profile-credential-input-placeholder:/);
  assert.match(variables, /--opacity-profile-credential-primary-disabled:/);
  assert.match(harness, /onOpenEmail=\{\(\) => setProfileEmailModalOpen\(true\)\}/);
  assert.match(harness, /<ProfileEmailModal/);
  assert.doesNotMatch(legacyCss, oldEmailSelector);
});

test("profile Telegram modal owns connected and login states in one colocated module", async () => {
  const component = await readText("src/features/client/profile/ProfileTelegramModal.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileTelegramModal.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldTelegramSelector = /\.(?:profileTelegramModalOverlay|profileTelegramModal|profileTelegramManageModal|profileTelegramModalClose|profileTelegramManageHead|profileTelegramManageAvatar|profileTelegramManageActions|profileTelegramAuthPreview|profileTelegramAuthIcon|profileTelegramLoginWidgetCard|profileTelegramLoginWidget|profileTelegramWidgetLoading|profileTelegramCheckButton|profileTelegramAuthStatus|profileTelegramSave|profileTelegramBotActions)(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileTelegramModal\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-telegram-modal"/);
  assert.match(component, /data-testid="profile-telegram-dialog"/);
  assert.match(component, /data-testid="profile-telegram-actions"/);
  assert.match(component, /data-testid="profile-telegram-widget-card"/);
  assert.match(component, /data-testid="profile-telegram-check"/);
  assert.doesNotMatch(component, oldTelegramSelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.dialog\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 36px\);[\s\S]*?overflow-y:\s*auto;/);
  assert.match(moduleCss, /\.manageActions\s*\{[\s\S]*?grid-template-columns:\s*1fr 0\.72fr;/);
  assert.match(moduleCss, /\.status\s*\{[\s\S]*?min-height:\s*46px;[\s\S]*?place-items:\s*center;/);
  assert.match(moduleCss, /@media \(max-width: 520px\)[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(moduleCss, /var\(--background-profile-telegram-widget\)/);
  assert.match(variables, /--color-profile-telegram-avatar-border:/);
  assert.match(variables, /--background-profile-telegram-action:/);
  assert.match(variables, /--color-profile-telegram-danger:/);
  assert.match(harness, /clientTelegramState/);
  assert.match(harness, /telegramHarnessConnected/);
  assert.doesNotMatch(legacyCss, oldTelegramSelector);
  assert.equal(await pathExists("src/styles/profile-dashboard-telegram-base-auto-link.css"), false);
  assert.equal(await pathExists("src/styles/profile-dashboard-telegram-base-login-widget.css"), false);
  assert.equal(await pathExists("src/styles/profile-dashboard-telegram-base-login-status.css"), false);
  assert.equal(await pathExists("src/styles/profile-dashboard-telegram-base-settings.css"), false);
});

test("profile trainer notifications own task and empty states in a colocated module", async () => {
  const component = await readText("src/features/client/profile/ProfileTrainerNotificationsModal.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileTrainerNotificationsModal.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldNotificationSelector = /\.(?:profileTrainerNotificationsOverlay|profileTrainerNotificationsModal|profileTrainerNotificationsHead|profileTrainerNotificationsSummary|profileTrainerNotificationsList|profileTrainerNotificationsEmpty|profileTrainerNotificationItem|profileTrainerNotificationActions)(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileTrainerNotificationsModal\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-trainer-notifications"/);
  assert.match(component, /data-testid="profile-trainer-notifications-dialog"/);
  assert.match(component, /data-testid="profile-trainer-notification-item"/);
  assert.match(component, /data-task-status=\{taskStatus\.id\}/);
  assert.match(component, /data-testid="profile-trainer-notifications-empty"/);
  assert.doesNotMatch(component, oldNotificationSelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.dialog\s*\{[\s\S]*?max-height:\s*min\(650px, calc\(100dvh - 32px\)\);[\s\S]*?overflow:\s*hidden;/);
  assert.match(moduleCss, /\.list\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/);
  assert.match(moduleCss, /\.item\s*\{[\s\S]*?grid-template-columns:\s*32px minmax\(0, 1fr\) auto;/);
  assert.match(moduleCss, /@media \(max-width: 380px\)[\s\S]*?grid-template-columns:\s*30px minmax\(0, 1fr\);/);
  assert.match(moduleCss, /var\(--background-profile-trainer-notifications-dialog\)/);
  assert.match(variables, /--background-profile-trainer-notifications-overlay:/);
  assert.match(variables, /--color-profile-trainer-notifications-action:/);
  assert.match(variables, /--color-profile-trainer-notifications-empty-text:/);
  assert.match(harness, /clientNotificationState/);
  assert.match(harness, /visibleHarnessTrainerTasks/);
  assert.doesNotMatch(legacyCss, oldNotificationSelector);
});

test("profile progress photos own base, tabbed and comparison states in a colocated module", async () => {
  const component = await readText("src/features/client/profile/ProfileProgressPhotosModal.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileProgressPhotosModal.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldProgressPhotosSelector = /\.(?:cabinetProgressPhotos(?:Overlay|Modal|Head|Body|Intro|Latest|Compare|CompareHead|CompareContent|CompareControls|CompareTabs|CompareStage|CompareMissing|Save)|cabinetProgressPhoto(?:Steps|Status))(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileProgressPhotosModal\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-progress-photos"/);
  assert.match(component, /data-testid="profile-progress-photos-dialog"/);
  assert.match(component, /data-testid="profile-progress-photo-step"/);
  assert.match(component, /data-testid="profile-progress-photos-compare-toggle"/);
  assert.match(component, /data-testid="profile-progress-photos-save"/);
  assert.doesNotMatch(component, oldProgressPhotosSelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.dialog\s*\{[\s\S]*?max-height:\s*min\(820px, calc\(100dvh - 24px\)\);[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/);
  assert.match(moduleCss, /\.bodyControlDialog\s*\{[\s\S]*?height:\s*min\(820px, calc\(100dvh - 24px\)\);[\s\S]*?grid-template-rows:\s*auto 48px minmax\(0, 1fr\) auto;/);
  assert.match(moduleCss, /\.compare:not\(\[open\]\) > \.compareContent\s*\{\s*display:\s*none;/);
  assert.match(moduleCss, /@media \(max-height: 800px\)[\s\S]*?\.dialog:not\(\.bodyControlDialog\)/);
  assert.match(moduleCss, /var\(--background-profile-progress-photos-dialog\)/);
  assert.match(variables, /--background-profile-progress-photos-overlay:/);
  assert.match(variables, /--color-profile-progress-photos-section-tab-active:/);
  assert.match(variables, /--color-profile-progress-photos-compare-date:/);
  assert.match(harness, /clientPhotosTabbed/);
  assert.match(harness, /clientPhotosState/);
  assert.doesNotMatch(legacyCss, oldProgressPhotosSelector);
  assert.equal(await pathExists("src/styles/client-cabinet-overview-mobile-height-800.css"), false);
});

test("profile measurements modal owns list, empty and body-control states in a colocated module", async () => {
  const component = await readText("src/features/client/profile/ProfileMeasurementsModal.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileMeasurementsModal.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldMeasurementsSelector = /\.(?:cabinetMeasurementModal(?:Overlay|Head|Summary|Grid|Empty|Start)?|cabinetBodyControl(?:Modal|Tabs))(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileMeasurementsModal\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-measurements-modal"/);
  assert.match(component, /data-testid="profile-measurements-dialog"/);
  assert.match(component, /data-testid="profile-measurements-cell"/);
  assert.match(component, /data-testid="profile-measurements-empty"/);
  assert.match(component, /data-testid="profile-measurements-start"/);
  assert.doesNotMatch(component, oldMeasurementsSelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.dialog\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 32px\);[\s\S]*?overflow-y:\s*auto;/);
  assert.match(moduleCss, /\.bodyControlDialog\s*\{[\s\S]*?height:\s*min\(820px, calc\(100dvh - 24px\)\);[\s\S]*?grid-template-rows:\s*auto 48px auto minmax\(0, 1fr\) auto;/);
  assert.match(moduleCss, /@media \(max-height: 720px\)[\s\S]*?\.dialog:not\(\.bodyControlDialog\)/);
  assert.match(moduleCss, /\.bodyControlDialog \.grid\s*\{[\s\S]*?grid-auto-rows:\s*minmax\(58px, auto\);/);
  assert.match(moduleCss, /var\(--background-profile-measurements-dialog\)/);
  assert.match(variables, /--background-profile-measurements-overlay:/);
  assert.match(variables, /--color-profile-measurements-tab-active:/);
  assert.match(variables, /--background-profile-measurements-cell:/);
  assert.match(harness, /clientMeasurementsTabbed/);
  assert.match(harness, /clientMeasurementsState/);
  assert.doesNotMatch(legacyCss, oldMeasurementsSelector);
  assert.equal(await pathExists("src/styles/theme-light-nested-screens-measurements-modal.css"), false);
});

test("measurement summary and fullscreen wizard own only live styles in colocated modules", async () => {
  const panel = await readText("src/features/client/profile/ProfileMeasurementWizardPanel.jsx");
  const panelCss = await readText("src/features/client/profile/ProfileMeasurementWizardPanel.module.css");
  const wizard = await readText("src/features/client/measurements/MeasurementWizardPage.jsx");
  const wizardCss = await readText("src/features/client/measurements/MeasurementWizardPage.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const variables = await readText("src/styles/_variables.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldWizardSelector = /\.(?:measurementFullscreen|measurementIntro|profileMeasurement)[\w-]*/;

  assert.match(panel, /import styles from "\.\/ProfileMeasurementWizardPanel\.module\.css";/);
  assert.match(panel, /data-css-module-scope="profile-measurement-panel"/);
  assert.match(panel, /data-testid="profile-measurement-panel"/);
  assert.match(panel, /data-testid="profile-measurement-last-value"/);
  assert.match(panel, /data-testid="profile-measurement-start"/);
  assert.doesNotMatch(panel, /onToggle|profileMeasurementWizardCard|measurementIntroImage/);
  assert.doesNotMatch(panelCss, /!important/);
  assert.match(panelCss, /\.lastGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(panelCss, /var\(--background-profile-measurement-panel-item\)/);

  assert.match(wizard, /import styles from "\.\/MeasurementWizardPage\.module\.css";/);
  assert.match(wizard, /data-css-module-scope="measurement-wizard-page"/);
  assert.match(wizard, /data-testid="measurement-wizard-intro"/);
  assert.match(wizard, /data-testid="measurement-wizard-measurement"/);
  assert.match(wizard, /data-testid="measurement-wizard-review"/);
  assert.match(wizard, /data-css-module-control/);
  assert.doesNotMatch(wizardCss, /!important/);
  assert.match(wizardCss, /height:\s*100dvh;/);
  assert.match(wizardCss, /@media \(max-width: 390px\)/);
  assert.match(wizardCss, /var\(--background-measurement-wizard-page\)/);
  assert.match(variables, /--background-profile-measurement-panel:/);
  assert.match(variables, /--background-measurement-wizard-page:/);
  assert.match(variables, /--background-measurement-wizard-next:/);
  assert.match(harness, /clientHarnessPage=measurementWizard|harnessPageParam === "measurementWizard"/);
  assert.match(harness, /harnessPageParam === "measurementPanel"/);
  assert.match(harness, /clientMeasurementStep/);
  assert.doesNotMatch(legacyCss, oldWizardSelector);

  for (const deletedPath of [
    "src/styles/client-measurement-review.css",
    "src/styles/client-measurements-wizard-base.css",
    "src/styles/client-measurements-wizard-card.css",
    "src/styles/client-measurements-wizard-shell.css",
    "src/styles/client-measurements-wizard-review.css",
    "src/styles/theme-light-nested-screens-measurements-wizard.css"
  ]) {
    assert.equal(await pathExists(deletedPath), false);
  }
});

test("profile main role actions own their live styles without trainer lazy CSS", async () => {
  const component = await readText("src/features/client/profile/ProfileMainRoleActions.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileMainRoleActions.module.css");
  const variables = await readText("src/styles/_variables.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");

  assert.match(component, /import styles from "\.\/ProfileMainRoleActions\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-main-role-actions"/);
  assert.match(component, /data-testid="profile-main-role-trainer"/);
  assert.match(component, /data-testid="profile-main-role-admin"/);
  assert.doesNotMatch(component, /mainDashboardRoleActions/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?grid-template-columns:\s*repeat\(auto-fit, minmax\(0, 1fr\)\);/);
  assert.match(moduleCss, /\.action\s*\{[\s\S]*?min-height:\s*48px;/);
  assert.match(moduleCss, /var\(--background-profile-role-action\)/);
  assert.match(variables, /--color-profile-role-action-border:/);
  assert.match(harness, /harnessPageParam === "profileRoleActions"/);
  assert.doesNotMatch(legacyCss, /\.mainDashboardRoleActions(?![\w-])/);
});

test("profile settings tab title owns its live style without legacy selectors", async () => {
  const component = await readText("src/features/client/profile/ProfileSettingsTab.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileSettingsTab.module.css");
  const variables = await readText("src/styles/_variables.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const warmTheme = await readText("src/styles/nutrition-food-flow-light-theme.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");

  assert.match(component, /import styles from "\.\/ProfileSettingsTab\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-settings-tab"/);
  assert.match(component, /data-testid="profile-settings-tab-title"/);
  assert.doesNotMatch(component, /profileSettingsPageTitle/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.title\s*\{[\s\S]*?margin:\s*0 0 32px;/);
  assert.match(moduleCss, /font-size:\s*15px;/);
  assert.match(moduleCss, /var\(--color-profile-settings-tab-title\)/);
  assert.match(variables, /--color-profile-settings-tab-title:\s*#211b12;/);
  assert.match(variables, /--color-profile-settings-tab-title:\s*#a9d13f;/);
  assert.match(harness, /harnessPageParam === "profileSettingsTab"/);
  assert.match(warmTheme, /h1:not\(\[data-css-module-scope="profile-settings-tab"\]\)/);
  assert.doesNotMatch(legacyCss, /\.profileSettingsPageTitle(?![\w-])/);
});

test("nutrition header uses a colocated module with no remaining legacy selector owner", async () => {
  const component = await readText("src/features/client/nutrition/NutritionHeader.jsx");
  const moduleCss = await readText("src/features/client/nutrition/NutritionHeader.module.css");
  const legacyCss = await readCssWithImports("src/styles/index.css");
  const legacySelectors = /nutritionHeroV4|nutritionHeroTitleV4|nutritionHeaderIconActions|nutritionHeaderIconButton|nutritionHeaderLucideIcon|nutritionQuickActionExact|nutritionQuickCalendarIcon|nutritionWeekV4|nutritionDayV4|nutritionStreakV4/;

  assert.match(component, /import styles from "\.\/NutritionHeader\.module\.css"/);
  assert.match(component, /className=\{styles\.root\}[\s\S]*data-testid="nutrition-header"/);
  assert.match(component, /data-nutrition-header-action="search"/);
  assert.match(component, /data-nutrition-header-action="calendar"/);
  assert.match(moduleCss, /@media \(max-width: 700px\)/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.doesNotMatch(component, legacySelectors);
  assert.doesNotMatch(legacyCss, legacySelectors);
});

test("modular CSS import graph resolves without cycles", async () => {
  const visited = new Set();
  const cssEntries = [
    "src/styles/index.css",
    "src/styles/client-first-setup-lazy.css",
    "src/styles/client-measurements-lazy.css",
    "src/styles/client-profile-lazy.css",
    "src/styles/client-workout-lazy.css",
    "src/styles/nutrition-stack.css",
    "src/styles/trainer-lazy.css",
    "src/styles/admin-lazy.css",
    "src/styles/admin-internals-lazy.css",
    ...(await collectFiles("src/components", [".module.css"])),
    ...(await collectFiles("src/features", [".module.css"]))
  ];
  for (const cssEntry of cssEntries) {
    await walkCssImports(cssEntry, new Set(), visited);
  }
  const allCssFiles = [
    ...(await collectFiles("src/styles", [".css"])),
    ...(await collectFiles("src/components", [".css"])),
    ...(await collectFiles("src/features", [".module.css"]))
  ].map((file) => path.normalize(file)).sort();
  const reachableCssFiles = [...visited].sort();

  assert.ok(visited.has(path.normalize("src/styles/index.css")));
  assert.equal(await pathExists("src/styles/ai-coach-lazy.css"), false);
  assert.ok(visited.has(path.normalize("src/styles/client-first-setup-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/client-workout-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/nutrition-stack.css")));
  assert.ok(visited.has(path.normalize("src/styles/trainer-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/admin-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/compatibility.css")));
  assert.ok(visited.has(path.normalize("src/components/trainer/trainer-workspace.css")));
  assert.equal(await pathExists("src/styles.css"), false);
  assert.deepEqual(reachableCssFiles, allCssFiles);
});

test("client visual unity CSS does not keep exact duplicate blocks", async () => {
  const source = await readCssWithImports("src/styles/client-visual-unity.css");
  const seenBlocks = new Set();
  const duplicateBlocks = [];

  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2].trim().replace(/\s+/g, " ");
    const key = `${selector} { ${body} }`;
    if (seenBlocks.has(key)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      duplicateBlocks.push(`src/styles/client-visual-unity.css:${line}`);
    }
    seenBlocks.add(key);
  }

  assert.deepEqual(duplicateBlocks, []);
});

test("client visual unity CSS does not retain migrated profile summary selectors", async () => {
  const source = await readCssWithImports("src/styles/client-visual-unity.css");

  assert.doesNotMatch(
    source,
    /\.(?:profileAiStatsRow|profileAiStatLabel|profileAiSplitCards|profileAiMiniCard|profileMainSummaryGrid)(?![\w-])/
  );
});

test("client main bottom bar owns its complete scoped navigation contract", async () => {
  const component = await readText("src/shared/ui/BottomBar.jsx");
  const moduleCss = await readText("src/shared/ui/BottomBar.module.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map((file) => readText(file)))).join("\n");

  assert.match(component, /navigationClassName = nutritionVariant[\s\S]*?\? styles\.nutrition[\s\S]*?: styles\.main/);
  assert.match(component, /"client-main-bottom-bar"/);
  assert.match(component, /className=\{activeTab === "main" \? styles\.active : ""\}/);
  assert.doesNotMatch(component, /clientBottomNav/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.main\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(moduleCss, /\.main > \.active\s*\{[\s\S]*?var\(--color-nutrition-nav-active\)/);
  assert.match(moduleCss, /@media \(max-width: 900px\)[\s\S]*?\.main\s*\{[\s\S]*?height:\s*76px;/);
  assert.doesNotMatch(legacyCss, /clientBottomNav/);
  assert.equal(await pathExists("src/styles/client-primary-final-rhythm-eof-bottom-nav-v417.css"), false);
});

test("legacy bottom bars CSS keeps button shells in the final owner", async () => {
  const source = await readCssWithImports("src/styles/bottom-bars.css");
  const normalizeStart = source.indexOf("V854: hard normalize all bottom navigation bars");
  const finalStart = source.indexOf("V855: final one-pixel strict baseline", normalizeStart);
  const normalizeBlock = source.slice(normalizeStart, finalStart);
  const finalBlock = source.slice(finalStart);

  assert.ok(normalizeStart >= 0);
  assert.ok(finalStart > normalizeStart);
  assert.doesNotMatch(
    normalizeBlock,
    /\.mainMenuBottomBar\.profileBottomTabBar > button,[\s\S]*?\{\s*box-sizing:\s*border-box !important;[\s\S]*?height:\s*68px !important;/
  );
  assert.doesNotMatch(
    normalizeBlock,
    /\.mainMenuBottomBar\.profileBottomTabBar > button strong,[\s\S]*?\{\s*width:\s*100% !important;[\s\S]*?font-size:\s*11px !important;/
  );
  assert.match(
    finalBlock,
    /\.mainMenuBottomBar\.profileBottomTabBar > button,[\s\S]*?\.programsBottomBar > button,[\s\S]*?\{\s*box-sizing:\s*border-box !important;[\s\S]*?height:\s*68px !important;/
  );
  assert.match(
    finalBlock,
    /\.mainMenuBottomBar\.profileBottomTabBar > button strong,[\s\S]*?\.programsBottomBar > button \.adminV3NavLabel,[\s\S]*?\{\s*width:\s*100% !important;[\s\S]*?font-size:\s*11px !important;/
  );
});

test("client primary CSS no longer owns the scoped food product action bar", async () => {
  const source = await readCssWithImports("src/styles/client-primary.css");

  assert.doesNotMatch(source, /\.(?:foodProductActionBar|foodProductRenderScreen|foodEditRenderScreen|fatFoodAmountScreen)(?![\w-])/);
});

test("profile cabinet action grid owns its scoped production layout", async () => {
  const component = await readText("src/features/client/profile/ProfileCabinetActionGrid.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileCabinetActionGrid.module.css");
  const legacyCss = await readCssWithImports("src/styles/index.css");

  assert.match(component, /import styles from "\.\/ProfileCabinetActionGrid\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-cabinet-action-grid"/);
  assert.match(component, /data-testid="profile-cabinet-action-grid"/);
  assert.match(component, /data-testid=\{`profile-cabinet-action-\$\{kind\}`\}/);
  assert.doesNotMatch(component, /progressHub|profileCabinetProgressOverview|cabinetWorkoutJournalButton/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.card\s*\{[\s\S]*?grid-template-columns:\s*44px minmax\(0, 1fr\) 14px;[\s\S]*?border:\s*1px solid var\(--color-profile-cabinet-action-border\);/);
  assert.match(moduleCss, /@media \(max-width: 430px\)[\s\S]*?min-height:\s*78px;[\s\S]*?grid-template-columns:\s*48px minmax\(0, 1fr\) 18px;/);
  assert.match(moduleCss, /@media \(min-width: 1100px\)[\s\S]*?\.trainer\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.doesNotMatch(legacyCss, /\.(?:progressHubOverview|profileCabinetProgressOverview|progressHubCard(?:Icon|Avatar|Text)?)(?![\w-])/);
});

test("food product action bar owns its scoped geometry and label typography", async () => {
  const component = await readText("src/features/client/nutrition/FoodProductActionBar.jsx");
  const moduleCss = await readText("src/features/client/nutrition/FoodProductActionBar.module.css");

  assert.match(component, /import styles from "\.\/FoodProductActionBar\.module\.css";/);
  assert.match(component, /data-css-module-scope="food-product-action-bar"/);
  assert.match(component, /data-testid="food-product-action-bar"/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?width:\s*min\(374px, calc\(100vw - 20px\)\);[\s\S]*?height:\s*78px;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 2fr\);/);
  assert.match(moduleCss, /\.button > strong\s*\{[\s\S]*?font-size:\s*10\.5px;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(moduleCss, /@media \(max-width:\s*700px\)[\s\S]*?height:\s*84px;[\s\S]*?\.button\s*\{[\s\S]*?height:\s*68px;/);
});

test("food search page owns its scoped recent landing and photo action", async () => {
  const component = await readText("src/features/client/nutrition/FoodSearchPage.jsx");
  const moduleCss = await readText("src/features/client/nutrition/FoodSearchPage.module.css");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const oldSelectors = /\.(?:foodSearchModernLanding|foodSearchModernSection|foodSearchRecentSection|foodSearchModernSectionHeader|foodSearchRecentGrid|foodSearchRecentCard|foodSearchFixedPhotoAction|foodSearchModernActionIcon|fatPhotoAiInput)(?![\w-])/;

  assert.match(component, /import styles from "\.\/FoodSearchPage\.module\.css";/);
  assert.match(component, /data-testid="food-search-modern-landing"/);
  assert.match(component, /data-testid="food-search-photo-action"/);
  assert.match(component, /data-css-module-scope="food-search-page"/);
  assert.doesNotMatch(component, oldSelectors);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.recentGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);[\s\S]*?grid-auto-rows:\s*82px;[\s\S]*?gap:\s*10px;/);
  assert.match(moduleCss, /\.recentItem\s*\{[\s\S]*?height:\s*82px;[\s\S]*?border-radius:\s*13px;/);
  assert.match(moduleCss, /\.photoAction\s*\{[\s\S]*?bottom:\s*calc\(112px \+ var\(--safe-area-bottom\)\);[\s\S]*?width:\s*min\(376px, calc\(100vw - 24px\)\);[\s\S]*?height:\s*84px;[\s\S]*?grid-template-columns:\s*52px minmax\(0, 1fr\) 22px;/);
  assert.match(moduleCss, /\.photoAction::before\s*\{[\s\S]*?bottom:\s*calc\(-128px - var\(--safe-area-bottom\)\);[\s\S]*?width:\s*100vw;/);
  assert.match(moduleCss, /@media \(max-width:\s*380px\)[\s\S]*?grid-auto-rows:\s*78px;[\s\S]*?bottom:\s*calc\(108px \+ var\(--safe-area-bottom\)\);/);
  assert.doesNotMatch(legacyCss, oldSelectors);
  assert.equal(await pathExists("src/styles/client-food-search-actions.css"), false);
  assert.equal(await pathExists("src/styles/client-food-search-sizing-locks-header-action-v155.css"), false);
  assert.equal(await pathExists("src/styles/client-food-search-sizing-locks-photo-action-v157.css"), false);
  assert.equal(await pathExists("src/styles/client-primary-food-flow-search-home-actions.css"), false);
  assert.equal(await pathExists("src/styles/client-primary-food-flow-search-home-landing.css"), false);
});

test("client primary final CSS keeps food search create action colors grouped", async () => {
  const source = await readCssWithImports("src/styles/client-primary.css");

  assert.equal(
    (source.match(/\.fatFoodSearchScreenPremium \.fatSearchBottomBarFive \.fatSearchCreateAction,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchScreenPremium \.fatSearchBottomBarFive \.fatSearchCreateAction span,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchScreenPremium \.fatSearchBottomBarFive \.fatSearchCreateAction strong\s*\{\s*color:\s*rgba\(97, 106, 128, 0\.82\) !important;\s*-webkit-text-fill-color:\s*rgba\(97, 106, 128, 0\.82\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchScreenPremium \.fatSearchBottomBarFive \.fatSearchCreateAction\.active,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchScreenPremium \.fatSearchBottomBarFive \.fatSearchCreateAction\.active span,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchScreenPremium \.fatSearchBottomBarFive \.fatSearchCreateAction\.active strong\s*\{\s*color:\s*#4834dd !important;\s*-webkit-text-fill-color:\s*#4834dd !important;\s*\}/g) || []).length,
    1
  );
});

test("food product header owns its scoped CSS module without legacy selectors", async () => {
  const component = await readText("src/features/client/nutrition/FoodProductHeader.jsx");
  const moduleCss = await readText("src/features/client/nutrition/FoodProductHeader.module.css");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const oldSelectors = /\.(?:foodProductFlowHeader|foodProductFlowTitle|foodEditInlineMealHeader|foodEditInlineMealLabel|foodEditInlineMealButton|foodEditMealPickerDropdown(?:Inline)?|foodEditHeroRender|foodEditHeroEditable|foodEditIconSourceStack|foodEditIconRender)(?![\w-])/;

  assert.match(component, /import styles from "\.\/FoodProductHeader\.module\.css";/);
  assert.doesNotMatch(component, oldSelectors);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.flowHeader\s*\{[\s\S]*?height:\s*124px;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 120px;/);
  assert.match(moduleCss, /\.mealCard\s*\{[\s\S]*?height:\s*54px;/);
  assert.match(moduleCss, /\.hero\s*\{[\s\S]*?height:\s*96px;[\s\S]*?padding:\s*12px 18px;/);
  assert.match(moduleCss, /@media \(max-width:\s*380px\)[\s\S]*?\.heading\s*\{\s*font-size:\s*25px;/);
  assert.doesNotMatch(legacyCss, oldSelectors);
  assert.equal(await pathExists("src/styles/client-food-search-product-render-hero.css"), false);
  assert.equal(await pathExists("src/styles/client-history-ai-search-food-edit.css"), false);
});

test("food product top actions own a scoped CSS module without legacy selectors", async () => {
  const pageComponent = await readText("src/features/client/nutrition/FoodProductPage.jsx");
  const component = await readText("src/features/client/nutrition/FoodProductTopActions.jsx");
  const moduleCss = await readText("src/features/client/nutrition/FoodProductTopActions.module.css");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const oldSelectors = /\.(?:foodProductTopActions|foodProductTopAction|foodProductTopDelete|foodProductTopEdit)(?![\w-])/;

  assert.match(pageComponent, /import FoodProductTopActions from "\.\/FoodProductTopActions";/);
  assert.match(pageComponent, /<FoodProductTopActions[\s\S]*?canDelete=\{canDelete\}[\s\S]*?onEdit=\{onOpenEditPage\}/);
  assert.match(component, /import styles from "\.\/FoodProductTopActions\.module\.css";/);
  assert.match(component, /data-css-module-scope="food-product-top-actions"/);
  assert.match(component, /data-food-product-top-action="delete"/);
  assert.match(component, /data-food-product-top-action="edit"/);
  assert.doesNotMatch(pageComponent, oldSelectors);
  assert.doesNotMatch(component, oldSelectors);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*55px;[\s\S]*?width:\s*108px;[\s\S]*?height:\s*48px;/);
  assert.match(moduleCss, /\.action\s*\{[\s\S]*?width:\s*48px;[\s\S]*?height:\s*48px;[\s\S]*?var\(--color-food-product-action-border\)/);
  assert.match(moduleCss, /@media \(max-width:\s*380px\)[\s\S]*?right:\s*10px;/);
  assert.doesNotMatch(legacyCss, oldSelectors);
});

test("food search header owns scoped search and my-products layouts", async () => {
  const component = await readText("src/features/client/nutrition/FoodSearchHeader.jsx");
  const headerCss = await readText("src/features/client/nutrition/FoodSearchHeader.module.css");
  const overlayCss = await readText("src/features/client/nutrition/FoodSearchOverlay.module.css");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const oldSelectors = /\.(?:foodSearchHeaderExactMainAlign|fatSearchTopPremiumHome|fatSearchTopPremiumMy|fatSearchTopPremium|foodFlowSearchTitle|foodFlowTitleGroup|fatSearchTitleButtonPremium|fatSearchTitleWrap|fatMealDropdownCentered|fatMealDropdownCollapse|fatMealDropdown|fatSearchClosePremium)(?![\w-])/;

  assert.match(component, /import styles from "\.\/FoodSearchHeader\.module\.css";/);
  assert.match(component, /if \(selectedFood\) \{\s*return null;/);
  assert.doesNotMatch(component, oldSelectors);
  assert.doesNotMatch(headerCss, /!important/);
  assert.doesNotMatch(overlayCss, /!important/);
  assert.match(headerCss, /\.search\s*\{[\s\S]*?height:\s*124px;[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 48px;/);
  assert.match(headerCss, /\.mealDropdown\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?width:\s*min\(320px, calc\(100vw - 40px\)\);/);
  assert.match(headerCss, /@media \(max-width:\s*640px\)[\s\S]*?\.myProducts\s*\{[\s\S]*?height:\s*136px;/);
  assert.match(overlayCss, /\.searchLayout\s*\{\s*padding:\s*0 12px calc\(112px \+ env\(safe-area-inset-bottom, 0px\)\);/);
  assert.doesNotMatch(legacyCss, oldSelectors);
  assert.match(legacyCss, /\.fatFoodSearchScreenPremium:not\(\[data-food-search-header-layout\]\)/);
});

test("profile main summary cards own their live scoped visual", async () => {
  const component = await readText("src/features/client/profile/ProfileMainSummaryCards.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileMainSummaryCards.module.css");
  const variables = await readText("src/styles/_variables.css");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const retiredSelectors = /\.(?:profileAiStatsRow|profileAiStatLabel|profileAiSplitCards|profileAiMiniCard|profileMainSummaryGrid)(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileMainSummaryCards\.module\.css";/);
  assert.match(component, /data-testid="profile-main-stats"/);
  assert.match(component, /data-testid="profile-main-summary-grid"/);
  assert.match(component, /className=\{styles\.statsRoot\}/);
  assert.match(component, /className=\{styles\.summaryGrid\}/);
  assert.doesNotMatch(component, retiredSelectors);
  assert.doesNotMatch(component, /<small(?:\s|>)/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.statsRoot\s*\{[\s\S]*?height:\s*82px;[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(moduleCss, /\.summaryGrid\s*\{[\s\S]*?height:\s*84px;[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(moduleCss, /@media \(max-width:\s*640px\)[\s\S]*?\.statsRoot\s*\{[\s\S]*?height:\s*64px;[\s\S]*?\.summaryGrid\s*\{[\s\S]*?height:\s*76px;/);
  assert.match(moduleCss, /:global\(:root\[data-app-theme="dark-green"\]\) \.statsRoot\s*\{[\s\S]*?height:\s*78px;/);
  assert.match(moduleCss, /@media \(max-height:\s*800px\)[\s\S]*?height:\s*70px;[\s\S]*?height:\s*84px;/);
  assert.match(variables, /--color-profile-summary-stats-border:/);
  assert.match(variables, /--background-profile-summary-card:/);
  assert.doesNotMatch(legacyCss, retiredSelectors);
});

test("profile hero card owns its live scoped visual and omits retired interaction branches", async () => {
  const component = await readText("src/features/client/profile/ProfileHeroCard.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileHeroCard.module.css");
  const legacyCss = await readCssWithImports("src/styles/index.css");

  assert.match(component, /import styles from "\.\/ProfileHeroCard\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-hero-card"/);
  assert.match(component, /data-testid="profile-main-hero"/);
  assert.match(component, /data-testid="profile-main-hero-avatar"/);
  assert.match(component, /data-testid="profile-main-hero-title"/);
  assert.doesNotMatch(component, /profileAiHero|profileAiAvatar|profileAvatarBig|profileUnifiedAvatar/);
  assert.doesNotMatch(component, /progressScore|onOpenAccount|clickable|isMainDashboard/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?height:\s*108px;[\s\S]*?margin:\s*0 -12px;[\s\S]*?grid-template-columns:\s*70px minmax\(0, 1fr\);/);
  assert.match(moduleCss, /@media \(max-width: 700px\)[\s\S]*?\.root\s*\{[\s\S]*?height:\s*96px;[\s\S]*?grid-template-columns:\s*62px minmax\(0, 1fr\);/);
  assert.match(moduleCss, /:global\(:root\[data-app-theme="dark-green"\]\) \.root\s*\{[\s\S]*?height:\s*90px;[\s\S]*?grid-template-columns:\s*48px minmax\(0, 1fr\);/);
  assert.match(moduleCss, /@media \(max-height: 800px\)[\s\S]*?height:\s*80px;/);
  assert.match(moduleCss, /\.avatar img\s*\{[\s\S]*?object-fit:\s*cover;/);
  assert.doesNotMatch(
    legacyCss,
    /\.(?:profileAiHero[\w-]*|profileAiAvatar[\w-]*|profileAvatarBig|profileUnifiedAvatar)(?![\w-])/
  );
});

test("client primary final CSS keeps the remaining shared profile surfaces grouped", async () => {
  const source = await readCssWithImports("src/styles/client-primary.css");

  assert.equal(
    (source.match(/\.profileUnifiedCard\.profileAiDashboardCard\.profileCabinetSection,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileUnifiedCard\.profileAiDashboardCard\.profileCabinetSection\s*\{\s*width:\s*100% !important;\s*margin:\s*0 !important;\s*padding:\s*0 !important;\s*border:\s*0 !important;\s*background:\s*transparent !important;\s*box-shadow:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.profileDashboardPage\.clientCorePageMain::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\)::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition::before\s*\{\s*display:\s*none !important;\s*content:\s*none !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\)::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition::before\s*\{\s*content:\s*none !important;\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /profileAiHero|profileAiAvatar|profileAvatarBig|profileUnifiedAvatar|profileAiStatsRow|profileAiStatLabel|profileAiSplitCards|profileAiMiniCard|profileMainSummaryGrid/
  );
});

test("client primary final CSS keeps Zouk arrow sizing after nutrition summary migration", async () => {
  const source = await readCssWithImports("src/styles/client-primary.css");

  assert.doesNotMatch(source, /nutritionAiPlanTop(?:Inline|Card|Title)/);
  assert.equal(
    (source.match(/\.nutritionZoukHeader\s*\{\s*min-height:\s*88px !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*62px minmax\(0, 1fr\) 24px !important;\s*align-items:\s*center !important;\s*gap:\s*14px !important;\s*padding:\s*14px 18px !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(source, /nutritionAiPlanCollapsedArrow/);
  assert.equal(
    (source.match(/\.nutritionZoukMeta\s*\{\s*width:\s*18px !important;\s*min-width:\s*18px !important;\s*height:\s*36px !important;\s*min-height:\s*36px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.nutritionZoukMeta small\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
});

test("profile dashboard shell owns client layout while preserving the trainer fallback", async () => {
  const shell = await readText("src/features/client/profile/ProfileDashboardShell.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileDashboardShell.module.css");
  const route = await readText("src/features/client/profile/ProfileDashboardRoute.jsx");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const variables = await readText("src/styles/_variables.css");

  assert.match(shell, /import styles from "\.\/ProfileDashboardShell\.module\.css";/);
  assert.match(shell, /data-css-module-scope=\{legacyTrainer \? undefined : "profile-dashboard-shell"\}/);
  assert.match(shell, /data-testid=\{legacyTrainer \? undefined : "profile-dashboard-content"\}/);
  assert.match(shell, /data-testid="profile-main-hero-stats-shell"/);
  assert.match(shell, /data-testid="profile-dashboard-version"/);
  assert.match(shell, /legacyTrainer/);
  assert.match(shell, /trainerRolePage/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?overflow:\s*hidden auto;[\s\S]*?scroll-padding-bottom:/);
  assert.match(moduleCss, /\.mainContent\s*\{[\s\S]*?height:\s*calc\(100% - 44px\);/);
  assert.match(moduleCss, /@media \(max-width: 900px\)[\s\S]*?\.heroStats\s*\{[\s\S]*?grid-template-rows:\s*96px 64px;/);
  assert.match(moduleCss, /var\(--gradient-profile-shell-mobile\)/);
  assert.match(variables, /--gradient-profile-shell-mobile:/);
  assert.match(variables, /--shadow-profile-shell-main:/);
  assert.match(route, /<ProfileDashboardShell[\s\S]*?mode=\{profileShellMode\}/);
  assert.match(route, /<ProfileDashboardContent[\s\S]*?mode=\{profileShellMode\}/);
  assert.match(route, /<ProfileMainHeroStatsShell>/);
  assert.match(route, /<ProfileDashboardVersion>\{APP_VERSION\}<\/ProfileDashboardVersion>/);
  assert.doesNotMatch(route, /profileDashboardPage|profileUnifiedCard|profileMainHeroStatsCard|mainDashboardAppVersion/);
  assert.match(harness, /<ProfileDashboardShell mode=\{activeTab\}/);
  assert.doesNotMatch(harness, /profileDashboardPage|profileUnifiedCard|profileMainHeroStatsCard|mainDashboardAppVersion/);
});

test("profile page chrome owns its scoped main title and notification action", async () => {
  const component = await readText("src/features/client/profile/ProfilePageChrome.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfilePageChrome.module.css");
  const legacyCss = await readCssWithImports("src/styles/index.css");

  assert.match(component, /import styles from "\.\/ProfilePageChrome\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-page-chrome"/);
  assert.match(component, /data-testid="profile-main-title"/);
  assert.match(component, /data-testid="profile-main-notifications"/);
  assert.doesNotMatch(component, /mainDashboardTitle|menuRefreshIconBtn|trainerNotificationBadge/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.title\s*\{[\s\S]*?height:\s*32px;[\s\S]*?padding:\s*0 44px 0 0;[\s\S]*?font-size:\s*24px;/);
  assert.match(moduleCss, /\.notificationButton\s*\{[\s\S]*?width:\s*34px;[\s\S]*?top:\s*13px;[\s\S]*?right:\s*20px;/);
  assert.match(moduleCss, /@media \(max-width: 700px\)[\s\S]*?\.title\s*\{[\s\S]*?width:\s*calc\(100% - 116px\);[\s\S]*?font-size:\s*28px;/);
  assert.match(moduleCss, /@media \(max-width: 700px\)[\s\S]*?\.notificationButton\s*\{[\s\S]*?width:\s*48px;[\s\S]*?top:\s*34px;[\s\S]*?right:\s*25px;/);
  assert.match(moduleCss, /\.badge\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?font-size:\s*10px;/);
  assert.doesNotMatch(legacyCss, /\.mainDashboardTitle(?![\w-])/);
  assert.doesNotMatch(
    legacyCss,
    /(?:\.(?:profileDashboardPage|clientCorePageMain|mainDashboardPage)[^,{]*\.menuRefreshIconBtn|\.menuRefreshIconBtn[^,{]*\.(?:profileDashboardPage|clientCorePageMain|mainDashboardPage))/
  );
});

test("profile cabinet title row owns its scoped title and refresh geometry", async () => {
  const component = await readText("src/features/client/profile/ProfileCabinetTitleRow.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileCabinetTitleRow.module.css");
  const legacyCss = await readCssWithImports("src/styles/index.css");

  assert.match(component, /import styles from "\.\/ProfileCabinetTitleRow\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-cabinet-title-row"/);
  assert.match(component, /data-testid="profile-cabinet-title"/);
  assert.match(component, /data-testid="profile-cabinet-refresh"/);
  assert.doesNotMatch(component, /profileCabinetTitleRow|profileCabinetPageTitle|profileTrainerNotificationsButton|clientCorePageTitle/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 42px;[\s\S]*?gap:\s*8px;/);
  assert.match(moduleCss, /@media \(max-width: 700px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) 48px;[\s\S]*?font-size:\s*28px;/);
  assert.match(moduleCss, /@media \(min-width: 1100px\)[\s\S]*?:global\(\.trainerRolePage\) \.title/);
  assert.doesNotMatch(legacyCss, /\.(?:profileCabinetTitleRow|profileCabinetPageTitle|profileTrainerNotificationsButton)(?![\w-])/);
});

test("migrated client title rows stay out of the legacy title owner", async () => {
  const source = await readText("src/styles/client-visual-unity-shell-title-actions-v435.css");

  assert.doesNotMatch(
    source,
    /\.fatSearchTopPremium|\.foodFlowTitleGroup|\.foodFlowSearchTitle|\.fatSearchClosePremium|clientCorePageWorkout|workoutSelect|mainDashboardTitle/
  );
});

test("client primary final CSS keeps remaining legacy page variables in the final owner", async () => {
  const source = await readCssWithImports("src/styles/client-primary.css");
  const rhythmStart = source.indexOf("/* v.1.39: final rhythm lock for the four primary client screens. */");
  const beforeRhythmBlock = source.slice(0, rhythmStart);

  assert.ok(rhythmStart >= 0);
  assert.doesNotMatch(beforeRhythmBlock, /\.profileDashboardPage\.clientCorePageMain::after/);
  assert.doesNotMatch(beforeRhythmBlock, /\.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\)::after/);
  assert.match(
    source.slice(rhythmStart),
    /\.profileDashboardPage\.clientCorePageMain::after,[\s\S]*?\.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition::after\s*\{[\s\S]*?height:\s*calc\(112px \+ env\(safe-area-inset-bottom\)\) !important;[\s\S]*?background:\s*linear-gradient\(180deg,\s*rgba\(246,\s*247,\s*252,\s*0\) 0%,\s*#f6f7fc 22%,\s*#f6f7fc 100%\) !important;/
  );

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\),\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition\s*\{\s*--client-page-x:\s*22px;\s*--client-page-title-top:\s*54px;\s*--client-page-title-height:\s*52px;\s*--client-page-title-size:\s*30px;\s*--client-page-title-color:\s*#5f5744;/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.profileDashboardPage\.clientCorePageMain,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\),\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatFoodSearchScreenPremium\s*\{\s*--client-top:\s*70px;\s*\}/
  );
  assert.match(
    source,
    /\.profileDashboardPage\.clientCorePageMain,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\),\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatFoodSearchScreenPremium:not\(\[data-food-search-header-layout\]\)\s*\{\s*--client-x:\s*26px;\s*--client-top:\s*70px;/
  );
  assert.doesNotMatch(source, /clientCorePageWorkout|workoutSelectPage|individualWorkoutSelectPage|basicWorkoutSelectPage/);
});

test("client workout set-row final sizing stays in its colocated CSS Module", async () => {
  const renderTarget = await readCssWithImports("src/styles/client-render-target.css");
  const setRows = await readText("src/features/client/workouts/WorkoutExerciseSets.module.css");

  assert.doesNotMatch(renderTarget, /v127: absolute final override for workout set rows/);
  assert.doesNotMatch(renderTarget, /v126: final set-row size\/state polish/);
  assert.doesNotMatch(renderTarget, /Final lock for workout run set cards/);
  assert.doesNotMatch(renderTarget, /setRow\.workoutExercisePlanRow\s*\{[\s\S]*?min-height:\s*86px !important;/);
  assert.doesNotMatch(renderTarget, /grid-template-columns:\s*34px minmax\(0, 1fr\) 120px !important;/);
  assert.equal(
    (renderTarget.match(/setRow\.workoutExercisePlanRow\s*\{\s*min-height: 58px !important;/g) || []).length,
    0
  );
  assert.doesNotMatch(setRows, /!important/);
  assert.match(setRows, /\.row\s*\{[\s\S]*?min-height:\s*52px;/);
  assert.match(setRows, /html\[data-app-theme="warm-light"\][\s\S]*?\.row\s*\{[\s\S]*?height:\s*60px;/);
});

test("client render target CSS does not retain migrated profile summary locks", async () => {
  const source = await readCssWithImports("src/styles/client-render-target.css");

  assert.doesNotMatch(source, /progressHubCardText/);
  assert.doesNotMatch(source, /profileAiHero|profileAiAvatar|profileAvatarBig|profileUnifiedAvatar/);
  assert.doesNotMatch(
    source,
    /\.(?:profileAiStatsRow|profileAiStatLabel|profileAiSplitCards|profileAiMiniCard|profileMainSummaryGrid)(?![\w-])/
  );
});

test("client workout set module keeps one no-weight modal grid owner", async () => {
  const source = await readText("src/features/client/workouts/WorkoutExerciseSets.module.css");

  assert.equal(
    (source.match(/\.modalFields\.withoutWeight\s*\{\s*grid-template-columns:\s*1fr;\s*\}/g) || []).length,
    1
  );
});

test("client workout close CSS has no overwritten border reset", async () => {
  const source = await readText("src/styles/workout-navigation-close.css");

  assert.doesNotMatch(
    source,
    /\.exerciseCloseButton\s*\{[\s\S]*?border:\s*none !important;[\s\S]*?border:\s*1px solid rgba\(127,\s*159,\s*58,\s*0\.18\) !important;/
  );
  assert.match(
    source,
    /\.exerciseCloseButton\s*\{[\s\S]*?border:\s*1px solid rgba\(127,\s*159,\s*58,\s*0\.18\) !important;/
  );
});

test("client workout close CSS keeps compact nav button sizes grouped", async () => {
  const source = await readText("src/styles/workout-navigation-close.css");

  assert.equal(
    (source.match(/@media\s*\(max-width:\s*480px\)\s*\{\s*\.workoutRunPage \.exerciseNavigationRow \.exerciseBackButton,\s*\.workoutRunPage \.exerciseNavigationRow \.exercisePrevButton\s*\{\s*min-height:\s*56px !important;\s*border-radius:\s*20px !important;\s*font-size:\s*19px !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /@media\s*\(max-width:\s*480px\)\s*\{\s*\.workoutRunPage \.exerciseNavigationRow \.exerciseBackButton\s*\{\s*min-height:\s*56px !important;\s*border-radius:\s*20px !important;\s*font-size:\s*19px !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /@media\s*\(max-width:\s*480px\)\s*\{\s*\.workoutRunPage \.exerciseNavigationRow \.exercisePrevButton\s*\{\s*min-height:\s*56px !important;\s*border-radius:\s*20px !important;\s*font-size:\s*19px !important;\s*\}/
  );
});

test("client workout close CSS keeps pseudo resets grouped", async () => {
  const source = await readText("src/styles/workout-navigation-close.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.exerciseNavigationRow \.exerciseBackButton::before,\s*\.workoutRunPage \.exerciseNavigationRow \.exercisePrevButton::before,\s*\.workoutRunPage \.workoutCloseButton::before\s*\{\s*content:\s*none !important;\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal((source.match(/content:\s*none !important;/g) || []).length, 1);
});

test("client workout close CSS keeps compact nav active state grouped", async () => {
  const source = await readText("src/styles/workout-navigation-close.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.exerciseNavigationRow \.exerciseBackButton:active,\s*\.workoutRunPage \.exerciseNavigationRow \.exercisePrevButton:active\s*\{\s*transform:\s*scale\(0\.985\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal((source.match(/transform:\s*scale\(0\.985\) !important;/g) || []).length, 1);
});

test("client workout close CSS keeps exercise close active state in the base owner", async () => {
  const source = await readText("src/styles/workout-navigation-close.css");

  assert.equal(
    (source.match(/\.exerciseCloseButton:active\s*\{\s*transform:\s*scale\(0\.96\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.workoutRunPage \.workoutCloseButton:active\s*\{\s*transform:\s*scale\(0\.96\) !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(source, /\.workoutRunPage \.exerciseCloseButton:active/);
  assert.equal((source.match(/transform:\s*scale\(0\.96\) !important;/g) || []).length, 2);
});

test("client workout close CSS keeps scoped exercise close position in one owner", async () => {
  const source = await readText("src/styles/workout-navigation-close.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.exerciseCloseButton\s*\{[\s\S]*?position:\s*absolute !important;[\s\S]*?top:\s*16px !important;[\s\S]*?right:\s*16px !important;[\s\S]*?left:\s*auto !important;[\s\S]*?z-index:\s*80 !important;[\s\S]*?\}/g) || []).length,
    1
  );
  assert.equal((source.match(/\.workoutRunPage \.exerciseCloseButton\s*\{/g) || []).length, 1);
});

test("client workout close CSS keeps slide relative positioning grouped", async () => {
  const source = await readText("src/styles/workout-navigation-close.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.startWorkoutSlide,\s*\.workoutRunPage \.exerciseSlideCard\s*\{\s*position:\s*relative !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.workoutRunPage \.exerciseSlideCard\s*\{\s*position:\s*relative !important;\s*\}\s*\.workoutRunPage \.exerciseCloseButton/
  );
});

test("workout flow CSS keeps slide animation shell grouped", async () => {
  const source = await readText("src/styles/workoutFlow.css");

  assert.equal(
    (source.match(/\.exerciseSlideCard,\s*\.finishSlideWrap\s*\{\s*will-change:\s*transform,\s*opacity;\s*backface-visibility:\s*hidden;\s*transform:\s*translateZ\(0\);\s*animation-duration:\s*560ms;\s*animation-fill-mode:\s*both;\s*animation-timing-function:\s*cubic-bezier\(0\.22,\s*0\.9,\s*0\.32,\s*1\);/g) || []).length,
    1
  );
  assert.equal((source.match(/animation-duration:\s*560ms;/g) || []).length, 1);
});

test("client workout flow CSS keeps shared bottom panel shell in one owner", async () => {
  const source = await readCssWithImports("src/styles/client-workout-flow.css");
  const sharedPanelMatch = source.match(
    /\.workoutRunPage \.startWorkoutBottomPanel,\s*\.workoutRunPage \.warmupBottomPanel,\s*\.workoutRunPage \.exerciseActionPanel,\s*\.workoutRunPage \.workoutFinishActionPanel\s*\{[\s\S]*?\n\}/
  );

  assert.ok(sharedPanelMatch);
  assert.equal(
    (source.match(/\.workoutRunPage \.startWorkoutBottomPanel,\s*\.workoutRunPage \.warmupBottomPanel,\s*\.workoutRunPage \.exerciseActionPanel,\s*\.workoutRunPage \.workoutFinishActionPanel\s*\{/g) || []).length,
    1
  );
  assert.match(sharedPanelMatch[0], /bottom:\s*max\(26px,\s*calc\(env\(safe-area-inset-bottom\) \+ 18px\)\);/);
  assert.match(sharedPanelMatch[0], /background:\s*linear-gradient\(180deg,\s*#121712 0%,\s*#0d110d 100%\);/);
});

test("workout list owns its live scoped styles and leaves no legacy page selectors", async () => {
  const component = await readText("src/features/client/workouts/WorkoutListPage.jsx");
  const moduleCss = await readText("src/features/client/workouts/WorkoutListPage.module.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldWorkoutListSelector = /\.(?:clientCorePageWorkout[\w-]*|workoutSelect[\w-]*|basicWorkout[\w-]*|individualWorkout[\w-]*)/;

  assert.match(component, /import styles from "\.\/WorkoutListPage\.module\.css";/);
  assert.match(component, /data-css-module-scope="workout-list"/);
  assert.match(component, /className=\{`\$\{styles\.page\} \$\{isIndividualWorkoutMode \? styles\.individualMode : styles\.basicMode\}`\}/);
  assert.match(component, /data-testid="workout-list-card"/);
  assert.match(component, /data-testid="workout-list-nav"/);
  assert.match(component, /className:\s*styles\.menuBar/);
  assert.doesNotMatch(component, /clientCorePageWorkout|workoutSelectPage|individualWorkoutSelectPage|basicWorkoutSelectPage/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /@layer components\s*\{/);
  assert.match(moduleCss, /\.page\s*\{[\s\S]*?min-height:\s*100dvh;/);
  assert.match(moduleCss, /\.workoutCard\s*\{[\s\S]*?min-height:\s*var\(--workout-card-min-height\);/);
  assert.match(moduleCss, /@media \(max-width:\s*40rem\)/);
  assert.match(moduleCss, /@media \(max-width:\s*23\.125rem\)/);
  assert.doesNotMatch(legacyCss, oldWorkoutListSelector);
  assert.equal(await pathExists("src/styles/client-workout-card-render-card.css"), false);
  assert.equal(await pathExists("src/styles/client-primary-final-rhythm-contract-workout-v432.css"), false);
  assert.equal(await pathExists("src/styles/trainer-month-program-editor-individual-ui-nav-v197.css"), false);
  assert.equal(await pathExists("src/styles/client-workout-empty-state.css"), false);
});

test("workout plan and its training navigation own only colocated scoped styles", async () => {
  const component = await readText("src/features/client/workouts/WorkoutPlanPage.jsx");
  const moduleCss = await readText("src/features/client/workouts/WorkoutPlanPage.module.css");
  const bottomBar = await readText("src/shared/ui/BottomBar.jsx");
  const bottomBarCss = await readText("src/shared/ui/BottomBar.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldWorkoutPlanSelector = /\.(?:workoutPlanOverview[\w-]*|individualWorkout(?:BottomPanel|MenuBar)[\w-]*)/;

  assert.match(component, /import styles from "\.\/WorkoutPlanPage\.module\.css";/);
  assert.match(component, /data-css-module-scope="workout-plan"/);
  assert.match(component, /className=\{styles\.page\}/);
  assert.match(component, /className=\{styles\.stats\}/);
  assert.match(component, /className=\{completed \? styles\.completed : ""\}/);
  assert.match(component, /className=\{styles\.bottomPanel\}/);
  assert.doesNotMatch(component, /workoutPlanOverview|individualWorkoutBottomPanel|individualWorkoutMenuBar/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.page\s*\{[\s\S]*?min-height:\s*100dvh;/);
  assert.match(moduleCss, /\.stats\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(moduleCss, /\.bottomPanel\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?width:\s*min\(394px, calc\(100vw - 20px\)\);/);
  assert.match(bottomBar, /className=\{styles\.training\}/);
  assert.match(bottomBar, /data-css-module-scope="training-bottom-bar"/);
  assert.match(bottomBar, /data-testid="client-training-bottom-nav"/);
  assert.match(bottomBar, /activeTab === "plan" \? styles\.active : ""/);
  assert.doesNotMatch(bottomBar, /individualWorkoutBottomPanel|individualWorkoutMenuBar/);
  assert.doesNotMatch(bottomBarCss, /!important/);
  assert.match(bottomBarCss, /\.training\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(harness, /clientHarnessPage[\s\S]*?"workoutPlan"/);
  assert.doesNotMatch(legacyCss, oldWorkoutPlanSelector);
  assert.equal(await pathExists("src/styles/bottom-bars-workout-flow-lock.css"), false);
  assert.equal(await pathExists("src/styles/bottom-bars-workout-page-lock.css"), false);
  assert.equal(await pathExists("src/styles/client-workout-plan-tail-individual-card.css"), false);
  assert.equal(await pathExists("src/styles/trainer-month-program-editor-bottom-nav.css"), false);
  assert.equal(await pathExists("src/styles/trainer-month-program-editor-completed-card-spacing.css"), false);
});

test("workout history and its delete dialog own only colocated scoped styles", async () => {
  const component = await readText("src/features/client/workouts/WorkoutHistoryPage.jsx");
  const moduleCss = await readText("src/features/client/workouts/WorkoutHistoryPage.module.css");
  const dialog = await readText("src/features/client/workouts/HistoryDeleteConfirmDialog.jsx");
  const dialogCss = await readText("src/features/client/workouts/HistoryDeleteConfirmDialog.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const adminHub = await readText("src/components/admin/AdminPanelHub.jsx");
  const accessDenied = await readText("src/components/common/AccessDeniedScreen.jsx");
  const trainerWorkouts = await readText("src/features/trainer/TrainerAdminWorkoutsRoute.jsx");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldHistorySelector = /\.(?:historyPageCompact|historyPagePremium|progressHistoryPage|historyCompact[\w-]*|historySwipeDeleteAction|historyRefreshBtn|historyDelete(?:Overlay|Modal|Icon|Actions)|historyPremium(?:Card|Back))(?![\w-])/;

  assert.match(component, /import styles from "\.\/WorkoutHistoryPage\.module\.css";/);
  assert.match(component, /data-css-module-scope="workout-history"/);
  assert.match(component, /className=\{styles\.page\}/);
  assert.match(component, /className=\{\[styles\.card, isOpen && styles\.open, isSwiped && styles\.swiped\]/);
  assert.match(component, /data-testid="workout-history-card"/);
  assert.match(component, /data-testid="workout-history-empty"/);
  assert.doesNotMatch(component, oldHistorySelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.page\s*\{[\s\S]*?min-height:\s*100dvh;/);
  assert.match(moduleCss, /\.stats\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(moduleCss, /\.card\.swiped \.cardInner\s*\{[\s\S]*?transform:\s*translateX\(-92px\);/);
  assert.match(moduleCss, /@media \(max-width:\s*480px\)/);

  assert.match(dialog, /import styles from "\.\/HistoryDeleteConfirmDialog\.module\.css";/);
  assert.match(dialog, /data-css-module-scope="workout-history-delete"/);
  assert.match(dialog, /className=\{styles\.overlay\}/);
  assert.match(dialog, /className=\{styles\.danger\}/);
  assert.doesNotMatch(dialog, oldHistorySelector);
  assert.doesNotMatch(dialogCss, /!important/);
  assert.match(dialogCss, /\.overlay\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?min-height:\s*100dvh;/);
  assert.match(dialogCss, /\.actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);

  assert.match(harness, /import WorkoutHistoryPage from "\.\.\/\.\.\/features\/client\/workouts\/WorkoutHistoryPage";/);
  assert.match(harness, /clientHarnessPage[\s\S]*?"workoutHistory"/);
  assert.match(harness, /clientHistoryState/);
  assert.doesNotMatch(harness, /WorkoutHistoryPage\.jsx\?/);
  assert.doesNotMatch(legacyCss, oldHistorySelector);
  assert.doesNotMatch(legacyCss, /@keyframes\s+(?:historyBodyIn|historyDeleteFadeIn|historyDeleteModalIn)\b/);
  assert.equal(await pathExists("src/styles/client-history-ai-search-history-redesign.css"), false);
  assert.equal(await pathExists("src/styles/client-history-ai-search-history-width.css"), false);
  assert.equal(await pathExists("src/styles/theme-light-nested-screens-workout-history.css"), false);

  assert.match(legacyCss, /\.historyEmptyCard\s*\{/);
  assert.match(adminHub, /className="historyEmptyCard"/);
  assert.match(accessDenied, /className="historyEmptyCard"/);
  assert.match(trainerWorkouts, /className="historyEmptyCard"/);
});

test("workout mode owns its live page styles while the trainer bottom-bar fallback remains available", async () => {
  const component = await readText("src/features/client/workouts/WorkoutModePage.jsx");
  const moduleCss = await readText("src/features/client/workouts/WorkoutModePage.module.css");
  const basicQuiz = await readText("src/features/client/workouts/BasicWorkoutQuizPage.jsx");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldWorkoutModeSelector = /\.(?:workoutModePage|workoutModeHero|workoutModeLead|workoutModeCards|workoutModeCard|workoutModeIcon|workoutModeRemember|workoutModeBack)(?![\w-])/;

  assert.match(component, /import styles from "\.\/WorkoutModePage\.module\.css";/);
  assert.match(component, /data-css-module-scope="workout-mode"/);
  assert.match(component, /className=\{styles\.page\}/);
  assert.match(component, /className=\{styles\.topButton\}/);
  assert.match(component, /className=\{\[styles\.card, styles\.premium\]\.join\(" "\)\}/);
  assert.match(component, /data-testid="workout-mode-card"/);
  assert.match(component, /data-testid="workout-mode-remember"/);
  assert.doesNotMatch(component, oldWorkoutModeSelector);

  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.page\s*\{[\s\S]*?min-height:\s*100dvh;/);
  assert.match(moduleCss, /\.card\s*\{[\s\S]*?grid-template-columns:\s*46px minmax\(0, 1fr\) 20px;/);
  assert.match(moduleCss, /var\(--color-workout-mode-page-background\)/);
  assert.match(moduleCss, /@media \(max-width:\s*390px\)/);
  assert.doesNotMatch(moduleCss, /clientBottomNav|--client-bottom-nav-/);

  assert.match(harness, /import WorkoutModePage from "\.\.\/\.\.\/features\/client\/workouts\/WorkoutModePage";/);
  assert.match(harness, /clientHarnessPage[\s\S]*?"workoutMode"/);
  assert.doesNotMatch(legacyCss, oldWorkoutModeSelector);
  assert.doesNotMatch(legacyCss, /\.workoutModeTopBar\b/);
  assert.doesNotMatch(legacyCss, /\.workoutModeTopButton\b/);
  assert.match(legacyCss, /\.workoutModeBottomBar/);
  assert.match(basicQuiz, /className:\s*"mainMenuBottomBar profileBottomTabBar workoutModeBottomBar"/);

  assert.equal(await pathExists("src/styles/client-screen-alignment-primary-rhythm-workout-mode.css"), false);
  assert.equal(await pathExists("src/styles/client-screen-alignment-warm-light-workout-mode.css"), false);
  assert.equal(await pathExists("src/styles/trainer-month-program-editor-workout-mode-selector-cards-v305.css"), false);
  assert.equal(await pathExists("src/styles/trainer-month-program-editor-workout-mode-selector-remember-v306.css"), false);
  assert.equal(await pathExists("src/styles/trainer-month-program-editor-workout-mode-selector-warm-light-v307.css"), false);
});

test("basic workout quiz owns its live styles and removes its legacy selector branches", async () => {
  const component = await readText("src/features/client/workouts/BasicWorkoutQuizPage.jsx");
  const moduleCss = await readText("src/features/client/workouts/BasicWorkoutQuizPage.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldQuizSelector = /\.(?:basicQuizPage|basicQuizTopBar|basicQuizCard|basicQuizSectionHeader|basicQuizPreview|basicQuizPreviewStats|basicQuizStartBtn|workoutModeTopBar|workoutModeHeroTitle|workoutModeTopActions|workoutModeTopButton|workoutModeHeaderButton)(?![\w-])/;

  assert.match(component, /import styles from "\.\/BasicWorkoutQuizPage\.module\.css";/);
  assert.match(component, /data-css-module-scope="basic-quiz"/);
  assert.match(component, /className=\{styles\.page\}/);
  assert.match(component, /className=\{styles\.topButton\}/);
  assert.match(component, /className=\{styles\.card\}/);
  assert.match(component, /className=\{styles\.preview\}/);
  assert.match(component, /data-css-module-control/);
  assert.doesNotMatch(component, oldQuizSelector);

  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.page\s*\{[\s\S]*?min-height:\s*100dvh;/);
  assert.match(moduleCss, /var\(--color-basic-quiz-page-background\)/);
  assert.doesNotMatch(moduleCss, /clientBottomNav|--client-bottom-nav-/);
  assert.match(moduleCss, /@media \(max-width:\s*390px\)/);

  assert.match(harness, /import BasicWorkoutQuizPage from "\.\.\/\.\.\/features\/client\/workouts\/BasicWorkoutQuizPage";/);
  assert.match(harness, /clientHarnessPage[\s\S]*?"basicQuiz"/);
  assert.doesNotMatch(legacyCss, oldQuizSelector);
  assert.match(legacyCss, /\.workoutModeBottomBar/);
  assert.match(component, /className:\s*"mainMenuBottomBar profileBottomTabBar workoutModeBottomBar"/);

  assert.equal(await pathExists("src/styles/client-workout-mode-basic-quiz-final.css"), false);
  assert.equal(await pathExists("src/styles/trainer-month-program-editor-workout-mode-basic-quiz.css"), false);
  assert.equal(await pathExists("src/styles/trainer-month-program-editor-workout-mode-quiz-warm-light.css"), false);
  assert.equal(await pathExists("src/styles/trainer-month-program-editor-workout-mode-selector-shell-v304.css"), false);
});

test("workout exercise video frame owns only scoped live styles", async () => {
  const component = await readText("src/features/client/workouts/WorkoutExerciseVideoFrame.jsx");
  const moduleCss = await readText("src/features/client/workouts/WorkoutExerciseVideoFrame.module.css");
  const stageViewCss = await readText("src/features/client/workouts/WorkoutRunStageView.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldVideoSelector = /\.(?:workoutExerciseVideoFrame|exerciseVideo|workoutExerciseVideoLoading|workoutExerciseInlinePlayButton|workoutExerciseInlinePauseButton|workoutExerciseFullscreenButton|workoutExerciseVideoFallback)(?![\w-])/;

  assert.match(component, /import styles from "\.\/WorkoutExerciseVideoFrame\.module\.css";/);
  assert.match(component, /data-testid="workout-exercise-video-frame"/);
  assert.match(component, /data-css-module-control="workout-exercise-video"/);
  assert.match(component, /data-css-module-scope="workout-exercise-video-fallback"/);
  assert.match(component, /className=\{styles\.frame\}/);
  assert.match(component, /className=\{styles\.video\}/);
  assert.doesNotMatch(component, oldVideoSelector);

  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.frame\s*\{[\s\S]*?aspect-ratio:\s*1 \/ 1;/);
  assert.match(moduleCss, /var\(--gradient-workout-video-frame\)/);
  assert.doesNotMatch(moduleCss, /:global\(\.workoutRunPage\)|:global\(\.exerciseSlideCard\)/);
  assert.match(stageViewCss, /\.exerciseCard\.hasVideo\s*\{[\s\S]*?padding:\s*12px 16px 10px;/);
  assert.match(stageViewCss, /--workout-exercise-support-margin:\s*2px 0 7px;/);
  assert.match(moduleCss, /@media \(max-height:\s*740px\)/);
  assert.match(moduleCss, /@media \(min-width:\s*701px\) and \(max-height:\s*740px\)/);

  assert.match(harness, /import WorkoutExerciseVideoFrame from "\.\.\/\.\.\/features\/client\/workouts\/WorkoutExerciseVideoFrame";/);
  assert.match(harness, /clientHarnessPage[\s\S]*?"exerciseVideo"/);
  assert.doesNotMatch(legacyCss, oldVideoSelector);
  assert.equal(await pathExists("src/styles/client-workout-flow-exercise-video.css"), false);
});

test("workout exercise sets and validation toast own only scoped live styles", async () => {
  const component = await readText("src/features/client/workouts/WorkoutExerciseSets.jsx");
  const moduleCss = await readText("src/features/client/workouts/WorkoutExerciseSets.module.css");
  const runRoute = await readText("src/features/client/workouts/WorkoutRunRoute.jsx");
  const runRouteCss = await readText("src/features/client/workouts/WorkoutRunRoute.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldSetSelector = /\.(?:workoutExerciseSets|workoutExerciseSetsTitle|workoutExerciseSetsList|workoutExercisePlanList|workoutExercisePlanRow|workoutExerciseSetNumber|workoutExerciseSetPlan|workoutExerciseSetReps|workoutExerciseSetWeight|workoutExerciseSetActions|workoutExerciseSetEdit|workoutExerciseCompleteButton|workoutSetEditModalBackdrop|workoutSetEditModal|workoutSetEditModalHeader|workoutSetEditModalFields|workoutSetWheelField|workoutSetWheelPicker|workoutSetWheelOption|workoutSetEditDoneButton|workoutAiSharedWeightNote|workoutExerciseValidationToast)(?![\w-])/;

  assert.match(component, /import styles from "\.\/WorkoutExerciseSets\.module\.css";/);
  assert.match(component, /data-css-module-scope="workout-exercise-sets"/);
  assert.match(component, /data-css-module-control="workout-exercise-sets"/);
  assert.match(component, /data-testid="workout-exercise-set-row"/);
  assert.match(component, /data-testid="workout-set-edit-modal"/);
  assert.match(component, /className=\{styles\.root\}/);
  assert.doesNotMatch(component, oldSetSelector);

  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /var\(--color-workout-set-list-surface\)/);
  assert.match(moduleCss, /var\(--gradient-workout-set-done\)/);
  assert.match(moduleCss, /@media \(max-width:\s*370px\)/);
  assert.match(moduleCss, /@media \(max-height:\s*740px\)/);

  assert.match(runRoute, /import styles from "\.\/WorkoutRunRoute\.module\.css";/);
  assert.match(runRoute, /className=\{styles\.validationToast\}/);
  assert.doesNotMatch(runRouteCss, /!important/);
  assert.match(runRouteCss, /var\(--color-workout-validation-surface\)/);

  assert.match(harness, /import WorkoutExerciseSets from "\.\.\/\.\.\/features\/client\/workouts\/WorkoutExerciseSets";/);
  assert.match(harness, /clientHarnessPage[\s\S]*?"exerciseSets"/);
  assert.doesNotMatch(legacyCss, oldSetSelector);

  for (const removedFile of [
    "src/styles/client-workout-flow-exercise-sets.css",
    "src/styles/client-render-target-client-locks-workout-run.css",
    "src/styles/client-render-target-client-locks-workout-run-narrow.css",
    "src/styles/client-render-target-workout-rows-hard-override-v125.css",
    "src/styles/client-render-target-workout-rows-compact-sets-v127.css",
    "src/styles/client-workout-set-rows-plan.css",
    "src/styles/client-workout-set-rows-modal-shell.css",
    "src/styles/client-workout-set-rows-modal-fields.css",
    "src/styles/client-workout-set-rows-wheel.css",
    "src/styles/client-workout-set-rows.css"
  ]) {
    assert.equal(await pathExists(removedFile), false, `${removedFile} must stay removed`);
  }
});

test("workout run route owns its scoped page shell without dead start-slide styles", async () => {
  const route = await readText("src/features/client/workouts/WorkoutRunRoute.jsx");
  const component = await readText("src/features/client/workouts/WorkoutRunPageShell.jsx");
  const moduleCss = await readText("src/features/client/workouts/WorkoutRunPageShell.module.css");
  const variables = await readText("src/styles/_variables.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");

  assert.match(route, /import WorkoutRunPageShell from "\.\/WorkoutRunPageShell";/);
  assert.match(route, /<WorkoutRunPageShell noHeader=\{workoutStarted && !isWorkoutSaved\}>/);
  assert.doesNotMatch(route, /\bapp workoutRunPage\b|workoutRunPageNoHeader/);
  assert.match(component, /import styles from "\.\/WorkoutRunPageShell\.module\.css";/);
  assert.match(component, /className=\{`\$\{styles\.root\} \$\{noHeader \? styles\.noHeader : ""\}`\}/);
  assert.match(component, /data-css-module-scope="workout-run-page"/);
  assert.doesNotMatch(`${route}\n${component}\n${moduleCss}`, /startWorkout(?:Slide|BottomPanel|Button|Icon|Image)/);

  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?--workout-stage-card-height:\s*clamp\(/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?max-width:\s*560px;[\s\S]*?height:\s*100dvh;[\s\S]*?overflow:\s*hidden;/);
  assert.match(moduleCss, /\.noHeader\s*\{[\s\S]*?--workout-stage-card-height:\s*clamp\(/);
  assert.match(moduleCss, /var\(--background-workout-run-page\)/);
  assert.match(moduleCss, /var\(--color-workout-run-page-text\)/);
  assert.match(moduleCss, /@media \(max-height:\s*740px\)/);
  assert.match(moduleCss, /@media \(max-width:\s*390px\)/);
  assert.doesNotMatch(moduleCss, /--workout-stage-card-max-width/);

  assert.match(variables, /--background-workout-run-page:/);
  assert.match(variables, /--color-workout-run-page-text:/);
  assert.match(harness, /import WorkoutRunPageShell from "\.\.\/\.\.\/features\/client\/workouts\/WorkoutRunPageShell";/);
  assert.match(harness, /<WorkoutRunPageShell noHeader=\{noHeader\}>/);
});

test("workout run overlays own scoped controls and no inline presentation styles", async () => {
  const component = await readText("src/features/client/workouts/WorkoutRunOverlays.jsx");
  const moduleCss = await readText("src/features/client/workouts/WorkoutRunOverlays.module.css");
  const stageView = await readText("src/features/client/workouts/WorkoutRunStageView.jsx");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const oldOverlaySelector = /className="(?:workoutCloseButton|workoutHeader workoutHeaderCompact|backIconBtn universalFixedBackPointer|exerciseCounter|workoutTechniqueButton)"|className=\{`workoutStageTitle/;

  assert.match(component, /import styles from "\.\/WorkoutRunOverlays\.module\.css";/);
  assert.match(component, /data-css-module-scope="workout-fullscreen-video-overlay"/);
  assert.match(component, /data-css-module-scope="workout-stage-heading"/);
  assert.match(component, /data-css-module-control="workout-run-overlays"/);
  assert.match(component, /className=\{styles\.fullscreenOverlay\}/);
  assert.match(component, /className=\{styles\.closeButton\}/);
  assert.match(component, /className=\{styles\.techniqueButton\}/);
  assert.match(component, /className=\{styles\.notFoundPage\}/);
  assert.doesNotMatch(component, /className="app"/);
  assert.doesNotMatch(component, /style=\{\{/);
  assert.doesNotMatch(component, oldOverlaySelector);
  assert.doesNotMatch(component, /exerciseCounter/);
  assert.doesNotMatch(stageView, /<WorkoutStageHeading[\s\S]{0,220}currentExerciseIndex=\{currentExerciseIndex\}/);

  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /var\(--color-workout-run-close-border\)/);
  assert.match(moduleCss, /var\(--gradient-workout-run-back\)/);
  assert.match(moduleCss, /var\(--background-workout-run-not-found-page\)/);
  assert.match(moduleCss, /\[data-workout-run-no-header="true"\]/);
  assert.match(moduleCss, /@media \(max-height:\s*720px\)/);

  assert.match(harness, /clientHarnessPage[\s\S]*?"workoutRunOverlays"/);
  assert.match(harness, /<WorkoutRunExercisePreview/);
  assert.doesNotMatch(harness, /className=(?:"|\{`)[^\n]*(?:workoutRunPage|workoutStageDeck|exerciseDeck|workoutStageCard|workoutExerciseCard|workoutExerciseMeta|videoOpenCard)/);
});

test("workout run stages own scoped cards, warmup, finish and navigation styles", async () => {
  const stageView = await readText("src/features/client/workouts/WorkoutRunStageView.jsx");
  const stageCss = await readText("src/features/client/workouts/WorkoutRunStageView.module.css");
  const warmup = await readText("src/features/client/workouts/WorkoutWarmupStage.jsx");
  const warmupCss = await readText("src/features/client/workouts/WorkoutWarmupStage.module.css");
  const actionPanel = await readText("src/features/client/workouts/WorkoutStageActionPanel.jsx");
  const actionPanelCss = await readText("src/features/client/workouts/WorkoutStageActionPanel.module.css");
  const finish = await readText("src/features/client/workouts/WorkoutFinishStage.jsx");
  const finishCss = await readText("src/features/client/workouts/WorkoutFinishStage.module.css");
  const support = await readText("src/features/client/workouts/WorkoutExerciseSupport.jsx");
  const supportCss = await readText("src/features/client/workouts/WorkoutExerciseSupport.module.css");
  const oldStageSelector = /className="[^"]*(?:exerciseDeck|workoutStageDeck|exerciseSlideCard|workoutStageCard|warmupExerciseCard|workoutExerciseCard|workoutExerciseMeta|videoOpenCard|workoutFinishCard|workoutFinishScreen)[^"]*"|className=\{`(?!\$\{styles\.)[^\n]*(?:exerciseDeck|workoutStageDeck|exerciseSlideCard|workoutStageCard|warmupExerciseCard|workoutExerciseCard|workoutExerciseMeta|videoOpenCard|workoutFinishCard|workoutFinishScreen)/;

  assert.match(stageView, /import styles from "\.\/WorkoutRunStageView\.module\.css";/);
  assert.match(stageView, /data-css-module-scope="workout-run-stage"/);
  assert.match(stageView, /data-workout-stage-card=\{isWarmup \? "warmup" : "exercise"\}/);
  assert.doesNotMatch(stageView, oldStageSelector);
  assert.doesNotMatch(finish, oldStageSelector);
  assert.match(warmup, /import styles from "\.\/WorkoutWarmupStage\.module\.css";/);
  assert.match(actionPanel, /import styles from "\.\/WorkoutStageActionPanel\.module\.css";/);
  assert.match(finish, /import styles from "\.\/WorkoutFinishStage\.module\.css";/);
  assert.match(support, /import styles from "\.\/WorkoutExerciseSupport\.module\.css";/);

  for (const moduleCss of [stageCss, warmupCss, actionPanelCss, finishCss, supportCss]) {
    assert.doesNotMatch(moduleCss, /!important/);
  }

  assert.match(stageCss, /var\(--color-workout-run-stage-card-border\)/);
  assert.match(stageCss, /\.exerciseCard\.hasVideo/);
  assert.match(stageCss, /@media \(max-height:\s*740px\)/);
  assert.match(stageCss, /@media \(max-width:\s*640px\)/);
  assert.match(warmupCss, /var\(--color-workout-warmup-item-surface\)/);
  assert.match(actionPanelCss, /var\(--background-workout-stage-panel\)/);
  assert.match(finishCss, /var\(--background-workout-finish-card\)/);
  assert.match(supportCss, /var\(--color-workout-support-note-surface\)/);
});

test("workout dialogs own one colocated scoped module without legacy selectors", async () => {
  const component = await readText("src/components/workout/WorkoutDialogs.jsx");
  const moduleCss = await readText("src/components/workout/WorkoutDialogs.module.css");
  const variables = await readText("src/styles/_variables.css");
  const allCssFiles = await collectFiles("src", [".css"]);
  const allCss = (await Promise.all(allCssFiles.map((file) => readText(file)))).join("\n");
  const legacySelector = /\.(?:workoutDraftRestoreOverlay|workoutDraftRestoreCard|workoutDraftRestoreActions|workoutExitOverlay|workoutExitCard|workoutExitActions|postWorkoutOverlay|postWorkoutCard|postWorkoutGrid|workoutReadinessOverlay|workoutReadinessStage|workoutReadinessCard|workoutReadinessGrid|workoutReadinessActions)\b/;

  assert.match(component, /import styles from "\.\/WorkoutDialogs\.module\.css";/);
  assert.match(component, /data-css-module-scope="workout-dialogs"/);
  assert.match(component, /data-testid="workout-draft-restore-dialog"/);
  assert.match(component, /data-testid="workout-readiness-dialog"/);
  assert.match(component, /data-testid="post-workout-feedback-dialog"/);
  assert.match(component, /data-testid="workout-exit-dialog"/);
  assert.match(component, /data-testid="workout-incomplete-dialog"/);
  assert.doesNotMatch(component, legacySelector);

  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /var\(--background-workout-draft-overlay\)/);
  assert.match(moduleCss, /var\(--background-workout-readiness-overlay\)/);
  assert.match(moduleCss, /@media \(max-width:\s*390px\)/);
  assert.match(moduleCss, /@media \(max-width:\s*640px\)/);
  assert.match(variables, /--background-workout-dialog-primary:/);
  assert.match(variables, /--background-workout-readiness-card:/);
  assert.doesNotMatch(allCss, legacySelector);

  for (const legacyFile of [
    "src/styles/client-workout-dialogs-lazy.css",
    "src/styles/client-workout-flow-readiness.css",
    "src/styles/client-workout-flow-post-workout.css",
    "src/styles/client-workout-flow-ux-readiness.css",
    "src/styles/client-workout-flow-ux-exit.css",
    "src/styles/theme-light-nested-screens-workout-dialogs.css",
    "src/styles/theme-light-nested-screens-workout-readiness.css",
    "src/styles/warm-light-fullscreen-mobile-readiness.css"
  ]) {
    assert.equal(await pathExists(legacyFile), false);
  }
});

test("client workout flow CSS keeps fallback image styles grouped", async () => {
  const source = await readCssWithImports("src/styles/client-workout-flow.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.startWorkoutImageFallback\s*\{\s*width:\s*100%;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.workoutRunPage \.startWorkoutImageFallback b\s*\{\s*color:\s*rgba\(224,\s*242,\s*182,\s*0\.9\);/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.workoutRunPage \.startWorkoutImageFallback small\s*\{\s*display:\s*-webkit-box;/g) || []).length,
    1
  );
});

test("client workout flow CSS keeps select and warmup action controls grouped", async () => {
  const source = await readCssWithImports("src/styles/client-workout-flow.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.warmupNavigationRow\s*\{\s*width:\s*100%;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.workoutRunPage \.warmupBottomPanel \.warmupPreviousButton,\s*\.workoutRunPage \.warmupBottomPanel \.warmupReadyButton\s*\{[\s\S]*?height:\s*78px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.workoutRunPage \.warmupBottomPanel \.warmupPreviousButton\s*\{\s*padding:\s*0 8px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.workoutRunPage \.warmupBottomPanel \.warmupReadyButton\s*\{\s*padding:\s*0 14px !important;/g) || []).length,
    1
  );
});

test("client workout flow CSS keeps start button sizing grouped", async () => {
  const source = await readCssWithImports("src/styles/client-workout-flow.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.startWorkoutBottomPanel \.startWorkoutButton\s*\{\s*width:\s*100% !important;\s*height:\s*78px !important;\s*min-height:\s*78px !important;\s*max-height:\s*78px !important;\s*margin:\s*0 !important;\s*padding:\s*0 18px !important;\s*border-radius:\s*24px !important;\s*font-size:\s*19px !important;\s*\}/g) || []).length,
    1
  );
});

test("client workout flow CSS keeps compact start panel sizing grouped", async () => {
  const source = await readCssWithImports("src/styles/client-workout-flow.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.workoutStageActionPanel,\s*\.workoutRunPage \.startWorkoutBottomPanel\s*\{\s*left:\s*10px !important;\s*right:\s*10px !important;\s*width:\s*calc\(100vw - 20px\) !important;\s*padding-inline:\s*9px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal((source.match(/padding-inline:\s*9px !important;/g) || []).length, 1);
});

test("client workout flow CSS keeps compact run action panel sizing grouped", async () => {
  const source = await readCssWithImports("src/styles/client-workout-flow.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.warmupBottomPanel,\s*\.workoutRunPage \.exerciseActionPanel,\s*\.workoutRunPage \.workoutFinishActionPanel\s*\{\s*left:\s*10px;\s*right:\s*10px;\s*width:\s*calc\(100vw - 20px\);\s*padding-inline:\s*9px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/left:\s*10px;\s*right:\s*10px;\s*width:\s*calc\(100vw - 20px\);\s*padding-inline:\s*9px;/g) || []).length,
    1
  );
});

test("food search results owns its live scoped list, states and result cards", async () => {
  const component = await readText("src/features/client/nutrition/FoodSearchResults.jsx");
  const moduleCss = await readText("src/features/client/nutrition/FoodSearchResults.module.css");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const oldSelectors = /\.(?:fatSearchListPremium|fatRecentFoods|fatRecentFoodsTitle|fatRecentFoodButton|fatSearchStatus|fatFallbackSuggestions|myProductsEmptyState|fatSearchResultCard|fatSearchResultIcon|fatSearchResultInfo|fatSearchResultCheck|fatSearchShowMoreButton|fatAiLoadingBelow)(?![\w-])/;

  assert.match(component, /import styles from "\.\/FoodSearchResults\.module\.css";/);
  assert.match(component, /data-testid="food-search-results"/);
  assert.match(component, /data-css-module-scope="food-search-results"/);
  assert.match(component, /data-food-search-result-card/);
  assert.doesNotMatch(component, oldSelectors);
  assert.doesNotMatch(component, /searchTab === "recent"|showRecentFoods|onRecentFoodSelect/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.list\s*\{[\s\S]*?padding:\s*0 0 calc\(198px \+ var\(--safe-area-bottom\)\);[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*10px;/);
  assert.match(moduleCss, /\.item\s*\{[\s\S]*?min-height:\s*72px;[\s\S]*?grid-template-columns:\s*46px minmax\(0, 1fr\) 28px;[\s\S]*?gap:\s*11px;[\s\S]*?border-radius:\s*19px;/);
  assert.match(moduleCss, /\.itemAction\s*\{[\s\S]*?width:\s*36px;[\s\S]*?height:\s*36px;[\s\S]*?border-radius:\s*50%;/);
  assert.match(moduleCss, /\.status\s*\{[\s\S]*?min-height:\s*78px;[\s\S]*?padding:\s*16px;[\s\S]*?border-radius:\s*19px;/);
  assert.match(moduleCss, /\.loading\s*\{[\s\S]*?min-height:\s*52px;[\s\S]*?margin:\s*8px 0 4px;[\s\S]*?border-radius:\s*18px;/);
  assert.match(moduleCss, /@media \(max-width:\s*390px\)[\s\S]*?grid-template-columns:\s*42px minmax\(0, 1fr\) 24px;[\s\S]*?font-size:\s*10\.5px;/);
  assert.doesNotMatch(legacyCss, oldSelectors);
  assert.equal(await pathExists("src/styles/client-primary-food-flow-search-cleanup-result-check.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-food-editor-search-results-order.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-food-picker-base-ai-mode.css"), false);
});

test("food search overlay owns scoped search, fixture and product shells", async () => {
  const component = await readText("src/features/client/nutrition/FoodSearchOverlay.jsx");
  const moduleCss = await readText("src/features/client/nutrition/FoodSearchOverlay.module.css");

  assert.match(component, /export function FoodSearchSurface/);
  assert.match(component, /styles\.searchOverlay/);
  assert.match(component, /styles\.searchScreen/);
  assert.match(component, /data-css-module-scope="food-search-overlay"/);
  assert.match(component, /className=\{styles\.productOverlay\}/);
  assert.match(component, /className=\{styles\.productLayout\}/);
  assert.match(component, /data-css-module-scope="food-product-overlay"/);
  assert.doesNotMatch(component, /fatFoodSearchOverlay|fatFoodSearchScreen|fatFoodSearchScreenPremium/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.searchOverlay\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?overflow:\s*hidden;[\s\S]*?var\(--color-food-search-overlay-background\)/);
  assert.match(moduleCss, /\.searchScreen\s*\{[\s\S]*?max-width:\s*390px;[\s\S]*?var\(--gradient-food-search-screen\)/);
  assert.match(moduleCss, /\.fixtureLayout\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?var\(--shadow-food-product-screen\)/);
  assert.match(moduleCss, /\.productOverlay,\s*\.productLayout\s*\{[\s\S]*?scrollbar-width:\s*none;[\s\S]*?scrollbar-gutter:\s*auto;/);
  assert.match(moduleCss, /\.productOverlay::-webkit-scrollbar,\s*\.productLayout::-webkit-scrollbar\s*\{[\s\S]*?width:\s*0;[\s\S]*?display:\s*none;/);
});

test("client food search final CSS keeps diary swipe shell sizing in latest owner", async () => {
  const owner = await readText("src/styles/client-food-search-diary-rows-cards.css");
  const source = await readCssWithImports("src/styles/client-food-search.css");

  assert.match(owner, /\.nutritionZoukSwipeShell\s*\{[^{}]*?min-height:\s*64px !important;[^{}]*?border-radius:\s*18px !important;/);
  assert.match(owner, /\.nutritionZoukSwipeShell \+ \.nutritionZoukSwipeShell\s*\{[^{}]*?border-top:\s*1px solid rgba\(224,\s*229,\s*243,\s*0\.92\) !important;/);
  assert.doesNotMatch(owner, /productDeleteBg/);
  assert.doesNotMatch(source, /\.nutritionZoukSwipeShell\s*\{[^{}]*?min-height:\s*58px !important;/);
  assert.doesNotMatch(source, /\.nutritionZoukSwipeShell\s*\{[^{}]*?border-radius:\s*17px !important;/);
  assert.doesNotMatch(source, /\.nutritionZoukSwipeShell \+ \.nutritionZoukSwipeShell\s*\{[^{}]*?border-top:\s*0 !important;/);
  assert.doesNotMatch(source, /productDeleteBg/);
});

test("nutrition orbit CSS keeps inline and modal meal shells grouped", async () => {
  const source = await readCssWithImports("src/styles/nutrition-orbit.css");

  assert.equal(
    (source.match(/\.nutritionZoukBlock \.nutritionZoukMeal,\s*html body #root \.nutritionZoukModalSheet \.nutritionZoukMeal\s*\{\s*overflow:\s*hidden;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.nutritionZoukBlock \.nutritionZoukFood,\s*html body #root \.nutritionZoukModalSheet \.nutritionZoukFood\s*\{\s*width:\s*100%;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.nutritionZoukBlock \.nutritionZoukEmpty,\s*html body #root \.nutritionZoukModalSheet \.nutritionZoukEmpty\s*\{\s*width:\s*calc\(100% - 20px\);/g) || []).length,
    1
  );
});

test("nutrition base CSS keeps compact meal card sizing in the desktop owner", async () => {
  const source = await readCssWithImports("src/styles/nutrition.css");
  const viewportStart = source.indexOf("FIXED NUTRITION VIEWPORT V286");
  const bottomNavStart = source.indexOf("UNIFIED CLIENT BOTTOM NAVIGATION V287", viewportStart);
  const desktopCompactStart = source.indexOf("@media (min-width: 720px) and (max-height: 820px)");

  assert.ok(viewportStart >= 0);
  assert.ok(bottomNavStart > viewportStart);
  assert.ok(desktopCompactStart > bottomNavStart);

  const viewportBlock = source.slice(viewportStart, bottomNavStart);
  assert.doesNotMatch(
    viewportBlock,
    /\.fatSecretPage\.nutritionFixedHeaderV3 \.fatMealCard\s*\{\s*height:\s*70px !important;\s*min-height:\s*70px !important;\s*padding:\s*12px 18px !important;\s*\}/
  );
  assert.match(
    source.slice(desktopCompactStart),
    /@media\s*\(min-width:\s*720px\) and \(max-height:\s*820px\)[\s\S]*?\.fatSecretPage\.nutritionFixedHeaderV3 \.fatMealCard\s*\{\s*height:\s*70px !important;\s*min-height:\s*70px !important;\s*padding:\s*12px 18px !important;\s*\}/
  );
});

test("legacy nutrition header CSS keeps one compact page padding owner", async () => {
  const source = await readCssWithImports("src/styles/nutrition-header-layout.css");
  const compactPremiumStart = source.indexOf("NUTRITION COMPACT PREMIUM ALIGNMENT");
  const oldMobileBlock = source.slice(0, compactPremiumStart);

  assert.ok(compactPremiumStart > 0);
  assert.doesNotMatch(
    oldMobileBlock,
    /@media\s*\(max-width:\s*420px\)[\s\S]*?\.fatSecretPage\s*\{\s*padding-left:\s*14px !important;\s*padding-right:\s*14px !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.fatSecretPage\s*\{\s*padding-left:\s*12px !important;\s*padding-right:\s*12px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatSecretPage\s*\{\s*padding-left:\s*14px !important;\s*padding-right:\s*14px !important;\s*\}/g) || []).length,
    1
  );
  assert.match(
    source.slice(compactPremiumStart),
    /\.fatSecretPage\s*\{\s*padding-left:\s*14px !important;\s*padding-right:\s*14px !important;\s*\}/
  );
});

test("legacy nutrition header CSS keeps calorie row grid in the later owner", async () => {
  const source = await readCssWithImports("src/styles/nutrition-header-layout.css");
  const pixelReferenceStart = source.indexOf("PIXEL-PERFECT REFERENCE RENDER OVERRIDE");
  const compactPolishStart = source.indexOf("FOOD PAGE COMPACT POLISH", pixelReferenceStart);

  assert.ok(pixelReferenceStart > 0);
  assert.ok(compactPolishStart > pixelReferenceStart);

  const refinedDarkBlock = source.slice(0, pixelReferenceStart);
  const referenceBlock = source.slice(pixelReferenceStart, compactPolishStart);

  assert.doesNotMatch(
    refinedDarkBlock,
    /\.fatCalorieRows div\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*1fr auto !important;\s*gap:\s*18px !important;\s*align-items:\s*center !important;\s*\}/
  );
  assert.match(
    referenceBlock,
    /\.fatCalorieRows div\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*1fr auto !important;\s*align-items:\s*center !important;\s*gap:\s*18px !important;\s*\}/
  );
});

test("legacy nutrition header CSS keeps pixel meter span sizes in the later compact owner", async () => {
  const source = await readCssWithImports("src/styles/nutrition-header-layout.css");
  const referenceStart = source.indexOf("NUTRITION PAGE");
  const compactPolishStart = source.indexOf("FOOD PAGE COMPACT POLISH", referenceStart);
  const narrowCompactStart = source.indexOf("@media (max-width: 430px)", compactPolishStart);

  assert.ok(referenceStart >= 0);
  assert.ok(compactPolishStart > referenceStart);
  assert.ok(narrowCompactStart > compactPolishStart);

  const referenceBlock = source.slice(referenceStart, compactPolishStart);
  const compactPolishBlock = source.slice(compactPolishStart, narrowCompactStart);

  assert.doesNotMatch(
    referenceBlock,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatPixelMeter span\s*\{\s*width:\s*7px !important;\s*height:\s*7px !important;\s*\}/
  );
  assert.match(
    compactPolishBlock,
    /\.fatPixelMeter span\s*\{\s*width:\s*7px !important;\s*height:\s*7px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*430px\)[\s\S]*?\.fatPixelMeter span\s*\{\s*width:\s*6px !important;\s*height:\s*6px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatPixelMeter span\s*\{\s*width:\s*5px !important;\s*height:\s*5px !important;\s*\}/
  );
});

test("nutrition summary calories CSS keeps pixel meter width after the header layer", async () => {
  const headerSource = await readCssWithImports("src/styles/nutrition-header-layout.css");
  const summarySource = await readCssWithImports("src/styles/nutrition-summary-calories.css");
  const headerMobileStart = headerSource.indexOf("@media (max-width: 480px)");
  const headerMobileBlock = headerSource.slice(headerMobileStart);

  assert.ok(headerMobileStart > 0);
  assert.doesNotMatch(
    headerMobileBlock,
    /\.fatSecretPage \.fatPixelMeter:not\(\.small\)\s*\{\s*width:\s*52px !important;\s*min-width:\s*52px !important;\s*\}/
  );
  assert.match(
    summarySource,
    /\.fatSecretPage \.fatPixelMeter:not\(\.small\)\s*\{\s*width:\s*52px !important;\s*min-width:\s*52px !important;\s*\}[\s\S]*?@media\s*\(max-width:\s*480px\)[\s\S]*?\.fatSecretPage \.fatPixelMeter:not\(\.small\)\s*\{\s*width:\s*50px !important;\s*min-width:\s*50px !important;\s*\}/
  );
});

test("legacy nutrition header CSS keeps calorie row sizes in later compact owners", async () => {
  const source = await readCssWithImports("src/styles/nutrition-header-layout.css");
  const referenceStart = source.indexOf("NUTRITION PAGE");
  const compactPolishStart = source.indexOf("FOOD PAGE COMPACT POLISH", referenceStart);
  const narrowCompactStart = source.indexOf("@media (max-width: 430px)", compactPolishStart);

  assert.ok(referenceStart >= 0);
  assert.ok(compactPolishStart > referenceStart);
  assert.ok(narrowCompactStart > compactPolishStart);

  const referenceBlock = source.slice(referenceStart, compactPolishStart);

  assert.doesNotMatch(
    referenceBlock,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatCalorieRows span\s*\{\s*font-size:\s*17px !important;\s*\}[\s\S]*?\.fatCalorieRows strong\s*\{\s*font-size:\s*19px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*430px\)[\s\S]*?\.fatCalorieRows span\s*\{\s*font-size:\s*17px !important;\s*\}[\s\S]*?\.fatCalorieRows strong\s*\{\s*font-size:\s*19px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatCalorieRows span\s*\{\s*font-size:\s*15px !important;\s*\}[\s\S]*?\.fatCalorieRows strong\s*\{\s*font-size:\s*17px !important;\s*\}/
  );
});

test("legacy nutrition header CSS keeps meal title sizes in later compact owners", async () => {
  const source = await readCssWithImports("src/styles/nutrition-header-layout.css");
  const referenceStart = source.indexOf("NUTRITION PAGE");
  const compactPolishStart = source.indexOf("FOOD PAGE COMPACT POLISH", referenceStart);
  const narrowCompactStart = source.indexOf("@media (max-width: 430px)", compactPolishStart);

  assert.ok(referenceStart >= 0);
  assert.ok(compactPolishStart > referenceStart);
  assert.ok(narrowCompactStart > compactPolishStart);

  const referenceBlock = source.slice(referenceStart, compactPolishStart);

  assert.doesNotMatch(
    referenceBlock,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatMealTitle strong\s*\{\s*font-size:\s*20px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*430px\)[\s\S]*?\.fatMealTitle strong\s*\{\s*font-size:\s*19px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatMealTitle strong\s*\{\s*font-size:\s*17px !important;\s*\}/
  );
});

test("legacy nutrition header CSS keeps meal kcal sizes in later compact owners", async () => {
  const source = await readCssWithImports("src/styles/nutrition-header-layout.css");
  const referenceStart = source.indexOf("NUTRITION PAGE");
  const compactPolishStart = source.indexOf("FOOD PAGE COMPACT POLISH", referenceStart);
  const narrowCompactStart = source.indexOf("@media (max-width: 430px)", compactPolishStart);

  assert.ok(referenceStart >= 0);
  assert.ok(compactPolishStart > referenceStart);
  assert.ok(narrowCompactStart > compactPolishStart);

  const referenceBlock = source.slice(referenceStart, compactPolishStart);

  assert.doesNotMatch(
    referenceBlock,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatMealKcal strong\s*\{\s*font-size:\s*19px !important;\s*\}[\s\S]*?\.fatMealKcal span\s*\{\s*font-size:\s*12px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*430px\)[\s\S]*?\.fatMealKcal strong\s*\{\s*font-size:\s*18px !important;\s*\}[\s\S]*?\.fatMealKcal span\s*\{\s*margin-top:\s*4px !important;\s*font-size:\s*12px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatMealKcal strong\s*\{\s*font-size:\s*16px !important;\s*\}[\s\S]*?\.fatMealKcal span\s*\{\s*font-size:\s*11px !important;\s*\}/
  );
});

test("legacy nutrition header CSS keeps early narrow meal text sizes out of the old owner", async () => {
  const source = await readCssWithImports("src/styles/nutrition-header-layout.css");
  const pixelReferenceStart = source.indexOf("PIXEL-PERFECT REFERENCE RENDER OVERRIDE");
  const compactPolishStart = source.indexOf("FOOD PAGE COMPACT POLISH", pixelReferenceStart);

  assert.ok(pixelReferenceStart > 0);
  assert.ok(compactPolishStart > pixelReferenceStart);

  const refinedDarkBlock = source.slice(0, pixelReferenceStart);

  assert.doesNotMatch(
    refinedDarkBlock,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatMealTitle strong\s*\{\s*font-size:\s*22px !important;\s*\}[\s\S]*?\.fatMealKcal strong\s*\{\s*font-size:\s*22px !important;\s*\}[\s\S]*?\.fatMealKcal span\s*\{\s*font-size:\s*13px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatMealTitle strong\s*\{\s*font-size:\s*17px !important;\s*\}[\s\S]*?\.fatMealKcal strong\s*\{\s*font-size:\s*16px !important;\s*\}[\s\S]*?\.fatMealKcal span\s*\{\s*font-size:\s*11px !important;\s*\}/
  );
});

test("legacy nutrition header CSS keeps early narrow layout sizes out of the old owner", async () => {
  const source = await readCssWithImports("src/styles/nutrition-header-layout.css");
  const pixelReferenceStart = source.indexOf("PIXEL-PERFECT REFERENCE RENDER OVERRIDE");

  assert.ok(pixelReferenceStart > 0);

  const refinedDarkBlock = source.slice(0, pixelReferenceStart);

  assert.doesNotMatch(
    refinedDarkBlock,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatWeekRow \.fatDayCell span\s*\{\s*width:\s*40px !important;\s*height:\s*40px !important;\s*font-size:\s*25px !important;\s*\}[\s\S]*?\.fatQuickActions button\s*\{\s*font-size:\s*16px !important;\s*\}[\s\S]*?\.fatMealMain\s*\{\s*grid-template-columns:\s*44px minmax\(0, 1fr\) 58px 34px 18px !important;\s*gap:\s*8px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatWeekRow \.fatDayCell span\s*\{\s*width:\s*32px !important;\s*height:\s*32px !important;\s*font-size:\s*21px !important;\s*\}[\s\S]*?\.fatQuickActions button\s*\{\s*min-height:\s*48px !important;\s*font-size:\s*13px !important;\s*\}[\s\S]*?\.fatMealMain\s*\{\s*grid-template-columns:\s*36px minmax\(0, 1fr\) 42px 30px 16px !important;\s*padding:\s*9px 11px !important;\s*gap:\s*7px !important;\s*\}/
  );
});

test("legacy nutrition header CSS keeps reference narrow layout sizes in compact owners", async () => {
  const source = await readCssWithImports("src/styles/nutrition-header-layout.css");
  const pixelReferenceStart = source.indexOf("PIXEL-PERFECT REFERENCE RENDER OVERRIDE");
  const compactPolishStart = source.indexOf("FOOD PAGE COMPACT POLISH", pixelReferenceStart);

  assert.ok(pixelReferenceStart > 0);
  assert.ok(compactPolishStart > pixelReferenceStart);

  const referenceBlock = source.slice(pixelReferenceStart, compactPolishStart);

  assert.match(
    referenceBlock,
    /@media\s*\(max-width:\s*370px\)\s*\{\s*\.fatWeekRow\s*\{\s*gap:\s*7px !important;\s*\}\s*\}/
  );
  assert.doesNotMatch(
    referenceBlock,
    /\.fatWeekRow \.fatDayCell span\s*\{\s*width:\s*38px !important;\s*height:\s*38px !important;\s*font-size:\s*27px !important;\s*\}[\s\S]*?\.fatMealIcon\s*\{\s*width:\s*40px !important;\s*height:\s*40px !important;\s*font-size:\s*31px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*370px\)[\s\S]*?\.fatWeekRow \.fatDayCell span\s*\{\s*width:\s*32px !important;\s*height:\s*32px !important;\s*font-size:\s*21px !important;\s*\}[\s\S]*?\.fatMealIcon\s*\{\s*width:\s*31px !important;\s*height:\s*31px !important;\s*font-size:\s*24px !important;\s*\}/
  );
});

test("legacy nutrition header CSS does not keep exact duplicate blocks", async () => {
  const source = await readCssWithImports("src/styles/nutrition-header-layout.css");
  const seenBlocks = new Set();
  const duplicateBlocks = [];

  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2].trim().replace(/\s+/g, " ");
    if (!body || selector.includes("@")) continue;
    const key = `${selector} { ${body} }`;

    if (seenBlocks.has(key)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      duplicateBlocks.push(`src/styles/nutrition-header-layout.css:${line}`);
    }
    seenBlocks.add(key);
  }

  assert.deepEqual(duplicateBlocks, []);
});

test("legacy food search CSS keeps quick actions hidden in root owners", async () => {
  const headerReference = await readCssWithImports("src/styles/nutrition-food-search-header.css");
  const pickerBase = await readCssWithImports("src/styles/nutrition-food-picker-base.css");
  const caloriesTuning = await readCssWithImports("src/styles/nutrition-food-search-calories.css");

  assert.equal(
    (headerReference.match(/\.fatSecretPage \.fatQuickActions\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (pickerBase.match(/\.fatQuickActions\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (caloriesTuning.match(/\.fatSecretPage \.fatQuickActions,\s*\.fatQuickActions\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
});

test("nutrition food search actions CSS keeps one photo active transform owner", async () => {
  const source = await readCssWithImports("src/styles/nutrition-food-search-actions.css");

  assert.equal(
    (source.match(/\.fatSearchBottomBarFive \.fatSearchPhotoAction:active\s*\{\s*transform:\s*translateX\(-50%\) scale\(0\.97\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchScreenPremium:not\(\[data-food-search-header-layout\]\):has\(\.fatSearchBottomBarFive\)\s*\{\s*padding-bottom:/g) || []).length,
    1
  );
  assert.doesNotMatch(source, /padding-bottom:\s*138px !important;/);
});

test("warm light food search CSS keeps gold action shell grouped", async () => {
  const source = await readCssWithImports("src/styles/warm-light-food-edit-back-buttons.css");

  assert.equal(
    (
      source.match(
        /\.fatFoodSearchScreenPremium \.fatSearchBottomBar button\s*\{\s*background:\s*linear-gradient\(180deg,\s*#f4e064 0%,\s*#e0c94d 100%\) !important;[\s\S]*?box-shadow:\s*0 12px 28px rgba\(151,119,35,0\.16\),\s*inset 0 1px 0 rgba\(255,255,255,0\.38\) !important;[\s\S]*?-webkit-text-fill-color:\s*#5f5744 !important;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\/\* GOLD DONE BUTTON \+ GOLD GRAMS BUTTON \*\/[\s\S]*?\.foodEditPageSave\s*\{\s*background:\s*linear-gradient\(180deg,\s*#f4e064 0%,\s*#e0c94d 100%\) !important;/
  );
  assert.doesNotMatch(
    source,
    /\/\* GOLD BACK BUTTON ON PRODUCT EDIT PAGE \*\/[\s\S]*?\.foodEditPageBack\s*\{\s*background:\s*linear-gradient\(180deg,\s*#f4e064 0%,\s*#e0c94d 100%\) !important;/
  );
});

test("warm light food edit CSS keeps search surface shells grouped", async () => {
  const source = await readCssWithImports("src/styles/warm-light-food-edit-back-buttons.css");

  assert.equal(
    (
      source.match(
        /\.fatFoodSearchScreenPremium \.fatSearchInputWrapPremium,\s*:root\[data-app-theme="warm-light"\] \.fatFoodSearchScreenPremium \.fatSearchHistoryNames\s*\{\s*background:\s*radial-gradient\(circle at 12% 0%, rgba\(244, 224, 100, 0\.18\), transparent 42%\),\s*linear-gradient\(180deg, rgba\(255, 249, 215, 0\.98\) 0%, rgba\(246, 232, 174, 0\.86\) 100%\) !important;[\s\S]*?box-shadow:\s*0 14px 30px rgba\(88, 68, 24, 0\.12\),\s*inset 0 1px 0 rgba\(255, 255, 255, 0\.62\) !important;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.fatSearchInputWrapPremium\s*\{[\s\S]*?\.fatSearchHistoryNames\s*\{\s*background:/
  );
});

test("warm light food edit CSS keeps only the live segment control shell", async () => {
  const source = await readCssWithImports("src/styles/warm-light-food-edit-back-buttons.css");

  assert.equal(
    (
      source.match(
        /\.foodEditSegmentRow button\s*\{\s*background:\s*linear-gradient\(180deg, rgba\(255,249,215,0\.96\) 0%, rgba\(246,232,174,0\.82\) 100%\) !important;\s*border:\s*1px solid rgba\(94,75,30,0\.10\) !important;\s*box-shadow:\s*0 10px 24px rgba\(88,68,24,0\.10\) !important;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.doesNotMatch(
    source,
    /foodEdit(?:AmountCard|MacrosCards|CaloriesMacroCard|RowsCard|RowIcon|RowLabel)/
  );
});

test("warm light add food CSS keeps the remaining refresh action shell grouped", async () => {
  const source = await readText("src/styles/warm-light-add-food-search.css");

  assert.equal(
    (
      source.match(
        /:root\[data-app-theme="warm-light"\] \.menuRefreshIconBtn\s*\{\s*background:\s*linear-gradient\(180deg, rgba\(255, 249, 215, 0\.96\) 0%, rgba\(246, 232, 174, 0\.82\) 100%\) !important;\s*color:\s*#5f5744 !important;\s*border-color:\s*rgba\(94,75,30,0\.12\) !important;\s*box-shadow:\s*0 12px 28px rgba\(88,68,24,0\.12\) !important;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (source.match(/box-shadow:\s*0 12px 28px rgba\(88,68,24,0\.12\) !important;/g) || []).length,
    1
  );
  assert.doesNotMatch(source, /profileThemeSwitchBtn/);
});

test("legacy food editor CSS keeps the remaining details focus states grouped", async () => {
  const source = await readCssWithImports("src/styles/nutrition-food-editor.css");

  assert.equal(
    (source.match(/\.foodEditDetailsPanel input:focus,\s*\.foodEditDetailsPanel textarea:focus\s*\{\s*border-color:\s*rgba\(38,255,116,0\.42\) !important;\s*box-shadow:\s*0 0 0 3px rgba\(38,255,116,0\.055\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/border-color:\s*rgba\(38,255,116,0\.42\) !important;\s*box-shadow:\s*0 0 0 3px rgba\(38,255,116,0\.055\) !important;/g) || []).length,
    1
  );
});

test("nutrition food search actions CSS keeps action active colors grouped", async () => {
  const source = await readCssWithImports("src/styles/nutrition-food-search-actions.css");

  assert.equal(
    (source.match(/\.fatSearchBottomBarFive > button:not\(\.fatSearchPhotoAction\):active\s*\{\s*background:\s*rgba\(143,\s*188,\s*54,\s*0\.055\) !important;\s*color:\s*#aee94d !important;\s*-webkit-text-fill-color:\s*#aee94d !important;\s*\}/g) || []).length,
    1
  );
  assert.equal((source.match(/background:\s*rgba\(143,\s*188,\s*54,\s*0\.055\) !important;/g) || []).length, 1);
});

test("legacy food search calories CSS keeps early mobile column shift out of the old owner", async () => {
  const source = await readCssWithImports("src/styles/nutrition-food-search-calories.css");
  const oldMoveStart = source.indexOf("/* ===== CALORIES MOVE MORE LEFT ===== */");
  const centerAlignStart = source.indexOf("/* ===== PERFECT SCREEN CENTER ALIGN ===== */");
  const oldMoveBlock = source.slice(oldMoveStart, centerAlignStart);

  assert.doesNotMatch(
    oldMoveBlock,
    /\.fatCalorieRows > div:first-child[\s\S]*?transform:\s*translateX\(-24px\) !important;/
  );
  assert.match(
    source,
    /\/\* ===== LEFT CALORIES CLOSER TO GRID ===== \*\/[\s\S]*?\.fatCalorieRows > div:first-child[\s\S]*?transform:\s*translateX\(-24px\) !important;/
  );
});

test("legacy food search calories CSS keeps row transforms in the micro owner", async () => {
  const source = await readCssWithImports("src/styles/nutrition-food-search-calories.css");
  const finalFixStart = source.indexOf("FINAL FIX");
  const microAlignStart = source.indexOf("/* MICRO ALIGN UPDATE */");
  const finalRealFixStart = source.indexOf("FINAL REAL FIX", microAlignStart);
  const oldTransformBlock = source.slice(finalFixStart, microAlignStart);
  const microAlignBlock = source.slice(microAlignStart, finalRealFixStart);

  assert.ok(finalFixStart > 0);
  assert.ok(microAlignStart > 0);
  assert.ok(finalRealFixStart > microAlignStart);
  assert.doesNotMatch(oldTransformBlock, /transform:\s*translateX\(14px\) !important;/);
  assert.doesNotMatch(oldTransformBlock, /transform:\s*translateX\(10px\) !important;/);
  assert.doesNotMatch(oldTransformBlock, /transform:\s*translateX\(8px\) !important;/);
  assert.doesNotMatch(oldTransformBlock, /transform:\s*translateX\(-8px\) !important;/);
  assert.doesNotMatch(oldTransformBlock, /transform:\s*translateX\(-7px\) !important;/);
  assert.doesNotMatch(oldTransformBlock, /transform:\s*translateX\(-6px\) !important;/);
  assert.match(
    microAlignBlock,
    /\.fatSecretPage \.fatCaloriesCard \.fatCalorieRows div:first-child span,[\s\S]*?\.fatSecretPage \.fatCaloriesCard \.fatCalorieRows div:first-child strong\s*\{\s*transform:\s*translateX\(22px\) !important;\s*\}[\s\S]*?\.fatSecretPage \.fatCaloriesCard \.fatCalorieRows div:nth-child\(2\) span,[\s\S]*?\.fatSecretPage \.fatCaloriesCard \.fatCalorieRows div:nth-child\(2\) strong\s*\{\s*transform:\s*translateX\(-18px\) !important;\s*\}/
  );
});

test("legacy food search calories CSS keeps compact dots in the latest mobile owner", async () => {
  const source = await readCssWithImports("src/styles/nutrition-food-search-calories.css");
  const tailSource = await readCssWithImports("src/styles/client-workout-plan-tail.css");

  assert.equal(
    (source.match(/\.nutritionCaloriesRenderGrid span\s*\{\s*width:\s*7px !important;\s*height:\s*7px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (tailSource.match(/\.nutritionCaloriesRenderGrid span\s*\{\s*width:\s*7px !important;\s*height:\s*7px !important;\s*\}/g) || []).length,
    0
  );
  assert.match(
    source,
    /NUTRITION CALORIES RENDER CARD[\s\S]*?@media\s*\(max-width:\s*480px\)[\s\S]*?\.nutritionCaloriesRenderGrid span\s*\{\s*width:\s*7px !important;\s*height:\s*7px !important;\s*\}/
  );
  assert.match(
    tailSource,
    /@media\s*\(max-width:\s*390px\)[\s\S]*?\.nutritionCaloriesRenderGrid\s*\{\s*width:\s*50px !important;\s*min-width:\s*50px !important;[\s\S]*?gap:\s*4px !important;\s*\}[\s\S]*?\.nutritionCaloriesRenderCol span\s*\{\s*font-size:\s*11\.8px !important;/
  );
});

test("legacy client workout plan tail CSS keeps calorie number sizing in compact height owner", async () => {
  const source = await readCssWithImports("src/styles/client-workout-plan-tail.css");
  const finalCleanStart = source.indexOf("CALORIES CARD FINAL CLEAN COPY TUNE");
  const compactHeightStart = source.indexOf("CALORIES CARD COMPACT HEIGHT", finalCleanStart);
  const extraCompactStart = source.indexOf("EXTRA COMPACT CALORIES CARD", compactHeightStart);

  assert.ok(finalCleanStart >= 0);
  assert.ok(compactHeightStart > finalCleanStart);
  assert.ok(extraCompactStart > compactHeightStart);

  const finalCleanBlock = source.slice(finalCleanStart, compactHeightStart);
  const compactHeightBlock = source.slice(compactHeightStart, extraCompactStart);

  assert.doesNotMatch(
    finalCleanBlock,
    /@media\s*\(max-width:\s*390px\)[\s\S]*?\.nutritionCaloriesRenderCol strong\s*\{\s*font-size:\s*31px !important;\s*\}/
  );
  assert.doesNotMatch(
    finalCleanBlock,
    /@media\s*\(max-width:\s*360px\)[\s\S]*?\.nutritionCaloriesRenderCol strong\s*\{\s*font-size:\s*29px !important;\s*\}/
  );
  assert.match(
    compactHeightBlock,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?\.nutritionCaloriesRenderCol strong\s*\{\s*font-size:\s*31px !important;\s*\}[\s\S]*?@media\s*\(max-width:\s*390px\)[\s\S]*?\.nutritionCaloriesRenderCol strong\s*\{\s*font-size:\s*29px !important;\s*\}/
  );
});

test("legacy nutrition summary calories CSS keeps final compact calorie owners", async () => {
  const source = await readCssWithImports("src/styles/nutrition-summary-calories.css");
  const compactRedesignStart = source.indexOf("NUTRITION SUMMARY COMPACT REDESIGN");
  const premiumHarmonicStart = source.indexOf("CALORIES SUMMARY CARD", compactRedesignStart);
  const referenceLayoutStart = source.indexOf("CALORIES CARD", premiumHarmonicStart);
  const halfHeightStart = source.indexOf("HALF HEIGHT COMPACT FIX", referenceLayoutStart);
  const squareGridStart = source.indexOf("SQUARE GRID + LEFT VALUE SHIFT RIGHT FINAL", halfHeightStart);

  assert.ok(compactRedesignStart >= 0);
  assert.ok(premiumHarmonicStart > compactRedesignStart);
  assert.ok(referenceLayoutStart > premiumHarmonicStart);
  assert.ok(halfHeightStart > referenceLayoutStart);
  assert.ok(squareGridStart > halfHeightStart);

  const compactRedesignBlock = source.slice(compactRedesignStart, premiumHarmonicStart);
  const halfHeightBlock = source.slice(halfHeightStart, squareGridStart);
  const squareGridBlock = source.slice(squareGridStart);

  assert.doesNotMatch(
    compactRedesignBlock,
    /\.fatSecretPage \.fatCalorieRows\s*\{\s*gap:\s*7px !important;\s*\}/
  );
  assert.doesNotMatch(
    halfHeightBlock,
    /\.fatSecretPage \.fatCaloriesCard \.fatPixelMeter:not\(\.small\) span\s*\{\s*width:\s*6px !important;\s*height:\s*6px !important;\s*border-radius:\s*2px !important;\s*\}/
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fatSecretPage \.fatCalorieRows\s*\{\s*gap:\s*7px !important;\s*\}/
  );
  assert.match(
    squareGridBlock,
    /@media\s*\(max-width:\s*420px\)[\s\S]*?\.fatSecretPage \.fatCaloriesCard \.fatPixelMeter:not\(\.small\) span\s*\{\s*width:\s*6px !important;\s*height:\s*6px !important;\s*border-radius:\s*2px !important;\s*\}/
  );
});

test("legacy food editor CSS keeps summary dot sizes in root owners", async () => {
  const source = await readCssWithImports("src/styles/nutrition-food-editor.css");

  assert.doesNotMatch(
    source,
    /\.foodEditDeleteButton\s*\{[\s\S]*?border:\s*none!important;[\s\S]*?border:\s*1px solid rgba\(255,\s*90,\s*90,\s*0\.18\)!important;/
  );
  assert.match(
    source,
    /\.foodEditDeleteButton\s*\{[\s\S]*?border:\s*1px solid rgba\(255,\s*90,\s*90,\s*0\.18\)!important;/
  );
  assert.doesNotMatch(
    source,
    /\.foodEditDeleteButton span:last-child\s*\{\s*font-size:\s*16px !important;\s*\}/
  );
  assert.match(
    source,
    /\.foodEditDeleteButton span:last-child\s*\{\s*font-size:\s*16px !important;\s*font-weight:\s*900 !important;\s*letter-spacing:\s*-0\.15px !important;\s*\}/
  );
  assert.doesNotMatch(source, /\.summaryDotGrid\s*\{\s*width:\s*(?:30px|33px) !important;/);
  assert.doesNotMatch(source, /\.summaryCaloriesCard\s*\{\s*grid-template-columns:\s*(?:36px|40px) minmax\(0, 1fr\) !important;/);
  assert.match(source, /\.summaryDotGrid span\s*\{\s*width:\s*7px !important;\s*height:\s*7px !important;\s*\}/);
  assert.match(source, /\.summaryDotGrid span\s*\{\s*width:\s*6\.5px !important;\s*height:\s*6\.5px !important;\s*\}/);
  assert.doesNotMatch(source, /\.foodEditHeroRender\s*\{\s*min-height:\s*105px !important;/);
  assert.doesNotMatch(source, /\.foodEditSegmentRow button\s*\{\s*height:\s*44px !important;/);
  assert.doesNotMatch(source, /\.foodEditMacrosCards div\s*\{\s*min-height:\s*62px !important;/);
  assert.doesNotMatch(source, /\.foodEditBottomActions\s*\{\s*width:calc\(100% - 34px\)!important;/);
  assert.doesNotMatch(source, /\.foodEditDeleteButton,\s*\.foodEditSaveRender\s*\{\s*min-height:60px!important;/);
  assert.doesNotMatch(source, /\.foodEditDeleteButton span:last-child\s*\{\s*font-size:18px!important;/);
  assert.doesNotMatch(source, /\.fatSecretPage:has\(\.foodEditRenderScreen\)[\s\S]*?\.nutritionBackTopLeftV3/);
  assert.match(
    source,
    /\.fatSecretPage:has\(\.fatFoodSearchOverlay\) > \.nutritionBackTopLeftV3,[\s\S]*?\.fatSecretPage:has\(\.fatFoodSearchOverlay\) \.backBtn\.universalFixedBackPointer\s*\{[\s\S]*?display:\s*none !important;[\s\S]*?pointer-events:\s*none !important;/
  );
});

test("food edit page owns a colocated CSS module without legacy page selectors", async () => {
  const component = await readText("src/features/client/nutrition/FoodEditPage.jsx");
  const moduleCss = await readText("src/features/client/nutrition/FoodEditPage.module.css");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const oldSelectors = /\.foodEditPage[\w-]*/;

  assert.match(component, /import styles from "\.\/FoodEditPage\.module\.css";/);
  assert.match(component, /data-css-module-scope="food-edit-page"/);
  assert.match(component, /data-testid="food-edit-page"/);
  assert.match(component, /data-food-edit-page-part="content"/);
  assert.match(component, /data-food-edit-page-part="actions"/);
  assert.match(component, /data-food-edit-page-action="close"/);
  assert.match(component, /data-food-edit-page-action="confirm"/);
  assert.doesNotMatch(component, oldSelectors);
  assert.doesNotMatch(harness, oldSelectors);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.sheet\s*\{[\s\S]*?width:\s*min\(390px, calc\(100vw - 28px\)\);[\s\S]*?max-height:\s*min\(720px, calc\(100dvh - 42px\)\);/);
  assert.match(moduleCss, /\.actionBar\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?height:\s*78px;[\s\S]*?grid-template-columns:\s*0\.88fr 2\.12fr;/);
  assert.match(moduleCss, /@media \(max-width:\s*640px\)[\s\S]*?grid-template-rows:\s*156px minmax\(0, 1fr\);/);
  assert.match(moduleCss, /:global\(:root\[data-app-theme="dark-green"\]\) \.sheet\s*\{[\s\S]*?width:\s*min\(520px, calc\(100vw - 16px\)\);[\s\S]*?height:\s*100dvh;/);
  assert.doesNotMatch(legacyCss, oldSelectors);
});

test("food product page owns a colocated CSS module without legacy product selectors", async () => {
  const component = await readText("src/features/client/nutrition/FoodProductPage.jsx");
  const moduleCss = await readText("src/features/client/nutrition/FoodProductPage.module.css");
  const actionBar = await readText("src/features/client/nutrition/FoodProductActionBar.jsx");
  const harness = await readText("src/components/client/ClientE2EHarness.jsx");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const oldSelectors = /\.(?:foodProductRenderScreen|foodEditRenderScreen|fatFoodAmountScreen|foodProductActionBar)(?![\w-])/;

  assert.match(component, /import styles from "\.\/FoodProductPage\.module\.css";/);
  assert.match(component, /data-css-module-scope="food-product-page"/);
  assert.match(component, /data-testid="food-product-page"/);
  assert.match(actionBar, /data-testid="food-product-action-bar"/);
  assert.doesNotMatch(component, oldSelectors);
  assert.doesNotMatch(actionBar, oldSelectors);
  assert.doesNotMatch(harness, oldSelectors);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?min-height:\s*920px;[\s\S]*?padding:\s*55px 15px calc\(112px \+ env\(safe-area-inset-bottom, 0px\)\);[\s\S]*?background:\s*var\(--gradient-food-product-page\);/);
  assert.match(moduleCss, /@media \(max-width:\s*640px\)[\s\S]*?overflow-y:\s*auto;/);
  assert.match(moduleCss, /:global\(:root\[data-app-theme="dark-green"\]\) \.root\s*\{[\s\S]*?max-width:\s*420px;[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*12px;/);
  assert.doesNotMatch(legacyCss, oldSelectors);
  assert.equal(await pathExists("src/styles/client-food-search-product-compact.css"), false);
  assert.equal(await pathExists("src/styles/client-food-search-product-render-action-bar.css"), false);
  assert.equal(await pathExists("src/styles/client-food-search-product-render-shell.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-food-search-actions-product-bar.css"), false);
  assert.equal(await pathExists("src/styles/client-primary-final-rhythm-geometry-food-product-v427.css"), false);
});

test("food edit basic fields own a scoped CSS module without legacy selectors", async () => {
  const component = await readText("src/features/client/nutrition/FoodEditBasicFields.jsx");
  const moduleCss = await readText("src/features/client/nutrition/FoodEditBasicFields.module.css");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const oldSelectors = /\.(?:foodEditIconManualBox|foodEditIconPreviewManual|foodEditIconPresetRow|foodEditPageGrid|foodEditPortionLabel|foodEditPortionUnitRow|foodEditPortionInlineUnit|foodEditPortionUnitToggle|nutritionProductValidation)(?![\w-])/;

  assert.match(component, /import styles from "\.\/FoodEditBasicFields\.module\.css";/);
  assert.match(component, /data-css-module-scope="food-edit-basic-fields"/);
  assert.match(component, /data-testid="food-edit-basic-name"/);
  assert.match(component, /data-testid="food-edit-basic-icon"/);
  assert.match(component, /data-testid="food-edit-basic-macros"/);
  assert.match(component, /data-testid="food-edit-basic-portion"/);
  assert.match(component, /data-food-edit-basic-action="toggle-unit"/);
  assert.doesNotMatch(component, oldSelectors);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{\s*display:\s*contents;/);
  assert.match(moduleCss, /\.macroGrid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(moduleCss, /:global\(:root\[data-app-theme="dark-green"\]\) \.presetRow\s*\{[\s\S]*?display:\s*flex;/);
  assert.match(moduleCss, /@media \(min-width:\s*760px\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.doesNotMatch(legacyCss, /input:not\(\[data-css-module-control="dish-ingredient-picker"\]\):not\(\[data-css-module-control="food-edit-basic-fields"\]\)/);
  assert.doesNotMatch(legacyCss, oldSelectors);
});

test("dish ingredient picker owns a scoped CSS module without legacy selectors", async () => {
  const component = await readText("src/features/client/nutrition/DishIngredientPicker.jsx");
  const moduleCss = await readText("src/features/client/nutrition/DishIngredientPicker.module.css");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const oldSelectors = /\.dishIngredient(?:Picker|Search|Result|Manual|Empty|Confirm)[\w-]*/;

  assert.match(component, /import styles from "\.\/DishIngredientPicker\.module\.css";/);
  assert.match(component, /data-css-module-scope="dish-ingredient-picker"/);
  assert.match(component, /data-testid="dish-ingredient-picker-sheet"/);
  assert.match(component, /data-testid="dish-ingredient-confirm-card"/);
  assert.match(component, /data-dish-ingredient-result-kind="catalog"/);
  assert.match(component, /data-dish-ingredient-action="add"/);
  assert.doesNotMatch(component, oldSelectors);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.pickerOverlay\s*\{[\s\S]*?z-index:\s*2147483602;[\s\S]*?padding:\s*max\(14px,/);
  assert.match(moduleCss, /\.pickerSheet,[\s\S]*?width:\s*min\(390px, calc\(100vw - 24px\)\);[\s\S]*?border-radius:\s*24px;/);
  assert.match(moduleCss, /\.resultCard\s*\{[\s\S]*?min-height:\s*72px;[\s\S]*?grid-template-columns:\s*46px minmax\(0, 1fr\) 28px;/);
  assert.match(moduleCss, /@media \(min-width:\s*760px\)[\s\S]*?\.confirmInputWrap\s*\{\s*height:\s*64px;/);
  assert.match(moduleCss, /@media \(max-width:\s*390px\)[\s\S]*?grid-template-columns:\s*42px minmax\(0, 1fr\) 24px;/);
  assert.doesNotMatch(legacyCss, oldSelectors);
  assert.equal(await pathExists("src/styles/nutrition-food-editor-workout-close-ingredient-picker.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-food-editor-workout-close-ingredient-confirm.css"), false);
});

test("legacy food product summary CSS no longer owns migrated meal modal rows", async () => {
  const source = await readCssWithImports("src/styles/nutrition-food-products-summary.css");
  const migratedSelectors = /\.(?:productFoodIconWrap|productFoodIcon|productFoodCaloriesUnder|productInfoExact|productRowExact|productArrowExact)(?![\w-])/;

  assert.doesNotMatch(source, migratedSelectors);
  assert.equal(await pathExists("src/styles/nutrition-food-products-summary-products-base.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-food-products-summary-icon-tuning.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-food-products-summary-text-tuning.css"), false);
});

test("admin CRM CSS keeps client card grid breakpoints in the latest owner", async () => {
  const shellSource = await readCssWithImports("src/styles/admin-shell-crm.css");
  const programSource = await readCssWithImports("src/styles/trainer-month-program-editor.css");

  assert.doesNotMatch(shellSource, /@media\s*\(max-width:\s*1280px\)\s*\{\s*\.adminClientCardsGridFive/);
  assert.doesNotMatch(shellSource, /@media\s*\(max-width:\s*1020px\)\s*\{\s*\.adminClientCardsGridFive/);
  assert.doesNotMatch(shellSource, /@media\s*\(max-width:\s*1380px\)[\s\S]*?\.adminClientCardsGridFive\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\) !important;/);
  assert.match(shellSource, /@media\s*\(max-width:\s*1120px\)[\s\S]*?\.adminClientCardsGridFive\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\) !important;/);
  assert.match(programSource, /@media\s*\(min-width:\s*980px\)\s*\{\s*\.adminClientCardsGridFive\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\) !important;/);
});

test("admin calendar reminders CSS keeps one fixed back label visibility owner", async () => {
  const source = await readCssWithImports("src/styles/admin-calendar-reminders.css");

  assert.equal(
    (source.match(/\.adminFixedMainBack b\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
});

test("admin history CSS keeps checkbox visuals in the final visible owner", async () => {
  const source = await readCssWithImports("src/styles/client-history-ai-search.css");

  assert.doesNotMatch(source, /\.adminHistoryCheck\s*\{\s*position:\s*absolute;\s*left:\s*14px;\s*top:\s*50%;\s*transform:\s*translateY\(-50%\);\s*width:\s*28px;\s*height:\s*28px;\s*cursor:\s*pointer;\s*\}/);
  assert.doesNotMatch(source, /\.adminHistoryCheck input:checked \+ i::after\s*\{[\s\S]*?color:\s*rgba\(255,\s*210,\s*210,\s*0\.98\);/);
  assert.equal(
    (source.match(/\.adminHistoryCheck input:checked \+ i::after\s*\{\s*content:\s*"[^"]+";\s*width:\s*100%;\s*height:\s*100%;\s*display:\s*grid;\s*place-items:\s*center;\s*color:\s*rgba\(255,\s*220,\s*220,\s*0\.98\);\s*font-size:\s*17px;\s*font-weight:\s*1000;\s*\}/g) || []).length,
    1
  );
});

test("nutrition page shell and bottom navigation own their styles in colocated CSS Modules", async () => {
  const page = await readText("src/features/client/nutrition/NutritionPage.jsx");
  const view = await readText("src/features/client/nutrition/NutritionPageView.jsx");
  const scrollEffect = await readText("src/features/client/nutrition/useNutritionPageScrollEffect.js");
  const pageCss = await readText("src/features/client/nutrition/NutritionPage.module.css");
  const bottomBar = await readText("src/shared/ui/BottomBar.jsx");
  const bottomBarCss = await readText("src/shared/ui/BottomBar.module.css");
  const sourceFiles = await collectFiles("src", [".js", ".jsx"]);
  const source = (await Promise.all(sourceFiles.map(readText))).join("\n");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");

  assert.match(page, /import styles from "\.\/NutritionPage\.module\.css";/);
  assert.match(page, /className=\{styles\.root\}/);
  assert.match(page, /data-css-module-scope="nutrition-page"/);
  assert.match(page, /data-testid="nutrition-page"/);
  assert.doesNotMatch(page, /fatSecretPage|nutritionFixedHeaderV3|clientCorePageNutrition/);
  assert.match(scrollEffect, /\[data-testid="nutrition-page"\]/);
  assert.doesNotMatch(scrollEffect, /fatSecretPage|nutritionFixedHeaderV3|clientCorePageNutrition/);
  assert.match(view, /variant:\s*"nutrition"/);
  assert.doesNotMatch(view, /nutritionBottomTabBar/);

  assert.match(bottomBar, /import styles from "\.\/BottomBar\.module\.css";/);
  assert.match(bottomBar, /variant === "nutrition"/);
  assert.match(bottomBar, /nutritionVariant\s*\?\s*styles\.nutrition/);
  assert.match(bottomBar, /className=\{activeTab === "nutrition" \? styles\.active : ""\}/);
  assert.match(bottomBar, /"nutrition-bottom-bar"/);
  assert.doesNotMatch(source, /nutritionBottomTabBar/);

  assert.doesNotMatch(pageCss, /!important/);
  assert.match(pageCss, /\.root\s*\{[\s\S]*?position:\s*relative;[\s\S]*?overflow-y:\s*auto;/);
  assert.match(pageCss, /@media \(max-width:\s*640px\)/);
  assert.match(pageCss, /@media \(min-width:\s*1200px\)/);
  assert.doesNotMatch(bottomBarCss, /!important/);
  assert.match(bottomBarCss, /\.nutrition\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(bottomBarCss, /@media \(max-width:\s*640px\)/);
  assert.match(bottomBarCss, /stroke-width:\s*2\.4px;/);
  assert.doesNotMatch(legacyCss, /nutritionBottomTabBar/);
  assert.doesNotMatch(legacyCss, /clientBottomNav/);
});

test("nutrition calendar owns its live styles in a colocated CSS Module", async () => {
  const component = await readText("src/features/client/nutrition/NutritionCalendarModal.jsx");
  const moduleCss = await readText("src/features/client/nutrition/NutritionCalendarModal.module.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldCalendarSelector = /nutritionCalendar(?:Overlay|Backdrop|Sheet|Grabber|Close|Header|Weekdays|Grid|Day|Footer)/;

  assert.match(component, /import styles from "\.\/NutritionCalendarModal\.module\.css";/);
  assert.match(component, /data-css-module-scope="nutrition-calendar-modal"/);
  assert.match(component, /data-nutrition-calendar-day=\{day\.key\}/);
  assert.match(component, /day\.isSelected \? styles\.selected : ""/);
  assert.match(moduleCss, /\.overlay\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*16000;/);
  assert.match(moduleCss, /@media \(max-width:\s*380px\)/);
  assert.match(moduleCss, /:global\(:root\[data-app-theme="dark-green"\]\) \.overlay/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.doesNotMatch(component, oldCalendarSelector);
  assert.doesNotMatch(legacyCss, oldCalendarSelector);
  assert.equal(await pathExists("src/styles/client-history-ai-search-calendar.css"), false);
});

test("nutrition orbit owns only its live scoped styles", async () => {
  const component = await readText("src/features/client/nutrition/NutritionOrbit.jsx");
  const moduleCss = await readText("src/features/client/nutrition/NutritionOrbit.module.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldOrbitSelector = /\.(?:nutritionOrbitPreview|nutritionOrbitPreviewCard|nutritionOrbitStage|nutritionOrbitScene|nutritionOrbitProgressPath|nutritionOrbitAddHalo|nutritionOrbitAddCore|nutritionOrbitAddPlus|nutritionOrbitSvgLabel|nutritionOrbitSvgAmount|nutritionOrbitSvgTarget|nutritionOrbitSvgTitle|nutritionOrbitSvgSubtitle|nutritionOrbitHitButton|haloOuter|haloMiddle|haloInner)(?![\w-])/;

  assert.match(component, /import styles from "\.\/NutritionOrbit\.module\.css";/);
  assert.match(component, /data-testid="nutrition-orbit"/);
  assert.match(component, /data-css-module-scope="nutrition-orbit"/);
  assert.match(component, /data-nutrition-orbit-progress=\{item\.id\}/);
  assert.match(component, /data-testid="nutrition-orbit-add"/);
  assert.doesNotMatch(component, /className=\{`[^`]*\$\{item\.id\}/);
  assert.doesNotMatch(component, oldOrbitSelector);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.card\s*\{[\s\S]*?width:\s*min\(100%, 540px\);[\s\S]*?border-radius:\s*20px;/);
  assert.match(moduleCss, /@media \(max-width:\s*640px\)/);
  assert.match(moduleCss, /@media \(min-width:\s*700px\) and \(max-height:\s*820px\)/);
  assert.match(moduleCss, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(legacyCss, oldOrbitSelector);
  assert.doesNotMatch(legacyCss, /nutritionWaterInline/);
});

test("nutrition meal modal owns only its live scoped styles", async () => {
  const component = await readText("src/features/client/nutrition/NutritionMealModal.jsx");
  const moduleCss = await readText("src/features/client/nutrition/NutritionMealModal.module.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldMealClass = /(?:nutritionMealModal(?:Overlay|Backdrop|Sheet|Header|Icon|List|Add)|product(?:SwipeShell|DeleteBg|RowExact|FoodIconWrap|FoodIcon|FoodCaloriesUnder|InfoExact|ArrowExact))(?![\w-])/;

  assert.match(component, /import styles from "\.\/NutritionMealModal\.module\.css";/);
  assert.match(component, /data-testid="nutrition-meal-modal"/);
  assert.match(component, /data-css-module-scope="nutrition-meal-modal"/);
  assert.match(component, /data-testid="nutrition-meal-food"/);
  assert.match(component, /data-testid="nutrition-meal-add"/);
  assert.match(component, /deletingFoodId === item\.id[\s\S]*?"translateX\(-120%\)"/);
  assert.doesNotMatch(component, oldMealClass);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.overlay\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*9997;/);
  assert.match(moduleCss, /\.sheet\s*\{[\s\S]*?width:\s*min\(430px, 100%\);[\s\S]*?border-radius:\s*var\(--radius-xl\);/);
  assert.match(moduleCss, /\.arrow\s*\{[\s\S]*?justify-self:\s*end;/);
  assert.match(moduleCss, /@media \(max-width:\s*480px\)/);
  assert.match(moduleCss, /:global\(:root\[data-app-theme="warm-light"\]\) \.overlay/);
  assert.doesNotMatch(legacyCss, oldMealClass);
  assert.equal(await pathExists("src/styles/nutrition-ai-plan-shell-meal-surface-modal-shell-v245.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-ai-plan-shell-meal-surface-modal-content-v246.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-food-products-summary-icon-tuning.css"), false);
});

test("nutrition summary owns only its live scoped styles", async () => {
  const component = await readText("src/features/client/nutrition/NutritionSummary.jsx");
  const moduleCss = await readText("src/features/client/nutrition/NutritionSummary.module.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldSummaryClass = /nutritionAiPlanTop(?:Inline|Card|Title)(?![\w-])/;

  assert.match(component, /import styles from "\.\/NutritionSummary\.module\.css";/);
  assert.match(component, /data-testid="nutrition-summary"/);
  assert.match(component, /data-css-module-scope="nutrition-summary"/);
  assert.match(component, /data-state=\{isCaloriesOverGoal \? "over-limit" : "within-limit"\}/);
  assert.match(component, /data-nutrition-summary-part="card"/);
  assert.doesNotMatch(component, oldSummaryClass);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?border-radius:\s*18px;/);
  assert.match(moduleCss, /\.card\s*\{[\s\S]*?min-height:\s*78px;[\s\S]*?grid-template-columns:\s*50px minmax\(0, 1fr\) 40px;/);
  assert.match(moduleCss, /@media \(max-width:\s*520px\)/);
  assert.match(moduleCss, /@media \(max-width:\s*390px\)/);
  assert.doesNotMatch(legacyCss, oldSummaryClass);
});

test("nutrition plan details owns only its live scoped expanded styles", async () => {
  const component = await readText("src/features/client/nutrition/NutritionPlanDetails.jsx");
  const moduleCss = await readText("src/features/client/nutrition/NutritionPlanDetails.module.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(legacyFiles.map(readText))).join("\n");
  const oldPlanClass = /nutritionAiPlan(?:ModalBackdrop|Dashboard|Modal|InlineHidden|Header|TitleBox|ToggleBtn|CollapsedCard|CollapsedHeading|CollapsedContent|CollapsedIcon|CollapsedInsight|CollapsedArrow|CollapsedTop|CollapsedMacros|Body|Rsk|Grid|RskRight|RskInfo|RskFoot|ScoreBlock|Score|MacroPercent|Macros|Conclusion|Badges)(?![\w-])|nutritionAiTrainingDayPill(?![\w-])/;

  assert.match(component, /import styles from "\.\/NutritionPlanDetails\.module\.css";/);
  assert.match(component, /if \(!isExpanded\)\s*\{\s*return null;\s*\}/);
  assert.match(component, /data-testid="nutrition-plan-details"/);
  assert.match(component, /data-testid="nutrition-plan-close"/);
  assert.match(component, /data-testid="nutrition-plan-backdrop"/);
  assert.match(component, /data-css-module-scope="nutrition-plan-details"/);
  assert.match(component, /className=\{styles\.dialog\}[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(component, /data-state=\{isCaloriesOverGoal \? "over-limit" : "within-limit"\}/);
  assert.match(component, /data-nutrition-plan-part="pixel-grid"/);
  assert.doesNotMatch(component, /summaryText|onExpand|nutritionAiPlanCollapsed/);
  assert.doesNotMatch(component, oldPlanClass);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.dialog\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?pointer-events:\s*none;/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?width:\s*min\(420px, calc\(100vw - 24px\)\);/);
  assert.match(moduleCss, /\.calorieProgress\s*\{[\s\S]*?grid-template-columns:\s*72px minmax\(0, 1fr\);/);
  assert.match(moduleCss, /\.score\s*\{[\s\S]*?width:\s*124px;[\s\S]*?height:\s*124px;/);
  assert.match(moduleCss, /@media \(max-width:\s*390px\)/);
  assert.match(moduleCss, /:global\(:root\[data-app-theme="warm-light"\]\) \.root/);
  assert.doesNotMatch(legacyCss, oldPlanClass);
  assert.equal(await pathExists("src/styles/nutrition-ai-plan-lazy-collapsed.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-ai-plan-lazy-colors.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-ai-plan-lazy-compact.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-ai-plan-shell-collapsed-rhythm.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-ai-plan-shell-meal-surface-ai-modal-v243.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-orbit-calories-water-ai-inline-v234.css"), false);
});

test("legacy nutrition late layout CSS keeps no-op mobile duplicates out of old owners", async () => {
  const source = await readCssWithImports("src/styles/nutrition-layout.css");
  const tighterSpacingStart = source.indexOf("TIGHTER SEARCH TO CALORIES SPACING");
  const ultraSpacingStart = source.indexOf("ULTRA TIGHT TOP SPACING", tighterSpacingStart);
  const microGapStart = source.indexOf("MICRO TOP GAP MATCH");
  const actionPanelStart = source.indexOf("ACTION PANEL VERTICAL BALANCE", microGapStart);
  const mealRedesignStart = source.indexOf("MEAL CARDS PREMIUM REDESIGN");
  const compactMealStart = source.indexOf("COMPACT MEAL CARDS", mealRedesignStart);
  const ultraSmallGapStart = source.indexOf("ULTRA SMALL GAP BETWEEN MEAL CARDS");
  const balancedGapStart = source.indexOf("BALANCED GAP BETWEEN MEAL CARDS", ultraSmallGapStart);
  const exactProductListStart = source.indexOf("EXACT PRODUCT LIST REBUILD");
  const forceProductBlockStart = source.indexOf("FORCE PRODUCT BLOCK MUCH WIDER");
  const hardWidthStart = source.indexOf("HARD WIDTH OVERRIDE FOR PRODUCT BLOCK", forceProductBlockStart);
  const inlineWidthStart = source.indexOf("INLINE WIDTH SUPPORT FOR PRODUCT BLOCK", hardWidthStart);
  const widerInnerStart = source.indexOf("WIDER INNER PRODUCT BLOCK", inlineWidthStart);
  const guaranteedWidthStart = source.indexOf("GUARANTEED WIDER INNER PRODUCT BLOCK");
  const productWidthSpacingStart = source.indexOf("PRODUCT BLOCK WIDTH +4% FINAL");
  const exactBottomSpacingStart = source.indexOf("EXACT BOTTOM SPACING MATCH", productWidthSpacingStart);
  const bottomGapStart = source.indexOf("REAL BOTTOM GAP FIX FOR EXPANDED MEAL");
  const darkerOpenStart = source.indexOf("DARKER OPEN MEAL CARD", bottomGapStart);
  const productDeleteAnimationStart = source.indexOf("PRODUCT DELETE ANIMATION WITH RED TRASH BACKGROUND");

  assert.ok(tighterSpacingStart >= 0);
  assert.ok(ultraSpacingStart > tighterSpacingStart);
  assert.ok(microGapStart >= 0);
  assert.ok(actionPanelStart > microGapStart);
  assert.ok(mealRedesignStart >= 0);
  assert.ok(compactMealStart > mealRedesignStart);
  assert.ok(ultraSmallGapStart >= 0);
  assert.ok(balancedGapStart > ultraSmallGapStart);
  assert.ok(exactProductListStart >= 0);
  assert.ok(forceProductBlockStart > exactProductListStart);
  assert.ok(forceProductBlockStart >= 0);
  assert.ok(hardWidthStart > forceProductBlockStart);
  assert.ok(inlineWidthStart > hardWidthStart);
  assert.ok(widerInnerStart > inlineWidthStart);
  assert.ok(guaranteedWidthStart >= 0);
  assert.ok(productWidthSpacingStart > guaranteedWidthStart);
  assert.ok(productWidthSpacingStart >= 0);
  assert.ok(exactBottomSpacingStart > productWidthSpacingStart);
  assert.ok(bottomGapStart >= 0);
  assert.ok(bottomGapStart > exactBottomSpacingStart);
  assert.ok(darkerOpenStart > bottomGapStart);
  assert.ok(productDeleteAnimationStart >= 0);
  assert.equal(source.indexOf("PRODUCT BLOCK WIDTH REDUCE 10%"), -1);
  assert.equal(source.indexOf("PRODUCT BLOCK WIDTH REDUCE AGAIN 10%"), -1);
  assert.equal(source.indexOf("PRODUCT BLOCK WIDTH MINUS 7 PERCENT"), -1);
  assert.equal(source.indexOf("PRODUCT BLOCK WIDTH MINUS 10 PERCENT AGAIN"), -1);
  assert.equal(source.indexOf("PRODUCT LIST 10 PERCENT WIDER"), -1);
  assert.equal(source.indexOf("MATCH BOTTOM SPACING"), -1);
  assert.equal(source.indexOf("PRODUCT BLOCK WIDTH +4% + MATCHED BOTTOM SPACING"), -1);
  assert.equal(source.indexOf("productDeleteFlash"), -1);

  const tighterSpacingBlock = source.slice(tighterSpacingStart, ultraSpacingStart);
  const microGapBlock = source.slice(microGapStart, actionPanelStart);
  const mealRedesignBlock = source.slice(mealRedesignStart, compactMealStart);
  const ultraSmallGapBlock = source.slice(ultraSmallGapStart, balancedGapStart);
  const exactProductListBlock = source.slice(exactProductListStart, forceProductBlockStart);
  const forceProductBlock = source.slice(forceProductBlockStart, hardWidthStart);
  const inlineWidthBlock = source.slice(inlineWidthStart, widerInnerStart);
  const guaranteedWidthBlock = source.slice(guaranteedWidthStart, productWidthSpacingStart);
  const productWidthSpacingBlock = source.slice(productWidthSpacingStart, exactBottomSpacingStart);
  const exactBottomSpacingBlock = source.slice(exactBottomSpacingStart, bottomGapStart);
  const bottomGapBlock = source.slice(bottomGapStart, darkerOpenStart);

  assert.doesNotMatch(
    tighterSpacingBlock,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fatSecretPage \.fatQuickActions,\s*\.fatQuickActions\s*\{\s*margin-bottom:\s*0 !important;\s*\}/
  );
  assert.doesNotMatch(
    microGapBlock,
    /\.fatSecretPage \.nutritionCaloriesRenderCard,\s*\.nutritionCaloriesRenderCard\s*\{\s*margin-top:\s*-13px !important;\s*\}/
  );
  assert.doesNotMatch(
    mealRedesignBlock,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fatSecretPage \.fatMealCard,\s*\.fatMealCard\s*\{\s*border-radius:\s*20px !important;\s*\}/
  );
  assert.doesNotMatch(
    mealRedesignBlock,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fatSecretPage \.fatMealKcal strong,\s*\.fatMealKcal strong\s*\{\s*font-size:\s*16px !important;\s*\}/
  );
  assert.doesNotMatch(
    mealRedesignBlock,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fatSecretPage \.fatPlusBtn,\s*\.fatPlusBtn\s*\{\s*width:\s*24px !important;\s*height:\s*24px !important;\s*min-width:\s*24px !important;\s*min-height:\s*24px !important;[\s\S]*?font-size:\s*18px !important;\s*\}/
  );
  assert.doesNotMatch(
    ultraSmallGapBlock,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fatSecretPage \.fatMealCard \+ \.fatMealCard,\s*\.fatMealCard \+ \.fatMealCard\s*\{\s*margin-top:\s*-1px !important;\s*\}/
  );
  assert.doesNotMatch(
    bottomGapBlock,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fatMealCard\.open \.fatMealItems\.productListWideFinal,\s*\.fatMealCard\.open \.productListExact\.productListWideFinal,\s*\.productListWideFinal\s*\{\s*margin-bottom:\s*0 !important;\s*\}/
  );
  assert.doesNotMatch(
    exactBottomSpacingBlock,
    /\.fatMealCard\.open \.fatMealItems\.productListWideFinal,\s*\.fatMealCard\.open \.productListExact\.productListWideFinal,\s*\.productListWideFinal\s*\{[\s\S]*?margin-left:\s*-17px !important;[\s\S]*?margin-bottom:\s*17px !important;/
  );
  assert.doesNotMatch(
    exactBottomSpacingBlock,
    /@media\s*\(max-width:\s*480px\)[\s\S]*?\.fatMealCard\.open \.fatMealItems\.productListWideFinal,\s*\.fatMealCard\.open \.productListExact\.productListWideFinal,\s*\.productListWideFinal\s*\{[\s\S]*?margin-left:\s*-12px !important;[\s\S]*?margin-bottom:\s*12px !important;/
  );
  assert.doesNotMatch(guaranteedWidthBlock, /width:\s*calc\(100% \+ (?:96px|72px)\) !important;/);
  assert.doesNotMatch(guaranteedWidthBlock, /margin-left:\s*-(?:48px|36px) !important;/);
  assert.doesNotMatch(forceProductBlock, /width:\s*calc\(100% \+ (?:28px|24px)\) !important;/);
  assert.doesNotMatch(forceProductBlock, /margin-left:\s*-(?:14px|12px) !important;/);
  assert.doesNotMatch(forceProductBlock, /width:\s*calc\(100% \+ (?:44px|40px)\) !important;/);
  assert.doesNotMatch(forceProductBlock, /margin-left:\s*-(?:22px|20px) !important;/);
  assert.doesNotMatch(forceProductBlock, /border-radius:\s*22px !important;/);
  assert.doesNotMatch(exactProductListBlock, /width:\s*calc\(100% - (?:4px|2px)\) !important;/);
  assert.doesNotMatch(
    inlineWidthBlock,
    /\.productRowExact\s*\{\s*box-sizing:\s*border-box !important;\s*max-width:\s*none !important;\s*\}/
  );
  assert.doesNotMatch(
    guaranteedWidthBlock,
    /\.fatMealCard\.open\s*\{\s*overflow:\s*visible !important;\s*\}/
  );
  assert.doesNotMatch(source, /@keyframes\s+productDeleteCollapse/);
  assert.doesNotMatch(source, /\.productSwipeShell\.deleting\s*\{\s*animation:\s*productDeleteCollapse/);
  assert.doesNotMatch(source, /\.productRowExact\.deleting\s*\{\s*transform:\s*translateX\(-120%\) !important;\s*opacity:\s*0 !important;\s*\}/);

  assert.match(
    source,
    /FINAL GAP \+ CALORIE NUMBERS TUNE[\s\S]*?@media\s*\(max-width:\s*480px\)[\s\S]*?\.fatSecretPage \.nutritionCaloriesRenderCard,\s*\.nutritionCaloriesRenderCard\s*\{\s*margin-top:\s*-13px !important;\s*\}/
  );
  assert.match(
    source,
    /\.fatSecretPage \.fatQuickActions,\s*\.fatQuickActions\s*\{\s*margin-bottom:\s*0 !important;\s*\}/
  );
  assert.match(
    source,
    /LOWER MEAL CARD HEIGHT[\s\S]*?\.fatSecretPage \.fatPlusBtn,\s*\.fatPlusBtn\s*\{\s*width:\s*24px !important;\s*height:\s*24px !important;\s*min-width:\s*24px !important;\s*min-height:\s*24px !important;[\s\S]*?font-size:\s*18px !important;\s*\}/
  );
  assert.match(
    source,
    /REAL BOTTOM GAP FIX FOR EXPANDED MEAL[\s\S]*?\.fatMealCard\.open \.fatMealItems\.productListWideFinal,\s*\.fatMealCard\.open \.productListExact\.productListWideFinal,\s*\.productListWideFinal\s*\{\s*margin-bottom:\s*0 !important;\s*\}/
  );
  assert.match(
    productWidthSpacingBlock,
    /\.fatMealCard\.open \.fatMealItems\.productListWideFinal,\s*\.fatMealCard\.open \.productListExact\.productListWideFinal,\s*\.productListWideFinal\s*\{[\s\S]*?width:\s*calc\(100% \+ 34px\) !important;[\s\S]*?margin-left:\s*-17px !important;[\s\S]*?@media\s*\(max-width:\s*480px\)[\s\S]*?width:\s*calc\(100% \+ 24px\) !important;[\s\S]*?margin-left:\s*-12px !important;/
  );
  assert.doesNotMatch(productWidthSpacingBlock, /margin-bottom:\s*(?:17px|12px) !important;/);
  assert.match(
    exactBottomSpacingBlock,
    /\.fatMealCard\.open \.productListWideFinal \+ \*,\s*\.productListWideFinal \+ \*\s*\{\s*margin-top:\s*0 !important;\s*\}/
  );
});

test("legacy nutrition late layout CSS keeps remaining expanded food-item text grouped", async () => {
  const source = await readCssWithImports("src/styles/nutrition-layout.css");

  assert.equal(
    (source.match(/\.fatSecretPage \.fatFoodItem strong,\s*\.fatFoodItem strong\s*\{\s*display:\s*block !important;\s*max-width:\s*100% !important;[\s\S]*?font-size:\s*17px !important;[\s\S]*?text-overflow:\s*ellipsis !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatSecretPage \.fatFoodItem span,\s*\.fatFoodItem span\s*\{\s*display:\s*block !important;\s*margin-top:\s*6px !important;[\s\S]*?font-size:\s*17px !important;[\s\S]*?line-height:\s*1 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/display:\s*block !important;\s*max-width:\s*100% !important;\s*color:\s*rgba\(247,\s*248,\s*251,\s*0\.94\) !important;\s*font-size:\s*17px !important;\s*font-weight:\s*950 !important;\s*line-height:\s*1\.12 !important;\s*letter-spacing:\s*-0\.35px !important;\s*white-space:\s*nowrap !important;\s*overflow:\s*hidden !important;\s*text-overflow:\s*ellipsis !important;/g) || []).length,
    1
  );
});

test("admin client dashboard polish CSS has no empty media blocks", async () => {
  const source = await readCssWithImports("src/styles/admin-client-dashboard.css");

  assert.doesNotMatch(source, /@media\s+[^{]+\{\s*\}/);
});

test("admin client dashboard polish CSS keeps calendar layout in final owner", async () => {
  const source = await readCssWithImports("src/styles/admin-client-dashboard.css");

  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarHead\s*\{\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*align-items:\s*center !important;\s*justify-content:\s*center !important;\s*gap:\s*8px !important;\s*text-align:\s*center !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged\s*\{\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*gap:\s*14px !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged\s*\{\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*gap:\s*14px !important;\s*padding:\s*20px !important;\s*border-radius:\s*28px !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarHead\s*\{\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*align-items:\s*center !important;\s*justify-content:\s*center !important;\s*text-align:\s*center !important;\s*gap:\s*8px !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarHead span\s*\{\s*display:\s*block !important;\s*margin:\s*0 !important;\s*white-space:\s*nowrap !important;\s*text-align:\s*center !important;[\s\S]*?letter-spacing:\s*\.12em !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarPerDaySettings\s*\{\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*gap:\s*12px !important;\s*width:\s*100% !important;\s*margin:\s*0 !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarTelegram\s*\{\s*display:\s*inline-flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*center !important;\s*gap:\s*8px !important;\s*width:\s*fit-content !important;\s*min-height:\s*30px !important;/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarTelegram::before\s*\{\s*content:\s*"" !important;\s*width:\s*8px !important;\s*height:\s*8px !important;\s*border-radius:\s*999px !important;\s*background:\s*rgba\(255,255,255,\.34\) !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarTelegram\.connected\s*\{\s*background:\s*rgba\(92, 255, 84, \.08\) !important;\s*border-color:\s*rgba\(92, 255, 84, \.16\) !important;\s*color:\s*rgba\(220,255,210,\.9\) !important;\s*\}\s*\.adminCalendarPanelMerged \.adminCalendarEqualButton\s*\{[\s\S]*?height:\s*64px !important;/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarHourReminder i\s*\{\s*width:\s*38px !important;\s*height:\s*22px !important;\s*border-radius:\s*999px !important;\s*background:\s*rgba\(255,255,255,\.12\) !important;[\s\S]*?flex:\s*0 0 auto !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarHourReminder i::before\s*\{\s*content:\s*"" !important;\s*position:\s*absolute !important;\s*width:\s*18px !important;\s*height:\s*18px !important;[\s\S]*?transition:\s*\.18s ease !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarHourReminder\.active i::before\s*\{\s*transform:\s*translateX\(16px\) !important;\s*background:\s*#fff !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarDaySettingsHeader\s*\{\s*display:\s*flex !important;\s*align-items:\s*center !important;\s*gap:\s*10px !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarDaySettingsName\s*\{\s*color:\s*rgba\(255,255,255,\.78\) !important;\s*font-size:\s*14px !important;\s*font-weight:\s*900 !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarDayTimeGrid\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;\s*gap:\s*10px !important;\s*width:\s*100% !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarDaySettingsRow label\s*\{\s*display:\s*block !important;\s*min-height:\s*0 !important;\s*height:\s*auto !important;[\s\S]*?background:\s*transparent !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarDaySettingsRow label span\s*\{\s*display:\s*block !important;\s*margin:\s*0 0 7px !important;\s*font-size:\s*11px !important;[\s\S]*?text-align:\s*left !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarEqualButtonsWrap > button,\s*\.adminCalendarPanelMerged \.adminCalendarEqualButton,\s*\.adminCalendarPanelMerged \.adminV3OpenEditor,\s*\.adminCalendarPanelMerged \.adminCalendarTestButton\s*\{\s*width:\s*100% !important;\s*min-height:\s*64px !important;[\s\S]*?box-sizing:\s*border-box !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarTestButton\s*\{\s*background:\s*#071b1d !important;\s*border:\s*1px solid rgba\(255,255,255,\.07\) !important;\s*color:\s*rgba\(255,255,255,\.72\) !important;\s*box-shadow:\s*none !important;\s*font-size:\s*11px !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarEqualButtonsWrap \.adminCalendarReminderButton,\s*\.adminCalendarEqualButtonsWrap \.adminCalendarSaveButton,\s*\.adminCalendarEqualButtonsWrap \.adminCalendarTestButton,[\s\S]*?height:\s*64px !important;[\s\S]*?padding:\s*0 18px !important;/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarDaySettingsRow\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*42px minmax\(0, 1fr\) minmax\(0, 1fr\) 76px !important;[\s\S]*?background:\s*rgba\(255,255,255,\.04\) !important;/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarDays\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\) !important;\s*gap:\s*7px !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarHead h3\s*\{\s*margin:\s*0 !important;\s*text-align:\s*center !important;\s*font-size:\s*26px !important;\s*line-height:\s*1\.05 !important;\s*letter-spacing:\s*-.03em !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarHead h3\s*\{\s*width:\s*100% !important;\s*margin:\s*0 !important;\s*text-align:\s*center !important;\s*font-size:\s*26px !important;\s*line-height:\s*1\.05 !important;\s*letter-spacing:\s*-.035em !important;\s*color:\s*#fff !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarTelegram\s*\{\s*order:\s*2 !important;\s*display:\s*inline-flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*center !important;\s*gap:\s*8px !important;\s*min-height:\s*30px !important;\s*height:\s*30px !important;/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarToggle,\s*\.adminCalendarPanelMerged \.adminCalendarSaveBtn,\s*\.adminCalendarPanelMerged \.adminCalendarTestBtn,\s*\.adminCalendarPanelMerged button\[class\*="Toggle"\],\s*\.adminCalendarPanelMerged button\[class\*="Save"\],\s*\.adminCalendarPanelMerged button\[class\*="Test"\]\s*\{\s*width:\s*100% !important;\s*min-height:\s*64px !important;\s*height:\s*64px !important;\s*padding:\s*14px 18px !important;/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarTestBtn,\s*\.adminCalendarPanelMerged button\[class\*="Test"\]\s*\{\s*max-width:\s*(?:320px|100%) !important;[\s\S]*?border-radius:\s*(?:20px|22px) !important;/
  );
  assert.doesNotMatch(source, /\.adminCalendarPanelMerged \.adminCalendar(?:Toggle|SaveBtn|TestBtn)\b/);
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged\s*\{\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*gap:\s*(?:12px|16px) !important;/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged > \.adminCalendarSettingsGrid\s*\{\s*order:\s*3 !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;/
  );
  assert.doesNotMatch(
    source,
    /@media\s*\(max-width:\s*420px\)\s*\{\s*\.adminCalendarPanelMerged\s*\{\s*padding:\s*18px !important;\s*gap:\s*13px !important;\s*\}[\s\S]*?\.adminCalendarHourReminder\s*\{\s*height:\s*42px !important;\s*min-height:\s*42px !important;\s*font-size:\s*12px !important;\s*\}\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarPanelMerged \.adminCalendarDaySettingsRow\s*\{\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*gap:\s*12px !important;\s*width:\s*100% !important;[\s\S]*?box-sizing:\s*border-box !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarDaySettingsTitle\s*\{\s*width:\s*46px !important;\s*height:\s*42px !important;\s*border-radius:\s*15px !important;[\s\S]*?font-size:\s*14px !important;\s*font-weight:\s*950 !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarDaySettingsRow input\s*\{\s*width:\s*100% !important;\s*height:\s*42px !important;\s*min-height:\s*42px !important;\s*border-radius:\s*14px !important;\s*font-size:\s*15px !important;\s*font-weight:\s*900 !important;\s*text-align:\s*center !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminCalendarHourReminder\s*\{\s*width:\s*100% !important;\s*height:\s*46px !important;\s*min-height:\s*46px !important;\s*padding:\s*0 14px !important;[\s\S]*?box-sizing:\s*border-box !important;\s*\}/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarPanelMerged\s*\{\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*gap:\s*14px !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarPanelMerged \.adminCalendarHead\s*\{\s*order:\s*1 !important;\s*display:\s*flex !important;\s*flex-direction:\s*column !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarPanelMerged \.adminCalendarHead h3\s*\{\s*width:\s*100% !important;\s*margin:\s*0 !important;[\s\S]*?\.adminCalendarPanelMerged \.adminCalendarTelegram\s*\{\s*order:\s*2 !important;\s*display:\s*inline-flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*center !important;\s*gap:\s*9px !important;[\s\S]*?white-space:\s*nowrap !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarPanelMerged \.adminCalendarTelegram\.connected\s*\{\s*background:\s*rgba\(92, 255, 84, \.08\) !important;\s*border-color:\s*rgba\(92, 255, 84, \.16\) !important;\s*color:\s*rgba\(220,255,210,\.9\) !important;\s*\}/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarPanelMerged \.adminCalendarTelegram::before\s*\{\s*content:\s*"" !important;\s*width:\s*11px !important;\s*height:\s*11px !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarHourReminder i\s*\{\s*width:\s*48px !important;\s*height:\s*28px !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarHourReminder i::before\s*\{\s*content:\s*"" !important;\s*position:\s*absolute !important;\s*width:\s*24px !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarHourReminder\.active i::before\s*\{\s*transform:\s*translateX\(20px\) !important;\s*background:\s*#fff !important;\s*\}/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarHourReminder\.active\s*\{\s*background:\s*rgba\(127,159,58,\.16\) !important;\s*border-color:\s*rgba\(127,159,58,\.30\) !important;\s*color:\s*rgba\(255,255,255,\.92\) !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarPanelMerged \.adminCalendarDays\s*\{\s*order:\s*2 !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(7, minmax\(0, 1fr\)\) !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarPanelMerged \.adminCalendarHead span\s*\{\s*display:\s*none !important;\s*\}/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarPanelMerged \.adminCalendarPerDaySettings\s*\{\s*order:\s*4 !important;\s*display:\s*flex !important;\s*flex-direction:\s*column !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarPanelMerged \.adminCalendarDaySettingsRow\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*64px minmax\(0, 1fr\) minmax\(0, 1fr\) !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarDaySettingsHeader\s*\{\s*grid-area:\s*day !important;\s*display:\s*flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*center !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarDaySettingsName\s*\{\s*display:\s*none !important;\s*\}/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarDayTimeGrid\s*\{\s*display:\s*contents !important;\s*\}/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarDayTimeGrid label\s*\{\s*display:\s*block !important;\s*min-height:\s*0 !important;\s*height:\s*auto !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarDaySettingsTitle\s*\{\s*width:\s*58px !important;\s*height:\s*58px !important;\s*border-radius:\s*18px !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarDaySettingsRow input\s*\{\s*width:\s*100% !important;\s*height:\s*46px !important;\s*min-height:\s*46px !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarHourReminder\s*\{\s*grid-area:\s*hour !important;\s*width:\s*100% !important;\s*height:\s*48px !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?@media\s*\(max-width:\s*420px\)\s*\{[\s\S]*?\.adminCalendarPanelMerged\s*\{\s*padding:\s*18px 14px 16px !important;\s*gap:\s*12px !important;\s*border-radius:\s*26px !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarEqualButtonsWrap\s*\{\s*order:\s*5 !important;\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*gap:\s*12px !important;\s*width:\s*100% !important;\s*\}[\s\S]*?\.adminCalendarEqualButtonsWrap > button,\s*\.adminCalendarPanelMerged \.adminCalendarEqualButton,\s*\.adminCalendarPanelMerged \.adminV3OpenEditor,\s*\.adminCalendarPanelMerged \.adminCalendarTestButton\s*\{\s*width:\s*100% !important;\s*min-height:\s*62px !important;[\s\S]*?padding:\s*0 18px !important;\s*text-align:\s*center !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarPanelMerged \.adminCalendarTestButton\s*\{[\s\S]*?font-size:\s*14px !important;\s*line-height:\s*1\.1 !important;/
  );
  assert.match(
    source,
    /\/\* === CALENDAR MATCH RENDER V62 === \*\/[\s\S]*?\.adminCalendarPanelMerged button\[class\*="Toggle"\],\s*\.adminCalendarPanelMerged button\[class\*="Save"\],\s*\.adminCalendarPanelMerged button\[class\*="Test"\]\s*\{\s*width:\s*100% !important;\s*min-height:\s*64px !important;\s*height:\s*64px !important;\s*max-height:\s*64px !important;[\s\S]*?@media\s*\(max-width:\s*420px\)\s*\{[\s\S]*?\.adminCalendarPanelMerged button\[class\*="Test"\]\s*\{\s*min-height:\s*60px !important;\s*height:\s*60px !important;\s*max-height:\s*60px !important;\s*padding:\s*0 16px !important;\s*border-radius:\s*20px !important;/
  );
});

test("admin client dashboard polish CSS keeps nutrition month summary shells grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-client-dashboard.css");

  assert.doesNotMatch(
    source,
    /\.adminNutritionMonthSummaryBelow\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;\s*gap:\s*10px !important;\s*margin-top:\s*14px !important;\s*width:\s*100% !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.adminNutritionMonthHead \.adminNutritionMonthSummary\s*\{\s*order:\s*4 !important;\s*margin-top:\s*14px !important;\s*width:\s*100% !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;\s*gap:\s*10px !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.adminNutritionMonthHead \.adminNutritionMonthSummary\s*\{\s*order:\s*99 !important;\s*margin-top:\s*14px !important;\s*width:\s*100% !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;\s*gap:\s*10px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminNutritionMonthSummaryBelow\s*\{\s*display:\s*grid !important;\s*order:\s*initial !important;\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;\s*gap:\s*10px !important;\s*margin-top:\s*14px !important;\s*width:\s*100% !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminNutritionMonthSummary > div,\s*\.adminNutritionMonthSummaryBelow > div\s*\{\s*min-height:\s*74px !important;\s*padding:\s*14px !important;\s*border-radius:\s*20px !important;\s*background:\s*linear-gradient\(180deg, rgba\(20, 24, 20, \.98\), rgba\(12, 15, 12, \.98\)\) !important;\s*border:\s*1px solid rgba\(255,255,255,\.06\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminNutritionMonthSummary span,\s*\.adminNutritionMonthSummaryBelow span\s*\{\s*color:\s*rgba\(255,255,255,\.48\) !important;\s*font-size:\s*11px !important;\s*font-weight:\s*900 !important;\s*text-transform:\s*uppercase !important;\s*letter-spacing:\s*\.04em !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminNutritionMonthSummary strong,\s*\.adminNutritionMonthSummaryBelow strong\s*\{\s*color:\s*#fff !important;\s*font-size:\s*18px !important;\s*line-height:\s*1\.1 !important;\s*margin-top:\s*6px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminNutritionMonthSummary small,\s*\.adminNutritionMonthSummaryBelow small\s*\{\s*color:\s*rgba\(195,255,126,\.72\) !important;\s*font-size:\s*12px !important;\s*\}/g) || []).length,
    1
  );
  const standaloneSummaryBelowBlocks = [...source.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
    .map((match) => match[1].trim().replace(/\s+/g, " "));

  assert.equal(standaloneSummaryBelowBlocks.includes(".adminNutritionMonthSummaryBelow strong"), false);
  assert.equal(standaloneSummaryBelowBlocks.includes(".adminNutritionMonthSummaryBelow small"), false);
});

test("legacy admin program editor CSS has no empty media blocks", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.doesNotMatch(source, /@media\s+[^{]+\{\s*\}/);
});

test("legacy admin program editor CSS keeps shared button shell grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramBack,\s*\.adminProgramTopActions button,\s*\.adminProgramTemplateDock button,\s*\.adminProgramDaysPanel button,\s*\.adminProgramWorkoutHeader button,\s*\.adminProgramEmptyDay button,\s*\.adminInspectorPreviewButton,\s*\.adminProgramGridBack,\s*\.adminProgramGridSave,\s*\.adminProgramTemplateStrip button,\s*\.adminProgramDayActions button,\s*\.adminProgramGridSectionHead button,\s*\.adminProgramEmptyExerciseList button\s*\{\s*min-height:\s*42px;\s*border-radius:\s*14px;\s*border:\s*1px solid rgba\(255,255,255,\.07\);\s*background:\s*rgba\(255,255,255,\.045\);\s*color:\s*rgba\(255,255,255,\.82\);\s*font-weight:\s*950;\s*cursor:\s*pointer;\s*\}/g) || []).length,
    1
  );

  assert.equal(
    (source.match(/min-height:\s*42px;\s*border-radius:\s*14px;\s*border:\s*1px solid rgba\(255,255,255,\.07\);\s*background:\s*rgba\(255,255,255,\.045\);\s*color:\s*rgba\(255,255,255,\.82\);\s*font-weight:\s*950;\s*cursor:\s*pointer;/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps stats grids grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramStatsRow,\s*\.adminProgramGridStats\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(4, minmax\(130px, 1fr\)\);\s*gap:\s*10px;\s*margin-bottom:\s*10px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/display:\s*grid;\s*grid-template-columns:\s*repeat\(4, minmax\(130px, 1fr\)\);\s*gap:\s*10px;\s*margin-bottom:\s*10px;/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps shared max width shell grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramStatsRow,\s*\.adminProgramTemplateDock,\s*\.adminProgramLayout,\s*\.adminProgramGridTopbar,\s*\.adminProgramGridStats,\s*\.adminProgramTemplateStrip,\s*\.adminProgramGridSection,\s*\.adminProgramExerciseEditorBlock\s*\{\s*max-width:\s*1680px;\s*margin-left:\s*auto;\s*margin-right:\s*auto;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/max-width:\s*1680px;\s*margin-left:\s*auto;\s*margin-right:\s*auto;/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps muted header paragraphs grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramTitleBlock p,\s*\.adminProgramGridTopbar p,\s*\.adminProgramGridSectionHead p\s*\{\s*margin:\s*0;\s*color:\s*rgba\(255,255,255,\.48\);\s*font-size:\s*12px;\s*font-weight:\s*850;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminProgramGridTopbar p,\s*\.adminProgramGridSectionHead p/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps accent button states grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramTopActions button:first-child,\s*\.adminProgramTemplateDock button,\s*\.adminProgramWorkoutHeader button:last-child,\s*\.adminProgramEmptyDay button,\s*\.adminInspectorPreviewButton,\s*\.adminProgramGridSave,\s*\.adminProgramTemplateStrip button,\s*\.adminProgramGridSectionHead button,\s*\.adminProgramEmptyExerciseList button\s*\{\s*border-color:\s*rgba\(127,159,58,\.28\);\s*background:\s*rgba\(127,159,58,\.14\);\s*color:\s*rgba\(235,250,195,\.95\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminProgramGridSave,\s*\.adminProgramTemplateStrip button,\s*\.adminProgramGridSectionHead button,\s*\.adminProgramEmptyExerciseList button/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps topbar shell grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramTopbar,\s*\.adminProgramGridTopbar\s*\{\s*min-height:\s*78px;\s*padding:\s*14px;\s*border-radius:\s*24px;\s*border:\s*1px solid rgba\(255,255,255,\.055\);\s*background:\s*rgba\(255,255,255,\.032\);\s*display:\s*grid;\s*grid-template-columns:\s*auto 1fr auto;\s*gap:\s*16px;\s*align-items:\s*center;\s*backdrop-filter:\s*blur\(18px\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/min-height:\s*78px;\s*padding:\s*14px;\s*border-radius:\s*24px;\s*border:\s*1px solid rgba\(255,255,255,\.055\);\s*background:\s*rgba\(255,255,255,\.032\);\s*display:\s*grid;\s*grid-template-columns:\s*auto 1fr auto;\s*gap:\s*16px;\s*align-items:\s*center;\s*backdrop-filter:\s*blur\(18px\);/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps micro-label typography grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramTitleBlock span,\s*\.adminProgramWorkoutHeader span\s*\{\s*display:\s*block;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminProgramTitleBlock span,\s*\.adminProgramWorkoutHeader span,\s*\.adminProgramGridTopbar span,\s*\.adminProgramGridSectionHead span\s*\{\s*color:\s*rgba\(145,173,78,\.92\);\s*font-size:\s*10px;\s*font-weight:\s*1000;\s*letter-spacing:\s*\.1em;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/color:\s*rgba\(145,173,78,\.92\);\s*font-size:\s*10px;\s*font-weight:\s*1000;\s*letter-spacing:\s*\.1em;/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps stat labels grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramStatsRow span,\s*\.adminProgramGridStats span\s*\{\s*display:\s*block;\s*color:\s*rgba\(255,255,255,\.45\);\s*font-size:\s*11px;\s*font-weight:\s*900;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/display:\s*block;\s*color:\s*rgba\(255,255,255,\.45\);\s*font-size:\s*11px;\s*font-weight:\s*900;/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps stat values grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramStatsRow strong,\s*\.adminProgramGridStats strong\s*\{\s*display:\s*block;\s*margin-top:\s*7px;\s*color:\s*#fff;\s*line-height:\s*1;\s*font-weight:\s*1000;\s*white-space:\s*nowrap;\s*overflow:\s*hidden;\s*text-overflow:\s*ellipsis;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/display:\s*block;\s*margin-top:\s*7px;\s*color:\s*#fff;\s*line-height:\s*1;\s*font-weight:\s*1000;\s*white-space:\s*nowrap;\s*overflow:\s*hidden;\s*text-overflow:\s*ellipsis;/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps template layouts grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramTemplateDock,\s*\.adminProgramTemplateStrip\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*minmax\(180px, 1fr\) auto minmax\(190px, 1fr\) auto;\s*gap:\s*8px;\s*margin-bottom:\s*12px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/display:\s*grid;\s*grid-template-columns:\s*minmax\(180px, 1fr\) auto minmax\(190px, 1fr\) auto;\s*gap:\s*8px;\s*margin-bottom:\s*12px;/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps form controls grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramTemplateDock input,\s*\.adminProgramTemplateDock select,\s*\.adminProgramWorkoutHeader input,\s*\.adminInspectorBody input,\s*\.adminProgramTemplateStrip input,\s*\.adminProgramTemplateStrip select,\s*\.adminProgramDayActions input,\s*\.adminExerciseNameCell input,\s*\.adminExerciseSetsCell input,\s*\.adminExerciseVideoCell input\s*\{\s*width:\s*100%;\s*border:\s*1px solid rgba\(255,255,255,\.075\);\s*color:\s*#fff;\s*padding:\s*0 12px;\s*font-weight:\s*850;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/width:\s*100%;\s*border:\s*1px solid rgba\(255,255,255,\.075\);\s*color:\s*#fff;\s*padding:\s*0 12px;\s*font-weight:\s*850;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminProgramTemplateDock input,\s*\.adminProgramTemplateDock select,\s*\.adminProgramWorkoutHeader input,\s*\.adminInspectorBody input\s*\{\s*min-height:\s*42px;\s*border-radius:\s*14px;\s*background:\s*rgba\(0,0,0,\.2\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminProgramTemplateStrip input,\s*\.adminProgramTemplateStrip select,\s*\.adminProgramDayActions input,\s*\.adminExerciseNameCell input,\s*\.adminExerciseSetsCell input,\s*\.adminExerciseVideoCell input\s*\{\s*min-height:\s*40px;\s*border-radius:\s*13px;\s*background:\s*rgba\(0,0,0,\.22\);\s*\}/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps empty-state typography grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramEmptyDay strong,\s*\.adminProgramEmptyExerciseList strong\s*\{\s*font-size:\s*20px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminProgramEmptyDay p,\s*\.adminProgramEmptyExerciseList p\s*\{\s*margin:\s*0;\s*color:\s*rgba\(255,255,255,\.48\);\s*font-weight:\s*800;\s*\}/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS keeps empty-state shells grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-program-editor.css");

  assert.equal(
    (source.match(/\.adminProgramEmptyDay,\s*\.adminProgramEmptyExerciseList\s*\{\s*background:\s*rgba\(127,159,58,\.055\);\s*display:\s*grid;\s*place-content:\s*center;\s*justify-items:\s*center;\s*gap:\s*8px;\s*text-align:\s*center;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/background:\s*rgba\(127,159,58,\.055\);\s*display:\s*grid;\s*place-content:\s*center;\s*justify-items:\s*center;\s*gap:\s*8px;\s*text-align:\s*center;/g) || []).length,
    1
  );
});

test("legacy admin client page CSS does not keep exact duplicate blocks", async () => {
  const source = await readCssWithImports("src/styles/admin-client-page.css");
  const seenBlocks = new Set();
  const duplicateBlocks = [];

  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2].trim().replace(/\s+/g, " ");
    if (!body || selector.includes("@")) continue;
    const key = `${selector} { ${body} }`;

    if (seenBlocks.has(key)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      duplicateBlocks.push(`src/styles/admin-client-page.css:${line}`);
    }
    seenBlocks.add(key);
  }

  assert.deepEqual(duplicateBlocks, []);
});

test("legacy admin client page CSS keeps Telegram render sizing grouped", async () => {
  const source = await readCssWithImports("src/styles/admin-client-page.css");

  assert.equal(
    (source.match(/\.adminClientTelegramLogoRender,\s*\.adminClientTelegramAvatarRender\s*\{\s*width:\s*62px !important;\s*height:\s*62px !important;\s*flex:\s*none !important;\s*\}/g) || []).length,
    1
  );

  const standaloneBlocks = [...source.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
    .filter((match) => /width:\s*62px !important;\s*height:\s*62px !important;\s*flex:\s*none !important;/.test(match[2]))
    .map((match) => match[1].trim().replace(/\s+/g, " "));

  assert.deepEqual(standaloneBlocks, [".adminClientTelegramLogoRender, .adminClientTelegramAvatarRender"]);
});

test("profile dashboard CSS keeps unified stats grid in the horizontal owner", async () => {
  const source = await readCssWithImports("src/styles/profile-dashboard-telegram.css");
  const horizontalStatsStart = source.indexOf("/* HORIZONTAL PROFILE STATS */");
  const goalAlignStart = source.indexOf("/* GOAL CARD ALIGN FIX */");
  const horizontalStatsBlock = source.slice(horizontalStatsStart, goalAlignStart);

  assert.ok(horizontalStatsStart > 0);
  assert.ok(goalAlignStart > horizontalStatsStart);
  assert.equal(
    (source.match(/\.profileUnifiedStats\s*\{\s*grid-template-columns:\s*repeat\(3,\s*1fr\) !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(
    horizontalStatsBlock,
    /@media\s*\(max-width:\s*760px\)\s*\{\s*\.profileUnifiedStats\s*\{\s*grid-template-columns:\s*repeat\(3,\s*1fr\) !important;\s*\}/
  );
  assert.match(
    horizontalStatsBlock,
    /\.profileUnifiedStats\s*\{\s*grid-template-columns:\s*repeat\(3,\s*1fr\) !important;\s*\}[\s\S]*?@media\s*\(max-width:\s*760px\)\s*\{\s*\.profileUnifiedStats > div\s*\{\s*min-height:\s*72px !important;\s*padding:\s*10px 8px !important;\s*\}/
  );
});

test("profile dashboard CSS drops the retired nutrition goal picker", async () => {
  const source = await readCssWithImports("src/styles/profile-dashboard-telegram.css");

  assert.doesNotMatch(source, /\.profileGoalPicker|\.profileGoalModeHint|\.profileMacroGrid/);
});

test("profile progress insight owns only its live main-dashboard visual", async () => {
  const component = await readText("src/features/client/profile/ProfileProgressInsightCard.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileProgressInsightCard.module.css");
  const variables = await readText("src/styles/_variables.css");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const retiredSelectors = /\.(?:profileAiCoachInsight|profileProgressInsightCard|profileAiCoachToggle|profileAiCoachSummary|profileProgressGauge|profileProgressGaugeDial|profileAiCoachHeadline|profileAiCoachPreview|profileProgressInsightBadges|profileProgressInsightBadge|profileAiCoachExpanded|profileAiCoachStatusRow|insideProgress|profileAiCoachMetrics)(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileProgressInsightCard\.module\.css";/);
  assert.match(component, /data-testid="profile-progress-card"/);
  assert.match(component, /data-testid="profile-progress-gauge"/);
  assert.match(component, /data-testid="profile-progress-badges"/);
  assert.match(component, /styles\[progressInsight\.tone\] \|\| styles\.neutral/);
  assert.match(component, /--progress-fill/);
  assert.doesNotMatch(component, retiredSelectors);
  assert.doesNotMatch(component, /isMainDashboard|expanded|onToggle|currentGoalId|totalWorkouts/);
  assert.doesNotMatch(component, /<button|<i\s*\/>/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?display:\s*flex;[\s\S]*?padding:\s*15px 14px 14px;/);
  assert.match(moduleCss, /\.badges\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(moduleCss, /@media \(max-width:\s*640px\)[\s\S]*?height:\s*160px;[\s\S]*?grid-template-columns:\s*114px minmax\(0, 1fr\);/);
  assert.match(moduleCss, /conic-gradient\([\s\S]*?var\(--progress-fill\)/);
  assert.match(moduleCss, /:global\(:root\[data-app-theme="dark-green"\]\) \.root\s*\{\s*border-radius:\s*15px;/);
  assert.match(variables, /--color-profile-progress-border-positive:/);
  assert.match(variables, /--background-profile-progress-mobile:/);
  assert.doesNotMatch(legacyCss, retiredSelectors);
});

test("profile dashboard CSS keeps only live shared Telegram selectors", async () => {
  const source = await readCssWithImports("src/styles/profile-dashboard-telegram.css");

  assert.match(source, /\.adminClientTelegramAvatar img\s*\{[\s\S]*?object-fit:\s*cover;/);
  assert.match(source, /\.adminClientTelegramBadge\s*\{[\s\S]*?min-height:\s*32px;/);
  assert.match(source, /\.adminClientTelegramAvatar\s*\{[\s\S]*?place-items:\s*center;/);
  assert.match(source, /\.adminClientTelegramActions button,\s*\.adminTelegramSendButton\s*\{[\s\S]*?font-weight:\s*950;/);
  assert.doesNotMatch(source, /profileAvatarBig|profileUnifiedAvatar|profileAiAvatar/);
  assert.doesNotMatch(source, /\.profileTelegram(?:Status|Avatar|Actions|Save|Modal|Manage|Auth|Login|Widget|Bot|Check)(?![\w-])/);
});

test("client main CSS no longer owns migrated dashboard summary or progress cards", async () => {
  const source = await readCssWithImports("src/styles/client-main.css");

  assert.equal((source.match(/--main-home-primary-text-size:\s*16\.2px;/g) || []).length, 1);
  assert.doesNotMatch(source, /profileAiStatsRow|profileAiStatLabel|profileAiSplitCards|profileAiMiniCard|profileMainSummaryGrid/);
  assert.doesNotMatch(source, /profileAiCoachInsight|profileProgressInsightCard|profileAiCoachHeadline|profileProgressInsightBadge/);
});

test("profile main measurement snapshot owns its live adaptive states", async () => {
  const component = await readText("src/features/client/profile/ProfileMainMeasurementSnapshot.jsx");
  const moduleCss = await readText("src/features/client/profile/ProfileMainMeasurementSnapshot.module.css");
  const route = await readText("src/features/client/profile/ProfileDashboardRoute.jsx");
  const model = await readText("src/features/client/profile/profileDashboardModel.js");
  const variables = await readText("src/styles/_variables.css");
  const styleFiles = await collectFiles("src/styles", [".css"]);
  const legacyCss = (await Promise.all(styleFiles.map((file) => readText(file)))).join("\n");
  const retiredSelectors = /\.(?:profileMainMeasurementSnapshot|mainMeasurementSnapshot|mainMeasurementSnapshotHeader|mainMeasurementSnapshotBody|mainMeasurementWeight|mainMeasurementChart|mainMeasurementChartTrend|mainMeasurementCurrentGuide|mainMeasurementTrendLine|mainMeasurementPointLabel|mainMeasurementTrendPoint|mainMeasurementCurrentBubble|mainMeasurementDateLabel|mainMeasurementSingle|mainMeasurementEmpty|mainMeasurementChartDates)(?![\w-])/;

  assert.match(component, /import styles from "\.\/ProfileMainMeasurementSnapshot\.module\.css";/);
  assert.match(component, /data-css-module-scope="profile-main-measurement-snapshot"/);
  assert.match(component, /data-testid="profile-measurement-snapshot"/);
  assert.match(component, /data-testid="profile-measurement-snapshot-trend"/);
  assert.match(component, /data-testid="profile-measurement-snapshot-single"/);
  assert.match(component, /data-testid="profile-measurement-snapshot-empty"/);
  assert.doesNotMatch(component, retiredSelectors);
  assert.doesNotMatch(component, /<i(?:\s|>)/);
  assert.doesNotMatch(route, /mainMeasurementPoints|measurementPoints=|formatMeasurementDate=\{formatProfileMeasurementDate\}[\s\S]{0,80}ProfileMainMeasurementSnapshot/);
  assert.doesNotMatch(model, /mainMeasurementWeights|mainMeasurementMin|mainMeasurementMax|mainMeasurementRange|mainMeasurementPoints/);
  assert.doesNotMatch(moduleCss, /!important/);
  assert.match(moduleCss, /\.root\s*\{[\s\S]*?height:\s*160px;[\s\S]*?overflow:\s*hidden;/);
  assert.match(moduleCss, /\.body\s*\{[\s\S]*?grid-template-columns:\s*116px minmax\(0, 1fr\);/);
  assert.match(moduleCss, /\.trendLine\s*\{[\s\S]*?stroke:\s*url\("#mainMeasurementLineGradient"\);/);
  assert.match(moduleCss, /@media \(max-width:\s*640px\)[\s\S]*?height:\s*140px;/);
  assert.match(moduleCss, /@media \(max-width:\s*360px\)[\s\S]*?font-size:\s*11px;/);
  assert.match(moduleCss, /:global\(:root\[data-app-theme="dark-green"\]\) \.root/);
  assert.match(variables, /--color-profile-measurement-border:/);
  assert.match(variables, /--color-profile-measurement-chart-start:/);
  assert.match(variables, /--background-profile-measurement-empty:/);
  assert.doesNotMatch(legacyCss, retiredSelectors);
});

test("client nutrition grid CSS does not keep exact duplicate blocks", async () => {
  const source = await readCssWithImports("src/styles/client-nutrition-grid.css");
  const seenBlocks = new Set();
  const duplicateBlocks = [];

  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2].trim().replace(/\s+/g, " ");
    if (!body || selector.includes("@")) continue;
    const key = `${selector} { ${body} }`;

    if (seenBlocks.has(key)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      duplicateBlocks.push(`src/styles/client-nutrition-grid.css:${line}`);
    }
    seenBlocks.add(key);
  }

  assert.deepEqual(duplicateBlocks, []);
  assert.doesNotMatch(source, /clientBottomNav/);
  assert.doesNotMatch(source, /clientCorePageWorkout|workoutSelectPage|individualWorkoutSelectPage/);
  assert.doesNotMatch(source, /profileAiHero|profileAiAvatar|profileAvatarBig|profileUnifiedAvatar/);
});

test("desktop cabinet CSS keeps trainer client overview grid locks in the broad mobile owner", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");
  const trainerClientSectionStart = source.indexOf(".trainerClientDashboardModalOverlay");
  const broadMobileStart = source.indexOf("@media (max-width: 1100px)", trainerClientSectionStart);
  const narrowMobileStart = source.indexOf("@media (max-width: 700px)", broadMobileStart);
  const broadMobileBlock = source.slice(broadMobileStart, narrowMobileStart);
  const narrowMobileBlock = source.slice(narrowMobileStart);

  assert.ok(trainerClientSectionStart >= 0);
  assert.ok(broadMobileStart >= 0);
  assert.ok(narrowMobileStart >= 0);
  assert.match(
    broadMobileBlock,
    /\.trainerClientAttentionStrip,\s*\.trainerClientKpiGrid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/
  );
  assert.match(
    broadMobileBlock,
    /\.trainerClientKpiGrid > article:last-child\s*\{\s*grid-column:\s*1 \/ -1;/
  );
  assert.doesNotMatch(
    narrowMobileBlock,
    /\.trainerClientAttentionStrip,\s*\.trainerClientKpiGrid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/
  );
});

test("desktop cabinet CSS keeps trainer client metric captions grouped", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");

  assert.equal(
    (source.match(/\.trainerClientKpiGrid article > em,\s*\.trainerClientKpiGrid article > small,\s*\.trainerClientMacroGrid span,\s*\.trainerClientMacroGrid em\s*\{\s*color:\s*rgba\(255,\s*255,\s*255,\s*0\.46\);\s*font-size:\s*9px;\s*font-style:\s*normal;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/color:\s*rgba\(255,\s*255,\s*255,\s*0\.46\);\s*font-size:\s*9px;\s*font-style:\s*normal;/g) || []).length,
    1
  );
});

test("desktop cabinet CSS keeps trainer client progress captions grouped", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");

  assert.equal(
    (source.match(/\.trainerClientAttentionStrip small,\s*\.trainerClientProgramProgress span\s*\{\s*color:\s*rgba\(255,\s*255,\s*255,\s*0\.48\);\s*font-size:\s*9px;\s*\}/g) || []).length,
    1
  );
});

test("desktop cabinet CSS keeps trainer client muted captions grouped", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");

  assert.equal(
    (source.match(/\.trainerClientHeroMeta span,\s*\.trainerClientHeroMeta small,\s*\.trainerClientSectionHead small,\s*\.trainerClientControlRows span\s*\{\s*color:\s*rgba\(255,\s*255,\s*255,\s*0\.48\);\s*font-size:\s*10px;\s*\}/g) || []).length,
    1
  );
});

test("desktop cabinet CSS keeps trainer client list shells grouped", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");

  assert.equal(
    (source.match(/\.trainerClientAiList,\s*\.trainerClientControlRows,\s*\.trainerClientActivityList\s*\{\s*display:\s*grid;\s*\}/g) || []).length,
    1
  );
});

test("desktop cabinet CSS keeps remaining trainer header shells grouped", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");

  assert.equal(
    (source.match(/\.clientTrainerTasksHead,\s*\.trainerWorkspaceHead\s*\{\s*display:\s*flex;\s*align-items:\s*center;\s*justify-content:\s*space-between;\s*gap:\s*12px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/display:\s*flex;\s*align-items:\s*center;\s*justify-content:\s*space-between;\s*gap:\s*12px;\s*\}/g) || []).length,
    1
  );
});

test("desktop cabinet CSS keeps accent micro labels grouped", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");

  assert.equal(
    (source.match(/\.trainerClientDashboardModal > header span\s*\{\s*color:\s*#b5e655;\s*font-size:\s*10px;\s*font-weight:\s*950;\s*letter-spacing:\s*0\.06em;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(source, /\.profileNutritionInlinePlanHead/);
  assert.equal(
    (source.match(/color:\s*#b5e655;\s*font-size:\s*10px;\s*font-weight:\s*950;\s*letter-spacing:\s*0\.06em;/g) || []).length,
    1
  );
});

test("desktop cabinet CSS keeps trainer client text shells grouped", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");

  assert.equal(
    (source.match(/\.clientTrainerTask strong,\s*\.trainerClientProgramSummary strong\s*\{\s*overflow:\s*hidden;\s*color:\s*#fff;\s*font-size:\s*14px;\s*text-overflow:\s*ellipsis;\s*white-space:\s*nowrap;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/overflow:\s*hidden;\s*color:\s*#fff;\s*font-size:\s*14px;\s*text-overflow:\s*ellipsis;\s*white-space:\s*nowrap;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerClientSectionHead > div,\s*\.trainerClientAttentionStrip article > div,\s*\.trainerClientAiList span,\s*\.trainerClientProgramSummary > span\s*\{\s*min-width:\s*0;\s*display:\s*grid;\s*gap:\s*3px;\s*\}/g) || []).length,
    1
  );
});

test("desktop cabinet CSS keeps trainer mobile form columns grouped", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");

  assert.equal(
    (source.match(/\.trainerTaskCreate,\s*\.trainerPhotoMetaRow,\s*\.trainerPhotoCompare,\s*\.trainerPaymentGrid\s*\{\s*grid-template-columns:\s*1fr;\s*\}/g) || []).length,
    1
  );
});

test("desktop cabinet CSS keeps trainer mobile auto columns grouped", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");

  assert.equal(
    (source.match(/\.trainerProgressPhotosCard,\s*\.trainerEventsCard,\s*\.trainerPaymentGrid \.wide,\s*\.trainerPaymentGrid button\s*\{\s*grid-column:\s*auto;\s*\}/g) || []).length,
    1
  );
});

test("desktop cabinet CSS keeps trainer full-width columns grouped", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");

  assert.equal(
    (source.match(/\.trainerProgressPhotosCard,\s*\.trainerEventsCard,\s*\.trainerPaymentGrid \.wide,\s*\.trainerPaymentGrid button\s*\{\s*grid-column:\s*1 \/ -1;\s*\}/g) || []).length,
    1
  );
});

test("desktop cabinet CSS keeps trainer client mobile columns grouped", async () => {
  const source = await readCssWithImports("src/styles/client-cabinet-desktop.css");

  assert.equal(
    (source.match(/\.trainerClientPhotoCompareControls,\s*\.trainerClientPhotoCompare,\s*\.trainerClientHeroMeta,\s*\.trainerClientProgramProgress\s*\{\s*grid-template-columns:\s*1fr;\s*\}/g) || []).length,
    1
  );
});

test("nutrition header module owns its dark and warm responsive states", async () => {
  const indexCss = await readText("src/styles/index.css");
  const nutritionStackCss = await readText("src/styles/nutrition-stack.css");
  const nutritionHeaderCss = await readText("src/features/client/nutrition/NutritionHeader.module.css");

  assert.doesNotMatch(indexCss, /@import "\.\/nutrition-dark-food-flow\.css"/);
  assert.match(nutritionStackCss, /@import "\.\/nutrition-dark-food-flow\.css"/);
  assert.match(indexCss, /@import "\.\/client-screen-alignment\.css"/);
  assert.match(nutritionHeaderCss, /\.action\s*\{[\s\S]*background:\s*linear-gradient\(rgba\(18, 21, 19, 0\.98\), rgba\(9, 12, 9, 0\.98\)\)/);
  assert.match(nutritionHeaderCss, /\.selected \.dot,\s*\.hasFood \.dot\s*\{[\s\S]*background:\s*#6552e6/);
  assert.match(nutritionHeaderCss, /:global\(:root\[data-app-theme="warm-light"\]\) \.root/);
  assert.match(nutritionHeaderCss, /@media \(max-width: 700px\)/);
  assert.doesNotMatch(nutritionHeaderCss, /!important/);
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
  const appTerminalRoute = await readText("src/app/AppTerminalRoute.jsx");
  const trainerUsersRoute = await readText("src/features/trainer/TrainerUsersRoute.jsx");
  const trainerWorkoutsRoute = await readText("src/features/trainer/TrainerAdminWorkoutsRoute.jsx");

  assert.match(appCore, /renderAppTerminalRoute/);
  assert.doesNotMatch(appCore, /TrainerUsersLegacyRoute/);
  assert.doesNotMatch(appCore, /TrainerClientsWorkspaceRoute/);
  assert.doesNotMatch(appCore, /TrainerAdminWorkoutsNextRoute/);
  assert.doesNotMatch(appCore, /TrainerProgramManagerView/);
  assert.doesNotMatch(appCore, /from ["']\.\/components\/trainer\/TrainerWorkspace["']/);

  assert.match(terminalRoutes, /AppTerminalRouteRenderer/);
  assert.match(appTerminalRoute, /TrainerDashboardRoute/);
  assert.match(appTerminalRoute, /TrainerUsersRoute/);
  assert.match(appTerminalRoute, /TrainerAdminWorkoutsRoute/);
  assert.doesNotMatch(terminalRoutes, /TrainerUsersLegacyRoute/);
  assert.doesNotMatch(terminalRoutes, /TrainerClientsWorkspaceRoute/);
  assert.doesNotMatch(terminalRoutes, /TrainerProgramManagerView/);
  assert.doesNotMatch(appTerminalRoute, /TrainerUsersLegacyRoute/);
  assert.doesNotMatch(appTerminalRoute, /TrainerClientsWorkspaceRoute/);
  assert.doesNotMatch(appTerminalRoute, /TrainerProgramManagerView/);

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
  assert.match(managerView, /<TrainerProgramConstructor[\s\S]*?onBack=\{openAdminProgramsOverview\}/);
});

test("trainer program editor CSS keeps bottom bar labels grouped", async () => {
  const source = await readCssWithImports("src/styles/trainer-program-editor.css");

  assert.equal(
    (source.match(/\.programsTopActionBar \.adminV3NavLabel,\s*nav\.adminV3Nav\.adminV3BottomBar\.programsBottomBar > button > \.adminV3NavLabel,\s*nav\.adminV3Nav\.adminV3BottomBar\.programEditorBottomBar > button > \.adminV3NavLabel,\s*nav\.adminV3Nav\.adminV3BottomBar\.workoutEditorBottomBar > button > \.adminV3NavLabel\s*\{\s*max-width:\s*100%;\s*font-size:\s*10px;\s*white-space:\s*nowrap;\s*overflow:\s*hidden;\s*text-overflow:\s*ellipsis;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/max-width:\s*100%;\s*font-size:\s*10px;\s*white-space:\s*nowrap;\s*overflow:\s*hidden;\s*text-overflow:\s*ellipsis;/g) || []).length,
    1
  );
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

  assert.match(warmupStage, /className=\{`\$\{styles\.timerButton\} \$\{timerDuration === seconds \? styles\.timerButtonActive : ""\}`\}[\s\S]*aria-pressed=\{timerDuration === seconds\}/);
});

test("trainer client training program cards expose selected state", async () => {
  const trainingTab = await readText("src/features/trainer/TrainerClientTrainingTab.jsx");

  assert.match(trainingTab, /className=\{isSelected \|\| isAssigned \? "adminSavedProgramCard active" : "adminSavedProgramCard"\}[\s\S]*aria-pressed=\{isSelected \|\| isAssigned\}/);
});

test("trainer program assignment selectors expose readable labels", async () => {
  const programTab = await readText("src/features/trainer/TrainerAdminProgramTab.jsx");
  const trainingTab = await readText("src/features/trainer/TrainerClientTrainingTab.jsx");

  assert.match(programTab, /<select aria-label="Шаблон программы"[\s\S]*value=\{adminSelectedTemplateId\}/);
  assert.match(programTab, /<select aria-label="Клиент для копирования программы"[\s\S]*value=\{adminCopyTargetUserId\}/);
  assert.match(trainingTab, /<select aria-label="Сохранённая программа клиента"[\s\S]*value=\{adminSelectedTemplateId\}/);
  assert.match(trainingTab, /<select[\s\S]*aria-label="Вариант плана питания"[\s\S]*value=\{adminSelectedNutritionPreset\}/);
});

test("trainer calendar reminder selectors expose readable labels", async () => {
  const adminCalendar = await readText("src/features/trainer/TrainerAdminCalendarTab.jsx");
  const clientCalendar = await readText("src/features/trainer/TrainerClientCalendarNutritionTab.jsx");

  assert.match(adminCalendar, /<select[\s\S]*aria-label="Когда напомнить о тренировке"[\s\S]*className="adminReminderBeforeSelect"/);
  assert.match(clientCalendar, /<select[\s\S]*aria-label="Когда напомнить о тренировке"[\s\S]*className="adminReminderBeforeSelect"/);
});

test("trainer transfer selectors expose readable labels", async () => {
  const transferTab = await readText("src/features/trainer/TrainerAdminTransferTab.jsx");
  const overviewTools = await readText("src/features/trainer/TrainerClientOverviewAdminTools.jsx");

  assert.match(transferTab, /<select aria-label="Источник данных для переноса"[\s\S]*value=\{adminTransferFromUid\}/);
  assert.match(transferTab, /<select aria-label="Клиент-получатель данных"[\s\S]*value=\{adminTransferToUid\}/);
  assert.match(overviewTools, /<select aria-label="Источник данных для переноса"[\s\S]*value=\{adminTransferFromUid\}/);
  assert.match(overviewTools, /<select aria-label="Клиент-получатель данных"[\s\S]*value=\{adminTransferToUid \|\| selectedClient\.id\}/);
});

test("trainer workspace program and status selectors expose readable labels", async () => {
  const workspace = await readText("src/components/trainer/TrainerWorkspace.jsx");

  assert.match(workspace, /<select aria-label="Назначить программу клиенту"[\s\S]*value=\{selectedProgramId \|\| ""\}/);
  assert.match(workspace, /<select aria-label="Готовый вариант плана питания"[\s\S]*value=\{preset\}/);
  assert.match(workspace, /<select aria-label="Загрузить программу клиенту"[\s\S]*value=\{selectedProgramId \|\| ""\}/);
  assert.match(workspace, /<select[\s\S]*aria-label="Статус тренировки"[\s\S]*value=\{selectedWorkout\.displayStatus \|\| selectedWorkout\.status \|\| "planned"\}/);
});

test("trainer overview modal selectors expose readable labels", async () => {
  const overviewModals = await readText("src/features/trainer/TrainerClientOverviewModals.jsx");
  const legacyDetails = await readText("src/features/trainer/TrainerClientOverviewLegacyDetails.jsx");

  for (const source of [overviewModals, legacyDetails]) {
    assert.match(source, /aria-label=\{slot === 0 \? "Предыдущая фотосессия для сравнения" : "Новая фотосессия для сравнения"\}/);
    assert.match(source, /<select aria-label="Состояние контроля программы"[\s\S]*value=\{adminPaymentDraft\.status\}/);
  }
});

test("trainer progress photo compare selectors expose readable labels", async () => {
  const workspace = await readText("src/components/trainer/TrainerWorkspace.jsx");

  assert.match(workspace, /<select aria-label="Первая фотосессия для сравнения"[\s\S]*value=\{compareIds\[0\]\}/);
  assert.match(workspace, /<select aria-label="Вторая фотосессия для сравнения"[\s\S]*value=\{compareIds\[1\]\}/);
});

test("client workout next card exposes current step state", async () => {
  const workoutListPage = await readText("src/features/client/workouts/WorkoutListPage.jsx");

  assert.match(workoutListPage, /className=\{`\$\{styles\.workoutCard\} \$\{styles\.featuredCard\}[\s\S]*aria-current=\{activeNext \? "step" : undefined\}/);
});

test("client nutrition weekday strip exposes selected and current date state", async () => {
  const nutritionHeader = await readText("src/features/client/nutrition/NutritionHeader.jsx");

  assert.match(nutritionHeader, /className=\{`\$\{styles\.day\} \$\{isSelectedDay \? styles\.selected : ""\}[\s\S]*aria-pressed=\{isSelectedDay\}/);
  assert.match(nutritionHeader, /aria-current=\{isTodayDay \? "date" : undefined\}/);
  assert.match(nutritionHeader, /data-selected=\{isSelectedDay\}/);
  assert.match(nutritionHeader, /data-has-food=\{dayHasFood\}/);
  assert.match(nutritionHeader, /data-today=\{isTodayDay\}/);
});

test("nutrition base CSS keeps warm-light page shell grouped", async () => {
  const nutritionBaseCss = await readCssWithImports("src/styles/nutrition.css");

  assert.equal(
    (nutritionBaseCss.match(/:root\[data-app-theme="warm-light"\] \.fatSecretPage\.nutritionFixedHeaderV3,\s*:root\[data-app-theme="warm-light"\] \.clientCorePage\s*\{\s*border-color:\s*rgba\(96, 78, 27, 0\.24\) !important;[\s\S]*?linear-gradient\(180deg, #fffaf0 0%, #f4e8c8 100%\) !important;[\s\S]*?0 24px 60px rgba\(87, 68, 18, 0\.15\),[\s\S]*?inset 0 1px 0 rgba\(255, 255, 255, 0\.72\) !important;[\s\S]*?\}/g) || []).length,
    1
  );
  assert.equal(
    (nutritionBaseCss.match(/border-color:\s*rgba\(96, 78, 27, 0\.24\) !important;[\s\S]*?linear-gradient\(180deg, #fffaf0 0%, #f4e8c8 100%\) !important;[\s\S]*?0 24px 60px rgba\(87, 68, 18, 0\.15\),[\s\S]*?inset 0 1px 0 rgba\(255, 255, 255, 0\.72\) !important;/g) || []).length,
    1
  );
});

test("warm-light nutrition CSS keeps summary donut center in the compact owner", async () => {
  const warmLightNutritionCss = await readCssWithImports("src/styles/warm-light-nutrition.css");

  assert.doesNotMatch(
    warmLightNutritionCss,
    /:root\[data-app-theme="warm-light"\] \.summaryDonut span\s*\{\s*position:\s*absolute !important;\s*inset:\s*22px !important;\s*border-radius:\s*50% !important;\s*display:\s*block !important;\s*background:\s*#050505 !important;\s*z-index:\s*2 !important;\s*\}/
  );
  assert.equal(
    (warmLightNutritionCss.match(/:root\[data-app-theme="warm-light"\] \.summaryDonut span\s*\{\s*position:\s*absolute !important;\s*inset:\s*22px !important;\s*width:\s*auto !important;\s*height:\s*auto !important;[\s\S]*?linear-gradient\(180deg, rgba\(255,249,215,1\) 0%, rgba\(246,232,174,0\.95\) 100%\) !important;[\s\S]*?border:\s*0 !important;[\s\S]*?z-index:\s*2 !important;\s*\}/g) || []).length,
    1
  );
});

test("client nutrition weekday strip keeps two-letter labels visible", async () => {
  const nutritionCalendar = await readText("src/utils/nutritionCalendar.js");
  const nutritionHeader = await readText("src/features/client/nutrition/NutritionHeader.jsx");
  const nutritionHeaderCss = await readText("src/features/client/nutrition/NutritionHeader.module.css");
  const legacyNutritionCss = await readCssWithImports("src/styles/nutrition-stack.css");

  assert.match(nutritionCalendar, /NUTRITION_WEEK_LABELS = \["\\u041f\\u041d", "\\u0412\\u0422", "\\u0421\\u0420", "\\u0427\\u0422", "\\u041f\\u0422", "\\u0421\\u0411", "\\u0412\\u0421"\]/);
  assert.match(nutritionHeader, /<small className=\{styles\.dayLabel\}[\s\S]*\{day\.label\}/);
  assert.match(nutritionHeaderCss, /\.day\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-rows:\s*14px 26px;/);
  assert.match(nutritionHeaderCss, /\.dayLabel\s*\{[\s\S]*width:\s*2\.4ch;[\s\S]*min-width:\s*2\.4ch;[\s\S]*max-width:\s*2\.4ch;[\s\S]*text-transform:\s*uppercase;[\s\S]*white-space:\s*nowrap;/);
  assert.doesNotMatch(nutritionHeaderCss, /!important|flex-direction:\s*column-reverse/);
  assert.doesNotMatch(legacyNutritionCss, /nutritionWeekV4|nutritionDayV4/);
});

test("client nutrition header labels stay readable Russian text", async () => {
  const nutritionHeader = await readText("src/features/client/nutrition/NutritionHeader.jsx");

  assert.match(nutritionHeader, /aria-label="Поиск еды"/);
  assert.match(nutritionHeader, /aria-label="Календарь"/);
  assert.match(nutritionHeader, /aria-label=\{`Выбрать \$\{dayAriaLabel\}`\}/);
  assert.doesNotMatch(nutritionHeader, /Ð|Ñ/);
});

test("client nutrition calendar days expose selected and current date state", async () => {
  const nutritionCalendar = await readText("src/features/client/nutrition/NutritionCalendarModal.jsx");

  assert.match(nutritionCalendar, /day\.isSelected \? styles\.selected : ""[\s\S]*aria-pressed=\{day\.isSelected\}/);
  assert.match(nutritionCalendar, /aria-current=\{day\.isToday \? "date" : undefined\}/);
  assert.match(nutritionCalendar, /data-over-goal=\{day\.isOverGoal \? "true" : "false"\}/);
});

test("client cabinet nutrition week cells expose readable day state", async () => {
  const profileNutritionModal = await readText("src/features/client/profile/ProfileNutritionModal.jsx");

  assert.match(profileNutritionModal, /function getProfileNutritionDayLabel/);
  assert.match(profileNutritionModal, /aria-label=\{getProfileNutritionDayLabel\(day, plannedMacros, showPlan\)\}/);
  assert.match(profileNutritionModal, /aria-current=\{day\.isToday \? "date" : undefined\}/);
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

  assert.match(overviewPage, /isSelected \? "programsOverviewCard selected" : "programsOverviewCard"/);
  assert.match(overviewPage, /styles\.card/);
  assert.match(overviewPage, /aria-pressed=\{isSelected\}/);
});

test("trainer mobile overflow navigation exposes current page state", async () => {
  const workspace = await readText("src/components/trainer/TrainerWorkspace.jsx");

  assert.match(workspace, /const active = activeSection === item\.id;[\s\S]*data-testid=\{`trainer-more-\$\{item\.id\}`\}[\s\S]*className=\{active \? "active" : ""\}[\s\S]*aria-current=\{active \? "page" : undefined\}/);
});

test("trainer workspace CSS keeps mobile bottom nav shell in one owner", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNextMobileNav\s*\{\s*position:\s*fixed;\s*z-index:\s*1000;[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps mobile page shell grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/@media\s*\(max-width:\s*820px\),\s*\(hover:\s*none\) and \(pointer:\s*coarse\) and \(orientation:\s*landscape\)\s*\{[\s\S]*?\.trainerNextPage\s*\{\s*width:\s*100%;\s*min-height:\s*100dvh;\s*padding:\s*max\(20px,\s*env\(safe-area-inset-top\)\) 20px calc\(112px \+ env\(safe-area-inset-bottom\)\);\s*background:\s*#fff;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextPage\s*\{\s*width:\s*100%;\s*min-height:\s*100dvh;\s*padding:\s*max\(20px,\s*env\(safe-area-inset-top\)\) 20px calc\(112px \+ env\(safe-area-inset-bottom\)\);\s*background:\s*#fff;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps mobile header page grids grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNextWorkoutPage \.trainerNextMobileHeader,\s*\.trainerNextNutritionPage \.trainerNextMobileHeader\s*\{\s*grid-template-columns:\s*1fr 34px;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps nutrition and notification action buttons grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNutritionPlanActions > button,\s*\.trainerNotificationActions button\s*\{\s*min-height:\s*42px;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNutritionPlanActions > button,\s*\.trainerNotificationActions button\s*\{\s*width:\s*100%;/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps shared form field shells grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerClientAssignmentControls label,\s*\.trainerNutritionPreset,\s*\.trainerNutritionGoalInputs label,\s*\.trainerNutritionPlanFields label,\s*\.trainerNutritionValidity label\s*\{\s*display:\s*grid;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerClientAssignmentControls select,\s*\.trainerNutritionPreset select,\s*\.trainerNutritionGoalInputs input,\s*\.trainerNutritionPlanFields input,\s*\.trainerNutritionValidity input\s*\{\s*width:\s*100%;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextExerciseList input:focus,\s*\.trainerNextModal label input:focus,\s*\.trainerNextProgramControl select:focus,\s*\.trainerClientAssignmentControls select:focus,\s*\.trainerNutritionPreset select:focus,\s*\.trainerNutritionGoalInputs input:focus,\s*\.trainerNutritionPlanFields input:focus,\s*\.trainerNutritionValidity input:focus,\s*\.trainerNotificationCalendarGrid button\.today,\s*\.trainerClientMessageModal textarea:focus,\s*\.trainerNextWorkoutName input:focus,\s*\.trainerNextExerciseFields input:focus,\s*\.trainerNextSetRow input:focus\s*\{\s*border-color:\s*var\(--tn-purple\);\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps cabinet and utility card shells grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerCabinetHero,\s*\.trainerCabinetStats,\s*\.trainerCabinetActions,\s*\.trainerUtilityCard,\s*\.trainerUtilityActions\s*\{\s*border:\s*1px solid var\(--tn-line\);\s*border-radius:\s*18px;\s*background:\s*#fff;\s*box-shadow:\s*var\(--tn-soft-shadow\);\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps mobile metric grids grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerClientQualityMetrics,\s*\.trainerNutritionMetricGrid,\s*\.trainerExerciseProgressSummary,\s*\.trainerNutritionGoalInputs,\s*\.trainerNutritionCurrentGoals,\s*\.trainerNutritionValidity,\s*\.trainerNotificationOffsets > div\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps mobile measurement grids grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerMeasurementFieldGrid,\s*\.trainerMeasurementCollapsed > div\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMeasurementSummaryGrid,\s*\.trainerNotificationSchedule\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);\s*gap:\s*7px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMeasurementCollapsed > div,\s*\.trainerMeasurementFieldGrid\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);\s*gap:\s*6px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMeasurementCollapsed span,\s*\.trainerExerciseProgressSummary span\s*\{\s*color:\s*var\(--tn-muted\);\s*font-size:\s*8px;\s*font-weight:\s*900;\s*text-transform:\s*uppercase;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMeasurementCollapsed > div,\s*\.trainerWorkoutMonthStats\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);\s*gap:\s*8px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMeasurementSummaryGrid article,\s*\.trainerMeasurementFieldGrid article,\s*\.trainerMeasurementInsight,\s*\.trainerMeasurementChart,\s*\.trainerMeasurementTimeline,\s*\.trainerProgramTree,\s*\.trainerProgramDayPanel\s*\{\s*min-width:\s*0;\s*border:\s*1px solid var\(--tn-line\);\s*border-radius:\s*8px;\s*background:\s*#fff;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextClientTable > button > span small,\s*\.trainerMeasurementSummaryGrid small,\s*\.trainerMeasurementFieldGrid small,\s*\.trainerMeasurementChart small,\s*\.trainerMeasurementTimeline span\s*\{\s*color:\s*var\(--tn-muted\);\s*font-size:\s*9px;\s*font-weight:\s*700;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMeasurementCollapsed \.positive,\s*\.trainerMeasurementSummaryGrid \.positive,\s*\.trainerMeasurementFieldGrid \.positive,\s*\.trainerExerciseProgressSummary \.positive,\s*\.trainerExerciseProgressMetrics \.positive\s*\{\s*color:\s*#159947;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMeasurementCollapsed \.negative,\s*\.trainerMeasurementSummaryGrid \.negative,\s*\.trainerMeasurementFieldGrid \.negative,\s*\.trainerExerciseProgressSummary \.negative,\s*\.trainerExerciseProgressMetrics \.negative\s*\{\s*color:\s*#dc4f4f;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps nutrition muted micro labels grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNextProgramsTab \.programsOverviewCardStats small,\s*\.trainerClientAssignedStats small,\s*\.trainerWorkoutSchedulePlanner > header > strong small,\s*\.trainerClientQualityMetrics span,\s*\.trainerNutritionMetricGrid span,\s*\.trainerNutritionMetricGrid small,\s*\.trainerNutritionPeriod small,\s*\.trainerNutritionDonut small,\s*\.trainerNutritionDiary > aside small,\s*\.trainerNutritionCurrentGoals small,\s*\.trainerNutritionCurrentMeta,\s*\.trainerNutritionGoalInputs small,\s*\.trainerNutritionValidity > small,\s*\.trainerNotificationSchedule small,\s*\.trainerProgressReminderOptions small,\s*\.trainerNextExerciseMetric small\s*\{\s*color:\s*var\(--tn-muted\);\s*font-size:\s*8px;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps nutrition typography grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerClientQualityMetrics strong,\s*\.trainerNutritionMetricGrid strong,\s*\.trainerNutritionDonut strong\s*\{\s*font-size:\s*18px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNutritionDiaryHead h2,\s*\.trainerNutritionDiaryHead > strong\s*\{\s*font-size:\s*14px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNutritionCurrentPlan \.trainerClientBlockHeading small,\s*\.trainerNutritionPresetPreview\s*\{\s*color:\s*var\(--tn-purple\);\s*font-size:\s*8px;\s*font-weight:\s*800;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextLibrary article small,\s*\.trainerNextProgramControl small,\s*\.trainerNextProgramControl label > span,\s*\.trainerProgramWeekRow small,\s*\.trainerProgramWorkoutName span,\s*\.trainerNutritionReadonly,\s*\.trainerNutritionCurrentPlan p,\s*\.trainerNextWorkoutName label span,\s*\.trainerNextExerciseFields label > span,\s*\.trainerNextExerciseName small,\s*\.trainerNextWorkoutPreview article header span,\s*\.trainerNextWorkoutPreview article div small\s*\{\s*color:\s*var\(--tn-muted\);\s*font-size:\s*9px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextTrainer small,\s*\.trainerNextActivityCard time,\s*\.trainerNextMeasurementGrid span,\s*\.trainerNextMeasurementGrid small,\s*\.trainerNextWorkoutDays button small,\s*\.trainerNextNutritionDays button small,\s*\.trainerProgramMonthRow small,\s*\.trainerProgramCycleRow small,\s*\.trainerClientAnalyticsCard header > strong,\s*\.trainerClientAnalyticsCard header > svg\s*\{\s*color:\s*var\(--tn-muted\);\s*font-size:\s*10px;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps muted paragraph typography grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerAnalyticsPanel h3,\s*\.trainerNotificationFeed h3,\s*\.trainerNotificationsLayout h3,\s*\.trainerClientBlockHeading h2,\s*\.trainerClientAssignedInfo h2,\s*\.trainerNutritionCurrentPlan h2\s*\{\s*margin:\s*0;\s*font-size:\s*16px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextPanelTitle p,\s*\.trainerPhotoComparePanel p\s*\{\s*margin:\s*4px 0 0;\s*color:\s*var\(--tn-muted\);\s*font-size:\s*11px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerClientBlockHeading p,\s*\.trainerClientAssignedInfo p,\s*\.trainerWorkoutEditorModal p\s*\{\s*margin:\s*5px 0 0;\s*color:\s*var\(--tn-muted\);\s*font-size:\s*10px;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps emphasis typography grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerMessageHistory strong,\s*\.trainerNextClientTable > button > span b,\s*\.trainerMeasurementFieldGrid strong,\s*\.trainerMeasurementTimeline strong,\s*\.trainerNutritionDiaryCollapsed strong\s*\{\s*color:\s*var\(--tn-text\);\s*font-size:\s*12px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMessageEmpty strong,\s*\.trainerMeasurementCollapsed strong,\s*\.trainerWorkoutMonthStats b\s*\{\s*color:\s*var\(--tn-text\);\s*font-size:\s*15px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerAnalyticsSignals strong,\s*\.trainerExerciseProgressSummary strong\s*\{\s*color:\s*var\(--tn-text\);\s*font-size:\s*18px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerWorkoutScheduleFooter b,\s*\.trainerWorkoutStatusSummary b\s*\{\s*color:\s*var\(--tn-text\);\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps client section stacks grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerClientBodyProgress,\s*\.trainerClientWorkoutPlan,\s*\.trainerNutritionAnalytics,\s*\.trainerNutritionPlan,\s*\.trainerClientNotifications\s*\{\s*display:\s*grid;\s*gap:\s*14px;\s*padding-top:\s*16px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerClientWorkoutPlan,\s*\.trainerNutritionAnalytics,\s*\.trainerNutritionPlan,\s*\.trainerClientNotifications\s*\{\s*gap:\s*11px;\s*padding-top:\s*12px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerAnalyticsStack,\s*\.trainerNextClientSide,\s*\.trainerMeasurementDashboard,\s*\.trainerNextClientsStandalone,\s*\.trainerNextModal form,\s*\.trainerProgramConstructor,\s*\.trainerWorkoutSchedulePlanner,\s*\.trainerWorkoutScheduleBody\s*\{\s*display:\s*grid;\s*gap:\s*14px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMeasurementCollapsed,\s*\.trainerNextProgramsTab \.programCreateChoiceSheet > div,\s*\.trainerNutritionLegend,\s*\.trainerNextWorkoutPreview > div\s*\{\s*display:\s*grid;\s*gap:\s*10px;\s*\}/g) || []).length,
    1
  );
  assert.equal((source.match(/\.trainerNextWorkoutPreview > div/g) || []).length, 1);
});

test("trainer workspace CSS keeps inline text stacks grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNotificationFeed span,\s*\.trainerNextClientIdentity > span\s*\{\s*min-width:\s*0;\s*display:\s*grid;\s*gap:\s*3px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerAttentionList > button > span,\s*\.trainerNextProgramControl > div > span,\s*\.trainerNextProgramControl label\s*\{\s*min-width:\s*0;\s*display:\s*grid;\s*gap:\s*4px;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps list and action stacks grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerAnalyticsRiskList,\s*\.trainerNextHistoryList,\s*\.trainerClientProgramActionStack\s*\{\s*display:\s*grid;\s*gap:\s*8px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextMoreDrawer nav,\s*\.trainerMessageCoachHint > div,\s*\.trainerProgramCycles\s*\{\s*display:\s*grid;\s*gap:\s*7px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextSidebar nav,\s*\.trainerUtilityToggle span,\s*\.trainerNextLibrary article div\s*\{\s*display:\s*grid;\s*gap:\s*4px;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps micro copy typography grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNextMealList article p,\s*\.trainerNotificationStatusCard p,\s*\.trainerNotificationSettings header p\s*\{\s*margin:\s*4px 0 0;\s*color:\s*var\(--tn-muted\);\s*font-size:\s*9px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerWorkoutMonthStats small,\s*\.trainerWorkoutStatusPanel label span\s*\{\s*color:\s*var\(--tn-muted\);\s*font-size:\s*8px;\s*font-weight:\s*800;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextResultCard strong,\s*\.trainerNextLibrary article strong,\s*\.trainerProgramWeekRow strong,\s*\.trainerNutritionPeriod strong,\s*\.trainerNotificationOffsets > strong,\s*\.trainerProgressReminderSettings > div:first-child > strong,\s*\.trainerNotificationCalendar strong\s*\{\s*font-size:\s*11px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextMacro b,\s*\.trainerNextMacro small,\s*\.trainerProgramEmptyDay span,\s*\.trainerClientBarChart b,\s*\.trainerWorkoutScheduleGrid button b,\s*\.trainerExerciseProgressList article strong,\s*\.trainerNutritionDiary > aside strong,\s*\.trainerNotificationSchedule b,\s*\.trainerNotificationOffsets b,\s*\.trainerProgressReminderOptions b,\s*\.trainerNextWorkoutPreview article div strong\s*\{\s*font-size:\s*10px;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps list tail dividers grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNextClientTable > button:last-of-type,\s*\.trainerNextMealList article:last-child,\s*\.trainerExerciseProgressList article:last-child\s*\{\s*border-bottom:\s*0;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps compact text field stacks grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerExerciseProgressName,\s*\.trainerExerciseProgressResult,\s*\.trainerWorkoutStatusPanel label\s*\{\s*display:\s*grid;\s*gap:\s*5px;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps compact row text stacks grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNextClientHeader > div,\s*\.trainerNextMealList article div,\s*\.trainerNextProgramsTab \.programsOverviewCardTitle > div,\s*\.trainerProgramConstructor button,\s*\.trainerProgramConstructor input,\s*\.trainerClientProgramCurrent \.trainerClientAssignedInfo,\s*\.trainerClientProgramSelectLabel,\s*\.trainerExerciseProgressList article > div,\s*\.trainerNotificationStatusCard > div:nth-child\(2\)\s*\{\s*min-width:\s*0;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextClientTable > button > span:not\(\.trainerNextClientIdentity\):not\(\.trainerNextStatus\),\s*\.trainerNextHistoryList article div\s*\{\s*display:\s*grid;\s*gap:\s*3px;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps shared disabled action states grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerMessageReply > button:disabled,\s*\.trainerMessageModalSend:disabled,\s*\.trainerNextProgramControl > button:disabled,\s*\.trainerClientAssignmentControls > button:disabled,\s*\.trainerClientProgramActionStack > button:disabled,\s*\.trainerWorkoutScheduleFooter button:disabled,\s*\.trainerNotificationActions button:disabled,\s*\.trainerNextLibrary article > button:disabled,\s*\.trainerNextOutlineAdd:disabled\s*\{\s*cursor:\s*not-allowed;\s*opacity:\s*0\.45;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMessageReply > button:disabled,\s*\.trainerMessageModalSend:disabled\s*\{\s*box-shadow:\s*none;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerClientProgramEditButton:disabled,\s*\.trainerClientAssignedProgram > button:disabled\s*\{\s*border-color:\s*var\(--tn-line\);\s*color:\s*var\(--tn-muted\);\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps client nutrition notification panel shells grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNextProgressChart,\s*\.trainerNextResultCard,\s*\.trainerNextActivityCard,\s*\.trainerNextRecommendation,\s*\.trainerNextSimplePanel,\s*\.trainerNextMealPanel,\s*\.trainerNextNutritionSummary > section,\s*\.trainerNextLibrary,\s*\.trainerClientAssignment,\s*\.trainerClientAssignedProgram,\s*\.trainerClientAnalyticsCard,\s*\.trainerClientInlineEditor,\s*\.trainerNotificationStatusCard,\s*\.trainerNotificationSettings\s*\{\s*border:\s*1px solid var\(--tn-line\);\s*border-radius:\s*8px;\s*background:\s*#fff;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps trainer calendar and notification controls grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerWorkoutMonthWeekdays,\s*\.trainerWorkoutMonthGrid,\s*\.trainerWorkoutScheduleWeekdays,\s*\.trainerWorkoutScheduleGrid,\s*\.trainerNotificationWeekdays,\s*\.trainerNotificationCalendarGrid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\);\s*gap:\s*5px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerWorkoutMonthWeekdays span,\s*\.trainerWorkoutScheduleWeekdays span\s*\{\s*color:\s*var\(--tn-muted\);\s*font-size:\s*8px;\s*font-weight:\s*900;\s*text-align:\s*center;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNotificationSwitch input,\s*\.trainerNotificationOffsets input,\s*\.trainerProgressReminderOptions input\s*\{\s*position:\s*absolute;\s*opacity:\s*0;\s*pointer-events:\s*none;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNotificationOffsets,\s*\.trainerReminderPeriod\s*\{\s*margin-top:\s*14px;\s*padding-top:\s*13px;\s*border-top:\s*1px solid #eceaf3;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNotificationOffsets > p,\s*\.trainerProgressReminderSettings > div:first-child > p\s*\{\s*margin:\s*3px 0 10px;\s*color:\s*var\(--tn-muted\);\s*font-size:\s*8px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNotificationIcon\.connected,\s*\.trainerNotificationStatusCard > i\.connected\s*\{\s*background:\s*var\(--tn-green-soft\);\s*color:\s*var\(--tn-green\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextMetricFoot\.green small,\s*\.trainerNextResultCard \.positive,\s*\.trainerNextHistoryList article > svg,\s*\.trainerNextNutritionAnalysis svg\s*\{\s*color:\s*var\(--tn-green\);\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps workout calendar status colors grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerWorkoutMonthGrid \.today,\s*\.trainerWorkoutScheduleGrid \.today\s*\{\s*border-color:\s*var\(--tn-purple-border\);\s*box-shadow:\s*0 0 0 3px rgba\(100,\s*55,\s*245,\s*0\.08\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerWorkoutMonthGrid \.completed,\s*\.trainerWorkoutSchedulePlanner > header > strong\.ready,\s*\.trainerWorkoutScheduleGrid button\.completed\s*\{\s*border-color:\s*#ccebd6;\s*background:\s*#f2fbf5;\s*color:\s*#16813d;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerWorkoutMonthGrid \.completedOffDate,\s*\.trainerWorkoutScheduleGrid button\.completedOffDate\s*\{\s*border-color:\s*#cfc6ff;\s*background:\s*#f6f3ff;\s*color:\s*var\(--tn-purple\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerWorkoutMonthGrid \.completed i,\s*\.trainerWorkoutMonthLegend i\.completed,\s*\.trainerWorkoutScheduleLegend i\.completed\s*\{\s*background:\s*#1fad54;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerWorkoutMonthGrid \.shifted i,\s*\.trainerWorkoutMonthLegend i\.shifted,\s*\.trainerWorkoutScheduleLegend i\.shifted\s*\{\s*background:\s*#d99a22;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps workout schedule pill labels grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerWorkoutScheduleFooter span,\s*\.trainerWorkoutStatusSummary span\s*\{\s*padding:\s*5px 8px;\s*border:\s*1px solid #eceaf3;\s*border-radius:\s*999px;\s*background:\s*#faf9ff;\s*color:\s*var\(--tn-muted\);\s*font-size:\s*8px;\s*font-weight:\s*800;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps shared header layouts grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNextSectionTitle,\s*\.trainerNextClientsTitle,\s*\.trainerNextSummaryHead,\s*\.trainerNextPanelTitle,\s*\.trainerNextChartHead,\s*\.trainerPhotoPreviewModal header,\s*\.trainerNotificationCalendar > header\s*\{\s*display:\s*flex;\s*align-items:\s*center;\s*justify-content:\s*space-between;\s*gap:\s*14px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMessageModalHead,\s*\.trainerWorkoutSchedulePlanner > header\s*\{\s*display:\s*flex;\s*align-items:\s*flex-start;\s*justify-content:\s*space-between;\s*gap:\s*14px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMeasurementChart header,\s*\.trainerMeasurementChart > div,\s*\.trainerWorkoutScheduleMonth\s*\{\s*display:\s*flex;\s*align-items:\s*center;\s*justify-content:\s*space-between;\s*gap:\s*10px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextClientIdentity,\s*\.trainerNextClientName,\s*\.trainerProgramSelectedBar > div\s*\{\s*display:\s*flex;\s*align-items:\s*center;\s*gap:\s*10px;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps compact layout pairs grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNextActivityCard span,\s*\.trainerNotificationCalendar > header > div:last-child\s*\{\s*display:\s*inline-flex;\s*align-items:\s*center;\s*gap:\s*8px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextProgramsTab \.programsOverviewCardStats span svg,\s*\.trainerNextProgramsTab \.programsOverviewCreateCard svg\s*\{\s*grid-row:\s*1 \/ 3;\s*align-self:\s*center;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerWorkoutMonthLegend span,\s*\.trainerWorkoutScheduleLegend span\s*\{\s*display:\s*inline-flex;\s*align-items:\s*center;\s*gap:\s*5px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerWorkoutScheduleGrid button:disabled:not\(\.selected\),\s*\.trainerWorkoutSchedulePlanner\.editing \.trainerWorkoutScheduleGrid button:disabled:not\(\.selected\)\s*\{\s*cursor:\s*not-allowed;\s*opacity:\s*0\.36;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerProgramExerciseList \.trainerNextExerciseActions button:last-child:hover,\s*\.trainerNextExerciseList \.trainerNextExerciseActions button:last-child:hover\s*\{\s*background:\s*#fff1f1;\s*color:\s*#d44a4a;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerClientWorkoutCalendar > header,\s*\.trainerNotificationCalendar > header\s*\{\s*align-items:\s*stretch;\s*flex-direction:\s*column;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps shared four-column grids grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerAnalyticsSignals,\s*\.trainerNextMeasurementGrid,\s*\.trainerNextPhotoGrid,\s*\.trainerMeasurementSummaryGrid\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);\s*gap:\s*10px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextAvatar img,\s*\.trainerNextPhotoGrid img,\s*\.trainerNextExerciseImage img,\s*\.trainerNextExerciseImage video\s*\{\s*width:\s*100%;\s*height:\s*100%;\s*object-fit:\s*cover;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerExerciseProgressToolbar,\s*\.trainerNutritionCustomPeriod\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextExerciseActions,\s*\.trainerProgramExerciseList \.trainerNextExerciseActions\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*22px 22px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextExerciseList \.trainerNextExerciseActions button:first-child,\s*\.trainerProgramExerciseList \.trainerNextExerciseActions button:first-child\s*\{\s*grid-column:\s*auto;\s*width:\s*22px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextExerciseEditor,\s*\.trainerProgramExerciseList \.trainerNextExerciseEditor\s*\{\s*grid-template-columns:\s*1fr;\s*gap:\s*13px;\s*padding:\s*12px 4px 14px;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps panel shells and scrollbars grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerUtilityGrid section,\s*\.trainerAnalyticsGrid article,\s*\.trainerAnalyticsPanel,\s*\.trainerNotificationFeed,\s*\.trainerNotificationsLayout > section\s*\{\s*border:\s*1px solid var\(--tn-line\);\s*border-radius:\s*16px;\s*background:\s*#fff;\s*box-shadow:\s*var\(--tn-soft-shadow\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNotificationFeed strong,\s*\.trainerNextClientIdentity strong\s*\{\s*overflow:\s*hidden;\s*color:\s*var\(--tn-text\);\s*font-size:\s*12px;\s*text-overflow:\s*ellipsis;\s*white-space:\s*nowrap;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMessageSectionHead small,\s*\.trainerMessageList > button small,\s*\.trainerAnalyticsRiskList small,\s*\.trainerNotificationFeed small\s*\{\s*color:\s*var\(--tn-muted\);\s*font-size:\s*11px;\s*font-weight:\s*750;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextMoreDrawer header span,\s*\.trainerPhotoPreviewModal header span\s*\{\s*color:\s*var\(--tn-purple\);\s*font-size:\s*11px;\s*font-weight:\s*900;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMessageList::-webkit-scrollbar-track,\s*\.trainerMessageFilters::-webkit-scrollbar-track,\s*\.trainerNextWorkoutDays::-webkit-scrollbar-track\s*\{\s*background:\s*transparent;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMessageList::-webkit-scrollbar-thumb,\s*\.trainerMessageFilters::-webkit-scrollbar-thumb,\s*\.trainerNextWorkoutDays::-webkit-scrollbar-thumb,\s*\.trainerWorkoutEditorModalBody::-webkit-scrollbar-thumb\s*\{\s*border-radius:\s*999px;\s*background:\s*#c7bbff;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps purple active controls grouped", async () => {
  const source = await readCssWithImports("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerCabinetActions button:not\(\.danger\) svg,\s*\.trainerUtilityActions svg,\s*\.trainerNotificationFeed svg,\s*\.trainerNextMetricFoot\.purple small,\s*\.trainerNextClientTabs button\.active,\s*\.trainerNextPageTabs button\.active,\s*\.trainerNextActivityCard span svg,\s*\.trainerNextProgramsTab \.programCreateChoiceSheet > div > button svg,\s*\.trainerNextProgramsTab \.programAiImportFile svg,\s*\.trainerProgramSelectedBar > svg,\s*\.trainerProgramCycleRow > svg,\s*\.trainerProgramCycle\.selected \.trainerProgramCycleRow strong,\s*\.trainerProgramDay\.selected strong,\s*\.trainerWorkoutMonthControls button:hover,\s*\.trainerNextWorkoutDayItem\.active \.trainerNextWorkoutDaySelect\s*\{\s*color:\s*var\(--tn-purple\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextClientTabs button\.active::after,\s*\.trainerNextPageTabs button\.active::after,\s*\.trainerNotificationSwitch input:checked \+ i,\s*\.trainerNotificationDayBadges i\.workout,\s*\.trainerNotificationLegend i\.workout\s*\{\s*background:\s*var\(--tn-purple\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextChartHead button\.active,\s*\.trainerPhotoViewTabs button\.active,\s*\.trainerNextProgramControl > button:nth-of-type\(1\),\s*\.trainerProgramSelectedBar > div button\.primary,\s*\.trainerNextNutrition > \.trainerNextPageTabs button\.active,\s*\.trainerNutritionPeriodButtons button\.active,\s*\.trainerNotificationOffsets label\.active > span\s*\{\s*border-color:\s*var\(--tn-purple\);\s*background:\s*var\(--tn-purple\);\s*color:\s*#fff;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerMessageFilters button\.active,\s*\.trainerExerciseProgressToolbar button\.active\s*\{\s*background:\s*var\(--tn-purple\);\s*color:\s*#fff;\s*box-shadow:\s*0 8px 18px rgba\(100, 55, 245, 0\.16\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerProgramBreadcrumb > aside button:hover,\s*\.trainerProgramExerciseList \.trainerNextExerciseActions button:hover,\s*\.trainerNextExerciseList \.trainerNextExerciseActions button:hover\s*\{\s*background:\s*#f3f1ff;\s*color:\s*var\(--tn-purple\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerProgramMonthRow button:hover,\s*\.trainerProgramCycleRow button:hover,\s*\.trainerProgramWeekRow button:hover,\s*\.trainerProgramDay > button:not\(:first-child\):hover,\s*\.trainerNextWorkoutDays \.trainerNextWorkoutDayActions button:hover\s*\{\s*background:\s*#f1efff;\s*color:\s*var\(--tn-purple\);\s*\}/g) || []).length,
    1
  );
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

test("admin hub CSS does not keep trainer role button rules", async () => {
  const adminHubCss = await readText("src/styles/adminPanelHub.css");
  const adminCalendarCss = await readCssWithImports("src/styles/admin-calendar-reminders.css");
  const adminPanelHub = await readText("src/components/admin/AdminPanelHub.jsx");

  assert.doesNotMatch(adminPanelHub, /adminTrainerRoleButton|adminClientStatusRender/);
  assert.doesNotMatch(adminHubCss, /adminTrainerRoleButton|adminClientStatusRender/);
  assert.match(adminCalendarCss, /\.adminTrainerRoleButton\s*\{/);
  assert.match(adminCalendarCss, /\.adminTrainerRoleButton\.active\s*\{/);
});

test("modal dialogs expose modal semantics and readable names", async () => {
  const sourceFiles = await collectFiles("src", [".js", ".jsx"]);
  const unnamedDialogs = [];

  for (const file of sourceFiles) {
    const source = await readText(file);

    for (const match of source.matchAll(/<[^>]+role=["']dialog["'][^>]*>/g)) {
      const tag = match[0];
      const hasModal = /aria-modal\s*=/.test(tag);
      const hasName = /aria-label\s*=|aria-labelledby\s*=/.test(tag);
      if (!hasModal || !hasName) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        unnamedDialogs.push(`${file}:${line}`);
      }
    }
  }

  assert.deepEqual(unnamedDialogs, []);
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

  assert.match(aiCoach, /className=\{styles\.back\}[\s\S]*data-testid="ai-coach-back"[\s\S]*aria-labelledby="ai-coach-back-label"/);
  assert.match(aiCoach, /className=\{styles\.srOnly\} id="ai-coach-back-label"/);
  assert.match(basicQuiz, /className=\{styles\.topButton\} type="button"[\s\S]*aria-label="Открыть режим запуска"/);
  assert.match(workoutMode, /className=\{styles\.topButton\} type="button"[\s\S]*aria-label="Открыть главную"/);
  assert.match(workoutMode, /className=\{styles\.topButton\} type="button"[\s\S]*aria-label="Выбрать режим запуска тренировки"/);
  assert.match(historyPage, /className=\{styles\.refresh\}[\s\S]*type="button"[\s\S]*aria-label="Обновить историю тренировок"/);
  assert.match(runOverlays, /type="button"[\s\S]*onClick=\{onClose\}[\s\S]*aria-label="Закрыть видео"/);
  assert.match(dishPicker, /type="button"[\s\S]*?data-dish-ingredient-action="close"[\s\S]*?onClick=\{onClose\}[\s\S]*?aria-label="Закрыть выбор ингредиента"/);
});

test("client cabinet action cards expose explicit accessible labels", async () => {
  const actionGrid = await readText("src/features/client/profile/ProfileCabinetActionGrid.jsx");

  assert.match(actionGrid, /aria-label=\{`\$\{eyebrow\}: \$\{title\}`\}/);
});

test("client cabinet nutrition modal owns scoped styles without legacy nutrition selectors", async () => {
  const nutritionModal = await readText("src/features/client/profile/ProfileNutritionModal.jsx");
  const nutritionModalCss = await readText("src/features/client/profile/ProfileNutritionModal.module.css");
  const legacyFiles = await collectFiles("src/styles", [".css"]);
  const legacyStyles = (await Promise.all(legacyFiles.map((file) => readText(file)))).join("\n");

  assert.match(nutritionModal, /import styles from "\.\/ProfileNutritionModal\.module\.css"/);
  assert.match(nutritionModal, /data-css-module-scope="profile-nutrition-modal"/);
  assert.match(nutritionModal, /className=\{styles\.dialog\}/);
  assert.match(nutritionModal, /className=\{styles\.content\}/);
  assert.match(nutritionModal, /showPlan \? styles\.planned : ""/);
  assert.match(nutritionModal, /day\.isSelected \? styles\.activeDay : ""/);
  assert.match(nutritionModalCss, /\.content\s*\{[\s\S]*max-height:\s*calc\(100dvh - 96px\);/);
  assert.match(nutritionModalCss, /@media \(max-height: 720px\)[\s\S]*\.content\s*\{[\s\S]*overflow-y:\s*auto;/);
  assert.doesNotMatch(nutritionModalCss, /!important|\.cabinetNutrition|\.profileNutrition|\.profileGoalPicker|\.profileMacroGrid/);
  assert.doesNotMatch(
    legacyStyles,
    /\.(?:cabinetNutrition(?:ModalOverlay|Modal|ModalHead|Combined)|profileNutrition[A-Za-z0-9_-]*|profileGoalPicker|profileGoalModeHint|profileMacroGrid)(?![A-Za-z0-9_-])/
  );
});

test("workout navigation compact heights stay grouped", async () => {
  const source = await readCssWithImports("src/styles/workouts.css");

  assert.equal(
    (source.match(/\.exerciseNavigationRow \.exerciseBackButton,\s*\.exerciseNavigationRow \.exerciseNextButton,\s*\.workoutRunPage \.exerciseNavigationRow \.exerciseBackButton,\s*\.workoutRunPage \.exerciseNavigationRow \.exerciseNextButton,\s*\.finishNavigationRow \.finishBackButton,\s*\.finishNavigationRow \.finishWorkoutButton,\s*\.workoutRunPage \.finishNavigationRow \.finishBackButton,\s*\.workoutRunPage \.finishNavigationRow \.finishWorkoutButton\s*\{\s*height:\s*59px !important;/g) || []).length,
    1
  );
});

test("client cabinet measurement cards expose readable values", async () => {
  const measurementsModal = await readText("src/features/client/profile/ProfileMeasurementsModal.jsx");

  assert.match(measurementsModal, /const value = getMeasurementValue\(latestMeasurement, field\)/);
  assert.match(measurementsModal, /aria-label=\{`\$\{field\.label\}: \$\{value\}`\}/);
});

test("client cabinet progress photo compare selects expose readable labels", async () => {
  const photosModal = await readText("src/features/client/profile/ProfileProgressPhotosModal.jsx");

  assert.match(photosModal, /aria-label=\{`Выбрать фотосессию: \$\{label\.toLowerCase\(\)\}`\}/);
});

test("client profile body metric selectors expose readable labels", async () => {
  const bodyMetrics = await readText("src/features/client/profile/ProfileBodyMetricsSettingsSection.jsx");

  assert.match(bodyMetrics, /<select[\s\S]*aria-label="Твоя цель"[\s\S]*value=\{draft\.goal \|\| "recomp"\}/);
  assert.match(bodyMetrics, /<select[\s\S]*aria-label="Активность"[\s\S]*value=\{draft\.activity\}/);
});

test("client basic workout quiz selectors expose readable labels", async () => {
  const basicQuiz = await readText("src/features/client/workouts/BasicWorkoutQuizPage.jsx");

  assert.match(basicQuiz, /<select[\s\S]*aria-label="Цель тренировки"[\s\S]*value=\{basicWorkoutQuiz\.goal\}/);
  assert.match(basicQuiz, /<select[\s\S]*aria-label="Опыт тренировок"[\s\S]*value=\{basicWorkoutQuiz\.level\}/);
  assert.match(basicQuiz, /<select[\s\S]*aria-label="Тренировок в неделю"[\s\S]*value=\{basicWorkoutQuiz\.days\}/);
});

test("client cabinet Telegram modal keeps a contained dialog shell", async () => {
  const telegramModal = await readText("src/features/client/profile/ProfileTelegramModal.jsx");

  assert.match(telegramModal, /className=\{styles\.overlay\}[\s\S]*data-testid="profile-telegram-overlay"[\s\S]*role="presentation"[\s\S]*onClick=\{onClose\}/);
  assert.match(telegramModal, /className=\{styles\.dialog\}[\s\S]*data-testid="profile-telegram-dialog"[\s\S]*role="dialog"[\s\S]*aria-modal="true"[\s\S]*onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
});

test("client harness stays local-only outside dev", async () => {
  const source = await readText("src/utils/clientHarness.js");

  assert.match(source, /import\.meta\.env\.DEV/);
  assert.match(source, /\["localhost",\s*"127\.0\.0\.1",\s*"::1"\]\.includes\(window\.location\.hostname\)/);
  assert.doesNotMatch(source, /return\s+harnessRequested\s*;/);
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
