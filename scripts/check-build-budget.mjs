import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DIST_ASSETS_DIR = path.resolve("dist", "assets");
const INITIAL_ENTRY_GZIP_LIMIT = 100 * 1024;

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

if (!fs.existsSync(DIST_ASSETS_DIR)) {
  throw new Error("Missing dist/assets. Run npm.cmd run build before checking bundle budgets.");
}

const mainJsFiles = fs
  .readdirSync(DIST_ASSETS_DIR)
  .filter((file) => /^index-[\w-]+\.js$/.test(file));
const mainCssFiles = fs
  .readdirSync(DIST_ASSETS_DIR)
  .filter((file) => /^index-[\w-]+\.css$/.test(file));
const reactRuntimeFiles = fs
  .readdirSync(DIST_ASSETS_DIR)
  .filter((file) => /^react-[\w-]+\.js$/.test(file));

if (mainJsFiles.length !== 1) {
  throw new Error(`Expected one built main index JS chunk, found ${mainJsFiles.length}: ${mainJsFiles.join(", ")}`);
}

if (mainCssFiles.length !== 1) {
  throw new Error(`Expected one built main index CSS chunk, found ${mainCssFiles.length}: ${mainCssFiles.join(", ")}`);
}

if (reactRuntimeFiles.length !== 1) {
  throw new Error(`Expected one built React runtime chunk, found ${reactRuntimeFiles.length}: ${reactRuntimeFiles.join(", ")}`);
}

const mainJsPath = path.join(DIST_ASSETS_DIR, mainJsFiles[0]);
const mainJs = fs.readFileSync(mainJsPath);
const jsGzipSize = zlib.gzipSync(mainJs).byteLength;
const mainCssPath = path.join(DIST_ASSETS_DIR, mainCssFiles[0]);
const mainCss = fs.readFileSync(mainCssPath);
const cssGzipSize = zlib.gzipSync(mainCss).byteLength;
const reactRuntimePath = path.join(DIST_ASSETS_DIR, reactRuntimeFiles[0]);
const reactRuntimeGzipSize = zlib.gzipSync(fs.readFileSync(reactRuntimePath)).byteLength;
const initialEntryGzipSize = jsGzipSize + cssGzipSize + reactRuntimeGzipSize;

console.log(`Main JS chunk: ${mainJsFiles[0]}`);
console.log(`Main CSS chunk: ${mainCssFiles[0]}`);
console.log(`React runtime chunk: ${reactRuntimeFiles[0]}`);
console.log(`Initial entry gzip: ${formatKiB(initialEntryGzipSize)} / ${formatKiB(INITIAL_ENTRY_GZIP_LIMIT)}`);

if (initialEntryGzipSize > INITIAL_ENTRY_GZIP_LIMIT) {
  throw new Error(`Initial entry gzip size ${formatKiB(initialEntryGzipSize)} exceeds budget ${formatKiB(INITIAL_ENTRY_GZIP_LIMIT)}.`);
}
