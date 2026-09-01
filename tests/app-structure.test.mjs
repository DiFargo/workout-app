import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_EXTENSIONS = [".js", ".jsx"];
const CSS_EXTENSION = ".css";

async function pathExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readText(file) {
  return fs.readFile(file, "utf8");
}

async function collectFiles(directory, extensions, files = []) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(file, extensions, files);
    } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
      files.push(path.normalize(file));
    }
  }

  return files;
}

function collectModuleImports(source) {
  return [
    ...source.matchAll(/\bimport\s+(?:[^"']+\s+from\s+)?["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\(["']([^"']+)["']\)/g)
  ].map((match) => match[1]);
}

function collectCssImports(source) {
  return [...source.matchAll(/@import\s+["']([^"']+\.css)["'][^;]*;/g)].map((match) => match[1]);
}

async function resolveSourceImport(file, importSource) {
  if (!importSource.startsWith(".") || importSource.endsWith(CSS_EXTENSION)) return null;

  const base = path.normalize(path.join(path.dirname(file), importSource));
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

async function collectReachableSources() {
  const reachable = new Set();
  const pending = [path.normalize("src/main.jsx")];

  while (pending.length > 0) {
    const file = pending.pop();
    if (reachable.has(file)) continue;

    reachable.add(file);
    for (const imported of collectModuleImports(await readText(file))) {
      const target = await resolveSourceImport(file, imported);
      if (target) pending.push(target);
    }
  }

  return reachable;
}

async function collectReachableCss() {
  const sourceFiles = await collectFiles("src", SOURCE_EXTENSIONS);
  const roots = new Set();

  for (const file of sourceFiles) {
    for (const imported of collectModuleImports(await readText(file))) {
      if (!imported.endsWith(CSS_EXTENSION) || !imported.startsWith(".")) continue;

      const target = path.normalize(path.join(path.dirname(file), imported));
      if (await pathExists(target)) roots.add(target);
    }
  }

  const reachable = new Set();
  async function visit(file) {
    if (reachable.has(file)) return;
    reachable.add(file);

    for (const imported of collectCssImports(await readText(file))) {
      const target = path.normalize(path.join(path.dirname(file), imported));
      assert.equal(await pathExists(target), true, `Missing CSS import ${imported} from ${file}`);
      await visit(target);
    }
  }

  for (const root of roots) await visit(root);
  return reachable;
}

test("AppCore remains a coordinator", async () => {
  const source = await readText("src/AppCore.jsx");

  assert.match(source, /NutritionRoute/);
  assert.doesNotMatch(source, /renderNutritionPageFromContext/);
  assert.doesNotMatch(source, /nutritionPageModel/);
  assert.ok(source.split(/\r?\n/).length <= 3250);
});

test("trainer daily journal stays isolated and lazy-loaded", async () => {
  const [workspace, journal] = await Promise.all([
    readText("src/components/trainer/TrainerWorkspace.jsx"),
    readText("src/components/trainer/TrainerDailyJournal.jsx")
  ]);

  assert.match(workspace, /lazy\(\(\) => import\(["']\.\/TrainerDailyJournal["']\)\)/);
  assert.match(workspace, /<Suspense fallback=\{null\}>/);
  assert.match(journal, /TrainerDailyJournal\.module\.css/);
  assert.match(journal, /buildTrainerDailyJournal/);
});

test("the application shell keeps the startup splash under one runtime owner", async () => {
  const source = await readText("src/App.jsx");

  assert.match(source, /import AppCore from ["']\.\/AppCore["'];/);
  assert.match(source, /<AppCore \/>/);
  assert.doesNotMatch(source, /\blazy\(/);
  assert.doesNotMatch(source, /<Suspense/);
  assert.doesNotMatch(source, /AppSplash/);
  assert.doesNotMatch(source, /AppModuleSurface/);
  assert.doesNotMatch(source, /App\.module\.css/);
});

test("source modules are reachable and acyclic", async () => {
  const allSources = await collectFiles("src", SOURCE_EXTENSIONS);
  const reachable = await collectReachableSources();

  assert.deepEqual(allSources.sort(), [...reachable].sort());

  const graph = new Map();
  for (const file of allSources) {
    const imports = [];
    for (const imported of collectModuleImports(await readText(file))) {
      const target = await resolveSourceImport(file, imported);
      if (target) imports.push(target);
    }
    graph.set(file, imports);
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (file) => {
    assert.equal(visiting.has(file), false, `Source import cycle at ${file}`);
    if (visited.has(file)) return;

    visiting.add(file);
    for (const next of graph.get(file) || []) visit(next);
    visiting.delete(file);
    visited.add(file);
  };

  for (const file of graph.keys()) visit(file);
});

test("all stylesheets are reachable and CSS Modules are colocated", async () => {
  const allCss = await collectFiles("src", [CSS_EXTENSION]);
  const reachable = await collectReachableCss();
  const unreachable = allCss.filter((file) => !reachable.has(file));

  assert.deepEqual(unreachable, []);

  const modules = allCss.filter((file) => file.endsWith(".module.css"));
  const sourceFiles = await collectFiles("src", SOURCE_EXTENSIONS);
  const moduleOwners = new Set();

  for (const sourceFile of sourceFiles) {
    for (const imported of collectModuleImports(await readText(sourceFile))) {
      if (!imported.endsWith(".module.css") || !imported.startsWith(".")) continue;
      moduleOwners.add(path.normalize(path.join(path.dirname(sourceFile), imported)));
    }
  }

  for (const moduleFile of modules) {
    assert.equal(
      moduleOwners.has(moduleFile),
      true,
      `CSS Module has no importing source owner: ${moduleFile}`
    );
  }
});

test("global style entrypoint keeps only reset, base, and component layers", async () => {
  const [entrypoint, reset] = await Promise.all([
    readText("src/styles/index.css"),
    readText("src/styles/_reset.css")
  ]);

  assert.match(entrypoint, /@layer reset, base, components;/);
  assert.match(entrypoint, /@import ["']\.\/_reset\.css["'] layer\(reset\)/);
  assert.doesNotMatch(entrypoint, /@layer reset, base, legacy, components/);
  assert.match(reset, /box-sizing: border-box/);
});

test("only the approved global style files remain in src/styles", async () => {
  const allCss = await collectFiles("src", [CSS_EXTENSION]);
  const globalCss = allCss
    .filter((file) => !file.endsWith(".module.css"))
    .sort();

  assert.deepEqual(globalCss, [
    path.normalize("src/styles/_reset.css"),
    path.normalize("src/styles/_variables.css"),
    path.normalize("src/styles/index.css")
  ]);
});

test("stylesheets have no version suffixes or late imports", async () => {
  const allCss = await collectFiles("src", [CSS_EXTENSION]);
  const versioned = allCss.filter((file) => /-v\d+\.css$/i.test(file));

  assert.deepEqual(versioned, []);

  for (const file of allCss) {
    const source = (await readText(file)).replace(/\/\*[\s\S]*?\*\//g, "");
    let importsOnly = true;

    for (const line of source.split(/\r?\n/)) {
      const statement = line.trim();
      if (!statement) continue;

      if (statement.startsWith("@import")) {
        assert.equal(importsOnly, true, `Late CSS import in ${file}`);
      } else if (!statement.startsWith("@charset") && !statement.startsWith("@layer")) {
        importsOnly = false;
      }
    }
  }
});

test("legacy eager stylesheet loaders and inline nutrition score styles stay removed", async () => {
  const [appCore, routeLoaders, terminalLoaders, preload, nutritionRoute, planDetails] = await Promise.all([
    readText("src/AppCore.jsx"),
    readText("src/app/appRouteLoaders.js"),
    readText("src/app/appTerminalRouteLoaders.js"),
    readText("src/app/clientRoutePreload.js"),
    readText("src/features/client/nutrition/NutritionRoute.jsx"),
    readText("src/features/client/nutrition/NutritionPlanDetails.jsx")
  ]);

  assert.equal(await pathExists("src/styles/client-workout-lazy.css"), false);
  assert.equal(await pathExists("src/styles/nutrition-stack.css"), false);
  assert.doesNotMatch(`${appCore}\n${routeLoaders}\n${terminalLoaders}`, /client-workout-lazy|nutrition-stack|loadWorkoutStyles/);
  assert.doesNotMatch(preload, /requestIdleCallback|setTimeout/);
  assert.match(nutritionRoute, /useNutritionPageData/);
  assert.match(planDetails, /NutritionMacroScoreRing/);
  assert.doesNotMatch(planDetails, /style=\{\{/);
});
