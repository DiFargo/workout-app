import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DIST_ASSETS_DIR = path.resolve("dist", "assets");
const MAIN_JS_RAW_LIMIT = 600 * 1024;
const MAIN_JS_GZIP_LIMIT = 170 * 1024;
const MAIN_CSS_RAW_LIMIT = 2100 * 1024;
const MAIN_CSS_GZIP_LIMIT = 270 * 1024;

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

if (mainJsFiles.length !== 1) {
  throw new Error(`Expected one built main index JS chunk, found ${mainJsFiles.length}: ${mainJsFiles.join(", ")}`);
}

if (mainCssFiles.length !== 1) {
  throw new Error(`Expected one built main index CSS chunk, found ${mainCssFiles.length}: ${mainCssFiles.join(", ")}`);
}

const mainJsPath = path.join(DIST_ASSETS_DIR, mainJsFiles[0]);
const mainJs = fs.readFileSync(mainJsPath);
const jsRawSize = mainJs.byteLength;
const jsGzipSize = zlib.gzipSync(mainJs).byteLength;
const mainCssPath = path.join(DIST_ASSETS_DIR, mainCssFiles[0]);
const mainCss = fs.readFileSync(mainCssPath);
const cssRawSize = mainCss.byteLength;
const cssGzipSize = zlib.gzipSync(mainCss).byteLength;

console.log(`Main JS chunk: ${mainJsFiles[0]}`);
console.log(`Raw size: ${formatKiB(jsRawSize)} / ${formatKiB(MAIN_JS_RAW_LIMIT)}`);
console.log(`Gzip size: ${formatKiB(jsGzipSize)} / ${formatKiB(MAIN_JS_GZIP_LIMIT)}`);
console.log(`Main CSS chunk: ${mainCssFiles[0]}`);
console.log(`Raw size: ${formatKiB(cssRawSize)} / ${formatKiB(MAIN_CSS_RAW_LIMIT)}`);
console.log(`Gzip size: ${formatKiB(cssGzipSize)} / ${formatKiB(MAIN_CSS_GZIP_LIMIT)}`);

if (jsRawSize > MAIN_JS_RAW_LIMIT) {
  throw new Error(`Main JS raw size ${formatKiB(jsRawSize)} exceeds budget ${formatKiB(MAIN_JS_RAW_LIMIT)}.`);
}

if (jsGzipSize > MAIN_JS_GZIP_LIMIT) {
  throw new Error(`Main JS gzip size ${formatKiB(jsGzipSize)} exceeds budget ${formatKiB(MAIN_JS_GZIP_LIMIT)}.`);
}

if (cssRawSize > MAIN_CSS_RAW_LIMIT) {
  throw new Error(`Main CSS raw size ${formatKiB(cssRawSize)} exceeds budget ${formatKiB(MAIN_CSS_RAW_LIMIT)}.`);
}

if (cssGzipSize > MAIN_CSS_GZIP_LIMIT) {
  throw new Error(`Main CSS gzip size ${formatKiB(cssGzipSize)} exceeds budget ${formatKiB(MAIN_CSS_GZIP_LIMIT)}.`);
}
