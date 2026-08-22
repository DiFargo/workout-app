import assert from "node:assert/strict";
import test from "node:test";
import { buildNutritionCatalog } from "../scripts/build-nutrition-catalog.mjs";
import {
  searchLocalizedNutritionCatalog,
  searchLocalNutritionCatalog
} from "../src/data/nutrition-catalog/catalogSearch.js";
import { expandRussianNutritionQuery } from "../src/data/nutrition-catalog/russianSearchLexicon.js";

test("v2 catalog search reads scaled macros and exact index arrays", () => {
  const sourceUrl = "https://fdc.nal.usda.gov/fdc-app.html#/food-details/173944/nutrients";
  const { artifacts } = buildNutritionCatalog({
    records: [{
      recordType: "reference_food",
      name: "Bananas, raw",
      aliases: ["\u0431\u0430\u043d\u0430\u043d", "\u0431\u0430\u043d\u0430\u043d\u044b"],
      nutrition: {
        basis: "100g",
        calories: 89,
        protein: 1.09,
        fat: 0.33,
        carbs: 22.8
      },
      source: {
        kind: "USDA FoodData Central SR Legacy",
        recordId: "173944",
        url: sourceUrl,
        retrievedAt: "2026-08-02T12:00:00Z",
        license: "CC0-1.0"
      },
      verification: {
        status: "source_record",
        method: "official_food_composition_record",
        verifiedAt: "2026-08-02T12:00:00Z",
        evidenceUrl: sourceUrl
      }
    }]
  });

  const results = searchLocalNutritionCatalog(
    "\u0431\u0430\u043d\u0430\u043d",
    artifacts["foods.compact.json"],
    artifacts["alias-prefix-index.json"],
    artifacts["alias-exact-index.json"],
    10,
    artifacts["search-token-index.json"]
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].recordType, "reference_food");
  assert.equal(results[0].calories, 89);
  assert.equal(results[0].protein, 1.09);
  assert.equal(results[0].fat, 0.33);
  assert.equal(results[0].carbs, 22.8);
  assert.equal(results[0].barcode, "");
});

test("catalog search does not downgrade an unknown word to a two-letter match", () => {
  const foods = [{
    id: "ref-test-carrot",
    rt: "reference_food",
    n: "Carrots, raw",
    a: ["\u043c\u043e\u0440\u043a\u043e\u0432\u044c"],
    u: "g",
    k1000: 41000,
    p1000: 930,
    f1000: 240,
    h1000: 9580,
    x: "carrots raw \u043c\u043e\u0440\u043a\u043e\u0432\u044c",
    pr: "ref-test-carrot"
  }];

  const results = searchLocalNutritionCatalog(
    "\u043c\u043e\u043b\u043e\u043a\u043e",
    foods,
    { "\u043c\u043e": ["ref-test-carrot"], "\u043c\u043e\u0440": ["ref-test-carrot"] },
    {},
    10,
    { "\u043c\u043e\u0440\u043a\u043e\u0432\u044c": ["ref-test-carrot"] }
  );

  assert.deepEqual(results, []);
});

test("Russian nutrition search expands food terms without changing source names", () => {
  const sourceUrl = "https://fdc.nal.usda.gov/fdc-app.html#/food-details/1/nutrients";
  const makeFood = (recordId, name, category) => ({
    recordType: "reference_food",
    name,
    category,
    nutrition: { basis: "100g", calories: 100, protein: 10, fat: 5, carbs: 10 },
    source: {
      kind: "USDA FoodData Central SR Legacy",
      recordId,
      url: sourceUrl.replace("/1/", `/${recordId}/`),
      retrievedAt: "2026-08-02T12:00:00Z",
      license: "CC0-1.0"
    },
    verification: {
      status: "source_record",
      method: "official_food_composition_record",
      verifiedAt: "2026-08-02T12:00:00Z",
      evidenceUrl: sourceUrl.replace("/1/", `/${recordId}/`)
    }
  });
  const { artifacts } = buildNutritionCatalog({
    records: [
      makeFood("101", "Chicken, broilers or fryers, breast, meat only, raw", "Poultry Products"),
      makeFood("102", "Ground beef, 90% lean meat / 10% fat, raw", "Beef Products"),
      makeFood("105", "Prepared dinner", "Beef Products"),
      makeFood("103", "Cookies, chocolate chip, commercially prepared", "Baked Products"),
      makeFood("104", "Coca-Cola, cola", "Beverages")
    ]
  });
  const foods = artifacts["foods.compact.json"];
  const prefix = artifacts["alias-prefix-index.json"];
  const exact = artifacts["alias-exact-index.json"];
  const tokens = artifacts["search-token-index.json"];

  const chicken = searchLocalizedNutritionCatalog("куриная грудка", foods, prefix, exact, 8, tokens);
  const beef = searchLocalizedNutritionCatalog("говядина", foods, prefix, exact, 8, tokens);
  const cookies = searchLocalizedNutritionCatalog("печенье", foods, prefix, exact, 8, tokens);
  const cola = searchLocalizedNutritionCatalog("кока кола", foods, prefix, exact, 8, tokens);
  const english = searchLocalizedNutritionCatalog("chicken breast", foods, prefix, exact, 8, tokens);

  assert.match(chicken[0].name, /^Chicken,/);
  assert.match(beef[0].name, /^Ground beef,/);
  assert.ok(beef.some((food) => food.name === "Prepared dinner"));
  assert.match(cookies[0].name, /^Cookies,/);
  assert.match(cola[0].name, /^Coca-Cola,/);
  assert.match(english[0].name, /^Chicken,/);
});

test("Russian search lexicon keeps unknown terms unexpanded", () => {
  assert.deepEqual(expandRussianNutritionQuery("несуществующийпродукт"), []);
  assert.ok(expandRussianNutritionQuery("овсянка").includes("oats"));
  assert.deepEqual(expandRussianNutritionQuery("Coca-Cola"), []);
});
