import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { nutritionFoodDatabase } from "../src/data/nutritionFoods.js";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fdcIdFromUrl = (url = "") => String(url).match(/food-details\/(\d+)/u)?.[1] || "";

test("legacy suggestions are source-backed reference foods without synthetic barcodes", async () => {
  const source = JSON.parse(await readFile(
    path.join(workspace, "data", "nutrition-catalog-sources", "usda-sr-legacy-reference.json"),
    "utf8"
  ));
  const referenceById = new Map(source.records.map((record) => [record.source.recordId, record]));

  nutritionFoodDatabase.forEach((food) => {
    const sourceRecord = referenceById.get(fdcIdFromUrl(food.sourceUrl));
    assert.ok(sourceRecord, `missing USDA source record for ${food.id}`);
    assert.equal(food.barcode, undefined);
    assert.equal(food.recordType, "reference_food");
    assert.equal(food.name, sourceRecord.name);
    assert.equal(food.calories, sourceRecord.nutrition.calories);
    assert.equal(food.protein, sourceRecord.nutrition.protein);
    assert.equal(food.fat, sourceRecord.nutrition.fat);
    assert.equal(food.carbs, sourceRecord.nutrition.carbs);
  });
});
