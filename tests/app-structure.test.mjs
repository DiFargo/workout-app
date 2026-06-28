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

  assert.match(appSource, /import AppCore from ["']\.\/AppCore["']/);
  assert.match(appSource, /import AppErrorBoundary from ["']\.\/components\/common\/AppErrorBoundary["']/);
  assert.match(appSource, /<AppErrorBoundary>/);
  assert.match(appSource, /<AppCore \/>/);
  assert.ok(appSource.split(/\r?\n/).length <= 16, "App.jsx should remain a thin AppCore wrapper");

  assert.match(mainSource, /createRoot\(document\.getElementById\(['"]root['"]\)\)\.render/);
  assert.match(mainSource, /['"]\.\/styles\/index\.css['"]/);
  assert.match(mainSource, /navigator\.serviceWorker\.register\(["']\/sw\.js["']\)/);
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
  const appSource = await readText("src/App.jsx");
  const trainerWorkspace = await readText("src/components/trainer/TrainerWorkspace.jsx");
  const adminPanelHub = await readText("src/components/admin/AdminPanelHub.jsx");

  assert.equal(await pathExists("src/styles.css"), false);
  assert.match(main, /['"]\.\/styles\/index\.css['"]/);
  assert.doesNotMatch(main, /['"]\.\/styles\.css['"]/);
  assert.doesNotMatch(appSource, /styles\.css/);
  assert.match(trainerWorkspace, /['"]\.\.\/\.\.\/styles\/trainer-lazy\.css['"]/);
  assert.match(adminPanelHub, /['"]\.\.\/\.\.\/styles\/admin-lazy\.css['"]/);

  for (const requiredImport of [
    "./tokens.css",
    "./themes.css",
    "./layout.css",
    "./components.css",
    "./nutrition-stack.css",
    "./legacy-stack.css"
  ]) {
    assert.match(indexCss, new RegExp(`@import "${requiredImport.replace(".", "\\.")}"`));
  }

  for (const deferredImport of [
    "./trainer.css",
    "./admin.css",
    "./legacy-admin-stack.css",
    "./legacy-trainer-desktop-adaptation-late.css",
    "./legacy-trainer-program-editor-late.css",
    "./legacy-trainer-light-workspace.css",
    "./legacy-trainer-light-audit.css",
    "./nutrition-trainer-desktop.css"
  ]) {
    assert.doesNotMatch(indexCss, new RegExp(`@import "${deferredImport.replace(".", "\\.")}"`));
  }

  const allSourceFiles = await collectFiles("src", [".js", ".jsx"]);
  const allowedCssImportFiles = new Set([
    path.normalize("src/main.jsx"),
    path.normalize("src/components/trainer/TrainerWorkspace.jsx"),
    path.normalize("src/components/admin/AdminPanelHub.jsx")
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
    "src/styles/trainer-lazy.css",
    "src/styles/admin-lazy.css"
  ]) {
    await walkCssImports(cssEntry, new Set(), visited);
  }
  const allCssFiles = [
    ...(await collectFiles("src/styles", [".css"])),
    ...(await collectFiles("src/components", [".css"]))
  ].map((file) => path.normalize(file)).sort();
  const reachableCssFiles = [...visited].sort();

  assert.ok(visited.has(path.normalize("src/styles/index.css")));
  assert.ok(visited.has(path.normalize("src/styles/trainer-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/admin-lazy.css")));
  assert.ok(visited.has(path.normalize("src/styles/legacy-stack.css")));
  assert.ok(visited.has(path.normalize("src/components/trainer/trainer-workspace.css")));
  assert.equal(await pathExists("src/styles.css"), false);
  assert.deepEqual(reachableCssFiles, allCssFiles);
});

test("dark nutrition hero keeps explicit readable text overrides", async () => {
  const finalPolishStack = await readText("src/styles/legacy-stack-final-polish.css");
  const darkGreenFoodFlow = await readText("src/styles/legacy-client-screen-alignment.css");

  assert.match(finalPolishStack, /@import "\.\/legacy-dark-green-food-flow\.css"/);
  assert.match(finalPolishStack, /@import "\.\/legacy-client-screen-alignment\.css"/);
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

test("production components do not import feature layers back", async () => {
  const componentFiles = await collectFiles("src/components", [".js", ".jsx"]);
  const allowedFeatureImports = new Set([
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
