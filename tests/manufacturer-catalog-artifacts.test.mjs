import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { appendManufacturerFoods, manufacturerFoodId } from "../scripts/lib/appendManufacturerFoods.mjs";
import { createSearch, nutritionProblems } from "../scripts/lib/belarusPersonalCatalog.mjs";

const read = file => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const rows = read("public/nutrition-catalog/personal/products.json");
const provenance = read("public/nutrition-catalog/personal/manufacturer-sources.json");
const manifest = read("src/data/nutrition-catalog/personalCatalogManifest.json");
const searchRows = read(`public${manifest.url}`);
const candidateDirectory = new URL("../data/nutrition-catalog-sources/belarus-manufacturers-2026-10-29/", import.meta.url);
const candidates = readdirSync(candidateDirectory).filter(file => file.endsWith(".json")).sort().flatMap(file => read(`data/nutrition-catalog-sources/belarus-manufacturers-2026-10-29/${file}`));
const sha = value => createHash("sha256").update(value).digest("hex");
const unpack = ([id, name, brand, category, kcal, protein, fat, carbs, basis, aliases, barcodes, market, sourceType, nutritionConflict, sourceUrl]) => ({
  id, name, brand, category, nutrition: { kcal, protein, fat, carbs, basis }, aliases, barcodes, market, sourceType, nutritionConflict, sourceUrl
});

test("expanded runtime preserves the frozen baseline and every new card has manufacturer provenance", () => {
  assert.equal(sha(JSON.stringify(rows.slice(0, provenance.baseline.count))), provenance.baseline.rowsSha256);
  assert.equal(new Set(rows.map(row => row[0])).size, rows.length);
  assert.equal(rows.length, manifest.storedCount);
  assert.equal(searchRows.length, manifest.count);
  assert.equal(sha(JSON.stringify(searchRows)).slice(0, 16), manifest.hash);
  assert.equal(rows.length, provenance.baseline.count + provenance.records.length);
  const byId = new Map(provenance.records.map(record => [record.id, record]));
  for (const row of rows.slice(provenance.baseline.count)) {
    const record = byId.get(row[0]);
    assert.ok(record); assert.equal(row[0], manufacturerFoodId(record));
    assert.equal(row[12], "manufacturer"); assert.equal(row[8], "100g");
    assert.equal(record.manufacturerCountry, "BY"); assert.equal(row[11], "unknown");
    assert.equal(row[14], record.source.url); assert.deepEqual(nutritionProblems(record.nutrition), []);
    assert.deepEqual(row.slice(4, 8), [record.nutrition.kcal, record.nutrition.protein, record.nutrition.fat, record.nutrition.carbs]);
    assert.match(row[15], /^Производитель: /);
  }
});

test("reimport adds no duplicates, does not mutate rows and keeps unresolved similarities out", () => {
  const frozen = JSON.stringify(rows);
  const result = appendManufacturerFoods({ existingRows: rows, candidates });
  assert.equal(result.added.length, 0); assert.equal(result.rejected.length, 0);
  assert.equal(result.duplicates.length, provenance.records.length);
  assert.equal(JSON.stringify(result.rows), frozen); assert.equal(JSON.stringify(rows), frozen);
  const publishedNames = new Set(provenance.records.map(record => record.name));
  assert.ok(result.suspected.every(record => !publishedNames.has(record.name)));
});

test("new official products, Cyrillic/Latin brand spellings and old barcode search remain responsive", () => {
  const search = createSearch(rows.map(unpack));
  const byId = new Map(rows.map(row => [row[0], row]));
  for (const record of provenance.records) {
    assert.ok(search(`${record.name} ${record.brand}`).items.some(item => item.id === record.id), record.name);
  }
  const sveza = provenance.records.find(record => record.brand === "SVEŽA");
  assert.ok(search(`свежа ${sveza.name}`).items.some(item => item.id === sveza.id));
  assert.ok(search(`sveza ${sveza.name}`).items.some(item => item.id === sveza.id));
  const ganna = provenance.records.find(record => record.brand === "Ганна");
  assert.ok(search(`ganna ${ganna.name}`).items.some(item => item.id === ganna.id));
  const old = rows.find(row => row[10].length);
  assert.equal(search(old[10][0]).items[0].id, old[0]); assert.ok(byId.has(old[0]));
  const durations = ["теос", "свежа", "sveza", "ганна", "ganna", "брест литовск", "творог", "колбаса", "йогурт", "ndjhju", "твроог"].map(query => {
    const start = performance.now(); search(query); return performance.now() - start;
  }).sort((a, b) => a - b);
  assert.ok(durations.at(-1) < 150, `Expanded catalogue query: ${durations.at(-1)} ms`);
});
