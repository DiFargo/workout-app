import test from "node:test";
import assert from "node:assert/strict";
import { matchesAdminCatalogSearch, normalizeAdminCatalogText } from "../src/components/admin/adminCatalogSearch.js";

test("admin catalogue search ignores word order, punctuation and ё", () => {
  assert.equal(matchesAdminCatalogSearch("Сгибание ног в тренажёре · Ноги", "ног ТРЕНАЖЕРЕ"), true);
  assert.equal(matchesAdminCatalogSearch("Тяга нижнего блока", "блока тяга"), true);
  assert.equal(matchesAdminCatalogSearch("Жим лёжа", "жим ногами"), false);
});

test("admin catalogue search supports empty queries and missing metadata", () => {
  assert.equal(matchesAdminCatalogSearch(null, " "), true);
  assert.equal(matchesAdminCatalogSearch(null, "жим"), false);
  assert.equal(normalizeAdminCatalogText("  День №2 — НОГИ "), "день 2 ноги");
});
