import fs from "node:fs";
import path from "node:path";

const CSS_ROOT = path.resolve("src");

function collectCssFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectCssFiles(fullPath, files);
    } else if (entry.name.endsWith(".css")) {
      files.push(fullPath);
    }
  }

  return files;
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

const files = collectCssFiles(CSS_ROOT);
const rows = files
  .map((file) => ({
    file: path.relative(process.cwd(), file),
    bytes: fs.statSync(file).size,
    kind: file.endsWith(".module.css") ? "module" : "global"
  }))
  .sort((a, b) => b.bytes - a.bytes);
const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
const moduleCount = rows.filter((row) => row.kind === "module").length;
const globalCount = rows.length - moduleCount;

console.log(`CSS files: ${rows.length}`);
console.log(`CSS Modules: ${moduleCount}`);
console.log(`Global CSS: ${globalCount}`);
console.log(`Total source CSS: ${formatKiB(totalBytes)}`);
console.log("");
console.log("Top CSS files:");

for (const row of rows.slice(0, 20)) {
  const percent = totalBytes ? ((row.bytes / totalBytes) * 100).toFixed(1) : "0.0";
  console.log(`${formatKiB(row.bytes).padStart(10)}  ${percent.padStart(5)}%  ${row.kind.padEnd(6)}  ${row.file}`);
}
