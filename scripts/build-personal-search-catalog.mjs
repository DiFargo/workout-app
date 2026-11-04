import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPersonalCatalogRowSearchable } from "./lib/personalCatalogQuarantine.mjs";

const root = new URL("../", import.meta.url);
export function buildPersonalSearchCatalog({apply = false, rows} = {}) {
  const storedRows = rows || JSON.parse(fs.readFileSync(new URL("public/nutrition-catalog/personal/products.json", root), "utf8"));
  assert.ok(Array.isArray(storedRows) && storedRows.length >= 10000);
  const searchable = storedRows.filter(row => isPersonalCatalogRowSearchable(row));
  const serialized = JSON.stringify(searchable);
  const manifest = {count: searchable.length, storedCount: storedRows.length, quarantinedCount: storedRows.length - searchable.length,
    url: "/nutrition-catalog/personal/search-products.json", hash: crypto.createHash("sha256").update(serialized).digest("hex").slice(0, 16)};
  if (apply) {
    fs.writeFileSync(new URL("public/nutrition-catalog/personal/search-products.json", root), `${serialized}\n`);
    fs.writeFileSync(new URL("src/data/nutrition-catalog/personalCatalogManifest.json", root), `${JSON.stringify(manifest)}\n`);
  }
  return {manifest, rows: searchable, serialized};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {manifest} = buildPersonalSearchCatalog({apply: process.argv.includes("--apply")});
  console.log(JSON.stringify(manifest, null, 2));
}
