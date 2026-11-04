import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { nutritionProblems, normalize } from "./lib/belarusPersonalCatalog.mjs";

const root = new URL("../", import.meta.url);
const input = new URL("data/nutrition-catalog-sources/basic-foods-2026-10-29.json", root);
const outputs = [new URL("src/data/nutrition-catalog/basicFoods.compact.json", root), new URL("public/nutrition-catalog/personal/basic-sources.json", root)];
const source = JSON.parse(fs.readFileSync(input, "utf8"));
assert.equal(source.schemaVersion, 1);
assert.ok(source.records.length >= 80, "Нужен полный базовый набор, а не несколько примеров");
const seen = new Set(), identities = new Set();
const rows = source.records.map(record => {
  assert.ok(!seen.has(record.id)); seen.add(record.id);
  assert.match(record.id, /^basic-usda-\d+$/);
  assert.equal(record.brand, "");
  assert.equal(record.nutrition.basis, "100g");
  assert.deepEqual(nutritionProblems(record.nutrition), [], record.name);
  assert.ok(["raw", "dry", "cooked", "ready"].includes(record.state), record.name);
  assert.match(record.source.url, /^https:\/\/fdc\.nal\.usda\.gov\//);
  const identity = `${normalize(record.name)}|${record.state}`;
  assert.ok(!identities.has(identity), record.name); identities.add(identity);
  const n = record.nutrition;
  return [record.id, record.name, "", record.category, n.kcal, n.protein, n.fat, n.carbs, n.basis, record.aliases, [], "unknown", "reference", false, record.source.url, record.source.title, record.state];
});
const apply = process.argv.includes("--apply");
if (apply) {
  fs.writeFileSync(outputs[0], `${JSON.stringify(rows)}\n`);
  fs.writeFileSync(outputs[1], `${JSON.stringify(source, null, 2)}\n`);
}
console.log(JSON.stringify({mode: apply ? "Базовый слой записан" : "Проверка без записи", count: rows.length, outputs: outputs.map(fileURLToPath)}, null, 2));
