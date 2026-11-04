import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";
import {createPersonalCatalogSearch} from "../src/utils/personalCatalogSearch.js";
import {unpackPersonalCatalogRow} from "../src/utils/personalCatalogRows.js";
import {toPersonalNutritionFood} from "../src/utils/personalNutritionFood.js";
import {isPersonalCatalogRowSearchable} from "../scripts/lib/personalCatalogQuarantine.mjs";
import {searchBundledNutritionFallbackFoods, mergeNutritionFoodResults} from "../src/utils/localNutritionCatalog.js";

const read = file => JSON.parse(fs.readFileSync(new URL(`../${file}`, import.meta.url)));
const stored = read("public/nutrition-catalog/personal/products.json");
const manifest = read("src/data/nutrition-catalog/personalCatalogManifest.json");
const payload = read(`public${manifest.url}`);
const basics = read("src/data/nutrition-catalog/basicFoods.compact.json");
const search = createPersonalCatalogSearch([...stored, ...basics].map(unpackPersonalCatalogRow));

test("general search payload excludes quarantine while preserving the complete archive", () => {
  assert.deepEqual(payload, stored.filter(row => isPersonalCatalogRowSearchable(row)));
  assert.equal(manifest.storedCount, stored.length);
  assert.equal(manifest.quarantinedCount, 2701);
  assert.equal(manifest.count, payload.length);
  assert.equal(manifest.hash, createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16));
  for (const row of stored.filter(row => !isPersonalCatalogRowSearchable(row))) {
    for (const barcode of row[10]) assert.ok(!search(barcode).items.some(result => result.id === row[0]));
  }
});

test("150 curated basics copy the original USDA values and source IDs without invented brands", () => {
  const source = read("data/nutrition-catalog-sources/usda-sr-legacy-reference-expanded.json");
  const sourceById = new Map(source.records.map(record => [String(record.source.recordId), record]));
  const reference = read("public/nutrition-catalog/reference/foods.full.json");
  const referenceById = new Map(reference.map(record => [String(record.source.recordId), record]));
  assert.equal(basics.length, 150);
  assert.equal(new Set(basics.map(row => row[0])).size, 150);
  for (const row of basics) {
    const id = row[0].replace("basic-usda-", ""), original = sourceById.get(id), ref = referenceById.get(id);
    assert.ok(original); assert.ok(ref); assert.equal(row[2], ""); assert.equal(row[8], "100g");
    assert.deepEqual(row.slice(4, 8), [original.nutrition.calories, original.nutrition.protein, original.nutrition.fat, original.nutrition.carbs]);
    assert.deepEqual(row.slice(4, 8), [ref.calories, ref.protein, ref.fat, ref.carbs]);
    assert.equal(row[14], original.source.url);
  }
  assert.ok(!basics.some(row => /cottage/i.test(row[15]) && /творог/i.test(row[1])));
});

test("plain food queries surface reliable basics and distinguish dry, raw and cooked states", () => {
  assert.equal(search("бананы").items[0].id, "basic-usda-173944");
  assert.ok(search("каши").items.some(row => row.id === "basic-usda-173905"));
  assert.equal(search("гречка вареная").items[0].id, "basic-usda-170686");
  const rawRice = search("рис сырой").items;
  assert.ok(rawRice.length > 0);
  assert.ok(rawRice.every(row => row.sourceType === "reference" && row.state === "dry"));
  assert.ok(search("рис вареный").items.filter(row => row.sourceType === "reference").every(row => row.state === "cooked"));
  assert.ok(search("куриная грудка сырая").items.filter(row => row.sourceType === "reference").every(row => row.state === "raw"));
  assert.ok(search("куриная грудка вареная").items.every(row => !/сыр[аоы]/i.test(row.name)));
});

test("canonical brand spellings, fat percentage, layout and one typo remain precise", () => {
  const ids = query => search(query).items.map(row => row.id);
  assert.deepEqual(ids("свежа"), ids("SVEŽA"));
  assert.deepEqual(ids("теос"), ids("TEOS"));
  assert.ok(search("теос йогурт 2%").items.some(row => row.id === "sku-4810268031793"));
  assert.ok(search("мюсли").total > 1);
  assert.ok(search("йогурт греческий").total > 1);
  assert.ok(search("свежа").items.every(row => /sve[žz]a|свежа|свеза/i.test(`${row.brand} ${row.name}`)));
  assert.deepEqual(ids("творог 5%"), ids("творог 5,0%"));
  assert.deepEqual(ids("творог 5%"), ids("творог 5 %"));
  assert.deepEqual(ids("творог"), ids("ndjhju"));
  assert.ok(search("твроог").total > 0);
  assert.ok(search("uhtrrf").total > 0);
  assert.ok(search("творог савушкн").items.every(row => /савушкин/i.test(row.brand)));
  assert.equal(search("4810268031793").total, 1);
  assert.equal(search("4810268031794").total, 0);
  assert.equal(search("zzzzzzzzzzzzzzzzzz").total, 0);
});

test("brand absence is explicit and never presents a generic food as that brand", () => {
  const result = search("каша беллакт");
  assert.ok(result.genericFallback);
  assert.ok(result.items.every(row => row.sourceType === "reference" && !row.brand && row.searchFallback));
  assert.ok(result.items.map(toPersonalNutritionFood).every(food => food.searchFallback && food.sourceType === "basic_reference"));
  assert.equal(search("банан шоколадный неизвестныйбренд").total, 0);
  const exactBrand = search("савушкин молоко");
  assert.ok(exactBrand.total > 0);assert.equal(exactBrand.genericFallback, false);
  assert.ok(exactBrand.items.every(row => !row.searchFallback));
});

test("instant suggestions work offline and remain in the complete ranked results", () => {
  for (const query of ["банан", "рис", "гречка", "каша", "яйцо", "молоко", "масло"]) {
    const instant = searchBundledNutritionFallbackFoods(query);
    assert.ok(instant.length, query);
    const complete = search(query).items.map(toPersonalNutritionFood);
    const merged = mergeNutritionFoodResults(complete, instant);
    assert.ok(merged.some(food => food.sourceType === "basic_reference"), query);
    assert.equal(new Set(merged.map(food => food.id)).size, merged.length);
  }
});

test("indexed first and repeated queries stay within the interactive CPU budget on this host", () => {
  const find = createPersonalCatalogSearch([...payload, ...basics].map(unpackPersonalCatalogRow));
  const queries = ["ба", "банан", "каши", "рис сырой", "гречка вареная", "савушкин творог", "свежа", "твроог", "ndjhju", "uhtrrf", "абсолютнонесуществующийпродукт"];
  const first = [], cached = [];
  for (const query of queries) {let start = performance.now();find(query);first.push(performance.now() - start);start = performance.now();find(query);cached.push(performance.now() - start);}
  assert.ok(Math.max(...first) < 100, `First query CPU: ${Math.max(...first)}ms`);
  assert.ok(Math.max(...cached) < 20, `Cached query CPU: ${Math.max(...cached)}ms`);
});
