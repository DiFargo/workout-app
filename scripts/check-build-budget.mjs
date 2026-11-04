import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const INITIAL_ENTRY_GZIP_LIMIT = 100 * 1024;
const FIREBASE_CORE_GZIP_LIMIT = 170 * 1024;
export const MANDATORY_BOOT_GZIP_LIMIT = 640 * 1024;
const MANDATORY_BOOT_SOURCES = ["src/App.jsx"];
const HARNESS_NAME = /(?:Client|Trainer|TrainerFull|Admin)E2EHarness/;

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

// Inspect the final artifact graph, not just source spelling or chunk names.
// The pure interface lets tests cover failures without rebuilding application files.
export function inspectBuildAssets(assets, manifest) {
  const names = [...assets.keys()];
  for (const name of [...names, ...Object.keys(manifest)]) {
    if (HARNESS_NAME.test(name)) throw new Error(`E2E harness leaked into deployable artifact: ${name}`);
  }
  for (const [name, content] of assets) {
    if (name.endsWith(".js") && content.toString().includes("client_harness_day_1")) {
      throw new Error(`E2E fixture data leaked into deployable artifact: ${name}`);
    }
  }
  const oneFile = (pattern, label) => {
    const matching = names.filter(name => pattern.test(name));
    if (matching.length !== 1) throw new Error(`Expected one built ${label}, found ${matching.length}: ${matching.join(", ")}`);
    return matching[0];
  };
  const mainJs = oneFile(/^index-[\w-]+\.js$/, "main index JS chunk");
  const mainCss = oneFile(/^index-[\w-]+\.css$/, "main index CSS chunk");
  const reactRuntime = oneFile(/^react-[\w-]+\.js$/, "React runtime chunk");
  const appCheck = oneFile(/^firebase-app-check-[\w-]+\.js$/, "optional Firebase App Check chunk");
  const entryKey = Object.keys(manifest).find(key => manifest[key].isEntry && path.basename(manifest[key].file) === mainJs);
  if (!entryKey) throw new Error("Build manifest is missing the main entry graph.");
  const staticClosure = (key, visited = new Set()) => {
    if (visited.has(key)) return visited;
    const item = manifest[key];
    if (!item) throw new Error(`Missing imported build manifest entry: ${key}`);
    visited.add(key);
    for (const imported of item.imports || []) staticClosure(imported, visited);
    return visited;
  };
  const isAppCheck = key => path.basename(manifest[key].file) === appCheck;
  if ([...staticClosure(entryKey)].some(isAppCheck)) throw new Error("Optional Firebase App Check is eagerly imported by the main entry.");
  const coreKeys = Object.keys(manifest).filter(key => /^firebase-[\w-]+\.js$/.test(path.basename(manifest[key].file))
    && !/^firebase-(?:app-check|storage)-/.test(path.basename(manifest[key].file)));
  for (const key of coreKeys) {
    if ([...staticClosure(key)].some(isAppCheck)) throw new Error("Firebase core statically imports optional App Check.");
  }
  const gzip = name => {
    const content = assets.get(path.basename(name));
    if (!content) throw new Error(`Missing built asset: ${name}`);
    return zlib.gzipSync(content).byteLength;
  };
  const initialAssets = new Set([mainJs, mainCss, reactRuntime]);
  for (const key of staticClosure(entryKey)) {
    initialAssets.add(path.basename(manifest[key].file));
    for (const css of manifest[key].css || []) initialAssets.add(path.basename(css));
  }
  const initialEntryGzipSize = [...initialAssets].reduce((total, name) => total + gzip(name), 0);
  // main.jsx awaits App before mounting. Trainer styles now travel with trainer
  // routes. Select mandatory roots by source identity, not emitted chunk names.
  // Follow only static imports from these roots: unrelated lazy routes stay lazy.
  const bootRoots = [entryKey, ...MANDATORY_BOOT_SOURCES.map(source => {
    const matches = Object.keys(manifest).filter(key => key === source || manifest[key].src === source);
    if (matches.length !== 1) throw new Error(`Expected one mandatory boot source ${source}, found ${matches.length}.`);
    return matches[0];
  })];
  const reachable = (key, visited = new Set()) => {
    if (visited.has(key)) return visited;
    const item = manifest[key];
    if (!item) throw new Error(`Missing imported build manifest entry: ${key}`);
    visited.add(key);
    for (const imported of [...(item.imports || []), ...(item.dynamicImports || [])]) reachable(imported, visited);
    return visited;
  };
  const reachableKeys = reachable(entryKey);
  const mandatoryBootAssets = new Set(initialAssets);
  for (const root of bootRoots) {
    if (!reachableKeys.has(root)) throw new Error(`Mandatory boot source is disconnected from the entry graph: ${root}`);
    for (const key of staticClosure(root)) {
      mandatoryBootAssets.add(path.basename(manifest[key].file));
      for (const css of manifest[key].css || []) mandatoryBootAssets.add(path.basename(css));
    }
  }
  const mandatoryBootGzipSize = [...mandatoryBootAssets].reduce((total, name) => total + gzip(name), 0);
  const firebaseCoreGzipSize = coreKeys.reduce((total, key) => total + gzip(manifest[key].file), 0);
  if (!coreKeys.length) throw new Error("Build manifest is missing the Firebase core chunk.");
  if (!Object.values(manifest).some(item => (item.dynamicImports || []).some(key => manifest[key] && path.basename(manifest[key].file) === appCheck))) {
    throw new Error("Firebase App Check must remain reachable through a dynamic import.");
  }
  if (initialEntryGzipSize > INITIAL_ENTRY_GZIP_LIMIT) {
    throw new Error(`Initial entry gzip size ${formatKiB(initialEntryGzipSize)} exceeds budget ${formatKiB(INITIAL_ENTRY_GZIP_LIMIT)}.`);
  }
  if (firebaseCoreGzipSize > FIREBASE_CORE_GZIP_LIMIT) {
    throw new Error(`Firebase core gzip size ${formatKiB(firebaseCoreGzipSize)} exceeds budget ${formatKiB(FIREBASE_CORE_GZIP_LIMIT)}.`);
  }
  if (mandatoryBootGzipSize > MANDATORY_BOOT_GZIP_LIMIT) {
    throw new Error(`Mandatory boot path gzip size ${formatKiB(mandatoryBootGzipSize)} exceeds budget ${formatKiB(MANDATORY_BOOT_GZIP_LIMIT)}.`);
  }
  return { mainJs, mainCss, reactRuntime, initialEntryGzipSize, mandatoryBootGzipSize, mandatoryBootAssetCount: mandatoryBootAssets.size, firebaseCoreGzipSize, appCheckGzipSize: gzip(appCheck) };
}

export function checkBuildBudget(directory = path.resolve("dist")) {
  const assetsDirectory = path.join(directory, "assets");
  if (!fs.existsSync(assetsDirectory)) throw new Error("Missing dist/assets. Run npm.cmd run build before checking bundle budgets.");
  const manifestPath = path.join(directory, ".vite", "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("Missing Vite build manifest. Rebuild before checking artifact budgets.");
  const assets = new Map(fs.readdirSync(assetsDirectory).map(name => [name, fs.readFileSync(path.join(assetsDirectory, name))]));
  const report = inspectBuildAssets(assets, JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  console.log(`Main JS chunk: ${report.mainJs}`);
  console.log(`Main CSS chunk: ${report.mainCss}`);
  console.log(`React runtime chunk: ${report.reactRuntime}`);
  console.log(`Initial static entry gzip: ${formatKiB(report.initialEntryGzipSize)} / ${formatKiB(INITIAL_ENTRY_GZIP_LIMIT)}`);
  console.log(`Mandatory boot path gzip (deduplicated entry + App): ${formatKiB(report.mandatoryBootGzipSize)} / ${formatKiB(MANDATORY_BOOT_GZIP_LIMIT)}; ${report.mandatoryBootAssetCount} assets`);
  console.log(`Firebase core gzip: ${formatKiB(report.firebaseCoreGzipSize)} / ${formatKiB(FIREBASE_CORE_GZIP_LIMIT)}`);
  console.log(`Optional App Check gzip: ${formatKiB(report.appCheckGzipSize)}; E2E harness artifacts: none`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) checkBuildBudget();
