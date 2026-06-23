import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DIST_ASSETS_DIR = path.resolve("dist", "assets");
const MAIN_JS_RAW_LIMIT = 600 * 1024;
const MAIN_JS_GZIP_LIMIT = 170 * 1024;

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

if (!fs.existsSync(DIST_ASSETS_DIR)) {
  throw new Error("Missing dist/assets. Run npm.cmd run build before checking bundle budgets.");
}

const mainJsFiles = fs
  .readdirSync(DIST_ASSETS_DIR)
  .filter((file) => /^index-[\w-]+\.js$/.test(file));

if (mainJsFiles.length !== 1) {
  throw new Error(`Expected one built main index JS chunk, found ${mainJsFiles.length}: ${mainJsFiles.join(", ")}`);
}

const mainJsPath = path.join(DIST_ASSETS_DIR, mainJsFiles[0]);
const mainJs = fs.readFileSync(mainJsPath);
const rawSize = mainJs.byteLength;
const gzipSize = zlib.gzipSync(mainJs).byteLength;

console.log(`Main JS chunk: ${mainJsFiles[0]}`);
console.log(`Raw size: ${formatKiB(rawSize)} / ${formatKiB(MAIN_JS_RAW_LIMIT)}`);
console.log(`Gzip size: ${formatKiB(gzipSize)} / ${formatKiB(MAIN_JS_GZIP_LIMIT)}`);

if (rawSize > MAIN_JS_RAW_LIMIT) {
  throw new Error(`Main JS raw size ${formatKiB(rawSize)} exceeds budget ${formatKiB(MAIN_JS_RAW_LIMIT)}.`);
}

if (gzipSize > MAIN_JS_GZIP_LIMIT) {
  throw new Error(`Main JS gzip size ${formatKiB(gzipSize)} exceeds budget ${formatKiB(MAIN_JS_GZIP_LIMIT)}.`);
}
