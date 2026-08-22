import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildNutritionCatalog,
  CatalogValidationError,
  validateGtin,
  writeNutritionCatalog
} from "../scripts/build-nutrition-catalog.mjs";

function gtin13(body) {
  let sum = 0;
  for (let index = body.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    sum += Number(body[index]) * (position % 2 === 0 ? 3 : 1);
  }
  return `${body}${(10 - (sum % 10)) % 10}`;
}

function verifiedSku({ barcode, name, brand, aliases = [], verificationStatus = "label_photo_present" }) {
  return {
    name,
    brand,
    barcode,
    aliases,
    category: "Тест",
    quantity: "200 г",
    nutrition: {
      basis: "100g",
      calories: 202,
      protein: 2.6,
      fat: 20,
      carbs: 2.9
    },
    source: {
      kind: "test-source",
      recordId: `record-${barcode}`,
      url: `https://example.test/products/${barcode}`,
      exportUrl: "https://example.test/exports/products.csv",
      retrievedAt: "2026-08-02T12:00:00Z",
      sourceUpdatedAt: "2026-08-01T12:00:00Z",
      license: "Test license",
      marketScope: "belarus",
      marketTags: ["en:belarus"]
    },
    verification: {
      status: verificationStatus,
      method: "label-photo",
      verifiedAt: "2026-08-02T12:00:00Z",
      evidenceUrl: `https://example.test/evidence/${barcode}`
    }
  };
}

test("catalog builder emits exact-array, prefix, token, and barcode indexes", async (t) => {
  const firstBarcode = gtin13("481000000001");
  const secondBarcode = gtin13("481000000002");
  const catalog = buildNutritionCatalog({
    generatedAt: "2026-08-02T12:00:00.000Z",
    records: [
      verifiedSku({
        barcode: firstBarcode,
        name: "Сметана классическая 20%",
        brand: "Марка А",
        aliases: ["сметана"]
      }),
      verifiedSku({
        barcode: secondBarcode,
        name: "Сметана фермерская 20%",
        brand: "Марка Б",
        aliases: ["сметана"],
        verificationStatus: "verified"
      })
    ]
  }, { minRecords: 2 });

  const exact = catalog.artifacts["alias-exact-index.json"];
  const prefix = catalog.artifacts["alias-prefix-index.json"];
  const tokens = catalog.artifacts["search-token-index.json"];
  const barcodes = catalog.artifacts["barcode-index.json"];
  const compact = catalog.artifacts["foods.compact.json"];

  assert.deepEqual(exact.сметана, [`sku-${firstBarcode}`, `sku-${secondBarcode}`].sort());
  assert.deepEqual(prefix.смет, [`sku-${firstBarcode}`, `sku-${secondBarcode}`].sort());
  assert.deepEqual(tokens.сметана, [`sku-${firstBarcode}`, `sku-${secondBarcode}`].sort());
  assert.equal(barcodes[firstBarcode], `sku-${firstBarcode}`);
  assert.match(compact[0].x, /сметана/);
  assert.equal(compact[0].p1000, 2600);
  assert.equal(catalog.artifacts["provenance.json"][`sku-${firstBarcode}`].source.exportUrl, "https://example.test/exports/products.csv");
  assert.deepEqual(catalog.artifacts["provenance.json"][`sku-${firstBarcode}`].source.marketTags, ["en:belarus"]);

  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nutrition-catalog-builder-"));
  const output = path.join(temporaryRoot, "catalog");
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));

  await writeNutritionCatalog(output, catalog);
  const writtenExact = JSON.parse(await fs.readFile(path.join(output, "alias-exact-index.json"), "utf8"));
  const writtenTokenIndex = JSON.parse(await fs.readFile(path.join(output, "search-token-index.json"), "utf8"));

  assert.deepEqual(writtenExact.сметана, exact.сметана);
  assert.deepEqual(writtenTokenIndex.сметана, tokens.сметана);
});

test("catalog builder rejects invalid GTINs, estimates, missing provenance, and duplicate SKUs", () => {
  const validBarcode = gtin13("481000000003");
  assert.equal(validateGtin(validBarcode), true);
  assert.equal(validateGtin(`${validBarcode.slice(0, -1)}9`), false);

  const invalid = verifiedSku({
    barcode: validBarcode,
    name: "Тестовый продукт",
    brand: "Марка"
  });
  invalid.nutrition.estimated = true;
  invalid.source.url = "";

  const duplicate = verifiedSku({
    barcode: validBarcode,
    name: "Тестовый продукт 2",
    brand: "Марка 2"
  });

  assert.throws(
    () => buildNutritionCatalog({ records: [invalid, duplicate] }),
    (error) => error instanceof CatalogValidationError
      && error.errors.some((item) => item.includes("must not contain estimates"))
      && error.errors.some((item) => item.includes("source.url must be a non-empty string"))
      && error.errors.some((item) => item.includes("duplicates records[0].barcode"))
  );
});

test("catalog builder keeps source-backed reference foods separate from GTIN SKUs", () => {
  const sourceUrl = "https://fdc.nal.usda.gov/fdc-app.html#/food-details/173944/nutrients";
  const catalog = buildNutritionCatalog({
    records: [{
      recordType: "reference_food",
      name: "Bananas, raw",
      brand: "",
      nutrition: {
        basis: "100g",
        calories: 89,
        protein: 1.09,
        fat: 0.33,
        carbs: 22.8
      },
      source: {
        kind: "USDA FoodData Central",
        recordId: "173944",
        url: sourceUrl,
        retrievedAt: "2026-08-02T12:00:00Z",
        license: "Public domain"
      },
      verification: {
        status: "source_record",
        method: "official_food_composition_record",
        verifiedAt: "2026-08-02T12:00:00Z",
        evidenceUrl: sourceUrl
      }
    }]
  });

  const full = catalog.artifacts["foods.full.json"];
  const compact = catalog.artifacts["foods.compact.json"];
  const barcodeIndex = catalog.artifacts["barcode-index.json"];

  assert.equal(full[0].recordType, "reference_food");
  assert.equal(full[0].barcode, "");
  assert.equal(compact[0].rt, "reference_food");
  assert.equal("bc" in compact[0], false);
  assert.deepEqual(barcodeIndex, {});
});
