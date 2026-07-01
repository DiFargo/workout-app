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

test("legacy registration CSS keeps first setup active choices grouped", async () => {
  const source = await readText("src/styles/legacy-registration-accessibility.css");

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

test("legacy registration CSS keeps workout history item internals grouped", async () => {
  const source = await readText("src/styles/legacy-registration-accessibility.css");

  assert.equal(
    (
      source.match(
        /\.workoutHistoryModalList > button > span,\s*\.workoutHistoryModalItem > span,\s*\.cabinetWorkoutHistoryItem > button > span\s*\{\s*width:\s*38px;\s*height:\s*38px;\s*display:\s*grid;\s*place-items:\s*center;\s*border-radius:\s*11px;\s*background:\s*rgba\(107, 92, 255, 0\.14\);\s*font-size:\s*18px;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /\.workoutHistoryModalList strong,\s*\.cabinetWorkoutHistoryItem > button strong\s*\{\s*overflow:\s*hidden;\s*font-size:\s*12px;\s*line-height:\s*1\.2;\s*text-overflow:\s*ellipsis;\s*white-space:\s*nowrap;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /\.workoutHistoryModalList > button div,\s*\.workoutHistoryModalItem > div,\s*\.cabinetWorkoutHistoryItem > button div\s*\{\s*min-width:\s*0;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /\.workoutHistoryModalList strong,\s*\.workoutHistoryModalList small,\s*\.cabinetWorkoutHistoryItem > button strong,\s*\.cabinetWorkoutHistoryItem > button small\s*\{\s*display:\s*block;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /\.workoutHistoryModalList small,\s*\.cabinetWorkoutHistoryItem > button small\s*\{\s*margin-top:\s*4px;\s*color:\s*rgba\(247, 248, 252, 0\.56\);\s*font-size:\s*10px;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal((source.match(/background:\s*rgba\(107, 92, 255, 0\.14\);\s*font-size:\s*18px;/g) || []).length, 1);
  assert.equal((source.match(/font-size:\s*12px;\s*line-height:\s*1\.2;\s*text-overflow:\s*ellipsis;/g) || []).length, 1);
  assert.equal((source.match(/color:\s*rgba\(247, 248, 252, 0\.56\);\s*font-size:\s*10px;/g) || []).length, 1);
});

test("legacy registration CSS keeps warm-light nutrition icon shells grouped", async () => {
  const source = await readText("src/styles/legacy-registration-accessibility.css");

  assert.equal(
    (
      source.match(
        /:root\[data-app-theme="warm-light"\] \.nutritionHeaderIconActions button,\s*:root\[data-app-theme="warm-light"\] \.nutritionCalendarClose\s*\{\s*border-color:\s*#e3e6f1;\s*background:\s*#ffffff;\s*color:\s*#151824;\s*box-shadow:\s*0 5px 14px rgba\(55, 64, 112, 0\.07\);\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (source.match(/box-shadow:\s*0 5px 14px rgba\(55, 64, 112, 0\.07\);/g) || []).length,
    1
  );
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

test("client visual unity CSS keeps goal stat typography in the final owner", async () => {
  const source = await readText("src/styles/client-visual-unity-final.css");
  const mobileFixStart = source.indexOf("v.1.89: final mobile alignment fixes");
  const fullCardGoalStart = source.indexOf("v.1.90: override the older full-card goal selector", mobileFixStart);
  const earlyBlock = source.slice(mobileFixStart, fullCardGoalStart);
  const finalBlock = source.slice(fullCardGoalStart);

  assert.ok(mobileFixStart >= 0);
  assert.ok(fullCardGoalStart > mobileFixStart);
  assert.doesNotMatch(
    earlyBlock,
    /\.profileAiStatsRow > div\.goal > strong,[\s\S]*?\{\s*display:\s*block !important;[\s\S]*?font-size:\s*14px !important;/
  );
  assert.match(
    finalBlock,
    /\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow > div\.goal > strong,[\s\S]*?\.profileUnifiedCard\.profileAiDashboardCard\.profileCabinetSection \.profileAiStatsRow > div\.goal > strong\s*\{\s*display:\s*block !important;[\s\S]*?font-size:\s*14px !important;[\s\S]*?word-break:\s*keep-all !important;/
  );
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

test("legacy bottom bars CSS keeps button shells in the final owner", async () => {
  const source = await readText("src/styles/legacy-bottom-bars.css");
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

test("client primary final CSS keeps profile progress overview grid in one owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.doesNotMatch(
    source,
    /\.profileDashboardPage\.clientCorePageMain \.profileAiCoachInsight\.profileProgressInsightCard\s*\{\s*margin:\s*0 0 12px !important;\s*border:\s*1px solid var\(--client-border\) !important;\s*border-radius:\s*var\(--client-radius\) !important;\s*background:\s*#ffffff !important;\s*color:\s*var\(--client-ink\) !important;\s*box-shadow:\s*var\(--client-shadow\) !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileCabinetProgressOverview\s*\{\s*width:\s*100% !important;\s*display:\s*grid !important;\s*gap:\s*12px !important;\s*margin:\s*0 !important;\s*\}/g) || []).length,
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
    (source.match(/\.foodProductActionBar,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodEditPageActionBar\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*0\.92fr 1\.58fr !important;\s*gap:\s*8px !important;\s*\}/g) || []).length,
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

test("client primary final CSS keeps food action label typography grouped", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.fatSearchBottomBarFour > button strong,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatFoodSearchScreenPremium:has\(\.foodEditRenderScreen\) \.foodProductActionBar > button strong,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodEditPageOverlay \.foodEditPageActionBar > button strong\s*\{\s*max-width:\s*100% !important;\s*overflow:\s*hidden !important;\s*color:\s*inherit !important;\s*font-size:\s*10\.5px !important;\s*font-weight:\s*850 !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/max-width:\s*100% !important;\s*overflow:\s*hidden !important;\s*color:\s*inherit !important;\s*font-size:\s*10\.5px !important;\s*font-weight:\s*850 !important;\s*line-height:\s*1\.05 !important;\s*text-align:\s*center !important;\s*text-overflow:\s*ellipsis !important;\s*white-space:\s*nowrap !important;\s*-webkit-text-fill-color:\s*currentColor !important;/g) || []).length,
    1
  );
});

test("client primary final CSS keeps food editor header layout in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.foodEditPageOverlay \.foodEditPageHeader\s*\{\s*min-height:\s*var\(--client-title-h\) !important;\s*height:\s*var\(--client-title-h\) !important;\s*margin:\s*0 0 18px !important;\s*padding:\s*0 0 0 calc\(var\(--client-action\) \+ 12px\) !important;\s*position:\s*relative !important;\s*display:\s*flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*flex-start !important;/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.foodEditPageOverlay \.foodEditPageHeader\s*\{\s*min-height:\s*var\(--client-title-h\) !important;\s*height:\s*var\(--client-title-h\) !important;\s*margin:\s*0 0 18px !important;\s*padding:\s*0 0 0 calc\(var\(--client-action\) \+ 12px\) !important;\s*display:\s*flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*flex-start !important;\s*position:\s*relative !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.foodEditRenderScreen \.foodProductFlowHeader\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*minmax\(0, 1fr\) 116px !important;\s*grid-template-areas:\s*"title actions"\s*"meal meal" !important;\s*align-items:\s*center !important;\s*gap:\s*12px 10px !important;\s*margin-bottom:\s*14px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.foodEditRenderScreen \.foodProductFlowHeader \.foodProductFlowTitle\s*\{\s*grid-area:\s*title !important;\s*height:\s*52px !important;\s*min-height:\s*52px !important;\s*padding-right:\s*0 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.foodEditRenderScreen \.foodProductFlowHeader \.foodEditInlineMealHeader\s*\{\s*grid-area:\s*meal !important;\s*width:\s*min\(270px, 100%\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.foodEditRenderScreen \.foodProductFlowHeader \.foodProductFlowTitle h2\s*\{\s*font-size:\s*26px !important;\s*line-height:\s*1\.05 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.foodEditPageOverlay \.foodEditPageSheet\s*\{\s*padding-top:\s*16px !important;\s*padding-bottom:\s*calc\(104px \+ env\(safe-area-inset-bottom\)\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.foodEditPageOverlay \.foodEditPageHeader\s*\{\s*min-height:\s*64px !important;\s*padding:\s*4px 54px 8px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.foodEditPageOverlay \.foodEditPageHeaderBack\s*\{\s*top:\s*2px !important;\s*width:\s*52px !important;\s*height:\s*52px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.foodEditPageOverlay \.foodEditIconPresetRow\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.foodEditRenderScreen\s*\{\s*padding-bottom:\s*calc\(110px \+ env\(safe-area-inset-bottom\)\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.foodEditPageOverlay\s*\{\s*align-items:\s*stretch !important;\s*justify-content:\s*center !important;\s*padding:\s*0 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.foodEditPageOverlay \.foodEditPageHeaderBack\s*\{\s*position:\s*absolute !important;\s*top:\s*0 !important;\s*left:\s*0 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/body #root \.foodEditIconPresetRow\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
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
    (source.match(/\.fatFoodSearchOverlay \.foodProductFlowHeader \.foodProductFlowTitle\s*\{\s*grid-area:\s*title !important;\s*align-self:\s*center !important;\s*\}/g) || []).length,
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
    (source.match(/\.fatFoodSearchOverlay \.fatSearchTopPremiumHome \.foodFlowSearchTitle\s*\{\s*grid-area:\s*title !important;\s*min-width:\s*0 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.fatSearchTopPremiumHome \.fatSearchClosePremium\s*\{\s*grid-area:\s*close !important;\s*justify-self:\s*end !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.fatSearchTopPremiumHome \.fatSearchTitleWrap\s*\{\s*grid-area:\s*meal !important;\s*width:\s*min\(300px, 78%\) !important;\s*justify-self:\s*center !important;\s*\}/g) || []).length,
    1
  );
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
  assert.equal(
    (source.match(/\.fatFoodSearchOverlay \.fatFoodSearchScreenPremium:has\(\.fatSearchTopPremiumHome\):not\(:has\(\.foodEditRenderScreen\)\)\s*\{\s*padding-top:\s*74px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchScreenPremium:has\(\.fatSearchTopPremiumHome\) > \.fatSearchTopPremiumHome\s*\{\s*min-height:\s*122px !important;\s*margin:\s*0 0 16px !important;\s*grid-template-columns:\s*minmax\(0, 1fr\) 52px !important;\s*gap:\s*12px 10px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchScreenPremium:has\(\.fatSearchTopPremiumHome\) \.foodFlowSearchTitle h2\s*\{\s*height:\s*52px !important;\s*min-height:\s*52px !important;\s*font-size:\s*30px !important;\s*font-weight:\s*900 !important;\s*line-height:\s*1\.03 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchScreenPremium:has\(\.fatSearchTopPremiumHome\) > \.fatSearchTopPremiumHome \.fatSearchClosePremium\s*\{\s*width:\s*52px !important;\s*min-width:\s*52px !important;\s*height:\s*52px !important;\s*min-height:\s*52px !important;\s*border-radius:\s*18px !important;\s*background:\s*#ffffff !important;\s*background-image:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.fatFoodSearchScreenPremium:has\(\.fatSearchTopPremiumHome\) \.fatSearchInputWrapPremium\s*\{\s*min-height:\s*60px !important;\s*margin-bottom:\s*16px !important;\s*border-radius:\s*17px !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.foodSearchRecentGrid\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\) !important;\s*grid-auto-rows:\s*78px !important;\s*gap:\s*9px !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.foodSearchRecentGrid\s*\{\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\) !important;\s*grid-auto-rows:\s*78px !important;\s*gap:\s*9px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.foodSearchRecentCard\s*\{\s*min-height:\s*78px !important;\s*height:\s*78px !important;\s*border-radius:\s*13px !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.foodSearchRecentCard\s*\{\s*height:\s*78px !important;\s*min-height:\s*78px !important;\s*\}/
  );
});

test("client primary final CSS keeps main AI stats row in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow\s*\{\s*width:\s*100% !important;\s*height:\s*78px !important;\s*min-height:\s*78px !important;\s*margin:\s*0 0 12px !important;\s*padding:\s*0 !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\) !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow\s*\{\s*margin-top:\s*-1px !important;\s*margin-bottom:\s*12px !important;\s*border-radius:\s*0 0 var\(--client-page-card-radius\) var\(--client-page-card-radius\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow strong\s*\{\s*max-width:\s*100% !important;\s*color:\s*var\(--client-ink\) !important;\s*-webkit-text-fill-color:\s*var\(--client-ink\) !important;\s*font-size:\s*clamp\(18px, 5\.4vw, 25px\) !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow \.goal strong\s*\{\s*font-size:\s*clamp\(15px, 4\.7vw, 22px\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow > div\s*\{\s*min-width:\s*0 !important;\s*height:\s*100% !important;\s*padding:\s*10px 6px !important;\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*align-items:\s*center !important;\s*justify-content:\s*center !important;\s*text-align:\s*center !important;\s*gap:\s*5px !important;/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow > div\s*\{\s*min-width:\s*0 !important;\s*padding:\s*12px 8px !important;\s*display:\s*flex !important;\s*flex-direction:\s*column !important;\s*align-items:\s*center !important;\s*justify-content:\s*center !important;\s*text-align:\s*center !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow > div\s*\{\s*justify-content:\s*center !important;\s*text-align:\s*center !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow span\s*\{\s*color:\s*var\(--client-muted\) !important;\s*-webkit-text-fill-color:\s*var\(--client-muted\) !important;\s*font-size:\s*12px !important;\s*font-weight:\s*800 !important;\s*line-height:\s*1\.15 !important;\s*text-align:\s*center !important;/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow span\s*\{\s*color:\s*#7f8798 !important;\s*-webkit-text-fill-color:\s*#7f8798 !important;\s*font-size:\s*11px !important;\s*font-weight:\s*750 !important;\s*line-height:\s*1\.15 !important;\s*\}/
  );
  assert.doesNotMatch(
    source,
    /\.profileDashboardPage\.clientCorePageMain \.profileAiStatsRow strong\s*\{\s*color:\s*#171923 !important;\s*-webkit-text-fill-color:\s*#171923 !important;\s*font-size:\s*19px !important;\s*font-weight:\s*900 !important;\s*line-height:\s*1\.05 !important;\s*text-align:\s*center !important;\s*\}/
  );
});

test("client primary final CSS keeps profile AI hero sizing in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiHero,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileAiHero\s*\{\s*width:\s*100% !important;\s*height:\s*104px !important;\s*min-height:\s*104px !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*74px minmax\(0, 1fr\) !important;/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileAiHero\s*\{\s*pointer-events:\s*none !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileAiHero\s*\{\s*border-radius:\s*var\(--client-radius\) !important;\s*pointer-events:\s*none !important;\s*\}/g) || []).length,
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

test("client primary final CSS keeps profile AI hero compact cluster in root owners", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileUnifiedCard\.profileAiDashboardCard\.profileCabinetSection,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileUnifiedCard\.profileAiDashboardCard\.profileCabinetSection\s*\{\s*width:\s*100% !important;\s*margin:\s*0 !important;\s*padding:\s*0 !important;\s*border:\s*0 !important;\s*background:\s*transparent !important;\s*box-shadow:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileAiAvatarWrap,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileAiAvatarWrap,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileDashboardPage\.clientCorePageMain \.profileAiAvatar,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileAiAvatar\s*\{\s*width:\s*72px !important;\s*height:\s*72px !important;\s*min-width:\s*72px !important;\s*min-height:\s*72px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileAiAvatarWrap,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileAiAvatar\s*\{\s*width:\s*70px !important;\s*height:\s*70px !important;\s*min-width:\s*70px !important;\s*min-height:\s*70px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileAiHeroText h1,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileAiHeroText h1\s*\{\s*margin:\s*0 !important;\s*color:\s*var\(--client-ink\) !important;\s*-webkit-text-fill-color:\s*var\(--client-ink\) !important;\s*font-size:\s*21px !important;\s*font-weight:\s*900 !important;\s*line-height:\s*1\.12 !important;\s*letter-spacing:\s*0 !important;\s*text-shadow:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiHero,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileAiHero\s*\{\s*min-height:\s*94px !important;\s*padding:\s*16px 18px !important;\s*grid-template-columns:\s*72px minmax\(0, 1fr\) !important;\s*gap:\s*18px !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.profileDashboardPage\.clientCorePageMain \.profileAiHero\s*\{\s*border-radius:\s*var\(--client-page-card-radius\) var\(--client-page-card-radius\) 0 0 !important;\s*margin-bottom:\s*0 !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiHero\s*\{\s*margin-bottom:\s*0 !important;\s*border-radius:\s*var\(--client-page-card-radius\) var\(--client-page-card-radius\) 0 0 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiMiniCard,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileDashboardPage\.clientCorePageMain \.profileAiCoachInsight\.profileProgressInsightCard,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileDashboardPage\.clientCorePageMain \.mainMeasurementSnapshot\s*\{\s*background:\s*rgba\(255, 255, 255, 0\.94\) !important;\s*color:\s*#171923 !important;\s*-webkit-text-fill-color:\s*#171923 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiAvatarRing,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileAiAvatarRing\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiHero::after,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileAiHero::after\s*\{\s*content:\s*none !important;\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.profileDashboardPage\.clientCorePageMain::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\)::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.individualWorkoutSelectPage::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.basicWorkoutSelectPage::before\s*\{\s*display:\s*none !important;\s*content:\s*none !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\)::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.individualWorkoutSelectPage::before,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.basicWorkoutSelectPage::before\s*\{\s*content:\s*none !important;\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileAiHero::after/g) || []).length,
    2
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
    (source.match(/\.nutritionAiPlanTopCard,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition \.nutritionZoukHeader\s*\{\s*min-height:\s*88px !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*62px minmax\(0, 1fr\) 24px !important;\s*align-items:\s*center !important;\s*gap:\s*14px !important;\s*padding:\s*14px 18px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.nutritionAiPlanCollapsedArrow,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition \.nutritionZoukMeta i\s*\{\s*width:\s*18px !important;\s*min-width:\s*18px !important;\s*height:\s*36px !important;\s*min-height:\s*36px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.nutritionZoukMeta\s*\{\s*width:\s*18px !important;\s*min-width:\s*18px !important;\s*height:\s*36px !important;\s*min-height:\s*36px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.nutritionZoukMeta small\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
});

test("client primary final CSS keeps primary page title typography in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.mainDashboardTitle,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition \.nutritionHeroTitleV4 \.clientCorePageTitle,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\) \.profileCabinetPageTitle,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.workoutSelectTitle\s*\{\s*height:\s*var\(--client-page-title-height\) !important;\s*min-height:\s*var\(--client-page-title-height\) !important;\s*color:\s*var\(--client-page-title-color\) !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.workoutSelectTitle\s*\{\s*width:\s*calc\(100% - 118px\) !important;\s*max-width:\s*calc\(100% - 118px\) !important;\s*overflow:\s*hidden !important;\s*text-overflow:\s*ellipsis !important;\s*\}/g) || []).length,
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
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.menuRefreshIconBtn\s*\{\s*position:\s*absolute !important;\s*top:\s*var\(--client-top\) !important;\s*right:\s*var\(--client-x\) !important;\s*z-index:\s*35 !important;\s*margin:\s*0 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.menuRefreshIconBtn\s*\{\s*top:\s*var\(--client-page-title-top\) !important;\s*right:\s*var\(--client-page-x\) !important;\s*\}/g) || []).length,
    1
  );
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
  assert.doesNotMatch(
    source,
    /\.clientCorePageWorkout \.individualWorkoutCardStartButton\s*\{\s*left:\s*18px !important;\s*right:\s*18px !important;\s*bottom:\s*22px !important;\s*height:\s*62px !important;\s*min-height:\s*62px !important;\s*border-radius:\s*16px !important;\s*\}/
  );
});

test("client primary final CSS keeps workout card compact sizing in one owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutDeck\s*\{\s*width:\s*100% !important;\s*margin:\s*0 0 46px !important;\s*padding:\s*0 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutCardPro\s*\{\s*height:\s*clamp\(470px, calc\(100dvh - 292px\), 560px\) !important;\s*min-height:\s*470px !important;\s*max-height:\s*560px !important;\s*margin-bottom:\s*24px !important;\s*border-radius:\s*24px !important;\s*overflow:\s*hidden !important;/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.clientCorePageWorkout \.individualWorkoutCardPro\s*\{\s*border:\s*1px solid #e0e4ef !important;\s*border-radius:\s*24px !important;\s*background:\s*rgba\(255, 255, 255, 0\.94\) !important;\s*box-shadow:\s*0 16px 38px rgba\(55, 64, 112, 0\.12\) !important;\s*overflow:\s*hidden !important;\s*\}/
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
  assert.doesNotMatch(
    source,
    /\.clientCorePageWorkout \.individualWorkoutBadges\s*\{\s*min-height:\s*42px !important;\s*margin:\s*0 0 12px !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*minmax\(0, 0\.45fr\) minmax\(0, 1fr\) !important;\s*gap:\s*10px !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout \.individualWorkoutNextBadge,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.individualWorkoutProgressBadge,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.individualWorkoutCompletedBadge,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.individualWorkoutWeek\s*\{\s*height:\s*42px !important;\s*min-height:\s*42px !important;\s*padding:\s*0 14px !important;\s*display:\s*inline-flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*center !important;\s*border-radius:\s*18px !important;\s*white-space:\s*nowrap !important;\s*overflow:\s*hidden !important;\s*text-overflow:\s*ellipsis !important;/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.clientCorePageWorkout \.individualWorkoutNextBadge,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout \.individualWorkoutWeek\s*\{\s*height:\s*42px !important;\s*min-height:\s*42px !important;\s*padding:\s*0 16px !important;\s*justify-content:\s*center !important;\s*border-radius:\s*18px !important;\s*white-space:\s*nowrap !important;\s*overflow:\s*hidden !important;\s*text-overflow:\s*ellipsis !important;\s*\}/
  );
});

test("client primary final CSS keeps header action layout in the final owner", async () => {
  const source = await readText("src/styles/client-primary-final-lock.css");

  assert.doesNotMatch(
    source,
    /\.clientCorePageWorkout\.individualWorkoutSelectPage \.workoutHeaderActions,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.basicWorkoutSelectPage \.workoutHeaderActions\s*\{\s*position:\s*static !important;\s*inset:\s*auto !important;\s*justify-self:\s*end !important;\s*display:\s*flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*flex-end !important;\s*gap:\s*10px !important;\s*width:\s*auto !important;\s*height:\s*var\(--client-action\) !important;\s*margin:\s*0 !important;\s*padding:\s*0 !important;\s*transform:\s*none !important;\s*\}/
  );
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
  const rhythmStart = source.indexOf("/* v.1.39: final rhythm lock for the four primary client screens. */");
  const beforeRhythmBlock = source.slice(0, rhythmStart);

  assert.ok(rhythmStart >= 0);
  assert.doesNotMatch(beforeRhythmBlock, /\.profileDashboardPage\.clientCorePageMain::after/);
  assert.match(
    source.slice(rhythmStart),
    /\.profileDashboardPage\.clientCorePageMain::after,[\s\S]*?\.clientCorePageWorkout\.individualWorkoutSelectPage::after\s*\{[\s\S]*?height:\s*calc\(112px \+ env\(safe-area-inset-bottom\)\) !important;[\s\S]*?background:\s*linear-gradient\(180deg,\s*rgba\(246,\s*247,\s*252,\s*0\) 0%,\s*#f6f7fc 22%,\s*#f6f7fc 100%\) !important;/
  );

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\),\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.individualWorkoutSelectPage,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.basicWorkoutSelectPage\s*\{\s*--client-page-x:\s*22px;\s*--client-page-title-top:\s*54px;\s*--client-page-title-height:\s*52px;\s*--client-page-title-size:\s*30px;\s*--client-page-title-color:\s*#5f5744;/g) || []).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.profileDashboardPage\.clientCorePageMain,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\),\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.individualWorkoutSelectPage,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.basicWorkoutSelectPage,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatFoodSearchScreenPremium,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodEditPageOverlay \.foodEditPageSheet\s*\{\s*--client-top:\s*70px;\s*\}/
  );
  assert.match(
    source,
    /\.profileDashboardPage\.clientCorePageMain,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTabbedPage\.clientCorePageCabinet:not\(\.trainerRolePage\),\s*html:root\[data-app-theme="warm-light"\] body #root \.fatSecretPage\.nutritionFixedHeaderV3\.clientCorePageNutrition,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.individualWorkoutSelectPage,\s*html:root\[data-app-theme="warm-light"\] body #root \.clientCorePageWorkout\.basicWorkoutSelectPage,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatFoodSearchScreenPremium,\s*html:root\[data-app-theme="warm-light"\] body #root \.foodEditPageOverlay \.foodEditPageSheet\s*\{\s*--client-x:\s*26px;\s*--client-top:\s*70px;/
  );
});

test("client workout set-row final sizing stays in the workout lazy owner", async () => {
  const renderTarget = await readText("src/styles/client-render-target-lock.css");
  const setRows = await readText("src/styles/client-workout-set-rows.css");

  assert.doesNotMatch(renderTarget, /v127: absolute final override for workout set rows/);
  assert.doesNotMatch(renderTarget, /v126: final set-row size\/state polish/);
  assert.doesNotMatch(renderTarget, /Final lock for workout run set cards/);
  assert.doesNotMatch(renderTarget, /setRow\.workoutExercisePlanRow\s*\{[\s\S]*?min-height:\s*86px !important;/);
  assert.doesNotMatch(renderTarget, /grid-template-columns:\s*34px minmax\(0, 1fr\) 120px !important;/);
  assert.equal(
    (renderTarget.match(/setRow\.workoutExercisePlanRow\s*\{\s*min-height: 58px !important;/g) || []).length,
    0
  );
  assert.equal(
    (setRows.match(/setRow\.workoutExercisePlanRow\s*\{\s*min-height: 58px !important;/g) || []).length,
    1
  );
});

test("client render target CSS keeps profile hero locks in one owner", async () => {
  const source = await readText("src/styles/client-render-target-lock.css");

  assert.equal(
    (source.match(/\.profileDashboardPage\.clientCorePageMain \.profileAiHero\s*\{\s*border-bottom-left-radius:\s*0 !important;\s*border-bottom-right-radius:\s*0 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.profileAiAvatarWrap,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileAiAvatar\s*\{\s*width:\s*62px !important;\s*height:\s*62px !important;\s*min-width:\s*62px !important;\s*min-height:\s*62px !important;\s*\}/g) || []).length,
    1
  );
});

test("client render target CSS keeps workout pro top sizing in the final owner", async () => {
  const source = await readText("src/styles/client-render-target-lock.css");

  assert.doesNotMatch(
    source,
    /\.clientCorePageWorkout\.workoutSelectPage\.individualWorkoutSelectPage \.individualWorkoutProTop\s*\{\s*height:\s*38px !important;\s*gap:\s*8px !important;\s*\}/
  );
  assert.equal(
    (source.match(/\.clientCorePageWorkout\.workoutSelectPage\.individualWorkoutSelectPage \.individualWorkoutProTop\s*\{\s*width:\s*100% !important;\s*height:\s*38px !important;\s*display:\s*grid !important;\s*grid-template-columns:\s*minmax\(0, 0\.48fr\) minmax\(0, 1fr\) !important;\s*gap:\s*8px !important;/g) || []).length,
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

test("client workout close CSS has no overwritten border reset", async () => {
  const source = await readText("src/styles/legacy-workout-navigation-close-early.css");

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
  const source = await readText("src/styles/legacy-workout-navigation-close-early.css");

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
  const source = await readText("src/styles/legacy-workout-navigation-close-early.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.exerciseNavigationRow \.exerciseBackButton::before,\s*\.workoutRunPage \.exerciseNavigationRow \.exercisePrevButton::before,\s*\.workoutRunPage \.workoutCloseButton::before\s*\{\s*content:\s*none !important;\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal((source.match(/content:\s*none !important;/g) || []).length, 1);
});

test("client workout close CSS keeps compact nav active state grouped", async () => {
  const source = await readText("src/styles/legacy-workout-navigation-close-early.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.exerciseNavigationRow \.exerciseBackButton:active,\s*\.workoutRunPage \.exerciseNavigationRow \.exercisePrevButton:active\s*\{\s*transform:\s*scale\(0\.985\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal((source.match(/transform:\s*scale\(0\.985\) !important;/g) || []).length, 1);
});

test("client workout close CSS keeps exercise close active state in the base owner", async () => {
  const source = await readText("src/styles/legacy-workout-navigation-close-early.css");

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
  const source = await readText("src/styles/legacy-workout-navigation-close-early.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.exerciseCloseButton\s*\{[\s\S]*?position:\s*absolute !important;[\s\S]*?top:\s*16px !important;[\s\S]*?right:\s*16px !important;[\s\S]*?left:\s*auto !important;[\s\S]*?z-index:\s*80 !important;[\s\S]*?\}/g) || []).length,
    1
  );
  assert.equal((source.match(/\.workoutRunPage \.exerciseCloseButton\s*\{/g) || []).length, 1);
});

test("client workout close CSS keeps slide relative positioning grouped", async () => {
  const source = await readText("src/styles/legacy-workout-navigation-close-early.css");

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
  const source = await readText("src/styles/legacy-client-workout-flow-late.css");
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

test("client workout flow CSS keeps fallback image styles grouped", async () => {
  const source = await readText("src/styles/legacy-client-workout-flow-late.css");

  assert.equal(
    (source.match(/\.individualWorkoutSelectPage \.individualWorkoutImageFallback,\s*\.workoutRunPage \.startWorkoutImageFallback\s*\{\s*width:\s*100%;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.individualWorkoutSelectPage \.individualWorkoutImageFallback b,\s*\.workoutRunPage \.startWorkoutImageFallback b\s*\{\s*color:\s*rgba\(224,\s*242,\s*182,\s*0\.9\);/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.individualWorkoutSelectPage \.individualWorkoutImageFallback small,\s*\.workoutRunPage \.startWorkoutImageFallback small\s*\{\s*display:\s*-webkit-box;/g) || []).length,
    1
  );
});

test("client workout flow CSS keeps select and warmup action controls grouped", async () => {
  const source = await readText("src/styles/legacy-client-workout-flow-late.css");

  assert.equal(
    (source.match(/\.individualWorkoutActionRow,\s*\.workoutRunPage \.warmupNavigationRow\s*\{\s*width:\s*100%;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.individualWorkoutSelectPage > \.individualWorkoutBottomPanel \.individualWorkoutBackButton,\s*\.individualWorkoutSelectPage > \.individualWorkoutBottomPanel \.individualWorkoutStartButton,\s*\.workoutRunPage \.warmupBottomPanel \.warmupPreviousButton,\s*\.workoutRunPage \.warmupBottomPanel \.warmupReadyButton\s*\{[\s\S]*?height:\s*78px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.individualWorkoutSelectPage > \.individualWorkoutBottomPanel \.individualWorkoutBackButton,\s*\.workoutRunPage \.warmupBottomPanel \.warmupPreviousButton\s*\{\s*padding:\s*0 8px !important;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.individualWorkoutSelectPage > \.individualWorkoutBottomPanel \.individualWorkoutStartButton,\s*\.workoutRunPage \.warmupBottomPanel \.warmupReadyButton\s*\{\s*padding:\s*0 14px !important;/g) || []).length,
    1
  );
});

test("client workout flow CSS keeps start button sizing grouped", async () => {
  const source = await readText("src/styles/legacy-client-workout-flow-late.css");

  assert.equal(
    (source.match(/\.individualWorkoutSelectPage > \.individualWorkoutBottomPanel \.individualWorkoutStartButton,\s*\.workoutRunPage \.startWorkoutBottomPanel \.startWorkoutButton\s*\{\s*width:\s*100% !important;\s*height:\s*78px !important;\s*min-height:\s*78px !important;\s*max-height:\s*78px !important;\s*margin:\s*0 !important;\s*padding:\s*0 18px !important;\s*border-radius:\s*24px !important;\s*font-size:\s*19px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal((source.match(/padding:\s*0 18px !important;/g) || []).length, 3);
});

test("client workout flow CSS keeps compact start panel sizing grouped", async () => {
  const source = await readText("src/styles/legacy-client-workout-flow-late.css");

  assert.equal(
    (source.match(/\.workoutRunPage \.workoutStageActionPanel,\s*\.workoutRunPage \.startWorkoutBottomPanel\s*\{\s*left:\s*10px !important;\s*right:\s*10px !important;\s*width:\s*calc\(100vw - 20px\) !important;\s*padding-inline:\s*9px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal((source.match(/padding-inline:\s*9px !important;/g) || []).length, 1);
});

test("client workout hero spacing stays in the workout lazy owner", async () => {
  const renderTarget = await readText("src/styles/client-render-target-lock.css");
  const cardRender = await readText("src/styles/client-workout-card-render.css");

  assert.doesNotMatch(
    renderTarget,
    /\.workoutSelectPage\.individualWorkoutSelectPage \.workoutSelectHero\s*\{\s*margin-bottom:\s*10px !important;\s*\}/
  );
  assert.equal(
    (cardRender.match(/\.workoutSelectPage\.individualWorkoutSelectPage \.workoutSelectHero\s*\{\s*margin-bottom:\s*10px !important;\s*\}/g) || []).length,
    1
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

test("client food search final CSS keeps header close shell grouped", async () => {
  const source = await readText("src/styles/client-food-search-final.css");

  assert.equal(
    (
      source.match(
        /\.fatSearchTopPremiumHome \.fatSearchClosePremium,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatFoodSearchScreen\.fatFoodSearchScreenPremium > \.fatSearchTopPremium\.foodSearchHeaderExactMainAlign > button\.fatSearchClosePremium\.fatSearchClosePremium\s*\{\s*grid-area:\s*close !important;[\s\S]*?box-shadow:\s*0 16px 36px rgba\(36,\s*43,\s*66,\s*0\.08\),\s*inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*0\.95\) !important;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /grid-area:\s*close !important;\s*position:\s*static !important;\s*inset:\s*auto !important;\s*width:\s*48px !important;[\s\S]*?box-shadow:\s*0 16px 36px rgba\(36,\s*43,\s*66,\s*0\.08\),\s*inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*0\.95\) !important;/g
      ) || []
    ).length,
    1
  );
});

test("client food search final CSS keeps header title shell grouped", async () => {
  const source = await readText("src/styles/client-food-search-final.css");

  assert.equal(
    (
      source.match(
        /\.fatSearchTopPremiumHome \.foodFlowTitleGroup\.foodFlowSearchTitle h2,\s*html:root\[data-app-theme="warm-light"\] body #root \.fatFoodSearchOverlay \.fatFoodSearchScreen\.fatFoodSearchScreenPremium > \.fatSearchTopPremium\.foodSearchHeaderExactMainAlign > \.foodFlowTitleGroup\.foodFlowSearchTitle > h2\s*\{\s*height:\s*48px !important;[\s\S]*?white-space:\s*nowrap !important;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /height:\s*48px !important;\s*min-height:\s*48px !important;\s*max-height:\s*48px !important;\s*margin:\s*0 !important;\s*padding:\s*0 !important;\s*display:\s*flex !important;\s*align-items:\s*center !important;\s*color:\s*var\(--render-title-color,\s*#5f5848\) !important;\s*-webkit-text-fill-color:\s*var\(--render-title-color,\s*#5f5848\) !important;\s*font-size:\s*28px !important;\s*font-weight:\s*900 !important;\s*line-height:\s*1\.06 !important;\s*letter-spacing:\s*0 !important;\s*white-space:\s*nowrap !important;\s*\}/g
      ) || []
    ).length,
    1
  );
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
  const amountBehaviorStart = source.indexOf("/* Food product/search alignment and amount behavior v156 */");
  const photoActionStart = source.indexOf("/* Food search AI photo action bar height v157 */", amountBehaviorStart);
  const exactLockStart = source.indexOf("/* Product page header exact lock v158 */");
  const stableFlowStart = source.indexOf("/* Product page stable flow v159 */");
  const hardLockStart = source.indexOf("/* Product page header/search alignment hard lock v160 */");
  const finalLockStart = source.indexOf("/* Product page header/search alignment final lock v161 */");
  const mealSelectorStart = source.indexOf("/* Food search meal selector width final lock v162 */");
  const productAddStart = source.indexOf("/* Food product add page v154 */");
  const headerSizingStart = source.indexOf("/* Food search header/action sizing v155 */", productAddStart);
  const amountBehaviorBlock = source.slice(amountBehaviorStart, photoActionStart);
  const exactLockBlock = source.slice(exactLockStart, stableFlowStart);
  const hardLockBlock = source.slice(hardLockStart, finalLockStart);
  const finalLockBlock = source.slice(finalLockStart, mealSelectorStart);
  const stableFlowBlock = source.slice(stableFlowStart, hardLockStart);
  const productAddBlock = source.slice(productAddStart, headerSizingStart);

  assert.ok(productAddStart >= 0);
  assert.ok(headerSizingStart > productAddStart);
  assert.ok(amountBehaviorStart >= 0);
  assert.ok(photoActionStart > amountBehaviorStart);
  assert.ok(exactLockStart > photoActionStart);
  assert.ok(stableFlowStart > exactLockStart);
  assert.ok(hardLockStart > stableFlowStart);
  assert.ok(finalLockStart > hardLockStart);
  assert.ok(mealSelectorStart > finalLockStart);
  assert.doesNotMatch(productAddBlock, /\.foodProductFlowHeader\s*\{[^{}]*?height:\s*114px !important;/);
  assert.doesNotMatch(productAddBlock, /\.foodProductTopActions\s*\{[^{}]*?z-index:\s*3 !important;/);
  assert.doesNotMatch(productAddBlock, /\.foodProductTopActions\s*\{[^{}]*?width:\s*auto !important;/);
  assert.doesNotMatch(productAddBlock, /\.foodProductFlowTitle h2\s*\{[^{}]*?font-size:\s*28px !important;/);
  assert.doesNotMatch(productAddBlock, /\.foodProductFlowTitle h2\s*\{[^{}]*?line-height:\s*1\.06 !important;/);
  assert.doesNotMatch(productAddBlock, /\.foodEditInlineMealHeader\s*\{[^{}]*?width:\s*min\(328px,/);
  assert.doesNotMatch(productAddBlock, /\.foodEditInlineMealHeader\s*\{[^{}]*?min-height:\s*56px !important;/);
  assert.doesNotMatch(amountBehaviorBlock, /\.foodProductRenderScreen \.foodProductFlowHeader\s*\{/);
  assert.doesNotMatch(amountBehaviorBlock, /\.foodProductRenderScreen \.foodProductFlowTitle\s*\{/);
  assert.doesNotMatch(amountBehaviorBlock, /\.foodProductRenderScreen \.foodProductTopActions\s*\{/);
  assert.doesNotMatch(exactLockBlock, /\.foodProductRenderScreen \.foodProductFlowHeader\s*\{/);
  assert.doesNotMatch(exactLockBlock, /\.foodProductRenderScreen \.foodProductFlowTitle\s*\{/);
  assert.doesNotMatch(exactLockBlock, /\.foodProductRenderScreen \.foodProductTopActions\s*\{/);
  assert.doesNotMatch(hardLockBlock, /\.fatFoodSearchScreenPremium:has\(\.foodProductRenderScreen\) \.foodProductFlowHeader\s*\{/);
  assert.doesNotMatch(hardLockBlock, /\.fatFoodSearchScreenPremium:has\(\.foodProductRenderScreen\) \.foodProductFlowTitle\s*\{/);
  assert.doesNotMatch(hardLockBlock, /\.fatFoodSearchScreenPremium:has\(\.foodProductRenderScreen\) \.foodProductTopActions\s*\{/);
  assert.doesNotMatch(hardLockBlock, /\.fatFoodSearchScreenPremium:has\(\.foodProductRenderScreen\) \.foodProductFlowTitle h2\s*\{/);
  assert.doesNotMatch(hardLockBlock, /\.fatFoodSearchScreenPremium:has\(\.foodProductRenderScreen\) \.foodProductFlowHeader \.foodEditInlineMealHeader\s*\{/);
  assert.doesNotMatch(hardLockBlock, /--food-product-x:\s*15px;/);
  assert.doesNotMatch(finalLockBlock, /--food-product-x:\s*15px;/);
  assert.doesNotMatch(finalLockBlock, /\.foodProductFlowHeader \.foodEditInlineMealHeader\s*\{[\s\S]*?width:\s*min\(284px,/);
  assert.doesNotMatch(finalLockBlock, /\.foodProductFlowHeader \.foodEditInlineMealHeader\s*\{[\s\S]*?margin:\s*0 auto !important;/);
  assert.doesNotMatch(finalLockBlock, /\.foodProductFlowHeader\s*\{[\s\S]*?margin:\s*0 0 16px !important;/);
  assert.doesNotMatch(finalLockBlock, /\.foodProductRenderScreen\s*\{\s*--food-product-x:\s*14px;/);
  assert.equal(
    (source.match(/\.foodProductRenderScreen \.foodProductFlowHeader \+ \.foodEditHeroRender\.foodEditHeroEditable\s*\{\s*margin-top:\s*0 !important;\s*\}/g) || []).length,
    1
  );
  assert.match(
    stableFlowBlock,
    /\.foodProductFlowHeader \+ \.foodEditHeroRender\.foodEditHeroEditable\s*\{\s*margin-top:\s*0 !important;\s*\}/
  );
  assert.equal((finalLockBlock.match(/--food-product-x:\s*14px;/g) || []).length, 0);
  assert.match(
    source,
    /\/\* Food product page compact alignment and inline edit feel v164 \*\/[\s\S]*?\.foodProductRenderScreen\s*\{\s*--food-product-x:\s*15px;/
  );
});

test("client food search final CSS keeps photo action sizing in latest owner", async () => {
  const source = await readText("src/styles/client-food-search-final.css");
  const renderControlsStart = source.indexOf("/* Food search render controls v153 */");
  const productAddStart = source.indexOf("/* Food product add page v154 */", renderControlsStart);
  const headerSizingStart = source.indexOf("/* Food search header/action sizing v155 */");
  const amountBehaviorStart = source.indexOf("/* Food product/search alignment and amount behavior v156 */", headerSizingStart);
  const photoActionStart = source.indexOf("/* Food search AI photo action bar height v157 */", amountBehaviorStart);
  const exactLockStart = source.indexOf("/* Product page header exact lock v158 */", photoActionStart);
  const renderControlsBlock = source.slice(renderControlsStart, productAddStart);
  const headerSizingBlock = source.slice(headerSizingStart, amountBehaviorStart);
  const photoActionBlock = source.slice(photoActionStart, exactLockStart);

  assert.ok(renderControlsStart >= 0);
  assert.ok(productAddStart > renderControlsStart);
  assert.ok(headerSizingStart >= 0);
  assert.ok(amountBehaviorStart > headerSizingStart);
  assert.ok(photoActionStart > amountBehaviorStart);
  assert.ok(exactLockStart > photoActionStart);
  assert.doesNotMatch(renderControlsBlock, /height:\s*58px !important;/);
  assert.doesNotMatch(renderControlsBlock, /grid-template-columns:\s*40px minmax\(0,\s*1fr\) 18px !important;/);
  assert.doesNotMatch(renderControlsBlock, /bottom:\s*calc\(93px \+ env\(safe-area-inset-bottom,\s*0px\)\) !important;/);
  assert.doesNotMatch(renderControlsBlock, /\.foodSearchModernActionIcon\s*\{[\s\S]*?width:\s*34px !important;/);
  assert.doesNotMatch(renderControlsBlock, /\.foodSearchModernActionIcon\s*\{[\s\S]*?border-radius:\s*11px !important;/);
  assert.doesNotMatch(renderControlsBlock, /\.foodSearchFixedPhotoAction strong\s*\{[\s\S]*?font-size:\s*12px !important;/);
  assert.doesNotMatch(renderControlsBlock, /\.foodSearchFixedPhotoAction small\s*\{[\s\S]*?font-size:\s*10px !important;/);
  assert.doesNotMatch(headerSizingBlock, /height:\s*68px !important;/);
  assert.doesNotMatch(headerSizingBlock, /grid-template-columns:\s*42px minmax\(0,\s*1fr\) 20px !important;/);
  assert.doesNotMatch(headerSizingBlock, /\.foodSearchModernActionIcon\s*\{\s*\}/);
  assert.doesNotMatch(headerSizingBlock, /\.foodSearchFixedPhotoAction strong\s*\{\s*\}/);
  assert.doesNotMatch(headerSizingBlock, /\.foodSearchFixedPhotoAction small\s*\{\s*\}/);
  assert.doesNotMatch(headerSizingBlock, /\.fatSearchTitleWrap\s*\{[^{}]*?width:\s*100% !important;/);
  assert.doesNotMatch(headerSizingBlock, /\.fatSearchTitleWrap\s*\{[^{}]*?max-width:\s*none !important;/);
  assert.doesNotMatch(headerSizingBlock, /\.foodSearchModernActionIcon\s*\{[\s\S]*?width:\s*38px !important;/);
  assert.doesNotMatch(headerSizingBlock, /\.foodSearchFixedPhotoAction strong\s*\{[\s\S]*?font-size:\s*13px !important;/);
  assert.doesNotMatch(headerSizingBlock, /\.foodSearchFixedPhotoAction small\s*\{[\s\S]*?font-size:\s*10\.5px !important;/);
  assert.match(
    photoActionBlock,
    /\.foodSearchFixedPhotoAction\s*\{[\s\S]*?height:\s*84px !important;[\s\S]*?grid-template-columns:\s*52px minmax\(0,\s*1fr\) 22px !important;/
  );
  assert.match(
    photoActionBlock,
    /\.foodSearchModernActionIcon\s*\{[\s\S]*?width:\s*46px !important;[\s\S]*?min-height:\s*46px !important;/
  );
  assert.match(source, /\/\* Food product\/search alignment and amount behavior v156 \*\/[\s\S]*?\.fatSearchTitleWrap\s*\{[^{}]*?width:\s*min\(376px,\s*calc\(100vw - 24px\)\) !important;[^{}]*?max-width:\s*min\(376px,\s*calc\(100vw - 24px\)\) !important;/);
  assert.match(photoActionBlock, /\.foodSearchFixedPhotoAction strong\s*\{[\s\S]*?font-size:\s*14px !important;/);
  assert.match(photoActionBlock, /\.foodSearchFixedPhotoAction small\s*\{[\s\S]*?font-size:\s*11px !important;/);
});

test("client food search final CSS keeps title button sizing in latest owner", async () => {
  const source = await readText("src/styles/client-food-search-final.css");
  const renderControlsStart = source.indexOf("/* Food search render controls v153 */");
  const productAddStart = source.indexOf("/* Food product add page v154 */", renderControlsStart);
  const headerSizingStart = source.indexOf("/* Food search header/action sizing v155 */", productAddStart);
  const amountBehaviorStart = source.indexOf("/* Food product/search alignment and amount behavior v156 */", headerSizingStart);
  const renderControlsBlock = source.slice(renderControlsStart, productAddStart);
  const headerSizingBlock = source.slice(headerSizingStart, amountBehaviorStart);

  assert.ok(renderControlsStart >= 0);
  assert.ok(productAddStart > renderControlsStart);
  assert.ok(headerSizingStart > productAddStart);
  assert.ok(amountBehaviorStart > headerSizingStart);
  assert.doesNotMatch(renderControlsBlock, /height:\s*46px !important;/);
  assert.doesNotMatch(renderControlsBlock, /border-radius:\s*10px !important;/);
  assert.doesNotMatch(renderControlsBlock, /\.fatSearchTitleButtonPremium span\s*\{[\s\S]*?font-size:\s*8px !important;/);
  assert.doesNotMatch(renderControlsBlock, /\.fatSearchTitleButtonPremium strong\s*\{[\s\S]*?font-size:\s*15px !important;/);
  assert.match(
    headerSizingBlock,
    /\.fatSearchTitleButtonPremium\s*\{[\s\S]*?height:\s*54px !important;[\s\S]*?border-radius:\s*15px !important;/
  );
  assert.match(headerSizingBlock, /\.fatSearchTitleButtonPremium span\s*\{[\s\S]*?font-size:\s*9px !important;/);
  assert.match(headerSizingBlock, /\.fatSearchTitleButtonPremium strong\s*\{[\s\S]*?font-size:\s*16px !important;/);
});

test("client food search final CSS keeps fixed action bottom mask in latest owner", async () => {
  const source = await readText("src/styles/client-food-search-final.css");
  const oldMaskStart = source.indexOf("/* v169: search results must disappear under the fixed AI photo action instead of showing through it. */");
  const diaryRowsStart = source.indexOf("/* v170: diary product rows should look like clean product cards; red swipe layer appears only during delete. */", oldMaskStart);
  const finalMaskStart = source.indexOf("/* v171: polish nutrition fixed docks, inner scrollbars and safe bottom masking. */", diaryRowsStart);
  const oldMaskBlock = source.slice(oldMaskStart, diaryRowsStart);
  const finalMaskBlock = source.slice(finalMaskStart);

  assert.ok(oldMaskStart >= 0);
  assert.ok(diaryRowsStart > oldMaskStart);
  assert.ok(finalMaskStart > diaryRowsStart);
  assert.doesNotMatch(oldMaskBlock, /padding-bottom:\s*calc\(210px \+ env\(safe-area-inset-bottom,\s*0px\)\) !important;/);
  assert.doesNotMatch(oldMaskBlock, /z-index:\s*38 !important;/);
  assert.doesNotMatch(oldMaskBlock, /left:\s*-14px !important;/);
  assert.doesNotMatch(oldMaskBlock, /bottom:\s*calc\(-118px - env\(safe-area-inset-bottom,\s*0px\)\) !important;/);
  assert.match(finalMaskBlock, /padding-bottom:\s*calc\(198px \+ env\(safe-area-inset-bottom,\s*0px\)\) !important;/);
  assert.match(finalMaskBlock, /\.foodSearchFixedPhotoAction\s*\{[\s\S]*?z-index:\s*42 !important;[\s\S]*?isolation:\s*isolate !important;/);
  assert.match(finalMaskBlock, /\.foodSearchFixedPhotoAction::before\s*\{[\s\S]*?left:\s*50% !important;[\s\S]*?bottom:\s*calc\(-128px - env\(safe-area-inset-bottom,\s*0px\)\) !important;/);
});

test("client food search final CSS keeps diary swipe shell sizing in latest owner", async () => {
  const source = await readText("src/styles/client-food-search-final.css");
  const renderControlsStart = source.indexOf("/* Food search render controls v153 */");
  const diaryRowsStart = source.indexOf("/* v170: diary product rows should look like clean product cards; red swipe layer appears only during delete. */");
  const finalDocksStart = source.indexOf("/* v171: polish nutrition fixed docks, inner scrollbars and safe bottom masking. */", diaryRowsStart);
  const earlyBlock = source.slice(0, renderControlsStart);
  const diaryRowsBlock = source.slice(diaryRowsStart, finalDocksStart);

  assert.ok(renderControlsStart >= 0);
  assert.ok(diaryRowsStart > renderControlsStart);
  assert.ok(finalDocksStart > diaryRowsStart);
  assert.doesNotMatch(earlyBlock, /\.nutritionZoukSwipeShell\s*\{[^{}]*?min-height:\s*58px !important;/);
  assert.doesNotMatch(earlyBlock, /\.nutritionZoukSwipeShell\s*\{[^{}]*?border-radius:\s*17px !important;/);
  assert.doesNotMatch(earlyBlock, /\.nutritionZoukSwipeShell \+ \.nutritionZoukSwipeShell\s*\{[^{}]*?border-top:\s*0 !important;/);
  assert.doesNotMatch(earlyBlock, /\.nutritionZoukSwipeShell \.productDeleteBg\s*\{[^{}]*?border-radius:\s*17px !important;/);
  assert.match(diaryRowsBlock, /\.nutritionZoukSwipeShell\s*\{[^{}]*?min-height:\s*64px !important;[^{}]*?border-radius:\s*18px !important;/);
  assert.match(diaryRowsBlock, /\.nutritionZoukSwipeShell \+ \.nutritionZoukSwipeShell\s*\{[^{}]*?border-top:\s*1px solid rgba\(224,\s*229,\s*243,\s*0\.92\) !important;/);
  assert.match(diaryRowsBlock, /\.nutritionZoukSwipeShell \.productDeleteBg\s*\{[^{}]*?border-radius:\s*18px !important;/);
});

test("nutrition orbit CSS keeps inline and modal meal shells grouped", async () => {
  const source = await readText("src/styles/legacy-nutrition-orbit.css");

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
  const source = await readText("src/styles/nutrition.css");
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

test("legacy nutrition header CSS does not keep exact duplicate blocks", async () => {
  const source = await readText("src/styles/legacy-nutrition-header-layout.css");
  const seenBlocks = new Set();
  const duplicateBlocks = [];

  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2].trim().replace(/\s+/g, " ");
    if (!body || selector.includes("@")) continue;
    const key = `${selector} { ${body} }`;

    if (seenBlocks.has(key)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      duplicateBlocks.push(`src/styles/legacy-nutrition-header-layout.css:${line}`);
    }
    seenBlocks.add(key);
  }

  assert.deepEqual(duplicateBlocks, []);
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
  assert.equal(
    (source.match(/\.fatFoodSearchScreenPremium:has\(\.fatSearchBottomBarFive\)\s*\{\s*padding-bottom:/g) || []).length,
    1
  );
  assert.doesNotMatch(source, /padding-bottom:\s*138px !important;/);
});

test("warm light food edit CSS keeps gold action shell grouped", async () => {
  const source = await readText("src/styles/legacy-warm-light-food-edit-back-buttons.css");

  assert.equal(
    (
      source.match(
        /\.fatFoodSearchScreenPremium \.fatSearchBottomBar button,\s*:root\[data-app-theme="warm-light"\] \.foodEditPageSave,\s*:root\[data-app-theme="warm-light"\] \.foodEditPageBack\s*\{\s*background:\s*linear-gradient\(180deg,\s*#f4e064 0%,\s*#e0c94d 100%\) !important;[\s\S]*?box-shadow:\s*0 12px 28px rgba\(151,119,35,0\.16\),\s*inset 0 1px 0 rgba\(255,255,255,0\.38\) !important;[\s\S]*?-webkit-text-fill-color:\s*#5f5744 !important;\s*\}/g
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
  const source = await readText("src/styles/legacy-warm-light-food-edit-back-buttons.css");

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

test("warm light food edit CSS keeps edit label shells grouped", async () => {
  const source = await readText("src/styles/legacy-warm-light-food-edit-back-buttons.css");

  assert.equal(
    (
      source.match(
        /\.foodEditPageContent label,\s*:root\[data-app-theme="warm-light"\] \.foodEditPageGrid label\s*\{\s*background:\s*linear-gradient\(180deg, rgba\(255, 249, 215, 0\.96\) 0%, rgba\(246, 232, 174, 0\.86\) 100%\) !important;\s*border:\s*1px solid rgba\(94, 75, 30, 0\.10\) !important;\s*box-shadow:\s*0 10px 24px rgba\(88, 68, 24, 0\.08\) !important;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.doesNotMatch(
    source,
    /\.foodEditPageContent label\s*\{[\s\S]*?\.foodEditPageGrid label\s*\{\s*background:/
  );
});

test("warm light food edit CSS keeps form control shells grouped", async () => {
  const source = await readText("src/styles/legacy-warm-light-food-edit-back-buttons.css");

  assert.equal(
    (
      source.match(
        /\.foodEditSegmentRow button,\s*:root\[data-app-theme="warm-light"\] \.foodEditMacrosCards > div,\s*:root\[data-app-theme="warm-light"\] \.foodEditCaloriesMacroCard\s*\{\s*background:\s*linear-gradient\(180deg, rgba\(255,249,215,0\.96\) 0%, rgba\(246,232,174,0\.82\) 100%\) !important;\s*border:\s*1px solid rgba\(94,75,30,0\.10\) !important;\s*box-shadow:\s*0 10px 24px rgba\(88,68,24,0\.10\) !important;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (source.match(/linear-gradient\(180deg, rgba\(255,249,215,0\.96\) 0%, rgba\(246,232,174,0\.82\) 100%\) !important;\s*border:\s*1px solid rgba\(94,75,30,0\.10\) !important;\s*box-shadow:\s*0 10px 24px rgba\(88,68,24,0\.10\) !important;/g) || []).length,
    1
  );
});

test("warm light add food CSS keeps profile action shells grouped", async () => {
  const source = await readText("src/styles/legacy-warm-light-add-food-search-cleanup.css");

  assert.equal(
    (
      source.match(
        /:root\[data-app-theme="warm-light"\] \.menuRefreshIconBtn,\s*:root\[data-app-theme="warm-light"\] \.profileThemeSwitchBtn\s*\{\s*background:\s*linear-gradient\(180deg, rgba\(255, 249, 215, 0\.96\) 0%, rgba\(246, 232, 174, 0\.82\) 100%\) !important;\s*color:\s*#5f5744 !important;\s*border-color:\s*rgba\(94,75,30,0\.12\) !important;\s*box-shadow:\s*0 12px 28px rgba\(88,68,24,0\.12\) !important;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (source.match(/box-shadow:\s*0 12px 28px rgba\(88,68,24,0\.12\) !important;/g) || []).length,
    1
  );
});

test("nutrition food search actions CSS keeps action active colors grouped", async () => {
  const source = await readText("src/styles/nutrition-food-search-actions.css");

  assert.equal(
    (source.match(/\.fatSearchBottomBarFive > button:not\(\.fatSearchPhotoAction\):active,\s*\.foodProductActionBar button:active:not\(:disabled\)\s*\{\s*background:\s*rgba\(143,\s*188,\s*54,\s*0\.055\) !important;\s*color:\s*#aee94d !important;\s*-webkit-text-fill-color:\s*#aee94d !important;\s*\}/g) || []).length,
    1
  );
  assert.equal((source.match(/background:\s*rgba\(143,\s*188,\s*54,\s*0\.055\) !important;/g) || []).length, 1);
});

test("nutrition AI plan CSS keeps narrow score sizing in the final owner", async () => {
  const source = await readText("src/styles/nutrition-ai-plan-lazy.css");
  const compactStart = source.indexOf("compact premium tuning 2026-05-20");
  const finalNarrowStart = source.indexOf("@media (max-width: 390px)", compactStart);
  const twoStateStart = source.indexOf("two-state collapsed/expanded behavior", finalNarrowStart);
  const finalNarrowBlock = source.slice(finalNarrowStart, twoStateStart);

  assert.ok(compactStart >= 0);
  assert.ok(finalNarrowStart > compactStart);
  assert.ok(twoStateStart > finalNarrowStart);
  assert.doesNotMatch(source.slice(0, compactStart), /\.nutritionAiPlanScore\s*\{\s*width:\s*110px;\s*height:\s*110px;\s*\}/);
  assert.doesNotMatch(source.slice(0, compactStart), /\.nutritionAiPlanGrid\s*\{\s*gap:\s*3px;\s*\}/);
  assert.doesNotMatch(source.slice(0, compactStart), /\.nutritionAiPlanGrid span\s*\{\s*aspect-ratio:\s*1 \/ 1;/);
  assert.doesNotMatch(source.slice(0, compactStart), /\.nutritionAiPlanGrid span\.active\s*\{\s*background:\s*linear-gradient/);
  assert.doesNotMatch(source.slice(0, compactStart), /\.nutritionAiPlanScore\s*\{[\s\S]*?width:\s*118px;/);
  assert.doesNotMatch(source.slice(0, compactStart), /\.nutritionAiPlanScore::after\s*\{[\s\S]*?inset:\s*8px;/);
  assert.doesNotMatch(source.slice(0, compactStart), /\.nutritionAiPlanMacros div\s*\{[\s\S]*?min-height:\s*66px;/);
  assert.doesNotMatch(source.slice(0, compactStart), /\.nutritionAiPlanRskInfo\s*\{[^}]*?gap:\s*8px;/);
  assert.doesNotMatch(source.slice(0, compactStart), /\.nutritionAiPlanRskInfo strong\s*\{[^}]*?font-size:\s*18px;/);
  assert.doesNotMatch(source.slice(0, compactStart), /\.nutritionAiPlanRskFoot\s*\{[^}]*?padding-top:\s*8px;/);
  assert.doesNotMatch(source.slice(0, compactStart), /\.nutritionAiPlanScoreBlock\s*\{[^}]*?gap:\s*7px;/);
  assert.match(
    finalNarrowBlock,
    /\.nutritionAiPlanScore\s*\{\s*width:\s*118px !important;\s*height:\s*118px !important;\s*\}/
  );
  assert.match(
    source,
    /compact premium tuning 2026-05-20[\s\S]*?\.nutritionAiPlanGrid span\s*\{[\s\S]*?width:\s*9px !important;[\s\S]*?aspect-ratio:\s*auto !important;[\s\S]*?\.nutritionAiPlanGrid span\.active\s*\{[\s\S]*?box-shadow:\s*0 0 10px rgba\(127,\s*159,\s*58,\s*0\.18\) !important;[\s\S]*?\.nutritionAiPlanRskInfo\s*\{[\s\S]*?gap:\s*8px !important;[\s\S]*?\.nutritionAiPlanRskInfo strong\s*\{[\s\S]*?font-size:\s*19px !important;[\s\S]*?\.nutritionAiPlanRskFoot\s*\{[\s\S]*?padding-top:\s*7px !important;[\s\S]*?\.nutritionAiPlanScoreBlock\s*\{[\s\S]*?gap:\s*8px !important;[\s\S]*?\.nutritionAiPlanScoreBlock > span\s*\{[\s\S]*?color:\s*rgba\(245,\s*247,\s*251,\s*0\.48\) !important;[\s\S]*?\.nutritionAiPlanScore\s*\{[\s\S]*?width:\s*124px !important;[\s\S]*?\.nutritionAiPlanMacros div\s*\{[\s\S]*?min-height:\s*56px !important;/
  );
});

test("nutrition AI plan CSS keeps badge and conclusion colors in the final owner", async () => {
  const source = await readText("src/styles/nutrition-ai-plan-lazy.css");
  const colorStart = source.indexOf("AI PLAN COLORS MATCH MEAL CARDS");
  const app43Start = source.indexOf("APP43 TARGETED UPDATE", colorStart);
  const earlyBlock = source.slice(0, colorStart);
  const colorBlock = source.slice(colorStart, app43Start);

  assert.ok(colorStart >= 0);
  assert.ok(app43Start > colorStart);
  assert.doesNotMatch(earlyBlock, /\.nutritionAiPlanConclusion\s*\{[^}]*?background:\s*rgba\(127,\s*159,\s*58,\s*0\.075\);/);
  assert.doesNotMatch(earlyBlock, /\.nutritionAiPlanBadges span\.good\s*\{[^}]*?background:\s*rgba\(127,\s*159,\s*58,\s*0\.1\);/);
  assert.doesNotMatch(earlyBlock, /\.nutritionAiPlanBadges span\.warning,[\s\S]*?\.nutritionAiPlanBadges span\.warn\s*\{[^}]*?background:\s*rgba\(255,\s*191,\s*115,\s*0\.09\);/);
  assert.doesNotMatch(earlyBlock, /\.nutritionAiPlanMacroPercent span,[\s\S]*?\.nutritionAiPlanBadges span\s*\{[^}]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.045\);/);
  assert.doesNotMatch(earlyBlock, /\.nutritionAiPlanCollapsedTop > div\s*\{[^}]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.035\);/);
  assert.doesNotMatch(earlyBlock, /\.nutritionAiPlanCollapsedTop > div\.score\s*\{[^}]*?background:\s*rgba\(127,\s*159,\s*58,\s*0\.08\);/);
  assert.doesNotMatch(earlyBlock, /\.nutritionAiPlanCollapsedMacros span\s*\{[^}]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.04\);/);
  assert.doesNotMatch(earlyBlock, /\.nutritionAiPlanToggleBtn\s*\{[^}]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.035\);/);
  assert.doesNotMatch(earlyBlock, /\.nutritionAiPlanToggleBtn\s*\{[^}]*?color:\s*rgba\(255,\s*255,\s*255,\s*0\.56\);/);
  assert.doesNotMatch(earlyBlock, /\.nutritionAiPlanCollapsedCard\s*\{[^}]*?background:\s*rgba\(3,\s*10,\s*16,\s*0\.24\);/);
  assert.match(
    colorBlock,
    /\.nutritionAiPlanConclusion\s*\{[\s\S]*?background:\s*[\s\S]*?linear-gradient\(180deg,\s*rgba\(9,\s*20,\s*26,\s*0\.72\),\s*rgba\(5,\s*14,\s*18,\s*0\.78\)\) !important;[\s\S]*?border-color:\s*rgba\(255,\s*255,\s*255,\s*0\.06\) !important;/
  );
  assert.match(
    colorBlock,
    /\.nutritionAiPlanBadges span\s*\{[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.04\) !important;[\s\S]*?border-color:\s*rgba\(255,\s*255,\s*255,\s*0\.055\) !important;/
  );
  assert.match(
    colorBlock,
    /\.nutritionAiPlanCollapsedTop > div,[\s\S]*?\.nutritionAiPlanCollapsedMacros span,[\s\S]*?\.nutritionAiPlanMacroPercent span,[\s\S]*?\.nutritionAiPlanBadges span\s*\{[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.04\) !important;[\s\S]*?border-color:\s*rgba\(255,\s*255,\s*255,\s*0\.055\) !important;/
  );
  assert.match(
    colorBlock,
    /\.nutritionAiPlanCollapsedTop > div\.score\s*\{[\s\S]*?background:\s*rgba\(127,\s*159,\s*58,\s*0\.10\) !important;[\s\S]*?border-color:\s*rgba\(127,\s*159,\s*58,\s*0\.18\) !important;/
  );
  assert.match(
    colorBlock,
    /\.nutritionAiPlanCollapsedCard,[\s\S]*?\.nutritionAiPlanConclusion\s*\{[\s\S]*?background:\s*[\s\S]*?linear-gradient\(180deg,\s*rgba\(9,\s*20,\s*26,\s*0\.72\),\s*rgba\(5,\s*14,\s*18,\s*0\.78\)\) !important;/
  );
  assert.match(
    colorBlock,
    /\.nutritionAiPlanToggleBtn\s*\{[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.045\) !important;[\s\S]*?color:\s*rgba\(255,\s*255,\s*255,\s*0\.58\) !important;/
  );
});

test("nutrition AI plan CSS keeps muted span typography grouped", async () => {
  const source = await readText("src/styles/nutrition-ai-plan-lazy.css");

  assert.equal(
    (
      source.match(
        /\.nutritionAiPlanRskInfo span,\s*\.nutritionAiPlanRskFoot span,\s*\.nutritionAiPlanMacros span,\s*\.nutritionAiPlanMacros small,\s*\.nutritionAiPlanMacroPercent span,\s*\.nutritionAiPlanCollapsedTop span,\s*\.nutritionAiPlanCollapsedMacros span\s*\{\s*color:\s*rgba\(255,\s*255,\s*255,\s*0\.42\);\s*font-size:\s*10px;\s*font-weight:\s*950;\s*white-space:\s*nowrap;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /color:\s*rgba\(255,\s*255,\s*255,\s*0\.42\);\s*font-size:\s*10px;\s*font-weight:\s*950;\s*white-space:\s*nowrap;/g
      ) || []
    ).length,
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
  assert.equal(
    (source.match(/\.fatFoodSearchScreenPremium:has\(\.foodEditRenderScreen\) > \.fatSearchTopPremium/g) || []).length,
    1
  );
  assert.match(
    source,
    /FINAL HARD BACK DEDUPLICATION[\s\S]*?\.fatFoodSearchScreenPremium:has\(\.foodEditRenderScreen\) > \.fatSearchTopPremium,[\s\S]*?display:\s*none !important;[\s\S]*?pointer-events:\s*none !important;/
  );
  assert.doesNotMatch(source, /\.fatSecretPage:has\(\.foodEditRenderScreen\)[\s\S]*?\.nutritionBackTopLeftV3/);
  assert.match(
    source,
    /\.fatSecretPage:has\(\.fatFoodSearchOverlay\) > \.nutritionBackTopLeftV3,[\s\S]*?\.fatSecretPage:has\(\.fatFoodSearchOverlay\) \.backBtn\.universalFixedBackPointer\s*\{[\s\S]*?display:\s*none !important;[\s\S]*?pointer-events:\s*none !important;/
  );
});

test("legacy food editor CSS keeps warm-light ingredient surfaces grouped", async () => {
  const source = await readText("src/styles/legacy-food-editor-workout-close-late.css");

  assert.equal(
    (source.match(/\.dishIngredientPickerSheet,\s*:root\[data-app-theme="warm-light"\] \.dishIngredientConfirmCard\s*\{\s*border-color:\s*rgba\(94,75,30,0\.12\) !important;\s*background:\s*radial-gradient\(circle at 50% 0%, rgba\(244,224,100,0\.38\), transparent 62%\),\s*linear-gradient\(180deg, rgba\(255,249,198,0\.98\), rgba\(247,232,151,0\.99\)\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/radial-gradient\(circle at 50% 0%, rgba\(244,224,100,0\.38\), transparent 62%\),\s*linear-gradient\(180deg, rgba\(255,249,198,0\.98\), rgba\(247,232,151,0\.99\)\) !important;/g) || []).length,
    1
  );
});

test("admin CRM CSS keeps client card grid breakpoints in the latest owner", async () => {
  const shellSource = await readText("src/styles/legacy-admin-shell-crm-app46.css");
  const programSource = await readText("src/styles/legacy-month-program-editor-early.css");

  assert.doesNotMatch(shellSource, /@media\s*\(max-width:\s*1280px\)\s*\{\s*\.adminClientCardsGridFive/);
  assert.doesNotMatch(shellSource, /@media\s*\(max-width:\s*1020px\)\s*\{\s*\.adminClientCardsGridFive/);
  assert.doesNotMatch(shellSource, /@media\s*\(max-width:\s*1380px\)[\s\S]*?\.adminClientCardsGridFive\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\) !important;/);
  assert.match(shellSource, /@media\s*\(max-width:\s*1120px\)[\s\S]*?\.adminClientCardsGridFive\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\) !important;/);
  assert.match(programSource, /@media\s*\(min-width:\s*980px\)\s*\{\s*\.adminClientCardsGridFive\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\) !important;/);
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

test("legacy nutrition late layout CSS keeps expanded product text grouped", async () => {
  const source = await readText("src/styles/legacy-nutrition-late-layout.css");

  assert.equal(
    (source.match(/\.productInfoExact strong,\s*\.fatSecretPage \.fatFoodItem strong,\s*\.fatFoodItem strong\s*\{\s*display:\s*block !important;\s*max-width:\s*100% !important;[\s\S]*?font-size:\s*17px !important;[\s\S]*?text-overflow:\s*ellipsis !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.productInfoExact span,\s*\.fatSecretPage \.fatFoodItem span,\s*\.fatFoodItem span\s*\{\s*display:\s*block !important;\s*margin-top:\s*6px !important;[\s\S]*?font-size:\s*17px !important;[\s\S]*?line-height:\s*1 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/display:\s*block !important;\s*max-width:\s*100% !important;\s*color:\s*rgba\(247,\s*248,\s*251,\s*0\.94\) !important;\s*font-size:\s*17px !important;\s*font-weight:\s*950 !important;\s*line-height:\s*1\.12 !important;\s*letter-spacing:\s*-0\.35px !important;\s*white-space:\s*nowrap !important;\s*overflow:\s*hidden !important;\s*text-overflow:\s*ellipsis !important;/g) || []).length,
    1
  );
});

test("admin client dashboard polish CSS has no empty media blocks", async () => {
  const source = await readText("src/styles/legacy-admin-client-dashboard-polish.css");

  assert.doesNotMatch(source, /@media\s+[^{]+\{\s*\}/);
});

test("admin client dashboard polish CSS keeps calendar layout in final owner", async () => {
  const source = await readText("src/styles/legacy-admin-client-dashboard-polish.css");

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
  const source = await readText("src/styles/legacy-admin-client-dashboard-polish.css");

  assert.equal(
    (source.match(/\.adminNutritionMonthSummary > div,\s*\.adminNutritionMonthSummaryBelow > div\s*\{\s*min-height:\s*74px !important;\s*padding:\s*14px !important;\s*border-radius:\s*20px !important;\s*background:\s*linear-gradient\(180deg, rgba\(20, 24, 20, \.98\), rgba\(12, 15, 12, \.98\)\) !important;\s*border:\s*1px solid rgba\(255,255,255,\.06\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.adminNutritionMonthSummary span,\s*\.adminNutritionMonthSummaryBelow span\s*\{\s*color:\s*rgba\(255,255,255,\.48\) !important;\s*font-size:\s*11px !important;\s*font-weight:\s*900 !important;\s*text-transform:\s*uppercase !important;\s*letter-spacing:\s*\.04em !important;\s*\}/g) || []).length,
    1
  );
});

test("legacy admin program editor CSS has no empty media blocks", async () => {
  const source = await readText("src/styles/legacy-admin-program-editor-app49.css");

  assert.doesNotMatch(source, /@media\s+[^{]+\{\s*\}/);
});

test("legacy admin client page CSS does not keep exact duplicate blocks", async () => {
  const source = await readText("src/styles/legacy-admin-client-page.css");
  const seenBlocks = new Set();
  const duplicateBlocks = [];

  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2].trim().replace(/\s+/g, " ");
    if (!body || selector.includes("@")) continue;
    const key = `${selector} { ${body} }`;

    if (seenBlocks.has(key)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      duplicateBlocks.push(`src/styles/legacy-admin-client-page.css:${line}`);
    }
    seenBlocks.add(key);
  }

  assert.deepEqual(duplicateBlocks, []);
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

test("profile dashboard CSS keeps sex and goal active states grouped", async () => {
  const source = await readText("src/styles/legacy-profile-dashboard-telegram-late.css");

  assert.equal(
    (
      source.match(
        /\.profileSexPicker button\.active,\s*\.profileGoalPicker button\.active\s*\{\s*border-color:\s*rgba\(127,159,58,\.32\);\s*background:\s*rgba\(127,159,58,\.15\);\s*color:\s*rgba\(235,250,195,\.96\);\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (source.match(/border-color:\s*rgba\(127,159,58,\.32\);\s*background:\s*rgba\(127,159,58,\.15\);\s*color:\s*rgba\(235,250,195,\.96\);/g) || []).length,
    1
  );
});

test("profile dashboard CSS keeps AI coach label typography grouped", async () => {
  const source = await readText("src/styles/legacy-profile-dashboard-telegram-late.css");

  assert.equal(
    (
      source.match(
        /\.profileAiCoachInsight span,\s*\.profileAiCoachToggle span\s*\{\s*color:\s*rgba\(145,173,78,\.98\);\s*font-size:\s*11px;\s*font-weight:\s*1000;\s*letter-spacing:\s*\.12em;\s*text-transform:\s*uppercase;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (source.match(/color:\s*rgba\(145,173,78,\.98\);\s*font-size:\s*11px;\s*font-weight:\s*1000;\s*letter-spacing:\s*\.12em;\s*text-transform:\s*uppercase;/g) || []).length,
    1
  );
});

test("profile dashboard CSS keeps Telegram shells grouped", async () => {
  const source = await readText("src/styles/legacy-profile-dashboard-telegram-late.css");

  assert.equal(
    (
      source.match(
        /\.profileTelegramStatus,\s*\.adminClientTelegramBadge\s*\{\s*min-height:\s*32px;\s*padding:\s*0 10px;\s*border-radius:\s*999px;\s*display:\s*grid;\s*place-items:\s*center;\s*background:\s*rgba\(255,255,255,\.045\);\s*color:\s*rgba\(255,255,255,\.55\);\s*font-size:\s*10px;\s*font-weight:\s*950;\s*white-space:\s*nowrap;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /\.profileTelegramStatus\.connected,\s*\.adminClientTelegramBadge\.connected\s*\{\s*background:\s*rgba\(42,171,238,\.14\);\s*border:\s*1px solid rgba\(42,171,238,\.24\);\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /\.profileTelegramAvatar,\s*\.adminClientTelegramAvatar\s*\{\s*display:\s*grid;\s*place-items:\s*center;\s*background:\s*rgba\(42,171,238,\.14\);\s*border:\s*1px solid rgba\(42,171,238,\.18\);\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /\.profileAvatarBig img,\s*\.profileTelegramAvatar img,\s*\.adminClientTelegramAvatar img\s*\{\s*width:\s*100%;\s*height:\s*100%;\s*object-fit:\s*cover;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /\.profileTelegramActions button,\s*\.profileTelegramSave,\s*\.adminClientTelegramActions button,\s*\.adminTelegramSendButton,\s*\.profileTelegramBotActions button,\s*\.profileTelegramCheckButton\s*\{\s*color:\s*rgba\(205,239,255,\.96\);\s*font-weight:\s*950;\s*cursor:\s*pointer;\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /\.profileTelegramBotActions button,\s*\.profileTelegramCheckButton\s*\{\s*min-height:\s*42px;\s*border-radius:\s*14px;\s*border:\s*1px solid rgba\(42,171,238,\.26\);\s*background:\s*rgba\(42,171,238,\.13\);\s*\}/g
      ) || []
    ).length,
    1
  );
  assert.equal(
    (
      source.match(
        /\.profileTelegramBotActions button:disabled,\s*\.profileTelegramCheckButton:disabled\s*\{\s*opacity:\s*\.55;\s*cursor:\s*not-allowed;\s*\}/g
      ) || []
    ).length,
    1
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

test("client nutrition grid CSS does not keep dashboard icon and chart duplicates", async () => {
  const nutritionGrid = await readText("src/styles/client-nutrition-grid-lock.css");
  const mainOverrides = await readText("src/styles/client-main-final-overrides.css");

  const duplicateLocks = [
    /\.profileAiStatsRow\.profileAiStatsRow\.profileAiStatsRow \.profileAiStatLabel svg\s*\{\s*width:\s*14px !important;\s*height:\s*14px !important;\s*\}/,
    /\.profileAiSplitCards\.profileAiSplitCards\.profileAiSplitCards \.profileAiMiniCard\.profileAiMiniCard span svg\s*\{\s*width:\s*14px !important;\s*height:\s*14px !important;\s*flex:\s*0 0 14px !important;\s*\}/,
    /\.mainMeasurementSnapshot\.mainMeasurementSnapshot \.mainMeasurementSnapshotHeader\s*\{\s*height:\s*16px !important;\s*margin-bottom:\s*8px !important;\s*\}/,
    /\.mainMeasurementSnapshot\.mainMeasurementSnapshot \.mainMeasurementChart svg\s*\{\s*height:\s*44px !important;\s*min-height:\s*44px !important;\s*max-height:\s*44px !important;\s*\}/
  ];

  for (const lock of duplicateLocks) {
    assert.doesNotMatch(nutritionGrid, lock);
    assert.match(mainOverrides, lock);
  }

  assert.doesNotMatch(
    nutritionGrid,
    /\.profileAiStatsRow\.profileAiStatsRow strong,\s*html:root\[data-app-theme="warm-light"\] body #root > \.profileDashboardPage\.profileTabbedPage\.mainDashboardPage\.clientCorePage\.clientCorePageMain \.profileAiStatsRow\.profileAiStatsRow \.goal strong\s*\{\s*font-size:\s*18px !important;\s*line-height:\s*1 !important;\s*\}/
  );
  assert.match(
    nutritionGrid,
    /\.profileAiStatsRow\.profileAiStatsRow strong,\s*html:root\[data-app-theme="warm-light"\] body #root > \.profileDashboardPage\.profileTabbedPage\.mainDashboardPage\.clientCorePage\.clientCorePageMain \.profileAiStatsRow\.profileAiStatsRow \.goal strong\s*\{\s*width:\s*100% !important;\s*margin:\s*0 !important;\s*color:\s*var\(--main-card-text\) !important;\s*font-size:\s*18px !important;\s*line-height:\s*1 !important;/
  );
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

test("client nutrition grid CSS does not keep exact duplicate blocks", async () => {
  const source = await readText("src/styles/client-nutrition-grid-lock.css");
  const seenBlocks = new Set();
  const duplicateBlocks = [];

  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    const body = match[2].trim().replace(/\s+/g, " ");
    if (!body || selector.includes("@")) continue;
    const key = `${selector} { ${body} }`;

    if (seenBlocks.has(key)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      duplicateBlocks.push(`src/styles/client-nutrition-grid-lock.css:${line}`);
    }
    seenBlocks.add(key);
  }

  assert.deepEqual(duplicateBlocks, []);
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

test("nutrition base CSS keeps warm-light page shell grouped", async () => {
  const nutritionBaseCss = await readText("src/styles/nutrition.css");

  assert.equal(
    (nutritionBaseCss.match(/:root\[data-app-theme="warm-light"\] \.fatSecretPage\.nutritionFixedHeaderV3,\s*:root\[data-app-theme="warm-light"\] \.clientCorePage\s*\{\s*border-color:\s*rgba\(96, 78, 27, 0\.24\) !important;[\s\S]*?linear-gradient\(180deg, #fffaf0 0%, #f4e8c8 100%\) !important;[\s\S]*?0 24px 60px rgba\(87, 68, 18, 0\.15\),[\s\S]*?inset 0 1px 0 rgba\(255, 255, 255, 0\.72\) !important;[\s\S]*?\}/g) || []).length,
    1
  );
  assert.equal(
    (nutritionBaseCss.match(/border-color:\s*rgba\(96, 78, 27, 0\.24\) !important;[\s\S]*?linear-gradient\(180deg, #fffaf0 0%, #f4e8c8 100%\) !important;[\s\S]*?0 24px 60px rgba\(87, 68, 18, 0\.15\),[\s\S]*?inset 0 1px 0 rgba\(255, 255, 255, 0\.72\) !important;/g) || []).length,
    1
  );
});

test("nutrition base CSS keeps warm-light collapsed AI plan surface in the final owner", async () => {
  const nutritionBaseCss = await readText("src/styles/nutrition.css");

  assert.equal(
    (nutritionBaseCss.match(/:root\[data-app-theme="warm-light"\] \.fatSecretPage\.nutritionFixedHeaderV3 \.nutritionAiPlanDashboard\.collapsed\s*\{\s*border:\s*0 !important;\s*background:\s*#ffffff !important;\s*box-shadow:\s*0 9px 24px rgba\(55, 64, 112, 0\.075\) !important;\s*\}/g) || []).length,
    1
  );
  assert.doesNotMatch(
    nutritionBaseCss,
    /:root\[data-app-theme="warm-light"\] \.fatSecretPage\.nutritionFixedHeaderV3 \.nutritionAiPlanDashboard\.collapsed\s*\{\s*border-color:\s*rgba\(96, 78, 27, 0\.14\) !important;\s*background:\s*rgba\(255, 250, 237, 0\.72\) !important;\s*box-shadow:\s*inset 0 1px 0 rgba\(255, 255, 255, 0\.68\) !important;\s*\}/
  );
});

test("client nutrition weekday strip keeps two-letter labels visible", async () => {
  const nutritionCalendar = await readText("src/utils/nutritionCalendar.js");
  const nutritionBaseCss = await readText("src/styles/nutrition.css");
  const nutritionCss = await readText("src/styles/nutrition-food-flow-late.css");
  const warmLightNutritionCss = await readText("src/styles/legacy-warm-light-nutrition-polish.css");

  assert.match(nutritionCalendar, /NUTRITION_WEEK_LABELS = \["\\u041f\\u041d", "\\u0412\\u0422", "\\u0421\\u0420", "\\u0427\\u0422", "\\u041f\\u0422", "\\u0421\\u0411", "\\u0412\\u0421"\]/);
  assert.match(nutritionCss, /Preserve both letters in Russian weekday abbreviations/);
  assert.match(nutritionCss, /\.nutritionDayV4 \{[\s\S]*display: grid !important;[\s\S]*grid-template-areas:[\s\S]*"label"[\s\S]*"marker" !important;[\s\S]*grid-template-rows: 14px 26px !important;/);
  assert.match(nutritionCss, /\.nutritionWeekV4 \.nutritionDayV4 small \{[\s\S]*min-width: 2\.4ch !important;[\s\S]*width: 2\.4ch !important;[\s\S]*white-space: nowrap !important;/);
  assert.doesNotMatch(nutritionCss, /Keep weekday labels visually separate from the day markers/);
  assert.doesNotMatch(nutritionCss, /\.nutritionDayV4 \{[\s\S]*flex-direction: column-reverse !important;/);
  assert.doesNotMatch(nutritionCss, /\.nutritionDayV4 span \{[\s\S]*width: 28px !important;/);
  assert.doesNotMatch(nutritionBaseCss, /\.nutritionDayV4 \{[\s\S]*height: 28px !important;[\s\S]*flex-direction: column-reverse !important;/);
  assert.doesNotMatch(nutritionBaseCss, /\.nutritionDayV4 span \{[\s\S]*height: 3px !important;/);
  assert.doesNotMatch(warmLightNutritionCss, /\.nutritionDayV4\.selected,[\s\S]*background: linear-gradient\(180deg, #f4e064 0%, #d8bd48 100%\) !important;/);
  assert.match(warmLightNutritionCss, /\.nutritionDayV4\.selected span,[\s\S]*background: #f4e064 !important;/);
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

test("trainer workspace CSS keeps mobile bottom nav shell in one owner", async () => {
  const source = await readText("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerNextMobileNav\s*\{\s*position:\s*fixed;\s*z-index:\s*1000;[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps mobile page shell grouped", async () => {
  const source = await readText("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/@media\s*\(max-width:\s*820px\),\s*\(hover:\s*none\) and \(pointer:\s*coarse\) and \(orientation:\s*landscape\)\s*\{[\s\S]*?\.trainerNextPage\s*\{\s*width:\s*100%;\s*min-height:\s*100dvh;\s*padding:\s*max\(20px,\s*env\(safe-area-inset-top\)\) 20px calc\(112px \+ env\(safe-area-inset-bottom\)\);\s*background:\s*#fff;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerNextPage\s*\{\s*width:\s*100%;\s*min-height:\s*100dvh;\s*padding:\s*max\(20px,\s*env\(safe-area-inset-top\)\) 20px calc\(112px \+ env\(safe-area-inset-bottom\)\);\s*background:\s*#fff;\s*\}/g) || []).length,
    1
  );
});

test("trainer workspace CSS keeps nutrition and notification action buttons grouped", async () => {
  const source = await readText("src/components/trainer/trainer-workspace.css");

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
  const source = await readText("src/components/trainer/trainer-workspace.css");

  assert.equal(
    (source.match(/\.trainerClientAssignmentControls label,\s*\.trainerNutritionPreset,\s*\.trainerNutritionGoalInputs label,\s*\.trainerNutritionPlanFields label,\s*\.trainerNutritionValidity label\s*\{\s*display:\s*grid;/g) || []).length,
    1
  );
  assert.equal(
    (source.match(/\.trainerClientAssignmentControls select,\s*\.trainerNutritionPreset select,\s*\.trainerNutritionGoalInputs input,\s*\.trainerNutritionPlanFields input,\s*\.trainerNutritionValidity input\s*\{\s*width:\s*100%;/g) || []).length,
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
  const adminCalendarCss = await readText("src/styles/legacy-admin-calendar-reminders-late.css");
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

test("client cabinet modal shells keep shared CSS owners", async () => {
  const source = await readText("src/styles/workouts.css");
  const cabinetPolish = await readText("src/styles/legacy-desktop-cabinet-polish.css");
  const nutritionModal = await readText("src/features/client/profile/ProfileNutritionModal.jsx");

  assert.equal(
    (source.match(/\.cabinetNutritionModalHead button,\s*\.cabinetUtilityModalHead > button\s*\{\s*flex:\s*0 0 44px;/g) || []).length,
    1
  );
  assert.match(
    nutritionModal,
    /className="profileDashboardGrid profileNutritionSection hasPlan cabinetNutritionCombined"/
  );
  assert.equal(
    (cabinetPolish.match(/\.cabinetNutritionModal\s*\.profileNutritionSection\.hasPlan\.cabinetNutritionCombined\s*\.profileAiNutritionPlanCard,\s*\.cabinetNutritionModal\s*\.profileNutritionSection\.hasPlan\.cabinetNutritionCombined\s*\.profileNutritionGoalCard\s*\{\s*flex:\s*0 0 auto !important;/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/\.cabinetNutritionModal\s*\.cabinetNutritionCombined\s*\.profileAiNutritionPlanCard,\s*\.cabinetNutritionModal\s*\.cabinetNutritionCombined\s*\.profileNutritionGoalCard\s*\{/g) || []).length,
    0
  );
  assert.equal(
    (cabinetPolish.match(/\.cabinetNutritionModal \.profileNutritionSection\.settingsOpen > \.profileDashboardCard,\s*\.cabinetNutritionModal \.profileNutritionSection\.settingsOpen \.profileNutritionGoalModalHead\s*\{\s*display:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.profileNutritionSection\.settingsOpen \.profileDashboardButton,\s*html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.cabinetNutritionCombined \.profileDashboardButton\s*\{\s*border-color:\s*transparent !important;\s*background:\s*linear-gradient\(135deg, #6552e6, #2d6ff2\) !important;\s*color:\s*#ffffff !important;\s*box-shadow:\s*0 12px 26px rgba\(76, 68, 201, 0\.22\) !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.cabinetNutritionCombined \.profileAiNutritionPlanCard,\s*html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.cabinetNutritionCombined \.profileNutritionGoalCard,\s*html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.profileNutritionSection\.settingsOpen \.profileGoalPicker button,\s*html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.profileNutritionSection\.settingsOpen \.profileMacroGrid > div,\s*html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.cabinetNutritionCombined \.profileGoalPicker button,\s*html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.cabinetNutritionCombined \.profileMacroGrid > div\s*\{\s*border-color:\s*#e1e4ef !important;\s*background:\s*#ffffff !important;\s*color:\s*#596176 !important;\s*box-shadow:\s*none !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.profileNutritionSection\.settingsOpen \.profileGoalPicker button\.active,\s*html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.cabinetNutritionCombined \.profileGoalPicker button\.active\s*\{\s*border-color:\s*#7565e8 !important;\s*background:\s*#efedff !important;\s*color:\s*#4f3dd2 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.profileNutritionSection\.settingsOpen \.profileGoalModeHint,\s*html:root\[data-app-theme="warm-light"\] body #root\s*\.cabinetNutritionModal \.cabinetNutritionCombined \.profileGoalModeHint\s*\{\s*border-color:\s*#dedaf8 !important;\s*background:\s*#f3f1ff !important;\s*color:\s*#596176 !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/\.cabinetNutritionModal \.cabinetNutritionCombined \.profileNutritionWeekday,\s*\.cabinetNutritionModal \.cabinetNutritionCombined \.profileNutritionMonthDay > span\s*\{\s*font-size:\s*9px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/\.cabinetNutritionModal \.cabinetNutritionCombined \.profileNutritionMonthDay > small,\s*\.cabinetNutritionModal \.cabinetNutritionCombined \.profileNutritionMonthDay > em,\s*\.cabinetNutritionModal \.cabinetNutritionCombined \.profileMacroGrid span\s*\{\s*font-size:\s*8px !important;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/html:root\[data-app-theme="warm-light"\] body #root \.profileTrainerNotificationsModal,\s*html:root\[data-app-theme="warm-light"\] body #root \.cabinetProgressPhotosModal\s*\{\s*border-color:\s*#dfe3ef;\s*background:\s*radial-gradient\(circle at 50% -8%, rgba\(90, 73, 223, 0\.05\), transparent 32%\),\s*linear-gradient\(180deg, #ffffff 0%, #f7f8fd 100%\);\s*box-shadow:\s*0 24px 64px rgba\(43, 50, 92, 0\.18\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/html:root\[data-app-theme="warm-light"\] body #root \.profileTrainerNotificationsOverlay,\s*html:root\[data-app-theme="warm-light"\] body #root \.cabinetProgressPhotosOverlay\s*\{\s*background:\s*rgba\(35, 40, 68, 0\.2\);\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/\.profileTrainerNotificationsHead h2,\s*\.cabinetProgressPhotosHead h2\s*\{\s*margin:\s*0;\s*color:\s*#fff;\s*font-size:\s*22px;\s*line-height:\s*1\.05;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/\.profileTrainerNotificationsHead > div,\s*\.cabinetProgressPhotosLatest > div:first-child\s*\{\s*display:\s*grid;\s*gap:\s*3px;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/html:root\[data-app-theme="warm-light"\] body #root \.profileTrainerNotificationsHead h2,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTrainerNotificationItem strong,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTrainerNotificationsEmpty strong,\s*html:root\[data-app-theme="warm-light"\] body #root \.cabinetProgressPhotosHead h2,\s*html:root\[data-app-theme="warm-light"\] body #root \.cabinetProgressPhotosLatest strong,\s*html:root\[data-app-theme="warm-light"\] body #root \.cabinetProgressPhotoSteps strong\s*\{\s*color:\s*#151824;\s*\}/g) || []).length,
    1
  );
  assert.equal(
    (cabinetPolish.match(/html:root\[data-app-theme="warm-light"\] body #root \.profileTrainerNotificationsHead button,\s*html:root\[data-app-theme="warm-light"\] body #root \.profileTrainerNotificationItem,\s*html:root\[data-app-theme="warm-light"\] body #root \.cabinetProgressPhotosHead button,\s*html:root\[data-app-theme="warm-light"\] body #root \.cabinetProgressPhotosIntro,\s*html:root\[data-app-theme="warm-light"\] body #root \.cabinetProgressPhotoSteps label\s*\{\s*border-color:\s*#e1e4ef;\s*background:\s*#fff;\s*color:\s*#151824;\s*\}/g) || []).length,
    1
  );
});

test("workout navigation compact heights stay grouped", async () => {
  const source = await readText("src/styles/workouts.css");

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
