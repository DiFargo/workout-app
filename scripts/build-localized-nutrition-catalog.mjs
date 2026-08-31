#!/usr/bin/env node

/**
 * Builds the runtime nutrition layers shown to Russian-speaking users.
 *
 * - Existing catalog entries keep their original source, evidence and macros.
 * - English-only display names are localized for the UI; the original title
 *   remains an alias so English search still works.
 * - The compact Open Food Facts source supplies Russian-localized product
 *   titles, valid numeric product codes and complete 100 g nutrition values.
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildNutritionCatalog, writeNutritionCatalog } from "./build-nutrition-catalog.mjs";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const referenceInput = path.join(workspace, "public/nutrition-catalog/reference/foods.full.json");
const skuInput = path.join(workspace, "public/nutrition-catalog/sku/foods.full.json");
const openFoodFactsInput = path.join(
  workspace,
  "data/nutrition-catalog-sources/openfoodfacts-ru-19508-source.json"
);
const cliArguments = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  cliArguments.set(process.argv[index], process.argv[index + 1]);
}
const referenceOutput = path.resolve(
  workspace,
  cliArguments.get("--reference-out") || "data/nutrition-catalog-build/localized-reference-ru"
);
const skuOutput = path.resolve(
  workspace,
  cliArguments.get("--sku-out") || "data/nutrition-catalog-build/localized-sku-ru"
);
const CYRILLIC = /[\u0400-\u04FF]/u;
const LATIN_LETTER = /[A-Za-z]/u;
const MIN_OPEN_FOOD_FACTS_RECORDS = 19_409;

const CATEGORY_TRANSLATIONS = new Map([
  ["American Indian/Alaska Native Foods", "Традиционные продукты народов Америки и Аляски"],
  ["Baby Foods", "Детское питание"],
  ["Baked Products", "Выпечка"],
  ["Beef Products", "Продукты из говядины"],
  ["Beverages", "Напитки"],
  ["Breakfast Cereals", "Сухие завтраки"],
  ["Cereal Grains and Pasta", "Крупы и макаронные изделия"],
  ["Dairy and Egg Products", "Молочные и яичные продукты"],
  ["Fast Foods", "Быстрое питание"],
  ["Fats and Oils", "Жиры и масла"],
  ["Finfish and Shellfish Products", "Рыба и морепродукты"],
  ["Fruits and Fruit Juices", "Фрукты и фруктовые соки"],
  ["Lamb, Veal, and Game Products", "Баранина, телятина и дичь"],
  ["Legumes and Legume Products", "Бобовые и продукты из них"],
  ["Meals, Entrees, and Side Dishes", "Готовые блюда и гарниры"],
  ["Nut and Seed Products", "Орехи и семена"],
  ["Pork Products", "Продукты из свинины"],
  ["Poultry Products", "Продукты из птицы"],
  ["Restaurant Foods", "Ресторанные блюда"],
  ["Sausages and Luncheon Meats", "Колбасы и мясные изделия"],
  ["Snacks", "Снеки"],
  ["Soups, Sauces, and Gravies", "Супы, соусы и подливы"],
  ["Spices and Herbs", "Специи и травы"],
  ["Sweets", "Сладости"],
  ["Vegetables and Vegetable Products", "Овощи и продукты из них"]
]);

const PHRASE_TRANSLATIONS = [
  ["ready-to-heat", "готовый к разогреву"],
  ["ready to heat", "готовый к разогреву"],
  ["refrigerated dough", "охлаждённое тесто"],
  ["artificial flavor", "искусственный ароматизатор"],
  ["artificially flavored", "с искусственным ароматизатором"],
  ["with icing", "с глазурью"],
  ["vanilla bean flavored", "со вкусом ванили"],
  ["with water", "с водой"],
  ["with milk", "с молоком"],
  ["with salt", "с солью"],
  ["without salt", "без соли"],
  ["without skin", "без кожи"],
  ["with skin", "с кожей"],
  ["all purpose", "универсальный"],
  ["all-purpose", "универсальный"],
  ["whole grain", "цельнозерновой"],
  ["whole wheat", "цельнозерновой"],
  ["low fat", "пониженной жирности"],
  ["fat free", "обезжиренный"],
  ["sugar free", "без сахара"],
  ["gluten free", "без глютена"],
  ["peanut butter", "арахисовая паста"],
  ["cream cheese", "творожный сыр"],
  ["sour cream", "сметана"],
  ["ice cream", "мороженое"],
  ["orange juice", "апельсиновый сок"],
  ["apple juice", "яблочный сок"],
  ["tomato sauce", "томатный соус"],
  ["tomato paste", "томатная паста"],
  ["chicken breast", "куриная грудка"],
  ["ground beef", "говяжий фарш"],
  ["ground pork", "свиной фарш"],
  ["hot dog", "сосиска"],
  ["french fries", "картофель фри"],
  ["whipped cream", "взбитые сливки"],
  ["cottage cheese", "творог"],
  ["buttermilk", "пахта"],
  ["soy sauce", "соевый соус"],
  ["soy milk", "соевое молоко"],
  ["coconut milk", "кокосовое молоко"],
  ["olive oil", "оливковое масло"],
  ["vegetable oil", "растительное масло"],
  ["sunflower oil", "подсолнечное масло"],
  ["black beans", "чёрная фасоль"],
  ["kidney beans", "красная фасоль"],
  ["green beans", "стручковая фасоль"],
  ["white rice", "белый рис"],
  ["brown rice", "бурый рис"]
];

const WORD_TRANSLATIONS = new Map(Object.entries({
  alcoholic: "алкогольный", almond: "миндальный", almonds: "миндаль", apple: "яблоко", apples: "яблоки",
  apricot: "абрикос", asparagus: "спаржа", avocado: "авокадо", bacon: "бекон", baked: "запечённый",
  baking: "для выпечки", banana: "банан", bananas: "бананы", barbecue: "барбекю", barley: "ячмень",
  bean: "фасоль", beans: "фасоль", beef: "говядина", beverage: "напиток", beverages: "напитки",
  biscuit: "печенье", biscuits: "печенье", blueberry: "черника", boiled: "варёный", bread: "хлеб",
  broccoli: "брокколи", broth: "бульон", brown: "бурый", butter: "масло", cake: "торт",
  canned: "консервированный", candy: "конфеты", caramel: "карамель", carrot: "морковь", carrots: "морковь",
  cereal: "хлопья", cereals: "хлопья", cheese: "сыр", chicken: "курица", chocolate: "шоколад", coating: "панировка",
  chopped: "нарезанный", cocoa: "какао", coconut: "кокос", coffee: "кофе", cooked: "приготовленный",
  cookie: "печенье", cookies: "печенье", corn: "кукуруза", cream: "сливки", crisp: "хрустящий",
  crackers: "крекеры", cranberry: "клюква", cream: "сливки", cucumber: "огурец", cured: "вяленый",
  dark: "тёмный", dessert: "десерт", diet: "диетический", distilled: "дистиллированный", dough: "тесто",
  dried: "сушёный", dry: "сухой", drink: "напиток", duck: "утка", egg: "яйцо", eggs: "яйца", english: "английский",
  enriched: "обогащённый", extract: "экстракт", fat: "жир", fillet: "филе", fish: "рыба",
  flour: "мука", food: "продукт", foods: "продукты", frozen: "замороженный", fruit: "фрукт",
  garlic: "чеснок", ginger: "имбирь", grape: "виноград", grapefruit: "грейпфрут", gravy: "подлива",
  green: "зелёный", ham: "ветчина", honey: "мёд", juice: "сок", lamb: "баранина",
  lean: "постный", lemon: "лимон", lettuce: "салат", light: "лёгкий", liver: "печень",
  low: "пониженный", macaroni: "макароны", mango: "манго", margarine: "маргарин", meat: "мясо", muffin: "маффин",
  milk: "молоко", mixed: "смешанный", molasses: "патока", mushroom: "гриб", mushrooms: "грибы",
  mustard: "горчица", noodles: "лапша", nut: "орех", nuts: "орехи", oat: "овёс",
  oatmeal: "овсянка", oil: "масло", olive: "оливковый", onion: "лук", orange: "апельсин", organic: "органический", original: "оригинальный",
  pancake: "блин", pasta: "паста", peach: "персик", peanut: "арахис", pear: "груша",
  peas: "горох", pepper: "перец", pickle: "соленье", pie: "пирог", pineapple: "ананас",
  plain: "обычный", pork: "свинина", potato: "картофель", potatoes: "картофель", powder: "порошок",
  prepared: "приготовленный", protein: "протеиновый", pudding: "пудинг", pumpkin: "тыква", raw: "сырой", recipe: "рецепт", red: "красный",
  reduced: "пониженный", rice: "рис", roasted: "обжаренный", roll: "булочка", rolls: "булочки",
  salt: "соль", sauce: "соус", sausage: "колбаса", seafood: "морепродукты", seed: "семя",
  seeds: "семена", shellfish: "моллюски", smoked: "копчёный", snack: "перекус", soup: "суп",
  soy: "соя", spinach: "шпинат", spread: "паста", steak: "стейк", strawberry: "клубника",
  sugar: "сахар", syrup: "сироп", table: "столовый", tea: "чай", tomato: "томат", flavored: "со вкусом",
  turkey: "индейка", vanilla: "ваниль", vegetable: "овощной", vegetables: "овощи", veal: "телятина",
  vinegar: "уксус", wafer: "вафля", waffles: "вафли", water: "вода", wheat: "пшеница",
  white: "белый", whole: "цельный", wine: "вино", yogurt: "йогурт", yoghurt: "йогурт"
}));

const TRANSLITERATION_PAIRS = [
  ["sch", "щ"], ["sh", "ш"], ["ch", "ч"], ["zh", "ж"], ["kh", "х"], ["ts", "ц"],
  ["ya", "я"], ["yu", "ю"], ["yo", "ё"], ["ye", "е"], ["ph", "ф"], ["th", "т"],
  ["qu", "кв"], ["ck", "к"], ["ng", "нг"]
];
const TRANSLITERATION_CHARS = new Map(Object.entries({
  a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "дж",
  k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", q: "к", r: "р", s: "с", t: "т",
  u: "у", v: "в", w: "в", x: "кс", y: "й", z: "з"
}));
const MANUAL_FOREIGN_DISPLAY_NAMES = new Map([
  ["乌冬面经典", "Классическая лапша удон"],
  ["נודלס עם רוטב טריאקי", "Лапша с соусом терияки"],
  ["เค้กมะม่วงโยเกิร์ต", "Манговый йогуртовый торт"],
  ["คาราบาวเอสเพรสโซ", "Карабао эспрессо"]
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanText(value) {
  return String(value || "")
    .replace(/&quot;/giu, '"')
    .replace(/&amp;/giu, "&")
    .replace(/&#x27;|&apos;/giu, "'")
    .replace(/&nbsp;/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function transliterateLatinWord(value) {
  let normalized = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  TRANSLITERATION_PAIRS.forEach(([source, target]) => {
    normalized = normalized.replaceAll(source, target);
  });
  return [...normalized].map((char) => TRANSLITERATION_CHARS.get(char) || char).join("");
}

function localizeLatinTitle(value) {
  let localized = cleanText(value);
  PHRASE_TRANSLATIONS.forEach(([source, target]) => {
    localized = localized.replace(new RegExp(`\\b${escapeRegExp(source)}\\b`, "giu"), target);
  });
  localized = localized.replace(/[A-Za-z]+/gu, (word) => {
    const translated = WORD_TRANSLATIONS.get(word.toLocaleLowerCase("en"));
    return translated || transliterateLatinWord(word);
  });
  localized = localized
    .replace(/\s+([,.;:!?])/gu, "$1")
    .replace(/\s{2,}/gu, " ")
    .trim();
  return localized ? `${localized.charAt(0).toLocaleUpperCase("ru")}${localized.slice(1)}` : "";
}

function localizeDisplayName(food, { includeCategory = false } = {}) {
  const original = cleanText(food.name);
  if (CYRILLIC.test(original) && !LATIN_LETTER.test(original)) return original;
  if (!LATIN_LETTER.test(original)) return food.barcode ? `Товар ${food.barcode}` : "Продукт питания";
  const localized = localizeLatinTitle(original) || "Продукт питания";
  const category = CATEGORY_TRANSLATIONS.get(food.category) || localizeLatinTitle(food.category);
  const categorized = includeCategory && category ? `${category}: ${localized}` : localized;
  return categorized.length <= 160 ? categorized : localized;
}

function localizedCategory(value) {
  return CATEGORY_TRANSLATIONS.get(value) || (CYRILLIC.test(value || "") ? value : localizeLatinTitle(value));
}

function localizedQuantity(value) {
  return cleanText(value)
    .replace(/\bml\b/giu, "мл")
    .replace(/\boz\b/giu, "унц.")
    .replace(/\blb\b/giu, "фунт");
}

function isUsableRussianDisplayText(value) {
  const text = cleanText(value);
  if (!CYRILLIC.test(text) || text.length > 160) return false;
  const letters = text.match(/\p{L}/gu) || [];
  const cyrillicLetters = text.match(/[\u0400-\u04FF]/gu) || [];
  const digits = (text.match(/\p{N}/gu) || []).length;
  return letters.length >= 3
    && cyrillicLetters.length / letters.length >= 0.65
    && digits <= Math.max(8, Math.floor(letters.length / 2));
}

function isUsableRussianDescription(value) {
  const text = cleanText(value);
  if (!isUsableRussianDisplayText(text) || text.length > 110) return false;
  return !/(?:ингредиент|состав|вода\s*[,;:]|сахар\s*[,;:]|\d{2,}\s*%)/iu.test(text);
}

function uniqueStrings(values) {
  const seen = new Set();
  return values.reduce((result, value) => {
    const normalized = cleanText(value);
    const key = normalized.toLocaleLowerCase("ru");
    if (normalized && !seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }
    return result;
  }, []);
}

function roundCatalogNumber(value, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > maximum) return null;
  return Math.round(numeric * 1000) / 1000;
}

function isoFromUnixSeconds(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const date = new Date(numeric * 1000);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback;
}

function recordFromExisting(food, { includeCategory = false } = {}) {
  const name = localizeDisplayName(food, { includeCategory });
  const originalName = cleanText(food.name);
  return {
    recordType: food.recordType,
    name,
    brand: cleanText(food.brand),
    ...(food.barcode ? { barcode: food.barcode } : {}),
    category: localizedCategory(food.category),
    quantity: localizedQuantity(food.quantity),
    aliases: uniqueStrings([originalName, ...(food.aliases || [])]),
    nutrition: {
      basis: "100g",
      calories: food.calories,
      protein: food.protein,
      fat: food.fat,
      carbs: food.carbs
    },
    source: food.source,
    verification: food.verification
  };
}

function recordFromOpenFoodFacts(product, builtAt) {
  const nutrition = product.nutrition_per_100g || {};
  const calories = roundCatalogNumber(nutrition.kcal, 1000);
  const protein = roundCatalogNumber(nutrition.proteins, 100);
  const fat = roundCatalogNumber(nutrition.fats, 100);
  const carbs = roundCatalogNumber(nutrition.carbohydrates, 100);
  if ([calories, protein, fat, carbs].some((value) => value === null)) return null;

  const originalName = cleanText(product.name);
  const russianName = cleanText(product.name_ru);
  const russianDescription = cleanText(product.description_ru);
  const usableOriginalName = originalName.length <= 160;
  const selectedName = isUsableRussianDisplayText(russianName)
    ? russianName
    : isUsableRussianDescription(russianDescription)
      ? russianDescription
      : MANUAL_FOREIGN_DISPLAY_NAMES.get(originalName)
        || (usableOriginalName && LATIN_LETTER.test(originalName)
        ? localizeLatinTitle(originalName)
        : `Товар со штрихкодом ${product.barcode}`);
  const name = LATIN_LETTER.test(selectedName) ? localizeLatinTitle(selectedName) : selectedName;
  if (!name) return null;

  const sourceUrl = cleanText(product.source_url);
  if (!/^https?:\/\//iu.test(sourceUrl)) return null;
  const sourceUpdatedAt = isoFromUnixSeconds(product.updated_at, builtAt);
  const market = product.market === "BY" ? "belarus" : product.market === "RU" ? "russia" : "localized_other";
  return {
    recordType: "sku",
    barcode: String(product.barcode || "").trim(),
    barcodeValidation: "source_numeric_or_gtin",
    name,
    brand: cleanText(product.brand),
    category: "Продукты Open Food Facts",
    aliases: uniqueStrings([
      usableOriginalName ? originalName : "",
      russianName,
      isUsableRussianDescription(russianDescription) ? russianDescription : ""
    ]),
    nutrition: { basis: "100g", calories, protein, fat, carbs },
    source: {
      kind: "Open Food Facts",
      recordId: String(product.barcode || "").trim(),
      url: sourceUrl,
      retrievedAt: builtAt,
      license: "ODbL-1.0",
      marketScope: market,
      sourceUpdatedAt,
      marketTags: Array.isArray(product.countries_tags) ? product.countries_tags : []
    },
    verification: {
      status: "source_record",
      method: "filtered_complete_100g_nutrition_record",
      verifiedAt: builtAt,
      evidenceUrl: sourceUrl
    }
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

const [referenceFoods, existingSkuFoods, openFoodFacts] = await Promise.all([
  readJson(referenceInput),
  readJson(skuInput),
  readJson(openFoodFactsInput)
]);
if (!Array.isArray(referenceFoods) || !Array.isArray(existingSkuFoods) || !Array.isArray(openFoodFacts?.products)) {
  throw new Error("Catalog source files have an unexpected shape.");
}
if (openFoodFacts.products.length !== 19508) {
  throw new Error(`Expected 19508 Open Food Facts source products, received ${openFoodFacts.products.length}`);
}

const builtAt = new Date().toISOString();
const referenceRecords = referenceFoods.map((food) => recordFromExisting(food, { includeCategory: true }));
const skuByBarcode = new Map(existingSkuFoods.map((food) => [food.barcode, recordFromExisting(food)]));
let invalidNutritionCount = 0;
let invalidTitleCount = 0;
let replacedExistingSkuCount = 0;
let retainedExistingSkuCount = 0;
let addedOpenFoodFactsCount = 0;

openFoodFacts.products.forEach((product) => {
  const imported = recordFromOpenFoodFacts(product, builtAt);
  if (!imported) {
    const nutrition = product.nutrition_per_100g || {};
    const hasValidNutrition = [
      roundCatalogNumber(nutrition.kcal, 1000),
      roundCatalogNumber(nutrition.proteins, 100),
      roundCatalogNumber(nutrition.fats, 100),
      roundCatalogNumber(nutrition.carbohydrates, 100)
    ].every((value) => value !== null);
    if (hasValidNutrition) invalidTitleCount += 1;
    else invalidNutritionCount += 1;
    return;
  }
  const existing = skuByBarcode.get(imported.barcode);
  if (!existing) {
    skuByBarcode.set(imported.barcode, imported);
    addedOpenFoodFactsCount += 1;
    return;
  }
  if (CYRILLIC.test(existing.name)) {
    retainedExistingSkuCount += 1;
  } else {
    skuByBarcode.set(imported.barcode, imported);
    replacedExistingSkuCount += 1;
  }
});

const skuRecords = [...skuByBarcode.values()];
if (19508 - invalidNutritionCount - invalidTitleCount < MIN_OPEN_FOOD_FACTS_RECORDS) {
  throw new Error(`Open Food Facts nutrition validation retained fewer than ${MIN_OPEN_FOOD_FACTS_RECORDS} products.`);
}

const referenceCatalog = buildNutritionCatalog({ generatedAt: builtAt, records: referenceRecords }, {
  minRecords: referenceRecords.length
});
const skuCatalog = buildNutritionCatalog({ generatedAt: builtAt, records: skuRecords }, {
  minRecords: skuRecords.length
});

await writeNutritionCatalog(referenceOutput, referenceCatalog);
await writeNutritionCatalog(skuOutput, skuCatalog);

console.log(JSON.stringify({
  builtAt,
  reference: referenceCatalog.report,
  sku: skuCatalog.report,
  sourceCounts: {
    existingReference: referenceFoods.length,
    existingSku: existingSkuFoods.length,
    openFoodFactsSource: openFoodFacts.products.length,
    openFoodFactsRetainedAfterQualityValidation: openFoodFacts.products.length - invalidNutritionCount - invalidTitleCount,
    openFoodFactsSkippedInvalidNutrition: invalidNutritionCount,
    openFoodFactsSkippedInvalidTitle: invalidTitleCount,
    openFoodFactsAdded: addedOpenFoodFactsCount,
    openFoodFactsReplacedEnglishExistingSku: replacedExistingSkuCount,
    existingSkuRetainedOnDuplicateBarcode: retainedExistingSkuCount
  },
  output: { referenceOutput, skuOutput }
}, null, 2));
