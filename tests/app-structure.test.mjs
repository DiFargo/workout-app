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

test("CSS V2 is the only stylesheet architecture", async () => {
  const cssFiles = (await collectFiles("src", [".css"]))
    .map((file) => path.normalize(file))
    .sort();
  const looseCssFiles = cssFiles.filter((file) => !file.endsWith(".module.css"));

  assert.deepEqual(looseCssFiles, [
    path.normalize("src/styles/_variables.css"),
    path.normalize("src/styles/index.css")
  ]);
  assert.deepEqual(cssFiles.filter((file) => /-v\d+\.css$/i.test(file)), []);
  assert.equal(await pathExists("src/css-v2/index.css"), false);

  const indexCss = await readText("src/styles/index.css");
  assert.match(indexCss, /^@layer reset, base, components;/);
  assert.deepEqual(collectCssImports(indexCss), ["./_variables.css"]);

  assert.equal(await pathExists("src/app/cssVariant.js"), false);
  const mainSource = await readText("src/main.jsx");
  assert.doesNotMatch(mainSource, /cssVariant|data-css-variant|loadCssVariant/);
});

test("component styles are imported as colocated CSS Modules", async () => {
  const sourceFiles = await collectFiles("src", [".js", ".jsx"]);
  const moduleFiles = (await collectFiles("src", [".module.css"]))
    .map((file) => path.normalize(file))
    .sort();
  const importedModules = new Set();

  for (const file of sourceFiles) {
    const source = await readText(file);
    const cssImports = collectModuleImports(source).filter((importSource) => importSource.endsWith(".css"));

    for (const cssImport of cssImports) {
      if (!cssImport.endsWith(".module.css")) {
        assert.equal(path.normalize(file), path.normalize("src/main.jsx"));
        assert.equal(cssImport, "./styles/index.css");
        continue;
      }

      const resolved = resolveRelativeImport(file, cssImport);
      assert.ok(resolved, `CSS Module imports must be relative: ${cssImport} from ${file}`);
      assert.equal(path.dirname(resolved), path.dirname(path.normalize(file)), `CSS Module must be colocated: ${cssImport} from ${file}`);
      assert.equal(await pathExists(resolved), true, `Missing CSS Module ${resolved}`);
      assert.doesNotMatch(await readText(resolved), /!important/, `CSS Module cannot use !important: ${resolved}`);
      importedModules.add(resolved);
    }
  }

  assert.deepEqual([...importedModules].sort(), moduleFiles);
});

test("CSS Modules do not import legacy stylesheets", async () => {
  const moduleFiles = await collectFiles("src", [".module.css"]);

  for (const file of moduleFiles) {
    const imports = collectCssImports(await readText(file));
    assert.deepEqual(imports, [], `CSS Module must be self-contained: ${file}`);
  }
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

test("client workout set module keeps one no-weight modal grid owner", async () => {
  const source = await readText("src/features/client/workouts/WorkoutExerciseSets.module.css");

  assert.equal(
    (source.match(/\.modalFields\.withoutWeight\s*\{\s*grid-template-columns:\s*1fr;\s*\}/g) || []).length,
    1
  );
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

test("trainer workouts page program tab exposes selected state", async () => {
  const workoutsRoute = await readText("src/features/trainer/TrainerAdminWorkoutsRoute.jsx");

  assert.match(workoutsRoute, /<button type="button" className="active" aria-pressed="true">[\s\S]*?<\/button>[\s\S]*openTrainerExerciseLibrary/);
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
