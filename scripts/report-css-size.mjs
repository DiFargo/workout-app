import fs from "node:fs";
import path from "node:path";

const CSS_ROOTS = [path.resolve("src", "styles"), path.resolve("src", "components")];

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

const files = CSS_ROOTS.flatMap((root) => collectCssFiles(root));
const rows = files
  .map((file) => ({
    file: path.relative(process.cwd(), file),
    bytes: fs.statSync(file).size
  }))
  .sort((a, b) => b.bytes - a.bytes);
const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);

console.log(`CSS files: ${rows.length}`);
console.log(`Total source CSS: ${formatKiB(totalBytes)}`);
console.log("");
console.log("Top CSS files:");

for (const row of rows.slice(0, 20)) {
  const percent = totalBytes ? ((row.bytes / totalBytes) * 100).toFixed(1) : "0.0";
  console.log(`${formatKiB(row.bytes).padStart(10)}  ${percent.padStart(5)}%  ${row.file}`);
}
