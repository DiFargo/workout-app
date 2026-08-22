import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CatalogArtifactValidationError,
  validateCatalogDirectory,
  validateCatalogSources
} from "../scripts/validate-nutrition-catalog.mjs";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const currentReferenceCatalog = path.join(workspace, "public", "nutrition-catalog", "reference");

function validReferenceArtifacts() {
  const id = "ref-test-source-100";
  const source = {
    kind: "Test composition source",
    recordId: "100",
    url: "https://example.test/food/100",
    retrievedAt: "2026-08-02T00:00:00.000Z",
    license: "CC0-1.0",
    marketScope: "global_reference"
  };
  const verification = {
    status: "source_record",
    method: "official_source_record",
    verifiedAt: "2026-08-02T00:00:00.000Z",
    evidenceUrl: "https://example.test/food/100"
  };
  const fullFood = {
    id,
    recordType: "reference_food",
    name: "Test food",
    brand: "",
    barcode: "",
    category: "Test category",
    quantity: "",
    basisUnit: "g",
    calories: 20,
    protein: 1.5,
    fat: 0.5,
    carbs: 3.5,
    aliases: ["test"],
    searchableText: "test food",
    source,
    verification
  };

  return {
    "foods.full.json": [fullFood],
    "foods.compact.json": [{
      id,
      rt: "reference_food",
      n: "Test food",
      b: "",
      c: "Test category",
      a: ["test"],
      u: "g",
      k1000: 20000,
      p1000: 1500,
      f1000: 500,
      h1000: 3500,
      x: "test food",
      pr: id
    }],
    "alias-exact-index.json": { "test food": [id], test: [id] },
    "alias-prefix-index.json": { te: [id], tes: [id], test: [id] },
    "search-token-index.json": { test: [id], food: [id] },
    "barcode-index.json": {},
    "provenance.json": { [id]: { source, verification } },
    "catalog.meta.json": {
      schemaVersion: "nutrition-catalog-verified-v2",
      generatedAt: "2026-08-02T00:00:00.000Z",
      productCount: 1,
      minimumRequiredRecords: 1,
      sourceKinds: ["Test composition source"],
      compactNutritionScale: 1000
    }
  };
}

async function writeArtifacts(directory, artifacts) {
  await Promise.all(Object.entries(artifacts).map(([filename, contents]) => (
    writeFile(path.join(directory, filename), `${JSON.stringify(contents, null, 2)}\n`, "utf8")
  )));
}

test("v2 artifact validator accepts the current USDA reference catalog", async () => {
  const report = await validateCatalogSources({ referenceDirectory: currentReferenceCatalog });

  assert.equal(report.totalProductCount, 7500);
  assert.equal(report.totalBarcodeCount, 0);
  assert.deepEqual(report.layers[0].recordTypeCounts, { sku: 0, reference_food: 7500 });
});

test("v2 artifact validator rejects an index that targets a missing product", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nutrition-catalog-validator-"));
  const artifacts = validReferenceArtifacts();
  artifacts["alias-exact-index.json"].test = ["ref-missing"];

  try {
    await writeArtifacts(directory, artifacts);
    await assert.rejects(
      () => validateCatalogDirectory(directory),
      (error) => error instanceof CatalogArtifactValidationError
        && error.errors.some((issue) => issue.includes("alias-exact-index.json") && issue.includes("ref-missing"))
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
