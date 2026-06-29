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
  const clientFirstSetupLazyCss = await readText("src/styles/client-first-setup-lazy.css");
  const clientMeasurementsLazyCss = await readText("src/styles/client-measurements-lazy.css");
  const clientProfileLazyCss = await readText("src/styles/client-profile-lazy.css");
  const appSource = await readText("src/App.jsx");
  const appCore = await readText("src/AppCore.jsx");
  const appRouter = await readText("src/app/AppRouter.jsx");
  const appStartupGate = await readText("src/app/appStartupGate.jsx");
  const appTerminalRoutes = await readText("src/app/appTerminalRoutes.jsx");
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
  assert.match(clientWorkoutLazyCss, /@import "\.\/workouts\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/workoutFlow\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/legacy-client-workout-flow-late\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/legacy-workout-flow-polish\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/legacy-workout-exercise-notes\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/legacy-workout-navigation-close-early\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/client-workout-set-rows\.css"/);
  assert.match(clientWorkoutLazyCss, /@import "\.\/client-workout-dialogs-lazy\.css"/);
  for (const nutritionLazyImport of [
    "./legacy-food-products-summary-early.css",
    "./legacy-food-editor-workout-close-late.css",
    "./legacy-warm-light-food-edit-back-buttons.css",
    "./legacy-warm-light-add-food-search-cleanup.css",
    "./client-food-search-final.css",
    "./legacy-nutrition-photo-not-found.css",
    "./legacy-nutrition-orbit.css",
    "./legacy-nutrition-flow.css"
  ]) {
    assert.match(nutritionStackCss, new RegExp(`@import "${nutritionLazyImport.replace(".", "\\.")}"`));
  }
  assert.match(appRouter, /['"]\.\.\/styles\/client-workout-lazy\.css['"]/);
  for (const workoutRouteLoader of [
    "loadBasicWorkoutQuizPage",
    "loadWorkoutHistoryPage",
    "loadWorkoutListPage",
    "loadWorkoutModePage",
    "loadWorkoutPlanPage"
  ]) {
    assert.match(appRouter, new RegExp(`const ${workoutRouteLoader} = \\(\\) => Promise\\.all\\(\\[[\\s\\S]*?loadWorkoutStyles\\(\\)`));
  }
  assert.match(appRouter, /['"]\.\.\/styles\/ai-coach-lazy\.css['"]/);
  assert.match(appRouter, /['"]\.\.\/styles\/client-measurements-lazy\.css['"]/);
  assert.match(appStartupGate, /['"]\.\.\/styles\/client-first-setup-lazy\.css['"]/);
  for (const firstSetupLazyImport of [
    "./legacy-profile-first-setup-core.css",
    "./client-questionnaire-sliders.css"
  ]) {
    assert.match(clientFirstSetupLazyCss, new RegExp(`@import "${firstSetupLazyImport.replace(".", "\\.")}"`));
    assert.doesNotMatch(indexCss, new RegExp(`@import "${firstSetupLazyImport.replace(".", "\\.")}"`));
  }
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
    "./legacy-exercise-weight-mode.css",
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
    "./client-first-setup-lazy.css",
    "./client-measurements-lazy.css",
    "./client-profile-lazy.css",
    "./nutrition-stack.css",
    "./legacy-admin-stack.css",
    "./legacy-trainer-desktop-adaptation-late.css",
    "./legacy-trainer-program-editor-late.css",
    "./legacy-trainer-light-workspace.css",
    "./legacy-trainer-light-audit.css",
    "./nutrition-trainer-desktop.css",
    "./workouts.css",
    "./legacy-client-workout-flow-late.css",
    "./workoutFlow.css",
    "./legacy-exercise-weight-mode.css",
    "./legacy-workout-flow-polish.css",
    "./legacy-workout-exercise-notes.css",
    "./legacy-workout-navigation-close-early.css",
    "./client-workout-set-rows.css",
    "./client-workout-dialogs-lazy.css",
    "./legacy-dark-green-food-flow.css",
    "./legacy-food-products-summary-early.css",
    "./legacy-food-editor-workout-close-late.css",
    "./legacy-warm-light-food-edit-back-buttons.css",
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
    path.normalize("src/app/appStartupGate.jsx"),
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
    "src/styles/client-first-setup-lazy.css",
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
  assert.ok(visited.has(path.normalize("src/styles/client-first-setup-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/client-workout-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/nutrition-stack.css")));
  assert.ok(visited.has(path.normalize("src/styles/trainer-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/admin-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/legacy-overrides.css")));
  assert.ok(visited.has(path.normalize("src/components/trainer/trainer-workspace.css")));
  assert.equal(await pathExists("src/styles.css"), false);
  assert.deepEqual(reachableCssFiles, allCssFiles);
});

test("client visual unity CSS does not keep exact duplicate blocks", async () => {
  const source = await readText("src/styles/client-visual-unity-final.css");
  const seenBlocks = new Set();
  const duplicateBlocks = [];

  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2].trim().replace(/\s+/g, " ");
    const key = `${selector} { ${body} }`;
    if (seenBlocks.has(key)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      duplicateBlocks.push(`src/styles/client-visual-unity-final.css:${line}`);
    }
    seenBlocks.add(key);
  }

  assert.deepEqual(duplicateBlocks, []);
});

test("client primary final CSS keeps bottom nav sizing in one owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.mainMenuBottomBar\.profileBottomTabBar\.clientBottomNav,\s*html:root\[data-app-theme="warm-light"\] body #root nav\.mainMenuBottomBar\.profileBottomTabBar\.clientBottomNav,\s*html:root\[data-app-theme="warm-light"\] body #root \.individualWorkoutMenuBar\.clientBottomNav,\s*html:root\[data-app-theme="warm-light"\] body #root nav\.individualWorkoutMenuBar\.clientBottomNav\s*\{\s*position:\s*fixed !important;\s*left:\s*max\(10px, env\(safe-area-inset-left\)\) !important;\s*right:\s*max\(10px, env\(safe-area-inset-right\)\) !important;\s*bottom:\s*max\(10px, env\(safe-area-inset-bottom\)\) !important;\s*z-index:\s*80 !important;\s*width:\s*auto !important;\s*max-width:\s*none !important;\s*height:\s*84px !important;\s*min-height:\s*84px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.mainMenuBottomBar\.profileBottomTabBar\.clientBottomNav > button,\s*html:root\[data-app-theme="warm-light"\] body #root \.individualWorkoutMenuBar\.clientBottomNav > button\s*\{\s*width:\s*100% !important;\s*min-width:\s*0 !important;\s*height:\s*68px !important;\s*min-height:\s*68px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.mainMenuBottomBar\.profileBottomTabBar\.clientBottomNav > button\.active,\s*html:root\[data-app-theme="warm-light"\] body #root \.individualWorkoutMenuBar\.clientBottomNav > button\.active\s*\{\s*border-color:\s*#ded7ff !important;\s*background:\s*#f0edff !important;\s*color:\s*#5d43e8 !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps shared action bar sizing in one owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.mainMenuBottomBar\.profileBottomTabBar\.clientBottomNav,\s*html:root\[data-app-theme="warm-light"\] body #root nav\.mainMenuBottomBar\.profileBottomTabBar\.clientBottomNav,\s*html:root\[data-app-theme="warm-light"\] body #root \.individualWorkoutMenuBar\.clientBottomNav,\s*html:root\[data-app-theme="warm-light"\] body #root nav\.individualWorkoutMenuBar\.clientBottomNav,\s*html:root\[data-app-theme="warm-light"\] body #root \.nutritionBottomTabBar\.clientBottomNav,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSearchBottomBar\.fatSearchBottomBarFour,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodProductActionBar,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodEditPageActionBar\s*\{\s*position:\s*fixed !important;\s*left:\s*max\(10px, env\(safe-area-inset-left\)\) !important;\s*right:\s*max\(10px, env\(safe-area-inset-right\)\) !important;\s*bottom:\s*max\(10px, env\(safe-area-inset-bottom\)\) !important;\s*z-index:\s*90 !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.nutritionBottomTabBar\.clientBottomNav > button,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSearchBottomBar\.fatSearchBottomBarFour > button,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodProductActionBar > button,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodEditPageActionBar > button\s*\{[^}]*height:\s*68px !important;[^}]*min-height:\s*68px !important;[^}]*border-radius:\s*16px !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps food action bars in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.fatSearchBottomBar\.fatSearchBottomBarFour,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatFoodSearchScreenPremium:has\(\.foodEditRenderScreen\) \.foodProductActionBar,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodEditPageOverlay \.foodEditPageActionBar\s*\{\s*width:\s*min\(374px, calc\(100vw - 20px\)\) !important;\s*height:\s*78px !important;\s*border-radius:\s*20px !important;\s*background:\s*rgba\(255, 255, 255, 0\.96\) !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatSearchBottomBar\.fatSearchBottomBarFour,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodProductActionBar,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodEditPageActionBar\s*\{\s*position:\s*fixed !important;\s*left:\s*max\(10px, env\(safe-area-inset-left\)\) !important;\s*right:\s*max\(10px, env\(safe-area-inset-right\)\) !important;\s*bottom:\s*max\(10px, env\(safe-area-inset-bottom\)\) !important;\s*z-index:\s*90 !important;\s*width:\s*auto !important;\s*max-width:\s*none !important;\s*height:\s*84px !important;\s*min-height:\s*84px !important;\s*padding:\s*8px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.fatFoodSearchScreenPremium:has\(\.foodEditRenderScreen\) \.foodProductActionBar\s*\{\s*position:\s*fixed !important;\s*left:\s*50% !important;/g) || []).length,
    0
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.fatFoodSearchScreenPremium:has\(\.foodEditRenderScreen\) \.foodProductActionBar,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodEditPageOverlay \.foodEditPageActionBar\s*\{\s*position:\s*fixed !important;\s*left:\s*50% !important;\s*bottom:\s*max\(10px, calc\(env\(safe-area-inset-bottom\) \+ 8px\)\) !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps food editor header layout in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.foodEditPageOverlay \.foodEditPageHeader\s*\{\s*min-height:\s*var\(--client-title-h\) !important;\s*height:\s*var\(--client-title-h\) !important;\s*margin:\s*0 0 18px !important;\s*padding:\s*0 0 0 calc\(var\(--client-action\) \+ 12px\) !important;\s*position:\s*relative !important;\s*display:\s*flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*flex-start !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps fixed photo action spacing in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.foodSearchFixedPhotoAction\s*\{\s*left:\s*var\(--client-x\) !important;\s*right:\s*var\(--client-x\) !important;\s*bottom:\s*calc\(102px \+ env\(safe-area-inset-bottom\)\) !important;\s*min-height:\s*76px !important;\s*border-radius:\s*18px !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps product flow title typography in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.foodProductFlowHeader \.foodProductFlowTitle h2\s*\{\s*max-width:\s*100% !important;\s*color:\s*var\(--client-title-color\) !important;\s*-webkit-text-fill-color:\s*var\(--client-title-color\) !important;\s*font-size:\s*26px !important;\s*line-height:\s*1\.08 !important;\s*font-weight:\s*900 !important;\s*white-space:\s*normal !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps product flow header layout in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.foodProductFlowHeader\s*\{\s*min-height:\s*126px !important;\s*margin:\s*0 0 16px !important;\s*padding:\s*0 !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*minmax\(0, 1fr\) 116px !important;\s*grid-template-areas:\s*"title actions"\s*"meal meal" !important;\s*align-items:\s*center !important;\s*gap:\s*14px 12px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.foodProductFlowHeader \.foodProductFlowTitle\s*\{\s*grid-area:\s*title !important;\s*min-width:\s*0 !important;\s*padding-right:\s*0 !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.foodProductFlowHeader \.foodEditInlineMealHeader\s*\{\s*grid-area:\s*meal !important;\s*width:\s*min\(300px, 78%\) !important;\s*justify-self:\s*center !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.foodProductFlowHeader\s*\{\s*min-height:\s*128px !important;\s*margin:\s*0 0 16px !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*minmax\(0, 1fr\) 116px !important;\s*grid-template-areas:\s*"title actions"\s*"meal meal" !important;\s*gap:\s*14px 12px !important;\s*align-items:\s*start !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps product top actions layout in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.foodProductTopActions\s*\{\s*top:\s*var\(--client-top\) !important;\s*right:\s*var\(--client-x\) !important;\s*left:\s*auto !important;\s*display:\s*flex !important;\s*gap:\s*10px !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps food search header layout in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.fatSearchTopPremiumHome,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatSearchTopPremiumMy\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\) var\(--client-action\) !important;\s*grid-template-areas:\s*"title close"\s*"meal meal" !important;\s*height:\s*auto !important;\s*min-height:\s*128px !important;\s*align-items:\s*start !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatSearchInputWrapPremium\s*\{\s*min-height:\s*64px !important;\s*border-radius:\s*18px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.foodSearchRecentGrid\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\) !important;\s*gap:\s*10px !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps main AI stats row in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow\s*\{\s*width:\s*100% !important;\s*height:\s*78px !important;\s*min-height:\s*78px !important;\s*margin:\s*0 0 12px !important;\s*padding:\s*0 !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\) !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow strong\s*\{\s*max-width:\s*100% !important;\s*color:\s*var\(--client-ink\) !important;\s*-webkit-text-fill-color:\s*var\(--client-ink\) !important;\s*font-size:\s*clamp\(18px, 5\.4vw, 25px\) !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow > div\s*\{\s*min-width:\s*0 !important;\s*padding:\s*12px 8px !important;\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*align-items:\s*center !important;\s*justify-content:\s*center !important;\s*text-align:\s*center !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow span\s*\{\s*color:\s*var\(--client-muted\) !important;\s*-webkit-text-fill-color:\s*var\(--client-muted\) !important;\s*font-size:\s*12px !important;\s*font-weight:\s*800 !important;\s*line-height:\s*1\.15 !important;\s*text-align:\s*center !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps profile AI hero sizing in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiHero,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileAiHero\s*\{\s*width:\s*100% !important;\s*height:\s*104px !important;\s*min-height:\s*104px !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*74px minmax\(0, 1fr\) !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileAiHero\s*\{\s*border-radius:\s*var\(--client-radius\) !important;\s*box-shadow:\s*var\(--client-shadow\) !important;\s*margin:\s*0 0 12px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileAiHeroText h1\s*\{\s*max-width:\s*100% !important;\s*margin:\s*0 !important;\s*color:\s*var\(--client-ink\) !important;\s*-webkit-text-fill-color:\s*var\(--client-ink\) !important;\s*font-size:\s*clamp\(23px, 6\.4vw, 30px\) !important;\s*line-height:\s*1\.08 !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps profile AI split cards in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiSplitCards\s*\{\s*width:\s*100% !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;\s*gap:\s*12px !important;\s*margin:\s*0 0 12px !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps nutrition arrow sizing in the root owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.nutritionAiPlanCollapsedArrow,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition \.nutritionZoukMeta i\s*\{\s*width:\s*18px !important;\s*min-width:\s*18px !important;\s*height:\s*36px !important;\s*min-height:\s*36px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.nutritionZoukMeta\s*\{\s*width:\s*18px !important;\s*min-width:\s*18px !important;\s*height:\s*36px !important;\s*min-height:\s*36px !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps primary page title typography in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.mainDashboardTitle,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition \.nutritionHeroTitleV4 \.clientCorePageTitle,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileCabinetPageTitle,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.workoutSelectTitle\s*\{\s*height:\s*var\(--client-page-title-height\) !important;\s*min-height:\s*var\(--client-page-title-height\) !important;\s*color:\s*var\(--client-page-title-color\) !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps page title row spacing in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.mainDashboardTitle,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition \.nutritionHeroTitleV4,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileCabinetTitleRow,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.workoutSelectHero\s*\{[^}]*margin:\s*var\(--client-page-title-top\) 0 14px !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps header action sizing in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.menuRefreshIconBtn,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileTrainerNotificationsButton,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition \.nutritionHeaderIconButton,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.workoutHeaderActions button\s*\{\s*width:\s*52px !important;\s*min-width:\s*52px !important;\s*max-width:\s*52px !important;\s*height:\s*52px !important;\s*min-height:\s*52px !important;\s*max-height:\s*52px !important;\s*border-radius:\s*18px !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps client title row sizing in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.mainDashboardTitle,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileCabinetTitleRow,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition \.nutritionHeroTitleV4,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.workoutSelectHero,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatSearchTopPremiumHome,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatSearchTopPremiumMy\s*\{\s*width:\s*100% !important;\s*min-height:\s*var\(--client-title-h\) !important;\s*height:\s*var\(--client-title-h\) !important;\s*margin:\s*0 0 16px !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps client title action styling in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.menuRefreshIconBtn,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileTrainerNotificationsButton,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition \.nutritionHeaderIconButton,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.workoutHeaderActions button,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatSearchClosePremium,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodEditPageOverlay \.foodEditPageHeaderBack,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.foodProductTopAction\s*\{\s*width:\s*var\(--client-action\) !important;\s*height:\s*var\(--client-action\) !important;\s*min-width:\s*var\(--client-action\) !important;\s*min-height:\s*var\(--client-action\) !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps workout start button fixed styling in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutCardStartButton\s*\{\s*position:\s*absolute !important;\s*left:\s*20px !important;\s*right:\s*20px !important;\s*bottom:\s*22px !important;\s*width:\s*auto !important;\s*height:\s*76px !important;\s*min-height:\s*76px !important;\s*border-radius:\s*18px !important;\s*background:\s*linear-gradient\(135deg, #6b4ff4 0%, #2f72f0 100%\) !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutCardStartButton\s*\{\s*bottom:\s*20px !important;\s*\}/g) || []).length,
    1
  );
});

test("client primary final CSS keeps workout card compact sizing in one owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutCardPro\s*\{\s*height:\s*clamp\(470px, calc\(100dvh - 292px\), 560px\) !important;\s*min-height:\s*470px !important;\s*max-height:\s*560px !important;\s*margin-bottom:\s*24px !important;\s*border-radius:\s*24px !important;\s*overflow:\s*hidden !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutProBody\s*\{\s*height:\s*100% !important;\s*border-radius:\s*22px !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps workout compact shell no-op repeats out of media", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutDeck\s*\{\s*width:\s*100% !important;\s*margin:\s*0 !important;\s*padding:\s*0 !important;\s*gap:\s*0 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutCardStartButton\s*\{\s*left:\s*18px !important;\s*right:\s*18px !important;\s*bottom:\s*18px !important;\s*width:\s*calc\(100% - 36px\) !important;\s*min-height:\s*58px !important;\s*border-radius:\s*16px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutBottomPanel\s*\{\s*margin-top:\s*0 !important;\s*padding-top:\s*0 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutBottomProgress\s*\{\s*margin:\s*0 0 4px !important;\s*\}/g) || []).length,
    1
  );
});

test("client primary final CSS keeps workout stats layout in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutStats\s*\{\s*display:\s*grid !important;\s*gap:\s*18px !important;\s*margin-top:\s*26px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutStats span\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*42px minmax\(0, 1fr\) !important;\s*align-items:\s*center !important;\s*gap:\s*12px !important;\s*color:\s*#253047 !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps workout badge layout in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutBadges\s*\{\s*width:\s*100% !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*minmax\(0, 0\.78fr\) minmax\(0, 1\.45fr\) !important;\s*gap:\s*10px !important;\s*margin:\s*0 0 14px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutBadges\s*\{\s*width:\s*100% !important;\s*min-height:\s*42px !important;\s*margin:\s*0 0 12px !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*minmax\(0, 0\.48fr\) minmax\(0, 1fr\) !important;\s*gap:\s*10px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutBadges\s*\{\s*min-height:\s*42px !important;\s*margin:\s*0 0 12px !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*minmax\(0, 0\.45fr\) minmax\(0, 1fr\) !important;\s*gap:\s*10px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutNextBadge,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.individualWorkoutProgressBadge,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.individualWorkoutCompletedBadge,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.individualWorkoutWeek\s*\{\s*height:\s*42px !important;\s*min-height:\s*42px !important;\s*padding:\s*0 14px !important;\s*display:\s*inline-flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*center !important;\s*border-radius:\s*18px !important;\s*white-space:\s*nowrap !important;\s*overflow:\s*hidden !important;\s*text-overflow:\s*ellipsis !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps header action layout in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileCabinetTitleRow \.profileTrainerNotificationsButton,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition \.nutritionHeaderIconActions,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.workoutHeaderActions\s*\{\s*position:\s*static !important;\s*justify-self:\s*end !important;\s*display:\s*flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*flex-end !important;\s*gap:\s*10px !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps workout mobile hero and actions in one owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.clientCorePageWorkout \.workoutSelectHero > p,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.workoutSelectLine\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.workoutSelectHero\s*\{\s*display:\s*flex !important;\s*align-items:\s*center !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.workoutHeaderActions\s*\{\s*top:\s*0 !important;\s*right:\s*0 !important;\s*height:\s*52px !important;\s*\}/g) || []).length,
    1
  );
});

test("client primary final CSS keeps client page variables in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\),\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.individualWorkoutSelectPage,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.basicWorkoutSelectPage\s*\{\s*--client-page-x:\s*22px;\s*--client-page-title-top:\s*54px;\s*--client-page-title-height:\s*52px;\s*--client-page-title-size:\s*30px;\s*--client-page-title-color:\s*#5f5744;/g) || []).length,
    1
  );
});

test("client render target CSS keeps a single workout set-row owner", async () => {
  const source = await readText("src/styles/client-render-target-lock.css");

  assert.doesNotMatch(source, /v127: absolute final override for workout set rows/);
  assert.match(source, /v126: final set-row size\/state polish/);
  assert.equal(
    (source.match(/setRow\.workoutExercisePlanRow\s*\{\s*min-height: 58px !important;/g) || []).length,
    1
  );
});

test("client workout set rows CSS keeps one no-weight modal grid owner", async () => {
  const source = await readText("src/styles/client-workout-set-rows.css");

  assert.equal(
    (source.match(/\.workoutSetEditModalFields\.withoutWeight\s*\{\s*grid-template-columns:\s*1fr !important;\s*\}/g) || []).length,
    1
  );
});

test("client workout card render CSS keeps card sizing in root locks", async () => {
  const source = await readText("src/styles/client-workout-card-render.css");

  assert.doesNotMatch(
    source,
    /individualWorkoutCardPro\s*\{\s*height:\s*100% !important;\s*min-height:\s*0 !important;\s*max-height:\s*none !important;\s*\}/
  );
});

test("client food search final CSS keeps one compact product title-wrap lock", async () => {
  const source = await readText("src/styles/client-food-search-final.css");

  assert.equal(
    (source.match(/fatSearchTitleWrap\s*\{\s*width:\s*min\(352px,\s*calc\(100vw - 24px\)\) !important;\s*max-width:\s*min\(352px,\s*calc\(100vw - 24px\)\) !important;\s*\}/g) || []).length,
    1
  );
});

test("client food search final CSS keeps one compact meal header width owner", async () => {
  const source = await readText("src/styles/client-food-search-final.css");
  const nonHasMealHeaderCompactLocks = source.match(
    /body #root \.fatFoodSearchOverlay \.foodProductRenderScreen \.foodProductFlowHeader \.foodEditInlineMealHeader\s*\{\s*width:\s*min\(352px,\s*calc\(100vw - 36px\)\) !important;\s*max-width:\s*min\(352px,\s*calc\(100vw - 36px\)\) !important;\s*\}/g
  ) || [];

  assert.equal(nonHasMealHeaderCompactLocks.length, 1);
});

test("client food search final CSS keeps one compact product title owner", async () => {
  const source = await readText("src/styles/client-food-search-final.css");
  const nonHasProductTitleCompactLocks = source.match(
    /body #root \.fatFoodSearchOverlay \.foodProductRenderScreen \.foodProductFlowTitle h2\s*\{\s*font-size:\s*25px !important;\s*\}/g
  ) || [];

  assert.equal(nonHasProductTitleCompactLocks.length, 1);
});

test("client food search final CSS keeps product title typography in stable flow owner", async () => {
  const source = await readText("src/styles/client-food-search-final.css");
  const stableFlowStart = source.indexOf("/* Product page stable flow v159 */");
  const hardLockStart = source.indexOf("/* Product page header/search alignment hard lock v160 */");
  const stableFlowBlock = source.slice(stableFlowStart, hardLockStart);

  assert.doesNotMatch(
    source,
    /\/\* Food product\/search alignment and amount behavior v156 \*\/[\s\S]*?\.foodProductFlowTitle h2\s*\{\s*font-size:\s*27px !important;\s*line-height:\s*1 !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\/\* Product page header exact lock v158 \*\/[\s\S]*?\.foodProductFlowTitle h2\s*\{\s*font-size:\s*27px !important;\s*line-height:\s*1 !important;\s*\}/
  );
  assert.match(
    stableFlowBlock,
    /\.foodProductFlowTitle h2\s*\{[\s\S]*?font-size:\s*27px !important;[\s\S]*?line-height:\s*1\.04 !important;/
  );
});

test("client food search final CSS keeps product hero spacing in latest owners", async () => {
  const source = await readText("src/styles/client-food-search-final.css");
  const stableFlowStart = source.indexOf("/* Product page stable flow v159 */");
  const hardLockStart = source.indexOf("/* Product page header/search alignment hard lock v160 */");
  const stableFlowBlock = source.slice(stableFlowStart, hardLockStart);

  assert.equal(
    (source.match(/\.foodProductRenderScreen \.foodProductFlowHeader \+ \.foodEditHeroRender\.foodEditHeroEditable\s*\{\s*margin-top:\s*0 !important;\s*\}/g) || []).length,
    1
  );
  assert.match(
    stableFlowBlock,
    /\.foodProductFlowHeader \+ \.foodEditHeroRender\.foodEditHeroEditable\s*\{\s*margin-top:\s*0 !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.fatFoodSearchScreenPremium:has\(\.foodProductRenderScreen\) \.foodProductRenderScreen\s*\{\s*--food-product-x:\s*14px;\s*\}/g) || []).length,
    1
  );
});

test("legacy nutrition header CSS keeps one compact page padding owner", async () => {
  const source = await readText("src/styles/legacy-nutrition-header-layout.css");

  assert.equal(
    (source.match(/\.fatSecretPage\s*\{\s*padding-left:\s*12px !important;\s*padding-right:\s*12px !important;\s*\}/g) || []).length,
    1
  );
});

test("legacy nutrition header CSS keeps pixel meter span sizes in the later compact owner", async () => {
  const source = await readText("src/styles/legacy-nutrition-header-layout.css");
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

test("legacy nutrition header CSS keeps calorie row sizes in later compact owners", async () => {
  const source = await readText("src/styles/legacy-nutrition-header-layout.css");
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
  const source = await readText("src/styles/legacy-nutrition-header-layout.css");
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
  const source = await readText("src/styles/legacy-nutrition-header-layout.css");
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
  const source = await readText("src/styles/legacy-nutrition-header-layout.css");
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
  const source = await readText("src/styles/legacy-nutrition-header-layout.css");
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
  const source = await readText("src/styles/legacy-nutrition-header-layout.css");
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

test("legacy food search CSS keeps quick actions hidden in root owners", async () => {
  const headerReference = await readText("src/styles/legacy-food-search-header-reference.css");
  const pickerBase = await readText("src/styles/legacy-food-picker-base.css");
  const caloriesTuning = await readText("src/styles/legacy-food-search-calories-tuning.css");

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
  const source = await readText("src/styles/nutrition-food-search-actions.css");

  assert.equal(
    (source.match(/\.fatSearchBottomBarFive \.fatSearchPhotoAction:active\s*\{\s*transform:\s*translateX\(-50%\) scale\(0\.97\) !important;\s*\}/g) || []).length,
    1
  );
});

test("legacy food search calories CSS keeps early mobile column shift out of the old owner", async () => {
  const source = await readText("src/styles/legacy-food-search-calories-tuning.css");
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

test("legacy food search calories CSS keeps compact dots in the latest mobile owner", async () => {
  const source = await readText("src/styles/legacy-food-search-calories-tuning.css");

  assert.equal(
    (source.match(/\.nutritionCaloriesRenderGrid span\s*\{\s*width:\s*7px !important;\s*height:\s*7px !important;\s*\}/g) || []).length,
    1
  );
  assert.match(
    source,
    /NUTRITION CALORIES RENDER CARD[\s\S]*?@media\s*\(max-width:\s*480px\)[\s\S]*?\.nutritionCaloriesRenderGrid span\s*\{\s*width:\s*7px !important;\s*height:\s*7px !important;\s*\}/
  );
});

test("legacy client workout plan tail CSS keeps calorie number sizing in compact height owner", async () => {
  const source = await readText("src/styles/legacy-client-workout-plan-tail.css");
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
  const source = await readText("src/styles/legacy-nutrition-summary-calories.css");
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
  const source = await readText("src/styles/legacy-food-editor-tail.css");

  assert.equal(
    (source.match(/\.summaryDotGrid span\s*\{\s*width:\s*5px !important;\s*height:\s*5px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.summaryDotGrid span\s*\{\s*width:\s*5\.5px !important;\s*height:\s*5\.5px !important;\s*\}/g) || []).length,
    1
  );
});

test("admin CRM CSS keeps client card grid breakpoints in the latest owner", async () => {
  const source = await readText("src/styles/legacy-admin-shell-crm-app46.css");

  assert.doesNotMatch(source, /@media\s*\(max-width:\s*1280px\)\s*\{\s*\.adminClientCardsGridFive/);
  assert.doesNotMatch(source, /@media\s*\(max-width:\s*1020px\)\s*\{\s*\.adminClientCardsGridFive/);
  assert.match(source, /@media\s*\(max-width:\s*1380px\)[\s\S]*?\.adminClientCardsGridFive\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\) !important;/);
  assert.match(source, /@media\s*\(max-width:\s*1120px\)[\s\S]*?\.adminClientCardsGridFive\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\) !important;/);
});

test("admin calendar reminders CSS keeps one fixed back label visibility owner", async () => {
  const source = await readText("src/styles/legacy-admin-calendar-reminders-late.css");

  assert.equal(
    (source.match(/\.adminFixedMainBack b\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
});

test("nutrition calendar CSS keeps final size and label color locks in the final owner", async () => {
  const source = await readText("src/styles/legacy-history-ai-search-late.css");
  const premiumCalendarStart = source.indexOf("/* PREMIUM NUTRITION CALENDAR */");
  const premiumCalendarEnd = source.indexOf("@media (max-width: 380px)", premiumCalendarStart);
  const premiumCalendarBlock = source.slice(premiumCalendarStart, premiumCalendarEnd);
  const earlyNarrowStart = source.indexOf("@media (max-width: 380px)", premiumCalendarStart);
  const alignmentStart = source.indexOf("/* CALENDAR ALIGNMENT TUNING */", earlyNarrowStart);
  const earlyNarrowBlock = source.slice(earlyNarrowStart, alignmentStart);

  assert.doesNotMatch(
    source,
    /\.nutritionCalendarDay small\s*\{[\s\S]*?color:\s*rgba\(184,\s*215,\s*108,\s*0\.92\) !important;/
  );
  assert.doesNotMatch(
    premiumCalendarBlock,
    /\.nutritionCalendarFooter button\s*\{[\s\S]*?min-height:\s*48px !important;[\s\S]*?border-radius:\s*18px !important;[\s\S]*?font-size:\s*14px !important;/
  );
  assert.doesNotMatch(
    earlyNarrowBlock,
    /\.nutritionCalendarGrid\s*\{\s*gap:\s*5px !important;\s*\}/
  );
  assert.doesNotMatch(
    earlyNarrowBlock,
    /\.nutritionCalendarDay strong\s*\{\s*font-size:\s*14px !important;\s*\}/
  );
  assert.match(
    source,
    /\/\* CALENDAR COMPACT PREMIUM TUNING \*\/[\s\S]*?\.nutritionCalendarGrid\s*\{\s*gap:\s*5px !important;\s*\}[\s\S]*?\.nutritionCalendarDay strong\s*\{\s*font-size:\s*14px !important;\s*\}[\s\S]*?\/\* CALENDAR FINAL TUNING \*\/[\s\S]*?\.nutritionCalendarDay small\s*\{\s*color:\s*rgba\(184,\s*215,\s*108,\s*0\.39\) !important;\s*\}[\s\S]*?\.nutritionCalendarFooter button\s*\{\s*min-height:\s*48px !important;\s*border-radius:\s*18px !important;\s*font-size:\s*14px !important;\s*\}/
  );
});

test("legacy nutrition late layout CSS keeps no-op mobile duplicates out of old owners", async () => {
  const source = await readText("src/styles/legacy-nutrition-late-layout.css");
  const tighterSpacingStart = source.indexOf("TIGHTER SEARCH TO CALORIES SPACING");
  const ultraSpacingStart = source.indexOf("ULTRA TIGHT TOP SPACING", tighterSpacingStart);
  const microGapStart = source.indexOf("MICRO TOP GAP MATCH");
  const actionPanelStart = source.indexOf("ACTION PANEL VERTICAL BALANCE", microGapStart);
  const mealRedesignStart = source.indexOf("MEAL CARDS PREMIUM REDESIGN");
  const compactMealStart = source.indexOf("COMPACT MEAL CARDS", mealRedesignStart);
  const ultraSmallGapStart = source.indexOf("ULTRA SMALL GAP BETWEEN MEAL CARDS");
  const balancedGapStart = source.indexOf("BALANCED GAP BETWEEN MEAL CARDS", ultraSmallGapStart);
  const bottomGapStart = source.indexOf("REAL BOTTOM GAP FIX FOR EXPANDED MEAL");
  const darkerOpenStart = source.indexOf("DARKER OPEN MEAL CARD", bottomGapStart);

  assert.ok(tighterSpacingStart >= 0);
  assert.ok(ultraSpacingStart > tighterSpacingStart);
  assert.ok(microGapStart >= 0);
  assert.ok(actionPanelStart > microGapStart);
  assert.ok(mealRedesignStart >= 0);
  assert.ok(compactMealStart > mealRedesignStart);
  assert.ok(ultraSmallGapStart >= 0);
  assert.ok(balancedGapStart > ultraSmallGapStart);
  assert.ok(bottomGapStart >= 0);
  assert.ok(darkerOpenStart > bottomGapStart);

  const tighterSpacingBlock = source.slice(tighterSpacingStart, ultraSpacingStart);
  const microGapBlock = source.slice(microGapStart, actionPanelStart);
  const mealRedesignBlock = source.slice(mealRedesignStart, compactMealStart);
  const ultraSmallGapBlock = source.slice(ultraSmallGapStart, balancedGapStart);
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
});

test("admin client dashboard polish CSS has no empty media blocks", async () => {
  const source = await readText("src/styles/legacy-admin-client-dashboard-polish.css");

  assert.doesNotMatch(source, /@media\s+[^{]+\{\s*\}/);
});

test("profile dashboard CSS keeps AI stats compact sizing in the latest owner", async () => {
  const source = await readText("src/styles/legacy-profile-dashboard-telegram-late.css");
  const statsAlignmentStart = source.indexOf("/* STATS ALIGNMENT PERFECT */");
  const compactStatsStart = source.indexOf("/* COMPACT STATS + AI TITLE */");
  const oldStatsBlock = source.slice(statsAlignmentStart, compactStatsStart);
  const compactStatsBlock = source.slice(compactStatsStart);

  assert.doesNotMatch(
    oldStatsBlock,
    /@media\s*\(max-width:\s*420px\)[\s\S]*?\.profileAiStatsRow > div\s*\{\s*height:\s*82px !important;/
  );
  assert.match(
    compactStatsBlock,
    /\.profileAiStatsRow > div\s*\{\s*height:\s*72px !important;\s*min-height:\s*72px !important;[\s\S]*?@media\s*\(max-width:\s*420px\)[\s\S]*?\.profileAiStatsRow > div\s*\{\s*height:\s*66px !important;\s*min-height:\s*66px !important;/
  );
});

test("client main CSS keeps compact AI stat text rules in the later owner", async () => {
  const source = await readText("src/styles/client-main-final-overrides.css");

  assert.equal((source.match(/--main-home-primary-text-size:\s*16\.2px;/g) || []).length, 1);
  assert.equal(
    (source.match(/\.profileAiStatsRow\.profileAiStatsRow\.profileAiStatsRow > div\s*\{\s*align-items:\s*center !important;\s*justify-content:\s*center !important;\s*text-align:\s*center !important;\s*\}/g) || []).length,
    1
  );
  assert.match(source, /\.profileAiCoachHeadline span[\s\S]*?text-transform:\s*none !important;/);
  assert.match(source, /\.profileAiCoachHeadline h2\s*\{\s*color:\s*var\(--main-nutrition-ink\) !important;[\s\S]*?font-size:\s*10\.25px !important;[\s\S]*?letter-spacing:\s*0 !important;\s*\}/);
});

test("client nutrition grid CSS keeps progress insight spacing in the final owner", async () => {
  const source = await readText("src/styles/client-nutrition-grid-lock.css");
  const earlyProgressStart = source.indexOf("/* v.1.200: progress card spacing only");
  const finalProgressStart = source.indexOf("/* v.1.200 final position: progress card spacing only");

  assert.equal(earlyProgressStart, -1);
  assert.ok(finalProgressStart >= 0);
  assert.equal(
    (source.match(/\.profileAiCoachInsight\.profileProgressInsightCard\.profileProgressInsightCard\s*\{\s*height:\s*196px !important;\s*min-height:\s*196px !important;\s*max-height:\s*196px !important;\s*flex-basis:\s*196px !important;\s*padding:\s*20px 20px 16px !important;\s*gap:\s*12px !important;\s*\}/g) || []).length,
    1
  );
  assert.match(
    source.slice(finalProgressStart),
    /\.profileProgressInsightBadge small\s*\{\s*font-size:\s*8\.5px !important;\s*line-height:\s*1 !important;\s*\}/
  );
});

test("desktop cabinet CSS keeps trainer client overview grid locks in the broad mobile owner", async () => {
  const source = await readText("src/styles/legacy-desktop-cabinet-polish.css");
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

  assert.match(workoutListPage, /className=\{`workoutSelectCard individualWorkoutCardPro[\s\S]*aria-current=\{activeNext \? "step" : undefined\}/);
});

test("client nutrition weekday strip exposes selected and current date state", async () => {
  const nutritionHeader = await readText("src/features/client/nutrition/NutritionHeader.jsx");

  assert.match(nutritionHeader, /className=\{`nutritionDayV4 \$\{isSelectedDay \? "selected" : ""\}[\s\S]*aria-pressed=\{isSelectedDay\}/);
  assert.match(nutritionHeader, /aria-current=\{isTodayDay \? "date" : undefined\}/);
});

test("client nutrition weekday strip keeps two-letter labels visible", async () => {
  const nutritionCalendar = await readText("src/utils/nutritionCalendar.js");
  const nutritionCss = await readText("src/styles/nutrition-food-flow-late.css");

  assert.match(nutritionCalendar, /NUTRITION_WEEK_LABELS = \["\\u041f\\u041d", "\\u0412\\u0422", "\\u0421\\u0420", "\\u0427\\u0422", "\\u041f\\u0422", "\\u0421\\u0411", "\\u0412\\u0421"\]/);
  assert.match(nutritionCss, /Preserve both letters in Russian weekday abbreviations/);
  assert.match(nutritionCss, /\.nutritionWeekV4 \.nutritionDayV4 small \{[\s\S]*min-width: 2\.4ch !important;[\s\S]*width: 2\.4ch !important;[\s\S]*white-space: nowrap !important;/);
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

  assert.match(nutritionCalendar, /day\.isSelected \? "selected" : ""[\s\S]*aria-pressed=\{day\.isSelected\}/);
  assert.match(nutritionCalendar, /aria-current=\{day\.isToday \? "date" : undefined\}/);
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

  assert.match(aiCoach, /aiCoachBackBtn" type="button"[\s\S]*aria-label="Назад"/);
  assert.match(basicQuiz, /className="workoutModeBack" type="button"[\s\S]*aria-label="Назад к выбору режима"/);
  assert.match(workoutMode, /className="workoutModeBack" type="button"[\s\S]*aria-label="Назад на главную"/);
  assert.match(historyPage, /historyCompactRefresh" type="button"[\s\S]*aria-label="Обновить историю тренировок"/);
  assert.match(runOverlays, /type="button"[\s\S]*onClick=\{onClose\}[\s\S]*aria-label="Закрыть видео"/);
  assert.match(dishPicker, /type="button" onClick=\{onClose\} aria-label="Закрыть выбор ингредиента"/);
});

test("client cabinet action cards expose explicit accessible labels", async () => {
  const actionGrid = await readText("src/features/client/profile/ProfileCabinetActionGrid.jsx");

  assert.match(actionGrid, /aria-label=\{`\$\{eyebrow\}: \$\{title\}`\}/);
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

  assert.match(telegramModal, /profileTelegramModalOverlay" role="presentation" onClick=\{onClose\}/);
  assert.match(telegramModal, /className="profileTelegramModal profileTelegramManageModal"[\s\S]*role="dialog"[\s\S]*aria-modal="true"[\s\S]*onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
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
