import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendManufacturerFoods, manufacturerFoodId } from "./lib/appendManufacturerFoods.mjs";
import { buildPersonalSearchCatalog } from "./build-personal-search-catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map(process.argv.slice(2).map(value => {
  const index = value.indexOf("=");
  return index < 0 ? [value, true] : [value.slice(0, index), value.slice(index + 1)];
}));
const apply = args.has("--apply");
const inputDirectory = path.resolve(root, args.get("--input-dir") || "data/nutrition-catalog-sources/belarus-manufacturers-2026-10-29");
const outputDirectory = path.resolve(root, "artifacts/belarus-catalog-expansion-2026-10-29");
const reportName = args.get("--report-name") || (apply ? "applied.json" : "dry-run.json");
assert.ok(/^[a-z0-9-]+\.json$/i.test(reportName), "Use a plain JSON report filename");
const runtimePath = path.join(root, "public/nutrition-catalog/personal/products.json");
const sourcesPath = path.join(root, "public/nutrition-catalog/personal/manufacturer-sources.json");
const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const existingRows = read(runtimePath);
assert.ok(Array.isArray(existingRows) && existingRows.length > 0, "Existing catalogue must not be empty");
const sourceFiles = fs.readdirSync(inputDirectory).filter(file => file.endsWith(".json")).sort();
assert.ok(sourceFiles.length, "No candidate files found");
const candidates = sourceFiles.flatMap(file => {
  const data = read(path.join(inputDirectory, file));
  assert.ok(Array.isArray(data), `${file} must contain a candidate array`);
  return data;
});
fs.mkdirSync(outputDirectory, { recursive: true });
const baselinePath = path.join(outputDirectory, "baseline.json");
const previousSources = fs.existsSync(sourcesPath) ? read(sourcesPath) : null;
const baseline = previousSources?.baseline || (fs.existsSync(baselinePath) ? read(baselinePath) : {
  count: existingRows.length,
  rowsSha256: digest(JSON.stringify(existingRows)),
  runtimeFileSha256: digest(fs.readFileSync(runtimePath))
});
assert.ok(existingRows.length >= baseline.count, "Catalogue has fewer rows than the frozen baseline");
assert.equal(digest(JSON.stringify(existingRows.slice(0, baseline.count))), baseline.rowsSha256, "Frozen baseline was changed");
if (!fs.existsSync(baselinePath)) write(baselinePath, baseline);

const result = appendManufacturerFoods({ existingRows, candidates });
assert.deepEqual(result.rows.slice(0, existingRows.length), existingRows, "Import must be append-only");
assert.equal(result.rows.length, existingRows.length + result.added.length);
assert.equal(new Set(result.rows.map(row => row[0])).size, result.rows.length, "Duplicate catalogue ids");
const candidateById = new Map();
for (const candidate of candidates) {
  try {
    const id = manufacturerFoodId(candidate);
    if (!candidateById.has(id)) candidateById.set(id, candidate);
  } catch { /* Invalid candidates are already recorded by the validator. */ }
}
const newSources = result.added.map(row => {
  const candidate = candidateById.get(row[0]);
  assert.ok(candidate, `Missing provenance for ${row[0]}`);
  return { id: row[0], ...candidate, sourceType: "manufacturer" };
});
const provenance = {
  schemaVersion: 1,
  baseline,
  records: [...(previousSources?.records || []), ...newSources]
};
assert.equal(new Set(provenance.records.map(row => row.id)).size, provenance.records.length, "Duplicate provenance ids");
const runtime = JSON.stringify(result.rows);
const {manifest} = buildPersonalSearchCatalog({rows: result.rows});
const report = {
  schemaVersion: 1,
  checkedAt: new Date().toISOString(),
  mode: apply ? "Применение к локальному каталогу" : "Предварительная проверка без изменения каталога",
  publication: "Скрипт не публикует данные и не обращается к Firebase",
  baseline,
  previousCount: existingRows.length,
  candidateCount: candidates.length,
  addedCount: result.added.length,
  resultCount: result.rows.length,
  preservedExistingRows: true,
  runtimeSha256: digest(runtime + "\n"),
  manifestHash: manifest.hash,
  inputs: sourceFiles.map(file => ({ path: path.relative(root, path.join(inputDirectory, file)).replaceAll("\\", "/"), sha256: digest(fs.readFileSync(path.join(inputDirectory, file))) })),
  added: newSources,
  duplicates: result.duplicates,
  suspected: result.suspected,
  rejected: result.rejected,
  notes: [
    "Белорусский производитель не означает подтверждённый рынок продажи: market новых записей остаётся unknown.",
    "Старые карточки, их идентификаторы, КБЖУ, aliases и порядок не меняются.",
    "Сомнительные совпадения не добавляются автоматически; разные вкусы и жирность не объединяются по одинаковому КБЖУ.",
    "Атрибуция прежнего слоя Open Food Facts сохраняется; новые данные явно отмечены как сведения производителя."
  ]
};
if (apply && result.added.length) {
  fs.writeFileSync(runtimePath, runtime + "\n");
  write(sourcesPath, provenance);
  buildPersonalSearchCatalog({rows: result.rows, apply: true});
}
write(path.join(outputDirectory, reportName), report);
console.log(JSON.stringify({ mode: report.mode, previousCount: report.previousCount, candidates: candidates.length,
  added: result.added.length, duplicates: result.duplicates.length, suspected: result.suspected.length,
  rejected: result.rejected.length, resultCount: result.rows.length,
  report: path.relative(root, path.join(outputDirectory, reportName)).replaceAll("\\", "/") }, null, 2));
