import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const importer = path.join(workspace, "scripts", "import-openfoodfacts-catalog.mjs");
const csvFixture = path.join(workspace, "tests", "fixtures", "openfoodfacts-small.csv");

test("Open Food Facts importer accepts a quoted CSV export without requiring a photo", async () => {
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), "off-import-test-"));
  const output = path.join(outputDirectory, "catalog.json");

  try {
    execFileSync(process.execPath, [
      importer,
      "--input", csvFixture,
      "--output", output,
      "--format", "csv",
      "--source-url", "https://mirabelle.openfoodfacts.org/products.csv",
      "--limit", "1",
      "--min-records", "1",
      "--markets", "belarus,russia"
    ], { encoding: "utf8" });

    const catalog = JSON.parse(await readFile(output, "utf8"));
    assert.equal(catalog.records.length, 1);
    assert.equal(catalog.records[0].barcode, "3017620422003");
    assert.equal(catalog.records[0].name, "Nutella, hazelnut spread");
    assert.deepEqual(catalog.records[0].nutrition, {
      basis: "100g",
      calories: 539,
      protein: 6.3,
      fat: 30.9,
      carbs: 57.5
    });
    assert.equal(catalog.records[0].verification.status, "source_record");
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
});
