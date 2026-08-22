import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const USDA_DOWNLOAD_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip";
const USDA_FOOD_URL = "https://fdc.nal.usda.gov/fdc-app.html#/food-details/";
const NUTRIENT_IDS = {
  calories: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005
};
const CATEGORY_PRIORITY = [
  "Fruits and Fruit Juices",
  "Vegetables and Vegetable Products",
  "Cereal Grains and Pasta",
  "Legumes and Legume Products",
  "Nut and Seed Products",
  "Dairy and Egg Products",
  "Fats and Oils",
  "Poultry Products",
  "Beef Products",
  "Pork Products",
  "Finfish and Shellfish Products",
  "Lamb, Veal, and Game Products",
  "Spices and Herbs",
  "Beverages",
  "Baked Products",
  "Breakfast Cereals"
];
const CATEGORY_RANK = new Map(CATEGORY_PRIORITY.map((category, index) => [category, index]));
// These ordinary foods must remain present even when the requested reference
// layer is smaller than the full USDA SR Legacy dataset. They are FDC IDs,
// not locally invented records or nutrition values.
const CORE_REFERENCE_FDC_IDS = [
  "173944", // bananas
  "171688", // apples
  "170457", // tomatoes
  "168409", // cucumber
  "170393", // carrots
  "170000", // onions
  "169975", // cabbage
  "170379", // broccoli
  "169986", // cauliflower
  "170440", // boiled potatoes
  "168878", // cooked rice
  "170686", // cooked buckwheat
  "169751", // cooked pasta
  "169705", // oats
  "175254", // cooked lentils
  "173800", // chickpeas
  "170567", // almonds
  "170186", // walnuts
  "173424", // hard-boiled eggs
  "171477", // roasted chicken breast
  "167818", // pork loin
  "169473", // cooked ground beef
  "171998", // cooked Atlantic salmon
  "171986", // canned tuna
  "171265", // whole milk
  "171267", // 2% milk
  "172179", // cottage cheese
  "170894", // plain Greek yogurt
  "173414", // cheddar
  "174924", // white bread
  "171413", // olive oil
  "171017" // sunflower oil
];
const RUSSIAN_ALIASES_BY_FDC_ID = new Map([
  ["173944", ["банан", "бананы", "банан сырой"]],
  ["171688", ["яблоко", "яблоки", "яблоко сырое"]],
  ["168878", ["рис вареный", "рис белый вареный"]],
  ["170686", ["гречка вареная", "гречка"]],
  ["171477", ["куриная грудка", "куриное филе"]],
  ["170440", ["картофель вареный", "картошка вареная"]],
  ["173424", ["яйцо вареное", "яйцо куриное"]],
  ["170457", ["помидор", "помидоры", "томат", "томаты сырые"]],
  ["168409", ["огурец", "огурцы", "огурец сырой"]],
  ["170393", ["морковь", "морковь сырая"]],
  ["170000", ["лук", "лук репчатый", "лук сырой"]],
  ["169975", ["капуста", "капуста белокочанная", "капуста сырая"]],
  ["170379", ["брокколи", "брокколи сырая"]],
  ["169986", ["цветная капуста", "капуста цветная"]],
  ["169097", ["апельсин", "апельсины", "апельсин сырой"]],
  ["169118", ["груша", "груши", "груша сырая"]],
  ["174682", ["виноград", "виноград сырой"]],
  ["167762", ["клубника", "клубника сырая"]],
  ["171711", ["черника", "голубика", "черника сырая"]],
  ["169751", ["макароны вареные", "паста вареная"]],
  ["169705", ["овсянка", "овес", "овсяные хлопья"]],
  ["175254", ["чечевица вареная", "чечевица"]],
  ["173800", ["нут консервированный", "нут"]],
  ["168574", ["бобы", "бобы сырые"]],
  ["170567", ["миндаль"]],
  ["170186", ["грецкий орех", "грецкие орехи"]],
  ["173414", ["сыр чеддер", "чеддер"]],
  ["169473", ["фарш говяжий", "говядина фарш жареный"]],
  ["171265", ["молоко", "молоко 3,25%", "молоко цельное"]],
  ["171267", ["молоко 2%", "молоко 2,0%"]],
  ["172179", ["творог", "творожный сыр"]],
  ["170894", ["йогурт греческий", "греческий йогурт"]],
  ["174924", ["хлеб белый", "батон"]],
  ["167818", ["свинина", "свиная корейка"]],
  ["171998", ["лосось", "семга", "рыба"]],
  ["171986", ["тунец", "рыба тунец"]],
  ["171413", ["масло оливковое", "оливковое масло"]],
  ["171017", ["масло подсолнечное", "подсолнечное масло"]]
]);

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) fail(`Unexpected argument: ${argument}`);

    const [rawKey, inlineValue] = argument.slice(2).split("=", 2);
    if (!rawKey) fail("Empty option name");
    if (inlineValue !== undefined) {
      args[rawKey] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) fail(`Missing value for --${rawKey}`);
    args[rawKey] = next;
    index += 1;
  }
  return args;
}

function parsePositiveInteger(value, optionName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    fail(`--${optionName} must be a positive integer`);
  }
  return parsed;
}

function normalizeText(value, maximumLength = 280) {
  const normalized = String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim();
  return normalized.length <= maximumLength ? normalized : "";
}

function foodNutrientAmounts(food) {
  const amounts = new Map();

  (food.foodNutrients || []).forEach((entry) => {
    const nutrientId = Number(entry?.nutrient?.id);
    const amount = Number(entry?.amount);
    if (Number.isFinite(nutrientId) && Number.isFinite(amount) && !amounts.has(nutrientId)) {
      amounts.set(nutrientId, amount);
    }
  });

  return {
    calories: amounts.get(NUTRIENT_IDS.calories),
    protein: amounts.get(NUTRIENT_IDS.protein),
    fat: amounts.get(NUTRIENT_IDS.fat),
    carbs: amounts.get(NUTRIENT_IDS.carbs)
  };
}

function isPlausibleNutrition(nutrition) {
  return Object.values(nutrition).every(Number.isFinite)
    && nutrition.calories >= 0
    && nutrition.calories <= 1000
    && nutrition.protein >= 0
    && nutrition.protein <= 100
    && nutrition.fat >= 0
    && nutrition.fat <= 100
    && nutrition.carbs >= 0
    && nutrition.carbs <= 100;
}

function categoryRank(category) {
  return CATEGORY_RANK.get(category) ?? CATEGORY_PRIORITY.length;
}

function buildReferenceRecord(food, retrievedAt) {
  const fdcId = String(food?.fdcId || "");
  const name = normalizeText(food?.description);
  const category = normalizeText(food?.foodCategory?.description);
  const nutrition = foodNutrientAmounts(food);
  if (!/^\d+$/.test(fdcId) || !name || !isPlausibleNutrition(nutrition)) return null;

  const sourceUrl = `${USDA_FOOD_URL}${fdcId}/nutrients`;
  return {
    record: {
      recordType: "reference_food",
      name,
      brand: "",
      aliases: RUSSIAN_ALIASES_BY_FDC_ID.get(fdcId) || [],
      category,
      nutrition: {
        basis: "100g",
        ...nutrition
      },
      source: {
        kind: "USDA FoodData Central SR Legacy",
        recordId: fdcId,
        url: sourceUrl,
        downloadUrl: USDA_DOWNLOAD_URL,
        retrievedAt,
        license: "CC0-1.0",
        marketScope: "global_reference"
      },
      verification: {
        status: "source_record",
        method: "official_food_composition_record",
        verifiedAt: retrievedAt,
        evidenceUrl: sourceUrl
      }
    },
    categoryRank: categoryRank(category)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.output) {
    fail("Usage: node scripts/import-usda-sr-legacy-reference.mjs --input <sr-legacy.json> --output <reference-foods.json> [--limit 3000] [--min-records 3000]");
  }

  const limit = parsePositiveInteger(args.limit || "3000", "limit");
  const minRecords = parsePositiveInteger(args["min-records"] || "3000", "min-records");
  if (limit < minRecords) fail("--limit must be greater than or equal to --min-records");

  await access(args.input);
  const retrievedAt = new Date().toISOString();
  const data = JSON.parse(await readFile(args.input, "utf8"));
  if (!Array.isArray(data?.SRLegacyFoods)) {
    fail("Expected a USDA SR Legacy JSON export with an SRLegacyFoods array");
  }

  const rejected = new Map();
  const candidates = data.SRLegacyFoods
    .map((food) => {
      const candidate = buildReferenceRecord(food, retrievedAt);
      if (!candidate) rejected.set("missing_or_invalid_required_nutrition", (rejected.get("missing_or_invalid_required_nutrition") || 0) + 1);
      return candidate;
    })
    .filter(Boolean)
    .sort((left, right) => (
      left.categoryRank - right.categoryRank
      || left.record.category.localeCompare(right.record.category)
      || left.record.name.localeCompare(right.record.name)
      || left.record.source.recordId.localeCompare(right.record.source.recordId)
    ));
  const candidatesByFdcId = new Map(candidates.map((candidate) => [candidate.record.source.recordId, candidate]));
  const missingCoreIds = CORE_REFERENCE_FDC_IDS.filter((fdcId) => !candidatesByFdcId.has(fdcId));
  if (missingCoreIds.length) {
    fail(`USDA SR Legacy export is missing required core FDC IDs: ${missingCoreIds.join(", ")}`);
  }
  const coreIds = new Set(CORE_REFERENCE_FDC_IDS);
  const records = [
    ...CORE_REFERENCE_FDC_IDS.map((fdcId) => candidatesByFdcId.get(fdcId)),
    ...candidates.filter((candidate) => !coreIds.has(candidate.record.source.recordId))
  ]
    .slice(0, limit)
    .map((candidate) => candidate.record);

  if (records.length < minRecords) {
    fail(`USDA selection found only ${records.length} records; --min-records requires at least ${minRecords}. No output was written.`);
  }

  const output = {
    meta: {
      schemaVersion: 1,
      provider: "USDA FoodData Central SR Legacy",
      license: "CC0-1.0",
      retrievedAt,
      downloadUrl: USDA_DOWNLOAD_URL,
      marketScopeDefinition: "Global food-composition reference values; not retailer SKU availability in Belarus",
      selection: {
        limit,
        categoryPriority: CATEGORY_PRIORITY
      },
      strictAdmission: [
        "official USDA SR Legacy food record",
        "stable FDC ID",
        "published energy/protein/fat/carbohydrates values per 100g",
        "no value derived by this importer"
      ]
    },
    records
  };

  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    sourceFoods: data.SRLegacyFoods.length,
    selected: records.length,
    rejected: Object.fromEntries(rejected)
  }, null, 2));
}

main().catch((error) => {
  console.error(`USDA SR Legacy import failed: ${error.message}`);
  process.exitCode = 1;
});
