import assert from "node:assert/strict";
import test from "node:test";
import { createNutritionDayHandlers } from "../src/features/client/nutrition/nutritionDayHandlers.js";
import { addFoodByBarcodeFromPickerWithDeps } from "../src/features/client/nutrition/nutritionFlowMiscHandlers.js";

const barcode = "4812345678900";
const catalogFood = {
  id: `sku-${barcode}`,
  barcode,
  name: "Verified catalog product",
  calories: 120,
  protein: 5,
  fat: 4,
  carbs: 12
};

test("camera barcode handler resolves a fresh catalog lookup instead of stale input state", async () => {
  const searches = [];
  const clearedCodes = [];
  const lookups = [];
  const handlers = createNutritionDayHandlers({
    nutritionBarcode: "",
    nutritionDateKey: "2026-08-02",
    nutritionFoodDatabase: [],
    nutritionPhotoName: "",
    addNutritionFood: () => assert.fail("lookup must return food for the scanner to add"),
    findCatalogFoodByBarcode: async (value) => {
      lookups.push(value);
      return catalogFood;
    },
    setExpandedNutritionMeals: () => {},
    setNutrition: () => {},
    setNutritionBarcode: (value) => clearedCodes.push(value),
    setNutritionCalendarMonthKey: () => {},
    setNutritionCalendarOpen: () => {},
    setNutritionSearch: (value) => searches.push(value),
    setSelectedNutritionDateKey: () => {}
  });

  const found = await handlers.findFoodByBarcode(barcode);

  assert.equal(found, catalogFood);
  assert.deepEqual(lookups, [barcode]);
  assert.deepEqual(searches, [catalogFood.name]);
  assert.deepEqual(clearedCodes, [""]);
});

test("manual barcode picker adds a source-backed catalog SKU", async () => {
  const added = [];
  const errors = [];
  const scannerOpen = [];
  const codes = [];

  await addFoodByBarcodeFromPickerWithDeps({
    nutritionBarcode: barcode,
    nutritionFoodDatabase: [],
    findCatalogFoodByBarcode: async (value) => (value === barcode ? catalogFood : null),
    addNutritionFoodFromPicker: (food) => added.push(food),
    setBarcodeScannerError: (value) => errors.push(value),
    setBarcodeScannerOpen: (value) => scannerOpen.push(value),
    setNutritionBarcode: (value) => codes.push(value)
  });

  assert.deepEqual(added, [catalogFood]);
  assert.deepEqual(errors, [""]);
  assert.deepEqual(scannerOpen, [false]);
  assert.deepEqual(codes, [""]);
});
